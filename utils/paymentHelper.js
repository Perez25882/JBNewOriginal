import User from '../models/user.model.js';
import Transaction from '../models/transaction.model.js';
import Commission from '../models/commission.model.js';
import { sendTransactionReceiptEmail } from "../services/emailServices/email.service.js";
import { createBossuOrder } from "./bossu-api-implementation.js";


// Separate async function for processing and Creating Transaction in DB
export async function processWebhookEvent(event) {
    const { reference, status, channel, metadata, paid_at } = event.data;

    // Find the pending transaction
    const transaction = await Transaction.findOne({ reference });

    if (!transaction) {
        console.error('Transaction not found for reference:', reference);
        return;
    }

    // Prevent duplicate processing
    if (transaction.status === 'success' || transaction.status === 'failed') {
        console.log('Transaction already processed:', reference);
        return;
    }

    // Handle successful charges
    if (event.event === 'charge.success') {
        transaction.status = status;
        transaction.channel = channel;
        transaction.provider_response = {
            gateway_response: event.data.gateway_response,
            paid_at: event.data.paid_at,
            ip_address: event.data.ip_address
        };

        await transaction.save();



        //BOSSU API INTEGRATION STARTS HERE
        let bossuResponse = null;
        let bossuOrderCreated = false;
        try {
            console.log("About to make the BossuApi call")
            bossuResponse = await createBossuOrder(transaction);
            const bossuData = bossuResponse.data;
            console.log("Successfully made the API call", bossuResponse)

            if (bossuResponse.success === true) {
                const isIdempotent = bossuResponse.message.includes("Existing order returned");
                // Map Bossu API status to your DB enum
                const statusMap = {
                    'completed': 'delivered',
                    'processing': 'processing',
                    'pending': 'pending',
                    'failed': 'failed'
                };
                const normalizedStatus = statusMap[bossuData.status] || bossuData.status;
                if (isIdempotent) {
                    // Idempotent response - limited data
                    transaction.bossuResponse = {
                        order_id: bossuData.order_id,
                        status: bossuData.status,
                        price: bossuData.price,
                        created_at: bossuData.created_at,
                        isIdempotent: true
                    };
                } else {
                    // Fresh order creation - full data
                    transaction.bossuResponse = {
                        order_id: bossuData.order_id,
                        external_reference: bossuData.reference,
                        status: bossuData.status,
                        price: bossuData.price,
                        recipient_phone: bossuData.recipient_phone,
                        network: bossuData.network,
                        package_key: bossuData.package_key,
                        isIdempotent: false
                    };
                }

                transaction.deliveryStatus = normalizedStatus;
                bossuOrderCreated = true;
                await transaction.save();
            }
        } catch (bossuError) {
            // Save error to transaction for tracking
            transaction.bossuError = {
                message: bossuError.message,
                timestamp: new Date(),
            };

            transaction.deliveryStatus = 'failed';
            await transaction.save();
            console.log('⚠️  Continuing with email despite Bossu error...');
        }
        ////BOSSU API INTEGRATION ENDS HERE



        //Fire and forget email sending - don't block main flow
        sendTransactionReceiptEmail({
            to: transaction.email,
            amount: transaction.amount,
            bundleName: transaction.bundleName,
            reference: reference,
            date: paid_at,
            phoneNumber: transaction.metadata.phoneNumberReceivingData,
            paymentMethod: channel,
        }).then(() => console.log('Receipt email sent')).catch(err => console.error('Failed to send receipt email (JS:60 Utils/payhelper):', err));



        // ✅ Commission logic - only after payment confirmed
        if (transaction.resellerCode && transaction.metadata?.resellerProfit) {
            const commissionAmount = transaction.metadata.resellerProfit;
            try {

                // 1. Create Commission record
                await Commission.create({
                    reseller: transaction.metadata?.resellerId,
                    resellerName: transaction.metadata?.resellerName,
                    transaction: transaction._id,
                    bundle: transaction.bundleId,
                    amount: commissionAmount,
                    percentage: transaction.metadata?.resellerCommissionPercentage,
                    status: "earned",
                    month: new Date().toISOString().slice(0, 7) // "2025-12"
                });

                // 2. Update reseller's total commission (accumulative)
                await User.findByIdAndUpdate(
                    transaction.metadata?.resellerId,
                    {
                        $inc: {
                            totalCommissionEarned: commissionAmount,
                            totalSales: 1
                        }
                    }
                );


            } catch (error) {
                console.error('❌❌❌ Error processing commission:', error);

            }
        }
    }

    // Handle failed charges
    else if (event.event === 'charge.failed') {
        transaction.status = status;
        transaction.provider_response = {
            reason: event.data.gateway_response,
            failed_at: event.data.paid_at || new Date()
        };

        await transaction.save();

        // ❌ NO commission for failed payments
        console.log('Transaction failed:', reference);
    }

    // Log other events but don't process
    else {
        console.log('Ignoring event:', event.event);
    }
}
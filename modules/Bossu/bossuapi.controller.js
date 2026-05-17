
import Transaction from "../../models/transaction.model.js";
import BulkExport from "../../models/bulkexport.model.js";

export const bossuWebhookHandler = async (req, res) => {
  try {
    console.log('📩 Bossu webhook received');
    console.log('Raw payload:', JSON.stringify(req.body, null, 2));
 
    const { event, data } = req.body;
 
    // ✅ Check for nested data structure
    if (!data) {
      console.warn('❌ Bossu webhook missing data field');
      console.warn('Expected format: { event: "order.status_updated", data: {...} }');
      console.warn('Received:', req.body);
      return res.status(400).json({ 
        success: false, 
        error: 'Missing data field. Expected nested structure: { event, data }' 
      });
    }
 
    // Extract fields from data
    const { reference, status, order_id, network, package_name, recipient_phone, price, updated_at } = data;
 
    // Validate required fields
    if (!reference || !status) {
      console.warn('❌ Bossu webhook missing required fields in data:');
      console.warn('   reference:', reference);
      console.warn('   status:', status);
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: reference, status' 
      });
    }
 
    console.log(`✅ Valid webhook received`);
    console.log(`   Event: ${event}`);
    console.log(`   Reference: ${reference}`);
    console.log(`   Status: ${status}`);
    console.log(`   Order ID: ${order_id}`);
 
    // Route to appropriate handler
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
        return handleOrderCompleted({
          reference,
          order_id,
          status,
          network,
          package_name,
          recipient_phone,
          price,
          updated_at
        }, res);
      
      case 'failed':
        return handleOrderFailed({
          reference,
          order_id,
          status,
          network,
          package_name
        }, res);
      
      case 'cancelled':
        return handleOrderCancelled({
          reference,
          order_id,
          status
        }, res);
      
      case 'pending':
      case 'processing':
        return handleOrderProcessing({
          reference,
          order_id,
          status
        }, res);
      
      default:
        console.warn(`⚠️ Unknown status from Bossu: ${status}`);
        return res.status(200).json({ 
          received: true, 
          warning: `Unknown status: ${status}` 
        });
    }
  } catch (error) {
    console.error('❌ Error in Bossu webhook handler:', error);
    return res.status(200).json({ 
      received: true, 
      error: error.message 
    });
  }
};
 
async function handleOrderCompleted(data, res) {
  const { reference, order_id, status, network, package_name, recipient_phone, price, updated_at } = data;
 
  try {
    console.log(`🔄 Processing completed order: ${reference}`);
 
    const transaction = await Transaction.findOne({
      $or: [
        { reference },
        { 'bossuResponse.order_id': order_id }
      ]
    });
 
    if (!transaction) {
      console.warn(`⚠️ No transaction found for reference: ${reference}`);
      return res.status(200).json({
        received: true,
        message: 'Order completed but no matching transaction found'
      });
    }
 
    const updateResult = await Transaction.updateOne(
      { _id: transaction._id },
      {
        $set: {
          deliveryStatus: 'delivered', // Use the status from Bossu
          'bossuResponse.status': status,
          'bossuResponse.updated_at': updated_at || new Date(),
          updatedAt: new Date()
        }
      }
    );

    console.log("UPDATEDDDD", updateResult)
 
    console.log(`✅ Order completed and transaction updated`);
    console.log(`   Transaction ID: ${transaction._id}`);
    console.log(`   Reference: ${reference}`);
    console.log(`   Network: ${network}, Package: ${package_name}`);
    console.log(`   Recipient: ${recipient_phone}, Price: ${price}`);
 
    return res.status(200).json({
      success: true,
      message: 'Order marked as completed',
      transactionId: transaction._id,
      reference,
      status: 'delivered'
    });
 
  } catch (error) {
    console.error(`❌ Error handling completed order ${reference}:`, error);
    return res.status(200).json({ 
      received: true, 
      error: error.message 
    });
  }
}
 
async function handleOrderFailed(data, res) {
  const { reference, order_id, status, network, package_name } = data;
 
  try {
    console.log(`🔄 Processing failed order: ${reference}`);
 
    const transaction = await Transaction.findOne({
      $or: [
        { reference },
        { 'bossuResponse.order_id': order_id }
      ]
    });
 
    if (!transaction) {
      console.warn(`⚠️ No transaction found for failed order: ${reference}`);
      return res.status(200).json({
        received: true,
        message: 'Order failed but no matching transaction found'
      });
    }
 
    await Transaction.updateOne(
      { _id: transaction._id },
      {
        $set: {
          deliveryStatus: 'failed',
          'bossuResponse.status': 'failed',
          'bossuResponse.updated_at': new Date(),
          updatedAt: new Date()
        }
      }
    );
 
    console.log(`❌ Order failed: ${reference} - ${network} ${package_name}`);
 
    return res.status(200).json({
      success: true,
      message: 'Order marked as failed',
      transactionId: transaction._id,
      reference,
      status: 'failed'
    });
 
  } catch (error) {
    console.error(`❌ Error handling failed order ${reference}:`, error);
    return res.status(200).json({ 
      received: true, 
      error: error.message 
    });
  }
}
 
async function handleOrderCancelled(data, res) {
  const { reference, order_id, status } = data;
 
  try {
    console.log(`🔄 Processing cancelled order: ${reference}`);
 
    const transaction = await Transaction.findOne({
      $or: [
        { reference },
        { 'bossuResponse.order_id': order_id }
      ]
    });
 
    if (!transaction) {
      console.warn(`⚠️ No transaction found for cancelled order: ${reference}`);
      return res.status(200).json({
        received: true,
        message: 'Order cancelled but no matching transaction found'
      });
    }
 
    await Transaction.updateOne(
      { _id: transaction._id },
      {
        $set: {
          deliveryStatus: 'failed',
          'bossuResponse.status': 'cancelled',
          'bossuResponse.updated_at': new Date(),
          updatedAt: new Date()
        }
      }
    );
 
    console.log(`⚠️ Order cancelled: ${reference}`);
 
    return res.status(200).json({
      success: true,
      message: 'Order marked as cancelled',
      transactionId: transaction._id,
      reference,
      status: 'cancelled'
    });
 
  } catch (error) {
    console.error(`❌ Error handling cancelled order ${reference}:`, error);
    return res.status(200).json({ 
      received: true, 
      error: error.message 
    });
  }
}
 
async function handleOrderProcessing(data, res) {
  const { reference, order_id, status } = data;
 
  try {
    console.log(`⏳ Order processing: ${reference} - Status: ${status}`);
 
    const transaction = await Transaction.findOne({
      $or: [
        { reference },
        { 'bossuResponse.order_id': order_id }
      ]
    });
 
    if (!transaction) {
      return res.status(200).json({
        received: true,
        message: 'Processing order but no matching transaction found'
      });
    }
 
    await Transaction.updateOne(
      { _id: transaction._id },
      {
        $set: {
          deliveryStatus: status || 'processing',
          'bossuResponse.status': status,
          'bossuResponse.updated_at': new Date()
        }
      }
    );
 
    console.log(`⏳ Order ${reference} status: ${status}`);
 
    return res.status(200).json({
      received: true,
      message: `Order is ${status}`,
      reference,
      status
    });
 
  } catch (error) {
    console.error(`❌ Error handling processing order ${reference}:`, error);
    return res.status(200).json({ 
      received: true, 
      error: error.message 
    });
  }
}
 



export default {
  bossuWebhookHandler,
};
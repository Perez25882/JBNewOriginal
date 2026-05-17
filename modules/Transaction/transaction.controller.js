import Transaction from '../../models/transaction.model.js';
import BulkExport from '../../models/bulkexport.model.js';
import { getBossuBalance } from '../../utils/bossu-api-implementation.js';
import mongoose from 'mongoose';


// Helper function to generate unique export ID
function generateUniqueId() {
  return `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  // Example: EXP-1704067200000-A7X9K2L
}



/**
 * Calculate analytics data based on filter
 */
const getAnalytics = async (filter) => {
  try {
    // Build filter for successful transactions only (for most calculations)
    const successFilter = { ...filter, status: 'success' };

    // Aggregate analytics in parallel
    const [revenueData, ordersData, profitData, costData, activeOrdersData, processingOrdersData, deliveredOrderData, failedOrderData] = await Promise.all([
      // Total Revenue (sum of amounts for successful transactions)
      Transaction.aggregate([
        { $match: successFilter },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' }
          }
        }
      ]),

      // Total Orders (count of successful transactions)
      Transaction.countDocuments(successFilter),

      // Profit calculations
      Transaction.aggregate([
        { $match: successFilter },
        {
          $group: {
            _id: null,
            totalJBProfit: { $sum: '$JBProfit' }
          }
        }
      ]),

      // Total Cost (sum of JBCP for successful transactions)
      Transaction.aggregate([
        { $match: successFilter },
        {
          $group: {
            _id: null,
            totalBaseCost: { $sum: '$baseCost' },
            totalJBProfit: { $sum: '$JBProfit' }
          }
        }
      ]),

      // Active Orders (successful transactions with pending delivery)
      Transaction.countDocuments({
        ...successFilter,
        deliveryStatus: 'pending'
      }),


      //Processing Transactions
      Transaction.countDocuments({
        ...successFilter,
        deliveryStatus: 'processing'
      }),


      Transaction.countDocuments({
        ...successFilter,
        deliveryStatus: 'delivered'
      }),

      Transaction.countDocuments({
        ...successFilter,
        deliveryStatus: 'failed'
      })

    ]);






    const PAYSTACK_FEE = 0.03; // 1.5% Paystack fee constant


    // Calculate totals
    const totalRevenue = revenueData[0]?.totalRevenue || 0;
    const totalOrders = ordersData || 0;
    const totalJBProfit = profitData[0]?.totalJBProfit || 0;
    const developersProfit = totalJBProfit * 0.26 || 0; // 20% of JBProfit
    const activeOrders = activeOrdersData || 0;
    const processingOrders = processingOrdersData || 0;
    const deliveredOrders = deliveredOrderData || 0;
    const failedOrders = failedOrderData || 0;


    // Calculate total JBCP (baseCost - JBProfit for all successful transactions)
    const totalBaseCost = costData[0]?.totalBaseCost || 0;
    const totalJBProfitForCost = costData[0]?.totalJBProfit || 0;
    const totalJBCP = totalBaseCost - totalJBProfitForCost;



    // Calculate Paystack fees and revenue before fees
    const totalRevenueBeforePaystackAddition = totalRevenue / (1 + PAYSTACK_FEE);
    const totalPaystackFees = totalRevenue - totalRevenueBeforePaystackAddition;

    //TOTAL RESELLERS PROFIT FOR NOW, BUT WILL MOST LIKELY USE  CREATED BY ME CHUKS
    const totalResellerProfits = totalRevenue - totalBaseCost - totalPaystackFees || 0
    const totalActualJBCPCost = totalRevenue - totalJBProfit - totalResellerProfits - totalPaystackFees || 0.
    const totalCost = totalResellerProfits + totalActualJBCPCost || 0;


    // Calculate additional metrics
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const profitMargin = totalRevenue > 0 ? (totalJBProfit / totalRevenue) * 100 : 0;

    console.log("Total Paystack Fees", totalPaystackFees)
    console.log("Total Revenue before Paystack addition", totalRevenueBeforePaystackAddition)

    return {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalOrders,
      activeOrders,
      processingOrders,
      deliveredOrders,
      failedOrders,
      totalJBProfit: parseFloat(totalJBProfit.toFixed(2)),
      developersProfit: parseFloat(developersProfit.toFixed(2)),
      totalCost: parseFloat(totalCost.toFixed(2)),
      totalJBCP: parseFloat(totalJBCP.toFixed(2)),
      averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
      profitMargin: parseFloat(profitMargin.toFixed(2)),
      totalResellerProfits: parseFloat(totalResellerProfits.toFixed(2)),
      totalActualJBCPCost: parseFloat(totalActualJBCPCost.toFixed(2)),
      totalPaystackFees: parseFloat(totalPaystackFees.toFixed(2)),
      totalRevenueBeforePaystackAddition: parseFloat(totalRevenueBeforePaystackAddition.toFixed(2)),

      currency: 'GHS'
    };

  } catch (error) {
    console.error('Error calculating analytics:', error);
    return {
      totalRevenue: 0,
      totalOrders: 0,
      activeOrders: 0,
      deliveredOrders: 0,
      processingOrders: 0,
      failedOrders: 0, 
      totalJBProfit: 0,
      developersProfit: 0,
      totalCost: 0,
      totalJBCP: 0,
      averageOrderValue: 0,
      totalResellerProfits: 0,
      totalActualJBCPCost: 0,
      profitMargin: 0,
      totalPaystackFees: 0,
      totalRevenueBeforePaystackAddition: 0,
      currency: 'GHS',
      error: 'Failed to calculate some analytics'
    };
  }
};





export const getTransactions = async (req, res) => {
  try {
    // Extract and validate query parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;


    const {
      status,
      network,
      startDate,
      endDate,
      search,
      resellerCode,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter query
    const filter = {
      // Default to successful transactions only
      status: status || 'success'
    };

    // Network filter
    if (network) {
      filter['metadata.network'] = network;
    }

    // Reseller filter
    if (resellerCode) {
      filter.resellerCode = resellerCode;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Search filter (phone number, reference, email)
    if (search) {
      filter.$or = [
        { 'metadata.phoneNumberReceivingData': { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute queries in parallel for better performance
    const [transactions, totalCount, analytics] = await Promise.all([
      // Get paginated transactions
      Transaction.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),

      // Get total count for pagination
      Transaction.countDocuments(filter),

      // Get analytics data
      getAnalytics(filter)
    ]);

    // Calculate JBCP for each transaction
    const transactionsWithJBCP = transactions.map(transaction => {
      const JBCP = transaction.baseCost - transaction.JBProfit;

      return {
        transactionId: transaction.reference,
        dateTime: transaction.createdAt,
        customer: transaction.metadata?.phoneNumberReceivingData || 'N/A',
        network: transaction.metadata?.network?.toUpperCase() || 'N/A',
        bundleName: transaction.bundleName,
        JBProfit: transaction.JBProfit,
        status: transaction.status,
        deliveryStatus: transaction.deliveryStatus,
        amount: transaction.amount,
        baseCost: transaction.baseCost,
        JBCP: parseFloat(JBCP.toFixed(2)),
        currency: transaction.currency,
        resellerName: transaction.metadata?.resellerName || 'N/A',
        resellerProfit: transaction.metadata?.resellerProfit || 0,
        bundleData: transaction.metadata?.bundleData || 'N/A'
      };
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);

    //Getting BOSSU BALANCE
    const bossuBalance =await getBossuBalance()
    const response = {
      success: true,
      data: {
        bossuBalance: bossuBalance || 0,
        transactions: transactionsWithJBCP,
        analytics,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalCount,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      },
      timestamp: new Date().toISOString()
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}



//Update Transactions to delivered button
export const updateDeliveryStatus = async (req, res) => {

  try {
    const { transactionId } = req.params;
    const { deliveryStatus, failureReason } = req.body;

    // Validate delivery status
    const validStatuses = ['pending', 'processing', 'delivered', 'failed'];
    if (!validStatuses.includes(deliveryStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid delivery status. Must be one of: ${validStatuses.join(', ')}`
      });
    }



    // Find the transaction
    //I have to change this later. made transactionID the value of reference
    // const transaction = await Transaction.findOne({ reference: transactionId });
    const transaction = await Transaction.findOne({ reference: transactionId });



    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }


    // Check if transaction status is success
    if (transaction.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Can only update delivery status for successful transactions'
      });
    }

    // Check if current delivery status allows update
    const currentStatus = transaction.deliveryStatus;
    if (!['pending', 'processing'].includes(currentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot update delivery status from '${currentStatus}'. Only 'pending' or 'processing' transactions can be updated.`
      });
    }

    // If marking as failed, require failure reason
    if (deliveryStatus === 'failed' && (!failureReason || failureReason.trim() === '')) {
      return res.status(400).json({
        success: false,
        message: 'Failure reason is required when marking delivery as failed'
      });
    }

    // Update the transaction
    transaction.deliveryStatus = deliveryStatus;

    if (deliveryStatus === 'failed') {
      transaction.failureReason = failureReason;
    }

    if (deliveryStatus === 'delivered') {
      transaction.deliveredAt = new Date();
    }

    await transaction.save();

    // Log the update
    console.log(`Transaction ${transactionId} delivery status updated to ${deliveryStatus} by admin ${req.user.id}`);

    res.status(200).json({
      success: true,
      message: `Transaction marked as ${deliveryStatus} successfully`,
      data: {
        transactionId: transaction.transactionId,
        deliveryStatus: transaction.deliveryStatus,
        failureReason: transaction.failureReason,
        deliveredAt: transaction.deliveredAt,
        updatedAt: transaction.updatedAt
      }
    });






  } catch (error) {
    console.error('Error updating delivery status:', error);



    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
};



export const bulkExportTransactions = async (req, res) => {

  console.log("Bulk export Migration successful")

  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    const session = await Transaction.startSession();

    try {
      await session.startTransaction();

      // Extract and validate network parameter
      const { network, limit } = req.body;

      // Validate network if provided
      const validNetworks = ['mtn', 'at', 'telecel'];
      if (network && !validNetworks.includes(network.toLowerCase())) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          error: `Invalid network. Must be one of: ${validNetworks.join(', ')}`
        });
      }

      // Validate limit
      const maxLimit = 100;
      const parsedLimit = Math.min(Math.max(1, parseInt(limit)), maxLimit);

      // Build query - IDEMPOTENCY: Only SUCCESS transactions with pending delivery and no exportId
      const query = {
        status: 'success', // CRITICAL: Only successful transactions
        deliveryStatus: 'pending', // That haven't been delivered yet
        $or: [
          { exportId: { $exists: false } },
          { exportId: null }
        ]
      };
      if (network) {
        query['metadata.network'] = network.toLowerCase();
      }



      // Find successful pending transactions that haven't been exported yet
      const pendingTransactions = await Transaction.find(query)
        .sort({ createdAt: 1 })
        .limit(parsedLimit)
        .session(session)
        .lean();

      console.log("Successful Pending Transactions (not exported):", pendingTransactions.length);

      // If no pending transactions found, abort and return early
      if (pendingTransactions.length === 0) {
        await session.abortTransaction();
        session.endSession();

        return res.status(200).json({
          success: true,
          message: network
            ? `No successful pending transactions found for network: ${network}`
            : 'No successful pending transactions to export',
          exportId: null,
          count: 0
        });
      }

      const transactionIds = pendingTransactions.map(t => t._id);

      console.log("Transaction IDs to export:", transactionIds.length);

      // Create bulk export record FIRST to get a real ObjectId for locking
      const bulkExport = new BulkExport({
        exportId: generateUniqueId(),
        transactionIds: [], // Will update after locking transactions
        count: 0, // Will update after locking transactions
        network: network || null,
        status: 'processing',
        createdAt: new Date()
      });

      await bulkExport.save({ session });

      console.log("Created BulkExport with ID:", bulkExport._id);

      // CRITICAL: Update transactions with the bulkExport._id to lock them
      // This is idempotent - only grabs SUCCESS transactions with pending delivery that don't have an exportId yet
      const updateResult = await Transaction.updateMany(
        {
          _id: { $in: transactionIds },
          status: 'success', // CRITICAL: Only successful transactions
          deliveryStatus: 'pending',
          $or: [
            { exportId: { $exists: false } },
            { exportId: null }
          ]
        },
        {
          deliveryStatus: 'processing',
          exportedAt: new Date(),
          exportId: bulkExport._id // Lock with real ObjectId
        },
        { session }
      );

      console.log("Update Result:", updateResult);

      // CRITICAL: If no transactions were updated, delete the export and abort
      if (updateResult.modifiedCount === 0) {
        // Clean up the unused export record
        await BulkExport.deleteOne({ _id: bulkExport._id }, { session });

        await session.abortTransaction();
        session.endSession();

        return res.status(200).json({
          success: true,
          message: 'All pending transactions are already being processed or exported',
          exportId: null,
          count: 0
        });
      }

      // Use the actual modified count
      const actualCount = updateResult.modifiedCount;

      // Warn if race condition occurred
      if (actualCount !== pendingTransactions.length) {
        console.warn(
          `⚠️ Race condition: Found ${pendingTransactions.length} pending, ` +
          `but only ${actualCount} were available when updating`
        );
      }

      // Get the actual transaction IDs that were successfully locked
      const lockedTransactions = await Transaction.find(
        {
          _id: { $in: transactionIds },
          exportId: bulkExport._id
        },
        { _id: 1 }
      )
        .session(session)
        .lean();

      const actualTransactionIds = lockedTransactions.map(t => t._id);

      // Update the bulk export with actual data
      await BulkExport.updateOne(
        { _id: bulkExport._id },
        {
          transactionIds: actualTransactionIds,
          count: actualCount
        },
        { session }
      );

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      console.log(
        `✅ Bulk export created: ${bulkExport.exportId} with ${actualCount} transaction${actualCount !== 1 ? 's' : ''}` +
        (network ? ` (network: ${network})` : '')
      );

      return res.status(200).json({
        success: true,
        message: `Exported ${actualCount} transaction${actualCount !== 1 ? 's' : ''}` +
          (network ? ` from ${network}` : ''),
        exportId: bulkExport.exportId,
        count: actualCount,
        network: network || null
      });

    } catch (error) {
      // Handle write conflicts with retry
      if (error.code === 112 && error.codeName === 'WriteConflict' && retryCount < maxRetries - 1) {
        console.log(`⚠️ Write conflict detected, retrying... (attempt ${retryCount + 1}/${maxRetries})`);

        // Abort transaction if still active
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        session.endSession();

        retryCount++;
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 50 * retryCount));
        continue; // Retry the operation
      }

      // For other errors or max retries reached, abort and return error
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();

      console.error('Error in bulk export:', error);

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Max retries exceeded
  return res.status(500).json({
    success: false,
    error: 'Operation failed after multiple retries due to write conflicts. Please try again.'
  });
};


// GET /api/v1/transactions/bulk-export/:exportId
// Get all transactions for a specific export
export const getBulkExportTransactions = async (req, res) => {
  try {
    const { exportId } = req.params;

    const bulkExport = await BulkExport.findOne({ exportId })
      .populate({
        path: 'transactionIds',
        model: 'Transaction'
      });

    if (!bulkExport) {
      return res.status(404).json({
        success: false,
        message: 'Export not found'
      });
    }

    res.status(200).json({
      success: true,
      exportId: bulkExport.exportId,
      status: bulkExport.status,
      count: bulkExport.transactionIds.length,
      transactions: bulkExport.transactionIds
    });

  } catch (error) {
    console.error('Error fetching bulk export:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// PATCH /api/v1/transactions/bulk-export/:exportId/mark-delivered
// Bulk mark all transactions in export as delivered
export const bulkMarkDelivered = async (req, res) => {
  try {
    const { exportId } = req.params;

    // Find the bulk export
    const bulkExport = await BulkExport.findOne({ exportId });

    if (!bulkExport) {
      return res.status(404).json({
        success: false,
        message: 'Export not found'
      });
    }

    // Update all transactions to delivered
    const updateResult = await Transaction.updateMany(
      { _id: { $in: bulkExport.transactionIds } },
      {
        deliveryStatus: 'delivered',
        deliveredAt: new Date()
      }
    );

    // Update bulk export status
    bulkExport.status = 'completed';
    await bulkExport.save();

    console.log(`✅ Bulk mark delivered: ${exportId} - ${updateResult.modifiedCount} transactions updated`);

    res.status(200).json({
      success: true,
      message: `Marked ${updateResult.modifiedCount} transactions as delivered`,
      exportId: exportId,
      modifiedCount: updateResult.modifiedCount
    });

  } catch (error) {
    console.error('Error in bulk mark delivered:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET /api/v1/transactions/bulk-exports/list
// Get all bulk exports with their statuses
export const getAllBulkExports = async (req, res) => {
  try {

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 150));
    const skip = (page - 1) * limit;

    // Build sort object
   const sort = { ["createdAt"]: "desc" === 'asc' ? 1 : -1 };

    const [BulkExports, totalCount, totalBulkProcessing, totalBulkDelivered, totalBulkFailed] = await Promise.all([
      //Get Paginated bulk-orders exported
      BulkExport.find()
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),


      //Get Total Count for Pagination
      BulkExport.countDocuments(),

      //Processing BulkExport Orders
      BulkExport.countDocuments({
        status: "processing"
      }),

      BulkExport.countDocuments({
        status: "completed"
      }), 

      BulkExport.countDocuments({
        status:"failed"
      })
    ])


    const totalPages = Math.ceil(totalCount / limit)

    const response = {
      success: true,
      data: {
        bulkExport: BulkExports,
        totalCount: totalCount,
        totalBulkDelivered:totalBulkDelivered,
        totalBulkProcessing:totalBulkProcessing,
        totalBulkFailed:totalBulkFailed,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalCount,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }

    }


    res.status(200).json({
      success: true,
      response,
    });

  } catch (error) {
    console.error('Error fetching bulk exports:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};


//FOR BOSSU API MARKER
export const bulkDeliveryMarkerFetch = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
 
    // ✅ Validate query parameters exist
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required query parameters"
      });
    }
 
    // ✅ Validate ISO 8601 format and parse
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use ISO 8601 (e.g., 2024-05-15T08:00:00.000Z)"
      });
    }
 
    // ✅ Validate that end is after start
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date"
      });
    }
 
    // ✅ Fetch transactions matching criteria
    const transactions = await Transaction.find({
      status: "success",                    // Only successful transactions
      deliveryStatus: "processing",         // Only processing ones
      createdAt: {
        $gte: start,
        $lte: end
      }
    })
      .select([
        '_id',
        'reference',
        'email',
        'amount',
        'status',
        'deliveryStatus',
        'createdAt',
        'metadata'
      ])
      .lean()                               // Return plain JavaScript objects (faster)
      .sort({ createdAt: -1 });             // Newest first
 
    // ✅ Return response
    return res.status(200).json({
      success: true,
      message: `Found ${transactions.length} transaction(s) in processing status`,
      response: {
        data: transactions,
        meta: {
          count: transactions.length,
          timeRange: {
            start: start.toISOString(),
            end: end.toISOString()
          }
        }
      }
    });
 
  } catch (error) {
    console.error("Error fetching transactions for bulk delivery:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error while fetching transactions"
    });
  }
};


export const bulkMarkAsDelivered = async (req, res) => {
  try {
    const { transactionIds } = req.body;
 
    // ✅ Validate input
    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "transactionIds must be a non-empty array of transaction IDs"
      });
    }
 
    // ✅ Validate array size (prevent too large updates)
    if (transactionIds.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Cannot update more than 1000 transactions at once"
      });
    }
 
    // ✅ Convert string IDs to MongoDB ObjectIds
    let objectIds;
    try {
      objectIds = transactionIds.map(id => {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw new Error(`Invalid transaction ID: ${id}`);
        }
        return new mongoose.Types.ObjectId(id);
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: `Invalid transaction ID format: ${error.message}`
      });
    }
 
    // ✅ Perform bulk update
    const result = await Transaction.updateMany(
      {
        _id: { $in: objectIds },
        deliveryStatus: "processing"  // Extra safety: only update if still processing
      },
      {
        $set: {
          deliveryStatus: "delivered",
          deliveredAt: new Date()
        }
      }
    );
 
 
    // ✅ Prepare response
    const markedCount = result.modifiedCount;
    const failedCount = transactionIds.length - markedCount;
 
    return res.status(200).json({
      success: true,
      message: `Successfully marked ${markedCount} transaction(s) as delivered`,
      response: {
        data: {
          markedCount,
          failedCount,
          totalRequested: transactionIds.length,
          summary: {
            timestamp: new Date().toISOString(),
            message: failedCount > 0 
              ? `${markedCount} marked, ${failedCount} already delivered or invalid`
              : `All ${markedCount} transactions marked as delivered`
          }
        }
      }
    });
 
  } catch (error) {
    console.error("Error marking transactions as delivered For BOSSU:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error while marking transactions"
    });
  }
};



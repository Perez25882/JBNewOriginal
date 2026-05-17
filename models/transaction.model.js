import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },


  // this is the actual MongoDB ObjectId reference to the Bundle document
  bundleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bundle',
    required: true,
  },

  //This is the bundleId i created myself to identify different bundles
  bundleIdName: {
    type: String,
    required: true,
  },

  JBCP: {
    type: Number,
    required: true,
  },

  bundleName: {
    type: String,
    required: true,
  },

  resellerCode: {
    type: String,
    // allows multiple nulls
  },


  baseCost: {
    type: Number,
    required: true,
  },


  amount: {
    type: Number,
    required: true,
  },


  JBProfit: {
    type: Number,
    required: true,
  },

  currency: {
    type: String,
    required: true,
    enum: ['GHS', 'NGN'],
  },

  reference: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending',
    index: true
  },

  channel: {
    type: String,
    default: '',
  },

  provider_response: {
    type: Object,
    default: {},
  },

  metadata: {
    type: Object,
    default: {},
  },

  //BOSSU API RESPONSE FIELDS
  bossuResponse: {
    order_id: String,                   // "EXT_1778372232261_6477"
    network: String,                    // "mtn"
    package_key: String,                // "1gb"
    recipient_phone: String,            // "0241234567"
    external_reference: String,         // Your transaction reference
    price: Number,                      // 3.95
    status: String,                     // "pending", "completed", "failed"
    created_at: Date,
    updated_at: Date,
  },

  bossuError: {
    message: String,
    timestamp: Date,
    retryCount: {
      type: Number,
      default: 0,
    },
  },

  // NEW: Delivery tracking
  deliveryStatus: {
    type: String,
    enum: ['pending', 'processing', 'delivered', 'failed'],
    default: 'pending',
    index: true
  },
  deliveredAt: Date,
  failureReason: String,

  exportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ExportJob",
    index: true
  }




}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;

import express from 'express';
import cookieParser from 'cookie-parser';
import { PORT } from './config/env.js';
import cors from 'cors'


// ME IMPORTING THE EVENT EMITTER
import { appEmitter } from './Lib/eventEmitter.js';

import { logPaymentError } from './utils/logError.js';


//ROUTERS


//Working Versions routers
// import userRouter from './routes/user.routes.js'
// import authRouter from './routes/auth.routes.js';
// import paymentRouter from './routes/payment.route.js';
// import bundleRouter from './routes/bundle.route.js';
// import orderRouter from './routes/order.route.js';
// import commissionRouter from './routes/commission.route.js';
// import transactionRouter from './routes/transaction.route.js';
// import payoutRouter from './routes/payout.route.js';
// import resellerBundlePriceRouter from './routes/resellerBundlePrice.route.js';






//MIGRATION ROUTER
import userRouter from './modules/Users/user.route.js'; //working

import authRouter from './modules/Auth/auth.route.js'; //working

import paymentRouter from './modules/Payments/payment.route.js'; // working

import bundleRouter from './modules/Bundle/bundle.route.js'; //working

import orderRouter from './modules/TrackOrder/order.route.js'; //working

import commissionRouter from './modules/Commission/commission.route.js'; //working

import transactionRouter from './modules/Transaction/transaction.route.js'; //working

import payoutRouter from './modules/Payout/payout.route.js'; //working

import resellerBundlePriceRouter from './modules/ResellerBundlesPrice/resellerBundlePrice.route.js'; //working

import bossuRouter from "./modules/Bossu/bossu.route.js"






//DATABASE CONNECTION
import connectToDatabase from './database/mongodb.js';

//MIDDLEWARES
import errorMiddleware from './middlewares/error.middleware.js';
// import arcjetMiddleware from './middlewares/arcjet.middleware.js';



appEmitter.on("paymentError", (transaction)=> logPaymentError(transaction))








const app = express();

// Trust proxy for Render
app.set('trust proxy', 1);

// CORS configuration - MUST be before other middlewares
const allowedOrigins = [
  "https://joy-bundle-frontend.vercel.app",
  "https://c7f3-154-161-3-118.ngrok-free.app",
  "https://incurrable-wilhelmina-uncolloquially.ngrok-free.dev",
  "https://www.joydatabundle.com",
  "https://joydatabundle.com",
  "http://localhost:3000",
  "http://localhost:5000"
];


app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true); // Pass true, not the origin
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH",],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "ngrok-skip-browser-warning"

  ],
  exposedHeaders: ["Set-Cookie"],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));








// Other middlewares AFTER CORS
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());


// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/payments', paymentRouter);
app.use('/api/v1/bundles', bundleRouter);
app.use('/api/v1/order', orderRouter);
app.use('/api/v1/commissions', commissionRouter);
app.use('/api/v1/payout', payoutRouter);
app.use('/api/v1/transaction', transactionRouter);
app.use('/api/v1/resellerBundlePrice', resellerBundlePriceRouter );
app.use('/api/v1/bossu', bossuRouter );



// Error middleware should be last
app.use(errorMiddleware);

app.get('/', (req, res) => {
  res.status(404).json({ message: 'Not Found' });
});


app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

console.log('Server is running on port 5000');

app.listen(PORT, async () => {
  console.log(`JoyDataBundle is running on  http://localhost:${PORT}`);
  await connectToDatabase();
}); 

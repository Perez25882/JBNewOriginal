
import { Router} from 'express';
import { initializePayment,verifyPayment ,handleWebhook  } from '../Payments/payment.controller.js';
import { strictLimiterIpBased, generalLimiter } from "../../middlewares/ratelimiter.middleware.js";


const paymentRouter = Router();
// Webhook endpoint - NO LIMITER
paymentRouter.post('/paystack/webhook', handleWebhook);


// Initialize payment - STRICT IP-based (prevent payment spam)
paymentRouter.post('/paystack/initialize', strictLimiterIpBased, initializePayment);

// Verify a transaction - GENERAL (read-only)
paymentRouter.get('/paystack/verify/:reference', generalLimiter, verifyPayment);




export default paymentRouter
;
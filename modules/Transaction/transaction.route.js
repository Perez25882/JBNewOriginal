import  { Router} from 'express';

import  {  authorizeRoles,  protect,   } from '../../middlewares/auth.middleware.js'
import { 
    getTransactions, 
    bulkExportTransactions, 
    getBulkExportTransactions, 
    bulkMarkDelivered, 
    getAllBulkExports,
    updateDeliveryStatus,
    bulkMarkAsDelivered,
    bulkDeliveryMarkerFetch

 } from '../Transaction/transaction.controller.js';

 import { generalLimiter, lenientLimiter, strictLimiter } from "../../middlewares/ratelimiter.middleware.js";





const transactionRouter = Router();


transactionRouter.post('/bulk-export', protect, authorizeRoles("admin"), generalLimiter, bulkExportTransactions);

// Get list of bulk exports - GENERAL (read-only, admin)
transactionRouter.get('/bulk-exports/list', protect, authorizeRoles("admin"), generalLimiter, getAllBulkExports);

transactionRouter.get( '/bulk-delivery-marker',protect, authorizeRoles("admin"), generalLimiter, bulkDeliveryMarkerFetch)

// Get specific bulk export - GENERAL (read-only, admin)
transactionRouter.get('/bulk-export/:exportId', protect, authorizeRoles("admin"), generalLimiter, getBulkExportTransactions);

// Mark as delivered - STRICT (write operation)
transactionRouter.patch('/bulk-export/:exportId/mark-delivered', protect, authorizeRoles("admin"), lenientLimiter, bulkMarkDelivered);


transactionRouter.patch('/bulk-mark-delivered',  protect , authorizeRoles("admin"),lenientLimiter, bulkMarkAsDelivered);


// Get all transactions - GENERAL (read-only, admin)
transactionRouter.get('/', protect, authorizeRoles("admin"), lenientLimiter, getTransactions);


// Update delivery status
transactionRouter.patch('/:transactionId/delivery', protect, authorizeRoles("admin"), lenientLimiter, updateDeliveryStatus);

export default transactionRouter;

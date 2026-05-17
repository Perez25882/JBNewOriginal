import  { Router} from 'express';
import { bossuWebhookHandler } from './bossuapi.controller.js';

const  bossuRouter = Router();

bossuRouter.post('/bossu-webhook', bossuWebhookHandler)


export default bossuRouter;       

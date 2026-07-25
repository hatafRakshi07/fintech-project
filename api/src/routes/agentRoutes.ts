import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { getMyCustomers, broadcast as agentBroadcast } from '../controllers/agentController';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/my/customers', getMyCustomers);
router.post('/broadcast', agentBroadcast);

export default router;

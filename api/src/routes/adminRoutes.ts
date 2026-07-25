import { Router } from 'express';
import { broadcast } from '../controllers/adminController';
import { authMiddleware, adminOnly } from '../middleware/auth';

const router = Router();

// Protect all admin routes
router.use(authMiddleware, adminOnly);

router.post('/broadcast', broadcast);

export default router;

import { Request, Response } from 'express';
import { broadcastMessage } from '../realtime/socketServer';
import { authMiddleware, adminOnly } from '../middleware/auth';

// POST /api/admin/broadcast
export const broadcast = async (req: Request, res: Response) => {
  const { title, body, cron: cronExpr } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }
  const payload = { title, body };
  if (cronExpr) {
    try {
      const cron = require('node-cron');
      cron.schedule(cronExpr, () => broadcastMessage(payload));
      return res.json({ success: true, message: 'Broadcast scheduled' });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to schedule broadcast' });
    }
  } else {
    broadcastMessage(payload);
    return res.json({ success: true, message: 'Broadcast sent' });
  }
};

// You can later add persistence if needed

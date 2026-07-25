import { Request, Response } from 'express';
import { customers, agents } from '../db/mongoClient';
import { ObjectId } from 'mongodb';

// GET /api/agents/me/customers – returns customers assigned to the authenticated agent
export const getMyCustomers = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.id) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  try {
    const agentId = new ObjectId(user.id);
    // Verify the user is indeed an agent
    const agent = await agents.findOne({ _id: agentId });
    if (!agent) {
      return res.status(403).json({ error: 'Not an agent' });
    }
    const agentCustomers = await customers.find({ agentId }).toArray();
    return res.json({ customers: agentCustomers });
  } catch (e) {
    console.error('Error fetching agent customers', e);
    return res.status(500).json({ error: 'Server error' });
  }
};

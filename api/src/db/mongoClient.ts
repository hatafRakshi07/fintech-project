import { MongoClient, Db, Collection } from 'mongodb';
import { config } from 'dotenv';
config();

const mongoUri = process.env.MONGO_URI || 'mongodb://mongo:27017/fintech';
const client = new MongoClient(mongoUri);

export const connect = async () => {
  if (!client.isConnected()) {
    await client.connect();
    console.log('Connected to MongoDB');
  }
  return client.db();
};

export const db: Db = client.db('fintech');
export const users: Collection<any> = db.collection('users');
export const agents: Collection<any> = db.collection('agents');
export const customers: Collection<any> = db.collection('customers');
export const kyc: Collection<any> = db.collection('kycVerifications');
export const commissions: Collection<any> = db.collection('commissions');
export const dueNotifications: Collection<any> = db.collection('dueNotifications');
export const notificationConfigs: Collection<any> = db.collection('notificationConfigs');

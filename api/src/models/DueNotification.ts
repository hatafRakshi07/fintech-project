// src/models/DueNotification.ts
import { ObjectId } from 'mongodb';

export interface DueNotification {
  _id?: ObjectId;
  userId: ObjectId; // reference to customers collection
  amountDue: number;
  dueDate: Date;
  sentAt?: Date; // when notification was sent
}

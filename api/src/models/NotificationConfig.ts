// src/models/NotificationConfig.ts
import { ObjectId } from 'mongodb';

export interface NotificationConfig {
  _id?: ObjectId;
  schedule: 'hourly' | 'daily'; // when to run due notifications
  template: string; // e.g., "Your due amount is {{amount}}"
  ttlMinutes: number; // how long the client should display the notification
}

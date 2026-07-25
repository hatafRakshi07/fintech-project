import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { kyc } from './db/mongoClient';
import { get } from 'lodash';

let io: SocketIOServer;

export const initSocket = (httpServer: HttpServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Authenticate socket connections using JWT token sent via query param `token`
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Missing auth token'));
    // Simple verification – actual verification should use same JWT middleware as API
    try {
      const payload: any = get(require('jsonwebtoken').verify(token, process.env.JWT_SECRET || ''), 'payload') || {};
      (socket as any).user = payload;
      next();
    } catch (e) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    if (user && user.id) {
      // Join a personal room for direct notifications
      socket.join(user.id);
    }
  });

  // KYC Change Stream – emit updates to the owner of the KYC record
  const changeStream = kyc.watch([
    { $match: { operationType: { $in: ['insert', 'update', 'replace'] } } },
  ]);
  changeStream.on('change', async (change) => {
    const docId = change.documentKey._id.toString();
    const fullDoc = await kyc.findOne({ _id: change.documentKey._id });
    // Assuming each KYC doc has a field `userId` referencing the owner
    const userId = fullDoc?.userId?.toString();
    if (userId) {
      io.to(userId).emit('kycUpdate', fullDoc);
    }
  });
};

// Helper to broadcast a generic message to all connected clients
export const broadcastMessage = (payload: { title: string; body: string }) => {
  if (io) {
    io.emit('broadcastMessage', payload);
  }
};

// Helper to send a due‑amount notification to a specific user
export const emitDueNotification = (userId: string, payload: { message: string; expiresAt: string }) => {
  if (io) {
    io.to(userId).emit('dueNotification', payload);
  }
};

export { io };

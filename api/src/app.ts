import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { initSocket } from './realtime/socketServer';
import adminRoutes from './routes/adminRoutes';
import agentRoutes from './routes/agentRoutes';
import authRoutes from './routes/authRoutes'; // placeholder if exists

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Public routes (e.g., auth) would go here
// app.use('/auth', authRoutes);

// Protected admin routes
app.use('/api/admin', adminRoutes);

// Protected agent routes
app.use('/api/agent', agentRoutes);

// Health check
app.get('/health', (_req, res) => res.send('OK'));

const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});

export default app;

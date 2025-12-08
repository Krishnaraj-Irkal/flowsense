import express from 'express';
import {
  initializeConnection,
  getConnectionStatus,
  disconnectFromDhan,
  getLatestTick,
  getCandles
} from '../controllers/marketDataController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Initialize Dhan WebSocket connection
router.post('/connect', initializeConnection);

// Get connection status
router.get('/status', getConnectionStatus);

// Disconnect from Dhan
router.post('/disconnect', disconnectFromDhan);

// Get latest tick data for a security
router.get('/tick/:securityId', getLatestTick);

// Get candles for a security
router.get('/candles/:securityId', getCandles);

export default router;

import { Request, Response } from 'express';
import DhanWebSocketManager from '../services/DhanWebSocketManager';
import CandleAggregator from '../services/CandleAggregator';
import StrategyEngine from '../services/StrategyEngine';
import PaperTradingEngine from '../services/PaperTradingEngine';
import AccessToken from '../models/AccessToken';
import User from '../models/User';
import Tick from '../models/Tick';
import Candle from '../models/Candle';

/**
 * Initialize Dhan WebSocket connection for a user
 */
export const initializeConnection = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = (req as any).user?.userId; // From auth middleware

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get user's Dhan access tokens
    const accessToken = await AccessToken.findOne({ userId });

    if (!accessToken) {
      return res.status(404).json({
        success: false,
        message: 'Dhan access tokens not found. Please configure tokens in settings.'
      });
    }

    // Check if token is expired
    if (new Date() > accessToken.expiresAt) {
      return res.status(401).json({
        success: false,
        message: 'Dhan tokens expired. Please update tokens in settings.'
      });
    }

    // Get user's client ID
    const user = await User.findById(userId);

    if (!user || !user.clientId) {
      return res.status(400).json({
        success: false,
        message: 'Client ID not configured. Please update in settings.'
      });
    }

    // Check if already connected
    if (DhanWebSocketManager.getConnectionStatus()) {
      return res.json({
        success: true,
        message: 'Already connected to Dhan market feed',
        subscribedInstruments: DhanWebSocketManager.getSubscribedInstruments()
      });
    }

    // Connect to Dhan WebSocket
    await DhanWebSocketManager.connect(accessToken.tickFeedToken, user.clientId);

    // Subscribe to Nifty 50
    await DhanWebSocketManager.subscribeToNifty50();

    // Start candle aggregator
    CandleAggregator.start();

    // Start strategy engine
    StrategyEngine.start();

    // Start paper trading engine
    await PaperTradingEngine.start();

    return res.json({
      success: true,
      message: 'Successfully connected to Dhan market feed and started trading system',
      subscribedInstruments: DhanWebSocketManager.getSubscribedInstruments(),
      candleAggregator: CandleAggregator.getStatus(),
      strategyEngine: StrategyEngine.getStatus(),
      paperTradingEngine: PaperTradingEngine.getStatus()
    });

  } catch (error: any) {
    console.error('Error initializing Dhan connection:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to connect to Dhan market feed',
      error: error.message
    });
  }
};

/**
 * Get connection status
 */
export const getConnectionStatus = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const isConnected = DhanWebSocketManager.getConnectionStatus();
    const subscribedInstruments = DhanWebSocketManager.getSubscribedInstruments();

    return res.json({
      success: true,
      isConnected,
      subscribedInstruments,
      instrumentCount: subscribedInstruments.length
    });

  } catch (error: any) {
    console.error('Error getting connection status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get connection status',
      error: error.message
    });
  }
};

/**
 * Disconnect from Dhan WebSocket
 */
export const disconnectFromDhan = async (_req: Request, res: Response): Promise<Response> => {
  try {
    // Stop paper trading engine
    PaperTradingEngine.stop();

    // Stop strategy engine
    StrategyEngine.stop();

    // Stop candle aggregator
    CandleAggregator.stop();

    // Disconnect from Dhan
    DhanWebSocketManager.disconnect();

    return res.json({
      success: true,
      message: 'Disconnected from Dhan market feed and stopped trading system'
    });

  } catch (error: any) {
    console.error('Error disconnecting:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to disconnect',
      error: error.message
    });
  }
};

/**
 * Get latest tick data for a security
 */
export const getLatestTick = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { securityId } = req.params;

    const latestTick = await Tick.findOne({ securityId })
      .sort({ timestamp: -1 })
      .limit(1);

    if (!latestTick) {
      return res.status(404).json({
        success: false,
        message: 'No tick data found for this security'
      });
    }

    return res.json({
      success: true,
      tick: latestTick
    });

  } catch (error: any) {
    console.error('Error getting latest tick:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get tick data',
      error: error.message
    });
  }
};

/**
 * Get candles for a security
 */
export const getCandles = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { securityId } = req.params;
    const { interval = '5m', limit = 100 } = req.query;

    const candles = await Candle.find({
      securityId,
      interval: interval as string,
      isClosed: true
    })
      .sort({ timestamp: -1 })
      .limit(Number(limit));

    return res.json({
      success: true,
      candles: candles.reverse(), // Return oldest to newest
      count: candles.length
    });

  } catch (error: any) {
    console.error('Error getting candles:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get candle data',
      error: error.message
    });
  }
};

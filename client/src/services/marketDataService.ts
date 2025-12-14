/**
 * Market Data WebSocket Service
 *
 * Manages Socket.IO connection to backend for real-time market data
 *
 * Features:
 * - Automatic reconnection
 * - Event subscription management
 * - Type-safe event handlers
 * - Connection status tracking
 */

import { io, Socket } from 'socket.io-client';

export interface Tick {
  securityId: string;
  ltp: number;
  ltq: number;
  ltt: Date;
  volume: number;
  totalBuyQty: number;
  totalSellQty: number;
  bidAskImbalance: number;
  depthSpread: number;
  orderBookStrength: number;
  volumeDelta: number;
  liquidityScore: number;
  timestamp: Date;
}

export interface Candle {
  _id: string;
  securityId: string;
  interval: '1m' | '5m' | '15m' | '1h' | '1d';
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  avgBidAskImbalance: number;
  avgDepthSpread: number;
  avgOrderBookStrength: number;
  timestamp: Date;
  isClosed: boolean;
}

export interface Signal {
  _id: string;
  strategyName: string;
  securityId: string;
  type: 'BUY' | 'SELL';
  price: number;
  reason: string;
  stopLoss: number;
  target: number;
  quantity: number;
  bidAskImbalance: number;
  orderBookStrength: number;
  liquidityScore: number;
  status: 'pending' | 'executed' | 'rejected';
  executionPrice?: number;
  executionTime?: Date;
  timestamp: Date;
}

export interface Position {
  _id: string;
  securityId: string;
  strategyName: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  target: number;
  unrealizedPnL: number;
  realizedPnL: number;
  status: 'open' | 'closed';
  entryTime: Date;
  exitTime?: Date;
  exitReason?: 'stop_loss' | 'target' | 'eod_squareoff' | 'manual';
}

export interface Portfolio {
  _id: string;
  totalCapital: number;
  availableCapital: number;
  usedMargin: number;
  todayPnL: number;
  weekPnL: number;
  totalPnL: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  maxDailyLoss: number;
  currentDailyLoss: number;
}

export interface StrategyStatus {
  name: string;
  timeframe: string;
  tradingType: string;
  isActive: boolean;
  tradesPlacedToday: number;
  maxTradesPerDay?: number;
  totalSignalsGenerated: number;
}

export interface SystemStatus {
  dhanConnected: boolean;
  subscribedInstruments: string[];
  candleAggregator: any;
  strategyEngine: StrategyStatus[];
  paperTradingEngine: any;
  timestamp: Date;
}

type EventCallback<T> = (data: T) => void;

class MarketDataService {
  private socket: Socket | null = null;
  private isConnecting: boolean = false;
  private eventHandlers: Map<string, Set<Function>> = new Map();

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.socket?.connected || this.isConnecting) {
      console.log('[MarketDataService] Already connected or connecting');
      return;
    }

    this.isConnecting = true;

    const serverUrl = process.env.REACT_APP_API_URL || 'http://localhost:8080';

    console.log('[MarketDataService] Connecting to:', serverUrl);

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.setupEventHandlers();
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[MarketDataService] Connected to WebSocket server');
      this.isConnecting = false;
      this.emit('connection:status', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[MarketDataService] Disconnected:', reason);
      this.emit('connection:status', { connected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('[MarketDataService] Connection error:', error);
      this.isConnecting = false;
      this.emit('connection:error', error);
    });

    // System status
    this.socket.on('status', (data: SystemStatus) => {
      this.emit('status', data);
    });

    // Tick updates
    this.socket.on('tick', (data: Tick) => {
      console.log(`[MarketDataService] Received tick:`, data);
      this.emit('tick', data);
    });

    // Live candle updates (real-time)
    this.socket.on('candle:update', (data: { candle: Candle; depthMetrics: any }) => {
      this.emit('candle:update', data);
    });

    // Candle close updates (when candle completes)
    this.socket.on('candle', (data: { candle: Candle; depthMetrics: any }) => {
      this.emit('candle', data);
    });

    // Signal updates
    this.socket.on('signal', (data: any) => {
      this.emit('signal', data);
    });

    this.socket.on('strategies:status', (data: StrategyStatus[]) => {
      this.emit('strategies:status', data);
    });

    // Position updates
    this.socket.on('position:update', (data: Position) => {
      this.emit('position:update', data);
    });

    this.socket.on('position:closed', (data: Position) => {
      this.emit('position:closed', data);
    });

    this.socket.on('positions:list', (data: Position[]) => {
      this.emit('positions:list', data);
    });

    // Portfolio updates
    this.socket.on('portfolio:update', (data: Portfolio) => {
      this.emit('portfolio:update', data);
    });
  }

  /**
   * Subscribe to specific data streams
   */
  subscribe(stream: 'ticks' | 'candles' | 'signals' | 'positions' | 'portfolio'): void {
    if (!this.socket?.connected) {
      console.warn('[MarketDataService] Not connected, cannot subscribe');
      return;
    }

    this.socket.emit(`subscribe:${stream}`);
    console.log(`[MarketDataService] ✅ Sent subscription request for: ${stream}`);
  }

  /**
   * Request current portfolio data
   */
  requestPortfolio(): void {
    if (!this.socket?.connected) {
      console.warn('[MarketDataService] Not connected');
      return;
    }

    this.socket.emit('request:portfolio');
  }

  /**
   * Request open positions
   */
  requestPositions(): void {
    if (!this.socket?.connected) {
      console.warn('[MarketDataService] Not connected');
      return;
    }

    this.socket.emit('request:positions');
  }

  /**
   * Request strategies status
   */
  requestStrategies(): void {
    if (!this.socket?.connected) {
      console.warn('[MarketDataService] Not connected');
      return;
    }

    this.socket.emit('request:strategies');
  }

  /**
   * Register event listener
   */
  on<T>(event: string, callback: EventCallback<T>): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)!.add(callback);
  }

  /**
   * Unregister event listener
   */
  off<T>(event: string, callback: EventCallback<T>): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(callback);
    }
  }

  /**
   * Emit event to registered listeners
   */
  private emit<T>(event: string, data: T): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnecting = false;
      console.log('[MarketDataService] Disconnected');
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get Socket instance
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Singleton instance
export default new MarketDataService();

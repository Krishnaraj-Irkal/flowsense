/**
 * Market Depth WebSocket Manager
 *
 * Manages full 20-level market depth from Dhan for advanced order flow analysis.
 * Uses RequestCode 23 for NSE Equity/Derivatives.
 *
 * Features:
 * - Real-time bid/ask ladder up to 20 levels
 * - Order flow imbalance detection
 * - Institutional activity zones
 * - Absorption and exhaustion analysis
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

// Market depth level structure
export interface DepthLevel {
  price: number;
  quantity: number;
  orders: number;
}

// Full market depth snapshot
export interface MarketDepth {
  securityId: string;
  timestamp: Date;
  bids: DepthLevel[];  // Up to 20 levels, sorted descending by price
  asks: DepthLevel[];  // Up to 20 levels, sorted ascending by price
}

// Advanced depth metrics for trading
export interface DepthAnalytics {
  securityId: string;
  timestamp: Date;

  // Order flow metrics
  bidPressure: number;        // Total bid quantity (all levels)
  askPressure: number;        // Total ask quantity (all levels)
  orderFlowImbalance: number; // (bid - ask) / (bid + ask) * 100

  // Institutional zones (top 5 levels)
  institutionalBidZone: number;  // Sum of top 5 bid levels
  institutionalAskZone: number;  // Sum of top 5 ask levels

  // Deep liquidity (levels 11-20)
  deepBidLiquidity: number;
  deepAskLiquidity: number;

  // Support/Resistance strength
  strongestBidLevel: DepthLevel | null;
  strongestAskLevel: DepthLevel | null;

  // Absorption detection
  absorption: 'BUYING' | 'SELLING' | 'NEUTRAL';
  absorptionStrength: number; // 0-100
}

class MarketDepthManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private subscribedInstruments: Set<string> = new Set();

  // Store latest depth snapshots
  private depthSnapshots: Map<string, MarketDepth> = new Map();

  // Connection credentials (stored for reconnection)
  // @ts-ignore - tickFeedToken stored for potential reconnection logic
  private tickFeedToken: string = '';
  // @ts-ignore - clientId stored for potential reconnection logic
  private clientId: string = '';

  // Ping interval for keepalive
  private pingInterval: NodeJS.Timeout | null = null;

  /**
   * Connect to Dhan Market Depth WebSocket
   */
  async connect(tickFeedToken: string, clientId: string): Promise<void> {
    this.tickFeedToken = tickFeedToken;
    this.clientId = clientId;

    const wsUrl = `wss://api-feed.dhan.co?version=2&token=${tickFeedToken}&clientId=${clientId}&authType=2`;
    console.log(`[MarketDepth] Connecting to Dhan Market Depth feed...`);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          console.log('[MarketDepth] ✅ Connected to market depth feed');
          this.isConnected = true;
          this.startPingPong();
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          this.handleMessage(data);
        });

        this.ws.on('ping', (data: Buffer) => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.pong(data);
          }
        });

        this.ws.on('error', (error: Error) => {
          console.error('[MarketDepth] ❌ WebSocket error:', error);
          this.emit('error', error);
        });

        this.ws.on('close', (code: number, _reason: Buffer) => {
          console.log(`[MarketDepth] ❌ Connection closed. Code: ${code}`);
          this.isConnected = false;
          this.stopPingPong();
          this.emit('disconnected');
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Subscribe to market depth for instruments
   * RequestCode 23 = 20-level depth (max 50 instruments per connection)
   */
  async subscribeToInstruments(instruments: { exchangeSegment: string; securityId: string }[]): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket not connected');
    }

    if (instruments.length > 50) {
      throw new Error('Maximum 50 instruments allowed for 20-level depth');
    }

    console.log(`[MarketDepth] 📊 Subscribing to ${instruments.length} instruments for 20-level depth...`);

    const subscriptionRequest = {
      RequestCode: 23, // 20-level market depth
      InstrumentCount: instruments.length,
      InstrumentList: instruments.map(inst => ({
        ExchangeSegment: inst.exchangeSegment,
        SecurityId: inst.securityId
      }))
    };

    console.log(`[MarketDepth] Subscription request:`, JSON.stringify(subscriptionRequest, null, 2));

    this.ws.send(JSON.stringify(subscriptionRequest));

    instruments.forEach(inst => {
      this.subscribedInstruments.add(inst.securityId);
    });

    console.log(`[MarketDepth] ✅ Subscribed to ${instruments.length} instruments`);
  }

  /**
   * Handle incoming binary market depth packets
   */
  private handleMessage(data: Buffer): void {
    try {
      if (data.length < 12) {
        console.warn(`[MarketDepth] Packet too small: ${data.length} bytes`);
        return;
      }

      // Parse packet header (12 bytes)
      const feedCode = data.readUInt32LE(0);
      const securityId = data.readUInt32LE(4).toString();
      // @ts-ignore - packetLength reserved for future validation logic
      const packetLength = data.readUInt32LE(8);

      // Feed codes: 41 = Bid, 51 = Ask
      if (feedCode === 41) {
        this.handleBidDepthPacket(securityId, data.slice(12));
      } else if (feedCode === 51) {
        this.handleAskDepthPacket(securityId, data.slice(12));
      } else {
        console.log(`[MarketDepth] Unknown feed code: ${feedCode}`);
      }
    } catch (error) {
      console.error('[MarketDepth] Error handling message:', error);
    }
  }

  /**
   * Parse bid depth levels
   */
  private handleBidDepthPacket(securityId: string, data: Buffer): void {
    const bids = this.parseDepthLevels(data);

    // Get or create depth snapshot
    let depth = this.depthSnapshots.get(securityId);
    if (!depth) {
      depth = {
        securityId,
        timestamp: new Date(),
        bids: [],
        asks: []
      };
      this.depthSnapshots.set(securityId, depth);
    }

    depth.bids = bids;
    depth.timestamp = new Date();

    // If we have both bids and asks, analyze and emit
    if (depth.asks.length > 0) {
      this.analyzeAndEmitDepth(depth);
    }
  }

  /**
   * Parse ask depth levels
   */
  private handleAskDepthPacket(securityId: string, data: Buffer): void {
    const asks = this.parseDepthLevels(data);

    // Get or create depth snapshot
    let depth = this.depthSnapshots.get(securityId);
    if (!depth) {
      depth = {
        securityId,
        timestamp: new Date(),
        bids: [],
        asks: []
      };
      this.depthSnapshots.set(securityId, depth);
    }

    depth.asks = asks;
    depth.timestamp = new Date();

    // If we have both bids and asks, analyze and emit
    if (depth.bids.length > 0) {
      this.analyzeAndEmitDepth(depth);
    }
  }

  /**
   * Parse depth levels from binary data
   * Each level: 16 bytes (8 price + 4 quantity + 4 orders)
   */
  private parseDepthLevels(data: Buffer): DepthLevel[] {
    const levels: DepthLevel[] = [];
    const levelSize = 16;
    const numLevels = Math.floor(data.length / levelSize);

    for (let i = 0; i < numLevels; i++) {
      const offset = i * levelSize;

      const price = data.readDoubleLE(offset);
      const quantity = data.readUInt32LE(offset + 8);
      const orders = data.readUInt32LE(offset + 12);

      if (price > 0 && quantity > 0) {
        levels.push({ price, quantity, orders });
      }
    }

    return levels;
  }

  /**
   * Analyze market depth and emit advanced analytics
   */
  private analyzeAndEmitDepth(depth: MarketDepth): void {
    const analytics: DepthAnalytics = {
      securityId: depth.securityId,
      timestamp: depth.timestamp,

      // Calculate total pressure
      bidPressure: depth.bids.reduce((sum, level) => sum + level.quantity, 0),
      askPressure: depth.asks.reduce((sum, level) => sum + level.quantity, 0),
      orderFlowImbalance: 0,

      // Institutional zones (top 5 levels)
      institutionalBidZone: depth.bids.slice(0, 5).reduce((sum, level) => sum + level.quantity, 0),
      institutionalAskZone: depth.asks.slice(0, 5).reduce((sum, level) => sum + level.quantity, 0),

      // Deep liquidity (levels 11-20 if available)
      deepBidLiquidity: depth.bids.slice(10, 20).reduce((sum, level) => sum + level.quantity, 0),
      deepAskLiquidity: depth.asks.slice(10, 20).reduce((sum, level) => sum + level.quantity, 0),

      // Find strongest levels
      strongestBidLevel: depth.bids.length > 0 ? depth.bids.reduce((max, level) =>
        level.quantity > max.quantity ? level : max, depth.bids[0]) : null,
      strongestAskLevel: depth.asks.length > 0 ? depth.asks.reduce((max, level) =>
        level.quantity > max.quantity ? level : max, depth.asks[0]) : null,

      absorption: 'NEUTRAL',
      absorptionStrength: 0
    };

    // Calculate order flow imbalance
    const totalPressure = analytics.bidPressure + analytics.askPressure;
    if (totalPressure > 0) {
      analytics.orderFlowImbalance = ((analytics.bidPressure - analytics.askPressure) / totalPressure) * 100;
    }

    // Detect absorption (institutional buying/selling)
    if (analytics.orderFlowImbalance > 15) {
      analytics.absorption = 'BUYING';
      analytics.absorptionStrength = Math.min(analytics.orderFlowImbalance, 100);
    } else if (analytics.orderFlowImbalance < -15) {
      analytics.absorption = 'SELLING';
      analytics.absorptionStrength = Math.min(Math.abs(analytics.orderFlowImbalance), 100);
    }

    // Emit both raw depth and analytics
    this.emit('depth', depth);
    this.emit('depth:analytics', analytics);

    console.log(`[MarketDepth] ${depth.securityId} | Imbalance: ${analytics.orderFlowImbalance.toFixed(1)}% | Absorption: ${analytics.absorption}`);
  }

  /**
   * Start ping-pong keepalive
   */
  private startPingPong(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  /**
   * Stop ping-pong keepalive
   */
  private stopPingPong(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Get latest depth snapshot for a security
   */
  getDepthSnapshot(securityId: string): MarketDepth | null {
    return this.depthSnapshots.get(securityId) || null;
  }

  /**
   * Disconnect from market depth feed
   */
  disconnect(): void {
    if (this.ws) {
      this.stopPingPong();
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.subscribedInstruments.clear();
      this.depthSnapshots.clear();
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
export default new MarketDepthManager();

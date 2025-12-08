/**
 * Dhan WebSocket Manager
 *
 * Manages WebSocket connection to Dhan's live market feed.
 * Handles authentication, subscription, binary packet parsing, and data distribution.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import {
  parseDhanPacket,
  FeedResponseCode,
  FullPacket,
  TickerPacket,
  QuotePacket,
  PrevClosePacket,
  DisconnectionPacket,
  getDisconnectionReason
} from '../utils/binaryParser';
import { calculateDepthMetrics, MarketDepthMetrics } from '../utils/marketDepthMetrics';
import Tick from '../models/Tick';

// Subscription request structure
interface SubscriptionRequest {
  RequestCode: number;
  InstrumentCount: number;
  InstrumentList: {
    ExchangeSegment: string;
    SecurityId: string;
  }[];
}

// Enriched tick data (LTP + depth metrics)
export interface EnrichedTick {
  securityId: string;
  ltp: number;
  ltq: number;
  ltt: Date;
  volume: number;
  totalBuyQty: number;
  totalSellQty: number;
  open: number;
  high: number;
  low: number;
  close: number;
  atp: number;

  // Market depth metrics
  depthMetrics: MarketDepthMetrics;

  timestamp: Date;
}

class DhanWebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000; // 5 seconds
  private pingInterval: NodeJS.Timeout | null = null;

  private tickFeedToken: string = '';
  private clientId: string = '';

  private subscribedInstruments: Set<string> = new Set();

  constructor() {
    super();
  }

  /**
   * Initialize connection to Dhan WebSocket
   */
  async connect(tickFeedToken: string, clientId: string): Promise<void> {
    this.tickFeedToken = tickFeedToken;
    this.clientId = clientId;

    const wsUrl = `wss://api-feed.dhan.co?version=2&token=${tickFeedToken}&clientId=${clientId}&authType=2`;
    console.log(`[DhanWS] Connecting to Dhan WebSocket... ${wsUrl}`);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);
        console.log('[DhanWS] WebSocket instance created', this.ws);
        this.ws.on('open', () => {
          console.log('[DhanWS] Connected to Dhan market feed');
          this.isConnected = true;
          this.reconnectAttempts = 0;

          // Start ping-pong to keep connection alive
          this.startPingPong();

          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          this.handleMessage(data);
        });

        this.ws.on('ping', (data: Buffer) => {
          // Respond to server ping with pong
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.pong(data);
          }
        });

        this.ws.on('error', (error: Error) => {
          console.error('[DhanWS] WebSocket error:', error);
          this.emit('error', error);
        });

        this.ws.on('close', (code: number, reason: string) => {
          console.log(`[DhanWS] Connection closed. Code: ${code}, Reason: ${reason}`);
          this.isConnected = false;
          this.stopPingPong();

          this.emit('disconnected', { code, reason });

          // Attempt reconnection
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnect();
          } else {
            console.error('[DhanWS] Max reconnection attempts reached');
            reject(new Error('Failed to connect after maximum attempts'));
          }
        });

      } catch (error) {
        console.error('[DhanWS] Connection error:', error);
        reject(error);
      }
    });
  }

  /**
   * Subscribe to instruments for live market data
   */
  async subscribeToInstruments(instruments: { exchangeSegment: string; securityId: string }[]): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket not connected');
    }

    // Dhan allows max 100 instruments per subscription request
    const batchSize = 100;

    for (let i = 0; i < instruments.length; i += batchSize) {
      const batch = instruments.slice(i, i + batchSize);

      const subscriptionRequest: SubscriptionRequest = {
        RequestCode: 15, // Subscribe to Full Packet (code 8)
        InstrumentCount: batch.length,
        InstrumentList: batch.map(inst => ({
          ExchangeSegment: inst.exchangeSegment,
          SecurityId: inst.securityId
        }))
      };

      // Send JSON subscription request
      this.ws.send(JSON.stringify(subscriptionRequest));

      // Track subscribed instruments
      batch.forEach(inst => {
        this.subscribedInstruments.add(inst.securityId);
      });

      console.log(`[DhanWS] Subscribed to ${batch.length} instruments (batch ${Math.floor(i / batchSize) + 1})`);
    }

    console.log(`[DhanWS] Total subscribed instruments: ${this.subscribedInstruments.size}`);
  }

  /**
   * Subscribe to Nifty 50 (Index + Futures)
   */
  async subscribeToNifty50(): Promise<void> {
    // Hardcoded Nifty 50 instrument data
    const niftyIndex = {
      displayName: 'NIFTY 50',
      symbol: 'NIFTY',
      securityId: '13',
      exchangeSegment: 'IDX_I',
      exchange: 'NSE',
      instrumentType: 'INDEX',
      lotSize: 25,
      tickSize: 0.05,
      futureSymbol: 'NIFTY',
      futureExchangeSegment: 'NSE_FNO'
    };

    const instruments = [
      {
        exchangeSegment: niftyIndex.exchangeSegment,
        securityId: niftyIndex.securityId
      }
      // TODO: Add Nifty futures when we have the current month contract ID
    ];

    console.log(`[DhanWS] Subscribing to ${niftyIndex.displayName} (${niftyIndex.symbol})`);

    await this.subscribeToInstruments(instruments);
  }

  /**
   * Handle incoming binary messages
   */
  private handleMessage(data: Buffer): void {
    try {
      const packet = parseDhanPacket(data);

      if (!packet) {
        console.warn('[DhanWS] Failed to parse packet');
        return;
      }

      const { feedCode, securityId } = packet;

      switch (feedCode) {
        case FeedResponseCode.FULL:
          this.handleFullPacket(packet as FullPacket);
          break;

        case FeedResponseCode.QUOTE:
          this.handleQuotePacket(packet as QuotePacket);
          break;

        case FeedResponseCode.TICKER:
          this.handleTickerPacket(packet as TickerPacket);
          break;

        case FeedResponseCode.PREV_CLOSE:
          this.handlePrevClosePacket(packet as PrevClosePacket);
          break;

        case FeedResponseCode.DISCONNECTION:
          this.handleDisconnection(packet as DisconnectionPacket);
          break;

        default:
          console.log(`[DhanWS] Received packet type: ${feedCode} for security: ${securityId}`);
      }

    } catch (error) {
      console.error('[DhanWS] Error handling message:', error);
    }
  }

  /**
   * Handle Full Packet (code 8) - Most comprehensive data
   */
  private async handleFullPacket(packet: FullPacket): Promise<void> {
    try {
      // Calculate market depth metrics
      const depthMetrics = calculateDepthMetrics(packet);

      // Create enriched tick data
      const enrichedTick: EnrichedTick = {
        securityId: packet.securityId,
        ltp: packet.ltp,
        ltq: packet.ltq,
        ltt: new Date(packet.ltt * 1000), // Convert EPOCH to Date
        volume: packet.volume,
        totalBuyQty: packet.totalBuyQty,
        totalSellQty: packet.totalSellQty,
        open: packet.open,
        high: packet.high,
        low: packet.low,
        close: packet.close,
        atp: packet.atp,
        depthMetrics,
        timestamp: new Date()
      };

      // Save to database (async, don't block)
      this.saveTick(enrichedTick).catch(err => {
        console.error('[DhanWS] Error saving tick:', err);
      });

      // Emit tick event for other services (Candle Aggregator, Strategy Engine, etc.)
      this.emit('tick', enrichedTick);

      // Emit to internal WebSocket server for frontend
      this.emit('marketData', {
        type: 'tick',
        data: enrichedTick
      });

    } catch (error) {
      console.error('[DhanWS] Error handling full packet:', error);
    }
  }

  /**
   * Handle Quote Packet (code 4) - Less comprehensive than Full
   */
  private handleQuotePacket(packet: QuotePacket): void {
    // For now, we prioritize Full Packets
    // Quote packets can be used as fallback if Full packets aren't available
    console.log(`[DhanWS] Quote packet received for ${packet.securityId}: LTP ₹${packet.ltp}`);
  }

  /**
   * Handle Ticker Packet (code 2) - Basic LTP data
   */
  private handleTickerPacket(packet: TickerPacket): void {
    console.log(`[DhanWS] Ticker packet received for ${packet.securityId}: LTP ₹${packet.ltp}`);
  }

  /**
   * Handle Previous Close Packet (code 6)
   */
  private handlePrevClosePacket(packet: PrevClosePacket): void {
    console.log(`[DhanWS] Prev Close for ${packet.securityId}: ₹${packet.prevClose}`);

    // Store prev close for reference (useful for % change calculations)
    this.emit('prevClose', {
      securityId: packet.securityId,
      prevClose: packet.prevClose,
      prevOpenInterest: packet.prevOpenInterest
    });
  }

  /**
   * Handle Disconnection Packet (code 50)
   */
  private handleDisconnection(packet: DisconnectionPacket): void {
    const reason = getDisconnectionReason(packet.reasonCode);
    console.error(`[DhanWS] Disconnected by server. Reason: ${reason}`);

    this.emit('serverDisconnect', {
      code: packet.reasonCode,
      reason
    });

    // Close connection gracefully
    this.disconnect();
  }

  /**
   * Save tick to database
   */
  private async saveTick(enrichedTick: EnrichedTick): Promise<void> {
    try {
      await Tick.create({
        securityId: enrichedTick.securityId,
        ltp: enrichedTick.ltp,
        ltq: enrichedTick.ltq,
        ltt: enrichedTick.ltt,
        volume: enrichedTick.volume,
        totalBuyQty: enrichedTick.totalBuyQty,
        totalSellQty: enrichedTick.totalSellQty,
        bidAskImbalance: enrichedTick.depthMetrics.bidAskImbalance,
        depthSpread: enrichedTick.depthMetrics.depthSpread,
        orderBookStrength: enrichedTick.depthMetrics.orderBookStrength,
        volumeDelta: enrichedTick.depthMetrics.volumeDelta,
        liquidityScore: enrichedTick.depthMetrics.liquidityScore,
        timestamp: enrichedTick.timestamp
      });
    } catch (error) {
      // Don't throw - we don't want DB errors to stop market data flow
      console.error('[DhanWS] Error saving tick to DB:', error);
    }
  }

  /**
   * Start ping-pong to keep connection alive
   * Dhan requires response within 40 seconds
   */
  private startPingPong(): void {
    // Send ping every 30 seconds (well within 40 second timeout)
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  /**
   * Stop ping-pong interval
   */
  private stopPingPong(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Reconnect to WebSocket
   */
  private reconnect(): void {
    this.reconnectAttempts++;

    console.log(`[DhanWS] Reconnecting... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connect(this.tickFeedToken, this.clientId);

        // Re-subscribe to instruments
        if (this.subscribedInstruments.size > 0) {
          const instruments = Array.from(this.subscribedInstruments).map(secId => ({
            exchangeSegment: 'IDX_I', // TODO: Get from cache
            securityId: secId
          }));

          await this.subscribeToInstruments(instruments);
        }
      } catch (error) {
        console.error('[DhanWS] Reconnection failed:', error);
      }
    }, this.reconnectDelay);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    console.log('[DhanWS] Disconnecting...');

    this.stopPingPong();

    if (this.ws) {
      // Send disconnect request
      const disconnectRequest = { RequestCode: 12 };

      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(disconnectRequest));
      }

      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.subscribedInstruments.clear();

    console.log('[DhanWS] Disconnected');
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Get subscribed instruments
   */
  getSubscribedInstruments(): string[] {
    return Array.from(this.subscribedInstruments);
  }
}

// Singleton instance
export default new DhanWebSocketManager();

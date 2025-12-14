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

// Helper function to check if market is currently open
function isMarketOpen(): { open: boolean; message: string } {
  const now = new Date();

  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);

  const day = istTime.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Market hours: 9:15 AM to 3:30 PM IST, Monday to Friday
  const marketOpen = 9 * 60 + 15; // 9:15 AM = 555 minutes
  const marketClose = 15 * 60 + 30; // 3:30 PM = 930 minutes

  if (day === 0 || day === 6) {
    return {
      open: false,
      message: `Market is CLOSED (Weekend). Current IST time: ${istTime.toISOString().slice(11, 19)} IST`
    };
  }

  if (timeInMinutes < marketOpen) {
    return {
      open: false,
      message: `Market is CLOSED (Pre-market). Current IST time: ${istTime.toISOString().slice(11, 19)} IST. Market opens at 9:15 AM IST`
    };
  }

  if (timeInMinutes > marketClose) {
    return {
      open: false,
      message: `Market is CLOSED (Post-market). Current IST time: ${istTime.toISOString().slice(11, 19)} IST. Market closed at 3:30 PM IST`
    };
  }

  return {
    open: true,
    message: `Market is OPEN. Current IST time: ${istTime.toISOString().slice(11, 19)} IST`
  };
}

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
    console.log(`[DhanWS] Connecting to Dhan WebSocket...`);
    console.log(`[DhanWS] Token: ${tickFeedToken.substring(0, 20)}...`);
    console.log(`[DhanWS] ClientId: ${clientId}`);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);
        console.log('[DhanWS] WebSocket instance created', this.ws);
        this.ws.on('open', () => {
          console.log('[DhanWS] ✅ Connected to Dhan market feed');
          this.isConnected = true;
          this.reconnectAttempts = 0;

          // Check and display market status
          const marketStatus = isMarketOpen();
          if (!marketStatus.open) {
            console.warn(`[DhanWS] ⚠️  ${marketStatus.message}`);
            console.warn(`[DhanWS] ⚠️  Note: Dhan will NOT send tick data when market is closed!`);
          } else {
            console.log(`[DhanWS] ✅ ${marketStatus.message}`);
          }

          // Start ping-pong to keep connection alive
          this.startPingPong();

          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          console.log(`[DhanWS] 📨 Message received from server - Size: ${data.length} bytes`);
          console.log(`[DhanWS] 📨 First 20 bytes (hex): ${data.slice(0, 20).toString('hex')}`);
          this.handleMessage(data);
        });

        this.ws.on('ping', (data: Buffer) => {
          console.log('[DhanWS] 🏓 PING received from server');
          // Respond to server ping with pong
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.pong(data);
            console.log('[DhanWS] 🏓 PONG sent to server');
          }
        });

        this.ws.on('pong', () => {
          console.log('[DhanWS] 🏓 PONG received from server (response to our ping)');
        });

        this.ws.on('error', (error: Error) => {
          console.error('[DhanWS] ❌ WebSocket error:', error);
          this.emit('error', error);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          const reasonStr = reason.toString();
          console.log(`[DhanWS] ❌ Connection closed. Code: ${code}, Reason: ${reasonStr || 'No reason provided'}`);

          // Common WebSocket close codes
          const closeReasons: { [key: number]: string } = {
            1000: 'Normal closure',
            1001: 'Going away',
            1002: 'Protocol error',
            1003: 'Unsupported data',
            1006: 'Abnormal closure (no close frame)',
            1007: 'Invalid frame payload data',
            1008: 'Policy violation',
            1009: 'Message too big',
            1010: 'Missing extension',
            1011: 'Internal server error',
            1015: 'TLS handshake failed'
          };

          console.log(`[DhanWS] Close code meaning: ${closeReasons[code] || 'Unknown'}`);

          if (code === 1006) {
            console.error('[DhanWS] ⚠️  Code 1006 usually indicates:');
            console.error('[DhanWS]    1. Invalid authentication (wrong token/clientId)');
            console.error('[DhanWS]    2. Network issue preventing proper connection');
            console.error('[DhanWS]    3. Server rejected the connection');
          }

          this.isConnected = false;
          this.stopPingPong();

          this.emit('disconnected', { code, reason: reasonStr });

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

    console.log(`[DhanWS] 📡 Subscribing to ${instruments.length} instruments...`);

    // Dhan allows max 100 instruments per subscription request
    const batchSize = 100;

    for (let i = 0; i < instruments.length; i += batchSize) {
      const batch = instruments.slice(i, i + batchSize);

      const subscriptionRequest: SubscriptionRequest = {
        RequestCode: 15, // RequestCode 15 = Ticker packets (code 2) - LTP only, trying this for index instruments
        InstrumentCount: batch.length,
        InstrumentList: batch.map(inst => ({
          ExchangeSegment: inst.exchangeSegment,
          SecurityId: inst.securityId
        }))
      };

      console.log(`[DhanWS] Sending subscription request:`, JSON.stringify(subscriptionRequest, null, 2));
      console.log(`[DhanWS] WebSocket readyState BEFORE send: ${this.ws.readyState} (1=OPEN)`);

      // Send JSON subscription request
      this.ws.send(JSON.stringify(subscriptionRequest));

      console.log(`[DhanWS] WebSocket readyState AFTER send: ${this.ws.readyState} (1=OPEN)`);
      console.log(`[DhanWS] Subscription message sent successfully`);

      // Track subscribed instruments
      batch.forEach(inst => {
        this.subscribedInstruments.add(inst.securityId);
      });

      console.log(`[DhanWS] ✅ Subscribed to ${batch.length} instruments (batch ${Math.floor(i / batchSize) + 1})`);

      // Check market status
      const marketStatus = isMarketOpen();
      if (!marketStatus.open) {
        console.warn(`[DhanWS] ⚠️  ${marketStatus.message}`);
        console.warn(`[DhanWS] ⚠️  Dhan will NOT send data when market is closed!`);
      } else {
        console.log(`[DhanWS] ✅ ${marketStatus.message}`);
        console.log(`[DhanWS] 🎯 Waiting for data packets...`);
      }
    }

    console.log(`[DhanWS] ✅ Total subscribed instruments: ${this.subscribedInstruments.size}`);
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
      console.log(`[DhanWS] 📦 Packet received - Code: ${feedCode}, SecurityId: ${securityId}`);

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
  private async handleQuotePacket(packet: QuotePacket): Promise<void> {
    try {
      console.log(`[DhanWS] Quote packet received for ${packet.securityId}: LTP ₹${packet.ltp}`);

      // Quote packets don't have market depth, so calculate simple metrics from buy/sell totals
      const totalQty = packet.totalBuyQty + packet.totalSellQty;
      const bidAskImbalance = totalQty > 0
        ? ((packet.totalBuyQty - packet.totalSellQty) / totalQty) * 100
        : 0;

      const depthMetrics = {
        bidAskImbalance,
        depthSpread: 0, // Not available without market depth
        orderBookStrength: 0, // Not available without market depth
        volumeDelta: 0, // Not available in quote packet
        liquidityScore: totalQty / 1000 // Simple liquidity score based on total quantity
      };

      // Create enriched tick from quote packet
      const enrichedTick: EnrichedTick = {
        securityId: packet.securityId,
        ltp: packet.ltp,
        ltq: packet.ltq,
        ltt: new Date(packet.ltt * 1000),
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

      // Emit tick event for other services
      this.emit('tick', enrichedTick);

      console.log(`[DhanWS] ✅ Emitted quote data for ${packet.securityId}`);

    } catch (error) {
      console.error('[DhanWS] Error handling quote packet:', error);
    }
  }

  /**
   * Handle Ticker Packet (code 2) - Basic LTP data
   */
  private async handleTickerPacket(packet: TickerPacket): Promise<void> {
    try {
      console.log(`[DhanWS] Ticker packet received for ${packet.securityId}: LTP ₹${packet.ltp}`);

      // Create a simplified tick from ticker packet (doesn't have market depth)
      const simplifiedTick: EnrichedTick = {
        securityId: packet.securityId,
        ltp: packet.ltp,
        ltq: 0, // Not available in ticker packet
        ltt: new Date(packet.ltt * 1000),
        volume: 0,
        totalBuyQty: 0,
        totalSellQty: 0,
        open: 0,
        high: 0,
        low: 0,
        close: 0,
        atp: 0,
        depthMetrics: {
          bidAskImbalance: 0,
          depthSpread: 0,
          orderBookStrength: 0,
          volumeDelta: 0,
          liquidityScore: 0
        },
        timestamp: new Date()
      };

      // Emit tick event for other services
      this.emit('tick', simplifiedTick);

      console.log(`[DhanWS] ✅ Emitted ticker data for ${packet.securityId}`);

    } catch (error) {
      console.error('[DhanWS] Error handling ticker packet:', error);
    }
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
    console.log('[DhanWS] 🏓 Starting ping-pong keepalive (every 30 seconds)');
    // Send ping every 30 seconds (well within 40 second timeout)
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('[DhanWS] 🏓 Sending PING to server (keepalive)');
        this.ws.ping();
      } else {
        console.warn(`[DhanWS] ⚠️  Cannot send ping, WebSocket readyState: ${this.ws?.readyState}`);
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

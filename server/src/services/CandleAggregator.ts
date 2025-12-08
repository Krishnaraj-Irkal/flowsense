/**
 * Candle Aggregator Service
 *
 * Aggregates real-time tick data into OHLC candles (1m, 5m, 15m, etc.)
 * Calculates average market depth metrics per candle period
 * Emits candle close events for strategy engine
 */

import { EventEmitter } from 'events';
import Candle from '../models/Candle';
import DhanWebSocketManager, { EnrichedTick } from './DhanWebSocketManager';

// Candle intervals in milliseconds
const CANDLE_INTERVALS = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000
};

type CandleInterval = '1m' | '5m' | '15m' | '1h' | '1d';

// In-memory candle being built
interface BuildingCandle {
  securityId: string;
  interval: CandleInterval;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
  isClosed: boolean;

  // For averaging depth metrics
  depthMetricsSum: {
    bidAskImbalance: number;
    depthSpread: number;
    orderBookStrength: number;
  };
  tickCount: number;
}

class CandleAggregator extends EventEmitter {
  private activeCandlesMap: Map<string, BuildingCandle> = new Map();
  private candleIntervals: CandleInterval[] = ['1m', '5m']; // Focus on intraday
  private isStarted: boolean = false;

  constructor() {
    super();
  }

  /**
   * Start the candle aggregator
   */
  start(): void {
    if (this.isStarted) {
      console.log('[CandleAggregator] Already started');
      return;
    }

    console.log('[CandleAggregator] Starting candle aggregation...');

    // Subscribe to tick events from DhanWebSocketManager
    DhanWebSocketManager.on('tick', this.onTick.bind(this));

    this.isStarted = true;
    console.log(`[CandleAggregator] Aggregating intervals: ${this.candleIntervals.join(', ')}`);
  }

  /**
   * Stop the candle aggregator
   */
  stop(): void {
    if (!this.isStarted) {
      return;
    }

    console.log('[CandleAggregator] Stopping candle aggregation...');

    // Remove listener
    DhanWebSocketManager.removeListener('tick', this.onTick.bind(this));

    // Close all active candles
    this.closeAllCandles();

    this.isStarted = false;
    console.log('[CandleAggregator] Stopped');
  }

  /**
   * Handle incoming tick data
   */
  private onTick(tick: EnrichedTick): void {
    const { securityId, ltp, volume, depthMetrics } = tick;

    // Process tick for each interval
    for (const interval of this.candleIntervals) {
      this.processTick(securityId, interval, ltp, volume, depthMetrics);
    }
  }

  /**
   * Process tick for a specific interval
   */
  private processTick(
    securityId: string,
    interval: CandleInterval,
    ltp: number,
    volume: number,
    depthMetrics: any
  ): void {
    const candleKey = this.getCandleKey(securityId, interval);
    const candleTimestamp = this.getCandleTimestamp(new Date(), interval);

    let candle = this.activeCandlesMap.get(candleKey);

    // Check if we need to close existing candle and start new one
    if (candle && candle.timestamp.getTime() !== candleTimestamp.getTime()) {
      // Close the old candle
      this.closeCandle(candle);

      // Remove from active candles
      this.activeCandlesMap.delete(candleKey);
      candle = undefined;
    }

    // Create new candle if doesn't exist
    if (!candle) {
      candle = this.createNewCandle(securityId, interval, ltp, candleTimestamp);
      this.activeCandlesMap.set(candleKey, candle);
    }

    // Update candle with new tick
    this.updateCandle(candle, ltp, volume, depthMetrics);
  }

  /**
   * Create a new candle
   */
  private createNewCandle(
    securityId: string,
    interval: CandleInterval,
    openPrice: number,
    timestamp: Date
  ): BuildingCandle {
    return {
      securityId,
      interval,
      open: openPrice,
      high: openPrice,
      low: openPrice,
      close: openPrice,
      volume: 0,
      timestamp,
      isClosed: false,
      depthMetricsSum: {
        bidAskImbalance: 0,
        depthSpread: 0,
        orderBookStrength: 0
      },
      tickCount: 0
    };
  }

  /**
   * Update candle with new tick data
   */
  private updateCandle(
    candle: BuildingCandle,
    ltp: number,
    volume: number,
    depthMetrics: any
  ): void {
    // Update OHLC
    candle.high = Math.max(candle.high, ltp);
    candle.low = Math.min(candle.low, ltp);
    candle.close = ltp;

    // Update volume (cumulative for the candle period)
    candle.volume = volume;

    // Accumulate depth metrics for averaging
    candle.depthMetricsSum.bidAskImbalance += depthMetrics.bidAskImbalance;
    candle.depthMetricsSum.depthSpread += depthMetrics.depthSpread;
    candle.depthMetricsSum.orderBookStrength += depthMetrics.orderBookStrength;
    candle.tickCount++;
  }

  /**
   * Close a candle and save to database
   */
  private async closeCandle(candle: BuildingCandle): Promise<void> {
    candle.isClosed = true;

    // Calculate average depth metrics
    const avgBidAskImbalance = candle.tickCount > 0
      ? candle.depthMetricsSum.bidAskImbalance / candle.tickCount
      : 1;

    const avgDepthSpread = candle.tickCount > 0
      ? candle.depthMetricsSum.depthSpread / candle.tickCount
      : 0;

    const avgOrderBookStrength = candle.tickCount > 0
      ? candle.depthMetricsSum.orderBookStrength / candle.tickCount
      : 0;

    console.log(`[CandleAggregator] Closing ${candle.interval} candle for ${candle.securityId}: O=${candle.open} H=${candle.high} L=${candle.low} C=${candle.close} V=${candle.volume}`);

    // Save to database
    try {
      const savedCandle = await Candle.findOneAndUpdate(
        {
          securityId: candle.securityId,
          interval: candle.interval,
          timestamp: candle.timestamp
        },
        {
          securityId: candle.securityId,
          interval: candle.interval,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          avgBidAskImbalance,
          avgDepthSpread,
          avgOrderBookStrength,
          timestamp: candle.timestamp,
          isClosed: true
        },
        {
          upsert: true,
          new: true
        }
      );

      // Emit candle close event with depth metrics
      this.emit('candle:close', savedCandle, {
        bidAskImbalance: avgBidAskImbalance,
        depthSpread: avgDepthSpread,
        orderBookStrength: avgOrderBookStrength,
        liquidityScore: 0, // Not averaged, would need more complex calculation
        volumeDelta: 0 // Not averaged
      });

      // Emit to internal WebSocket for frontend
      this.emit('candle:update', {
        type: 'candle',
        interval: candle.interval,
        data: savedCandle
      });

    } catch (error) {
      console.error('[CandleAggregator] Error saving candle:', error);
    }
  }

  /**
   * Close all active candles (e.g., on shutdown)
   */
  private closeAllCandles(): void {
    console.log(`[CandleAggregator] Closing ${this.activeCandlesMap.size} active candles...`);

    for (const [_key, candle] of this.activeCandlesMap.entries()) {
      this.closeCandle(candle);
    }

    this.activeCandlesMap.clear();
  }

  /**
   * Get candle key for map storage
   */
  private getCandleKey(securityId: string, interval: CandleInterval): string {
    return `${securityId}_${interval}`;
  }

  /**
   * Get normalized candle timestamp (start of period)
   */
  private getCandleTimestamp(now: Date, interval: CandleInterval): Date {
    const timestamp = new Date(now);
    const intervalMs = CANDLE_INTERVALS[interval];

    // For intraday candles (1m, 5m, 15m, 1h)
    if (interval !== '1d') {
      // Round down to the start of the interval
      const timeSinceEpoch = timestamp.getTime();
      const roundedTime = Math.floor(timeSinceEpoch / intervalMs) * intervalMs;
      return new Date(roundedTime);
    }

    // For daily candles
    timestamp.setHours(0, 0, 0, 0);
    return timestamp;
  }

  /**
   * Get active candle for a security and interval
   */
  getActiveCandle(securityId: string, interval: CandleInterval): BuildingCandle | undefined {
    const key = this.getCandleKey(securityId, interval);
    return this.activeCandlesMap.get(key);
  }

  /**
   * Get all active candles
   */
  getAllActiveCandles(): BuildingCandle[] {
    return Array.from(this.activeCandlesMap.values());
  }

  /**
   * Set intervals to aggregate
   */
  setIntervals(intervals: CandleInterval[]): void {
    this.candleIntervals = intervals;
    console.log(`[CandleAggregator] Updated intervals: ${intervals.join(', ')}`);
  }

  /**
   * Get status
   */
  getStatus(): {
    isStarted: boolean;
    activeCandles: number;
    intervals: CandleInterval[];
  } {
    return {
      isStarted: this.isStarted,
      activeCandles: this.activeCandlesMap.size,
      intervals: this.candleIntervals
    };
  }
}

// Singleton instance
export default new CandleAggregator();

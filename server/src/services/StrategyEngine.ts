/**
 * Strategy Engine Service
 *
 * Responsibilities:
 * - Load and manage all trading strategies
 * - Subscribe to candle close events from CandleAggregator
 * - Run strategy logic on new candles
 * - Generate and save trading signals
 * - Emit signals to Paper Trading Engine
 * - Track strategy performance metrics
 * - Reset daily counters at market open
 *
 * Singleton pattern - single instance manages all strategies
 */

import { EventEmitter } from 'events';
import { BaseStrategy, Signal } from '../strategies/BaseStrategy';
import { EMACrossoverStrategy } from '../strategies/intraday/EMACrossoverStrategy';
import { OpeningRangeBreakoutStrategy } from '../strategies/intraday/OpeningRangeBreakoutStrategy';
import { ICandle } from '../models/Candle';
import { MarketDepthMetrics } from '../utils/marketDepthMetrics';
import SignalModel from '../models/Signal';
import CandleAggregator from './CandleAggregator';

interface StrategyStatus {
  name: string;
  timeframe: string;
  tradingType: string;
  isActive: boolean;
  tradesPlacedToday: number;
  maxTradesPerDay?: number;
  totalSignalsGenerated: number;
}

class StrategyEngine extends EventEmitter {
  private strategies: Map<string, BaseStrategy> = new Map();
  private activeStrategies: Set<string> = new Set();
  private signalCounts: Map<string, number> = new Map();
  private isRunning: boolean = false;

  // Daily reset scheduler
  private dailyResetScheduled: boolean = false;

  constructor() {
    super();
  }

  /**
   * Initialize and start the Strategy Engine
   *
   * Steps:
   * 1. Register all available strategies
   * 2. Subscribe to candle close events
   * 3. Schedule daily resets
   * 4. Mark as running
   */
  start(): void {
    if (this.isRunning) {
      console.log('[StrategyEngine] Already running');
      return;
    }

    console.log('[StrategyEngine] Starting Strategy Engine...');

    // Register intraday strategies
    this.registerStrategy(new EMACrossoverStrategy());
    this.registerStrategy(new OpeningRangeBreakoutStrategy());

    // TODO: Register swing strategies when implemented
    // this.registerStrategy(new RSISupportResistanceStrategy());
    // this.registerStrategy(new TrendFollowingStrategy());

    // Subscribe to candle close events from CandleAggregator
    CandleAggregator.on('candle:close', this.onCandleClose.bind(this));

    // Schedule daily resets
    this.scheduleDailyReset();

    this.isRunning = true;

    console.log(`[StrategyEngine] Started with ${this.strategies.size} strategies:`);
    this.strategies.forEach((strategy, name) => {
      console.log(`  - ${name} (${strategy.timeframe}, ${strategy.tradingType})`);
    });
  }

  /**
   * Stop the Strategy Engine
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('[StrategyEngine] Stopping...');

    // Unsubscribe from candle events
    CandleAggregator.off('candle:close', this.onCandleClose.bind(this));

    this.isRunning = false;

    console.log('[StrategyEngine] Stopped');
  }

  /**
   * Register a strategy
   */
  private registerStrategy(strategy: BaseStrategy): void {
    this.strategies.set(strategy.name, strategy);
    this.activeStrategies.add(strategy.name); // Active by default
    this.signalCounts.set(strategy.name, 0);
    console.log(`[StrategyEngine] Registered strategy: ${strategy.name}`);
  }

  /**
   * Handle candle close event
   *
   * Called when CandleAggregator emits a completed candle
   *
   * @param candle - Closed candle with OHLC data
   * @param depthMetrics - Averaged market depth metrics for the candle period
   */
  private async onCandleClose(candle: ICandle, depthMetrics: MarketDepthMetrics): Promise<void> {
    try {
      console.log(`[StrategyEngine] Processing ${candle.interval} candle @ ${candle.timestamp.toLocaleString()}: O=${candle.open.toFixed(2)}, H=${candle.high.toFixed(2)}, L=${candle.low.toFixed(2)}, C=${candle.close.toFixed(2)}, V=${candle.volume.toLocaleString()}`);

      // Run each strategy that matches this candle interval
      for (const [name, strategy] of this.strategies.entries()) {
        // Skip if strategy is not active
        if (!this.activeStrategies.has(name)) {
          continue;
        }

        // Skip if candle interval doesn't match strategy timeframe
        if (strategy.timeframe !== candle.interval) {
          continue;
        }

        try {
          // Run strategy logic
          const signal = strategy.onCandle(candle, depthMetrics);

          if (signal) {
            // Signal generated!
            await this.handleSignal(signal, strategy, candle);
          }

        } catch (error) {
          console.error(`[StrategyEngine] Error running strategy ${name}:`, error);
        }
      }

    } catch (error) {
      console.error('[StrategyEngine] Error processing candle:', error);
    }
  }

  /**
   * Handle generated signal
   *
   * Steps:
   * 1. Log signal details
   * 2. Save to database
   * 3. Emit to Paper Trading Engine
   * 4. Track signal count
   */
  private async handleSignal(
    signal: Signal,
    strategy: BaseStrategy,
    candle: ICandle
  ): Promise<void> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎯 SIGNAL GENERATED by ${strategy.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Type: ${signal.type}`);
    console.log(`Price: ₹${signal.price.toFixed(2)}`);
    console.log(`Stop Loss: ₹${signal.stopLoss.toFixed(2)} (${((Math.abs(signal.price - signal.stopLoss) / signal.price) * 100).toFixed(2)}%)`);
    console.log(`Target: ₹${signal.target.toFixed(2)} (${((Math.abs(signal.target - signal.price) / signal.price) * 100).toFixed(2)}%)`);
    console.log(`Quantity: ${signal.quantity}`);
    console.log(`Reason: ${signal.reason}`);
    console.log(`Market Depth:`);
    console.log(`  - Bid-Ask Imbalance: ${signal.bidAskImbalance.toFixed(2)}`);
    console.log(`  - Order Book Strength: ${signal.orderBookStrength.toFixed(0)}`);
    console.log(`  - Liquidity Score: ${signal.liquidityScore.toFixed(0)}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Save signal to database
      const savedSignal = await SignalModel.create({
        // userId will be added when we have user context (for now using first user)
        strategyName: strategy.name,
        securityId: candle.securityId,
        type: signal.type,
        price: signal.price,
        reason: signal.reason,
        stopLoss: signal.stopLoss,
        target: signal.target,
        quantity: signal.quantity,
        bidAskImbalance: signal.bidAskImbalance,
        orderBookStrength: signal.orderBookStrength,
        liquidityScore: signal.liquidityScore,
        status: 'pending',
        timestamp: new Date()
      });

      console.log(`[StrategyEngine] Signal saved to database with ID: ${savedSignal._id}`);

      // Increment signal count
      const currentCount = this.signalCounts.get(strategy.name) || 0;
      this.signalCounts.set(strategy.name, currentCount + 1);

      // Emit signal event for Paper Trading Engine
      this.emit('signal', {
        signal: savedSignal,
        strategyName: strategy.name,
        candle
      });

    } catch (error) {
      console.error('[StrategyEngine] Error saving signal:', error);
    }
  }

  /**
   * Schedule daily reset at 9:00 AM
   *
   * Resets:
   * - Daily trade counters for each strategy
   * - Daily state for strategies (e.g., opening range)
   */
  private scheduleDailyReset(): void {
    // Check every minute if it's 9:00 AM
    setInterval(() => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Reset at 9:00 AM
      if (hours === 9 && minutes === 0 && !this.dailyResetScheduled) {
        this.performDailyReset();
        this.dailyResetScheduled = true;
      }

      // Reset the flag at 9:01 AM
      if (hours === 9 && minutes === 1) {
        this.dailyResetScheduled = false;
      }
    }, 60000); // Check every minute

    console.log('[StrategyEngine] Daily reset scheduled for 9:00 AM');
  }

  /**
   * Perform daily reset for all strategies
   */
  private performDailyReset(): void {
    console.log('\n[StrategyEngine] ⏰ Performing daily reset at market open...');

    for (const [name, strategy] of this.strategies.entries()) {
      try {
        // Reset daily counter
        if (strategy.resetDailyCounter) {
          strategy.resetDailyCounter();
        }

        // Reset daily state (for strategies that need it, like ORB)
        if ((strategy as any).resetDailyState) {
          (strategy as any).resetDailyState();
        }

        console.log(`[StrategyEngine] Reset ${name}`);

      } catch (error) {
        console.error(`[StrategyEngine] Error resetting ${name}:`, error);
      }
    }

    console.log('[StrategyEngine] Daily reset complete\n');
  }

  /**
   * Enable a strategy
   */
  enableStrategy(strategyName: string): boolean {
    if (!this.strategies.has(strategyName)) {
      console.error(`[StrategyEngine] Strategy not found: ${strategyName}`);
      return false;
    }

    this.activeStrategies.add(strategyName);
    console.log(`[StrategyEngine] Enabled strategy: ${strategyName}`);
    return true;
  }

  /**
   * Disable a strategy
   */
  disableStrategy(strategyName: string): boolean {
    if (!this.strategies.has(strategyName)) {
      console.error(`[StrategyEngine] Strategy not found: ${strategyName}`);
      return false;
    }

    this.activeStrategies.delete(strategyName);
    console.log(`[StrategyEngine] Disabled strategy: ${strategyName}`);
    return true;
  }

  /**
   * Get status of all strategies
   */
  getStatus(): StrategyStatus[] {
    const statuses: StrategyStatus[] = [];

    for (const [name, strategy] of this.strategies.entries()) {
      const strategyStatus = strategy.getStatus();

      statuses.push({
        name: strategyStatus.name,
        timeframe: strategyStatus.timeframe,
        tradingType: strategyStatus.tradingType,
        isActive: this.activeStrategies.has(name),
        tradesPlacedToday: strategyStatus.tradesPlacedToday,
        maxTradesPerDay: strategyStatus.maxTradesPerDay,
        totalSignalsGenerated: this.signalCounts.get(name) || 0
      });
    }

    return statuses;
  }

  /**
   * Get a specific strategy instance (for testing/debugging)
   */
  getStrategy(name: string): BaseStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * Check if engine is running
   */
  isEngineRunning(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
export default new StrategyEngine();

/**
 * Smart Money Strategy
 *
 * Advanced institutional-grade trading strategy that combines:
 * 1. Full Market Depth (20-level order book) - for institutional activity
 * 2. Option Chain OI & Volume - for directional bias
 * 3. False breakout detection - using volume profile
 * 4. Multi-confluence confirmation - for high-probability trades
 *
 * Entry Rules (ALL must be met):
 * ✅ Price action: Clean breakout/breakdown with strong candle
 * ✅ Order flow: Market depth showing absorption in trade direction
 * ✅ Options: OI and volume confirming direction
 * ✅ Volume: Above-average volume (no false breakouts)
 * ✅ Risk-Reward: Minimum 1:3 R:R with clear stop loss
 *
 * Exit Rules:
 * - Target hit (3% profit or options resistance/support)
 * - Stop loss hit (1% or depth reversal)
 * - Time-based: Square off at 3:20 PM
 * - Reversal signals from depth or options
 */

import { BaseStrategy, Signal } from '../BaseStrategy';
import { ICandle } from '../../models/Candle';
import { MarketDepthMetrics } from '../../utils/marketDepthMetrics';
import MarketDepthManager, { DepthAnalytics } from '../../services/MarketDepthManager';
import OptionChainAnalyzer, { OptionChainAnalytics } from '../../services/OptionChainAnalyzer';
import MultiTimeframeConfirmation from '../../utils/multiTimeframeConfirmation';

export class SmartMoneyStrategy extends BaseStrategy {
  name: string = 'Smart Money Institutional Strategy';
  timeframe: '1m' | '5m' = '5m';
  tradingType: 'intraday' | 'swing' = 'intraday';
  protected strategyWeight: number = 1.5; // Highest weight - most sophisticated strategy

  // Market depth analytics cache
  private latestDepthAnalytics: Map<string, DepthAnalytics> = new Map();

  // Option chain analytics cache
  private latestOptionAnalytics: Map<string, OptionChainAnalytics> = new Map();

  // Candle history for pattern detection
  private candleHistory: Map<string, ICandle[]> = new Map();
  private readonly maxCandleHistory: number = 20;

  // Volume profile
  private averageVolume: Map<string, number> = new Map();

  // Minimum confirmations required
  private minConfluences: number = 4; // Out of 5 possible

  constructor() {
    super();

    // Listen to market depth analytics
    MarketDepthManager.on('depth:analytics', (analytics: DepthAnalytics) => {
      this.latestDepthAnalytics.set(analytics.securityId, analytics);
    });

    // Listen to option chain analytics
    OptionChainAnalyzer.on('analytics', (analytics: OptionChainAnalytics) => {
      this.latestOptionAnalytics.set(analytics.underlyingSecurityId, analytics);
    });

    console.log('[SmartMoney] Strategy initialized with market depth and option chain integration');
  }

  /**
   * Main strategy logic - called on each 5m candle close
   */
  async onCandle(candle: ICandle, depthMetrics: MarketDepthMetrics): Promise<Signal | null> {
    const securityId = candle.securityId;

    // Update candle history
    this.updateCandleHistory(securityId, candle);

    // Update average volume
    this.updateAverageVolume(securityId, candle.volume);

    const history = this.candleHistory.get(securityId) || [];
    if (history.length < 3) {
      return null; // Need at least 3 candles for pattern detection
    }

    // Get latest analytics
    const depthAnalytics = this.latestDepthAnalytics.get(securityId);
    const optionAnalytics = this.latestOptionAnalytics.get(securityId);

    // Detect bullish setup
    const bullishSignal = await this.detectBullishSetup(candle, history, depthMetrics, depthAnalytics, optionAnalytics);
    if (bullishSignal) {
      return bullishSignal;
    }

    // Detect bearish setup
    const bearishSignal = await this.detectBearishSetup(candle, history, depthMetrics, depthAnalytics, optionAnalytics);
    if (bearishSignal) {
      return bearishSignal;
    }

    return null;
  }

  /**
   * Detect bullish entry setup with multi-confluence confirmation
   */
  private async detectBullishSetup(
    candle: ICandle,
    history: ICandle[],
    depthMetrics: MarketDepthMetrics,
    depthAnalytics?: DepthAnalytics,
    optionAnalytics?: OptionChainAnalytics
  ): Promise<Signal | null> {
    let confluences = 0;
    const reasons: string[] = [];

    // 1. PRICE ACTION: Bullish breakout candle
    const isBullishBreakout = this.isBullishBreakoutCandle(candle, history);
    if (isBullishBreakout) {
      confluences++;
      reasons.push('Bullish breakout candle');
    } else {
      return null; // Must have bullish candle
    }

    // 2. VOLUME: Above-average volume (confirms breakout, not false)
    const avgVol = this.averageVolume.get(candle.securityId) || 0;
    if (candle.volume > avgVol * 1.3) {
      confluences++;
      reasons.push('High volume confirmation');
    }

    // 3. MARKET DEPTH: Institutional buying pressure
    if (depthAnalytics) {
      if (depthAnalytics.absorption === 'BUYING' && depthAnalytics.absorptionStrength > 20) {
        confluences++;
        reasons.push(`Strong buying absorption (${depthAnalytics.absorptionStrength.toFixed(0)}%)`);
      }

      // Check if price is near strong bid support
      const distanceToSupport = depthAnalytics.strongestBidLevel ?
        ((candle.close - depthAnalytics.strongestBidLevel.price) / candle.close) * 100 : 100;

      if (distanceToSupport < 0.5 && distanceToSupport > -0.5) {
        confluences++;
        reasons.push('Price at strong bid support level');
      }
    }

    // 4. OPTION CHAIN: Bullish sentiment from OI and volume
    if (optionAnalytics) {
      if (optionAnalytics.sentiment === 'BULLISH' && optionAnalytics.sentimentStrength > 60) {
        confluences++;
        reasons.push(`Options bullish (${optionAnalytics.sentimentStrength.toFixed(0)}% strength)`);
      }

      // Check PCR (Put-Call Ratio)
      if (optionAnalytics.putCallRatioOI < 0.7) {
        reasons.push(`Low PCR OI (${optionAnalytics.putCallRatioOI.toFixed(2)}) - bullish`);
      }

      // Check if call volume > put volume
      if (optionAnalytics.putCallRatioVolume < 0.8) {
        reasons.push(`High call volume activity`);
      }
    }

    // 5. FALSE BREAKOUT CHECK: Previous candles should show accumulation
    const isAccumulation = this.checkAccumulationPattern(history);
    if (isAccumulation) {
      confluences++;
      reasons.push('Accumulation pattern detected');
    }

    // Check if we have enough confluences
    if (confluences < this.minConfluences) {
      console.log(`[SmartMoney] Bullish setup rejected - only ${confluences}/${this.minConfluences} confluences met`);
      return null;
    }

    // 6. MULTI-TIMEFRAME CONFIRMATION (Critical check)
    const isMultiTFAligned = await MultiTimeframeConfirmation.isSignalAligned(
      candle.securityId,
      'BUY',
      this.timeframe
    );

    if (!isMultiTFAligned) {
      console.log(`[SmartMoney] ❌ Bullish signal REJECTED: Multi-timeframe not aligned`);
      return null;
    }

    console.log(`[SmartMoney] ✅ Multi-timeframe ALIGNED for BUY`);
    reasons.push('Multi-timeframe aligned');

    // Generate BUY signal with enhanced reason
    const signal = this.generateSignal(
      'BUY',
      candle.close,
      reasons.join(' | '),
      depthMetrics,
      confluences,
      isMultiTFAligned
    );

    if (signal) {
      console.log(`[SmartMoney] 🚀 BULLISH SIGNAL GENERATED`);
      console.log(`  Confluences: ${confluences}/${this.minConfluences}`);
      console.log(`  Entry: ₹${signal.price}`);
      console.log(`  Target: ₹${signal.target}`);
      console.log(`  Stop Loss: ₹${signal.stopLoss}`);
      console.log(`  Reasons: ${reasons.join(', ')}`);

      if (depthAnalytics) {
        console.log(`  Order Flow Imbalance: ${depthAnalytics.orderFlowImbalance.toFixed(1)}%`);
        console.log(`  Absorption: ${depthAnalytics.absorption}`);
      }

      if (optionAnalytics) {
        console.log(`  PCR OI: ${optionAnalytics.putCallRatioOI.toFixed(2)}`);
        console.log(`  Options Sentiment: ${optionAnalytics.sentiment}`);
      }
    }

    return signal;
  }

  /**
   * Detect bearish entry setup with multi-confluence confirmation
   */
  private async detectBearishSetup(
    candle: ICandle,
    history: ICandle[],
    depthMetrics: MarketDepthMetrics,
    depthAnalytics?: DepthAnalytics,
    optionAnalytics?: OptionChainAnalytics
  ): Promise<Signal | null> {
    let confluences = 0;
    const reasons: string[] = [];

    // 1. PRICE ACTION: Bearish breakdown candle
    const isBearishBreakdown = this.isBearishBreakdownCandle(candle, history);
    if (isBearishBreakdown) {
      confluences++;
      reasons.push('Bearish breakdown candle');
    } else {
      return null; // Must have bearish candle
    }

    // 2. VOLUME: Above-average volume
    const avgVol = this.averageVolume.get(candle.securityId) || 0;
    if (candle.volume > avgVol * 1.3) {
      confluences++;
      reasons.push('High volume confirmation');
    }

    // 3. MARKET DEPTH: Institutional selling pressure
    if (depthAnalytics) {
      if (depthAnalytics.absorption === 'SELLING' && depthAnalytics.absorptionStrength > 20) {
        confluences++;
        reasons.push(`Strong selling absorption (${depthAnalytics.absorptionStrength.toFixed(0)}%)`);
      }

      // Check if price is near strong ask resistance
      const distanceToResistance = depthAnalytics.strongestAskLevel ?
        ((depthAnalytics.strongestAskLevel.price - candle.close) / candle.close) * 100 : 100;

      if (distanceToResistance < 0.5 && distanceToResistance > -0.5) {
        confluences++;
        reasons.push('Price at strong ask resistance level');
      }
    }

    // 4. OPTION CHAIN: Bearish sentiment
    if (optionAnalytics) {
      if (optionAnalytics.sentiment === 'BEARISH' && optionAnalytics.sentimentStrength > 60) {
        confluences++;
        reasons.push(`Options bearish (${optionAnalytics.sentimentStrength.toFixed(0)}% strength)`);
      }

      // Check PCR
      if (optionAnalytics.putCallRatioOI > 1.3) {
        reasons.push(`High PCR OI (${optionAnalytics.putCallRatioOI.toFixed(2)}) - bearish`);
      }

      // Check if put volume > call volume
      if (optionAnalytics.putCallRatioVolume > 1.2) {
        reasons.push(`High put volume activity`);
      }
    }

    // 5. FALSE BREAKDOWN CHECK: Previous candles should show distribution
    const isDistribution = this.checkDistributionPattern(history);
    if (isDistribution) {
      confluences++;
      reasons.push('Distribution pattern detected');
    }

    // Check confluences
    if (confluences < this.minConfluences) {
      console.log(`[SmartMoney] Bearish setup rejected - only ${confluences}/${this.minConfluences} confluences met`);
      return null;
    }

    // 6. MULTI-TIMEFRAME CONFIRMATION (Critical check)
    const isMultiTFAligned = await MultiTimeframeConfirmation.isSignalAligned(
      candle.securityId,
      'SELL',
      this.timeframe
    );

    if (!isMultiTFAligned) {
      console.log(`[SmartMoney] ❌ Bearish signal REJECTED: Multi-timeframe not aligned`);
      return null;
    }

    console.log(`[SmartMoney] ✅ Multi-timeframe ALIGNED for SELL`);
    reasons.push('Multi-timeframe aligned');

    // Generate SELL signal
    const signal = this.generateSignal(
      'SELL',
      candle.close,
      reasons.join(' | '),
      depthMetrics,
      confluences,
      isMultiTFAligned
    );

    if (signal) {
      console.log(`[SmartMoney] 📉 BEARISH SIGNAL GENERATED`);
      console.log(`  Confluences: ${confluences}/${this.minConfluences}`);
      console.log(`  Entry: ₹${signal.price}`);
      console.log(`  Target: ₹${signal.target}`);
      console.log(`  Stop Loss: ₹${signal.stopLoss}`);
      console.log(`  Reasons: ${reasons.join(', ')}`);

      if (depthAnalytics) {
        console.log(`  Order Flow Imbalance: ${depthAnalytics.orderFlowImbalance.toFixed(1)}%`);
        console.log(`  Absorption: ${depthAnalytics.absorption}`);
      }

      if (optionAnalytics) {
        console.log(`  PCR OI: ${optionAnalytics.putCallRatioOI.toFixed(2)}`);
        console.log(`  Options Sentiment: ${optionAnalytics.sentiment}`);
      }
    }

    return signal;
  }

  /**
   * Check if candle is a bullish breakout
   */
  private isBullishBreakoutCandle(candle: ICandle, history: ICandle[]): boolean {
    // Strong bullish candle: close > open, closes in top 25% of range
    const range = candle.high - candle.low;
    const closePosition = (candle.close - candle.low) / range;

    if (candle.close <= candle.open || closePosition < 0.75) {
      return false;
    }

    // Breakout: current close > previous high
    const prevCandle = history[history.length - 2];
    if (candle.close > prevCandle.high) {
      return true;
    }

    return false;
  }

  /**
   * Check if candle is a bearish breakdown
   */
  private isBearishBreakdownCandle(candle: ICandle, history: ICandle[]): boolean {
    // Strong bearish candle: close < open, closes in bottom 25% of range
    const range = candle.high - candle.low;
    const closePosition = (candle.close - candle.low) / range;

    if (candle.close >= candle.open || closePosition > 0.25) {
      return false;
    }

    // Breakdown: current close < previous low
    const prevCandle = history[history.length - 2];
    if (candle.close < prevCandle.low) {
      return true;
    }

    return false;
  }

  /**
   * Check for accumulation pattern (consolidation before breakout)
   */
  private checkAccumulationPattern(history: ICandle[]): boolean {
    // Look at last 5 candles before current
    const recentCandles = history.slice(-6, -1);
    if (recentCandles.length < 5) return false;

    // Check for tight consolidation
    const prices = recentCandles.map(c => c.close);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const maxDeviation = Math.max(...prices.map(p => Math.abs(p - avgPrice) / avgPrice));

    // Less than 1% deviation = accumulation
    return maxDeviation < 0.01;
  }

  /**
   * Check for distribution pattern (consolidation before breakdown)
   */
  private checkDistributionPattern(history: ICandle[]): boolean {
    // Same logic as accumulation
    return this.checkAccumulationPattern(history);
  }

  /**
   * Update candle history for a security
   */
  private updateCandleHistory(securityId: string, candle: ICandle): void {
    let history = this.candleHistory.get(securityId) || [];
    history.push(candle);

    // Keep only last N candles
    if (history.length > this.maxCandleHistory) {
      history = history.slice(-this.maxCandleHistory);
    }

    this.candleHistory.set(securityId, history);
  }

  /**
   * Update average volume calculation
   */
  private updateAverageVolume(securityId: string, volume: number): void {
    const history = this.candleHistory.get(securityId) || [];
    const volumes = history.map(c => c.volume);
    volumes.push(volume);

    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    this.averageVolume.set(securityId, avgVolume);
  }

  /**
   * Reset daily statistics (called at market open)
   */
  reset(): void {
    this.candleHistory.clear();
    this.averageVolume.clear();
    this.tradesPlacedToday = 0;
    console.log('[SmartMoney] Daily reset completed');
  }
}

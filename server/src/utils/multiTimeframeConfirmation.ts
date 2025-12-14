/**
 * Multi-Timeframe Confirmation Utility
 *
 * Implements trend confirmation across multiple timeframes to filter out
 * false breakouts and whipsaws. Only generates signals when multiple timeframes align.
 *
 * Theory:
 * - Higher timeframe (1h) defines overall trend direction
 * - Mid timeframe (15m) confirms trend continuation
 * - Lower timeframe (5m) provides entry timing
 *
 * Alignment Rules:
 * - BULLISH: All timeframes showing upward momentum
 * - BEARISH: All timeframes showing downward momentum
 * - NEUTRAL: Mixed signals = avoid trading
 */

import CandleModel from '../models/Candle';
import { calculateEMA } from './indicators';

export type TrendDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '1d';

export interface MultiTimeframeAnalysis {
  primary: TrendDirection;        // Primary trading timeframe (5m)
  higher: TrendDirection;          // Higher timeframe (1h)
  mid: TrendDirection;             // Mid timeframe (15m)
  isAligned: boolean;              // All timeframes agree
  alignmentScore: number;          // 0-100 (100 = perfect alignment)
  recommendation: 'BUY' | 'SELL' | 'WAIT';
}

/**
 * Analyze trend across multiple timeframes using EMA
 */
export class MultiTimeframeConfirmation {
  private fastPeriod: number = 9;
  private slowPeriod: number = 21;

  /**
   * Get multi-timeframe analysis for a security
   *
   * @param securityId - Security ID to analyze
   * @param primaryTimeframe - Your main trading timeframe (default 5m)
   * @returns Multi-timeframe analysis with alignment
   */
  async analyze(
    securityId: string,
    primaryTimeframe: CandleInterval = '5m'
  ): Promise<MultiTimeframeAnalysis | null> {
    try {
      // Determine higher and mid timeframes based on primary
      const { higher, mid } = this.getTimeframeHierarchy(primaryTimeframe);

      // Get trends for each timeframe
      const [primaryTrend, midTrend, higherTrend] = await Promise.all([
        this.getTrend(securityId, primaryTimeframe),
        this.getTrend(securityId, mid),
        this.getTrend(securityId, higher)
      ]);

      if (!primaryTrend || !midTrend || !higherTrend) {
        console.log('[MultiTF] Insufficient data for multi-timeframe analysis');
        return null;
      }

      // Check alignment
      const isAligned = this.checkAlignment(primaryTrend, midTrend, higherTrend);
      const alignmentScore = this.calculateAlignmentScore(primaryTrend, midTrend, higherTrend);

      // Determine recommendation
      let recommendation: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
      if (isAligned && primaryTrend === 'BULLISH') {
        recommendation = 'BUY';
      } else if (isAligned && primaryTrend === 'BEARISH') {
        recommendation = 'SELL';
      }

      console.log(`[MultiTF] Analysis for ${securityId}:`);
      console.log(`  1h (Higher): ${higherTrend}`);
      console.log(`  ${mid} (Mid): ${midTrend}`);
      console.log(`  ${primaryTimeframe} (Primary): ${primaryTrend}`);
      console.log(`  Alignment: ${isAligned ? '✅ ALIGNED' : '❌ NOT ALIGNED'} (${alignmentScore}%)`);
      console.log(`  Recommendation: ${recommendation}`);

      return {
        primary: primaryTrend,
        higher: higherTrend,
        mid: midTrend,
        isAligned,
        alignmentScore,
        recommendation
      };

    } catch (error) {
      console.error('[MultiTF] Error in multi-timeframe analysis:', error);
      return null;
    }
  }

  /**
   * Determine trend direction for a specific timeframe using EMA crossover
   */
  private async getTrend(
    securityId: string,
    interval: CandleInterval
  ): Promise<TrendDirection | null> {
    try {
      // Fetch last 50 candles for this interval
      const candles = await CandleModel.find({
        securityId,
        interval,
        isClosed: true
      })
        .sort({ timestamp: -1 })
        .limit(50)
        .lean();

      if (candles.length < this.slowPeriod) {
        console.log(`[MultiTF] Insufficient candles for ${interval} (${candles.length}/${this.slowPeriod})`);
        return null;
      }

      // Reverse to chronological order
      candles.reverse();

      // Calculate EMAs
      const closes = candles.map(c => c.close);
      const emaFast = calculateEMA(closes, this.fastPeriod);
      const emaSlow = calculateEMA(closes, this.slowPeriod);

      if (emaFast.length === 0 || emaSlow.length === 0) {
        return null;
      }

      // Get latest values
      const latestFast = emaFast[emaFast.length - 1];
      const latestSlow = emaSlow[emaSlow.length - 1];
      const prevFast = emaFast[emaFast.length - 2];

      // Determine trend
      // BULLISH: Fast EMA > Slow EMA and fast is rising
      if (latestFast > latestSlow && latestFast > prevFast) {
        return 'BULLISH';
      }

      // BEARISH: Fast EMA < Slow EMA and fast is falling
      if (latestFast < latestSlow && latestFast < prevFast) {
        return 'BEARISH';
      }

      // Mixed signals or consolidation
      return 'NEUTRAL';

    } catch (error) {
      console.error(`[MultiTF] Error getting trend for ${interval}:`, error);
      return null;
    }
  }

  /**
   * Check if all timeframes are aligned in the same direction
   */
  private checkAlignment(
    primary: TrendDirection,
    mid: TrendDirection,
    higher: TrendDirection
  ): boolean {
    // Perfect alignment: All bullish or all bearish
    if (primary === 'BULLISH' && mid === 'BULLISH' && higher === 'BULLISH') {
      return true;
    }

    if (primary === 'BEARISH' && mid === 'BEARISH' && higher === 'BEARISH') {
      return true;
    }

    // Partial alignment also acceptable: Higher and mid agree, primary can trade
    // This allows catching entries when higher TF is trending
    if (
      higher !== 'NEUTRAL' &&
      mid === higher &&
      (primary === higher || primary === 'NEUTRAL')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Calculate alignment score (0-100)
   * 100 = All three timeframes perfectly aligned
   * 66 = Two timeframes aligned
   * 33 = One timeframe aligned
   * 0 = No alignment
   */
  private calculateAlignmentScore(
    primary: TrendDirection,
    mid: TrendDirection,
    higher: TrendDirection
  ): number {
    let score = 0;

    // Count how many are bullish or bearish (not neutral)
    const directions = [primary, mid, higher];
    const bullishCount = directions.filter(d => d === 'BULLISH').length;
    const bearishCount = directions.filter(d => d === 'BEARISH').length;

    // Perfect alignment
    if (bullishCount === 3 || bearishCount === 3) {
      return 100;
    }

    // Strong alignment (2 out of 3)
    if (bullishCount === 2 || bearishCount === 2) {
      score = 75;
    }

    // Moderate alignment (1 strong, others neutral)
    if (bullishCount === 1 || bearishCount === 1) {
      score = 50;
    }

    // Add bonus if higher timeframe is not neutral
    if (higher !== 'NEUTRAL') {
      score += 15;
    }

    return Math.min(100, score);
  }

  /**
   * Get timeframe hierarchy based on primary timeframe
   */
  private getTimeframeHierarchy(primary: CandleInterval): {
    higher: CandleInterval;
    mid: CandleInterval;
  } {
    switch (primary) {
      case '1m':
        return { higher: '15m', mid: '5m' };
      case '5m':
        return { higher: '1h', mid: '15m' };
      case '15m':
        return { higher: '1d', mid: '1h' };
      case '1h':
        return { higher: '1d', mid: '1d' }; // For 1h, use same higher TF
      default:
        return { higher: '1h', mid: '15m' };
    }
  }

  /**
   * Quick check if a signal direction is aligned with higher timeframes
   * Returns true if signal can proceed
   */
  async isSignalAligned(
    securityId: string,
    signalType: 'BUY' | 'SELL',
    primaryTimeframe: CandleInterval = '5m'
  ): Promise<boolean> {
    const analysis = await this.analyze(securityId, primaryTimeframe);

    if (!analysis) {
      console.log('[MultiTF] No analysis available, allowing signal by default');
      return true; // Don't block signals if we can't analyze
    }

    // Require alignment for high-quality signals
    if (!analysis.isAligned) {
      console.log(`[MultiTF] ❌ Signal REJECTED: Timeframes not aligned (score: ${analysis.alignmentScore}%)`);
      return false;
    }

    // Check if signal matches recommendation
    if (signalType === 'BUY' && analysis.recommendation !== 'BUY') {
      console.log(`[MultiTF] ❌ BUY signal REJECTED: Recommendation is ${analysis.recommendation}`);
      return false;
    }

    if (signalType === 'SELL' && analysis.recommendation !== 'SELL') {
      console.log(`[MultiTF] ❌ SELL signal REJECTED: Recommendation is ${analysis.recommendation}`);
      return false;
    }

    console.log(`[MultiTF] ✅ Signal APPROVED: ${signalType} aligned with higher timeframes (${analysis.alignmentScore}% alignment)`);
    return true;
  }
}

// Singleton instance
export default new MultiTimeframeConfirmation();

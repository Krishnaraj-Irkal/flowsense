/**
 * Opening Range Breakout (ORB) Strategy with Depth Confirmation
 *
 * Strategy Logic:
 * - Timeframe: 1-minute candles
 * - Opening Range: First 15 minutes (9:15-9:30 AM) high/low
 * - BUY Signal: Price breaks above opening range high + volume spike + strong buying pressure
 * - SELL Signal: Price breaks below opening range low + volume spike + strong selling pressure
 * - Stop Loss: Opposite end of opening range
 * - Target: Opening range height × 2
 * - Max 2 trades per day
 * - Entry window: 9:30 AM - 2:00 PM
 * - Exit all positions by 3:20 PM
 *
 * Market Depth Filters:
 * - Breakout must be confirmed by order book strength in same direction
 * - Only trade when bid-ask imbalance confirms breakout direction
 * - Skip trades during low liquidity (liquidity score < 60)
 * - Volume must be 2x average for breakout confirmation
 */

import { BaseStrategy, Signal } from '../BaseStrategy';
import { ICandle } from '../../models/Candle';
import { MarketDepthMetrics } from '../../utils/marketDepthMetrics';

export class OpeningRangeBreakoutStrategy extends BaseStrategy {
  name = 'Opening Range Breakout with Depth Confirmation';
  timeframe: '1m' = '1m';
  tradingType: 'intraday' = 'intraday';

  // Strategy-specific parameters
  private volumeMultiplier: number = 2.0; // Volume must be 2x average for breakout
  private orderBookStrengthThreshold: number = 1000; // Minimum order book strength for confirmation

  // Opening range tracking
  private openingRangeHigh: number = 0;
  private openingRangeLow: number = 0;
  private openingRangeCaptured: boolean = false;
  private openingRangeHeight: number = 0;

  // Volume tracking for breakout confirmation
  private recentVolumes: number[] = [];

  // Daily limits
  protected maxTradesPerDay: number = 2;

  // Breakout tracking (to avoid multiple signals on same breakout)
  private hasTradedBullish: boolean = false;
  private hasTradedBearish: boolean = false;

  /**
   * Process new 1-minute candle
   *
   * Steps:
   * 1. Capture opening range (9:15-9:30 AM)
   * 2. After 9:30 AM, detect breakouts
   * 3. Validate volume spike (2x average)
   * 4. Validate market depth confirmation
   * 5. Generate signal if all conditions met
   */
  onCandle(candle: ICandle, depthMetrics: MarketDepthMetrics): Signal | null {
    const hour = candle.timestamp.getHours();
    const minute = candle.timestamp.getMinutes();
    const timeInMinutes = hour * 60 + minute;

    // Phase 1: Capture opening range (9:15-9:30 AM)
    if (timeInMinutes >= 9 * 60 + 15 && timeInMinutes <= 9 * 60 + 30) {
      this.captureOpeningRange(candle);
      return null; // No trading during opening range period
    }

    // Wait for opening range to be captured
    if (!this.openingRangeCaptured) {
      return null;
    }

    // Check trading window (9:30 AM - 2:00 PM)
    if (timeInMinutes < 9 * 60 + 30 || timeInMinutes > 14 * 60) {
      return null; // Outside trading window
    }

    // Check max trades per day
    if (!this.canPlaceMoreTrades()) {
      console.log(`[${this.name}] Max trades (${this.maxTradesPerDay}) reached for today`);
      return null;
    }

    // Track volume history for average calculation
    this.recentVolumes.push(candle.volume);
    if (this.recentVolumes.length > 20) {
      this.recentVolumes.shift(); // Keep only last 20 candles
    }

    // Phase 2: Detect breakouts
    return this.detectBreakout(candle, depthMetrics);
  }

  /**
   * Capture opening range (9:15-9:30 AM)
   */
  private captureOpeningRange(candle: ICandle): void {
    if (!this.openingRangeCaptured) {
      // First candle of opening range
      this.openingRangeHigh = candle.high;
      this.openingRangeLow = candle.low;
      console.log(`[${this.name}] Opening range started at ${candle.timestamp.toLocaleTimeString()}`);
    } else {
      // Update range with subsequent candles
      this.openingRangeHigh = Math.max(this.openingRangeHigh, candle.high);
      this.openingRangeLow = Math.min(this.openingRangeLow, candle.low);
    }

    const hour = candle.timestamp.getHours();
    const minute = candle.timestamp.getMinutes();

    // Finalize opening range at 9:30 AM
    if (hour === 9 && minute === 30) {
      this.openingRangeCaptured = true;
      this.openingRangeHeight = this.openingRangeHigh - this.openingRangeLow;
      console.log(`[${this.name}] Opening Range captured: ₹${this.openingRangeLow.toFixed(2)} - ₹${this.openingRangeHigh.toFixed(2)} (Height: ₹${this.openingRangeHeight.toFixed(2)})`);
    }
  }

  /**
   * Detect breakout above/below opening range
   */
  private detectBreakout(candle: ICandle, depthMetrics: MarketDepthMetrics): Signal | null {
    const { close, high, low, volume } = candle;

    // Bullish breakout: Close above opening range high
    if (close > this.openingRangeHigh && !this.hasTradedBullish) {
      console.log(`[${this.name}] Bullish breakout detected: ₹${close.toFixed(2)} > ₹${this.openingRangeHigh.toFixed(2)}`);

      // Validate volume spike
      if (!this.validateVolume(volume)) {
        console.log(`[${this.name}] Bullish breakout rejected: insufficient volume`);
        return null;
      }

      // Validate order book strength (must be positive and strong)
      if (!this.validateOrderBookStrength(depthMetrics.orderBookStrength, 'bullish')) {
        console.log(`[${this.name}] Bullish breakout rejected: weak order book strength (${depthMetrics.orderBookStrength.toFixed(0)})`);
        return null;
      }

      // Generate BUY signal with custom stop loss and target
      const signal = this.generateCustomSignal(
        'BUY',
        close,
        `Breakout above opening range (₹${this.openingRangeHigh.toFixed(2)}) with ${(volume / this.getAverageVolume()).toFixed(1)}x volume spike and strong buying pressure`,
        depthMetrics,
        this.openingRangeLow, // Stop loss at opposite end of range
        close + (this.openingRangeHeight * 2) // Target = 2x range height
      );

      if (signal) {
        this.incrementTradeCounter();
        this.hasTradedBullish = true; // Prevent multiple trades on same breakout
      }

      return signal;
    }

    // Bearish breakout: Close below opening range low
    if (close < this.openingRangeLow && !this.hasTradedBearish) {
      console.log(`[${this.name}] Bearish breakdown detected: ₹${close.toFixed(2)} < ₹${this.openingRangeLow.toFixed(2)}`);

      // Validate volume spike
      if (!this.validateVolume(volume)) {
        console.log(`[${this.name}] Bearish breakdown rejected: insufficient volume`);
        return null;
      }

      // Validate order book strength (must be negative and strong)
      if (!this.validateOrderBookStrength(depthMetrics.orderBookStrength, 'bearish')) {
        console.log(`[${this.name}] Bearish breakdown rejected: weak order book strength (${depthMetrics.orderBookStrength.toFixed(0)})`);
        return null;
      }

      // Generate SELL signal with custom stop loss and target
      const signal = this.generateCustomSignal(
        'SELL',
        close,
        `Breakdown below opening range (₹${this.openingRangeLow.toFixed(2)}) with ${(volume / this.getAverageVolume()).toFixed(1)}x volume spike and strong selling pressure`,
        depthMetrics,
        this.openingRangeHigh, // Stop loss at opposite end of range
        close - (this.openingRangeHeight * 2) // Target = 2x range height
      );

      if (signal) {
        this.incrementTradeCounter();
        this.hasTradedBearish = true; // Prevent multiple trades on same breakout
      }

      return signal;
    }

    return null; // No breakout
  }

  /**
   * Validate volume spike (must be 2x average)
   */
  private validateVolume(currentVolume: number): boolean {
    if (this.recentVolumes.length < 10) {
      return true; // Skip volume check if not enough history
    }

    const avgVolume = this.getAverageVolume();
    const requiredVolume = avgVolume * this.volumeMultiplier;

    if (currentVolume < requiredVolume) {
      console.log(`[${this.name}] Volume too low: ${currentVolume.toLocaleString()} < ${requiredVolume.toLocaleString()} (${this.volumeMultiplier}x avg)`);
      return false;
    }

    console.log(`[${this.name}] ✓ Volume spike confirmed: ${currentVolume.toLocaleString()} = ${(currentVolume / avgVolume).toFixed(1)}x average`);
    return true;
  }

  /**
   * Get average volume from recent candles
   */
  private getAverageVolume(): number {
    if (this.recentVolumes.length === 0) {
      return 0;
    }
    return this.recentVolumes.reduce((sum, v) => sum + v, 0) / this.recentVolumes.length;
  }

  /**
   * Validate order book strength for breakout direction
   */
  private validateOrderBookStrength(orderBookStrength: number, direction: 'bullish' | 'bearish'): boolean {
    const absStrength = Math.abs(orderBookStrength);

    if (absStrength < this.orderBookStrengthThreshold) {
      return false; // Order book too weak
    }

    if (direction === 'bullish' && orderBookStrength < 0) {
      return false; // Bullish breakout needs positive strength
    }

    if (direction === 'bearish' && orderBookStrength > 0) {
      return false; // Bearish breakout needs negative strength
    }

    console.log(`[${this.name}] ✓ Order book strength confirmed: ${orderBookStrength.toFixed(0)} (${direction})`);
    return true;
  }

  /**
   * Generate signal with custom stop loss and target
   *
   * For ORB strategy:
   * - Stop loss = opposite end of opening range
   * - Target = 2x opening range height
   *
   * This overrides the default 1:3 R:R from BaseStrategy
   */
  private generateCustomSignal(
    type: 'BUY' | 'SELL',
    price: number,
    reason: string,
    depthMetrics: MarketDepthMetrics,
    customStopLoss: number,
    customTarget: number
  ): Signal | null {
    // First, validate market depth filters using base class method
    // We'll generate a temporary signal to run through filters
    const tempSignal = this.generateSignal(type, price, reason, depthMetrics);

    if (!tempSignal) {
      return null; // Failed market depth filters
    }

    // Now create custom signal with ORB-specific SL and target
    const quantity = this.calculatePositionSize(price);

    if (quantity === 0) {
      console.log(`[${this.name}] Signal rejected: calculated quantity is 0`);
      return null;
    }

    const signal: Signal = {
      type,
      price,
      reason,
      stopLoss: customStopLoss,
      target: customTarget,
      quantity,
      bidAskImbalance: depthMetrics.bidAskImbalance,
      orderBookStrength: depthMetrics.orderBookStrength,
      liquidityScore: depthMetrics.liquidityScore
    };

    const riskPerUnit = Math.abs(price - customStopLoss);
    const rewardPerUnit = Math.abs(customTarget - price);
    const actualRR = rewardPerUnit / riskPerUnit;

    console.log(`[${this.name}] ✓ Signal generated: ${type} @ ₹${price.toFixed(2)} | SL: ₹${customStopLoss.toFixed(2)} | Target: ₹${customTarget.toFixed(2)} | R:R = 1:${actualRR.toFixed(1)} | Qty: ${quantity}`);

    return signal;
  }

  /**
   * Reset daily state (called at market open)
   */
  public override resetDailyCounter(): void {
    super.resetDailyCounter();
    this.resetDailyState();
  }

  /**
   * Reset all daily tracking (called at market open)
   */
  public resetDailyState(): void {
    this.openingRangeHigh = 0;
    this.openingRangeLow = 0;
    this.openingRangeCaptured = false;
    this.openingRangeHeight = 0;
    this.recentVolumes = [];
    this.hasTradedBullish = false;
    this.hasTradedBearish = false;
    console.log(`[${this.name}] Daily state reset - ready to capture new opening range`);
  }

  /**
   * Get opening range info (for display/logging)
   */
  public getOpeningRange(): {
    high: number;
    low: number;
    height: number;
    captured: boolean;
  } {
    return {
      high: this.openingRangeHigh,
      low: this.openingRangeLow,
      height: this.openingRangeHeight,
      captured: this.openingRangeCaptured
    };
  }
}

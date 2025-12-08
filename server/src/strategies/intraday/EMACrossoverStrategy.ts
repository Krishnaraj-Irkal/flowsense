/**
 * EMA Crossover Strategy with Market Depth Filter
 *
 * Strategy Logic:
 * - Timeframe: 5-minute candles
 * - Indicators: EMA(9), EMA(21)
 * - BUY Signal: EMA(9) crosses above EMA(21) + volume confirmation + strong buying pressure
 * - SELL Signal: EMA(9) crosses below EMA(21) + volume confirmation + strong selling pressure
 * - Stop Loss: 1% from entry
 * - Target: 3% from entry (1:3 risk-reward)
 * - Max 3 trades per day
 * - Trading hours: 9:30 AM - 3:15 PM
 * - Exit all positions by 3:20 PM
 *
 * Market Depth Filters:
 * - Only BUY when bid-ask imbalance > 1.3 (strong institutional buying)
 * - Only SELL when bid-ask imbalance < 0.77 (strong institutional selling)
 * - Skip trades when liquidity score < 60 (low liquidity periods)
 * - Ensure order book strength aligns with signal direction
 */

import { BaseStrategy, Signal } from '../BaseStrategy';
import { ICandle } from '../../models/Candle';
import { MarketDepthMetrics } from '../../utils/marketDepthMetrics';
import { calculateEMA, detectEMACrossover } from '../../utils/indicators';

export class EMACrossoverStrategy extends BaseStrategy {
  name = 'EMA Crossover with Depth Filter';
  timeframe: '5m' = '5m';
  tradingType: 'intraday' = 'intraday';

  // Strategy-specific parameters
  private fastEMAPeriod: number = 9;
  private slowEMAPeriod: number = 21;
  private volumeMultiplier: number = 1.2; // Volume must be 20% above average

  // Historical data storage
  private candleHistory: ICandle[] = [];
  private ema9History: number[] = [];
  private ema21History: number[] = [];

  // Daily limits
  protected maxTradesPerDay: number = 3;

  /**
   * Process new 5-minute candle
   *
   * Steps:
   * 1. Check if trading allowed (time + max trades)
   * 2. Build candle history (need 21 candles for EMA21)
   * 3. Calculate EMA(9) and EMA(21)
   * 4. Detect crossover
   * 5. Validate with volume
   * 6. Validate with market depth
   * 7. Generate signal if all conditions met
   */
  onCandle(candle: ICandle, depthMetrics: MarketDepthMetrics): Signal | null {
    // Check trading hours (9:30 AM - 3:15 PM)
    if (!this.isTradingAllowed(candle.timestamp)) {
      return null;
    }

    // Check max trades per day
    if (!this.canPlaceMoreTrades()) {
      console.log(`[${this.name}] Max trades (${this.maxTradesPerDay}) reached for today`);
      return null;
    }

    // Add candle to history
    this.candleHistory.push(candle);

    // Need at least 21 candles for EMA(21)
    if (this.candleHistory.length < this.slowEMAPeriod) {
      console.log(`[${this.name}] Building history: ${this.candleHistory.length}/${this.slowEMAPeriod} candles`);
      return null;
    }

    // Keep only last 50 candles (memory optimization)
    if (this.candleHistory.length > 50) {
      this.candleHistory.shift();
    }

    // Calculate EMAs
    const closePrices = this.candleHistory.map(c => c.close);
    this.ema9History = calculateEMA(closePrices, this.fastEMAPeriod);
    this.ema21History = calculateEMA(closePrices, this.slowEMAPeriod);

    // Detect crossover
    const crossover = detectEMACrossover(this.ema9History, this.ema21History);

    if (!crossover) {
      return null; // No crossover
    }

    console.log(`[${this.name}] EMA Crossover detected: ${crossover.toUpperCase()}`);

    // Validate volume (must be above average)
    if (!this.validateVolume(candle)) {
      console.log(`[${this.name}] ${crossover} crossover rejected: insufficient volume`);
      return null;
    }

    // Generate signal with market depth filtering
    let signal: Signal | null = null;

    if (crossover === 'bullish') {
      signal = this.generateSignal(
        'BUY',
        candle.close,
        `EMA(${this.fastEMAPeriod}) crossed above EMA(${this.slowEMAPeriod}) with strong bid-ask imbalance and volume confirmation`,
        depthMetrics
      );
    } else if (crossover === 'bearish') {
      signal = this.generateSignal(
        'SELL',
        candle.close,
        `EMA(${this.fastEMAPeriod}) crossed below EMA(${this.slowEMAPeriod}) with strong sell pressure and volume confirmation`,
        depthMetrics
      );
    }

    // If signal generated, increment trade counter
    if (signal) {
      this.incrementTradeCounter();
    }

    return signal;
  }

  /**
   * Validate volume requirement
   *
   * Volume must be at least 20% above 10-candle average
   *
   * @param candle - Current candle
   * @returns true if volume sufficient
   */
  private validateVolume(candle: ICandle): boolean {
    // Need at least 10 candles for average calculation
    if (this.candleHistory.length < 10) {
      return true; // Skip volume check if not enough history
    }

    // Calculate average volume of last 10 candles
    const recentCandles = this.candleHistory.slice(-10);
    const avgVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / recentCandles.length;

    // Current volume must be 20% above average
    const requiredVolume = avgVolume * this.volumeMultiplier;

    if (candle.volume < requiredVolume) {
      console.log(`[${this.name}] Volume too low: ${candle.volume.toLocaleString()} < ${requiredVolume.toLocaleString()} (avg: ${avgVolume.toLocaleString()})`);
      return false;
    }

    console.log(`[${this.name}] ✓ Volume confirmed: ${candle.volume.toLocaleString()} > ${requiredVolume.toLocaleString()}`);
    return true;
  }

  /**
   * Get current EMA values (for display/logging)
   */
  public getCurrentEMAs(): { ema9: number | null; ema21: number | null } {
    return {
      ema9: this.ema9History.length > 0 ? this.ema9History[this.ema9History.length - 1] : null,
      ema21: this.ema21History.length > 0 ? this.ema21History[this.ema21History.length - 1] : null
    };
  }

  /**
   * Reset daily state (called at market open)
   */
  public override resetDailyCounter(): void {
    super.resetDailyCounter();
    // Note: We don't clear candle history as EMA needs continuity
    console.log(`[${this.name}] Daily counter reset. Candle history preserved: ${this.candleHistory.length} candles`);
  }

  /**
   * Clear all historical data (called when reconnecting or restarting)
   */
  public clearHistory(): void {
    this.candleHistory = [];
    this.ema9History = [];
    this.ema21History = [];
    this.tradesPlacedToday = 0;
    console.log(`[${this.name}] History cleared`);
  }
}

/**
 * Base Strategy Abstract Class
 *
 * Foundation for all trading strategies with built-in:
 * - Market depth filtering (bid-ask imbalance, liquidity)
 * - Risk management (1:3 risk-reward ratio)
 * - Position sizing (1% risk per trade)
 * - Signal generation with depth confirmation
 */

import { ICandle } from '../models/Candle';
import { ISignal } from '../models/Signal';
import { MarketDepthMetrics } from '../utils/marketDepthMetrics';

export interface Signal {
  type: 'BUY' | 'SELL';
  price: number;
  reason: string;
  stopLoss: number;
  target: number;
  quantity: number;
  bidAskImbalance: number;
  orderBookStrength: number;
  liquidityScore: number;
}

export abstract class BaseStrategy {
  abstract name: string;
  abstract timeframe: '1m' | '5m' | '15m' | '1h' | '1d';
  abstract tradingType: 'intraday' | 'swing';

  // Market depth thresholds for filtering signals
  protected minBidAskImbalanceBuy: number = 1.3;   // Strong buying pressure
  protected maxBidAskImbalanceSell: number = 0.77; // Strong selling pressure (1/1.3)
  protected minLiquidityScore: number = 60;        // Minimum liquidity to trade

  // Risk parameters (1:3 risk-reward ratio)
  protected riskPercentage: number = 1;      // 1% risk per trade
  protected riskRewardRatio: number = 3;     // 1:3 R:R
  protected stopLossPercentage: number = 1;  // 1% stop loss
  protected targetPercentage: number = 3;    // 3% target

  // Trading capital
  protected totalCapital: number = 20000; // ₹20,000

  // Daily limits (for intraday strategies)
  protected maxTradesPerDay?: number;
  protected tradesPlacedToday: number = 0;

  /**
   * Abstract method to be implemented by each strategy
   * Called when a new candle closes
   *
   * @param candle - The closed candle with OHLC data
   * @param depthMetrics - Market depth metrics averaged over candle period
   * @returns Signal object if conditions met, null otherwise
   */
  abstract onCandle(candle: ICandle, depthMetrics: MarketDepthMetrics): Signal | null;

  /**
   * Generate a trading signal with market depth filtering
   *
   * This method enforces:
   * 1. Bid-ask imbalance thresholds (only trade with strong pressure)
   * 2. Liquidity requirements (avoid low liquidity periods)
   * 3. Position sizing based on risk percentage
   * 4. Stop loss and target calculation (1:3 R:R)
   *
   * @param type - BUY or SELL
   * @param price - Entry price
   * @param reason - Why this signal was generated
   * @param depthMetrics - Current market depth metrics
   * @returns Signal object if all filters pass, null if rejected
   */
  protected generateSignal(
    type: 'BUY' | 'SELL',
    price: number,
    reason: string,
    depthMetrics: MarketDepthMetrics
  ): Signal | null {
    // Filter 1: Check bid-ask imbalance
    if (type === 'BUY') {
      if (depthMetrics.bidAskImbalance < this.minBidAskImbalanceBuy) {
        console.log(`[${this.name}] BUY signal rejected: weak bid-ask imbalance (${depthMetrics.bidAskImbalance.toFixed(2)} < ${this.minBidAskImbalanceBuy})`);
        return null;
      }
    } else {
      if (depthMetrics.bidAskImbalance > this.maxBidAskImbalanceSell) {
        console.log(`[${this.name}] SELL signal rejected: weak bid-ask imbalance (${depthMetrics.bidAskImbalance.toFixed(2)} > ${this.maxBidAskImbalanceSell})`);
        return null;
      }
    }

    // Filter 2: Check liquidity
    if (depthMetrics.liquidityScore < this.minLiquidityScore) {
      console.log(`[${this.name}] Signal rejected: low liquidity (${depthMetrics.liquidityScore.toFixed(0)} < ${this.minLiquidityScore})`);
      return null;
    }

    // Filter 3: Check order book strength alignment
    if (type === 'BUY' && depthMetrics.orderBookStrength < 0) {
      console.log(`[${this.name}] BUY signal rejected: negative order book strength (${depthMetrics.orderBookStrength.toFixed(0)})`);
      return null;
    }

    if (type === 'SELL' && depthMetrics.orderBookStrength > 0) {
      console.log(`[${this.name}] SELL signal rejected: positive order book strength (${depthMetrics.orderBookStrength.toFixed(0)})`);
      return null;
    }

    // Calculate position size (1% risk)
    const quantity = this.calculatePositionSize(price);

    if (quantity === 0) {
      console.log(`[${this.name}] Signal rejected: calculated quantity is 0`);
      return null;
    }

    // Calculate stop loss and target (1:3 R:R)
    const stopLoss = this.calculateStopLoss(type, price);
    const target = this.calculateTarget(type, price);

    // All filters passed - generate signal
    console.log(`[${this.name}] ✓ Signal generated: ${type} @ ₹${price.toFixed(2)} | SL: ₹${stopLoss.toFixed(2)} | Target: ₹${target.toFixed(2)} | Qty: ${quantity}`);

    return {
      type,
      price,
      reason,
      stopLoss,
      target,
      quantity,
      bidAskImbalance: depthMetrics.bidAskImbalance,
      orderBookStrength: depthMetrics.orderBookStrength,
      liquidityScore: depthMetrics.liquidityScore
    };
  }

  /**
   * Calculate position size based on risk percentage
   *
   * Formula: Quantity = (Risk Amount) / (Stop Loss Amount per unit)
   *
   * Example:
   * - Capital: ₹20,000
   * - Risk: 1% = ₹200
   * - Entry: ₹19,500
   * - Stop Loss: 1% = ₹19,305 (₹195 per unit)
   * - Quantity: ₹200 / ₹195 = 1.02 → Rounded to 1 lot (75 units)
   *
   * @param price - Entry price
   * @returns Quantity rounded to Nifty lot size (75)
   */
  protected calculatePositionSize(price: number): number {
    const riskAmount = this.totalCapital * (this.riskPercentage / 100); // ₹200
    const stopLossAmountPerUnit = price * (this.stopLossPercentage / 100); // ₹195

    // Quantity = Risk Amount / Stop Loss Amount per share
    const rawQuantity = riskAmount / stopLossAmountPerUnit;

    // Nifty 50 lot size = 75
    const lotSize = 75;

    // Round to nearest lot (minimum 1 lot)
    const lots = Math.max(1, Math.floor(rawQuantity / lotSize));
    const quantity = lots * lotSize;

    console.log(`[${this.name}] Position sizing: Risk=₹${riskAmount.toFixed(2)} | SL per unit=₹${stopLossAmountPerUnit.toFixed(2)} | Qty=${quantity} (${lots} lot${lots > 1 ? 's' : ''})`);

    return quantity;
  }

  /**
   * Calculate stop loss price
   *
   * For BUY: Stop loss is 1% below entry
   * For SELL: Stop loss is 1% above entry
   *
   * @param type - BUY or SELL
   * @param price - Entry price
   * @returns Stop loss price
   */
  protected calculateStopLoss(type: 'BUY' | 'SELL', price: number): number {
    if (type === 'BUY') {
      return price * (1 - this.stopLossPercentage / 100);
    } else {
      return price * (1 + this.stopLossPercentage / 100);
    }
  }

  /**
   * Calculate target price
   *
   * For BUY: Target is 3% above entry (1:3 R:R)
   * For SELL: Target is 3% below entry (1:3 R:R)
   *
   * @param type - BUY or SELL
   * @param price - Entry price
   * @returns Target price
   */
  protected calculateTarget(type: 'BUY' | 'SELL', price: number): number {
    if (type === 'BUY') {
      return price * (1 + this.targetPercentage / 100);
    } else {
      return price * (1 - this.targetPercentage / 100);
    }
  }

  /**
   * Check if trading is allowed at current time
   *
   * For intraday strategies:
   * - Market hours: 9:15 AM - 3:30 PM
   * - Entry window: 9:30 AM - 3:15 PM (avoid first 15 min and last 15 min)
   *
   * For swing strategies:
   * - No time restrictions
   *
   * @param timestamp - Current timestamp
   * @returns true if trading allowed
   */
  protected isTradingAllowed(timestamp: Date): boolean {
    if (this.tradingType === 'swing') {
      return true; // Swing trading has no time restrictions
    }

    // Intraday: Check market hours
    const hours = timestamp.getHours();
    const minutes = timestamp.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    const marketOpenTime = 9 * 60 + 30; // 9:30 AM
    const marketCloseTime = 15 * 60 + 15; // 3:15 PM

    return timeInMinutes >= marketOpenTime && timeInMinutes <= marketCloseTime;
  }

  /**
   * Check if max trades per day limit reached
   *
   * @returns true if more trades allowed
   */
  protected canPlaceMoreTrades(): boolean {
    if (this.maxTradesPerDay === undefined) {
      return true; // No limit
    }

    return this.tradesPlacedToday < this.maxTradesPerDay;
  }

  /**
   * Increment daily trade counter
   */
  protected incrementTradeCounter(): void {
    this.tradesPlacedToday++;
  }

  /**
   * Reset daily trade counter (called at market open)
   */
  public resetDailyCounter(): void {
    this.tradesPlacedToday = 0;
    console.log(`[${this.name}] Daily trade counter reset`);
  }

  /**
   * Get strategy status
   */
  public getStatus(): {
    name: string;
    timeframe: string;
    tradingType: string;
    tradesPlacedToday: number;
    maxTradesPerDay?: number;
  } {
    return {
      name: this.name,
      timeframe: this.timeframe,
      tradingType: this.tradingType,
      tradesPlacedToday: this.tradesPlacedToday,
      maxTradesPerDay: this.maxTradesPerDay
    };
  }
}

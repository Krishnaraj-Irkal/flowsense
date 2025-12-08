/**
 * Technical Indicators Utility
 *
 * Provides functions to calculate various technical indicators:
 * - Simple Moving Average (SMA)
 * - Exponential Moving Average (EMA)
 * - Relative Strength Index (RSI)
 * - Average True Range (ATR)
 * - Bollinger Bands
 * - MACD
 * - Candlestick pattern detection
 */

import { ICandle } from '../models/Candle';

/**
 * Simple Moving Average (SMA)
 * Average of last N prices
 */
export function calculateSMA(prices: number[], period: number): number[] {
  if (prices.length < period) {
    return [];
  }

  const sma: number[] = [];

  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }

  return sma;
}

/**
 * Exponential Moving Average (EMA)
 * Weighted average giving more importance to recent prices
 */
export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length < period) {
    return [];
  }

  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  // First EMA is SMA
  const firstSMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  ema.push(firstSMA);

  // Calculate EMA for remaining prices
  for (let i = period; i < prices.length; i++) {
    const currentEMA = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(currentEMA);
  }

  return ema;
}

/**
 * Relative Strength Index (RSI)
 * Momentum oscillator (0-100)
 * > 70 = Overbought
 * < 30 = Oversold
 */
export function calculateRSI(prices: number[], period: number = 14): number[] {
  if (prices.length < period + 1) {
    return [];
  }

  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate price changes
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  // Calculate first average gain and loss (SMA)
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Calculate first RSI
  let rs = avgGain / avgLoss;
  rsi.push(100 - (100 / (1 + rs)));

  // Calculate subsequent RSI using smoothed averages
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }

  return rsi;
}

/**
 * Average True Range (ATR)
 * Volatility indicator
 */
export function calculateATR(candles: ICandle[], period: number = 14): number[] {
  if (candles.length < period + 1) {
    return [];
  }

  const trueRanges: number[] = [];

  // Calculate True Range for each candle
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );

    trueRanges.push(tr);
  }

  // Calculate ATR using SMA of True Ranges
  const atr: number[] = [];

  for (let i = period - 1; i < trueRanges.length; i++) {
    const sum = trueRanges.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    atr.push(sum / period);
  }

  return atr;
}

/**
 * Bollinger Bands
 * Volatility bands around SMA
 */
export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): {
  upper: number[];
  middle: number[];
  lower: number[];
} {
  if (prices.length < period) {
    return { upper: [], middle: [], lower: [] };
  }

  const middle = calculateSMA(prices, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const sma = slice.reduce((a, b) => a + b, 0) / period;

    // Calculate standard deviation
    const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    upper.push(sma + stdDevMultiplier * stdDev);
    lower.push(sma - stdDevMultiplier * stdDev);
  }

  return { upper, middle, lower };
}

/**
 * MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  macd: number[];
  signal: number[];
  histogram: number[];
} {
  if (prices.length < slowPeriod) {
    return { macd: [], signal: [], histogram: [] };
  }

  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);

  // Calculate MACD line
  const macd: number[] = [];
  const offset = slowPeriod - fastPeriod;

  for (let i = 0; i < slowEMA.length; i++) {
    macd.push(fastEMA[i + offset] - slowEMA[i]);
  }

  // Calculate signal line (EMA of MACD)
  const signal = calculateEMA(macd, signalPeriod);

  // Calculate histogram
  const histogram: number[] = [];
  const signalOffset = macd.length - signal.length;

  for (let i = 0; i < signal.length; i++) {
    histogram.push(macd[i + signalOffset] - signal[i]);
  }

  return { macd, signal, histogram };
}

/**
 * Detect EMA Crossover
 * Returns 'bullish' when fast EMA crosses above slow EMA
 * Returns 'bearish' when fast EMA crosses below slow EMA
 */
export function detectEMACrossover(
  fastEMA: number[],
  slowEMA: number[]
): 'bullish' | 'bearish' | null {
  if (fastEMA.length < 2 || slowEMA.length < 2) {
    return null;
  }

  const currentFast = fastEMA[fastEMA.length - 1];
  const prevFast = fastEMA[fastEMA.length - 2];
  const currentSlow = slowEMA[slowEMA.length - 1];
  const prevSlow = slowEMA[slowEMA.length - 2];

  // Bullish crossover: fast crosses above slow
  if (prevFast <= prevSlow && currentFast > currentSlow) {
    return 'bullish';
  }

  // Bearish crossover: fast crosses below slow
  if (prevFast >= prevSlow && currentFast < currentSlow) {
    return 'bearish';
  }

  return null;
}

/**
 * Detect candlestick patterns
 */
export function detectCandlestickPattern(candles: ICandle[]): {
  hammer: boolean;
  shootingStar: boolean;
  doji: boolean;
  bullishEngulfing: boolean;
  bearishEngulfing: boolean;
} {
  if (candles.length < 2) {
    return {
      hammer: false,
      shootingStar: false,
      doji: false,
      bullishEngulfing: false,
      bearishEngulfing: false
    };
  }

  const current = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  const body = Math.abs(current.close - current.open);
  const upperShadow = current.high - Math.max(current.open, current.close);
  const lowerShadow = Math.min(current.open, current.close) - current.low;
  const totalRange = current.high - current.low;

  // Hammer: Small body at top, long lower shadow
  const hammer = body < totalRange * 0.3 && lowerShadow > body * 2 && upperShadow < body;

  // Shooting Star: Small body at bottom, long upper shadow
  const shootingStar = body < totalRange * 0.3 && upperShadow > body * 2 && lowerShadow < body;

  // Doji: Very small body (open ≈ close)
  const doji = body < totalRange * 0.1;

  // Bullish Engulfing: Current bullish candle engulfs previous bearish
  const bullishEngulfing =
    current.close > current.open && // Current is bullish
    prev.close < prev.open && // Previous is bearish
    current.open < prev.close && // Current opens below prev close
    current.close > prev.open; // Current closes above prev open

  // Bearish Engulfing: Current bearish candle engulfs previous bullish
  const bearishEngulfing =
    current.close < current.open && // Current is bearish
    prev.close > prev.open && // Previous is bullish
    current.open > prev.close && // Current opens above prev close
    current.close < prev.open; // Current closes below prev open

  return {
    hammer,
    shootingStar,
    doji,
    bullishEngulfing,
    bearishEngulfing
  };
}

/**
 * Find support and resistance levels
 * Uses pivot points method
 */
export function findSupportResistance(candles: ICandle[], lookback: number = 20): {
  support: number[];
  resistance: number[];
  pivot: number;
} {
  if (candles.length < lookback) {
    return { support: [], resistance: [], pivot: 0 };
  }

  const recentCandles = candles.slice(-lookback);

  // Calculate pivot point (average of high, low, close)
  const lastCandle = recentCandles[recentCandles.length - 1];
  const pivot = (lastCandle.high + lastCandle.low + lastCandle.close) / 3;

  // Find local highs (resistance)
  const resistance: number[] = [];
  for (let i = 1; i < recentCandles.length - 1; i++) {
    const candle = recentCandles[i];
    const prevHigh = recentCandles[i - 1].high;
    const nextHigh = recentCandles[i + 1].high;

    if (candle.high > prevHigh && candle.high > nextHigh) {
      resistance.push(candle.high);
    }
  }

  // Find local lows (support)
  const support: number[] = [];
  for (let i = 1; i < recentCandles.length - 1; i++) {
    const candle = recentCandles[i];
    const prevLow = recentCandles[i - 1].low;
    const nextLow = recentCandles[i + 1].low;

    if (candle.low < prevLow && candle.low < nextLow) {
      support.push(candle.low);
    }
  }

  // Sort and deduplicate
  const uniqueSupport = Array.from(new Set(support)).sort((a, b) => b - a);
  const uniqueResistance = Array.from(new Set(resistance)).sort((a, b) => a - b);

  return {
    support: uniqueSupport.slice(0, 3), // Top 3 support levels
    resistance: uniqueResistance.slice(0, 3), // Top 3 resistance levels
    pivot
  };
}

/**
 * Calculate ADX (Average Directional Index)
 * Trend strength indicator
 * > 25 = Strong trend
 * < 20 = Weak trend
 */
export function calculateADX(candles: ICandle[], period: number = 14): number[] {
  if (candles.length < period + 1) {
    return [];
  }

  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];

  // Calculate +DM, -DM, and TR
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevHigh = candles[i - 1].high;
    const prevLow = candles[i - 1].low;
    const prevClose = candles[i - 1].close;

    const upMove = high - prevHigh;
    const downMove = prevLow - low;

    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);

    tr.push(Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    ));
  }

  // Smooth +DM, -DM, TR
  const smoothPlusDM: number[] = [];
  const smoothMinusDM: number[] = [];
  const smoothTR: number[] = [];

  for (let i = period - 1; i < plusDM.length; i++) {
    smoothPlusDM.push(plusDM.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0));
    smoothMinusDM.push(minusDM.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0));
    smoothTR.push(tr.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0));
  }

  // Calculate +DI and -DI
  const plusDI = smoothPlusDM.map((dm, i) => (dm / smoothTR[i]) * 100);
  const minusDI = smoothMinusDM.map((dm, i) => (dm / smoothTR[i]) * 100);

  // Calculate DX
  const dx = plusDI.map((pdi, i) => {
    const sum = pdi + minusDI[i];
    const diff = Math.abs(pdi - minusDI[i]);
    return sum === 0 ? 0 : (diff / sum) * 100;
  });

  // Calculate ADX (smoothed DX)
  const adx: number[] = [];
  for (let i = period - 1; i < dx.length; i++) {
    const sum = dx.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    adx.push(sum / period);
  }

  return adx;
}

/**
 * Helper: Get latest value from indicator array
 */
export function getLatestValue(values: number[]): number | null {
  return values.length > 0 ? values[values.length - 1] : null;
}

/**
 * Helper: Check if price is near a level (within tolerance)
 */
export function isNearLevel(price: number, level: number, tolerance: number = 0.005): boolean {
  const diff = Math.abs(price - level) / level;
  return diff <= tolerance; // Within 0.5% by default
}

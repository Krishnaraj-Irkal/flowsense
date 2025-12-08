/**
 * Market Depth Metrics Calculator
 *
 * Calculates aggregate metrics from market depth data to identify:
 * - Institutional buying/selling pressure
 * - Liquidity conditions
 * - Order book strength
 * - Volume trends
 */

import { FullPacket, MarketDepthLevel } from './binaryParser';

export interface MarketDepthMetrics {
  bidAskImbalance: number;      // Total bid qty / total ask qty
  depthSpread: number;          // (Best ask - best bid) / LTP (percentage)
  orderBookStrength: number;    // Weighted bid qty - weighted ask qty
  volumeDelta: number;          // Change in buy/sell qty (set externally)
  liquidityScore: number;       // 0-100 score (100 = highly liquid)
}

// Weights for different depth levels (Level 1 has most weight)
const DEPTH_WEIGHTS = [5, 4, 3, 2, 1];

// Store recent depth data for volume delta calculation
interface DepthHistory {
  timestamp: number;
  totalBuyQty: number;
  totalSellQty: number;
}

const depthHistoryMap = new Map<string, DepthHistory[]>();
const HISTORY_SIZE = 5; // Track last 5 ticks for delta

/**
 * Calculate bid-ask imbalance ratio
 * > 1.5 = Strong buying pressure (institutions accumulating)
 * < 0.67 = Strong selling pressure (institutions distributing)
 * ~1.0 = Neutral
 */
function calculateBidAskImbalance(marketDepth: MarketDepthLevel[]): number {
  const totalBidQty = marketDepth.reduce((sum, level) => sum + level.bidQty, 0);
  const totalAskQty = marketDepth.reduce((sum, level) => sum + level.askQty, 0);

  if (totalAskQty === 0) return 10; // Extreme buying (avoid division by zero)
  return totalBidQty / totalAskQty;
}

/**
 * Calculate depth spread (bid-ask spread as % of LTP)
 * < 0.05% = Tight spread, high liquidity
 * > 0.15% = Wide spread, low liquidity
 */
function calculateDepthSpread(marketDepth: MarketDepthLevel[], ltp: number): number {
  if (marketDepth.length === 0 || ltp === 0) return 0;

  const bestBid = marketDepth[0].bidPrice;
  const bestAsk = marketDepth[0].askPrice;

  if (bestAsk === 0 || bestBid === 0) return 0;

  const spread = bestAsk - bestBid;
  return spread / ltp; // Returns decimal (0.0005 = 0.05%)
}

/**
 * Calculate weighted order book strength
 * Positive = More buying pressure
 * Negative = More selling pressure
 * Uses weighted sum (Level 1 has 5x weight of Level 5)
 */
function calculateOrderBookStrength(marketDepth: MarketDepthLevel[]): number {
  let weightedBidQty = 0;
  let weightedAskQty = 0;

  for (let i = 0; i < marketDepth.length && i < DEPTH_WEIGHTS.length; i++) {
    const weight = DEPTH_WEIGHTS[i];
    weightedBidQty += marketDepth[i].bidQty * weight;
    weightedAskQty += marketDepth[i].askQty * weight;
  }

  return weightedBidQty - weightedAskQty;
}

/**
 * Calculate volume delta (change in buy/sell quantity over last 5 ticks)
 * Positive = Accumulation
 * Negative = Distribution
 */
function calculateVolumeDelta(
  securityId: string,
  totalBuyQty: number,
  totalSellQty: number
): number {
  // Get or create history for this security
  if (!depthHistoryMap.has(securityId)) {
    depthHistoryMap.set(securityId, []);
  }

  const history = depthHistoryMap.get(securityId)!;

  // Add current data point
  history.push({
    timestamp: Date.now(),
    totalBuyQty,
    totalSellQty
  });

  // Keep only last HISTORY_SIZE entries
  if (history.length > HISTORY_SIZE) {
    history.shift();
  }

  // Need at least 2 data points to calculate delta
  if (history.length < 2) {
    return 0;
  }

  // Calculate delta from oldest to newest
  const oldest = history[0];
  const newest = history[history.length - 1];

  const buyDelta = newest.totalBuyQty - oldest.totalBuyQty;
  const sellDelta = newest.totalSellQty - oldest.totalSellQty;

  return buyDelta - sellDelta;
}

/**
 * Calculate liquidity score (0-100)
 * Based on:
 * - Total order book quantity
 * - Depth spread
 * - Number of orders at each level
 *
 * 80-100 = High liquidity (safe to trade)
 * 60-80 = Medium liquidity
 * < 60 = Low liquidity (avoid trading)
 */
function calculateLiquidityScore(
  marketDepth: MarketDepthLevel[],
  depthSpread: number
): number {
  let score = 100;

  // Factor 1: Depth spread penalty
  // Wide spread (>0.15%) = poor liquidity
  if (depthSpread > 0.0015) {
    score -= 30;
  } else if (depthSpread > 0.001) {
    score -= 20;
  } else if (depthSpread > 0.0005) {
    score -= 10;
  }

  // Factor 2: Total quantity in order book
  const totalQty = marketDepth.reduce(
    (sum, level) => sum + level.bidQty + level.askQty,
    0
  );

  // Normalize quantity (assuming < 10,000 is low, > 100,000 is high for Nifty)
  if (totalQty < 10000) {
    score -= 25;
  } else if (totalQty < 50000) {
    score -= 10;
  }

  // Factor 3: Number of orders (more orders = better liquidity)
  const avgOrders = marketDepth.reduce(
    (sum, level) => sum + level.bidOrders + level.askOrders,
    0
  ) / (marketDepth.length * 2);

  if (avgOrders < 10) {
    score -= 15;
  } else if (avgOrders < 20) {
    score -= 5;
  }

  // Clamp between 0-100
  return Math.max(0, Math.min(100, score));
}

/**
 * Main function: Calculate all market depth metrics from a Full Packet
 */
export function calculateDepthMetrics(
  packet: FullPacket
): MarketDepthMetrics {
  const { marketDepth, ltp, securityId, totalBuyQty, totalSellQty } = packet;

  // Calculate all metrics
  const bidAskImbalance = calculateBidAskImbalance(marketDepth);
  const depthSpread = calculateDepthSpread(marketDepth, ltp);
  const orderBookStrength = calculateOrderBookStrength(marketDepth);
  const volumeDelta = calculateVolumeDelta(
    securityId,
    totalBuyQty,
    totalSellQty
  );
  const liquidityScore = calculateLiquidityScore(marketDepth, depthSpread);

  return {
    bidAskImbalance,
    depthSpread,
    orderBookStrength,
    volumeDelta,
    liquidityScore
  };
}

/**
 * Interpret bid-ask imbalance
 */
export function interpretBidAskImbalance(imbalance: number): string {
  if (imbalance > 1.5) return 'Strong Buying';
  if (imbalance > 1.3) return 'Buying Pressure';
  if (imbalance > 1.1) return 'Slight Buying';
  if (imbalance > 0.9) return 'Neutral';
  if (imbalance > 0.77) return 'Slight Selling';
  if (imbalance > 0.67) return 'Selling Pressure';
  return 'Strong Selling';
}

/**
 * Interpret liquidity score
 */
export function interpretLiquidityScore(score: number): string {
  if (score > 80) return 'High Liquidity';
  if (score > 60) return 'Medium Liquidity';
  if (score > 40) return 'Low Liquidity';
  return 'Very Low Liquidity';
}

/**
 * Interpret order book strength
 */
export function interpretOrderBookStrength(strength: number): string {
  if (strength > 10000) return 'Strong Institutional Buying';
  if (strength > 5000) return 'Institutional Buying';
  if (strength > 0) return 'Buying Pressure';
  if (strength > -5000) return 'Selling Pressure';
  if (strength > -10000) return 'Institutional Selling';
  return 'Strong Institutional Selling';
}

/**
 * Check if market conditions are favorable for trading
 */
export function isTradingConditionsFavorable(
  metrics: MarketDepthMetrics,
  signalType: 'BUY' | 'SELL'
): { favorable: boolean; reason: string } {
  // Check liquidity first
  if (metrics.liquidityScore < 60) {
    return {
      favorable: false,
      reason: `Low liquidity (score: ${metrics.liquidityScore.toFixed(0)})`
    };
  }

  // Check bid-ask imbalance alignment with signal
  if (signalType === 'BUY') {
    if (metrics.bidAskImbalance < 1.3) {
      return {
        favorable: false,
        reason: `Weak buying pressure (imbalance: ${metrics.bidAskImbalance.toFixed(2)})`
      };
    }
  } else {
    if (metrics.bidAskImbalance > 0.77) {
      return {
        favorable: false,
        reason: `Weak selling pressure (imbalance: ${metrics.bidAskImbalance.toFixed(2)})`
      };
    }
  }

  // Check order book strength alignment
  if (signalType === 'BUY' && metrics.orderBookStrength < 0) {
    return {
      favorable: false,
      reason: 'Order book shows selling pressure'
    };
  }

  if (signalType === 'SELL' && metrics.orderBookStrength > 0) {
    return {
      favorable: false,
      reason: 'Order book shows buying pressure'
    };
  }

  return {
    favorable: true,
    reason: 'Favorable market conditions'
  };
}

/**
 * Clear depth history for a specific security (e.g., at market close)
 */
export function clearDepthHistory(securityId: string): void {
  depthHistoryMap.delete(securityId);
}

/**
 * Clear all depth history (e.g., at end of day)
 */
export function clearAllDepthHistory(): void {
  depthHistoryMap.clear();
}

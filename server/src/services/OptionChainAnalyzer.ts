/**
 * Option Chain Analyzer
 *
 * Fetches and analyzes option chain data from Dhan API for:
 * - Open Interest (OI) analysis
 * - Volume accumulation detection
 * - Greeks-based directional bias
 * - Put/Call ratio analysis
 * - Max pain calculation
 *
 * Rate limit: 1 call per 3 seconds per instrument
 */

import axios from 'axios';
import { EventEmitter } from 'events';

// Option strike data
export interface OptionStrike {
  strikePrice: number;

  // Call option data
  call: {
    ltp: number;
    oi: number;
    oiChange: number;
    volume: number;
    bidPrice: number;
    bidQty: number;
    askPrice: number;
    askQty: number;
    iv: number;  // Implied volatility
    delta: number;
    theta: number;
    gamma: number;
    vega: number;
  };

  // Put option data
  put: {
    ltp: number;
    oi: number;
    oiChange: number;
    volume: number;
    bidPrice: number;
    bidQty: number;
    askPrice: number;
    askQty: number;
    iv: number;
    delta: number;
    theta: number;
    gamma: number;
    vega: number;
  };
}

// Option chain analytics
export interface OptionChainAnalytics {
  underlyingSecurityId: string;
  underlyingLTP: number;
  expiry: string;
  timestamp: Date;

  // Open Interest analysis
  totalCallOI: number;
  totalPutOI: number;
  putCallRatioOI: number;  // Put OI / Call OI

  // Volume analysis
  totalCallVolume: number;
  totalPutVolume: number;
  putCallRatioVolume: number;  // Put Volume / Call Volume

  // OI change analysis
  callOIChange: number;
  putOIChange: number;

  // Max pain (strike with maximum seller pain)
  maxPain: number;

  // Support and resistance from OI
  strongestCallWall: number;  // Strike with highest call OI
  strongestPutWall: number;   // Strike with highest put OI

  // Volume accumulation zones
  maxCallVolumeStrike: number;
  maxPutVolumeStrike: number;

  // Directional bias from OI + volume
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  sentimentStrength: number; // 0-100

  // Greeks aggregation
  netDelta: number;  // Positive = bullish, Negative = bearish
}

interface OptionChainResponse {
  data: {
    optionChain: OptionStrike[];
    underlyingValue: number;
  };
}

class OptionChainAnalyzer extends EventEmitter {
  private baseUrl: string = 'https://api.dhan.co';
  private accessToken: string = '';

  // Rate limiting: 1 call per 3 seconds
  private lastFetchTime: Map<string, number> = new Map();
  private minFetchInterval: number = 3000; // 3 seconds

  // Cache for option chain data
  private optionChainCache: Map<string, { data: OptionStrike[]; timestamp: Date }> = new Map();

  /**
   * Initialize with Dhan access token
   */
  initialize(accessToken: string): void {
    this.accessToken = accessToken;
    console.log('[OptionChain] Initialized with access token');
  }

  /**
   * Fetch option chain for an underlying instrument
   */
  async fetchOptionChain(
    underlyingSecurityId: string,
    underlyingSegment: string,
    expiry: string
  ): Promise<OptionStrike[]> {
    const cacheKey = `${underlyingSecurityId}_${expiry}`;

    // Rate limiting check
    const lastFetch = this.lastFetchTime.get(cacheKey) || 0;
    const now = Date.now();
    if (now - lastFetch < this.minFetchInterval) {
      console.log(`[OptionChain] Rate limit: waiting ${this.minFetchInterval - (now - lastFetch)}ms`);
      // Return cached data if available
      const cached = this.optionChainCache.get(cacheKey);
      if (cached) {
        return cached.data;
      }
      throw new Error('Rate limit: Please wait 3 seconds between calls');
    }

    try {
      console.log(`[OptionChain] Fetching option chain for ${underlyingSecurityId}, expiry: ${expiry}`);

      const response = await axios.post<OptionChainResponse>(
        `${this.baseUrl}/v2/optionchain`,
        {
          UnderlyingScrip: parseInt(underlyingSecurityId),
          UnderlyingSeg: underlyingSegment,
          Expiry: expiry
        },
        {
          headers: {
            'access-token': this.accessToken,
            'Content-Type': 'application/json'
          }
        }
      );

      this.lastFetchTime.set(cacheKey, now);

      const optionChain = response.data.data.optionChain;

      // Cache the data
      this.optionChainCache.set(cacheKey, {
        data: optionChain,
        timestamp: new Date()
      });

      console.log(`[OptionChain] ✅ Fetched ${optionChain.length} strikes`);

      return optionChain;
    } catch (error: any) {
      console.error('[OptionChain] Error fetching option chain:', error.message);
      throw error;
    }
  }

  /**
   * Analyze option chain and generate analytics
   */
  async analyzeOptionChain(
    underlyingSecurityId: string,
    underlyingSegment: string,
    expiry: string,
    underlyingLTP: number
  ): Promise<OptionChainAnalytics> {
    const optionChain = await this.fetchOptionChain(underlyingSecurityId, underlyingSegment, expiry);

    const analytics: OptionChainAnalytics = {
      underlyingSecurityId,
      underlyingLTP,
      expiry,
      timestamp: new Date(),

      totalCallOI: 0,
      totalPutOI: 0,
      putCallRatioOI: 0,

      totalCallVolume: 0,
      totalPutVolume: 0,
      putCallRatioVolume: 0,

      callOIChange: 0,
      putOIChange: 0,

      maxPain: 0,
      strongestCallWall: 0,
      strongestPutWall: 0,

      maxCallVolumeStrike: 0,
      maxPutVolumeStrike: 0,

      sentiment: 'NEUTRAL',
      sentimentStrength: 0,

      netDelta: 0
    };

    let maxCallOI = 0;
    let maxPutOI = 0;
    let maxCallVolume = 0;
    let maxPutVolume = 0;

    // Analyze each strike
    for (const strike of optionChain) {
      // Accumulate totals
      analytics.totalCallOI += strike.call.oi;
      analytics.totalPutOI += strike.put.oi;

      analytics.totalCallVolume += strike.call.volume;
      analytics.totalPutVolume += strike.put.volume;

      analytics.callOIChange += strike.call.oiChange;
      analytics.putOIChange += strike.put.oiChange;

      // Track max OI strikes
      if (strike.call.oi > maxCallOI) {
        maxCallOI = strike.call.oi;
        analytics.strongestCallWall = strike.strikePrice;
      }

      if (strike.put.oi > maxPutOI) {
        maxPutOI = strike.put.oi;
        analytics.strongestPutWall = strike.strikePrice;
      }

      // Track max volume strikes
      if (strike.call.volume > maxCallVolume) {
        maxCallVolume = strike.call.volume;
        analytics.maxCallVolumeStrike = strike.strikePrice;
      }

      if (strike.put.volume > maxPutVolume) {
        maxPutVolume = strike.put.volume;
        analytics.maxPutVolumeStrike = strike.strikePrice;
      }

      // Aggregate delta
      analytics.netDelta += strike.call.delta - strike.put.delta;
    }

    // Calculate ratios
    analytics.putCallRatioOI = analytics.totalPutOI / analytics.totalCallOI;
    analytics.putCallRatioVolume = analytics.totalPutVolume / analytics.totalCallVolume;

    // Calculate max pain
    analytics.maxPain = this.calculateMaxPain(optionChain, underlyingLTP);

    // Determine sentiment
    analytics.sentiment = this.determineSentiment(analytics);
    analytics.sentimentStrength = this.calculateSentimentStrength(analytics);

    console.log(`[OptionChain] Analytics for ${underlyingSecurityId}:`);
    console.log(`  PCR OI: ${analytics.putCallRatioOI.toFixed(2)}`);
    console.log(`  PCR Vol: ${analytics.putCallRatioVolume.toFixed(2)}`);
    console.log(`  Sentiment: ${analytics.sentiment} (${analytics.sentimentStrength}%)`);
    console.log(`  Max Pain: ₹${analytics.maxPain}`);

    // Emit analytics
    this.emit('analytics', analytics);

    return analytics;
  }

  /**
   * Calculate max pain (strike where most options expire worthless)
   */
  private calculateMaxPain(optionChain: OptionStrike[], underlyingLTP: number): number {
    let maxPainStrike = underlyingLTP;
    let minPain = Infinity;

    // For each strike, calculate total pain
    for (const testStrike of optionChain) {
      let totalPain = 0;

      for (const strike of optionChain) {
        // Call pain: if underlying > strike, calls are ITM
        if (testStrike.strikePrice > strike.strikePrice) {
          totalPain += (testStrike.strikePrice - strike.strikePrice) * strike.call.oi;
        }

        // Put pain: if underlying < strike, puts are ITM
        if (testStrike.strikePrice < strike.strikePrice) {
          totalPain += (strike.strikePrice - testStrike.strikePrice) * strike.put.oi;
        }
      }

      if (totalPain < minPain) {
        minPain = totalPain;
        maxPainStrike = testStrike.strikePrice;
      }
    }

    return maxPainStrike;
  }

  /**
   * Determine market sentiment from option chain data
   */
  private determineSentiment(analytics: OptionChainAnalytics): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    let bullishSignals = 0;
    let bearishSignals = 0;

    // PCR OI analysis (< 0.7 = bullish, > 1.3 = bearish)
    if (analytics.putCallRatioOI < 0.7) bullishSignals++;
    if (analytics.putCallRatioOI > 1.3) bearishSignals++;

    // PCR Volume analysis
    if (analytics.putCallRatioVolume < 0.7) bullishSignals++;
    if (analytics.putCallRatioVolume > 1.3) bearishSignals++;

    // OI change analysis
    if (analytics.callOIChange > analytics.putOIChange * 1.5) bullishSignals++;
    if (analytics.putOIChange > analytics.callOIChange * 1.5) bearishSignals++;

    // Net delta analysis
    if (analytics.netDelta > 0.3) bullishSignals++;
    if (analytics.netDelta < -0.3) bearishSignals++;

    if (bullishSignals >= 3) return 'BULLISH';
    if (bearishSignals >= 3) return 'BEARISH';
    return 'NEUTRAL';
  }

  /**
   * Calculate sentiment strength (0-100)
   */
  private calculateSentimentStrength(analytics: OptionChainAnalytics): number {
    let strength = 50; // Neutral baseline

    // PCR deviation from 1.0
    const pcrDeviation = Math.abs(analytics.putCallRatioOI - 1.0);
    strength += pcrDeviation * 30;

    // OI change imbalance
    const oiImbalance = Math.abs(analytics.callOIChange - analytics.putOIChange) /
      (analytics.callOIChange + analytics.putOIChange);
    strength += oiImbalance * 20;

    return Math.min(100, Math.max(0, strength));
  }

  /**
   * Fetch available expiry dates for an underlying
   */
  async fetchExpiryList(underlyingSecurityId: string, underlyingSegment: string): Promise<string[]> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v2/optionchain/expirylist`,
        {
          UnderlyingScrip: parseInt(underlyingSecurityId),
          UnderlyingSeg: underlyingSegment
        },
        {
          headers: {
            'access-token': this.accessToken,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data;
    } catch (error: any) {
      console.error('[OptionChain] Error fetching expiry list:', error.message);
      throw error;
    }
  }
}

// Singleton instance
export default new OptionChainAnalyzer();

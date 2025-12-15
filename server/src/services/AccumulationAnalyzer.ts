/**
 * Accumulation Analyzer
 *
 * Analyzes market depth and option chain data to identify accumulation zones
 * Reports every 1 minute to reduce noise
 */

import { EventEmitter } from 'events';
import logger from '../utils/logger';

interface DepthAccumulation {
  securityId: string;
  timestamp: Date;
  bidAccumulation: number;  // Total bid quantity accumulated
  askAccumulation: number;  // Total ask quantity accumulated
  netAccumulation: number;  // Bid - Ask (positive = buying pressure)
  priceLevel: number;       // Current price
  imbalanceRatio: number;   // Bid/Ask ratio
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

interface OptionAccumulation {
  strikePrice: number;
  callOI: number;
  putOI: number;
  callOIChange: number;
  putOIChange: number;
  pcr: number;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

interface AccumulationReport {
  timestamp: Date;
  depthAnalysis: DepthAccumulation[];
  optionAnalysis: OptionAccumulation[];
  overallSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
}

export class AccumulationAnalyzer extends EventEmitter {
  private depthDataPoints: Map<string, any[]> = new Map();
  private optionDataPoints: any[] = [];
  private reportInterval: NodeJS.Timeout | null = null;
  private readonly REPORT_INTERVAL_MS = 60000; // 1 minute

  constructor() {
    super();
  }

  /**
   * Start accumulation analysis
   */
  start(): void {
    if (this.reportInterval) {
      logger.warn('AccumulationAnalyzer already started');
      return;
    }

    logger.info('Starting accumulation analysis (1-minute intervals)', 'AccumulationAnalyzer');

    // Generate report every 1 minute
    this.reportInterval = setInterval(() => {
      this.generateReport();
    }, this.REPORT_INTERVAL_MS);
  }

  /**
   * Stop accumulation analysis
   */
  stop(): void {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
      logger.info('Stopped accumulation analysis', 'AccumulationAnalyzer');
    }
  }

  /**
   * Record market depth data point
   */
  recordDepthData(securityId: string, depth: any): void {
    if (!this.depthDataPoints.has(securityId)) {
      this.depthDataPoints.set(securityId, []);
    }

    const dataPoints = this.depthDataPoints.get(securityId)!;
    dataPoints.push({
      timestamp: new Date(),
      bids: depth.bids,
      asks: depth.asks,
      bidVolume: depth.bids.reduce((sum: number, bid: any) => sum + bid.quantity, 0),
      askVolume: depth.asks.reduce((sum: number, ask: any) => sum + ask.quantity, 0)
    });

    // Keep only last minute of data
    const oneMinuteAgo = Date.now() - 60000;
    this.depthDataPoints.set(
      securityId,
      dataPoints.filter(dp => dp.timestamp.getTime() > oneMinuteAgo)
    );
  }

  /**
   * Record option chain data point
   */
  recordOptionData(optionData: any): void {
    this.optionDataPoints.push({
      timestamp: new Date(),
      data: optionData
    });

    // Keep only last minute of data
    const oneMinuteAgo = Date.now() - 60000;
    this.optionDataPoints = this.optionDataPoints.filter(
      dp => dp.timestamp.getTime() > oneMinuteAgo
    );
  }

  /**
   * Generate accumulation report
   */
  private generateReport(): void {
    const depthAnalysis: DepthAccumulation[] = [];

    // Analyze depth accumulation for each security
    for (const [securityId, dataPoints] of this.depthDataPoints.entries()) {
      if (dataPoints.length === 0) continue;

      const totalBidVolume = dataPoints.reduce((sum, dp) => sum + dp.bidVolume, 0);
      const totalAskVolume = dataPoints.reduce((sum, dp) => sum + dp.askVolume, 0);
      const netAccumulation = totalBidVolume - totalAskVolume;
      const imbalanceRatio = totalAskVolume > 0 ? totalBidVolume / totalAskVolume : 0;

      let signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
      if (imbalanceRatio > 1.3) signal = 'BULLISH';  // 30% more buyers
      else if (imbalanceRatio < 0.7) signal = 'BEARISH';  // 30% more sellers

      // Get latest price from last data point
      const latestDp = dataPoints[dataPoints.length - 1];
      const priceLevel = latestDp.bids[0]?.price || 0;

      depthAnalysis.push({
        securityId,
        timestamp: new Date(),
        bidAccumulation: totalBidVolume,
        askAccumulation: totalAskVolume,
        netAccumulation,
        priceLevel,
        imbalanceRatio,
        signal
      });
    }

    // Analyze option chain accumulation
    const optionAnalysis: OptionAccumulation[] = [];
    if (this.optionDataPoints.length > 1) {
      const latest = this.optionDataPoints[this.optionDataPoints.length - 1];
      const previous = this.optionDataPoints[0];

      // Compare OI changes
      // This is simplified - in production you'd match strikes between datasets
      if (latest.data?.strikes) {
        latest.data.strikes.forEach((strike: any) => {
          const pcr = strike.putOI / (strike.callOI || 1);
          let signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';

          if (pcr > 1.5) signal = 'BULLISH';  // More puts = bullish sentiment
          else if (pcr < 0.5) signal = 'BEARISH';  // More calls = bearish sentiment

          optionAnalysis.push({
            strikePrice: strike.strikePrice,
            callOI: strike.callOI,
            putOI: strike.putOI,
            callOIChange: strike.callOIChange || 0,
            putOIChange: strike.putOIChange || 0,
            pcr,
            signal
          });
        });
      }
    }

    // Determine overall signal
    let overallSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let bullishCount = 0;
    let bearishCount = 0;

    depthAnalysis.forEach(da => {
      if (da.signal === 'BULLISH') bullishCount++;
      else if (da.signal === 'BEARISH') bearishCount++;
    });

    optionAnalysis.forEach(oa => {
      if (oa.signal === 'BULLISH') bullishCount++;
      else if (oa.signal === 'BEARISH') bearishCount++;
    });

    const totalSignals = bullishCount + bearishCount;
    const confidence = totalSignals > 0 ? Math.max(bullishCount, bearishCount) / totalSignals : 0;

    if (bullishCount > bearishCount * 1.5) overallSignal = 'BULLISH';
    else if (bearishCount > bullishCount * 1.5) overallSignal = 'BEARISH';

    const report: AccumulationReport = {
      timestamp: new Date(),
      depthAnalysis,
      optionAnalysis,
      overallSignal,
      confidence
    };

    // Only emit if there's meaningful data
    if (depthAnalysis.length > 0 || optionAnalysis.length > 0) {
      logger.info(
        `📊 Accumulation Report: ${overallSignal} (${(confidence * 100).toFixed(0)}% confidence) - ` +
        `Depth: ${depthAnalysis.length} securities, Options: ${optionAnalysis.length} strikes`,
        'AccumulationAnalyzer'
      );

      this.emit('accumulation:report', report);
    }

    // Clear data for next interval
    this.depthDataPoints.clear();
    this.optionDataPoints = [];
  }
}

export default new AccumulationAnalyzer();

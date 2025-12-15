/**
 * Accumulation Panel Component
 *
 * Displays market accumulation analysis updated every 1 minute
 */

import React, { useEffect, useState } from 'react';
import marketDataService from '../../services/marketDataService';
import '../../styles/trading.css';

interface DepthAccumulation {
  securityId: string;
  timestamp: Date;
  bidAccumulation: number;
  askAccumulation: number;
  netAccumulation: number;
  priceLevel: number;
  imbalanceRatio: number;
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

const AccumulationPanel: React.FC = () => {
  const [report, setReport] = useState<AccumulationReport | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const handleReport = (data: AccumulationReport) => {
      setReport(data);
      setLastUpdate(new Date());
    };

    marketDataService.on('accumulation:report', handleReport);

    return () => {
      marketDataService.off('accumulation:report', handleReport);
    };
  }, []);

  if (!report) {
    return (
      <div className="accumulation-panel">
        <div className="accumulation-header">
          <h3>📊 Accumulation Analysis</h3>
          <span className="update-status">Waiting for data...</span>
        </div>
      </div>
    );
  }

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BULLISH': return '#26a69a';
      case 'BEARISH': return '#ef5350';
      default: return '#888';
    }
  };

  const getSignalIcon = (signal: string) => {
    switch (signal) {
      case 'BULLISH': return '📈';
      case 'BEARISH': return '📉';
      default: return '➡️';
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 10000000) return `${(num / 10000000).toFixed(2)}Cr`;
    if (num >= 100000) return `${(num / 100000).toFixed(2)}L`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(0);
  };

  return (
    <div className="accumulation-panel">
      <div className="accumulation-header">
        <h3>📊 Accumulation Analysis</h3>
        <div className="update-info">
          <span className="update-status">
            Last update: {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : '-'}
          </span>
        </div>
      </div>

      {/* Overall Signal */}
      <div className="overall-signal" style={{ borderLeftColor: getSignalColor(report.overallSignal) }}>
        <div className="signal-main">
          <span className="signal-icon">{getSignalIcon(report.overallSignal)}</span>
          <span className="signal-text" style={{ color: getSignalColor(report.overallSignal) }}>
            {report.overallSignal}
          </span>
        </div>
        <div className="signal-confidence">
          <div className="confidence-bar">
            <div
              className="confidence-fill"
              style={{
                width: `${report.confidence * 100}%`,
                backgroundColor: getSignalColor(report.overallSignal)
              }}
            />
          </div>
          <span className="confidence-text">{(report.confidence * 100).toFixed(0)}% Confidence</span>
        </div>
      </div>

      {/* Market Depth Accumulation */}
      {report.depthAnalysis.length > 0 && (
        <div className="accumulation-section">
          <h4>Market Depth</h4>
          <div className="accumulation-list">
            {report.depthAnalysis.map((depth, idx) => (
              <div key={idx} className="accumulation-item">
                <div className="item-header">
                  <span className="security-id">{depth.securityId}</span>
                  <span
                    className="item-signal"
                    style={{ color: getSignalColor(depth.signal) }}
                  >
                    {getSignalIcon(depth.signal)} {depth.signal}
                  </span>
                </div>
                <div className="item-details">
                  <div className="detail-row">
                    <span className="detail-label">Bid Volume:</span>
                    <span className="detail-value green">{formatNumber(depth.bidAccumulation)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Ask Volume:</span>
                    <span className="detail-value red">{formatNumber(depth.askAccumulation)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Net:</span>
                    <span
                      className={`detail-value ${depth.netAccumulation > 0 ? 'green' : 'red'}`}
                    >
                      {depth.netAccumulation > 0 ? '+' : ''}{formatNumber(depth.netAccumulation)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Imbalance:</span>
                    <span className="detail-value">{depth.imbalanceRatio.toFixed(2)}x</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Option Chain Accumulation */}
      {report.optionAnalysis.length > 0 && (
        <div className="accumulation-section">
          <h4>Option Chain OI</h4>
          <div className="accumulation-list">
            {report.optionAnalysis.slice(0, 5).map((option, idx) => (
              <div key={idx} className="accumulation-item">
                <div className="item-header">
                  <span className="security-id">Strike ₹{option.strikePrice}</span>
                  <span
                    className="item-signal"
                    style={{ color: getSignalColor(option.signal) }}
                  >
                    {getSignalIcon(option.signal)} {option.signal}
                  </span>
                </div>
                <div className="item-details">
                  <div className="detail-row">
                    <span className="detail-label">Call OI:</span>
                    <span className="detail-value">{formatNumber(option.callOI)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Put OI:</span>
                    <span className="detail-value">{formatNumber(option.putOI)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">PCR:</span>
                    <span className="detail-value">{option.pcr.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AccumulationPanel;

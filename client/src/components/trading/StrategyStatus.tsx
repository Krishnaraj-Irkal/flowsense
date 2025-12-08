/**
 * Strategy Status Component
 *
 * Displays status of all trading strategies:
 * - Active/Inactive status
 * - Trades placed today vs max limit
 * - Total signals generated
 * - Strategy details (timeframe, type)
 */

import React from 'react';
import { StrategyStatus as IStrategyStatus } from '../../services/marketDataService';
import '../../styles/trading.css';

interface StrategyStatusProps {
  strategies: IStrategyStatus[];
}

const StrategyStatus: React.FC<StrategyStatusProps> = ({ strategies }) => {
  if (strategies.length === 0) {
    return (
      <div className="strategy-status empty">
        <h3>Strategy Status</h3>
        <p>No strategies loaded</p>
      </div>
    );
  }

  const getTradeLimitColor = (tradesPlaced: number, maxTrades?: number): string => {
    if (!maxTrades) return 'default';
    const percent = (tradesPlaced / maxTrades) * 100;

    if (percent >= 100) return 'limit-reached';
    if (percent >= 66) return 'limit-warning';
    return 'limit-ok';
  };

  return (
    <div className="strategy-status">
      <div className="strategy-header">
        <h3>Strategy Status</h3>
        <span className="strategy-count">{strategies.length} Active</span>
      </div>

      <div className="strategies-grid">
        {strategies.map((strategy, index) => {
          const limitClass = getTradeLimitColor(strategy.tradesPlacedToday, strategy.maxTradesPerDay);
          const isLimitReached = strategy.maxTradesPerDay && strategy.tradesPlacedToday >= strategy.maxTradesPerDay;

          return (
            <div key={index} className={`strategy-card ${strategy.isActive ? 'active' : 'inactive'}`}>
              <div className="strategy-card-header">
                <div className="strategy-title">
                  <h4>{strategy.name}</h4>
                  <span className={`status-badge ${strategy.isActive ? 'active' : 'inactive'}`}>
                    {strategy.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="strategy-details">
                <div className="detail-item">
                  <span className="icon">⏱️</span>
                  <span className="label">Timeframe:</span>
                  <span className="value">{strategy.timeframe}</span>
                </div>
                <div className="detail-item">
                  <span className="icon">📈</span>
                  <span className="label">Type:</span>
                  <span className="value capitalize">{strategy.tradingType}</span>
                </div>
              </div>

              <div className="strategy-metrics">
                <div className="metric-item">
                  <span className="metric-label">Signals Generated</span>
                  <span className="metric-value">{strategy.totalSignalsGenerated}</span>
                </div>
                <div className={`metric-item ${limitClass}`}>
                  <span className="metric-label">Trades Today</span>
                  <span className="metric-value">
                    {strategy.tradesPlacedToday}
                    {strategy.maxTradesPerDay && ` / ${strategy.maxTradesPerDay}`}
                  </span>
                </div>
              </div>

              {strategy.maxTradesPerDay && (
                <div className="trade-limit-bar">
                  <div
                    className={`trade-limit-fill ${limitClass}`}
                    style={{
                      width: `${Math.min((strategy.tradesPlacedToday / strategy.maxTradesPerDay) * 100, 100)}%`
                    }}
                  ></div>
                </div>
              )}

              {isLimitReached && (
                <div className="limit-warning">
                  Daily trade limit reached
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StrategyStatus;

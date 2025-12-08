/**
 * Positions List Component
 *
 * Displays list of open positions with real-time updates:
 * - Entry price, current price, P&L
 * - Stop loss and target levels
 * - Strategy name
 * - Time since entry
 */

import React from 'react';
import { Position } from '../../services/marketDataService';
import '../../styles/trading.css';

interface PositionsListProps {
  positions: Position[];
}

const PositionsList: React.FC<PositionsListProps> = ({ positions }) => {
  const formatCurrency = (value: number): string => {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPnL = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${formatCurrency(value)}`;
  };

  const getTimeSinceEntry = (entryTime: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(entryTime).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m ago`;
  };

  const calculatePnLPercent = (position: Position): number => {
    const pnlPercent = (position.unrealizedPnL / (position.entryPrice * position.quantity)) * 100;
    return pnlPercent;
  };

  const getDistanceToSL = (position: Position): number => {
    const distance = Math.abs(position.currentPrice - position.stopLoss);
    const percent = (distance / position.currentPrice) * 100;
    return percent;
  };

  const getDistanceToTarget = (position: Position): number => {
    const distance = Math.abs(position.target - position.currentPrice);
    const percent = (distance / position.currentPrice) * 100;
    return percent;
  };

  if (positions.length === 0) {
    return (
      <div className="positions-list empty">
        <h3>Open Positions</h3>
        <div className="empty-state">
          <p>No open positions</p>
          <span className="empty-icon">📊</span>
        </div>
      </div>
    );
  }

  return (
    <div className="positions-list">
      <div className="positions-header">
        <h3>Open Positions</h3>
        <span className="positions-count">{positions.length}</span>
      </div>

      <div className="positions-container">
        {positions.map((position) => {
          const pnlPercent = calculatePnLPercent(position);
          const distanceToSL = getDistanceToSL(position);
          const distanceToTarget = getDistanceToTarget(position);

          return (
            <div key={position._id} className="position-card">
              <div className="position-header">
                <div className="position-title">
                  <span className={`side-badge ${position.side.toLowerCase()}`}>
                    {position.side}
                  </span>
                  <span className="security-id">{position.securityId}</span>
                </div>
                <div className={`pnl-value ${position.unrealizedPnL >= 0 ? 'profit' : 'loss'}`}>
                  {formatPnL(position.unrealizedPnL)}
                  <span className="pnl-percent">
                    ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>

              <div className="position-details">
                <div className="detail-row">
                  <span className="detail-label">Strategy:</span>
                  <span className="detail-value">{position.strategyName}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Quantity:</span>
                  <span className="detail-value">{position.quantity}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Entry:</span>
                  <span className="detail-value">{formatCurrency(position.entryPrice)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Current:</span>
                  <span className={`detail-value ${position.unrealizedPnL >= 0 ? 'profit' : 'loss'}`}>
                    {formatCurrency(position.currentPrice)}
                  </span>
                </div>
              </div>

              <div className="position-levels">
                <div className="level-item">
                  <span className="level-label">Stop Loss</span>
                  <span className="level-value sl">{formatCurrency(position.stopLoss)}</span>
                  <span className="level-distance">
                    {distanceToSL < 1 ? '⚠️ ' : ''}{distanceToSL.toFixed(2)}% away
                  </span>
                </div>
                <div className="level-item">
                  <span className="level-label">Target</span>
                  <span className="level-value target">{formatCurrency(position.target)}</span>
                  <span className="level-distance">
                    {distanceToTarget.toFixed(2)}% to go
                  </span>
                </div>
              </div>

              <div className="position-footer">
                <span className="entry-time">{getTimeSinceEntry(position.entryTime)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PositionsList;

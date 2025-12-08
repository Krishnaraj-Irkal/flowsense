/**
 * Portfolio Card Component
 *
 * Displays real-time portfolio metrics:
 * - Total capital and available capital
 * - Today's P&L, Week P&L, Total P&L
 * - Win rate and trade statistics
 * - Daily loss limit progress
 */

import React from 'react';
import { Portfolio } from '../../services/marketDataService';
import '../../styles/trading.css';

interface PortfolioCardProps {
  portfolio: Portfolio | null;
}

const PortfolioCard: React.FC<PortfolioCardProps> = ({ portfolio }) => {
  if (!portfolio) {
    return (
      <div className="portfolio-card loading">
        <h3>Portfolio</h3>
        <p>Loading portfolio data...</p>
      </div>
    );
  }

  const {
    totalCapital,
    availableCapital,
    usedMargin,
    todayPnL,
    totalPnL,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    maxDailyLoss,
    currentDailyLoss
  } = portfolio;

  const usedMarginPercent = (usedMargin / totalCapital) * 100;
  const dailyLossPercent = (currentDailyLoss / maxDailyLoss) * 100;

  const formatCurrency = (value: number): string => {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPnL = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${formatCurrency(value)}`;
  };

  return (
    <div className="portfolio-card">
      <div className="portfolio-header">
        <h3>Portfolio</h3>
        <div className={`pnl-badge ${todayPnL >= 0 ? 'profit' : 'loss'}`}>
          {formatPnL(todayPnL)}
        </div>
      </div>

      <div className="portfolio-grid">
        {/* Capital Section */}
        <div className="portfolio-section">
          <div className="portfolio-item">
            <span className="label">Total Capital</span>
            <span className="value">{formatCurrency(totalCapital)}</span>
          </div>
          <div className="portfolio-item">
            <span className="label">Available</span>
            <span className="value available">{formatCurrency(availableCapital)}</span>
          </div>
          <div className="portfolio-item">
            <span className="label">Used Margin</span>
            <span className="value used">{formatCurrency(usedMargin)}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${usedMarginPercent}%` }}></div>
          </div>
          <span className="progress-label">{usedMarginPercent.toFixed(1)}% margin used</span>
        </div>

        {/* P&L Section */}
        <div className="portfolio-section">
          <div className="portfolio-item">
            <span className="label">Today P&L</span>
            <span className={`value ${todayPnL >= 0 ? 'profit' : 'loss'}`}>
              {formatPnL(todayPnL)}
            </span>
          </div>
          <div className="portfolio-item">
            <span className="label">Total P&L</span>
            <span className={`value ${totalPnL >= 0 ? 'profit' : 'loss'}`}>
              {formatPnL(totalPnL)}
            </span>
          </div>
        </div>

        {/* Statistics Section */}
        <div className="portfolio-section">
          <div className="portfolio-item">
            <span className="label">Total Trades</span>
            <span className="value">{totalTrades}</span>
          </div>
          <div className="portfolio-item">
            <span className="label">Win Rate</span>
            <span className={`value ${winRate >= 60 ? 'profit' : ''}`}>
              {winRate.toFixed(1)}%
            </span>
          </div>
          <div className="portfolio-stats">
            <span className="stat profit-stat">W: {winningTrades}</span>
            <span className="stat loss-stat">L: {losingTrades}</span>
          </div>
        </div>

        {/* Risk Section */}
        <div className="portfolio-section">
          <div className="portfolio-item">
            <span className="label">Daily Loss Limit</span>
            <span className="value">{formatCurrency(maxDailyLoss)}</span>
          </div>
          <div className="portfolio-item">
            <span className="label">Current Loss</span>
            <span className="value loss">{formatCurrency(currentDailyLoss)}</span>
          </div>
          <div className={`progress-bar ${dailyLossPercent >= 80 ? 'danger' : ''}`}>
            <div
              className="progress-fill loss-fill"
              style={{ width: `${Math.min(dailyLossPercent, 100)}%` }}
            ></div>
          </div>
          <span className={`progress-label ${dailyLossPercent >= 80 ? 'danger' : ''}`}>
            {dailyLossPercent.toFixed(1)}% of daily limit
          </span>
          {dailyLossPercent >= 80 && (
            <div className="warning-message">
              Warning: Approaching daily loss limit!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PortfolioCard;

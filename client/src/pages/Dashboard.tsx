/**
 * Dashboard Page
 *
 * Main trading dashboard with real-time data:
 * - Portfolio overview with P&L
 * - Live candlestick chart
 * - Open positions list
 * - Strategy status
 * - Market connection controls
 */

import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { useMarketData } from '../contexts/MarketDataContext';
import PortfolioCard from '../components/trading/PortfolioCard';
import PositionsList from '../components/trading/PositionsList';
import StrategyStatus from '../components/trading/StrategyStatus';
import LiveChart from '../components/trading/LiveChart';
import AccumulationPanel from '../components/trading/AccumulationPanel';
import axios from 'axios';
import './Dashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const {
    isConnected,
    systemStatus,
    portfolio,
    openPositions,
    strategies,
    candles1m,
    candles5m,
    connect,
    disconnect
  } = useMarketData();

  const [chartInterval, setChartInterval] = useState<'1m' | '5m'>('5m');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Auto-connect to WebSocket on mount
  useEffect(() => {
    connect();
  }, [connect]);

  /**
   * Connect to Dhan market feed
   */
  const handleConnectToDhan = async () => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/market-data/connect`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log('Connected to Dhan:', response.data);
    } catch (error: any) {
      console.error('Failed to connect to Dhan:', error);
      setConnectionError(
        error.response?.data?.message || 'Failed to connect to Dhan market feed'
      );
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Disconnect from Dhan market feed
   */
  const handleDisconnectFromDhan = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/market-data/disconnect`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log('Disconnected from Dhan');
    } catch (error: any) {
      console.error('Failed to disconnect:', error);
    }
  };

  const isDhanConnected = systemStatus?.dhanConnected || false;
  const selectedCandles = chartInterval === '1m' ? candles1m : candles5m;

  return (
    <div className="dashboard">
      <Header />
      <main className="dashboard-main">
        <div className="dashboard-container">
          <div className="dashboard-header">
            <div>
              <h1>Trading Dashboard</h1>
              <p className="dashboard-subtitle">Welcome back, {user?.name}!</p>
            </div>

            <div className="connection-controls">
              <div className="connection-status">
                <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
                <span className="status-text">
                  WebSocket: {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {isDhanConnected ? (
                <button
                  className="btn btn-danger"
                  onClick={handleDisconnectFromDhan}
                >
                  Disconnect from Dhan
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={handleConnectToDhan}
                  disabled={isConnecting}
                >
                  {isConnecting ? 'Connecting...' : 'Connect to Dhan'}
                </button>
              )}
            </div>
          </div>

          {connectionError && (
            <div className="error-banner">
              <span className="error-icon">⚠️</span>
              <span>{connectionError}</span>
              <button className="error-close" onClick={() => setConnectionError(null)}>
                ×
              </button>
            </div>
          )}

          {!isDhanConnected && !isConnecting && (
            <div className="info-banner">
              <span className="info-icon">ℹ️</span>
              <span>
                Click "Connect to Dhan" to start receiving live market data and activate trading strategies.
              </span>
            </div>
          )}

          {isDhanConnected && (
            <div className="success-banner">
              <span className="success-icon">✓</span>
              <span>
                Connected to Dhan market feed. Strategies active: {strategies.filter(s => s.isActive).length} / {strategies.length}
              </span>
            </div>
          )}

          <div className="dashboard-layout">
            {/* Left Column - Portfolio & Positions */}
            <div className="dashboard-sidebar">
              <PortfolioCard portfolio={portfolio} />
              <PositionsList positions={openPositions} />
            </div>

            {/* Middle Column - Chart & Accumulation */}
            <div className="dashboard-main-content">
              <LiveChart
                candles={selectedCandles}
                positions={openPositions}
                interval={chartInterval}
                onIntervalChange={setChartInterval}
              />
              <AccumulationPanel />
            </div>

            {/* Right Column - Strategy Status */}
            <div className="dashboard-sidebar">
              <StrategyStatus strategies={strategies} />
            </div>
          </div>

          {/* System Status Footer */}
          {systemStatus && (
            <div className="system-status-footer">
              <div className="status-item">
                <span className="status-label">Subscribed Instruments:</span>
                <span className="status-value">{systemStatus.subscribedInstruments.length}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Open Positions:</span>
                <span className="status-value">{openPositions.length}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Active Strategies:</span>
                <span className="status-value">
                  {strategies.filter(s => s.isActive).length} / {strategies.length}
                </span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;

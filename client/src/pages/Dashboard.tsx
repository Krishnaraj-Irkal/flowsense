import React from 'react';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="dashboard">
      <Header />
      <main className="dashboard-main">
        <div className="dashboard-container">
          <h1>Welcome, {user?.name}!</h1>
          <p className="dashboard-subtitle">Your FlowSense Trading Dashboard</p>

          <div className="dashboard-grid">
            <div className="dashboard-card">
              <h3>Portfolio Overview</h3>
              <p>Your trading portfolio and positions will appear here.</p>
              <div className="placeholder-box">
                <span>Coming Soon</span>
              </div>
            </div>

            <div className="dashboard-card">
              <h3>Market Data</h3>
              <p>Real-time market information and live feeds.</p>
              <div className="placeholder-box">
                <span>Coming Soon</span>
              </div>
            </div>

            <div className="dashboard-card">
              <h3>Recent Trades</h3>
              <p>Your recent trading activity and order history.</p>
              <div className="placeholder-box">
                <span>Coming Soon</span>
              </div>
            </div>

            <div className="dashboard-card">
              <h3>Account Summary</h3>
              <p>Overview of your account balance and margins.</p>
              <div className="placeholder-box">
                <span>Coming Soon</span>
              </div>
            </div>
          </div>

          <div className="dashboard-info">
            <p>
              <strong>Client ID:</strong> {user?.clientId || 'Not set'}
            </p>
            <p className="info-text">
              You can update your Client ID and access tokens in the Settings page.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;

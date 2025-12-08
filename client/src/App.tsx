import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

interface HealthResponse {
  status: string;
  message: string;
  timestamp: string;
}

const App: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get<HealthResponse>(`${API_URL}/api/health`);
      setHealth(response.data);
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Error fetching health:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>FlowSense</h1>
        <p className="subtitle">Trading Platform for Dhan</p>
      </header>

      <main className="app-main">
        <div className="card">
          <h2>Server Status</h2>
          {loading && <p className="loading">Connecting to server...</p>}
          {error && <p className="error">{error}</p>}
          {health && (
            <div className="health-info">
              <div className="status-badge success">
                {health.status}
              </div>
              <p>{health.message}</p>
              <p className="timestamp">Last checked: {new Date(health.timestamp).toLocaleString()}</p>
            </div>
          )}
          <button onClick={fetchHealth} className="refresh-btn">
            Refresh Status
          </button>
        </div>

        <div className="card">
          <h2>Welcome</h2>
          <p>FlowSense is a private trading platform for family use.</p>
          <p>Connected to: <code>{API_URL}</code></p>
        </div>
      </main>

      <footer className="app-footer">
        <p>&copy; 2024 FlowSense. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default App;

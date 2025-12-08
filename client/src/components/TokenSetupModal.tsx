import React, { useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import './TokenSetupModal.css';

interface TokenSetupModalProps {
  onClose: () => void;
}

const TokenSetupModal: React.FC<TokenSetupModalProps> = ({ onClose }) => {
  const { user, updateUser } = useAuth();
  const [clientId, setClientId] = useState(user?.clientId || '');
  const [tickFeedToken, setTickFeedToken] = useState('');
  const [marketDepthToken, setMarketDepthToken] = useState('');
  const [optionChainToken, setOptionChainToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!tickFeedToken || !marketDepthToken || !optionChainToken) {
      setError('All tokens are required');
      return;
    }

    setLoading(true);

    try {
      await api.post('/tokens', {
        clientId: clientId || undefined,
        tickFeedToken,
        marketDepthToken,
        optionChainToken,
      });

      if (user) {
        updateUser({ ...user, isFirstLogin: false, clientId: clientId || user.clientId });
      }

      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save tokens');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Set Up Access Tokens</h2>
        <p className="modal-subtitle">
          Please enter your Dhan API credentials to continue. These tokens expire daily at 9:00 AM.
        </p>

        <form onSubmit={handleSubmit} className="token-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="clientId">Client ID {!user?.clientId && '(Required)'}</label>
            <input
              type="text"
              id="clientId"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Enter your Dhan Client ID"
              required={!user?.clientId}
            />
          </div>

          <div className="form-group">
            <label htmlFor="tickFeedToken">Tick Feed Token *</label>
            <input
              type="text"
              id="tickFeedToken"
              value={tickFeedToken}
              onChange={(e) => setTickFeedToken(e.target.value)}
              placeholder="Enter Tick Feed Token"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="marketDepthToken">Market Depth Token *</label>
            <input
              type="text"
              id="marketDepthToken"
              value={marketDepthToken}
              onChange={(e) => setMarketDepthToken(e.target.value)}
              placeholder="Enter Market Depth Token"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="optionChainToken">Option Chain Token *</label>
            <input
              type="text"
              id="optionChainToken"
              value={optionChainToken}
              onChange={(e) => setOptionChainToken(e.target.value)}
              placeholder="Enter Option Chain Token"
              required
            />
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Saving...' : 'Save and Continue'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TokenSetupModal;

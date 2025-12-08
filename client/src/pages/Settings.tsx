import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Tokens } from '../types';
import './Settings.css';

const Settings: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [clientId, setClientId] = useState(user?.clientId || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [tickFeedToken, setTickFeedToken] = useState('');
  const [marketDepthToken, setMarketDepthToken] = useState('');
  const [optionChainToken, setOptionChainToken] = useState('');
  const [tokensExpiry, setTokensExpiry] = useState<string>('');

  const [loading, setLoading] = useState<{[key: string]: boolean}>({});
  const [messages, setMessages] = useState<{[key: string]: {type: string, text: string}}>({});

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    try {
      const response = await api.get<{tokens: Tokens}>('/tokens');
      const { tokens } = response.data;
      setTickFeedToken(tokens.tickFeedToken);
      setMarketDepthToken(tokens.marketDepthToken);
      setOptionChainToken(tokens.optionChainToken);
      setTokensExpiry(new Date(tokens.expiresAt).toLocaleString());
    } catch (error) {
      console.error('Failed to fetch tokens');
    }
  };

  const showMessage = (key: string, type: string, text: string) => {
    setMessages(prev => ({ ...prev, [key]: { type, text } }));
    setTimeout(() => {
      setMessages(prev => {
        const newMessages = { ...prev };
        delete newMessages[key];
        return newMessages;
      });
    }, 3000);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(prev => ({ ...prev, profile: true }));

    try {
      const response = await api.put('/auth/profile', { name });
      updateUser(response.data.user);
      showMessage('profile', 'success', 'Profile updated successfully');
    } catch (error) {
      showMessage('profile', 'error', 'Failed to update profile');
    } finally {
      setLoading(prev => ({ ...prev, profile: false }));
    }
  };

  const handleUpdateClientId = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(prev => ({ ...prev, clientId: true }));

    try {
      await api.put('/auth/client-id', { clientId });
      if (user) {
        updateUser({ ...user, clientId });
      }
      showMessage('clientId', 'success', 'Client ID updated successfully');
    } catch (error) {
      showMessage('clientId', 'error', 'Failed to update Client ID');
    } finally {
      setLoading(prev => ({ ...prev, clientId: false }));
    }
  };

  const handleUpdateTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(prev => ({ ...prev, tokens: true }));

    try {
      await api.put('/tokens', {
        tickFeedToken,
        marketDepthToken,
        optionChainToken,
      });
      await fetchTokens();
      showMessage('tokens', 'success', 'Tokens updated successfully');
    } catch (error) {
      showMessage('tokens', 'error', 'Failed to update tokens');
    } finally {
      setLoading(prev => ({ ...prev, tokens: false }));
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      showMessage('password', 'error', 'Passwords do not match');
      return;
    }

    setLoading(prev => ({ ...prev, password: true }));

    try {
      await api.put('/auth/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showMessage('password', 'success', 'Password changed successfully');
    } catch (error: any) {
      showMessage('password', 'error', error.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(prev => ({ ...prev, password: false }));
    }
  };

  const Message = ({ id }: { id: string }) => {
    const message = messages[id];
    if (!message) return null;

    return (
      <div className={`message ${message.type}`}>
        {message.text}
      </div>
    );
  };

  return (
    <div className="settings">
      <Header />
      <main className="settings-main">
        <div className="settings-container">
          <h1>Settings</h1>
          <p className="settings-subtitle">Manage your account and trading credentials</p>

          <div className="settings-grid">
            {/* Profile Section */}
            <div className="settings-card">
              <h2>User Information</h2>
              <form onSubmit={handleUpdateProfile}>
                <Message id="profile" />
                <div className="form-group">
                  <label htmlFor="name">Name</label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email (Read-only)</label>
                  <input
                    type="email"
                    id="email"
                    value={user?.email || ''}
                    disabled
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading.profile}>
                  {loading.profile ? 'Updating...' : 'Update Profile'}
                </button>
              </form>
            </div>

            {/* Client ID Section */}
            <div className="settings-card">
              <h2>Client Configuration</h2>
              <form onSubmit={handleUpdateClientId}>
                <Message id="clientId" />
                <div className="form-group">
                  <label htmlFor="clientId">Client ID</label>
                  <input
                    type="text"
                    id="clientId"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    required
                    placeholder="Enter your Dhan Client ID"
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading.clientId}>
                  {loading.clientId ? 'Updating...' : 'Update Client ID'}
                </button>
              </form>
            </div>

            {/* Tokens Section */}
            <div className="settings-card full-width">
              <h2>Access Tokens</h2>
              <p className="token-expiry">
                Current tokens expire: <strong>{tokensExpiry || 'No tokens set'}</strong>
              </p>
              <form onSubmit={handleUpdateTokens}>
                <Message id="tokens" />
                <div className="tokens-grid">
                  <div className="form-group">
                    <label htmlFor="tickFeedToken">Tick Feed Token</label>
                    <input
                      type="text"
                      id="tickFeedToken"
                      value={tickFeedToken}
                      onChange={(e) => setTickFeedToken(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="marketDepthToken">Market Depth Token</label>
                    <input
                      type="text"
                      id="marketDepthToken"
                      value={marketDepthToken}
                      onChange={(e) => setMarketDepthToken(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="optionChainToken">Option Chain Token</label>
                    <input
                      type="text"
                      id="optionChainToken"
                      value={optionChainToken}
                      onChange={(e) => setOptionChainToken(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary" disabled={loading.tokens}>
                  {loading.tokens ? 'Updating...' : 'Update Tokens'}
                </button>
              </form>
            </div>

            {/* Password Section */}
            <div className="settings-card full-width">
              <h2>Change Password</h2>
              <form onSubmit={handleChangePassword}>
                <Message id="password" />
                <div className="password-grid">
                  <div className="form-group">
                    <label htmlFor="currentPassword">Current Password</label>
                    <input
                      type="password"
                      id="currentPassword"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="newPassword">New Password</label>
                    <input
                      type="password"
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="confirmPassword">Confirm New Password</label>
                    <input
                      type="password"
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary" disabled={loading.password}>
                  {loading.password ? 'Changing...' : 'Change Password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;

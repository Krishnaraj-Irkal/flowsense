import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Homepage.css';

const Homepage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="homepage">
      <div className="homepage-content">
        <h1 className="homepage-title">FlowSense</h1>
        <p className="homepage-subtitle">Trading Platform for Dhan</p>
        <p className="homepage-description">
          A private trading platform designed for family use. Connect your Dhan account and start trading with confidence.
        </p>

        <div className="homepage-buttons">
          <Link to="/login" className="homepage-btn primary">
            Login
          </Link>
          <Link to="/signup" className="homepage-btn secondary">
            Sign Up
          </Link>
        </div>

        <div className="homepage-features">
          <div className="feature">
            <h3>Secure</h3>
            <p>Bank-level security with encrypted credentials</p>
          </div>
          <div className="feature">
            <h3>Real-time</h3>
            <p>Live market data and instant order execution</p>
          </div>
          <div className="feature">
            <h3>Private</h3>
            <p>Exclusive platform for family members only</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Homepage;

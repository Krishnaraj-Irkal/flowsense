import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#0f0f23',
      color: '#fff'
    }}>
      <div style={{
        width: '60px',
        height: '60px',
        border: '4px solid rgba(99, 102, 241, 0.2)',
        borderTop: '4px solid #6366f1',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <p style={{
        marginTop: '20px',
        fontSize: '16px',
        color: '#9ca3af'
      }}>
        Loading...
      </p>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;

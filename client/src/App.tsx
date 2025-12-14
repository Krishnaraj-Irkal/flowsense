import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { MarketDataProvider } from './contexts/MarketDataContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';
import './App.css';

// Lazy load page components for code splitting and better performance
const Homepage = lazy(() => import('./pages/Homepage'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MarketDataProvider>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Homepage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        </MarketDataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;

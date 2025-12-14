/**
 * Market Data Context
 *
 * React context for managing real-time market data state
 *
 * Provides:
 * - WebSocket connection management
 * - Real-time tick, candle, signal, position, and portfolio data
 * - Subscription management
 * - Connection status
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import marketDataService, {
  Tick,
  Candle,
  Signal,
  Position,
  Portfolio,
  StrategyStatus,
  SystemStatus
} from '../services/marketDataService';

interface MarketDataContextType {
  // Connection status
  isConnected: boolean;
  systemStatus: SystemStatus | null;

  // Latest data
  latestTick: Tick | null;
  latestCandle: Candle | null;
  portfolio: Portfolio | null;
  openPositions: Position[];
  strategies: StrategyStatus[];
  recentSignals: Signal[];

  // Historical data
  candles1m: Candle[];
  candles5m: Candle[];

  // Actions
  connect: () => void;
  disconnect: () => void;
  subscribeToAll: () => void;
  refreshPortfolio: () => void;
  refreshPositions: () => void;
  refreshStrategies: () => void;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

export const useMarketData = () => {
  const context = useContext(MarketDataContext);
  if (!context) {
    throw new Error('useMarketData must be used within a MarketDataProvider');
  }
  return context;
};

interface MarketDataProviderProps {
  children: ReactNode;
}

export const MarketDataProvider: React.FC<MarketDataProviderProps> = ({ children }) => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  // Latest data
  const [latestTick, setLatestTick] = useState<Tick | null>(null);
  const [latestCandle, setLatestCandle] = useState<Candle | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [strategies, setStrategies] = useState<StrategyStatus[]>([]);
  const [recentSignals, setRecentSignals] = useState<Signal[]>([]);

  // Historical candles (for charting)
  const [candles1m, setCandles1m] = useState<Candle[]>([]);
  const [candles5m, setCandles5m] = useState<Candle[]>([]);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    console.log('[MarketDataContext] Connecting...');
    marketDataService.connect();
  }, []);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    console.log('[MarketDataContext] Disconnecting...');
    marketDataService.disconnect();
    setIsConnected(false);
  }, []);

  /**
   * Subscribe to all data streams
   */
  const subscribeToAll = useCallback(() => {
    marketDataService.subscribe('ticks');
    marketDataService.subscribe('candles');
    marketDataService.subscribe('signals');
    marketDataService.subscribe('positions');
    marketDataService.subscribe('portfolio');
    console.log('[MarketDataContext] Subscribed to all streams');
  }, []);

  /**
   * Refresh portfolio
   */
  const refreshPortfolio = useCallback(() => {
    marketDataService.requestPortfolio();
  }, []);

  /**
   * Refresh positions
   */
  const refreshPositions = useCallback(() => {
    marketDataService.requestPositions();
  }, []);

  /**
   * Refresh strategies
   */
  const refreshStrategies = useCallback(() => {
    marketDataService.requestStrategies();
  }, []);

  /**
   * Setup event listeners
   */
  useEffect(() => {
    // Connection status
    const handleConnectionStatus = (data: { connected: boolean }) => {
      setIsConnected(data.connected);
      if (data.connected) {
        // Auto-subscribe when connected
        subscribeToAll();
        // Request initial data
        refreshPortfolio();
        refreshPositions();
        refreshStrategies();
      }
    };

    // System status
    const handleSystemStatus = (data: SystemStatus) => {
      setSystemStatus(data);
    };

    // Tick updates
    const handleTick = (data: Tick) => {
      console.log(`[MarketDataContext] 📊 Tick received for ${data.securityId}: LTP ₹${data.ltp}`);
      setLatestTick(data);
    };

    // Live candle updates (real-time updates as ticks come in)
    const handleCandleUpdate = (data: { candle: Candle }) => {
      const candle = data.candle;
      setLatestCandle(candle);

      // Update the latest candle in the array (replace last candle if it's the same timestamp)
      if (candle.interval === '1m') {
        setCandles1m((prev) => {
          if (prev.length > 0 && prev[prev.length - 1].timestamp === candle.timestamp) {
            // Update existing candle
            const updated = [...prev];
            updated[updated.length - 1] = candle;
            return updated;
          } else {
            // Add new candle
            const updated = [...prev, candle];
            return updated.slice(-100);
          }
        });
      } else if (candle.interval === '5m') {
        setCandles5m((prev) => {
          if (prev.length > 0 && prev[prev.length - 1].timestamp === candle.timestamp) {
            // Update existing candle
            const updated = [...prev];
            updated[updated.length - 1] = candle;
            return updated;
          } else {
            // Add new candle
            const updated = [...prev, candle];
            return updated.slice(-100);
          }
        });
      }
    };

    // Candle close (when a candle period completes)
    const handleCandle = (data: { candle: Candle }) => {
      const candle = data.candle;
      setLatestCandle(candle);

      // Add to historical candles
      if (candle.interval === '1m') {
        setCandles1m((prev) => {
          const updated = [...prev, candle];
          // Keep only last 100 candles
          return updated.slice(-100);
        });
      } else if (candle.interval === '5m') {
        setCandles5m((prev) => {
          const updated = [...prev, candle];
          // Keep only last 100 candles
          return updated.slice(-100);
        });
      }
    };

    // Signal updates
    const handleSignal = (data: any) => {
      const signal = data.signal;
      setRecentSignals((prev) => {
        const updated = [signal, ...prev];
        // Keep only last 20 signals
        return updated.slice(0, 20);
      });
    };

    // Strategy status
    const handleStrategiesStatus = (data: StrategyStatus[]) => {
      setStrategies(data);
    };

    // Position updates
    const handlePositionUpdate = (data: Position) => {
      setOpenPositions((prev) => {
        const index = prev.findIndex((p) => p._id === data._id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = data;
          return updated;
        } else {
          return [...prev, data];
        }
      });
    };

    const handlePositionClosed = (data: Position) => {
      setOpenPositions((prev) => prev.filter((p) => p._id !== data._id));
    };

    const handlePositionsList = (data: Position[]) => {
      setOpenPositions(data);
    };

    // Portfolio updates
    const handlePortfolioUpdate = (data: Portfolio) => {
      setPortfolio(data);
    };

    // Register listeners
    marketDataService.on('connection:status', handleConnectionStatus);
    marketDataService.on('status', handleSystemStatus);
    marketDataService.on('tick', handleTick);
    marketDataService.on('candle:update', handleCandleUpdate);
    marketDataService.on('candle', handleCandle);
    marketDataService.on('signal', handleSignal);
    marketDataService.on('strategies:status', handleStrategiesStatus);
    marketDataService.on('position:update', handlePositionUpdate);
    marketDataService.on('position:closed', handlePositionClosed);
    marketDataService.on('positions:list', handlePositionsList);
    marketDataService.on('portfolio:update', handlePortfolioUpdate);

    // Cleanup
    return () => {
      marketDataService.off('connection:status', handleConnectionStatus);
      marketDataService.off('status', handleSystemStatus);
      marketDataService.off('tick', handleTick);
      marketDataService.off('candle:update', handleCandleUpdate);
      marketDataService.off('candle', handleCandle);
      marketDataService.off('signal', handleSignal);
      marketDataService.off('strategies:status', handleStrategiesStatus);
      marketDataService.off('position:update', handlePositionUpdate);
      marketDataService.off('position:closed', handlePositionClosed);
      marketDataService.off('positions:list', handlePositionsList);
      marketDataService.off('portfolio:update', handlePortfolioUpdate);
    };
  }, [subscribeToAll, refreshPortfolio, refreshPositions, refreshStrategies]);

  const value: MarketDataContextType = {
    isConnected,
    systemStatus,
    latestTick,
    latestCandle,
    portfolio,
    openPositions,
    strategies,
    recentSignals,
    candles1m,
    candles5m,
    connect,
    disconnect,
    subscribeToAll,
    refreshPortfolio,
    refreshPositions,
    refreshStrategies
  };

  return <MarketDataContext.Provider value={value}>{children}</MarketDataContext.Provider>;
};

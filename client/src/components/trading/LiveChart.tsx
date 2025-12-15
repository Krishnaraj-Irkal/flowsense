/**
 * Live Chart Component
 *
 * Real-time candlestick chart using lightweight-charts library
 *
 * Features:
 * - Candlestick chart with volume
 * - Real-time updates
 * - Multiple timeframes (1m, 5m)
 * - Stop loss and target markers for open positions
 */

import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, CandlestickData, Time } from 'lightweight-charts';
import { Candle, Position } from '../../services/marketDataService';
import '../../styles/trading.css';

interface LiveChartProps {
  candles: Candle[];
  positions: Position[];
  interval: '1m' | '5m';
  onIntervalChange?: (interval: '1m' | '5m') => void;
}

const LiveChart: React.FC<LiveChartProps> = ({ candles, positions, interval, onIntervalChange }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: '#1a1a2e' },
        textColor: '#d1d4dc'
      },
      grid: {
        vertLines: { color: '#2a2e39' },
        horzLines: { color: '#2a2e39' }
      },
      crosshair: {
        mode: 1
      },
      rightPriceScale: {
        borderColor: '#2a2e39'
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false
      }
    });

    // Add candlestick series (v5 API)
    const candleSeries = chart.addSeries({
      type: 'Candlestick',
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350'
    });

    // Add volume histogram series (v5 API)
    const volumeSeries = chart.addSeries({
      type: 'Histogram',
      color: '#26a69a',
      priceFormat: {
        type: 'volume'
      },
      priceScaleId: ''
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update chart data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return;

    try {
      // Convert candles to chart format with proper timestamp handling
      const candleData: CandlestickData[] = candles
        .map((candle) => {
          // Handle both Date objects and timestamp strings
          const timestamp = candle.timestamp instanceof Date
            ? candle.timestamp.getTime()
            : new Date(candle.timestamp).getTime();

          // Convert to UTC timestamp in seconds (lightweight-charts requirement)
          const utcTimestamp = Math.floor(timestamp / 1000);

          return {
            time: utcTimestamp as Time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close
          };
        })
        .filter((data) => !isNaN(data.time as number)); // Filter out invalid timestamps

      const volumeData = candles
        .map((candle) => {
          const timestamp = candle.timestamp instanceof Date
            ? candle.timestamp.getTime()
            : new Date(candle.timestamp).getTime();
          const utcTimestamp = Math.floor(timestamp / 1000);

          return {
            time: utcTimestamp as Time,
            value: candle.volume,
            color: candle.close >= candle.open ? '#26a69a80' : '#ef535080'
          };
        })
        .filter((data) => !isNaN(data.time as number));

      if (candleData.length === 0) return;

      candleSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volumeData);

      // Add markers for positions
      if (positions.length > 0) {
        const markers = positions.map((position) => {
          const lastTime = candleData[candleData.length - 1].time;
          return {
            time: lastTime,
            position: (position.side === 'LONG' ? 'belowBar' : 'aboveBar') as 'belowBar' | 'aboveBar',
            color: position.side === 'LONG' ? '#26a69a' : '#ef5350',
            shape: (position.side === 'LONG' ? 'arrowUp' : 'arrowDown') as 'arrowUp' | 'arrowDown',
            text: `${position.side} @ ₹${position.entryPrice.toFixed(2)}`
          };
        });

        candleSeriesRef.current.setMarkers(markers);
      }
    } catch (error) {
      console.error('[LiveChart] Error updating chart data:', error);
    }
  }, [candles, positions]);

  return (
    <div className="live-chart">
      <div className="chart-header">
        <h3>Live Chart</h3>
        <div className="chart-controls">
          <div className="interval-selector">
            <button
              className={`interval-btn ${interval === '1m' ? 'active' : ''}`}
              onClick={() => onIntervalChange?.('1m')}
            >
              1m
            </button>
            <button
              className={`interval-btn ${interval === '5m' ? 'active' : ''}`}
              onClick={() => onIntervalChange?.('5m')}
            >
              5m
            </button>
          </div>
        </div>
      </div>

      <div className="chart-container" ref={chartContainerRef}></div>

      {candles.length === 0 && (
        <div className="chart-empty">
          <p>Waiting for candle data...</p>
          <span className="loading-spinner">⏳</span>
        </div>
      )}
    </div>
  );
};

export default LiveChart;

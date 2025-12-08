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

import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
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
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

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

    // Use the correct v5 API - addSeries with class
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350'
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume'
      },
      priceScaleId: '',
      scaleMargins: {
        top: 0.8,
        bottom: 0
      }
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

    // Convert candles to chart format
    const candleData: CandlestickData[] = candles.map((candle) => ({
      time: (new Date(candle.timestamp).getTime() / 1000) as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close
    }));

    const volumeData = candles.map((candle) => ({
      time: (new Date(candle.timestamp).getTime() / 1000) as Time,
      value: candle.volume,
      color: candle.close >= candle.open ? '#26a69a80' : '#ef535080'
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    // Add markers for positions
    if (positions.length > 0 && candleData.length > 0) {
      const markers = positions.map((position) => {
        const lastTime = candleData[candleData.length - 1].time;
        return {
          time: lastTime,
          position: position.side === 'LONG' ? 'belowBar' : 'aboveBar',
          color: position.side === 'LONG' ? '#26a69a' : '#ef5350',
          shape: position.side === 'LONG' ? 'arrowUp' : 'arrowDown',
          text: `${position.side} @ ₹${position.entryPrice.toFixed(2)}`
        };
      });

      candleSeriesRef.current.setMarkers(markers as any);
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

/**
 * Client WebSocket Server
 *
 * Internal WebSocket server that broadcasts real-time market data to connected frontend clients
 *
 * Events broadcasted:
 * - tick: Real-time tick updates
 * - candle: New candle updates
 * - signal: Trading signals generated
 * - position: Position updates
 * - portfolio: Portfolio updates
 *
 * Uses Socket.IO for reliable WebSocket connections with automatic reconnection
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import DhanWebSocketManager from './DhanWebSocketManager';
import CandleAggregator from './CandleAggregator';
import StrategyEngine from './StrategyEngine';
import PaperTradingEngine from './PaperTradingEngine';
import PortfolioModel from '../models/Portfolio';

class ClientWebSocketServer {
  private io: SocketIOServer | null = null;
  private connectedClients: Set<string> = new Set();

  /**
   * Initialize Socket.IO server
   *
   * @param httpServer - Express HTTP server instance
   */
  initialize(httpServer: HTTPServer): void {
    console.log('[ClientWebSocketServer] Initializing Socket.IO server...');

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Handle client connections
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });

    // Subscribe to backend events
    this.subscribeToBackendEvents();

    console.log('[ClientWebSocketServer] Socket.IO server initialized');
  }

  /**
   * Handle new client connection
   */
  private handleConnection(socket: Socket): void {
    const clientId = socket.id;
    this.connectedClients.add(clientId);

    console.log(`[ClientWebSocketServer] Client connected: ${clientId} (Total: ${this.connectedClients.size})`);

    // Send initial status on connection
    this.sendInitialStatus(socket);

    // Handle client requests
    socket.on('subscribe:ticks', () => {
      console.log(`[ClientWebSocketServer] Client ${clientId} subscribed to ticks`);
      socket.join('ticks');
    });

    socket.on('subscribe:candles', () => {
      console.log(`[ClientWebSocketServer] Client ${clientId} subscribed to candles`);
      socket.join('candles');
    });

    socket.on('subscribe:signals', () => {
      console.log(`[ClientWebSocketServer] Client ${clientId} subscribed to signals`);
      socket.join('signals');
    });

    socket.on('subscribe:positions', () => {
      console.log(`[ClientWebSocketServer] Client ${clientId} subscribed to positions`);
      socket.join('positions');
    });

    socket.on('subscribe:portfolio', () => {
      console.log(`[ClientWebSocketServer] Client ${clientId} subscribed to portfolio`);
      socket.join('portfolio');
    });

    socket.on('request:portfolio', async () => {
      await this.sendPortfolioUpdate(socket);
    });

    socket.on('request:positions', async () => {
      const positions = PaperTradingEngine.getOpenPositions();
      socket.emit('positions:list', positions);
    });

    socket.on('request:strategies', () => {
      const strategies = StrategyEngine.getStatus();
      socket.emit('strategies:status', strategies);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      this.connectedClients.delete(clientId);
      console.log(`[ClientWebSocketServer] Client disconnected: ${clientId} (Total: ${this.connectedClients.size})`);
    });
  }

  /**
   * Send initial status to newly connected client
   */
  private async sendInitialStatus(socket: Socket): Promise<void> {
    try {
      const status = {
        dhanConnected: DhanWebSocketManager.getConnectionStatus(),
        subscribedInstruments: DhanWebSocketManager.getSubscribedInstruments(),
        candleAggregator: CandleAggregator.getStatus(),
        strategyEngine: StrategyEngine.getStatus(),
        paperTradingEngine: PaperTradingEngine.getStatus(),
        timestamp: new Date()
      };

      socket.emit('status', status);

      // Send portfolio data
      await this.sendPortfolioUpdate(socket);

      // Send open positions
      const positions = PaperTradingEngine.getOpenPositions();
      socket.emit('positions:list', positions);

    } catch (error) {
      console.error('[ClientWebSocketServer] Error sending initial status:', error);
    }
  }

  /**
   * Subscribe to backend events and broadcast to clients
   */
  private subscribeToBackendEvents(): void {
    // Tick updates
    DhanWebSocketManager.on('tick', (tick) => {
      this.broadcast('ticks', 'tick', tick);
    });

    // Candle updates
    CandleAggregator.on('candle:close', (candle, depthMetrics) => {
      this.broadcast('candles', 'candle', {
        candle,
        depthMetrics
      });
    });

    // Signal updates
    StrategyEngine.on('signal', async (signalEvent) => {
      this.broadcast('signals', 'signal', signalEvent);

      // Also send updated strategies status
      const strategies = StrategyEngine.getStatus();
      this.broadcast('signals', 'strategies:status', strategies);
    });

    // Position updates
    PaperTradingEngine.on('positionUpdate', async (position) => {
      this.broadcast('positions', 'position:update', position);

      // Send updated portfolio
      await this.broadcastPortfolioUpdate();
    });

    PaperTradingEngine.on('positionClosed', async (position) => {
      this.broadcast('positions', 'position:closed', position);

      // Send updated portfolio
      await this.broadcastPortfolioUpdate();

      // Send updated strategies status
      const strategies = StrategyEngine.getStatus();
      this.broadcast('signals', 'strategies:status', strategies);
    });

    console.log('[ClientWebSocketServer] Subscribed to backend events');
  }

  /**
   * Broadcast message to all clients in a room
   */
  private broadcast(room: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(room).emit(event, data);
    }
  }

  /**
   * Send portfolio update to specific client
   */
  private async sendPortfolioUpdate(socket: Socket): Promise<void> {
    try {
      const portfolio = await PortfolioModel.findOne({});
      if (portfolio) {
        socket.emit('portfolio:update', portfolio);
      }
    } catch (error) {
      console.error('[ClientWebSocketServer] Error sending portfolio update:', error);
    }
  }

  /**
   * Broadcast portfolio update to all subscribed clients
   */
  private async broadcastPortfolioUpdate(): Promise<void> {
    try {
      const portfolio = await PortfolioModel.findOne({});
      if (portfolio && this.io) {
        this.io.to('portfolio').emit('portfolio:update', portfolio);
      }
    } catch (error) {
      console.error('[ClientWebSocketServer] Error broadcasting portfolio update:', error);
    }
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get Socket.IO instance
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }
}

// Singleton instance
export default new ClientWebSocketServer();

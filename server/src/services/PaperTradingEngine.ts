/**
 * Paper Trading Engine Service
 *
 * Responsibilities:
 * - Listen for signals from Strategy Engine
 * - Validate signals against risk limits
 * - Simulate order execution using current market price
 * - Create and track paper positions
 * - Monitor positions for stop loss and target hits
 * - Update P&L in real-time
 * - Square off all intraday positions at 3:20 PM
 * - Enforce risk management rules
 *
 * Singleton pattern - single instance manages all paper trades
 */

import { EventEmitter } from 'events';
import { ITick } from '../models/Tick';
import { ISignal } from '../models/Signal';
import { IPaperOrder } from '../models/PaperOrder';
import { IPaperPosition } from '../models/PaperPosition';
import { IPortfolio } from '../models/Portfolio';
import SignalModel from '../models/Signal';
import PaperOrderModel from '../models/PaperOrder';
import PaperPositionModel from '../models/PaperPosition';
import PortfolioModel from '../models/Portfolio';
import DhanWebSocketManager from './DhanWebSocketManager';
import StrategyEngine from './StrategyEngine';
import { EnrichedTick } from './DhanWebSocketManager';

interface SignalEvent {
  signal: ISignal;
  strategyName: string;
  candle: any;
}

class PaperTradingEngine extends EventEmitter {
  private openPositions: Map<string, IPaperPosition> = new Map();
  private isRunning: boolean = false;
  private eodSquareOffScheduled: boolean = false;

  // Default user ID (will be replaced when multi-user support is added)
  private defaultUserId: string | null = null;

  constructor() {
    super();
  }

  /**
   * Initialize and start the Paper Trading Engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[PaperTradingEngine] Already running');
      return;
    }

    console.log('[PaperTradingEngine] Starting Paper Trading Engine...');

    // Initialize default user portfolio (if doesn't exist)
    await this.initializeDefaultPortfolio();

    // Subscribe to signals from Strategy Engine
    StrategyEngine.on('signal', this.onSignal.bind(this));

    // Subscribe to ticks from Dhan WebSocket for position monitoring
    DhanWebSocketManager.on('tick', this.onTick.bind(this));

    // Load existing open positions from database
    await this.loadOpenPositions();

    // Schedule EOD square-off
    this.scheduleEODSquareOff();

    this.isRunning = true;

    console.log('[PaperTradingEngine] Started');
    console.log(`[PaperTradingEngine] Monitoring ${this.openPositions.size} open positions`);
  }

  /**
   * Stop the Paper Trading Engine
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('[PaperTradingEngine] Stopping...');

    // Unsubscribe from events
    StrategyEngine.off('signal', this.onSignal.bind(this));
    DhanWebSocketManager.off('tick', this.onTick.bind(this));

    this.isRunning = false;

    console.log('[PaperTradingEngine] Stopped');
  }

  /**
   * Initialize default user portfolio with ₹20,000 capital
   */
  private async initializeDefaultPortfolio(): Promise<void> {
    try {
      // For now, create a single portfolio for testing
      // TODO: Link to actual user when authentication context is available
      let portfolio = await PortfolioModel.findOne({});

      if (!portfolio) {
        portfolio = await PortfolioModel.create({
          totalCapital: 20000,
          availableCapital: 20000,
          usedMargin: 0,
          todayPnL: 0,
          weekPnL: 0,
          totalPnL: 0,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          maxDailyLoss: 600, // 3% of 20,000
          currentDailyLoss: 0
        });

        console.log('[PaperTradingEngine] Created default portfolio with ₹20,000 capital');
      }

      this.defaultUserId = portfolio._id.toString();

    } catch (error) {
      console.error('[PaperTradingEngine] Error initializing portfolio:', error);
    }
  }

  /**
   * Load existing open positions from database
   */
  private async loadOpenPositions(): Promise<void> {
    try {
      const openPositions = await PaperPositionModel.find({ status: 'open' });

      for (const position of openPositions) {
        this.openPositions.set(position._id.toString(), position);
      }

      console.log(`[PaperTradingEngine] Loaded ${openPositions.length} open positions from database`);

    } catch (error) {
      console.error('[PaperTradingEngine] Error loading positions:', error);
    }
  }

  /**
   * Handle signal event from Strategy Engine
   */
  private async onSignal(event: SignalEvent): Promise<void> {
    try {
      console.log(`\n[PaperTradingEngine] 📥 Received signal from ${event.strategyName}`);

      await this.executeSignal(event.signal);

    } catch (error) {
      console.error('[PaperTradingEngine] Error handling signal:', error);
    }
  }

  /**
   * Execute a trading signal
   *
   * Steps:
   * 1. Validate risk limits
   * 2. Simulate order execution
   * 3. Create paper position
   * 4. Update portfolio
   */
  private async executeSignal(signal: ISignal): Promise<void> {
    try {
      // Get portfolio
      const portfolio = await PortfolioModel.findById(this.defaultUserId);

      if (!portfolio) {
        console.error('[PaperTradingEngine] Portfolio not found');
        await this.rejectSignal(signal._id, 'Portfolio not found');
        return;
      }

      // Check daily loss limit
      if (portfolio.isDailyLossLimitReached()) {
        console.log(`[PaperTradingEngine] ❌ Signal rejected: Daily loss limit reached (₹${portfolio.currentDailyLoss.toFixed(2)} / ₹${portfolio.maxDailyLoss.toFixed(2)})`);
        await this.rejectSignal(signal._id, 'Daily loss limit reached');
        return;
      }

      // Check if sufficient capital available
      const requiredCapital = signal.price * signal.quantity;
      if (portfolio.availableCapital < requiredCapital) {
        console.log(`[PaperTradingEngine] ❌ Signal rejected: Insufficient capital (Required: ₹${requiredCapital.toFixed(2)}, Available: ₹${portfolio.availableCapital.toFixed(2)})`);
        await this.rejectSignal(signal._id, 'Insufficient capital');
        return;
      }

      // Simulate order execution (use signal price as execution price)
      const executionPrice = signal.price;

      console.log(`[PaperTradingEngine] ✓ Executing paper order: ${signal.type} ${signal.quantity} @ ₹${executionPrice.toFixed(2)}`);

      // Create paper order
      const order = await PaperOrderModel.create({
        userId: portfolio._id,
        signalId: signal._id,
        strategyName: signal.strategyName,
        securityId: signal.securityId,
        side: signal.type === 'BUY' ? 'BUY' : 'SELL',
        quantity: signal.quantity,
        orderPrice: signal.price,
        executionPrice: executionPrice,
        status: 'executed',
        executionTime: new Date()
      });

      console.log(`[PaperTradingEngine] Paper order created: ${order._id}`);

      // Create paper position
      const position = await PaperPositionModel.create({
        userId: portfolio._id,
        securityId: signal.securityId,
        strategyName: signal.strategyName,
        side: signal.type === 'BUY' ? 'LONG' : 'SHORT',
        quantity: signal.quantity,
        entryPrice: executionPrice,
        currentPrice: executionPrice,
        stopLoss: signal.stopLoss,
        target: signal.target,
        unrealizedPnL: 0,
        realizedPnL: 0,
        status: 'open',
        entryOrderId: order._id,
        entryTime: new Date()
      });

      console.log(`[PaperTradingEngine] Position opened: ${position._id}`);

      // Add to open positions map
      this.openPositions.set(position._id.toString(), position);

      // Update portfolio
      portfolio.availableCapital -= requiredCapital;
      portfolio.usedMargin += requiredCapital;
      await portfolio.save();

      // Update signal status
      await SignalModel.findByIdAndUpdate(signal._id, {
        status: 'executed',
        executionPrice: executionPrice,
        executionTime: new Date()
      });

      console.log(`[PaperTradingEngine] ✅ Signal executed successfully`);
      console.log(`[PaperTradingEngine] Available capital: ₹${portfolio.availableCapital.toFixed(2)}`);
      console.log(`[PaperTradingEngine] Open positions: ${this.openPositions.size}\n`);

      // Emit position update event
      this.emit('positionUpdate', position);

    } catch (error) {
      console.error('[PaperTradingEngine] Error executing signal:', error);
      await this.rejectSignal(signal._id, 'Execution error');
    }
  }

  /**
   * Reject a signal
   */
  private async rejectSignal(signalId: any, reason: string): Promise<void> {
    await SignalModel.findByIdAndUpdate(signalId, {
      status: 'rejected',
      rejectionReason: reason
    });
  }

  /**
   * Handle tick event - Monitor positions for stop loss and target
   */
  private async onTick(tick: EnrichedTick): Promise<void> {
    try {
      // Iterate through open positions
      for (const [posId, position] of this.openPositions.entries()) {
        // Skip if tick is for different security
        if (position.securityId !== tick.securityId) {
          continue;
        }

        // Update current price
        position.currentPrice = tick.ltp;

        // Calculate unrealized P&L
        if (position.side === 'LONG') {
          position.unrealizedPnL = (tick.ltp - position.entryPrice) * position.quantity;
        } else {
          position.unrealizedPnL = (position.entryPrice - tick.ltp) * position.quantity;
        }

        // Check stop loss
        if (this.isStopLossHit(position, tick.ltp)) {
          console.log(`[PaperTradingEngine] 🛑 Stop loss hit for position ${posId}`);
          await this.closePosition(position, tick.ltp, 'stop_loss');
          continue;
        }

        // Check target
        if (this.isTargetHit(position, tick.ltp)) {
          console.log(`[PaperTradingEngine] 🎯 Target hit for position ${posId}`);
          await this.closePosition(position, tick.ltp, 'target');
          continue;
        }

        // Save updated position (unrealized P&L)
        await PaperPositionModel.findByIdAndUpdate(position._id, {
          currentPrice: position.currentPrice,
          unrealizedPnL: position.unrealizedPnL
        });

        // Emit position update
        this.emit('positionUpdate', position);
      }

    } catch (error) {
      console.error('[PaperTradingEngine] Error monitoring positions:', error);
    }
  }

  /**
   * Check if stop loss is hit
   */
  private isStopLossHit(position: IPaperPosition, currentPrice: number): boolean {
    if (position.side === 'LONG') {
      return currentPrice <= position.stopLoss;
    } else {
      return currentPrice >= position.stopLoss;
    }
  }

  /**
   * Check if target is hit
   */
  private isTargetHit(position: IPaperPosition, currentPrice: number): boolean {
    if (position.side === 'LONG') {
      return currentPrice >= position.target;
    } else {
      return currentPrice <= position.target;
    }
  }

  /**
   * Close a position
   */
  private async closePosition(
    position: IPaperPosition,
    exitPrice: number,
    exitReason: 'stop_loss' | 'target' | 'eod_squareoff' | 'manual'
  ): Promise<void> {
    try {
      // Calculate realized P&L
      if (position.side === 'LONG') {
        position.realizedPnL = (exitPrice - position.entryPrice) * position.quantity;
      } else {
        position.realizedPnL = (position.entryPrice - exitPrice) * position.quantity;
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 POSITION CLOSED`);
      console.log(`${'='.repeat(60)}`);
      console.log(`Strategy: ${position.strategyName}`);
      console.log(`Side: ${position.side}`);
      console.log(`Quantity: ${position.quantity}`);
      console.log(`Entry: ₹${position.entryPrice.toFixed(2)}`);
      console.log(`Exit: ₹${exitPrice.toFixed(2)}`);
      console.log(`Reason: ${exitReason}`);
      console.log(`P&L: ${position.realizedPnL >= 0 ? '+' : ''}₹${position.realizedPnL.toFixed(2)}`);
      console.log(`${'='.repeat(60)}\n`);

      // Update position in database
      await PaperPositionModel.findByIdAndUpdate(position._id, {
        status: 'closed',
        exitTime: new Date(),
        exitReason: exitReason,
        realizedPnL: position.realizedPnL,
        currentPrice: exitPrice
      });

      // Update portfolio
      const portfolio = await PortfolioModel.findById(position.userId);

      if (portfolio) {
        // Return capital
        const positionValue = position.entryPrice * position.quantity;
        portfolio.availableCapital += positionValue;
        portfolio.usedMargin -= positionValue;

        // Add P&L
        portfolio.availableCapital += position.realizedPnL;
        portfolio.totalPnL += position.realizedPnL;
        portfolio.todayPnL += position.realizedPnL;

        // Update trade statistics
        portfolio.totalTrades += 1;

        if (position.realizedPnL > 0) {
          portfolio.winningTrades += 1;
        } else {
          portfolio.losingTrades += 1;
          portfolio.currentDailyLoss += Math.abs(position.realizedPnL);
        }

        portfolio.winRate = (portfolio.winningTrades / portfolio.totalTrades) * 100;

        await portfolio.save();

        console.log(`[PaperTradingEngine] Portfolio updated:`);
        console.log(`  Available Capital: ₹${portfolio.availableCapital.toFixed(2)}`);
        console.log(`  Total P&L: ₹${portfolio.totalPnL.toFixed(2)}`);
        console.log(`  Today P&L: ₹${portfolio.todayPnL.toFixed(2)}`);
        console.log(`  Win Rate: ${portfolio.winRate.toFixed(1)}%\n`);
      }

      // Remove from open positions map
      this.openPositions.delete(position._id.toString());

      // Emit position closed event
      this.emit('positionClosed', position);

    } catch (error) {
      console.error('[PaperTradingEngine] Error closing position:', error);
    }
  }

  /**
   * Schedule EOD square-off at 3:20 PM
   */
  private scheduleEODSquareOff(): void {
    // Check every minute if it's 3:20 PM
    setInterval(() => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Square off at 3:20 PM
      if (hours === 15 && minutes === 20 && !this.eodSquareOffScheduled) {
        this.squareOffAllPositions();
        this.eodSquareOffScheduled = true;
      }

      // Reset flag at 3:21 PM
      if (hours === 15 && minutes === 21) {
        this.eodSquareOffScheduled = false;
      }
    }, 60000); // Check every minute

    console.log('[PaperTradingEngine] EOD square-off scheduled for 3:20 PM');
  }

  /**
   * Square off all open positions (called at 3:20 PM for intraday positions)
   */
  async squareOffAllPositions(): Promise<void> {
    console.log('\n[PaperTradingEngine] ⏰ Squaring off all open positions at EOD...');

    for (const [posId, position] of this.openPositions.entries()) {
      // Use current price as exit price
      const currentLTP = position.currentPrice;

      console.log(`[PaperTradingEngine] Squaring off position ${posId} @ ₹${currentLTP.toFixed(2)}`);

      await this.closePosition(position, currentLTP, 'eod_squareoff');
    }

    console.log('[PaperTradingEngine] All positions squared off\n');
  }

  /**
   * Get open positions
   */
  getOpenPositions(): IPaperPosition[] {
    return Array.from(this.openPositions.values());
  }

  /**
   * Get status
   */
  getStatus(): {
    isRunning: boolean;
    openPositions: number;
  } {
    return {
      isRunning: this.isRunning,
      openPositions: this.openPositions.size
    };
  }
}

// Singleton instance
export default new PaperTradingEngine();

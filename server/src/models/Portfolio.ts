import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPortfolio extends Document {
  userId: Types.ObjectId;

  totalCapital: number;      // ₹20,000
  availableCapital: number;
  usedMargin: number;

  todayPnL: number;
  weekPnL: number;
  monthPnL: number;
  totalPnL: number;

  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;            // Percentage

  maxDailyLoss: number;       // 3% of capital = ₹600
  currentDailyLoss: number;

  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  updateWinRate(): void;
  isDailyLossLimitReached(): boolean;
}

const PortfolioSchema = new Schema<IPortfolio>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },

  totalCapital: {
    type: Number,
    required: true,
    default: 20000
  },
  availableCapital: {
    type: Number,
    required: true,
    default: 20000
  },
  usedMargin: {
    type: Number,
    default: 0
  },

  todayPnL: {
    type: Number,
    default: 0
  },
  weekPnL: {
    type: Number,
    default: 0
  },
  monthPnL: {
    type: Number,
    default: 0
  },
  totalPnL: {
    type: Number,
    default: 0
  },

  totalTrades: {
    type: Number,
    default: 0
  },
  winningTrades: {
    type: Number,
    default: 0
  },
  losingTrades: {
    type: Number,
    default: 0
  },
  winRate: {
    type: Number,
    default: 0
  },

  maxDailyLoss: {
    type: Number,
    required: true,
    default: 600  // 3% of 20,000
  },
  currentDailyLoss: {
    type: Number,
    default: 0
  },

  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Method to update win rate
PortfolioSchema.methods.updateWinRate = function() {
  if (this.totalTrades > 0) {
    this.winRate = (this.winningTrades / this.totalTrades) * 100;
  } else {
    this.winRate = 0;
  }
};

// Method to check if daily loss limit is reached
PortfolioSchema.methods.isDailyLossLimitReached = function(): boolean {
  return this.currentDailyLoss >= this.maxDailyLoss;
};

// Method to reset daily counters
PortfolioSchema.methods.resetDailyCounters = function() {
  this.todayPnL = 0;
  this.currentDailyLoss = 0;
  this.lastUpdated = new Date();
};

export default mongoose.model<IPortfolio>('Portfolio', PortfolioSchema);

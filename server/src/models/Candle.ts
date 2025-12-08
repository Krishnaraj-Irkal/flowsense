import mongoose, { Document, Schema } from 'mongoose';

export interface ICandle extends Document {
  securityId: string;
  interval: '1m' | '5m' | '15m' | '1h' | '1d';
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;

  // Aggregate depth metrics for the candle period
  avgBidAskImbalance: number;
  avgDepthSpread: number;
  avgOrderBookStrength: number;

  timestamp: Date;
  isClosed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CandleSchema = new Schema<ICandle>({
  securityId: {
    type: String,
    required: true,
    index: true
  },
  interval: {
    type: String,
    required: true,
    enum: ['1m', '5m', '15m', '1h', '1d'],
    index: true
  },
  open: {
    type: Number,
    required: true
  },
  high: {
    type: Number,
    required: true
  },
  low: {
    type: Number,
    required: true
  },
  close: {
    type: Number,
    required: true
  },
  volume: {
    type: Number,
    required: true,
    default: 0
  },

  // Aggregate depth metrics
  avgBidAskImbalance: {
    type: Number,
    required: true,
    default: 1
  },
  avgDepthSpread: {
    type: Number,
    required: true,
    default: 0
  },
  avgOrderBookStrength: {
    type: Number,
    required: true,
    default: 0
  },

  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  isClosed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
CandleSchema.index({ securityId: 1, interval: 1, timestamp: -1 });

// TTL indexes - different expiry for different intervals
// 1-minute candles: 7 days (604800 seconds)
// Other candles: handled separately or no TTL
CandleSchema.index(
  { timestamp: 1 },
  {
    expireAfterSeconds: 604800,
    partialFilterExpression: { interval: '1m' }
  }
);

// Unique constraint to prevent duplicate candles
CandleSchema.index(
  { securityId: 1, interval: 1, timestamp: 1 },
  { unique: true }
);

export default mongoose.model<ICandle>('Candle', CandleSchema);

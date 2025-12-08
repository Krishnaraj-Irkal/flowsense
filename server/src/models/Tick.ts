import mongoose, { Document, Schema } from 'mongoose';

export interface ITick extends Document {
  securityId: string;
  ltp: number;
  ltq: number;
  ltt: Date;
  volume: number;
  totalBuyQty: number;
  totalSellQty: number;

  // Market depth metrics (calculated)
  bidAskImbalance: number;
  depthSpread: number;
  orderBookStrength: number;
  volumeDelta: number;
  liquidityScore: number;

  timestamp: Date;
}

const TickSchema = new Schema<ITick>({
  securityId: {
    type: String,
    required: true,
    index: true
  },
  ltp: {
    type: Number,
    required: true
  },
  ltq: {
    type: Number,
    required: true
  },
  ltt: {
    type: Date,
    required: true
  },
  volume: {
    type: Number,
    required: true
  },
  totalBuyQty: {
    type: Number,
    required: true
  },
  totalSellQty: {
    type: Number,
    required: true
  },

  // Market depth metrics
  bidAskImbalance: {
    type: Number,
    required: true
  },
  depthSpread: {
    type: Number,
    required: true
  },
  orderBookStrength: {
    type: Number,
    required: true
  },
  volumeDelta: {
    type: Number,
    required: true
  },
  liquidityScore: {
    type: Number,
    required: true
  },

  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false
});

// Compound index for queries
TickSchema.index({ securityId: 1, timestamp: -1 });

// TTL index - auto-delete after 24 hours (86400 seconds)
TickSchema.index({ timestamp: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model<ITick>('Tick', TickSchema);

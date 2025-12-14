import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISignal extends Document {
  userId: Types.ObjectId;
  strategyName: string;
  securityId: string;
  type: 'BUY' | 'SELL';
  price: number;
  reason: string;

  // Market depth context at signal generation
  bidAskImbalance: number;
  orderBookStrength: number;
  liquidityScore: number;

  // Signal quality metrics
  qualityScore: number;              // 0-100 signal quality
  strategyWeight: number;             // Weight multiplier for this strategy
  isMultiTimeframeAligned: boolean;   // Multi-timeframe confirmation

  // Risk parameters (1:3 R:R)
  stopLoss: number;
  target: number;
  quantity: number;

  status: 'pending' | 'executed' | 'rejected' | 'expired';

  // Order details (if executed)
  orderId?: Types.ObjectId;
  executionPrice?: number;
  executionTime?: Date;

  // Rejection details
  rejectionReason?: string;

  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SignalSchema = new Schema<ISignal>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  strategyName: {
    type: String,
    required: true,
    index: true
  },
  securityId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['BUY', 'SELL']
  },
  price: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true
  },

  // Market depth context
  bidAskImbalance: {
    type: Number,
    required: true
  },
  orderBookStrength: {
    type: Number,
    required: true
  },
  liquidityScore: {
    type: Number,
    required: true,
    default: 0
  },

  // Signal quality metrics
  qualityScore: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 100
  },
  strategyWeight: {
    type: Number,
    required: true,
    default: 1.0
  },
  isMultiTimeframeAligned: {
    type: Boolean,
    required: true,
    default: false
  },

  // Risk parameters
  stopLoss: {
    type: Number,
    required: true
  },
  target: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },

  status: {
    type: String,
    required: true,
    enum: ['pending', 'executed', 'rejected', 'expired'],
    default: 'pending',
    index: true
  },

  // Execution details
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'PaperOrder'
  },
  executionPrice: {
    type: Number
  },
  executionTime: {
    type: Date
  },

  // Rejection details
  rejectionReason: {
    type: String
  },

  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for queries
SignalSchema.index({ userId: 1, timestamp: -1 });
SignalSchema.index({ userId: 1, status: 1, timestamp: -1 });
SignalSchema.index({ strategyName: 1, timestamp: -1 });

export default mongoose.model<ISignal>('Signal', SignalSchema);

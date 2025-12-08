import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPaperPosition extends Document {
  userId: Types.ObjectId;
  securityId: string;
  strategyName: string;

  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  currentPrice: number;      // Updated in real-time

  stopLoss: number;
  target: number;

  unrealizedPnL: number;     // (currentPrice - entryPrice) × quantity
  realizedPnL: number;       // Filled on exit

  status: 'open' | 'closed';

  entryOrderId: Types.ObjectId;
  exitOrderId?: Types.ObjectId;

  entryTime: Date;
  exitTime?: Date;
  exitReason?: string;       // "target", "stop_loss", "eod_squareoff", "manual"

  createdAt: Date;
  updatedAt: Date;
}

const PaperPositionSchema = new Schema<IPaperPosition>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  securityId: {
    type: String,
    required: true,
    index: true
  },
  strategyName: {
    type: String,
    required: true,
    index: true
  },

  side: {
    type: String,
    required: true,
    enum: ['LONG', 'SHORT']
  },
  quantity: {
    type: Number,
    required: true
  },
  entryPrice: {
    type: Number,
    required: true
  },
  currentPrice: {
    type: Number,
    required: true
  },

  stopLoss: {
    type: Number,
    required: true
  },
  target: {
    type: Number,
    required: true
  },

  unrealizedPnL: {
    type: Number,
    required: true,
    default: 0
  },
  realizedPnL: {
    type: Number,
    default: 0
  },

  status: {
    type: String,
    required: true,
    enum: ['open', 'closed'],
    default: 'open',
    index: true
  },

  entryOrderId: {
    type: Schema.Types.ObjectId,
    ref: 'PaperOrder',
    required: true
  },
  exitOrderId: {
    type: Schema.Types.ObjectId,
    ref: 'PaperOrder'
  },

  entryTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  exitTime: {
    type: Date
  },
  exitReason: {
    type: String,
    enum: ['target', 'stop_loss', 'eod_squareoff', 'manual']
  }
}, {
  timestamps: true
});

// Compound indexes for queries
PaperPositionSchema.index({ userId: 1, status: 1 });
PaperPositionSchema.index({ userId: 1, entryTime: -1 });
PaperPositionSchema.index({ strategyName: 1, status: 1 });

export default mongoose.model<IPaperPosition>('PaperPosition', PaperPositionSchema);

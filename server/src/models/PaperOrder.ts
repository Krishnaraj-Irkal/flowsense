import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPaperOrder extends Document {
  userId: Types.ObjectId;
  signalId: Types.ObjectId;
  strategyName: string;
  securityId: string;

  side: 'BUY' | 'SELL';
  quantity: number;
  orderPrice: number;        // Price at which order placed
  executionPrice: number;    // Simulated fill price (LTP at execution)

  status: 'pending' | 'executed' | 'cancelled';

  executionTime?: Date;
  cancellationReason?: string;

  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaperOrderSchema = new Schema<IPaperOrder>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  signalId: {
    type: Schema.Types.ObjectId,
    ref: 'Signal',
    required: true
  },
  strategyName: {
    type: String,
    required: true
  },
  securityId: {
    type: String,
    required: true
  },

  side: {
    type: String,
    required: true,
    enum: ['BUY', 'SELL']
  },
  quantity: {
    type: Number,
    required: true
  },
  orderPrice: {
    type: Number,
    required: true
  },
  executionPrice: {
    type: Number,
    required: true
  },

  status: {
    type: String,
    required: true,
    enum: ['pending', 'executed', 'cancelled'],
    default: 'pending',
    index: true
  },

  executionTime: {
    type: Date
  },
  cancellationReason: {
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

// Compound indexes
PaperOrderSchema.index({ userId: 1, timestamp: -1 });
PaperOrderSchema.index({ userId: 1, status: 1 });
PaperOrderSchema.index({ strategyName: 1, timestamp: -1 });

export default mongoose.model<IPaperOrder>('PaperOrder', PaperOrderSchema);

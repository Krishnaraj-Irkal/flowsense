import mongoose, { Document, Schema } from 'mongoose';

export interface IInstrument extends Document {
  displayName: string;
  symbol: string;
  securityId: string;
  exchangeSegment: string;
  exchange: string;
  instrumentType: string;
  lotSize: number;
  tickSize: number;
  futureSymbol?: string;
  futureExchangeSegment?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InstrumentSchema = new Schema<IInstrument>({
  displayName: {
    type: String,
    required: true
  },
  symbol: {
    type: String,
    required: true,
    index: true
  },
  securityId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  exchangeSegment: {
    type: String,
    required: true
  },
  exchange: {
    type: String,
    required: true
  },
  instrumentType: {
    type: String,
    required: true,
    enum: ['INDEX', 'EQUITY', 'FUTURES', 'OPTIONS', 'COMMODITY']
  },
  lotSize: {
    type: Number,
    required: true,
    default: 1
  },
  tickSize: {
    type: Number,
    required: true,
    default: 0.05
  },
  futureSymbol: {
    type: String
  },
  futureExchangeSegment: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for quick lookups
InstrumentSchema.index({ symbol: 1, exchangeSegment: 1 });

export default mongoose.model<IInstrument>('Instrument', InstrumentSchema);

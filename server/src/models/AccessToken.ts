import mongoose, { Document, Schema } from 'mongoose';

export interface IAccessToken extends Document {
  userId: mongoose.Types.ObjectId;
  tickFeedToken: string;
  marketDepthToken: string;
  optionChainToken: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AccessTokenSchema = new Schema<IAccessToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    tickFeedToken: {
      type: String,
      required: [true, 'Tick Feed Token is required'],
    },
    marketDepthToken: {
      type: String,
      required: [true, 'Market Depth Token is required'],
    },
    optionChainToken: {
      type: String,
      required: [true, 'Option Chain Token is required'],
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
AccessTokenSchema.index({ userId: 1 });
AccessTokenSchema.index({ expiresAt: 1 });

export default mongoose.model<IAccessToken>('AccessToken', AccessTokenSchema);

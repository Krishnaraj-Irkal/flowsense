import { Response } from 'express';
import AccessToken from '../models/AccessToken';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

// Calculate next 9 AM expiry
const getNextNineAM = (): Date => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow;
};

export const saveTokens = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { clientId, tickFeedToken, marketDepthToken, optionChainToken } =
      req.body;

    if (!tickFeedToken || !marketDepthToken || !optionChainToken) {
      res.status(400).json({ error: 'All tokens are required' });
      return;
    }

    const userId = req.user?.userId;

    // Update user's clientId if provided
    if (clientId) {
      await User.findByIdAndUpdate(userId, { clientId });
    }

    // Check if tokens already exist
    let tokens = await AccessToken.findOne({ userId });

    const expiresAt = getNextNineAM();

    if (tokens) {
      // Update existing tokens
      tokens.tickFeedToken = tickFeedToken;
      tokens.marketDepthToken = marketDepthToken;
      tokens.optionChainToken = optionChainToken;
      tokens.expiresAt = expiresAt;
      await tokens.save();
    } else {
      // Create new tokens
      tokens = await AccessToken.create({
        userId,
        tickFeedToken,
        marketDepthToken,
        optionChainToken,
        expiresAt,
      });
    }

    // Update isFirstLogin to false
    await User.findByIdAndUpdate(userId, { isFirstLogin: false });

    res.json({
      message: 'Tokens saved successfully',
      expiresAt: tokens.expiresAt,
    });
  } catch (error) {
    console.error('Save tokens error:', error);
    res.status(500).json({ error: 'Server error saving tokens' });
  }
};

export const getTokens = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    const tokens = await AccessToken.findOne({ userId });

    if (!tokens) {
      res.status(404).json({ error: 'No tokens found' });
      return;
    }

    const isExpired = tokens.expiresAt < new Date();

    res.json({
      tokens: {
        tickFeedToken: tokens.tickFeedToken,
        marketDepthToken: tokens.marketDepthToken,
        optionChainToken: tokens.optionChainToken,
        expiresAt: tokens.expiresAt,
        isExpired,
      },
    });
  } catch (error) {
    console.error('Get tokens error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const updateTokens = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { tickFeedToken, marketDepthToken, optionChainToken } = req.body;

    if (!tickFeedToken || !marketDepthToken || !optionChainToken) {
      res.status(400).json({ error: 'All tokens are required' });
      return;
    }

    const userId = req.user?.userId;
    const expiresAt = getNextNineAM();

    const tokens = await AccessToken.findOneAndUpdate(
      { userId },
      {
        tickFeedToken,
        marketDepthToken,
        optionChainToken,
        expiresAt,
      },
      { new: true, upsert: true }
    );

    res.json({
      message: 'Tokens updated successfully',
      expiresAt: tokens.expiresAt,
    });
  } catch (error) {
    console.error('Update tokens error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getTokenStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    const tokens = await AccessToken.findOne({ userId });

    if (!tokens) {
      res.json({
        hasTokens: false,
        isExpired: true,
      });
      return;
    }

    const isExpired = tokens.expiresAt < new Date();

    res.json({
      hasTokens: true,
      isExpired,
      expiresAt: tokens.expiresAt,
    });
  } catch (error) {
    console.error('Get token status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

import { Router } from 'express';
import { body } from 'express-validator';
import {
  saveTokens,
  getTokens,
  updateTokens,
  getTokenStatus,
} from '../controllers/tokenController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All token routes require authentication
router.post(
  '/',
  authenticate,
  [
    body('tickFeedToken')
      .trim()
      .notEmpty()
      .withMessage('Tick Feed Token is required'),
    body('marketDepthToken')
      .trim()
      .notEmpty()
      .withMessage('Market Depth Token is required'),
    body('optionChainToken')
      .trim()
      .notEmpty()
      .withMessage('Option Chain Token is required'),
  ],
  saveTokens
);

router.get('/', authenticate, getTokens);
router.put(
  '/',
  authenticate,
  [
    body('tickFeedToken')
      .trim()
      .notEmpty()
      .withMessage('Tick Feed Token is required'),
    body('marketDepthToken')
      .trim()
      .notEmpty()
      .withMessage('Market Depth Token is required'),
    body('optionChainToken')
      .trim()
      .notEmpty()
      .withMessage('Option Chain Token is required'),
  ],
  updateTokens
);
router.get('/status', authenticate, getTokenStatus);

export default router;

import { Router } from 'express';
import { body } from 'express-validator';
import {
  signup,
  login,
  getMe,
  updateProfile,
  changePassword,
  updateClientId,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public routes
router.post(
  '/signup',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  signup
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

// Protected routes
router.get('/me', authenticate, getMe);
router.put(
  '/profile',
  authenticate,
  [body('name').trim().notEmpty().withMessage('Name is required')],
  updateProfile
);
router.put(
  '/password',
  authenticate,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters'),
  ],
  changePassword
);
router.put(
  '/client-id',
  authenticate,
  [body('clientId').trim().notEmpty().withMessage('Client ID is required')],
  updateClientId
);

export default router;

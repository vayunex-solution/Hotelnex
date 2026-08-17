import { Router } from 'express';
import { login } from '../controllers/authController.js';
import { sendOtp, verifyOtp, saveConsent } from '../controllers/verificationController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = Router();

// POST /api/auth/login
router.post('/login', login);

// Verification endpoints (Requires valid JWT, even if unverified)
router.post('/send-otp', requireAuth, sendOtp);
router.post('/verify-otp', requireAuth, verifyOtp);
router.post('/consent', requireAuth, saveConsent);

export default router;

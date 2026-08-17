import platformAuthService from './platformAuthService.js';

/**
 * PlatformAuthController
 * Handles HTTP layer for Super Admin authentication.
 * Routes: /api/v1/platform/auth/*
 */

// ─── POST /api/v1/platform/auth/login ────────────────────────────────────────
export const platformLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const ip        = req.ip || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;

    const result = await platformAuthService.login({ email, password, ip, userAgent });

    return res.status(200).json({
      success: true,
      message: 'Platform login successful.',
      token:   result.token,
      user:    result.user,
    });

  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Internal server error.' });
  }
};

// ─── GET /api/v1/platform/auth/profile ───────────────────────────────────────
export const platformProfile = async (req, res) => {
  try {
    const profile = await platformAuthService.getProfile(req.user.userId);
    return res.status(200).json({ success: true, data: profile });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Internal server error.' });
  }
};

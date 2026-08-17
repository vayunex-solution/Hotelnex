import jwt from 'jsonwebtoken';
import ApiError from '../core/errors/apiError.js';

/**
 * Extracts and verifies JWT, then attaches decoded payload to req.user
 * Works for BOTH hotel admins AND platform super admins
 */
export const requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    req.user = {
      id:           decoded.userId,
      userId:       decoded.userId,
      name:         decoded.name || null,
      email:        decoded.email || null,
      hotelId:      decoded.hotelId || null,
      tenantId:     decoded.tenantId || null,
      role:         decoded.role,
      isSuperAdmin: decoded.isSuperAdmin === true,
      emailVerified: decoded.emailVerified === true,
    };

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ success: false, message: 'Token has expired.' });
    }
    return res.status(403).json({ success: false, message: 'Invalid token.' });
  }
};

/**
 * Enforces that the user has verified their email (Verification Gate)
 */
export const requireVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  if (req.user.isSuperAdmin) {
    return next(); // Platform super admins bypass this
  }
  if (!req.user.emailVerified) {
    return res.status(403).json({ 
      success: false, 
      code: 'VERIFICATION_REQUIRED', 
      message: 'Email verification is required to access this resource.' 
    });
  }
  return next();
};

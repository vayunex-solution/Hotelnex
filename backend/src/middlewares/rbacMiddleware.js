/**
 * Role-Based Access Control Middleware Factory.
 *
 * Usage:
 *   requireRole('admin')
 *   requireRole('admin', 'receptionist')
 *
 * Must be placed AFTER requireAuth in the middleware chain,
 * as it depends on req.user being populated by the auth middleware.
 */
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. No role context found.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: [${roles.join(', ')}]. Your role: ${req.user.role}.`,
      });
    }

    return next();
  };
};

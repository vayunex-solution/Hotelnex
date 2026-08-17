/**
 * Super Admin Authorization Middleware
 * Blocks any request whose JWT does not carry isSuperAdmin: true
 * Used to protect all /api/v1/platform/* routes
 */
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user || !req.user.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message:  'Platform administration access required.',
    });
  }
  next();
};

import pool from '../config/db.js';

/**
 * Extracts real client IP even behind proxies / cPanel Nginx
 */
const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.headers['cf-connecting-ip'] || // Cloudflare
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
};

/**
 * Maps an HTTP method + route pattern to a human-readable action label
 */
const resolveAction = (method, path) => {
  const p = path.toLowerCase();

  if (method === 'POST' && p.includes('checkin'))       return { action: 'CHECK_IN',      label: 'Guest Check-In' };
  if (method === 'POST' && p.includes('checkout'))      return { action: 'CHECK_OUT',     label: 'Guest Check-Out' };
  if (method === 'POST' && p.includes('shift-room'))    return { action: 'ROOM_SHIFT',    label: 'Room Shift / Transfer' };
  if (method === 'POST' && p.includes('guests'))        return { action: 'GUEST_CREATE',  label: 'New Guest Added' };
  if (method === 'PUT'  && p.includes('guests'))        return { action: 'GUEST_UPDATE',  label: 'Guest Info Updated' };
  if (method === 'POST' && p.includes('rooms'))         return { action: 'ROOM_CREATE',   label: 'New Room Added' };
  if (method === 'PUT'  && p.includes('rooms'))         return { action: 'ROOM_UPDATE',   label: 'Room Updated' };
  if (method === 'DELETE' && p.includes('rooms'))       return { action: 'ROOM_DELETE',   label: 'Room Deleted' };
  if (method === 'POST' && p.includes('login'))         return { action: 'LOGIN',         label: 'User Login' };
  if (method === 'POST' && p.includes('logout'))        return { action: 'LOGOUT',        label: 'User Logout' };
  if (method === 'PUT'  && p.includes('settings'))      return { action: 'SETTINGS_UPDATE', label: 'Settings Updated' };
  if (method === 'DELETE')                              return { action: 'DELETE',        label: `Record Deleted` };
  if (method === 'POST')                                return { action: 'CREATE',        label: `Record Created` };
  if (method === 'PUT' || method === 'PATCH')           return { action: 'UPDATE',        label: `Record Updated` };
  return { action: 'ACTION', label: `${method} ${path}` };
};

/**
 * Async fire-and-forget logger — never blocks the response
 */
const insertLog = async ({ hotelId, userId, userName, ip, action, actionLabel, method, path, statusCode, meta }) => {
  try {
    await pool.query(
      `INSERT INTO activity_logs
         (hotel_id, user_id, user_name, ip_address, action, action_label, http_method, request_path, status_code, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        hotelId  || null,
        userId   || null,
        userName || 'System',
        ip,
        action,
        actionLabel,
        method,
        path,
        statusCode,
        meta ? JSON.stringify(meta) : null
      ]
    );
  } catch (err) {
    // Silent — logging must never break the main flow
    console.warn('[ActivityLogger] insert failed silently:', err.message);
  }
};

/**
 * Express middleware — logs WRITE operations automatically after response
 * Only logs POST / PUT / PATCH / DELETE (not GETs to avoid noise)
 */
export const activityLogger = (req, res, next) => {
  const trackMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!trackMethods.includes(req.method)) return next();

  // Listen to response finish event — standard, safe, non-intrusive
  res.on('finish', () => {
    if (req.user && res.statusCode < 500) {
      const ip = getClientIp(req);
      const { action, label } = resolveAction(req.method, req.originalUrl || req.path);
      setImmediate(() => {
        insertLog({
          hotelId:     req.user.hotelId,
          userId:      req.user.id || req.user.userId,
          userName:    req.user.name || req.user.email || 'Staff',
          ip,
          action,
          actionLabel: label,
          method:      req.method,
          path:        req.originalUrl || req.path,
          statusCode:  res.statusCode,
          meta:        null
        });
      });
    }
  });

  next();
};

/**
 * Manual log — call this from controllers for important events with extra meta
 */
export const logActivity = async ({ req, action, label, meta = null }) => {
  if (!req?.user) return;
  const ip = getClientIp(req);
  await insertLog({
    hotelId:     req.user.hotelId,
    userId:      req.user.id,
    userName:    req.user.name || req.user.email || 'Staff',
    ip,
    action,
    actionLabel: label,
    method:      req.method,
    path:        req.originalUrl || req.path,
    statusCode:  200,
    meta
  });
};

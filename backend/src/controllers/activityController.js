import pool from '../config/db.js';

/**
 * GET /api/activities
 * Returns paginated activity log for the authenticated hotel
 */
export const getActivities = async (req, res) => {
  const hotelId = req.user.hotelId;
  const page    = Math.max(1, parseInt(req.query.page)  || 1);
  const limit   = Math.min(100, parseInt(req.query.limit) || 50);
  const offset  = (page - 1) * limit;
  const action  = req.query.action || null; // optional filter

  try {
    const whereClause = action
      ? 'WHERE hotel_id = ? AND action = ?'
      : 'WHERE hotel_id = ?';
    const params = action ? [hotelId, action] : [hotelId];

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM activity_logs ${whereClause}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT 
         id, user_id, user_name, ip_address, action, action_label,
         http_method, request_path, status_code, meta, created_at
       FROM activity_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: rows
    });
  } catch (err) {
    console.error('[ActivityController] getActivities error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch activity logs.' });
  }
};

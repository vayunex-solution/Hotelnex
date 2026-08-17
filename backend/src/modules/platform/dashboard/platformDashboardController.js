import db from '../../../config/db.js';

/**
 * PlatformDashboardController
 * Aggregates cross-tenant metrics for the Super Admin dashboard.
 * GET /api/v1/platform/dashboard/summary
 */
export const getDashboardSummary = async (req, res) => {
  try {
    // ── Tenant Counts ────────────────────────────────────────────────────────
    const [[tenantStats]] = await db.query(`
      SELECT
        COUNT(*)                                        AS total,
        SUM(CASE WHEN status = 'active'    THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'trial'     THEN 1 ELSE 0 END) AS trial,
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended
      FROM tenants
      WHERE is_deleted = 0
    `);

    // ── Properties Count ─────────────────────────────────────────────────────
    const [[{ total_properties }]] = await db.query(
      `SELECT COUNT(*) AS total_properties FROM hotels`,
    );

    // ── Active Users Count ───────────────────────────────────────────────────
    const [[{ active_users }]] = await db.query(
      `SELECT COUNT(*) AS active_users FROM users WHERE is_active = 1`,
    );

    // ── DB Latency Check ─────────────────────────────────────────────────────
    const latencyStart = Date.now();
    await db.query('SELECT 1');
    const dbLatencyMs = Date.now() - latencyStart;

    // ── Recent Activity ──────────────────────────────────────────────────────
    let recentActivity = [];
    try {
      const [activityRows] = await db.query(`
        SELECT action, entity_type, created_at, user_id
        FROM activity_logs
        ORDER BY created_at DESC
        LIMIT 10
      `);
      recentActivity = activityRows;
    } catch { /* table may not exist yet — graceful degradation */ }

    // ── Recent Audit Entries ─────────────────────────────────────────────────
    let recentAudit = [];
    try {
      const [auditRows] = await db.query(`
        SELECT action, table_name, created_at, user_id
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 5
      `);
      recentAudit = auditRows;
    } catch { /* graceful degradation */ }

    return res.status(200).json({
      success: true,
      data: {
        tenants: {
          total:     parseInt(tenantStats.total     || 0),
          active:    parseInt(tenantStats.active    || 0),
          trial:     parseInt(tenantStats.trial     || 0),
          suspended: parseInt(tenantStats.suspended || 0),
        },
        properties:    parseInt(total_properties || 0),
        activeUsers:   parseInt(active_users     || 0),
        systemHealth:  {
          database: {
            status:    dbLatencyMs < 100 ? 'healthy' : dbLatencyMs < 500 ? 'degraded' : 'critical',
            latencyMs: dbLatencyMs,
          },
        },
        recentActivity,
        recentAudit,
      },
    });
  } catch (err) {
    console.error('[PlatformDashboard] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load dashboard data.' });
  }
};

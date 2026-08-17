import db from '../../../config/db.js';

/**
 * TenantRepository
 * Direct SQL access layer for the tenants table.
 * Column name: currency_code (NOT currency — matches actual DB schema)
 */
export class TenantRepository {

  // ─── List with pagination + search ───────────────────────────────────────────
  async findAll({ page = 1, limit = 20, search = '' } = {}) {
    const offset = (page - 1) * limit;
    const like   = `%${search}%`;

    const [rows] = await db.query(
      `SELECT id, name, slug, status, country, timezone, currency_code, is_deleted, created_at
       FROM tenants
       WHERE is_deleted = 0
         AND (? = '' OR name LIKE ? OR slug LIKE ?)
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [search, like, like, parseInt(limit), parseInt(offset)],
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM tenants
       WHERE is_deleted = 0 AND (? = '' OR name LIKE ? OR slug LIKE ?)`,
      [search, like, like],
    );

    return { rows, total: parseInt(total), page: parseInt(page), limit: parseInt(limit) };
  }

  // ─── Find one ─────────────────────────────────────────────────────────────────
  async findById(id) {
    const [rows] = await db.query(
      `SELECT t.*,
              s.status  AS sub_status,
              p.name    AS plan_name,
              p.billing_cycle
         FROM tenants t
         LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status IN ('active','trial')
         LEFT JOIN plans         p ON p.id = s.plan_id
        WHERE t.id = ? AND t.is_deleted = 0
        LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  }

  // ─── Find by email ────────────────────────────────────────────────────────────
  async findByEmail(email) {
    const [rows] = await db.query(
      `SELECT id FROM tenants WHERE owner_email = ? LIMIT 1`,
      [email],
    );
    return rows[0] || null;
  }

  // ─── Find by slug ─────────────────────────────────────────────────────────────
  async findBySlug(slug) {
    const [rows] = await db.query(
      `SELECT id FROM tenants WHERE slug = ? LIMIT 1`,
      [slug],
    );
    return rows[0] || null;
  }

  // ─── Create ───────────────────────────────────────────────────────────────────
  async create({ name, slug, contactEmail, country = 'IN', timezone = 'Asia/Kolkata', currencyCode = 'INR', status = 'trial' }, conn = null) {
    const executor = conn || db;
    const [result] = await executor.query(
      `INSERT INTO tenants (name, slug, owner_email, country, timezone, currency_code, status, is_deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
      [name, slug, contactEmail, country, timezone, currencyCode, status],
    );
    return { id: result.insertId, name, slug, contactEmail, status };
  }

  // ─── Update details ───────────────────────────────────────────────────────────
  async updateById(id, { timezone, currencyCode, country }) {
    const fields = [];
    const values = [];

    if (timezone     !== undefined) { fields.push('timezone = ?');      values.push(timezone);     }
    if (currencyCode !== undefined) { fields.push('currency_code = ?'); values.push(currencyCode); }
    if (country      !== undefined) { fields.push('country = ?');       values.push(country);      }

    if (!fields.length) return;

    values.push(id);
    await db.query(`UPDATE tenants SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
  }

  // ─── Update status ────────────────────────────────────────────────────────────
  async updateStatus(id, status) {
    await db.query(
      `UPDATE tenants SET status = ?, updated_at = NOW() WHERE id = ? AND is_deleted = 0`,
      [status, id],
    );
  }

  // ─── Soft delete ──────────────────────────────────────────────────────────────
  async softDelete(id) {
    await db.query(
      `UPDATE tenants SET is_deleted = 1, deleted_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [id],
    );
  }

  // ─── Properties belonging to a tenant ────────────────────────────────────────
  async getProperties(tenantId) {
    const [rows] = await db.query(
      `SELECT id, name, address, phone_number, created_at FROM hotels WHERE tenant_id = ?`,
      [tenantId],
    );
    return rows;
  }
}

export default new TenantRepository();

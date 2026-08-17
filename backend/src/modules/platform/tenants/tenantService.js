import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../../../config/db.js';
import tenantRepository from './tenantRepository.js';

/**
 * TenantService
 * Business logic for tenant lifecycle management.
 * Provisioning is wrapped in a database transaction for atomicity.
 */
export class TenantService {

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  _slugify(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60);
  }

  _generateTempPassword() {
    return 'Temp@' + crypto.randomBytes(6).toString('hex');
  }

  // ─── List tenants ─────────────────────────────────────────────────────────────
  async listTenants({ page, limit, search }) {
    return tenantRepository.findAll({ page, limit, search });
  }

  // ─── Get single tenant ────────────────────────────────────────────────────────
  async getTenantById(id) {
    const tenant = await tenantRepository.findById(id);
    if (!tenant) throw { status: 404, message: 'Tenant not found.' };

    const properties = await tenantRepository.getProperties(id);
    return { ...tenant, properties };
  }

  // ─── Update tenant details ────────────────────────────────────────────────────
  async updateTenant(id, data, actorId) {
    const tenant = await tenantRepository.findById(id);
    if (!tenant) throw { status: 404, message: 'Tenant not found.' };

    await tenantRepository.updateById(id, data);
    await this._writeAuditLog(actorId, 'UPDATE', 'tenants', id, data);
    return { id, ...data };
  }

  // ─── Update status ────────────────────────────────────────────────────────────
  async updateStatus(id, status, actorId) {
    const allowed = ['active', 'suspended', 'trial'];
    if (!allowed.includes(status)) throw { status: 400, message: `Invalid status. Allowed: ${allowed.join(', ')}` };

    const tenant = await tenantRepository.findById(id);
    if (!tenant) throw { status: 404, message: 'Tenant not found.' };

    await tenantRepository.updateStatus(id, status);
    await this._writeAuditLog(actorId, `STATUS_CHANGE_${status.toUpperCase()}`, 'tenants', id, { status });
    return { id, status };
  }

  // ─── Soft delete ──────────────────────────────────────────────────────────────
  async deleteTenant(id, actorId) {
    const tenant = await tenantRepository.findById(id);
    if (!tenant) throw { status: 404, message: 'Tenant not found.' };

    await tenantRepository.softDelete(id);
    await this._writeAuditLog(actorId, 'SOFT_DELETE', 'tenants', id, {});
    return { id };
  }

  // ─── Transactional Provisioning ───────────────────────────────────────────────
  async provisionTenant({ name, contactEmail, country = 'IN', timezone = 'Asia/Kolkata', currencyCode = 'INR' }, actorId) {
    const slug     = this._slugify(name);
    const tempPass = this._generateTempPassword();

    // Guard: duplicate email
    const existing = await tenantRepository.findByEmail(contactEmail);
    if (existing) throw { status: 409, message: 'A tenant with this email already exists.' };

    // Guard: duplicate slug
    const existingSlug = await tenantRepository.findBySlug(slug);
    if (existingSlug) throw { status: 409, message: `Slug "${slug}" already exists. Use a different company name.` };

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Create Tenant
      const tenant = await tenantRepository.create(
        { name, slug, contactEmail, country, timezone, currencyCode, status: 'trial' },
        conn,
      );

      // 2. Create default Property (hotel)
      const [propertyResult] = await conn.query(
        `INSERT INTO hotels (tenant_id, name, status, created_at, updated_at)
         VALUES (?, ?, 'active', NOW(), NOW())`,
        [tenant.id, `${name} - Default Property`],
      );
      const propertyId = propertyResult.insertId;

      // 3. Create Hotel Admin user
      const hashedPass = await bcrypt.hash(tempPass, 12);
      const [userResult] = await conn.query(
        `INSERT INTO users
           (name, email, password_hash, role, hotel_id, tenant_id, is_active, is_super_admin, created_at, updated_at)
         VALUES (?, ?, ?, 'admin', ?, ?, 1, 0, NOW(), NOW())`,
        [`${name} Admin`, contactEmail, hashedPass, propertyId, tenant.id],
      );
      const adminUserId = userResult.insertId;

      // 4. Assign default trial subscription (use the lowest plan if available)
      let subscriptionId = null;
      try {
        const [[defaultPlan]] = await conn.query(
          `SELECT id FROM plans WHERE is_active = 1 ORDER BY price ASC LIMIT 1`,
        );
        if (defaultPlan) {
          const trialEnds = new Date();
          trialEnds.setDate(trialEnds.getDate() + 14); // 14-day trial

          const [subResult] = await conn.query(
            `INSERT INTO subscriptions (tenant_id, plan_id, status, trial_ends_at, created_at, updated_at)
             VALUES (?, ?, 'trial', ?, NOW(), NOW())`,
            [tenant.id, defaultPlan.id, trialEnds],
          );
          subscriptionId = subResult.insertId;
        }
      } catch { /* subscriptions table may not exist yet */ }

      // 5. Enable core features
      const coreFeatures = ['dashboard', 'rooms', 'bookings', 'guests', 'booking_history', 'invoicing', 'settings'];
      try {
        for (const feature of coreFeatures) {
          await conn.query(
            `INSERT IGNORE INTO tenant_features (tenant_id, feature_key, is_enabled, created_at)
             VALUES (?, ?, 1, NOW())`,
            [tenant.id, feature],
          );
        }
      } catch { /* graceful degradation */ }

      // 6. Write audit log
      await conn.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values, created_at)
         VALUES (?, 'TENANT_PROVISIONED', 'tenants', ?, ?, NOW())`,
        [actorId, tenant.id, JSON.stringify({ name, contactEmail, slug })],
      ).catch(() => {});

      // 7. Emit TenantCreated event
      await conn.query(
        `INSERT INTO event_bus_events (event_type, payload, tenant_id, status, created_at)
         VALUES ('TenantCreated', ?, ?, 'pending', NOW())`,
        [JSON.stringify({ tenantId: tenant.id, name, adminUserId, propertyId }), tenant.id],
      ).catch(() => {});

      await conn.commit();

      return {
        tenant:   { id: tenant.id, name, slug, status: 'trial' },
        property: { id: propertyId, name: `${name} - Default Property` },
        admin:    { id: adminUserId, email: contactEmail, temporaryPassword: tempPass },
        subscription: subscriptionId ? { id: subscriptionId } : null,
        featuresEnabled: coreFeatures,
      };

    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────
  async _writeAuditLog(userId, action, tableName, recordId, newValues) {
    try {
      await db.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [userId, action, tableName, recordId, JSON.stringify(newValues)],
      );
    } catch { /* non-blocking */ }
  }
}

export default new TenantService();

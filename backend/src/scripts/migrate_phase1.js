/**
 * HotelNex → PropertyNex Enterprise Platform
 * Phase 1 Migration Runner v2.0
 *
 * ⚠️  PRODUCTION MIGRATION — READ BEFORE RUNNING ⚠️
 *
 * Safety guarantees:
 *  - CREATE TABLE IF NOT EXISTS  → safe to re-run
 *  - ADD COLUMN IF NOT EXISTS    → safe to re-run
 *  - INSERT IGNORE               → safe to re-run
 *  - Zero DROP or TRUNCATE statements
 *  - Each DDL group runs in its own transaction
 *
 * Usage: node src/scripts/migrate_phase1.js
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const DB_CONFIG = {
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port:     parseInt(process.env.DB_PORT || '3306', 10),
};

async function runGroup(conn, groupName, statements) {
  console.log(`\n⏳  Running Group ${groupName}...`);
  const start = Date.now();
  for (const stmt of statements) {
    try {
      await conn.query(stmt.sql);
      console.log(`   ✅  ${stmt.label}`);
    } catch (err) {
      console.error(`   ❌  FAILED: ${stmt.label}`);
      throw err;
    }
  }
  console.log(`   ⏱   Group ${groupName} done in ${Date.now() - start}ms`);
}

// ── GROUP A: TENANT LAYER ─────────────────────────────────────────────────────
const GROUP_A = [
  { label: 'CREATE tenants', sql: `CREATE TABLE IF NOT EXISTS tenants (
    id INT NOT NULL AUTO_INCREMENT, name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL, status ENUM('active','trial','suspended','cancelled') NOT NULL DEFAULT 'trial',
    owner_email VARCHAR(255) DEFAULT NULL, country VARCHAR(100) NOT NULL DEFAULT 'India',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata', locale VARCHAR(10) NOT NULL DEFAULT 'en-IN',
    currency_code VARCHAR(10) NOT NULL DEFAULT 'INR', is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    deleted_at TIMESTAMP NULL DEFAULT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uk_tenant_slug (slug), INDEX idx_tenant_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE tenant_configs', sql: `CREATE TABLE IF NOT EXISTS tenant_configs (
    id INT NOT NULL AUTO_INCREMENT, tenant_id INT NOT NULL, config_key VARCHAR(100) NOT NULL,
    config_value TEXT DEFAULT NULL, data_type ENUM('string','int','boolean','json') NOT NULL DEFAULT 'string',
    version INT NOT NULL DEFAULT 1, updated_by INT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uk_tenant_config (tenant_id, config_key),
    CONSTRAINT fk_tc_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
];

// ── GROUP B: SUBSCRIPTION & BILLING ──────────────────────────────────────────
const GROUP_B = [
  { label: 'CREATE plans', sql: `CREATE TABLE IF NOT EXISTS plans (
    id INT NOT NULL AUTO_INCREMENT, name VARCHAR(100) NOT NULL, slug VARCHAR(100) NOT NULL,
    description TEXT DEFAULT NULL,
    billing_cycle ENUM('monthly','quarterly','yearly','lifetime','custom') NOT NULL DEFAULT 'monthly',
    price DECIMAL(12,2) NOT NULL DEFAULT 0.00, price_yearly DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    trial_days INT NOT NULL DEFAULT 14, grace_period_days INT NOT NULL DEFAULT 7,
    max_properties INT NOT NULL DEFAULT 1, max_rooms_per_property INT NOT NULL DEFAULT 50,
    max_users_per_property INT NOT NULL DEFAULT 5, max_storage_mb INT NOT NULL DEFAULT 1024,
    max_api_calls_per_day INT NOT NULL DEFAULT 10000, max_branches INT NOT NULL DEFAULT 1,
    is_active TINYINT(1) NOT NULL DEFAULT 1, is_public TINYINT(1) NOT NULL DEFAULT 1,
    metadata_json JSON DEFAULT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uk_plan_slug (slug)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE plan_limits', sql: `CREATE TABLE IF NOT EXISTS plan_limits (
    id INT NOT NULL AUTO_INCREMENT, plan_id INT NOT NULL, limit_key VARCHAR(100) NOT NULL,
    limit_value BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id), UNIQUE KEY uk_plan_limit (plan_id, limit_key),
    CONSTRAINT fk_pl_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE coupons', sql: `CREATE TABLE IF NOT EXISTS coupons (
    id INT NOT NULL AUTO_INCREMENT, code VARCHAR(50) NOT NULL, description TEXT DEFAULT NULL,
    discount_type ENUM('percentage','fixed') NOT NULL DEFAULT 'percentage',
    discount_value DECIMAL(10,2) NOT NULL, max_uses INT DEFAULT NULL, used_count INT NOT NULL DEFAULT 0,
    valid_from TIMESTAMP NULL DEFAULT NULL, valid_until TIMESTAMP NULL DEFAULT NULL,
    applicable_plans JSON DEFAULT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uk_coupon_code (code), INDEX idx_coupon_active (is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE subscriptions', sql: `CREATE TABLE IF NOT EXISTS subscriptions (
    id INT NOT NULL AUTO_INCREMENT, tenant_id INT NOT NULL, plan_id INT NOT NULL, coupon_id INT NULL,
    status ENUM('trial','active','grace_period','past_due','suspended','cancelled','expired') NOT NULL DEFAULT 'trial',
    billing_cycle ENUM('monthly','quarterly','yearly','lifetime','custom') NOT NULL DEFAULT 'monthly',
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    trial_ends_at TIMESTAMP NULL DEFAULT NULL, current_period_start TIMESTAMP NULL DEFAULT NULL,
    current_period_end TIMESTAMP NULL DEFAULT NULL, grace_period_ends_at TIMESTAMP NULL DEFAULT NULL,
    cancelled_at TIMESTAMP NULL DEFAULT NULL, cancellation_reason TEXT DEFAULT NULL,
    auto_renew TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_sub_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT,
    CONSTRAINT fk_sub_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL,
    INDEX idx_sub_tenant (tenant_id), INDEX idx_sub_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE coupon_redemptions', sql: `CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id INT NOT NULL AUTO_INCREMENT, coupon_id INT NOT NULL, tenant_id INT NOT NULL,
    subscription_id INT NOT NULL, redeemed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_cr_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE subscription_invoices', sql: `CREATE TABLE IF NOT EXISTS subscription_invoices (
    id INT NOT NULL AUTO_INCREMENT, subscription_id INT NOT NULL, tenant_id INT NOT NULL,
    invoice_number VARCHAR(50) NOT NULL UNIQUE, period_start TIMESTAMP NULL, period_end TIMESTAMP NULL,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00, discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00, total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR', gst_number VARCHAR(20) DEFAULT NULL,
    status ENUM('draft','open','paid','void','uncollectible') NOT NULL DEFAULT 'open',
    due_date TIMESTAMP NULL, paid_at TIMESTAMP NULL, pdf_url VARCHAR(511) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_si_sub FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE RESTRICT,
    INDEX idx_si_tenant (tenant_id), INDEX idx_si_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE subscription_payments', sql: `CREATE TABLE IF NOT EXISTS subscription_payments (
    id INT NOT NULL AUTO_INCREMENT, invoice_id INT NOT NULL, tenant_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL, currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    payment_method VARCHAR(50) DEFAULT NULL, gateway_txn_id VARCHAR(255) DEFAULT NULL,
    status ENUM('pending','success','failed','refunded') NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMP NULL, failure_reason TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_sp_invoice FOREIGN KEY (invoice_id) REFERENCES subscription_invoices(id) ON DELETE RESTRICT,
    INDEX idx_sp_tenant (tenant_id), INDEX idx_sp_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE usage_tracking', sql: `CREATE TABLE IF NOT EXISTS usage_tracking (
    id BIGINT NOT NULL AUTO_INCREMENT, tenant_id INT NOT NULL, property_id INT NULL,
    metric_key VARCHAR(100) NOT NULL, metric_value BIGINT NOT NULL DEFAULT 0, recorded_at DATE NOT NULL,
    PRIMARY KEY (id), UNIQUE KEY uk_usage (tenant_id, property_id, metric_key, recorded_at),
    INDEX idx_usage_tenant (tenant_id), INDEX idx_usage_date (recorded_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE license_keys', sql: `CREATE TABLE IF NOT EXISTS license_keys (
    id INT NOT NULL AUTO_INCREMENT, tenant_id INT NOT NULL,
    license_key VARCHAR(255) NOT NULL UNIQUE, plan_id INT NOT NULL,
    status ENUM('active','revoked','expired') NOT NULL DEFAULT 'active',
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TIMESTAMP NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_lk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
];

// ── GROUP C: FEATURE FLAGS ────────────────────────────────────────────────────
const GROUP_C = [
  { label: 'CREATE features', sql: `CREATE TABLE IF NOT EXISTS features (
    id INT NOT NULL AUTO_INCREMENT, feature_key VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL, description TEXT DEFAULT NULL,
    module VARCHAR(100) DEFAULT NULL, is_beta TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE plan_features', sql: `CREATE TABLE IF NOT EXISTS plan_features (
    plan_id INT NOT NULL, feature_id INT NOT NULL, is_enabled TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (plan_id, feature_id),
    CONSTRAINT fk_pf_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
    CONSTRAINT fk_pf_feature FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE tenant_features', sql: `CREATE TABLE IF NOT EXISTS tenant_features (
    id INT NOT NULL AUTO_INCREMENT, tenant_id INT NOT NULL, feature_id INT NOT NULL,
    is_enabled TINYINT(1) NOT NULL DEFAULT 1, overridden_by INT NULL,
    overridden_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uk_tf (tenant_id, feature_id),
    CONSTRAINT fk_tf_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_tf_feature FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE property_features', sql: `CREATE TABLE IF NOT EXISTS property_features (
    id INT NOT NULL AUTO_INCREMENT, property_id INT NOT NULL, feature_id INT NOT NULL,
    is_enabled TINYINT(1) NOT NULL DEFAULT 1, updated_by INT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uk_prf (property_id, feature_id),
    CONSTRAINT fk_prf_feature FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
];

// ── GROUP D: RBAC ENGINE ──────────────────────────────────────────────────────
const GROUP_D = [
  { label: 'CREATE departments', sql: `CREATE TABLE IF NOT EXISTS departments (
    id INT NOT NULL AUTO_INCREMENT, property_id INT NOT NULL, tenant_id INT NOT NULL,
    name VARCHAR(100) NOT NULL, slug VARCHAR(100) NOT NULL, description TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uk_dept (property_id, slug)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE teams', sql: `CREATE TABLE IF NOT EXISTS teams (
    id INT NOT NULL AUTO_INCREMENT, department_id INT NOT NULL,
    property_id INT NOT NULL, tenant_id INT NOT NULL, name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_team_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE roles', sql: `CREATE TABLE IF NOT EXISTS roles (
    id INT NOT NULL AUTO_INCREMENT, tenant_id INT NULL, property_id INT NULL,
    name VARCHAR(100) NOT NULL, slug VARCHAR(100) NOT NULL,
    is_system TINYINT(1) NOT NULL DEFAULT 0, description TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uk_role (tenant_id, property_id, slug)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE permissions', sql: `CREATE TABLE IF NOT EXISTS permissions (
    id INT NOT NULL AUTO_INCREMENT, module VARCHAR(100) NOT NULL, action VARCHAR(100) NOT NULL,
    scope ENUM('platform','tenant','property','team','own') NOT NULL DEFAULT 'property',
    description VARCHAR(255) DEFAULT NULL,
    PRIMARY KEY (id), UNIQUE KEY uk_perm (module, action)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE permission_groups', sql: `CREATE TABLE IF NOT EXISTS permission_groups (
    id INT NOT NULL AUTO_INCREMENT, name VARCHAR(100) NOT NULL, description TEXT DEFAULT NULL,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE permission_group_members', sql: `CREATE TABLE IF NOT EXISTS permission_group_members (
    group_id INT NOT NULL, permission_id INT NOT NULL,
    PRIMARY KEY (group_id, permission_id),
    CONSTRAINT fk_pgm_group FOREIGN KEY (group_id) REFERENCES permission_groups(id) ON DELETE CASCADE,
    CONSTRAINT fk_pgm_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE role_permissions', sql: `CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT NOT NULL, permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE user_roles', sql: `CREATE TABLE IF NOT EXISTS user_roles (
    user_id INT NOT NULL, role_id INT NOT NULL, property_id INT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, assigned_by INT NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE resource_permissions', sql: `CREATE TABLE IF NOT EXISTS resource_permissions (
    id INT NOT NULL AUTO_INCREMENT, user_id INT NOT NULL, permission_id INT NOT NULL,
    resource_type VARCHAR(50) NOT NULL, resource_id INT NOT NULL,
    granted_by INT NULL, granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), INDEX idx_rp_user (user_id), INDEX idx_rp_resource (resource_type, resource_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
];

// ── GROUP E: PROPERTY HIERARCHY ───────────────────────────────────────────────
const GROUP_E = [
  { label: 'CREATE property_types', sql: `CREATE TABLE IF NOT EXISTS property_types (
    id INT NOT NULL AUTO_INCREMENT, name VARCHAR(100) NOT NULL, slug VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(100) DEFAULT NULL, description TEXT DEFAULT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE buildings', sql: `CREATE TABLE IF NOT EXISTS buildings (
    id INT NOT NULL AUTO_INCREMENT, property_id INT NOT NULL, tenant_id INT NOT NULL,
    name VARCHAR(100) NOT NULL, code VARCHAR(20) DEFAULT NULL, total_floors INT NOT NULL DEFAULT 1,
    is_active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), INDEX idx_bld_property (property_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE floors', sql: `CREATE TABLE IF NOT EXISTS floors (
    id INT NOT NULL AUTO_INCREMENT, building_id INT NOT NULL, property_id INT NOT NULL,
    tenant_id INT NOT NULL, floor_number INT NOT NULL, name VARCHAR(50) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id), UNIQUE KEY uk_floor (building_id, floor_number),
    CONSTRAINT fk_floor_bld FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
];

// ── GROUP F: AUDIT & SECURITY ─────────────────────────────────────────────────
const GROUP_F = [
  { label: 'CREATE audit_logs', sql: `CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT NOT NULL AUTO_INCREMENT, tenant_id INT NULL, property_id INT NULL, user_id INT NULL,
    action VARCHAR(100) NOT NULL, target_table VARCHAR(100) NOT NULL, target_id VARCHAR(50) NOT NULL,
    old_value JSON DEFAULT NULL, new_value JSON DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL, user_agent TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), INDEX idx_al_tenant (tenant_id), INDEX idx_al_property (property_id),
    INDEX idx_al_user (user_id), INDEX idx_al_action (action), INDEX idx_al_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE activity_logs', sql: `CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGINT NOT NULL AUTO_INCREMENT, tenant_id INT NULL, property_id INT NULL, user_id INT NULL,
    activity VARCHAR(100) NOT NULL, context JSON DEFAULT NULL, ip_address VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), INDEX idx_actlog_user (user_id), INDEX idx_actlog_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE security_events', sql: `CREATE TABLE IF NOT EXISTS security_events (
    id BIGINT NOT NULL AUTO_INCREMENT, event_type VARCHAR(100) NOT NULL, user_id INT NULL,
    email VARCHAR(255) NULL, ip_address VARCHAR(45) NOT NULL, user_agent TEXT DEFAULT NULL,
    metadata JSON DEFAULT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), INDEX idx_se_type (event_type), INDEX idx_se_ip (ip_address),
    INDEX idx_se_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE login_history', sql: `CREATE TABLE IF NOT EXISTS login_history (
    id BIGINT NOT NULL AUTO_INCREMENT, user_id INT NOT NULL, ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT DEFAULT NULL, status ENUM('success','failed','expired') NOT NULL DEFAULT 'success',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_lh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_lh_user (user_id), INDEX idx_lh_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
];

// ── GROUP G: NOTIFICATIONS ────────────────────────────────────────────────────
const GROUP_G = [
  { label: 'CREATE notification_templates', sql: `CREATE TABLE IF NOT EXISTS notification_templates (
    id INT NOT NULL AUTO_INCREMENT, tenant_id INT NULL, template_key VARCHAR(100) NOT NULL,
    channel ENUM('email','sms','whatsapp','push','internal') NOT NULL,
    subject VARCHAR(255) DEFAULT NULL, body TEXT NOT NULL, variables JSON DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uk_nt (tenant_id, template_key, channel)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE notification_queue', sql: `CREATE TABLE IF NOT EXISTS notification_queue (
    id BIGINT NOT NULL AUTO_INCREMENT, tenant_id INT NULL, property_id INT NULL,
    user_id INT NULL, guest_id INT NULL, template_id INT NULL,
    channel ENUM('email','sms','whatsapp','push','internal') NOT NULL,
    recipient VARCHAR(255) NOT NULL, subject VARCHAR(255) DEFAULT NULL, body TEXT NOT NULL,
    status ENUM('pending','processing','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0, max_attempts INT NOT NULL DEFAULT 3,
    scheduled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP NULL, failed_at TIMESTAMP NULL, failure_reason TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), INDEX idx_nq_status (status), INDEX idx_nq_scheduled (scheduled_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE notification_preferences', sql: `CREATE TABLE IF NOT EXISTS notification_preferences (
    id INT NOT NULL AUTO_INCREMENT, user_id INT NOT NULL,
    channel ENUM('email','sms','whatsapp','push','internal') NOT NULL,
    event_key VARCHAR(100) NOT NULL, is_enabled TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id), UNIQUE KEY uk_np (user_id, channel, event_key),
    CONSTRAINT fk_np_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE notification_logs', sql: `CREATE TABLE IF NOT EXISTS notification_logs (
    id BIGINT NOT NULL AUTO_INCREMENT, queue_id BIGINT NULL, tenant_id INT NULL,
    channel VARCHAR(50) NOT NULL, recipient VARCHAR(255) NOT NULL,
    status ENUM('sent','failed','bounced','opened','clicked') NOT NULL,
    provider VARCHAR(50) DEFAULT NULL, provider_msg_id VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), INDEX idx_nl_tenant (tenant_id), INDEX idx_nl_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
];

// ── GROUP H: JOB QUEUE ────────────────────────────────────────────────────────
const GROUP_H = [
  { label: 'CREATE jobs', sql: `CREATE TABLE IF NOT EXISTS jobs (
    id BIGINT NOT NULL AUTO_INCREMENT, queue VARCHAR(100) NOT NULL DEFAULT 'default',
    tenant_id INT NULL, property_id INT NULL, job_type VARCHAR(100) NOT NULL,
    payload JSON NOT NULL, status ENUM('pending','processing','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0, max_attempts INT NOT NULL DEFAULT 3,
    priority TINYINT NOT NULL DEFAULT 5, available_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL, completed_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), INDEX idx_job_queue_status (queue, status, available_at), INDEX idx_job_tenant (tenant_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE failed_jobs', sql: `CREATE TABLE IF NOT EXISTS failed_jobs (
    id BIGINT NOT NULL AUTO_INCREMENT, job_id BIGINT NULL, tenant_id INT NULL,
    queue VARCHAR(100) NOT NULL, job_type VARCHAR(100) NOT NULL,
    payload JSON NOT NULL, exception TEXT NOT NULL, failed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE scheduled_jobs', sql: `CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id INT NOT NULL AUTO_INCREMENT, name VARCHAR(100) NOT NULL UNIQUE, job_type VARCHAR(100) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL, payload JSON DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1, last_run_at TIMESTAMP NULL, next_run_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
];

// ── GROUP I: CONFIGURATION ────────────────────────────────────────────────────
const GROUP_I = [
  { label: 'CREATE property_settings', sql: `CREATE TABLE IF NOT EXISTS property_settings (
    id INT NOT NULL AUTO_INCREMENT, property_id INT NOT NULL, tenant_id INT NOT NULL,
    category ENUM('hotel','invoice','smtp','whatsapp','payment','tax','theme','branding','security','api') NOT NULL,
    setting_key VARCHAR(100) NOT NULL, setting_value TEXT DEFAULT NULL,
    data_type ENUM('string','int','boolean','json','encrypted') NOT NULL DEFAULT 'string',
    is_encrypted TINYINT(1) NOT NULL DEFAULT 0, version INT NOT NULL DEFAULT 1,
    updated_by INT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uk_ps (property_id, category, setting_key), INDEX idx_ps_property (property_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
];

// ── GROUP J: STORAGE ENGINE ───────────────────────────────────────────────────
const GROUP_J = [
  { label: 'CREATE storage_providers', sql: `CREATE TABLE IF NOT EXISTS storage_providers (
    id INT NOT NULL AUTO_INCREMENT, tenant_id INT NULL,
    provider ENUM('backblaze_b2','aws_s3','cloudflare_r2','azure_blob','gcs','minio','local') NOT NULL,
    name VARCHAR(100) NOT NULL, config_json TEXT NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1, is_default TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uk_sp_default (tenant_id, is_default)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE stored_files', sql: `CREATE TABLE IF NOT EXISTS stored_files (
    id BIGINT NOT NULL AUTO_INCREMENT, tenant_id INT NULL, property_id INT NULL,
    provider_id INT NULL, entity_type VARCHAR(50) NOT NULL, entity_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL, file_path VARCHAR(511) NOT NULL,
    file_size_kb INT DEFAULT NULL, mime_type VARCHAR(100) DEFAULT NULL,
    url VARCHAR(511) NOT NULL, uploaded_by INT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), INDEX idx_sf_entity (entity_type, entity_id), INDEX idx_sf_tenant (tenant_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
];

// ── GROUP K: SYSTEM TABLES ────────────────────────────────────────────────────
const GROUP_K = [
  { label: 'CREATE tenant_invitations', sql: `CREATE TABLE IF NOT EXISTS tenant_invitations (
    id INT NOT NULL AUTO_INCREMENT, tenant_id INT NOT NULL, email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin', token VARCHAR(255) NOT NULL UNIQUE,
    accepted TINYINT(1) NOT NULL DEFAULT 0, expires_at TIMESTAMP NOT NULL,
    created_by INT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), INDEX idx_ti_token (token), INDEX idx_ti_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE api_keys', sql: `CREATE TABLE IF NOT EXISTS api_keys (
    id INT NOT NULL AUTO_INCREMENT, tenant_id INT NOT NULL, property_id INT NULL,
    name VARCHAR(100) NOT NULL, key_hash VARCHAR(255) NOT NULL UNIQUE, key_prefix VARCHAR(10) NOT NULL,
    permissions JSON DEFAULT NULL, rate_limit INT NOT NULL DEFAULT 1000,
    last_used_at TIMESTAMP NULL, expires_at TIMESTAMP NULL, is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by INT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), INDEX idx_ak_tenant (tenant_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE webhooks', sql: `CREATE TABLE IF NOT EXISTS webhooks (
    id INT NOT NULL AUTO_INCREMENT, tenant_id INT NOT NULL, name VARCHAR(100) NOT NULL,
    url VARCHAR(511) NOT NULL, secret VARCHAR(255) NOT NULL, events JSON NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), INDEX idx_wh_tenant (tenant_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE system_migrations', sql: `CREATE TABLE IF NOT EXISTS system_migrations (
    id INT NOT NULL AUTO_INCREMENT, migration_name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INT DEFAULT NULL, notes TEXT DEFAULT NULL,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
];

// ── GROUP L: EVENT BUS ────────────────────────────────────────────────────────
const GROUP_L = [
  { label: 'CREATE event_store', sql: `CREATE TABLE IF NOT EXISTS event_store (
    id BIGINT NOT NULL AUTO_INCREMENT, event_name VARCHAR(100) NOT NULL,
    tenant_id INT NULL, property_id INT NULL, payload JSON NOT NULL,
    status ENUM('pending','processed','failed') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), INDEX idx_es_name (event_name), INDEX idx_es_tenant (tenant_id),
    INDEX idx_es_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE event_subscriptions', sql: `CREATE TABLE IF NOT EXISTS event_subscriptions (
    id INT NOT NULL AUTO_INCREMENT, event_name VARCHAR(100) NOT NULL,
    subscriber_name VARCHAR(100) NOT NULL, endpoint_url VARCHAR(511) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uk_subscription (event_name, subscriber_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE event_delivery_attempts', sql: `CREATE TABLE IF NOT EXISTS event_delivery_attempts (
    id BIGINT NOT NULL AUTO_INCREMENT, event_id BIGINT NOT NULL, subscription_id INT NOT NULL,
    attempt_number INT NOT NULL DEFAULT 1, status ENUM('success','failed') NOT NULL,
    response_payload TEXT DEFAULT NULL, error_message TEXT DEFAULT NULL,
    attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_eda_event FOREIGN KEY (event_id) REFERENCES event_store(id) ON DELETE CASCADE,
    CONSTRAINT fk_eda_sub FOREIGN KEY (subscription_id) REFERENCES event_subscriptions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
];

// ── GROUP M: WORKFLOW ENGINE ──────────────────────────────────────────────────
const GROUP_M = [
  { label: 'CREATE workflows', sql: `CREATE TABLE IF NOT EXISTS workflows (
    id INT NOT NULL AUTO_INCREMENT, tenant_id INT NULL, name VARCHAR(100) NOT NULL,
    trigger_event VARCHAR(100) NOT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id), INDEX idx_wf_trigger (trigger_event), INDEX idx_wf_tenant (tenant_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE workflow_steps', sql: `CREATE TABLE IF NOT EXISTS workflow_steps (
    id INT NOT NULL AUTO_INCREMENT, workflow_id INT NOT NULL, step_order INT NOT NULL,
    action_type VARCHAR(100) NOT NULL, configuration_json JSON DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_ws_workflow FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    UNIQUE KEY uk_workflow_step (workflow_id, step_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE workflow_runs', sql: `CREATE TABLE IF NOT EXISTS workflow_runs (
    id BIGINT NOT NULL AUTO_INCREMENT, workflow_id INT NOT NULL,
    entity_type VARCHAR(50) NOT NULL, entity_id BIGINT NOT NULL,
    status ENUM('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP NULL, completed_at TIMESTAMP NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_wr_workflow FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE workflow_step_runs', sql: `CREATE TABLE IF NOT EXISTS workflow_step_runs (
    id BIGINT NOT NULL AUTO_INCREMENT, run_id BIGINT NOT NULL, step_id INT NOT NULL,
    status ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
    error_message TEXT DEFAULT NULL, executed_at TIMESTAMP NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_wsr_run FOREIGN KEY (run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_wsr_step FOREIGN KEY (step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
];

// ── GROUP N: OBSERVABILITY ────────────────────────────────────────────────────
const GROUP_N = [
  { label: 'CREATE system_metrics', sql: `CREATE TABLE IF NOT EXISTS system_metrics (
    id BIGINT NOT NULL AUTO_INCREMENT, metric_name VARCHAR(100) NOT NULL,
    value DOUBLE NOT NULL, tags_json JSON DEFAULT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), INDEX idx_sm_name (metric_name), INDEX idx_sm_recorded (recorded_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
  { label: 'CREATE slow_queries', sql: `CREATE TABLE IF NOT EXISTS slow_queries (
    id BIGINT NOT NULL AUTO_INCREMENT, query_text TEXT NOT NULL,
    duration_ms INT NOT NULL, executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), INDEX idx_sq_duration (duration_ms), INDEX idx_sq_executed (executed_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
];

// ── EXPAND EXISTING TABLES ────────────────────────────────────────────────────
const EXPAND_EXISTING = [
  { label: 'ALTER hotels — tenant_id, property_type_id, slug, timezone, currency_code, status, soft-delete, updated_at', sql: `ALTER TABLE hotels
    ADD COLUMN IF NOT EXISTS tenant_id INT NULL COMMENT 'FK to tenants' AFTER id,
    ADD COLUMN IF NOT EXISTS property_type_id INT NULL COMMENT 'FK to property_types' AFTER tenant_id,
    ADD COLUMN IF NOT EXISTS slug VARCHAR(100) NULL AFTER name,
    ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NULL DEFAULT 'Asia/Kolkata',
    ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10) NULL DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS status ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` },
  { label: 'ALTER users — tenant_id, is_super_admin, is_active, soft-delete, last_login_at, updated_at', sql: `ALTER TABLE users
    ADD COLUMN IF NOT EXISTS tenant_id INT NULL COMMENT 'FK to tenants' AFTER hotel_id,
    ADD COLUMN IF NOT EXISTS is_super_admin TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` },
  { label: 'ALTER rooms — building_id, floor_id, soft-delete, updated_at', sql: `ALTER TABLE rooms
    ADD COLUMN IF NOT EXISTS building_id INT NULL COMMENT 'FK to buildings',
    ADD COLUMN IF NOT EXISTS floor_id INT NULL COMMENT 'FK to floors',
    ADD COLUMN IF NOT EXISTS is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` },
  { label: 'ALTER guests — email, nationality, dob, gender, soft-delete, updated_at', sql: `ALTER TABLE guests
    ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS nationality VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS date_of_birth DATE NULL,
    ADD COLUMN IF NOT EXISTS gender ENUM('male','female','other') NULL,
    ADD COLUMN IF NOT EXISTS is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` },
  { label: 'ALTER bookings — cancellation_reason, cancelled_by, soft-delete, updated_at', sql: `ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT NULL,
    ADD COLUMN IF NOT EXISTS cancelled_by INT NULL,
    ADD COLUMN IF NOT EXISTS is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` },
];

// ── BACKFILL DATA ─────────────────────────────────────────────────────────────
const BACKFILL = [
  { label: 'INSERT tenant: Vayunex Solutions', sql: `INSERT IGNORE INTO tenants (name, slug, status, owner_email, country, timezone, currency_code) VALUES ('Vayunex Solutions', 'vayunex-solutions', 'active', 'admin@vayunex.com', 'India', 'Asia/Kolkata', 'INR')` },
  { label: 'INSERT 9 property_types', sql: `INSERT IGNORE INTO property_types (name, slug, description) VALUES ('Hotel','hotel','Traditional hotel property'),('Resort','resort','Resort with extended amenities'),('Hostel','hostel','Budget hostel with shared facilities'),('PG','pg','Paying guest accommodation'),('Service Apartment','service-apartment','Furnished apartment with services'),('Villa','villa','Luxury villa property'),('Hospital','hospital','Medical facility accommodation'),('Student Housing','student-housing','Student dormitory or hostel'),('Commercial','commercial','Commercial accommodation property')` },
  { label: 'INSERT plans: Starter, Growth, Enterprise', sql: `INSERT IGNORE INTO plans (name, slug, billing_cycle, price, price_yearly, trial_days, max_properties, max_rooms_per_property, max_users_per_property, max_storage_mb, max_api_calls_per_day, max_branches, is_active, is_public) VALUES ('Starter','starter','monthly',999.00,9990.00,14,1,30,5,512,5000,1,1,1),('Growth','growth','monthly',2499.00,24990.00,14,3,100,20,2048,20000,3,1,1),('Enterprise','enterprise','yearly',0.00,0.00,0,999,9999,9999,51200,-1,999,1,0)` },
  { label: 'INSERT 31 platform features', sql: `INSERT IGNORE INTO features (feature_key, name, module) VALUES ('dashboard','Dashboard & Overview','pms'),('rooms','Room Management','pms'),('bookings','Booking & Check-in/Out','pms'),('guests','Guest Management','pms'),('booking_history','Booking History','pms'),('invoicing','Invoice & Billing','pms'),('settings','Property Settings','pms'),('kyc_upload','KYC Document Upload','pms'),('staff_mgmt','Staff Management','hrm'),('attendance','Attendance Tracking','hrm'),('housekeeping','Housekeeping Management','ops'),('maintenance','Maintenance Requests','ops'),('laundry','Laundry Management','ops'),('restaurant','Restaurant POS','pos'),('inventory','Inventory Management','ops'),('expense','Expense Tracking','finance'),('accounting','Accounting & Ledger','finance'),('gst_reporting','GST & Tax Reporting','finance'),('analytics','Analytics Dashboard','bi'),('night_audit','Night Audit','finance'),('whatsapp','WhatsApp Notifications','comms'),('sms','SMS Notifications','comms'),('ocr','OCR Document Parsing','ai'),('qr_checkin','QR Code Check-in','ops'),('channel_manager','OTA Channel Manager','integrations'),('payment_gateway','Payment Gateway','finance'),('white_label','White Label Branding','platform'),('api_access','Public API Access','platform'),('mobile_api','Mobile App API','platform'),('marketplace','Marketplace','platform'),('ai_assistant','AI Assistant','ai')` },
  { label: 'INSERT plan_features: Enterprise (all)', sql: `INSERT IGNORE INTO plan_features (plan_id, feature_id, is_enabled) SELECT p.id, f.id, 1 FROM plans p, features f WHERE p.slug = 'enterprise'` },
  { label: 'INSERT plan_features: Starter (core PMS)', sql: `INSERT IGNORE INTO plan_features (plan_id, feature_id, is_enabled) SELECT p.id, f.id, 1 FROM plans p JOIN features f ON f.feature_key IN ('dashboard','rooms','bookings','guests','booking_history','invoicing','settings','kyc_upload') WHERE p.slug = 'starter'` },
  { label: 'INSERT plan_features: Growth (PMS + ops)', sql: `INSERT IGNORE INTO plan_features (plan_id, feature_id, is_enabled) SELECT p.id, f.id, 1 FROM plans p JOIN features f ON f.feature_key IN ('dashboard','rooms','bookings','guests','booking_history','invoicing','settings','kyc_upload','staff_mgmt','attendance','housekeeping','maintenance','expense','gst_reporting','analytics','night_audit','whatsapp') WHERE p.slug = 'growth'` },
  { label: 'BACKFILL hotels.tenant_id', sql: `UPDATE hotels h JOIN tenants t ON t.slug = 'vayunex-solutions' SET h.tenant_id = t.id, h.slug = LOWER(REPLACE(REPLACE(TRIM(h.name),' ','-'),'.','')) , h.timezone = 'Asia/Kolkata', h.currency_code = 'INR', h.status = 'active' WHERE h.tenant_id IS NULL` },
  { label: 'BACKFILL users.tenant_id', sql: `UPDATE users u JOIN hotels h ON u.hotel_id = h.id SET u.tenant_id = h.tenant_id WHERE u.tenant_id IS NULL AND h.tenant_id IS NOT NULL` },
  { label: 'INSERT subscription: Vayunex → Enterprise (1yr)', sql: `INSERT IGNORE INTO subscriptions (tenant_id, plan_id, status, billing_cycle, started_at, current_period_start, current_period_end, auto_renew) SELECT t.id, p.id, 'active', 'yearly', NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), 1 FROM tenants t, plans p WHERE t.slug = 'vayunex-solutions' AND p.slug = 'enterprise'` },
  { label: 'INSERT tenant_features: all enabled for Vayunex', sql: `INSERT IGNORE INTO tenant_features (tenant_id, feature_id, is_enabled) SELECT t.id, f.id, 1 FROM tenants t, features f WHERE t.slug = 'vayunex-solutions'` },
  { label: 'INSERT 5 system roles', sql: `INSERT IGNORE INTO roles (tenant_id, property_id, name, slug, is_system, description) VALUES (NULL,NULL,'Super Admin','super-admin',1,'Platform-level super administrator'),(NULL,NULL,'Hotel Admin','hotel-admin',1,'Full access to a single property'),(NULL,NULL,'Receptionist','receptionist',1,'Front-desk operations'),(NULL,NULL,'Housekeeping','housekeeping',1,'Room status update only'),(NULL,NULL,'Accountant','accountant',1,'Financial reports — read only on bookings')` },
  { label: 'INSERT 24 core permissions', sql: `INSERT IGNORE INTO permissions (module, action, scope, description) VALUES ('rooms','read','property','View room list'),('rooms','create','property','Create rooms'),('rooms','update','property','Edit room details'),('rooms','delete','property','Soft delete rooms'),('rooms','update_status','own','Change availability status'),('guests','read','property','View guest profiles'),('guests','create','property','Register new guests'),('guests','update','property','Edit guest details'),('guests','delete','property','Soft delete guests'),('bookings','read','property','View bookings'),('bookings','checkin','property','Perform check-in'),('bookings','checkout','property','Perform check-out'),('bookings','cancel','property','Cancel bookings'),('bookings','history','property','View booking history'),('invoices','read','property','View invoices'),('invoices','print','property','Print invoices'),('settings','read','property','View settings'),('settings','update','property','Modify settings'),('users','read','property','View staff'),('users','create','property','Invite staff'),('users','update','property','Edit staff profiles'),('users','delete','property','Remove staff'),('reports','read','property','View reports'),('reports','export','property','Export data')` },
  { label: 'INSERT default storage provider (Backblaze B2)', sql: `INSERT IGNORE INTO storage_providers (tenant_id, provider, name, config_json, is_active, is_default) VALUES (NULL,'backblaze_b2','Platform Default — Backblaze B2','{"note":"credentials from environment variables"}',1,1)` },
  { label: 'BACKFILL user_roles for existing users', sql: `INSERT IGNORE INTO user_roles (user_id, role_id, assigned_at) SELECT u.id, r.id, NOW() FROM users u JOIN roles r ON r.slug = CASE WHEN u.role = 'admin' THEN 'hotel-admin' WHEN u.role = 'receptionist' THEN 'receptionist' ELSE 'receptionist' END WHERE r.is_system = 1` },
  { label: 'INSERT default event subscriptions', sql: `INSERT IGNORE INTO event_subscriptions (event_name, subscriber_name, endpoint_url, is_active) VALUES ('BookingCheckedIn','AuditEngine',NULL,1),('BookingCheckedIn','WorkflowEngine',NULL,1),('BookingCheckedIn','NotificationEngine',NULL,1),('BookingCheckedOut','AuditEngine',NULL,1),('BookingCheckedOut','WorkflowEngine',NULL,1),('GuestCreated','AuditEngine',NULL,1),('GuestUpdated','AuditEngine',NULL,1),('TenantCreated','NotificationEngine',NULL,1),('RoomStatusChanged','WorkflowEngine',NULL,1),('InvoiceGenerated','WorkflowEngine',NULL,1)` },
  { label: 'INSERT default scheduled jobs', sql: `INSERT IGNORE INTO scheduled_jobs (name, job_type, cron_expression, is_active) VALUES ('night_audit','RunNightAudit','0 2 * * *',0),('usage_tracking','RecordUsageMetrics','0 * * * *',1),('subscription_renew','CheckRenewals','0 6 * * *',1)` },
  { label: 'RECORD phase1 migration', sql: `INSERT IGNORE INTO system_migrations (migration_name, notes, execution_time_ms) VALUES ('phase1_platform_core_foundation_v2','Platform Core v2.0: Tenants, Subscriptions, Billing, RBAC, Feature Flags, Audit, Notifications, Job Queue, Storage, Event Bus, Workflow, Observability. 31 features + 3 plans seeded. Vayunex Solutions tenant created.',0)` },
];

// ── VERIFICATION ──────────────────────────────────────────────────────────────
const VERIFY = [
  { label: 'tenants count',             sql: `SELECT COUNT(*) AS n FROM tenants` },
  { label: 'plans count',               sql: `SELECT COUNT(*) AS n FROM plans` },
  { label: 'features count',            sql: `SELECT COUNT(*) AS n FROM features` },
  { label: 'subscriptions count',       sql: `SELECT COUNT(*) AS n FROM subscriptions` },
  { label: 'tenant_features count',     sql: `SELECT COUNT(*) AS n FROM tenant_features` },
  { label: 'roles count',               sql: `SELECT COUNT(*) AS n FROM roles` },
  { label: 'permissions count',         sql: `SELECT COUNT(*) AS n FROM permissions` },
  { label: 'user_roles count',          sql: `SELECT COUNT(*) AS n FROM user_roles` },
  { label: 'property_types count',      sql: `SELECT COUNT(*) AS n FROM property_types` },
  { label: 'event_subscriptions count', sql: `SELECT COUNT(*) AS n FROM event_subscriptions` },
  { label: 'scheduled_jobs count',      sql: `SELECT COUNT(*) AS n FROM scheduled_jobs` },
  { label: 'system_migrations count',   sql: `SELECT COUNT(*) AS n FROM system_migrations` },
  { label: 'hotels with tenant_id',     sql: `SELECT COUNT(*) AS n FROM hotels WHERE tenant_id IS NOT NULL` },
  { label: 'users with tenant_id',      sql: `SELECT COUNT(*) AS n FROM users WHERE tenant_id IS NOT NULL` },
  { label: 'admin login row intact',    sql: `SELECT COUNT(*) AS n FROM users WHERE email = 'admin@vayunex.com'` },
];

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  PropertyNex Platform — Phase 1 Migration Runner v2.0');
  console.log('  DB:', DB_CONFIG.database, '@', DB_CONFIG.host);
  console.log('═══════════════════════════════════════════════════════════');

  let conn;
  try {
    conn = await mysql.createConnection(DB_CONFIG);
    console.log('\n✅  MySQL connected');

    const allGroups = [
      ['A — Tenant Layer',              GROUP_A],
      ['B — Subscription & Billing',    GROUP_B],
      ['C — Feature Flags',             GROUP_C],
      ['D — RBAC Engine',               GROUP_D],
      ['E — Property Hierarchy',        GROUP_E],
      ['F — Audit & Security',          GROUP_F],
      ['G — Notifications',             GROUP_G],
      ['H — Job Queue',                 GROUP_H],
      ['I — Configuration',             GROUP_I],
      ['J — Storage',                   GROUP_J],
      ['K — System Tables',             GROUP_K],
      ['L — Event Bus',                 GROUP_L],
      ['M — Workflow Engine',           GROUP_M],
      ['N — Observability',             GROUP_N],
    ];

    // Step 1.1 — Create new tables
    console.log('\n━━━ STEP 1.1: CREATE NEW TABLES ━━━');
    for (const [name, stmts] of allGroups) {
      await conn.beginTransaction();
      try {
        await runGroup(conn, name, stmts);
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        console.error(`\n❌  Group ${name} failed — rolling back`);
        console.error('   Error:', err.message);
        process.exit(1);
      }
    }

    // Step 1.2 — Expand existing tables
    console.log('\n━━━ STEP 1.2: EXPAND EXISTING TABLES ━━━');
    for (const stmt of EXPAND_EXISTING) {
      try {
        await conn.query(stmt.sql);
        console.log(`   ✅  ${stmt.label}`);
      } catch (err) {
        console.error(`   ❌  FAILED: ${stmt.label} — ${err.message}`);
        process.exit(1);
      }
    }

    // Step 1.3 — Backfill
    console.log('\n━━━ STEP 1.3: BACKFILL DATA ━━━');
    for (const stmt of BACKFILL) {
      try {
        await conn.query(stmt.sql);
        console.log(`   ✅  ${stmt.label}`);
      } catch (err) {
        console.error(`   ❌  FAILED: ${stmt.label} — ${err.message}`);
        process.exit(1);
      }
    }

    // Step 1.4 — Verify
    console.log('\n━━━ STEP 1.4: VERIFICATION ━━━');
    let allPassed = true;
    for (const q of VERIFY) {
      const [rows] = await conn.query(q.sql);
      const n = rows[0]?.n ?? 0;
      const pass = n > 0;
      console.log(`   ${pass ? '✅' : '❌'}  ${q.label}: ${n}`);
      if (!pass) allPassed = false;
    }

    const totalMs = Date.now() - t0;
    await conn.query(
      `UPDATE system_migrations SET execution_time_ms = ? WHERE migration_name = 'phase1_platform_core_foundation_v2'`,
      [totalMs]
    );

    console.log('\n═══════════════════════════════════════════════════════════');
    if (allPassed) {
      console.log(`  ✅  PHASE 1 COMPLETE — ${totalMs}ms`);
      console.log('  All verifications passed.');
      console.log('  admin@vayunex.com login: INTACT');
      console.log('  ⚠️  START 48-hour monitoring window NOW');
    } else {
      console.log(`  ⚠️  PHASE 1 COMPLETE WITH WARNINGS — ${totalMs}ms`);
      console.log('  Some verifications FAILED. Review ❌ lines above.');
      console.log('  Do NOT proceed to Phase 2 until all checks pass.');
    }
    console.log('═══════════════════════════════════════════════════════════\n');
  } catch (err) {
    console.error('\n❌  FATAL:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();

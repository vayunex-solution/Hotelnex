import db from '../config/db.js';

async function migrate() {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    console.log('Starting Sprint 2.2 Module 1 Migration...');

    // 1. ALTER users table (Additive only)
    console.log('1. Altering users table...');
    const alterUsersQuery = `
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS phone VARCHAR(50) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en',
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
      ADD COLUMN IF NOT EXISTS email_verified TINYINT(1) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS verification_method VARCHAR(50) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS marketing_consent TINYINT(1) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMP NULL DEFAULT NULL
    `;
    await conn.query(alterUsersQuery);

    // 2. CREATE user_verifications
    console.log('2. Creating user_verifications table...');
    const createUserVerifications = `
      CREATE TABLE IF NOT EXISTS user_verifications (
        id INT(11) AUTO_INCREMENT PRIMARY KEY,
        user_id INT(11) NOT NULL,
        verification_type VARCHAR(50) NOT NULL,
        verification_token VARCHAR(255) NOT NULL,
        verification_method VARCHAR(50) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        verified_at TIMESTAMP NULL DEFAULT NULL,
        attempts INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_token (verification_token)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await conn.query(createUserVerifications);

    // 3. CREATE email_templates
    console.log('3. Creating email_templates table...');
    const createEmailTemplates = `
      CREATE TABLE IF NOT EXISTS email_templates (
        id INT(11) AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        subject_template VARCHAR(255) NOT NULL,
        html_body TEXT NOT NULL,
        variables_schema JSON,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await conn.query(createEmailTemplates);

    // 4. CREATE email_queue
    console.log('4. Creating email_queue table...');
    const createEmailQueue = `
      CREATE TABLE IF NOT EXISTS email_queue (
        id INT(11) AUTO_INCREMENT PRIMARY KEY,
        template_id INT(11) NOT NULL,
        to_email VARCHAR(255) NOT NULL,
        payload JSON NOT NULL,
        status ENUM('pending', 'processing', 'failed', 'sent') DEFAULT 'pending',
        attempts INT DEFAULT 0,
        send_after TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await conn.query(createEmailQueue);

    // 5. CREATE email_logs
    console.log('5. Creating email_logs table...');
    const createEmailLogs = `
      CREATE TABLE IF NOT EXISTS email_logs (
        id INT(11) AUTO_INCREMENT PRIMARY KEY,
        queue_id INT(11) DEFAULT NULL,
        to_email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        error_message TEXT,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_to_email (to_email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await conn.query(createEmailLogs);

    // 6. CREATE property_drafts
    console.log('6. Creating property_drafts table...');
    const createPropertyDrafts = `
      CREATE TABLE IF NOT EXISTS property_drafts (
        id INT(11) AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT(11) NOT NULL,
        draft_data JSON NOT NULL,
        step INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tenant_id (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await conn.query(createPropertyDrafts);

    // 7. Legacy Migration
    console.log('7. Running Legacy User Migration...');
    const legacyMigrationQuery = `
      UPDATE users 
      SET 
        email_verified = 1, 
        verification_method = 'legacy_migration' 
      WHERE email_verified = 0 OR email_verified IS NULL
    `;
    const [legacyResult] = await conn.query(legacyMigrationQuery);
    console.log('Legacy Migration applied to ' + legacyResult.affectedRows + ' users.');

    await conn.commit();
    console.log('Migration completed successfully!');
  } catch (error) {
    await conn.rollback();
    console.error('Migration failed:', error);
  } finally {
    conn.release();
    process.exit();
  }
}

migrate();

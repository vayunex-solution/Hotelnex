import pool from '../src/config/db.js';

async function migrate() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    console.log('Starting Module 4B database migration...');

    // 1. provisioning_step_definitions
    console.log('Creating provisioning_step_definitions...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS provisioning_step_definitions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        step_order INT NOT NULL UNIQUE,
        step_name VARCHAR(100) NOT NULL,
        description TEXT,
        handler_name VARCHAR(100) NOT NULL,
        timeout_seconds INT DEFAULT 60,
        retry_limit INT DEFAULT 3,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. provisioning_jobs
    console.log('Creating provisioning_jobs...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS provisioning_jobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        property_id INT NOT NULL,
        tenant_id INT NOT NULL,
        idempotency_key VARCHAR(100) NOT NULL UNIQUE,
        status ENUM('Pending', 'Running', 'Completed', 'Failed', 'Cancelled', 'Retrying') DEFAULT 'Pending',
        progress_percent INT DEFAULT 0,
        locked_by VARCHAR(100) DEFAULT NULL,
        locked_at TIMESTAMP NULL DEFAULT NULL,
        created_by INT,
        started_at TIMESTAMP NULL DEFAULT NULL,
        completed_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES hotels(id) ON DELETE CASCADE
      )
    `);

    // 3. provisioning_steps
    console.log('Creating provisioning_steps...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS provisioning_steps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        job_id INT NOT NULL,
        step_definition_id INT NOT NULL,
        status ENUM('Pending', 'Running', 'Success', 'Failed', 'Skipped') DEFAULT 'Pending',
        error_message TEXT,
        output_json JSON,
        retry_count INT DEFAULT 0,
        execution_time_ms INT DEFAULT 0,
        started_at TIMESTAMP NULL DEFAULT NULL,
        completed_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES provisioning_jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (step_definition_id) REFERENCES provisioning_step_definitions(id)
      )
    `);

    // 4. provisioning_logs
    console.log('Creating provisioning_logs...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS provisioning_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        job_id INT NOT NULL,
        step_id INT NULL,
        log_level VARCHAR(20) DEFAULT 'INFO',
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES provisioning_jobs(id) ON DELETE CASCADE
      )
    `);

    // 5. Seed Definitions
    console.log('Seeding step definitions...');
    const steps = [
      { order: 1, name: 'INITIALIZE_PROPERTY', handler: 'initializeProperty', desc: 'Initialize Property Configuration' },
      { order: 2, name: 'CREATE_DATABASE_CONFIG', handler: 'createDatabaseConfig', desc: 'Create Database Configuration' },
      { order: 3, name: 'CONFIGURE_STORAGE', handler: 'configureStorage', desc: 'Configure Storage' },
      { order: 4, name: 'APPLY_BRANDING', handler: 'applyBranding', desc: 'Apply Branding' },
      { order: 5, name: 'APPLY_PROPERTY_SETTINGS', handler: 'applyPropertySettings', desc: 'Apply Property Settings' },
      { order: 6, name: 'GENERATE_DEFAULT_ROLES', handler: 'generateDefaultRoles', desc: 'Generate Default Roles' },
      { order: 7, name: 'ASSIGN_PERMISSIONS', handler: 'assignPermissions', desc: 'Assign Permissions' },
      { order: 8, name: 'ENABLE_FEATURES', handler: 'enableFeatures', desc: 'Enable Features' },
      { order: 9, name: 'CREATE_HOTEL_ADMIN', handler: 'createHotelAdmin', desc: 'Create Hotel Admin' },
      { order: 10, name: 'GENERATE_VERIFICATION', handler: 'generateVerification', desc: 'Generate Verification' },
      { order: 11, name: 'QUEUE_WELCOME_EMAIL', handler: 'queueWelcomeEmail', desc: 'Queue Welcome Email' },
      { order: 12, name: 'RUN_HEALTH_CHECK', handler: 'runHealthCheck', desc: 'Run Health Check' },
      { order: 13, name: 'MARK_PROPERTY_READY', handler: 'markPropertyReady', desc: 'Mark Property Ready' }
    ];

    await conn.query('DELETE FROM provisioning_step_definitions'); // Fresh start
    for (const step of steps) {
      await conn.query(
        `INSERT INTO provisioning_step_definitions (step_order, step_name, description, handler_name) 
         VALUES (?, ?, ?, ?)`,
        [step.order, step.name, step.desc, step.handler]
      );
    }

    await conn.commit();
    console.log('Migration completed successfully.');
  } catch (err) {
    await conn.rollback();
    console.error('Migration failed:', err);
  } finally {
    conn.release();
    process.exit();
  }
}

migrate();

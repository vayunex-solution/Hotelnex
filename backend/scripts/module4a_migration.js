import pool from '../src/config/db.js';
import crypto from 'crypto';

async function migrate() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    console.log('Starting Module 4A database migration...');

    // 1. Create property_statuses table
    console.log('Creating property_statuses table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS property_statuses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Insert statuses
    console.log('Seeding property_statuses...');
    const statuses = ['Draft', 'Configured', 'Ready', 'Active', 'Maintenance', 'Suspended', 'Archived'];
    for (const status of statuses) {
      await conn.query('INSERT IGNORE INTO property_statuses (name) VALUES (?)', [status]);
    }

    // 3. Alter hotels table: Add new columns if not exist
    console.log('Adding new columns to hotels...');
    
    // Helper to check if column exists
    const checkCol = async (col) => {
      const [rows] = await conn.query(`
        SELECT COUNT(*) as count 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotels' AND COLUMN_NAME = ?
      `, [col]);
      return rows[0].count > 0;
    };

    if (!(await checkCol('status_id'))) {
      await conn.query('ALTER TABLE hotels ADD COLUMN status_id INT DEFAULT NULL');
      
      // Map old status to new status_id
      await conn.query(`
        UPDATE hotels h
        JOIN property_statuses ps ON 
          (h.status = 'active' AND ps.name = 'Active') OR
          (h.status = 'inactive' AND ps.name = 'Maintenance') OR
          (h.status = 'suspended' AND ps.name = 'Suspended')
        SET h.status_id = ps.id
      `);

      // Default for any unmapped
      const [activeStatus] = await conn.query("SELECT id FROM property_statuses WHERE name = 'Active'");
      await conn.query('UPDATE hotels SET status_id = ? WHERE status_id IS NULL', [activeStatus[0].id]);

      // Make it NOT NULL and Foreign Key
      await conn.query('ALTER TABLE hotels MODIFY COLUMN status_id INT NOT NULL');
      await conn.query('ALTER TABLE hotels ADD CONSTRAINT fk_hotel_status FOREIGN KEY (status_id) REFERENCES property_statuses(id)');
      
      // Drop old status column
      await conn.query('ALTER TABLE hotels DROP COLUMN status');
    }

    if (!(await checkCol('property_code'))) {
      await conn.query('ALTER TABLE hotels ADD COLUMN property_code VARCHAR(20) UNIQUE');
      
      // Generate codes for existing hotels
      const [hotels] = await conn.query('SELECT id FROM hotels');
      for (const hotel of hotels) {
        const code = 'PRP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        await conn.query('UPDATE hotels SET property_code = ? WHERE id = ?', [code, hotel.id]);
      }
      
      await conn.query('ALTER TABLE hotels MODIFY COLUMN property_code VARCHAR(20) NOT NULL');
    }

    if (!(await checkCol('created_by'))) {
      await conn.query('ALTER TABLE hotels ADD COLUMN created_by INT DEFAULT NULL');
      await conn.query('ALTER TABLE hotels ADD COLUMN updated_by INT DEFAULT NULL');
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

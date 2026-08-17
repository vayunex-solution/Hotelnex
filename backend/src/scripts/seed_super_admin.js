/**
 * seed_super_admin.js
 * Run once: node src/scripts/seed_super_admin.js
 * Creates a Platform Super Admin user in the existing users table.
 * Idempotent — safe to run multiple times.
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const SUPER_ADMIN = {
  email:     'superadmin@propertynex.com',
  password:  'SuperAdmin@2024!',
  name:      'PropertyNex Super Admin',
  role:      'super_admin',
};

async function seed() {
  const conn = await pool.getConnection();
  try {
    console.log('🔍 Checking if super admin already exists...');

    const [rows] = await conn.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [SUPER_ADMIN.email],
    );

    if (rows.length > 0) {
      console.log(`✅ Super Admin already exists (id=${rows[0].id}). Nothing to do.`);
      return;
    }

    const hash = await bcrypt.hash(SUPER_ADMIN.password, 12);

    // hotel_id has a NOT NULL FK constraint — use the first existing hotel as placeholder.
    // Super admin scope is determined by is_super_admin flag, NOT hotel_id.
    const [[firstHotel]] = await conn.execute(`SELECT id FROM hotels LIMIT 1`);
    if (!firstHotel) {
      throw new Error('No hotel found in database. Run the migration first.');
    }
    const placeholderHotelId = firstHotel.id;

    const [result] = await conn.execute(
      `INSERT INTO users
         (name, email, password_hash, role, is_super_admin, is_active, hotel_id, tenant_id, created_at, updated_at)
       VALUES
         (?, ?, ?, ?, 1, 1, ?, NULL, NOW(), NOW())`,
      [SUPER_ADMIN.name, SUPER_ADMIN.email, hash, SUPER_ADMIN.role, placeholderHotelId],
    );

    console.log(`🚀 Super Admin seeded successfully!`);
    console.log(`   ID    : ${result.insertId}`);
    console.log(`   Email : ${SUPER_ADMIN.email}`);
    console.log(`   Temp Password : ${SUPER_ADMIN.password}`);
    console.log(`   ⚠️  Change this password immediately after first login!`);

  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

seed().catch(() => process.exit(1));

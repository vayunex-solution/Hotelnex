import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const HOTEL_NAME = 'Grand Vayunex Hotel';
const ADMIN_EMAIL = 'admin@vayunex.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_NAME = 'Super Admin';
const SALT_ROUNDS = 12;

async function seedAdmin() {
  try {
    // --- Create Hotel if not exists ---
    const [existingHotels] = await pool.execute(
      'SELECT id FROM hotels WHERE name = ? LIMIT 1',
      [HOTEL_NAME]
    );

    let hotelId;

    if (existingHotels && existingHotels.length > 0) {
      hotelId = existingHotels[0].id;
      console.log(`[Hotel]  Already Exists → ID: ${hotelId}`);
    } else {
      const [hotelResult] = await pool.execute(
        'INSERT INTO hotels (name, address) VALUES (?, ?)',
        [HOTEL_NAME, '1 Vayunex Tower, Grand Avenue, Mumbai, India']
      );
      hotelId = hotelResult.insertId;
      console.log(`[Hotel]  Created → "${HOTEL_NAME}" (ID: ${hotelId})`);
    }

    // --- Create Admin if not exists ---
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [ADMIN_EMAIL]
    );

    if (existingUsers && existingUsers.length > 0) {
      console.log(`[Admin]  Already Exists → ${ADMIN_EMAIL}`);
    } else {
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

      await pool.execute(
        'INSERT INTO users (hotel_id, role, name, email, password_hash) VALUES (?, ?, ?, ?, ?)',
        [hotelId, 'admin', ADMIN_NAME, ADMIN_EMAIL, passwordHash]
      );
      console.log(`[Admin]  Created → ${ADMIN_EMAIL} (Role: admin)`);
    }

    console.log('[Seeder] Completed successfully.');
    process.exit(0);

  } catch (error) {
    console.error('[Seeder] Fatal error:', error.message);
    process.exit(1);
  }
}

// Start seeding
seedAdmin();

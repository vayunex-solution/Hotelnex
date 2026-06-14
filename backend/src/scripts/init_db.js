import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbType = process.env.DB_TYPE || 'mysql';
const dbName = process.env.DB_NAME || 'hotel_management';

// --- MySQL Table Queries ---
const mysqlTableQueries = [
  {
    name: 'hotels',
    sql: `
      CREATE TABLE IF NOT EXISTS hotels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  {
    name: 'users',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hotel_id INT NOT NULL,
        role ENUM('admin', 'receptionist') NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_users_hotel FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
        INDEX idx_users_hotel_id (hotel_id),
        INDEX idx_users_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  {
    name: 'rooms',
    sql: `
      CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hotel_id INT NOT NULL,
        room_number VARCHAR(50) NOT NULL,
        category ENUM('Standard', 'Deluxe', 'Suite') NOT NULL,
        base_rate DECIMAL(10,2) NOT NULL,
        status ENUM('Available', 'Occupied', 'Maintenance') NOT NULL DEFAULT 'Available',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_rooms_hotel FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
        INDEX idx_rooms_hotel_id (hotel_id),
        INDEX idx_rooms_room_number (room_number),
        INDEX idx_rooms_status (status),
        UNIQUE INDEX idx_rooms_hotel_room (hotel_id, room_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  {
    name: 'guests',
    sql: `
      CREATE TABLE IF NOT EXISTS guests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hotel_id INT NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        phone_number VARCHAR(50) NOT NULL,
        document_url VARCHAR(511),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_guests_hotel FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
        INDEX idx_guests_hotel_id (hotel_id),
        INDEX idx_guests_phone_number (phone_number),
        UNIQUE INDEX idx_guests_hotel_phone (hotel_id, phone_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  {
    name: 'guest_documents',
    sql: `
      CREATE TABLE IF NOT EXISTS guest_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guest_id INT NOT NULL,
        guest_photo VARCHAR(511),
        id_front VARCHAR(511),
        id_back VARCHAR(511),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_docs_guest FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
        INDEX idx_docs_guest_id (guest_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  {
    name: 'bookings',
    sql: `
      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hotel_id INT NOT NULL,
        room_id INT NOT NULL,
        guest_id INT NOT NULL,
        receptionist_id INT NOT NULL,
        check_in_time DATETIME NOT NULL,
        expected_check_out DATETIME NOT NULL,
        actual_check_out DATETIME NULL,
        room_rate DECIMAL(10,2) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        advance_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        status ENUM('Active', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_bookings_hotel FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
        CONSTRAINT fk_bookings_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT,
        CONSTRAINT fk_bookings_guest FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE RESTRICT,
        CONSTRAINT fk_bookings_receptionist FOREIGN KEY (receptionist_id) REFERENCES users(id) ON DELETE RESTRICT,
        INDEX idx_bookings_hotel_id (hotel_id),
        INDEX idx_bookings_room_id (room_id),
        INDEX idx_bookings_guest_id (guest_id),
        INDEX idx_bookings_receptionist_id (receptionist_id),
        INDEX idx_bookings_status (status),
        INDEX idx_bookings_check_in_time (check_in_time),
        INDEX idx_bookings_hotel_status (hotel_id, status),
        INDEX idx_bookings_hotel_room (hotel_id, room_id),
        INDEX idx_bookings_hotel_check_in (hotel_id, check_in_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  }
];

// --- SQLite Schema Queries ---
const sqliteSchemaQueries = [
  // 1. hotels
  `CREATE TABLE IF NOT EXISTS hotels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // 2. users
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id INT NOT NULL,
    role VARCHAR(50) NOT NULL CHECK(role IN ('admin', 'receptionist')),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_hotel FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS idx_users_hotel_id ON users(hotel_id);`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,

  // 3. rooms
  `CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id INT NOT NULL,
    room_number VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK(category IN ('Standard', 'Deluxe', 'Suite')),
    base_rate DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Available' CHECK(status IN ('Available', 'Occupied', 'Maintenance')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rooms_hotel FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
    UNIQUE(hotel_id, room_number)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_rooms_hotel_id ON rooms(hotel_id);`,
  `CREATE INDEX IF NOT EXISTS idx_rooms_room_number ON rooms(room_number);`,
  `CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);`,

  // 4. guests
  `CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id INT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    document_url VARCHAR(511),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_guests_hotel FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
    UNIQUE(hotel_id, phone_number)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_guests_hotel_id ON guests(hotel_id);`,
  `CREATE INDEX IF NOT EXISTS idx_guests_phone_number ON guests(phone_number);`,

  // 4b. guest_documents
  `CREATE TABLE IF NOT EXISTS guest_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_id INT NOT NULL,
    guest_photo VARCHAR(511),
    id_front VARCHAR(511),
    id_back VARCHAR(511),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_docs_guest FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS idx_docs_guest_id ON guest_documents(guest_id);`,

  // 5. bookings
  `CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id INT NOT NULL,
    room_id INT NOT NULL,
    guest_id INT NOT NULL,
    receptionist_id INT NOT NULL,
    check_in_time DATETIME NOT NULL,
    expected_check_out DATETIME NOT NULL,
    actual_check_out DATETIME NULL,
    room_rate DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    advance_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Completed', 'Cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bookings_hotel FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
    CONSTRAINT fk_bookings_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_guest FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_receptionist FOREIGN KEY (receptionist_id) REFERENCES users(id) ON DELETE RESTRICT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_hotel_id ON bookings(hotel_id);`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id);`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_guest_id ON bookings(guest_id);`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_receptionist_id ON bookings(receptionist_id);`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_check_in_time ON bookings(check_in_time);`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_hotel_status ON bookings(hotel_id, status);`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_hotel_room ON bookings(hotel_id, room_id);`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_hotel_check_in ON bookings(hotel_id, check_in_time);`
];

async function initializeMySQL() {
  const startTime = Date.now();
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DB_PORT || '3306', 10),
    });

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );

    await connection.query(`USE \`${dbName}\``);
    await connection.beginTransaction();

    for (const query of mysqlTableQueries) {
      try {
        await connection.query(query.sql);
      } catch (sqlError) {
        await connection.rollback();
        console.error(`Failed executing SQL section for table: ${query.name}`);
        console.error('SQL query content:', query.sql);
        console.error('Error details:', sqlError.message);
        process.exit(1);
      }
    }

    await connection.commit();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('[MySQL] Successfully created tables:');
    mysqlTableQueries.forEach(q => console.log(` - ${q.name}`));
    console.log(`Execution duration: ${duration}s`);
    process.exit(0);

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rbError) {
        console.error('Failed to rollback transaction:', rbError.message);
      }
    }
    console.error('MySQL database initialization encountered a fatal error:');
    console.error(error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function initializeSQLite() {
  const startTime = Date.now();
  const dbPath = path.resolve(__dirname, '../../database.sqlite');
  console.log(`[SQLite] Initializing SQLite database at: ${dbPath}`);

  // Open database connection
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('[SQLite] Failed to connect/create SQLite database:', err.message);
      process.exit(1);
    }
  });

  try {
    // 1. Enable foreign keys
    await new Promise((resolve, reject) => {
      db.run('PRAGMA foreign_keys = ON;', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 2. Run each schema query in sequence
    for (const sql of sqliteSchemaQueries) {
      await new Promise((resolve, reject) => {
        db.run(sql, (err) => {
          if (err) {
            console.error('[SQLite] Failed executing SQL statement:', sql);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('[SQLite] Successfully created all tables and indexes.');
    console.log(`Execution duration: ${duration}s`);
    db.close();
    process.exit(0);
  } catch (error) {
    console.error('[SQLite] Database initialization encountered a fatal error:');
    console.error(error.message);
    db.close();
    process.exit(1);
  }
}

if (dbType === 'sqlite') {
  initializeSQLite();
} else {
  initializeMySQL();
}

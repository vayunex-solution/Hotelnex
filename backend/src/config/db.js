import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const dbType = process.env.DB_TYPE || 'mysql';

let pool;

if (dbType === 'sqlite') {
  const sqlite3 = require('sqlite3');
  const dbPath = path.resolve(__dirname, '../../database.sqlite');
  console.log(`[Database] Initializing SQLite database at: ${dbPath}`);
  
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('[SQLite] Failed to connect to SQLite database:', err.message);
    } else {
      console.log('[SQLite] Connected to SQLite database.');
      // Enable foreign keys in SQLite
      db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
        if (pragmaErr) {
          console.error('[SQLite] Failed to enable foreign keys:', pragmaErr.message);
        }
      });
    }
  });

  // Mock MySQL Pool signature: pool.execute() / pool.query() -> [rows, fields]
  pool = {
    query: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        const sqlTrim = sql.trim();
        const sqlLower = sqlTrim.toLowerCase();
        
        if (
          sqlLower.startsWith('insert') || 
          sqlLower.startsWith('update') || 
          sqlLower.startsWith('delete') ||
          sqlLower.startsWith('replace')
        ) {
          db.run(sql, params, function (err) {
            if (err) return reject(err);
            // MySQL insertResult has insertId and affectedRows
            resolve([{ insertId: this.lastID, affectedRows: this.changes }, undefined]);
          });
        } else {
          db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve([rows, undefined]);
          });
        }
      });
    },
    execute: (sql, params = []) => {
      // For SQLite, query and execute are identical
      return pool.query(sql, params);
    }
  };
} else {
  console.log('[Database] Initializing MySQL Connection Pool...');
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hotel_management',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

// Intercept pool query and execute methods for observability slow query logging
const originalQuery = pool.query;
pool.query = async function(...args) {
  const start = Date.now();
  try {
    const result = await originalQuery.apply(this, args);
    const duration = Date.now() - start;
    
    // Ignore slow-query-logger queries to prevent circular recursion
    const sql = args[0];
    if (sql && typeof sql === 'string' && !sql.includes('slow_queries') && !sql.includes('system_metrics')) {
      import('../core/observability/slowQueryLogger.js').then((module) => {
        module.default.checkAndLog(sql, duration);
      }).catch(() => {});
    }
    return result;
  } catch (err) {
    throw err;
  }
};

const originalExecute = pool.execute;
pool.execute = async function(...args) {
  const start = Date.now();
  try {
    const result = await originalExecute.apply(this, args);
    const duration = Date.now() - start;
    
    const sql = args[0];
    if (sql && typeof sql === 'string' && !sql.includes('slow_queries') && !sql.includes('system_metrics')) {
      import('../core/observability/slowQueryLogger.js').then((module) => {
        module.default.checkAndLog(sql, duration);
      }).catch(() => {});
    }
    return result;
  } catch (err) {
    throw err;
  }
};

export default pool;


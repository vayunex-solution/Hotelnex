import pool from '../config/db.js';

async function auditDatabaseSchema() {
  console.log('================================================================');
  console.log('🏨 HOTELNEX DATABASE FORENSIC SCHEMA AUDIT');
  console.log('================================================================\n');

  // 1. Tables verification
  const targetTables = ['payments', 'receivables', 'billing_adjustments', 'cash_drawers', 'cash_drawer_movements'];
  const [tables] = await pool.query(
    `SELECT TABLE_NAME, ENGINE, TABLE_COLLATION, TABLE_ROWS 
     FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)`,
    [targetTables]
  );
  console.log('1. Target Finance Tables:');
  console.table(tables);

  // 2. Columns, Nullability, Defaults & Data Types
  console.log('\n2. Table Columns & Types:');
  for (const t of targetTables) {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [t]
    );
    console.log(`\n--- TABLE: ${t} ---`);
    console.table(cols);
  }

  // 3. Bookings columns
  console.log('\n3. Bookings Table Extensions:');
  const [bCols] = await pool.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
     FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings'
       AND COLUMN_NAME IN ('payment_status', 'settlement_notes')`
  );
  console.table(bCols);

  // 4. Indexes & Keys
  console.log('\n4. Indexes & Constraints on Finance Tables:');
  for (const t of targetTables) {
    const [indexes] = await pool.query(
      `SHOW INDEX FROM ${t}`
    );
    console.log(`\n--- INDEXES: ${t} ---`);
    console.table(indexes.map(i => ({
      Table: i.Table,
      Key_name: i.Key_name,
      Column_name: i.Column_name,
      Non_unique: i.Non_unique,
      Index_type: i.Index_type
    })));
  }

  process.exit(0);
}

auditDatabaseSchema().catch(err => {
  console.error('Schema audit error:', err);
  process.exit(1);
});

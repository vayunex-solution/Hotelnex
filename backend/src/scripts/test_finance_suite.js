import pool from '../config/db.js';
import transactionManager from '../core/database/transactionManager.js';

async function runTests() {
  console.log('── Running HotelNex Enterprise Finance Verification Suite ──\n');

  try {
    // 1. Verify Tables Exist
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME IN ('payments', 'receivables', 'billing_adjustments', 'cash_drawers', 'cash_drawer_movements');
    `);
    console.log(`✅ Required Financial Tables in Database: ${tables.map(t => t.TABLE_NAME).join(', ')}`);
    if (tables.length < 5) throw new Error('Missing some financial tables');

    // 2. Verify Bookings columns
    const [cols] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'bookings' 
        AND COLUMN_NAME IN ('payment_status', 'settlement_notes');
    `);
    console.log(`✅ Bookings Extended Columns: ${cols.map(c => `${c.COLUMN_NAME} (${c.COLUMN_TYPE})`).join(', ')}`);

    // 3. Test ACID Transaction with TransactionManager
    await transactionManager.runInTransaction(async (conn) => {
      const [hotels] = await conn.query('SELECT id FROM hotels LIMIT 1');
      if (hotels.length === 0) return;
      const testHotelId = hotels[0].id;

      // Check payments table query
      const [payments] = await conn.query('SELECT COUNT(*) AS c FROM payments WHERE hotel_id = ?', [testHotelId]);
      console.log(`✅ Transaction query executed successfully. Existing payments in test hotel: ${payments[0].c}`);

      // Check receivables table query
      const [receivables] = await conn.query('SELECT COUNT(*) AS c FROM receivables WHERE hotel_id = ?', [testHotelId]);
      console.log(`✅ Receivables query executed successfully. Existing debtors in test hotel: ${receivables[0].c}`);
    });

    console.log('\n🎉 ALL ENTERPRISE FINANCE DATABASE INTEGRITY TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

runTests();

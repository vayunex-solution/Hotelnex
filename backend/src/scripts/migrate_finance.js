import pool from '../config/db.js';

/**
 * Migration runner for Finance, Payments, Receivables, Adjustments & Cash Drawer
 */
export const runFinanceMigration = async () => {
  try {
    // 1. payments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NULL,
        hotel_id INT NOT NULL,
        booking_id INT NOT NULL,
        guest_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_type ENUM('Advance', 'Checkout_Settlement', 'Mid_Stay', 'Post_Checkout_Due', 'Refund', 'Reversal') NOT NULL,
        payment_mode ENUM('Cash', 'UPI', 'Card', 'Bank_Transfer', 'Other') NOT NULL,
        transaction_ref VARCHAR(100) NULL,
        notes TEXT NULL,
        collected_by INT NOT NULL,
        status ENUM('completed', 'reversed', 'refunded') NOT NULL DEFAULT 'completed',
        idempotency_key VARCHAR(100) NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_payments_hotel_created (hotel_id, created_at),
        INDEX idx_payments_booking (booking_id),
        INDEX idx_payments_guest (guest_id),
        INDEX idx_payments_mode (payment_mode),
        INDEX idx_payments_type (payment_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[Migration] payments table ensured.');
  } catch (e) {
    console.warn('[Migration] payments table warning:', e.message);
  }

  try {
    // 2. receivables table (Credit Khata / Post-checkout Debtors)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS receivables (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NULL,
        hotel_id INT NOT NULL,
        booking_id INT NOT NULL,
        guest_id INT NOT NULL,
        original_amount DECIMAL(10,2) NOT NULL,
        paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        outstanding_amount DECIMAL(10,2) NOT NULL,
        status ENUM('open', 'partially_paid', 'settled', 'written_off') NOT NULL DEFAULT 'open',
        due_date DATE NULL,
        debtor_name VARCHAR(255) NULL,
        debtor_phone VARCHAR(50) NULL,
        notes TEXT NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_recv_hotel_status (hotel_id, status),
        INDEX idx_recv_booking (booking_id),
        INDEX idx_recv_guest (guest_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[Migration] receivables table ensured.');
  } catch (e) {
    console.warn('[Migration] receivables table warning:', e.message);
  }

  try {
    // 3. billing_adjustments table (Discounts, Waivers, Corrections)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS billing_adjustments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NULL,
        hotel_id INT NOT NULL,
        booking_id INT NOT NULL,
        guest_id INT NOT NULL,
        type ENUM('discount', 'waiver', 'correction') NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        created_by INT NOT NULL,
        approved_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ba_hotel (hotel_id),
        INDEX idx_ba_booking (booking_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[Migration] billing_adjustments table ensured.');
  } catch (e) {
    console.warn('[Migration] billing_adjustments table warning:', e.message);
  }

  try {
    // 4. cash_drawers table (Shift-wise / Daily cash tracking)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cash_drawers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NULL,
        hotel_id INT NOT NULL,
        opened_by INT NOT NULL,
        closed_by INT NULL,
        business_date DATE NOT NULL,
        opening_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        cash_collections DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        cash_refunds DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        cash_adjustments DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        expected_cash DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        actual_cash DECIMAL(10,2) NULL,
        variance DECIMAL(10,2) NULL,
        closing_notes TEXT NULL,
        status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
        opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP NULL,
        INDEX idx_cd_hotel_status (hotel_id, status),
        INDEX idx_cd_business_date (business_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[Migration] cash_drawers table ensured.');
  } catch (e) {
    console.warn('[Migration] cash_drawers table warning:', e.message);
  }

  try {
    // 5. cash_drawer_movements table (Cash in / Cash out petty cash)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cash_drawer_movements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        drawer_id INT NOT NULL,
        hotel_id INT NOT NULL,
        movement_type ENUM('cash_in', 'cash_out') NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        performed_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cdm_drawer (drawer_id),
        INDEX idx_cdm_hotel (hotel_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[Migration] cash_drawer_movements table ensured.');
  } catch (e) {
    console.warn('[Migration] cash_drawer_movements table warning:', e.message);
  }

  try {
    // 6. ALTER bookings table to add payment_status and settlement_notes
    await pool.query(`
      ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS payment_status ENUM('Paid', 'Partial', 'Unpaid') NOT NULL DEFAULT 'Unpaid',
        ADD COLUMN IF NOT EXISTS settlement_notes TEXT NULL;
    `);
    console.log('[Migration] bookings payment_status and settlement_notes columns ensured.');
  } catch (e) {
    if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) {
      console.warn('[Migration] bookings columns warning:', e.message);
    }
  }

  try {
    // 7. Backfill payment_status for legacy completed/active bookings
    await pool.query(`
      UPDATE bookings 
      SET payment_status = CASE 
        WHEN status = 'Completed' AND (total_amount <= advance_paid) THEN 'Paid'
        WHEN advance_paid > 0 THEN 'Partial'
        ELSE 'Unpaid'
      END
      WHERE payment_status = 'Unpaid' OR payment_status IS NULL;
    `);
    console.log('[Migration] bookings payment_status backfill complete.');
  } catch (e) {
    console.warn('[Migration] bookings backfill warning:', e.message);
  }
};

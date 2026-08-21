import pool from '../config/db.js';
import transactionManager from '../core/database/transactionManager.js';
import logger from '../core/logger/logger.js';
import eventBus, { SYSTEM_EVENTS } from '../core/eventbus/eventBus.js';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FINANCE SUMMARY & KPI DASHBOARD METRICS
 * Authoritative database aggregations filtered by hotel_id and date range
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const getFinanceSummary = async (req, res) => {
  const hotelId = req.user.hotelId;
  const { period, start_date, end_date } = req.query;

  try {
    let dateCondition = '';
    const params = [hotelId];

    const todayStr = new Date().toISOString().slice(0, 10);

    if (period === 'today') {
      dateCondition = 'AND DATE(p.created_at) = CURDATE()';
    } else if (period === 'yesterday') {
      dateCondition = 'AND DATE(p.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
    } else if (period === 'week') {
      dateCondition = 'AND p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    } else if (period === 'month') {
      dateCondition = 'AND p.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    } else if (start_date && end_date) {
      dateCondition = 'AND DATE(p.created_at) BETWEEN ? AND ?';
      params.push(start_date, end_date);
    } else {
      // Default: Current month
      dateCondition = 'AND MONTH(p.created_at) = MONTH(CURDATE()) AND YEAR(p.created_at) = YEAR(CURDATE())';
    }

    // 1. Collections breakdown by payment mode (Cash, UPI, Card, Bank_Transfer)
    const [modeStats] = await pool.query(
      `SELECT 
         p.payment_mode,
         COALESCE(SUM(CASE WHEN p.payment_type != 'Refund' THEN p.amount ELSE 0 END), 0) AS total_collected,
         COALESCE(SUM(CASE WHEN p.payment_type = 'Refund' THEN p.amount ELSE 0 END), 0) AS total_refunded,
         COUNT(p.id) AS transaction_count
       FROM payments p
       WHERE p.hotel_id = ? AND p.status = 'completed' ${dateCondition}
       GROUP BY p.payment_mode`,
      params
    );

    let cashCollected = 0;
    let upiCollected = 0;
    let cardCollected = 0;
    let bankCollected = 0;
    let otherCollected = 0;
    let totalRefunds = 0;
    let grossCollections = 0;

    modeStats.forEach(row => {
      const net = parseFloat(row.total_collected) - parseFloat(row.total_refunded);
      grossCollections += parseFloat(row.total_collected);
      totalRefunds += parseFloat(row.total_refunded);

      if (row.payment_mode === 'Cash') cashCollected = parseFloat(row.total_collected);
      else if (row.payment_mode === 'UPI') upiCollected = parseFloat(row.total_collected);
      else if (row.payment_mode === 'Card') cardCollected = parseFloat(row.total_collected);
      else if (row.payment_mode === 'Bank_Transfer') bankCollected = parseFloat(row.total_collected);
      else otherCollected += parseFloat(row.total_collected);
    });

    const netCollections = grossCollections - totalRefunds;

    // 2. Outstanding Receivables (Credit Khata / Debtors)
    const [debtorStats] = await pool.query(
      `SELECT 
         COALESCE(SUM(outstanding_amount), 0) AS total_outstanding,
         COUNT(id) AS active_debtors_count
       FROM receivables
       WHERE hotel_id = ? AND status IN ('open', 'partially_paid')`,
      [hotelId]
    );

    const totalOutstanding = parseFloat(debtorStats[0]?.total_outstanding || 0);
    const activeDebtorsCount = parseInt(debtorStats[0]?.active_debtors_count || 0);

    // 3. Billing Adjustments / Discounts given in period
    let adjParams = [hotelId];
    let adjDateCondition = '';
    if (period === 'today') adjDateCondition = 'AND DATE(created_at) = CURDATE()';
    else if (period === 'yesterday') adjDateCondition = 'AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
    else if (period === 'week') adjDateCondition = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    else if (period === 'month') adjDateCondition = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    else if (start_date && end_date) {
      adjDateCondition = 'AND DATE(created_at) BETWEEN ? AND ?';
      adjParams.push(start_date, end_date);
    }

    const [discountStats] = await pool.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN type = 'discount' THEN amount ELSE 0 END), 0) AS total_discounts,
         COALESCE(SUM(CASE WHEN type = 'waiver' THEN amount ELSE 0 END), 0) AS total_waivers
       FROM billing_adjustments
       WHERE hotel_id = ? ${adjDateCondition}`,
      adjParams
    );

    const totalDiscounts = parseFloat(discountStats[0]?.total_discounts || 0);
    const totalWaivers = parseFloat(discountStats[0]?.total_waivers || 0);

    // 4. Check active cash drawer status for today
    const [drawers] = await pool.query(
      `SELECT id, opening_balance, cash_collections, cash_refunds, cash_adjustments, expected_cash, status, opened_at
       FROM cash_drawers
       WHERE hotel_id = ? AND status = 'open'
       ORDER BY id DESC LIMIT 1`,
      [hotelId]
    );

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          grossCollections,
          netCollections,
          totalRefunds,
          cashCollected,
          upiCollected,
          cardCollected,
          bankCollected,
          otherCollected,
          totalOutstanding,
          activeDebtorsCount,
          totalDiscounts,
          totalWaivers,
        },
        activeCashDrawer: drawers.length > 0 ? drawers[0] : null,
        period: period || 'month'
      }
    });

  } catch (error) {
    logger.error('[PaymentController] getFinanceSummary error:', error);
    return res.status(500).json({ success: false, message: 'Failed to aggregate financial summary.' });
  }
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * IMMUTABLE TRANSACTION LEDGER
 * Paginated list of all payment events with full guest, room & staff audit context
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const getTransactions = async (req, res) => {
  const hotelId = req.user.hotelId;
  const { page = 1, limit = 25, payment_mode, payment_type, search, start_date, end_date } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const conditions = ['p.hotel_id = ?'];
  const params = [hotelId];

  if (payment_mode) {
    conditions.push('p.payment_mode = ?');
    params.push(payment_mode);
  }

  if (payment_type) {
    conditions.push('p.payment_type = ?');
    params.push(payment_type);
  }

  if (start_date && end_date) {
    conditions.push('DATE(p.created_at) BETWEEN ? AND ?');
    params.push(start_date, end_date);
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push('(g.full_name LIKE ? OR g.phone_number LIKE ? OR r.room_number LIKE ? OR p.transaction_ref LIKE ? OR p.id = ?)');
    params.push(term, term, term, term, search.trim());
  }

  const whereClause = conditions.join(' AND ');

  try {
    // Count total matching transactions
    const [countResult] = await pool.query(
      `SELECT COUNT(p.id) AS total
       FROM payments p
       LEFT JOIN guests g ON p.guest_id = g.id
       LEFT JOIN bookings b ON p.booking_id = b.id
       LEFT JOIN rooms r ON b.room_id = r.id
       WHERE ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    // Fetch paginated transactions
    const [transactions] = await pool.query(
      `SELECT 
         p.id,
         p.booking_id,
         p.guest_id,
         p.amount,
         p.payment_type,
         p.payment_mode,
         p.transaction_ref,
         p.notes,
         p.status,
         p.created_at,
         g.full_name AS guest_name,
         g.phone_number AS guest_phone,
         r.room_number,
         r.category AS room_category,
         u.name AS collected_by_name,
         u.email AS collected_by_email
       FROM payments p
       LEFT JOIN guests g ON p.guest_id = g.id
       LEFT JOIN bookings b ON p.booking_id = b.id
       LEFT JOIN rooms r ON b.room_id = r.id
       LEFT JOIN users u ON p.collected_by = u.id
       WHERE ${whereClause}
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    return res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)) || 1
      }
    });

  } catch (error) {
    logger.error('[PaymentController] getTransactions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch financial transactions.' });
  }
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DEBTORS / CREDIT KHATA LIST
 * Unpaid post-checkout balances requiring recovery
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const getDebtors = async (req, res) => {
  const hotelId = req.user.hotelId;
  const { status = 'all', search } = req.query;

  const conditions = ['recv.hotel_id = ?'];
  const params = [hotelId];

  if (status === 'open') {
    conditions.push("recv.status = 'open'");
  } else if (status === 'partially_paid') {
    conditions.push("recv.status = 'partially_paid'");
  } else if (status === 'settled') {
    conditions.push("recv.status = 'settled'");
  } else {
    conditions.push("recv.status IN ('open', 'partially_paid')");
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push('(recv.debtor_name LIKE ? OR recv.debtor_phone LIKE ? OR g.full_name LIKE ? OR r.room_number LIKE ?)');
    params.push(term, term, term, term);
  }

  const whereClause = conditions.join(' AND ');

  try {
    const [debtors] = await pool.query(
      `SELECT 
         recv.id,
         recv.booking_id,
         recv.guest_id,
         recv.original_amount,
         recv.paid_amount,
         recv.outstanding_amount,
         recv.status,
         recv.due_date,
         COALESCE(recv.debtor_name, g.full_name) AS debtor_name,
         COALESCE(recv.debtor_phone, g.phone_number) AS debtor_phone,
         recv.notes,
         recv.created_at,
         recv.updated_at,
         DATEDIFF(CURDATE(), recv.created_at) AS days_overdue,
         r.room_number,
         r.category AS room_category,
         u.name AS created_by_name
       FROM receivables recv
       LEFT JOIN guests g ON recv.guest_id = g.id
       LEFT JOIN bookings b ON recv.booking_id = b.id
       LEFT JOIN rooms r ON b.room_id = r.id
       LEFT JOIN users u ON recv.created_by = u.id
       WHERE ${whereClause}
       ORDER BY recv.status ASC, recv.created_at DESC`,
      params
    );

    return res.status(200).json({
      success: true,
      data: debtors
    });

  } catch (error) {
    logger.error('[PaymentController] getDebtors error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch debtors ledger.' });
  }
};

const round2 = (num) => Math.round((Number(num) || 0) * 100) / 100;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * POST-CHECKOUT DEBTOR COLLECTION (SETTLE CREDIT KHATA)
 * Collect payment towards an existing unpaid receivable with row locking
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const collectDebtorPayment = async (req, res) => {
  const { id } = req.params;
  const hotelId = req.user.hotelId;
  const userId = req.user.id || req.user.userId;
  const { amount, payment_mode, transaction_ref, notes, idempotency_key } = req.body;

  const paymentAmount = round2(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Valid payment amount greater than 0 is required.' });
  }

  const validModes = ['Cash', 'UPI', 'Card', 'Bank_Transfer', 'Other'];
  const mode = validModes.includes(payment_mode) ? payment_mode : 'Cash';

  try {
    const result = await transactionManager.runInTransaction(async (conn) => {
      // 1. Lock and fetch receivable
      const [receivables] = await conn.query(
        `SELECT id, tenant_id, hotel_id, booking_id, guest_id, original_amount, paid_amount, outstanding_amount, status
         FROM receivables
         WHERE id = ? AND hotel_id = ? FOR UPDATE`,
        [id, hotelId]
      );

      if (receivables.length === 0) {
        throw new Error('Debtor record not found.');
      }

      const recv = receivables[0];
      if (recv.status === 'settled' || recv.status === 'written_off') {
        throw new Error(`This receivable is already in status: '${recv.status}'.`);
      }

      const currentOutstanding = round2(recv.outstanding_amount);
      if (paymentAmount > currentOutstanding) {
        throw new Error(`Payment amount (₹${paymentAmount.toFixed(2)}) exceeds outstanding balance (₹${currentOutstanding.toFixed(2)}).`);
      }

      // 2. Check Idempotency
      if (idempotency_key) {
        const [existing] = await conn.query(
          'SELECT id FROM payments WHERE idempotency_key = ? AND hotel_id = ? LIMIT 1',
          [idempotency_key, hotelId]
        );
        if (existing.length > 0) {
          logger.info(`[PaymentController] Idempotent repeat request intercepted for key: ${idempotency_key}`);
          return { id: existing[0].id, alreadyProcessed: true };
        }
      }

      // 3. Insert into Immutable Payments Ledger
      const [payResult] = await conn.query(
        `INSERT INTO payments 
           (tenant_id, hotel_id, booking_id, guest_id, amount, payment_type, payment_mode, transaction_ref, notes, collected_by, status, idempotency_key)
         VALUES (?, ?, ?, ?, ?, 'Post_Checkout_Due', ?, ?, ?, ?, 'completed', ?)`,
        [
          recv.tenant_id,
          hotelId,
          recv.booking_id,
          recv.guest_id,
          paymentAmount,
          mode,
          transaction_ref || null,
          notes ? `Debtor clearance: ${notes}` : 'Debtor Khata recovery payment',
          userId,
          idempotency_key || null
        ]
      );

      const paymentId = payResult.insertId;

      // 4. Update Receivable record with safe precision arithmetic
      const newPaidAmount = round2(round2(recv.paid_amount) + paymentAmount);
      const newOutstanding = Math.max(0, round2(currentOutstanding - paymentAmount));
      const newStatus = newOutstanding <= 0 ? 'settled' : 'partially_paid';

      await conn.query(
        `UPDATE receivables 
         SET paid_amount = ?, outstanding_amount = ?, status = ?
         WHERE id = ?`,
        [newPaidAmount, newOutstanding, newStatus, recv.id]
      );

      // 5. If fully settled, update booking payment_status to 'Paid'
      if (newStatus === 'settled') {
        await conn.query(
          `UPDATE bookings SET payment_status = 'Paid' WHERE id = ? AND hotel_id = ?`,
          [recv.booking_id, hotelId]
        );
      }

      // 6. If payment was Cash, update active cash drawer
      if (mode === 'Cash') {
        await conn.query(
          `UPDATE cash_drawers 
           SET cash_collections = cash_collections + ?, expected_cash = expected_cash + ?
           WHERE hotel_id = ? AND status = 'open'`,
          [paymentAmount, paymentAmount, hotelId]
        );
      }

      return {
        paymentId,
        receivableId: recv.id,
        bookingId: recv.booking_id,
        amountCollected: paymentAmount,
        remainingOutstanding: newOutstanding,
        newStatus
      };
    });

    // 7. Emit System Events safely after transaction commit
    try {
      eventBus.publish(SYSTEM_EVENTS.PAYMENT_RECEIVED, {
        paymentId: result.paymentId,
        bookingId: result.bookingId,
        hotelId,
        amount: result.amountCollected,
        paymentType: 'Post_Checkout_Due',
        paymentMode: mode
      });

      if (result.newStatus === 'settled') {
        eventBus.publish(SYSTEM_EVENTS.RECEIVABLE_SETTLED, {
          receivableId: result.receivableId,
          bookingId: result.bookingId,
          hotelId,
          settledAt: new Date().toISOString()
        });
      }
    } catch (eventErr) {
      logger.warn('[PaymentController] Event emission warning:', eventErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Payment of ₹${paymentAmount.toFixed(2)} recorded successfully.`,
      data: result
    });

  } catch (error) {
    logger.error('[PaymentController] collectDebtorPayment error:', error.message);
    return res.status(400).json({ success: false, message: error.message || 'Payment collection failed.' });
  }
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * REFUND / REVERSAL TRANSACTION
 * Creates an immutable refund record linked to the original payment with
 * multi-partial refund ceiling validation and row locking.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const processRefund = async (req, res) => {
  const { id } = req.params;
  const hotelId = req.user.hotelId;
  const userId = req.user.id || req.user.userId;
  const { amount, reason } = req.body;

  const refundAmount = round2(amount);
  if (isNaN(refundAmount) || refundAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Valid refund amount greater than 0 is required.' });
  }

  if (!reason || !reason.trim()) {
    return res.status(400).json({ success: false, message: 'Reason for refund is mandatory.' });
  }

  try {
    const result = await transactionManager.runInTransaction(async (conn) => {
      // 1. Lock and fetch original payment row
      const [payments] = await conn.query(
        `SELECT id, tenant_id, hotel_id, booking_id, guest_id, amount, payment_mode, payment_type, status
         FROM payments
         WHERE id = ? AND hotel_id = ? FOR UPDATE`,
        [id, hotelId]
      );

      if (payments.length === 0) {
        throw new Error('Original payment record not found.');
      }

      const orig = payments[0];
      if (orig.status === 'refunded' || orig.payment_type === 'Refund') {
        throw new Error('This transaction is already fully refunded.');
      }

      // 2. Aggregate all previous valid refunds linked to this payment
      const origAmount = round2(orig.amount);
      const [prevRefundRows] = await conn.query(
        `SELECT COALESCE(SUM(amount), 0) AS total_refunded
         FROM payments
         WHERE hotel_id = ? AND booking_id = ? AND payment_type = 'Refund'
           AND status = 'completed'
           AND (notes LIKE ? OR notes LIKE ?)`,
        [hotelId, orig.booking_id, `Refund for Txn #${orig.id}:%`, `Refund for Txn #${orig.id}`]
      );

      const totalPrevRefunds = round2(prevRefundRows[0]?.total_refunded || 0);
      const remainingRefundable = Math.max(0, round2(origAmount - totalPrevRefunds));

      if (remainingRefundable <= 0) {
        throw new Error(`This transaction of ₹${origAmount.toFixed(2)} has already been fully refunded.`);
      }

      if (refundAmount > remainingRefundable) {
        throw new Error(
          `Refund amount (₹${refundAmount.toFixed(2)}) exceeds remaining refundable balance (₹${remainingRefundable.toFixed(2)}). Already refunded: ₹${totalPrevRefunds.toFixed(2)} of ₹${origAmount.toFixed(2)}.`
        );
      }

      // 3. Insert Immutable Refund Entry
      const [refundResult] = await conn.query(
        `INSERT INTO payments 
           (tenant_id, hotel_id, booking_id, guest_id, amount, payment_type, payment_mode, notes, collected_by, status)
         VALUES (?, ?, ?, ?, ?, 'Refund', ?, ?, ?, 'completed')`,
        [
          orig.tenant_id,
          hotelId,
          orig.booking_id,
          orig.guest_id,
          refundAmount,
          orig.payment_mode,
          `Refund for Txn #${orig.id}: ${reason.trim()}`,
          userId
        ]
      );

      // 4. Mark original payment status as refunded if total refunds reach or exceed original amount
      const newTotalRefunds = round2(totalPrevRefunds + refundAmount);
      if (newTotalRefunds >= origAmount) {
        await conn.query(`UPDATE payments SET status = 'refunded' WHERE id = ?`, [orig.id]);
      }

      // 5. If Cash refund, update active cash drawer
      if (orig.payment_mode === 'Cash') {
        await conn.query(
          `UPDATE cash_drawers 
           SET cash_refunds = cash_refunds + ?, expected_cash = expected_cash - ?
           WHERE hotel_id = ? AND status = 'open'`,
          [refundAmount, refundAmount, hotelId]
        );
      }

      return {
        refundId: refundResult.insertId,
        originalTxnId: orig.id,
        bookingId: orig.booking_id,
        refundAmount,
        totalRefundedSoFar: newTotalRefunds,
        remainingRefundable: Math.max(0, round2(origAmount - newTotalRefunds)),
        mode: orig.payment_mode
      };
    });

    // 6. Emit System Events safely after transaction commit
    try {
      eventBus.publish(SYSTEM_EVENTS.PAYMENT_REFUNDED, {
        refundId: result.refundId,
        originalTxnId: result.originalTxnId,
        bookingId: result.bookingId,
        hotelId,
        amount: result.refundAmount,
        paymentMode: result.mode
      });
    } catch (eventErr) {
      logger.warn('[PaymentController] Event emission warning:', eventErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Refund of ₹${refundAmount.toFixed(2)} processed successfully.`,
      data: result
    });

  } catch (error) {
    logger.error('[PaymentController] processRefund error:', error.message);
    return res.status(400).json({ success: false, message: error.message || 'Refund processing failed.' });
  }
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CASH DRAWER MANAGEMENT (SHIFT-WISE / DAILY RECONCILIATION)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const getActiveCashDrawer = async (req, res) => {
  const hotelId = req.user.hotelId;

  try {
    const [drawers] = await pool.query(
      `SELECT 
         cd.id,
         cd.business_date,
         cd.opening_balance,
         cd.cash_collections,
         cd.cash_refunds,
         cd.cash_adjustments,
         cd.expected_cash,
         cd.actual_cash,
         cd.variance,
         cd.status,
         cd.opened_at,
         u.name AS opened_by_name
       FROM cash_drawers cd
       LEFT JOIN users u ON cd.opened_by = u.id
       WHERE cd.hotel_id = ? AND cd.status = 'open'
       ORDER BY cd.id DESC LIMIT 1`,
      [hotelId]
    );

    if (drawers.length === 0) {
      return res.status(200).json({ success: true, activeDrawer: null });
    }

    const drawer = drawers[0];

    // Fetch movements for active drawer
    const [movements] = await pool.query(
      `SELECT m.id, m.movement_type, m.amount, m.reason, m.created_at, u.name AS performed_by_name
       FROM cash_drawer_movements m
       LEFT JOIN users u ON m.performed_by = u.id
       WHERE m.drawer_id = ?
       ORDER BY m.created_at DESC`,
      [drawer.id]
    );

    return res.status(200).json({
      success: true,
      activeDrawer: {
        ...drawer,
        movements
      }
    });

  } catch (error) {
    logger.error('[PaymentController] getActiveCashDrawer error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load cash drawer status.' });
  }
};

export const openCashDrawer = async (req, res) => {
  const hotelId = req.user.hotelId;
  const userId = req.user.id || req.user.userId;
  const { opening_balance = 0.00 } = req.body;

  const openBal = round2(opening_balance);

  try {
    // Check if there is already an open drawer
    const [existing] = await pool.query(
      `SELECT id FROM cash_drawers WHERE hotel_id = ? AND status = 'open' LIMIT 1`,
      [hotelId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'A cash drawer is already open. Close it before opening a new one.' });
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    const [insertResult] = await pool.query(
      `INSERT INTO cash_drawers 
         (tenant_id, hotel_id, opened_by, business_date, opening_balance, expected_cash, status)
       VALUES (?, ?, ?, ?, ?, ?, 'open')`,
      [req.user.tenantId || null, hotelId, userId, todayStr, openBal, openBal]
    );

    const drawerId = insertResult.insertId;

    try {
      eventBus.publish(SYSTEM_EVENTS.CASH_DRAWER_OPENED, {
        drawerId,
        hotelId,
        openedBy: userId,
        openingBalance: openBal,
        openedAt: new Date().toISOString()
      });
    } catch (eventErr) {
      logger.warn('[PaymentController] Event emission warning:', eventErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Cash drawer opened successfully.',
      drawerId,
      openingBalance: openBal
    });

  } catch (error) {
    logger.error('[PaymentController] openCashDrawer error:', error);
    return res.status(500).json({ success: false, message: 'Failed to open cash drawer.' });
  }
};

export const closeCashDrawer = async (req, res) => {
  const hotelId = req.user.hotelId;
  const userId = req.user.id || req.user.userId;
  const { actual_cash, closing_notes } = req.body;

  const actualCashCount = round2(actual_cash);
  if (isNaN(actualCashCount) || actualCashCount < 0) {
    return res.status(400).json({ success: false, message: 'Actual counted cash amount is required.' });
  }

  try {
    const result = await transactionManager.runInTransaction(async (conn) => {
      const [drawers] = await conn.query(
        `SELECT id, opening_balance, cash_collections, cash_refunds, cash_adjustments, expected_cash
         FROM cash_drawers
         WHERE hotel_id = ? AND status = 'open'
         ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [hotelId]
      );

      if (drawers.length === 0) {
        throw new Error('No open cash drawer found to close.');
      }

      const drawer = drawers[0];
      const expected = round2(drawer.expected_cash);
      const variance = round2(actualCashCount - expected);

      await conn.query(
        `UPDATE cash_drawers 
         SET closed_by = ?, actual_cash = ?, variance = ?, closing_notes = ?, status = 'closed', closed_at = NOW()
         WHERE id = ?`,
        [userId, actualCashCount, variance, closing_notes || null, drawer.id]
      );

      return {
        drawerId: drawer.id,
        expectedCash: expected,
        actualCash: actualCashCount,
        variance
      };
    });

    try {
      eventBus.publish(SYSTEM_EVENTS.CASH_DRAWER_CLOSED, {
        drawerId: result.drawerId,
        hotelId,
        closedBy: userId,
        expectedCash: result.expectedCash,
        actualCash: result.actualCash,
        variance: result.variance,
        closedAt: new Date().toISOString()
      });
    } catch (eventErr) {
      logger.warn('[PaymentController] Event emission warning:', eventErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Cash drawer shift closed and reconciled successfully.',
      data: result
    });

  } catch (error) {
    logger.error('[PaymentController] closeCashDrawer error:', error.message);
    return res.status(400).json({ success: false, message: error.message || 'Failed to close cash drawer.' });
  }
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SERVER-SIDE CSV FINANCIAL EXPORT
 * Full UTF-8 BOM encoding for direct Excel / spreadsheet opening
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const exportFinancialTransactions = async (req, res) => {
  const hotelId = req.user.hotelId;
  const { payment_mode, payment_type, start_date, end_date } = req.query;

  const conditions = ['p.hotel_id = ?'];
  const params = [hotelId];

  if (payment_mode) {
    conditions.push('p.payment_mode = ?');
    params.push(payment_mode);
  }

  if (payment_type) {
    conditions.push('p.payment_type = ?');
    params.push(payment_type);
  }

  if (start_date && end_date) {
    conditions.push('DATE(p.created_at) BETWEEN ? AND ?');
    params.push(start_date, end_date);
  }

  const whereClause = conditions.join(' AND ');

  try {
    const [transactions] = await pool.query(
      `SELECT 
         p.id AS txn_ref,
         DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i') AS date_time,
         g.full_name AS guest_name,
         g.phone_number AS guest_phone,
         r.room_number,
         p.booking_id,
         p.payment_type,
         p.payment_mode,
         p.amount,
         p.transaction_ref,
         u.name AS staff_name,
         p.status
       FROM payments p
       LEFT JOIN guests g ON p.guest_id = g.id
       LEFT JOIN bookings b ON p.booking_id = b.id
       LEFT JOIN rooms r ON b.room_id = r.id
       LEFT JOIN users u ON p.collected_by = u.id
       WHERE ${whereClause}
       ORDER BY p.created_at DESC`,
      params
    );

    const BOM = '\uFEFF';
    const csvHeaders = ['Transaction ID', 'Date & Time', 'Guest Name', 'Guest Phone', 'Room #', 'Booking ID', 'Type', 'Mode', 'Amount (INR)', 'Ref / UTR', 'Collected By', 'Status'];
    
    const csvRows = transactions.map(t => [
      `TXN-${t.txn_ref}`,
      `"${t.date_time}"`,
      `"${(t.guest_name || '').replace(/"/g, '""')}"`,
      `"${t.guest_phone || ''}"`,
      `"${t.room_number || ''}"`,
      `"${t.booking_id}"`,
      `"${t.payment_type}"`,
      `"${t.payment_mode}"`,
      parseFloat(t.amount).toFixed(2),
      `"${(t.transaction_ref || '').replace(/"/g, '""')}"`,
      `"${(t.staff_name || 'Staff').replace(/"/g, '""')}"`,
      `"${t.status}"`
    ]);

    const csvContent = BOM + [csvHeaders.join(','), ...csvRows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="hotelnex_finance_ledger_${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.status(200).send(csvContent);

  } catch (error) {
    logger.error('[PaymentController] exportFinancialTransactions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to export financial records.' });
  }
};

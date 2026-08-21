import pool from '../config/db.js';
import { getSignedFileUrl } from '../config/s3.js';
import eventBus from '../core/eventbus/eventBus.js';
import transactionManager from '../core/database/transactionManager.js';
import logger from '../core/logger/logger.js';

const mapBookingUrls = async (booking) => {
  if (!booking) return null;
  return {
    ...booking,
    guest_photo: await getSignedFileUrl(booking.guest_photo),
    id_front:    await getSignedFileUrl(booking.id_front),
    id_back:     await getSignedFileUrl(booking.id_back),
    id_3:        await getSignedFileUrl(booking.id_3),
    id_4:        await getSignedFileUrl(booking.id_4),
    id_5:        await getSignedFileUrl(booking.id_5),
  };
};

const round2 = (num) => Math.round((Number(num) || 0) * 100) / 100;

// ─── Check-In Flow (Atomic Booking + Room Occupation + Payment Recording) ───
export const checkIn = async (req, res) => {
  const { 
    room_id, guest_id, expected_checkout, room_rate, advance_paid, 
    advance_payment_mode, advance_transaction_ref, companion_ids, idempotency_key 
  } = req.body;
  const hotel_id = req.user.hotelId;
  const tenant_id = req.user.tenantId || null;
  const receptionist_id = req.user.id || req.user.userId;

  if (!room_id || !guest_id || !room_rate) {
    return res.status(400).json({
      success: false,
      message: 'Room ID, Guest ID, and Room Rate are required.',
    });
  }

  const validModes = ['Cash', 'UPI', 'Card', 'Bank_Transfer', 'Other'];
  const paymentMode = validModes.includes(advance_payment_mode) ? advance_payment_mode : 'Cash';
  const advance = advance_paid ? round2(advance_paid) : 0.00;
  const dailyRate = round2(room_rate);

  try {
    const result = await transactionManager.runInTransaction(async (conn) => {
      // 1. Verify and Lock Room
      const [rooms] = await conn.query(
        'SELECT id, status, base_rate, room_number FROM rooms WHERE id = ? AND hotel_id = ? FOR UPDATE',
        [room_id, hotel_id]
      );

      if (rooms.length === 0) {
        throw new Error('Room not found.');
      }

      const room = rooms[0];
      if (room.status !== 'Available') {
        throw new Error(`Room ${room.room_number} is currently ${room.status} and cannot be checked in.`);
      }

      // 2. Verify Guest exists
      const [guests] = await conn.query(
        'SELECT id, full_name, phone_number FROM guests WHERE id = ? AND hotel_id = ? LIMIT 1',
        [guest_id, hotel_id]
      );

      if (guests.length === 0) {
        throw new Error('Guest profile not found.');
      }

      // 3. Calculate dynamic total amount
      const checkInTime = new Date();
      let checkOutTime;
      let nights = 1;

      if (expected_checkout) {
        checkOutTime = new Date(expected_checkout);
        const diffTime = Math.abs(checkOutTime - checkInTime);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        nights = diffDays > 0 ? diffDays : 1;
      } else {
        checkOutTime = new Date('2099-12-31T23:59:59');
      }

      const total_amount = round2(dailyRate * nights);
      const paymentStatus = advance >= total_amount ? 'Paid' : (advance > 0 ? 'Partial' : 'Unpaid');

      // 4. Update Room status to Occupied
      await conn.query(
        'UPDATE rooms SET status = "Occupied" WHERE id = ? AND hotel_id = ?',
        [room_id, hotel_id]
      );

      // 5. Create Booking
      const [bookingResult] = await conn.query(
        `INSERT INTO bookings 
         (hotel_id, room_id, guest_id, receptionist_id, check_in_time, expected_check_out, room_rate, total_amount, advance_paid, status, payment_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, "Active", ?)`,
        [
          hotel_id,
          room_id,
          guest_id,
          receptionist_id,
          checkInTime.toISOString().slice(0, 19).replace('T', ' '),
          checkOutTime.toISOString().slice(0, 19).replace('T', ' '),
          dailyRate,
          total_amount,
          advance,
          paymentStatus
        ]
      );

      const bookingId = bookingResult.insertId;

      // 6. Record Advance Payment in Immutable Payments Ledger (if advance > 0)
      let paymentId = null;
      if (advance > 0) {
        const [payResult] = await conn.query(
          `INSERT INTO payments 
             (tenant_id, hotel_id, booking_id, guest_id, amount, payment_type, payment_mode, transaction_ref, notes, collected_by, status, idempotency_key)
           VALUES (?, ?, ?, ?, ?, 'Advance', ?, ?, 'Advance collected at check-in', ?, 'completed', ?)`,
          [
            tenant_id,
            hotel_id,
            bookingId,
            guest_id,
            advance,
            paymentMode,
            advance_transaction_ref || null,
            receptionist_id,
            idempotency_key || null
          ]
        );
        paymentId = payResult.insertId;

        // If Cash, update active cash drawer
        if (paymentMode === 'Cash') {
          await conn.query(
            `UPDATE cash_drawers 
             SET cash_collections = cash_collections + ?, expected_cash = expected_cash + ?
             WHERE hotel_id = ? AND status = 'open'`,
            [advance, advance, hotel_id]
          );
        }
      }

      // 7. Store companion guests if provided
      if (Array.isArray(companion_ids) && companion_ids.length > 0) {
        const placeholders = companion_ids.map(() => '?').join(',');
        const [matchedCompanions] = await conn.query(
          `SELECT id FROM guests WHERE id IN (${placeholders}) AND hotel_id = ?`,
          [...companion_ids, hotel_id]
        );
        const validCompanionIds = matchedCompanions.map(c => c.id);

        for (const cId of validCompanionIds) {
          try {
            await conn.query(
              'INSERT INTO booking_companions (booking_id, guest_id) VALUES (?, ?)',
              [bookingId, cId]
            );
          } catch (e) {
            console.warn('[BookingController] companion insert warn:', e.message);
          }
        }
      }

      return {
        bookingId,
        paymentId,
        nights,
        roomRate: room_rate,
        totalAmount: total_amount,
        advancePaid: advance,
        pendingAmount: total_amount - advance,
        paymentStatus,
        paymentMode: advance > 0 ? paymentMode : null
      };
    });

    // Publish BookingCheckedIn event
    if (eventBus && typeof eventBus.publish === 'function') {
      eventBus.publish('BookingCheckedIn', { bookingId: result.bookingId }, {
        tenantId: req.user.tenantId || null,
        propertyId: hotel_id,
        userId: req.user.userId || req.user.id
      }).catch(err => console.error('[BookingController] EventBus publish failed:', err.message));
    }

    return res.status(201).json({
      success: true,
      message: 'Check-in completed successfully. Room status updated to Occupied.',
      bookingId: result.bookingId,
      bookingDetails: {
        roomId: room_id,
        guestId: guest_id,
        companions: companion_ids || [],
        nights: result.nights,
        roomRate: result.roomRate,
        totalAmount: result.totalAmount,
        advancePaid: result.advancePaid,
        pendingAmount: result.pendingAmount,
        paymentStatus: result.paymentStatus,
        paymentMode: result.paymentMode
      }
    });

  } catch (error) {
    logger.error('[BookingController] checkIn error:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message || 'An error occurred during check-in.',
    });
  }
};

// ─── Check-Out Settlement Preview ───────────────────────────────────────────
export const getCheckoutPreview = async (req, res) => {
  const { id } = req.params;
  const hotel_id = req.user.hotelId;

  try {
    const [bookings] = await pool.query(
      `SELECT 
         b.id, b.hotel_id, b.room_id, b.guest_id, b.check_in_time, b.expected_check_out,
         b.room_rate, b.total_amount, b.advance_paid, b.status, b.payment_status,
         g.full_name AS guest_name, g.phone_number AS guest_phone,
         r.room_number, r.category AS room_category
       FROM bookings b
       JOIN guests g ON b.guest_id = g.id
       JOIN rooms r ON b.room_id = r.id
       WHERE b.id = ? AND b.hotel_id = ? LIMIT 1`,
      [id, hotel_id]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ success: false, message: 'Active booking not found.' });
    }

    const booking = bookings[0];
    const checkOutTime = new Date();
    const checkInTime = new Date(booking.check_in_time);

    // Calculate actual nights (minimum 1 night)
    const diffTime = Math.abs(checkOutTime - checkInTime);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const nightsStayed = diffDays > 0 ? diffDays : 1;

    const dailyRate = parseFloat(booking.room_rate) || 0;
    const grossCharges = dailyRate * nightsStayed;

    // Fetch prior completed payments from payments ledger
    const [payStats] = await pool.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN payment_type != 'Refund' THEN amount ELSE -amount END), 0) AS total_paid
       FROM payments
       WHERE booking_id = ? AND hotel_id = ? AND status = 'completed'`,
      [id, hotel_id]
    );

    const paidFromLedger = parseFloat(payStats[0]?.total_paid || 0);
    const advancePaid = parseFloat(booking.advance_paid) || 0;
    const effectivePaid = Math.max(paidFromLedger, advancePaid);

    // Fetch discounts / adjustments
    const [adjStats] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_discounts
       FROM billing_adjustments
       WHERE booking_id = ? AND hotel_id = ?`,
      [id, hotel_id]
    );
    const totalDiscounts = parseFloat(adjStats[0]?.total_discounts || 0);

    const balanceDue = Math.max(0, grossCharges - (effectivePaid + totalDiscounts));

    return res.status(200).json({
      success: true,
      data: {
        bookingId: booking.id,
        guestName: booking.guest_name,
        guestPhone: booking.guest_phone,
        roomNumber: booking.room_number,
        roomCategory: booking.room_category,
        checkInTime: booking.check_in_time,
        checkOutTime: checkOutTime.toISOString(),
        nightsStayed,
        dailyRate,
        grossCharges,
        advancePaid,
        totalPaidSoFar: effectivePaid,
        totalDiscounts,
        balanceDue,
        status: booking.status,
        paymentStatus: booking.payment_status
      }
    });

  } catch (error) {
    logger.error('[BookingController] getCheckoutPreview error:', error);
    return res.status(500).json({ success: false, message: 'Failed to calculate checkout preview.' });
  }
};

// ─── Atomic Multi-Strategy Check-Out Settlement ─────────────────────────────
export const checkOut = async (req, res) => {
  const { id } = req.params;
  const hotel_id = req.user.hotelId;
  const tenant_id = req.user.tenantId || null;
  const userId = req.user.id || req.user.userId;

  const {
    settlement_strategy = 'full_payment', // 'full_payment', 'split_payment', 'credit_khata', 'discount_waiver', 'zero_balance'
    payments = [],                        // Array of { mode, amount, transaction_ref, notes }
    discount = null,                      // { amount, reason }
    receivable = null,                    // { due_date, debtor_name, debtor_phone, notes }
    settlement_notes = null,
    idempotency_key = null
  } = req.body;

  // 1. Enforce RBAC on Discounts / Waivers: Only Admin / Owner can authorize discounts
  if (discount && round2(discount.amount) > 0) {
    const userRole = (req.user.role || '').toLowerCase();
    const isSuperAdmin = req.user.isSuperAdmin === true;
    const isAuthorized = isSuperAdmin || userRole === 'admin' || userRole === 'owner';
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Only administrator or owner roles can authorize billing discounts and waivers.'
      });
    }
  }

  try {
    const result = await transactionManager.runInTransaction(async (conn) => {
      // 1. Lock and fetch booking
      const [bookings] = await conn.query(
        `SELECT id, tenant_id, hotel_id, room_id, guest_id, check_in_time, room_rate, total_amount, advance_paid, status, payment_status 
         FROM bookings 
         WHERE id = ? AND hotel_id = ? FOR UPDATE`,
        [id, hotel_id]
      );

      if (bookings.length === 0) {
        throw new Error('Active booking not found.');
      }

      const booking = bookings[0];
      if (booking.status !== 'Active') {
        throw new Error(`This booking is already in status: '${booking.status}'.`);
      }

      // 2. Perform authoritative stay & balance calculations
      const checkOutTime = new Date();
      const checkInTime = new Date(booking.check_in_time);
      const diffTime = Math.abs(checkOutTime - checkInTime);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const actualNights = diffDays > 0 ? diffDays : 1;

      const dailyRate = round2(booking.room_rate);
      const actualGrossAmount = round2(dailyRate * actualNights);

      // Prior payments from payments ledger
      const [payStats] = await conn.query(
        `SELECT COALESCE(SUM(CASE WHEN payment_type != 'Refund' THEN amount ELSE -amount END), 0) AS total_paid
         FROM payments
         WHERE booking_id = ? AND hotel_id = ? AND status = 'completed'`,
        [id, hotel_id]
      );
      const paidFromLedger = round2(payStats[0]?.total_paid || 0);
      const priorAdvance = round2(booking.advance_paid || 0);
      const totalPaidPrior = Math.max(paidFromLedger, priorAdvance);

      let outstandingBalance = Math.max(0, round2(actualGrossAmount - totalPaidPrior));

      // 3. Process Discount / Adjustment if authorized
      let discountAmountApplied = 0.00;
      if (discount && round2(discount.amount) > 0) {
        discountAmountApplied = Math.min(round2(discount.amount), outstandingBalance);
        await conn.query(
          `INSERT INTO billing_adjustments 
             (tenant_id, hotel_id, booking_id, guest_id, type, amount, reason, created_by, approved_by)
           VALUES (?, ?, ?, ?, 'discount', ?, ?, ?, ?)`,
          [
            tenant_id,
            hotel_id,
            booking.id,
            booking.guest_id,
            discountAmountApplied,
            discount.reason ? discount.reason.trim() : 'Checkout discount adjustment',
            userId,
            userId
          ]
        );
        outstandingBalance = Math.max(0, round2(outstandingBalance - discountAmountApplied));
      }

      // 4. Process Payments (Full / Split)
      const recordedPayments = [];
      let totalCollectedAtCheckout = 0.00;

      if (Array.isArray(payments) && payments.length > 0 && outstandingBalance > 0) {
        const validModes = ['Cash', 'UPI', 'Card', 'Bank_Transfer', 'Other'];
        
        for (let i = 0; i < payments.length; i++) {
          const p = payments[i];
          const pAmount = round2(p.amount);
          if (pAmount <= 0) continue;

          const pMode = validModes.includes(p.mode) ? p.mode : 'Cash';
          const pRef = p.transaction_ref || null;
          const pNotes = p.notes ? p.notes.trim() : 'Checkout settlement payment';
          const pIdempKey = idempotency_key ? `${idempotency_key}_${i}` : null;

          const [payInsert] = await conn.query(
            `INSERT INTO payments 
               (tenant_id, hotel_id, booking_id, guest_id, amount, payment_type, payment_mode, transaction_ref, notes, collected_by, status, idempotency_key)
             VALUES (?, ?, ?, ?, ?, 'Checkout_Settlement', ?, ?, ?, ?, 'completed', ?)`,
            [
              tenant_id,
              hotel_id,
              booking.id,
              booking.guest_id,
              pAmount,
              pMode,
              pRef,
              pNotes,
              userId,
              pIdempKey
            ]
          );

          recordedPayments.push({
            id: payInsert.insertId,
            mode: pMode,
            amount: pAmount,
            ref: pRef
          });

          totalCollectedAtCheckout = round2(totalCollectedAtCheckout + pAmount);

          // If Cash, update active cash drawer
          if (pMode === 'Cash') {
            await conn.query(
              `UPDATE cash_drawers 
               SET cash_collections = cash_collections + ?, expected_cash = expected_cash + ?
               WHERE hotel_id = ? AND status = 'open'`,
              [pAmount, pAmount, hotel_id]
            );
          }
        }

        outstandingBalance = Math.max(0, round2(outstandingBalance - totalCollectedAtCheckout));
      }

      // 5. Process Credit Khata / Receivable if remaining balance > 0
      let receivableId = null;
      let finalPaymentStatus = 'Paid';

      if (outstandingBalance > 0) {
        finalPaymentStatus = 'Unpaid';
        const debtorName = receivable?.debtor_name || null;
        const debtorPhone = receivable?.debtor_phone || null;
        const dueDate = receivable?.due_date || null;
        const recvNotes = receivable?.notes || settlement_notes || 'Outstanding balance deferred at checkout';

        const [recvResult] = await conn.query(
          `INSERT INTO receivables 
             (tenant_id, hotel_id, booking_id, guest_id, original_amount, paid_amount, outstanding_amount, status, due_date, debtor_name, debtor_phone, notes, created_by)
           VALUES (?, ?, ?, ?, ?, 0.00, ?, 'open', ?, ?, ?, ?, ?)`,
          [
            tenant_id,
            hotel_id,
            booking.id,
            booking.guest_id,
            outstandingBalance,
            outstandingBalance,
            dueDate,
            debtorName,
            debtorPhone,
            recvNotes,
            userId
          ]
        );
        receivableId = recvResult.insertId;
      }

      // 6. Release Room
      await conn.query(
        'UPDATE rooms SET status = "Available" WHERE id = ? AND hotel_id = ?',
        [booking.room_id, hotel_id]
      );

      // 7. Update Booking record
      await conn.query(
        `UPDATE bookings 
         SET actual_check_out = NOW(), total_amount = ?, status = 'Completed', payment_status = ?, settlement_notes = ?
         WHERE id = ? AND hotel_id = ?`,
        [
          actualGrossAmount,
          finalPaymentStatus,
          settlement_notes ? settlement_notes.trim() : null,
          booking.id,
          hotel_id
        ]
      );

      return {
        bookingId: booking.id,
        nightsStayed: actualNights,
        grossCharges: actualGrossAmount,
        totalPaidPrior,
        discountApplied: discountAmountApplied,
        collectedAtCheckout: totalCollectedAtCheckout,
        remainingUnpaid: outstandingBalance,
        receivableId,
        paymentStatus: finalPaymentStatus,
        recordedPayments
      };
    });

    // 8. Publish Events safely after transaction commit
    try {
      if (eventBus && typeof eventBus.publish === 'function') {
        eventBus.publish(SYSTEM_EVENTS.BOOKING_CHECKED_OUT, { bookingId: id, hotelId: hotel_id }).catch(e => console.warn(e.message));
        
        if (result.receivableId) {
          eventBus.publish(SYSTEM_EVENTS.RECEIVABLE_CREATED, {
            receivableId: result.receivableId,
            bookingId: id,
            hotelId: hotel_id,
            amount: result.remainingUnpaid
          }).catch(e => console.warn(e.message));
        }

        if (Array.isArray(result.recordedPayments)) {
          for (const p of result.recordedPayments) {
            eventBus.publish(SYSTEM_EVENTS.PAYMENT_RECEIVED, {
              paymentId: p.id,
              bookingId: id,
              hotelId: hotel_id,
              amount: p.amount,
              paymentType: 'Checkout_Settlement',
              paymentMode: p.mode
            }).catch(e => console.warn(e.message));
          }
        }
      }
    } catch (eventErr) {
      logger.warn('[BookingController] Event emission warning:', eventErr.message);
    }

    return res.status(200).json({
      success: true,
      message: result.remainingUnpaid > 0 
        ? `Check-out completed. Room released. ₹${result.remainingUnpaid.toFixed(2)} recorded in Debtors Khata.`
        : 'Check-out & payment settlement finalized successfully. Room is now Available.',
      checkoutDetails: result
    });
  } catch (error) {
    logger.error('[BookingController] checkOut error:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message || 'Check-out settlement failed.',
    });
  }
};



// ─── Booking History List with Filters ───────────────────────────────────────
export const getBookingHistory = async (req, res) => {
  const hotel_id = req.user.hotelId;
  const { guest_name, phone_number, room_number, start_date, end_date } = req.query;

  try {
    let query = `
      SELECT b.id, b.hotel_id, b.room_id, b.guest_id, b.receptionist_id, 
             b.check_in_time, b.expected_check_out, b.actual_check_out, 
             b.room_rate, b.total_amount, b.advance_paid, b.status, b.created_at,
             g.full_name AS guest_name, g.phone_number AS guest_phone, g.document_url AS guest_drive_link,
             g.address AS guest_address,
             gd.guest_photo, gd.id_front, gd.id_back, gd.id_3, gd.id_4, gd.id_5,
             r.room_number, r.category AS room_category
      FROM bookings b
      JOIN guests g ON b.guest_id = g.id
      JOIN rooms r ON b.room_id = r.id
      LEFT JOIN guest_documents gd ON g.id = gd.guest_id
      WHERE b.hotel_id = ?
    `;
    const params = [hotel_id];

    if (guest_name) {
      query += ' AND g.full_name LIKE ?';
      params.push(`%${guest_name.trim()}%`);
    }

    if (phone_number) {
      query += ' AND g.phone_number LIKE ?';
      params.push(`%${phone_number.trim()}%`);
    }

    if (room_number) {
      query += ' AND r.room_number LIKE ?';
      params.push(`%${room_number.trim()}%`);
    }

    if (start_date && end_date) {
      query += ' AND b.check_in_time BETWEEN ? AND ?';
      params.push(`${start_date} 00:00:00`, `${end_date} 23:59:59`);
    } else if (start_date) {
      query += ' AND b.check_in_time >= ?';
      params.push(`${start_date} 00:00:00`);
    } else if (end_date) {
      query += ' AND b.check_in_time <= ?';
      params.push(`${end_date} 23:59:59`);
    }

    // Sort by latest bookings
    query += ' ORDER BY b.check_in_time DESC';

    const [rows] = await pool.execute(query, params);

    const mappedBookings = await Promise.all(rows.map(mapBookingUrls));

    return res.status(200).json({
      success: true,
      count: mappedBookings.length,
      bookings: mappedBookings,
    });
  } catch (error) {
    console.error('[BookingController] getBookingHistory error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve booking history records.',
    });
  }
};

// ─── GET /api/bookings/stats ───────────────────────────────────────────────
export const getDashboardStats = async (req, res) => {
  const hotel_id = req.user.hotelId;

  try {
    // 1. Fetch all rooms to compute status counts
    const [rooms] = await pool.execute(
      'SELECT id, status FROM rooms WHERE hotel_id = ?',
      [hotel_id]
    );

    let available = 0;
    let occupied = 0;
    let maintenance = 0;

    rooms.forEach((r) => {
      if (r.status === 'Available') available++;
      else if (r.status === 'Occupied') occupied++;
      else if (r.status === 'Maintenance') maintenance++;
    });

    // 2. Fetch bookings check-in & check-out times to count today's activity
    const [bookings] = await pool.execute(
      `SELECT check_in_time, expected_check_out, actual_check_out, status 
       FROM bookings 
       WHERE hotel_id = ?`,
      [hotel_id]
    );

    const isToday = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      const today = new Date();
      return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    };

    let todayCheckins = 0;
    let todayCheckouts = 0;

    bookings.forEach((b) => {
      if (isToday(b.check_in_time)) {
        todayCheckins++;
      }
      if (
        isToday(b.actual_check_out) || 
        (b.status === 'Active' && isToday(b.expected_check_out))
      ) {
        todayCheckouts++;
      }
    });

    return res.status(200).json({
      success: true,
      stats: {
        available,
        occupied,
        maintenance,
        totalRooms: rooms.length,
        todayCheckins,
        todayCheckouts,
      },
    });
  } catch (error) {
    console.error('[BookingController] getDashboardStats error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard statistics.',
    });
  }
};

// ─── GET /api/bookings/active/room/:roomId ──────────────────────────────────
export const getActiveBookingByRoom = async (req, res) => {
  const hotel_id = req.user.hotelId;
  const { roomId } = req.params;

  try {
    const [rows] = await pool.execute(
      `SELECT b.id, b.room_id, b.guest_id, b.check_in_time, b.expected_check_out, 
              b.room_rate, b.total_amount, b.advance_paid, b.status,
              g.full_name AS guest_name, g.phone_number AS guest_phone, g.address AS guest_address
       FROM bookings b
       JOIN guests g ON b.guest_id = g.id
       WHERE b.room_id = ? AND b.hotel_id = ? AND b.status = 'Active'
       LIMIT 1`,
      [roomId, hotel_id]
    );

    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        exists: false,
        booking: null,
      });
    }

    return res.status(200).json({
      success: true,
      exists: true,
      booking: rows[0],
    });
  } catch (error) {
    console.error('[BookingController] getActiveBookingByRoom error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve active booking details.',
    });
  }
};

// ─── GET /api/bookings/active ────────────────────────────────────────────────
export const getActiveBookings = async (req, res) => {
  const hotel_id = req.user.hotelId;

  try {
    const [rows] = await pool.execute(
      `SELECT b.id, b.room_id, b.guest_id, b.check_in_time, b.expected_check_out, 
              b.room_rate, b.total_amount, b.advance_paid, b.status,
              g.full_name AS guest_name, g.phone_number AS guest_phone, g.address AS guest_address,
              r.room_number, r.category AS room_category
       FROM bookings b
       JOIN guests g ON b.guest_id = g.id
       JOIN rooms r ON b.room_id = r.id
       WHERE b.hotel_id = ? AND b.status = 'Active'
       ORDER BY r.room_number ASC`,
      [hotel_id]
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      bookings: rows,
    });
  } catch (error) {
    console.error('[BookingController] getActiveBookings error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve active bookings.',
    });
  }
};

// ─── GET /api/bookings/:id  — Full booking detail for Invoice ─────────────────
export const getBookingDetails = async (req, res) => {
  const hotel_id = req.user.hotelId;
  const { id } = req.params;

  try {
    // 1. Fetch primary booking + guest + room
    const [rows] = await pool.execute(
      `SELECT b.id, b.check_in_time, b.expected_check_out, b.actual_check_out,
              b.room_rate, b.total_amount, b.advance_paid, b.status, b.payment_status, b.settlement_notes, b.created_at,
              g.full_name AS guest_name, g.phone_number AS guest_phone,
              g.address AS guest_address, g.document_url AS guest_drive_link,
              r.room_number, r.category AS room_category
       FROM bookings b
       JOIN guests g ON b.guest_id = g.id
       JOIN rooms r  ON b.room_id  = r.id
       WHERE b.id = ? AND b.hotel_id = ?
       LIMIT 1`,
      [id, hotel_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = rows[0];

    // 2. Fetch companion guests
    const [companions] = await pool.execute(
      `SELECT g.full_name, g.phone_number, g.address
       FROM booking_companions bc
       JOIN guests g ON bc.guest_id = g.id
       WHERE bc.booking_id = ? AND g.hotel_id = ?`,
      [id, hotel_id]
    );

    // 3. Fetch itemized payments from ledger
    const [payments] = await pool.execute(
      `SELECT id, amount, payment_type, payment_mode, transaction_ref, notes, status, created_at
       FROM payments
       WHERE booking_id = ? AND hotel_id = ?
       ORDER BY created_at ASC`,
      [id, hotel_id]
    );

    // 4. Fetch billing adjustments / discounts
    const [adjustments] = await pool.execute(
      `SELECT id, type, amount, reason, created_at
       FROM billing_adjustments
       WHERE booking_id = ? AND hotel_id = ?
       ORDER BY created_at ASC`,
      [id, hotel_id]
    );

    // 5. Fetch receivable / debtor record (if any)
    const [receivables] = await pool.execute(
      `SELECT id, original_amount, paid_amount, outstanding_amount, status, due_date
       FROM receivables
       WHERE booking_id = ? AND hotel_id = ?
       LIMIT 1`,
      [id, hotel_id]
    );

    return res.status(200).json({
      success: true,
      booking: {
        ...booking,
        invoice_id: `INV-${String(booking.id).padStart(5, '0')}`,
        companions,
        payments,
        adjustments,
        receivable: receivables.length > 0 ? receivables[0] : null
      },
    });
  } catch (error) {
    console.error('[BookingController] getBookingDetails error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve booking details.',
    });
  }
};

// ─── Shift / Transfer Room Flow ─────────────────────────────────────────────
export const shiftRoom = async (req, res) => {
  const {
    bookingId,
    toRoomId,
    reasonCategory,
    reasonDetails = '',
    markOldRoomMaintenance = true,
    ratePolicy = 'keep_current' // 'keep_current' or 'apply_new'
  } = req.body;

  const hotelId = req.user.hotelId;
  const staffUserId = req.user.userId;

  if (!bookingId || !toRoomId || !reasonCategory) {
    return res.status(400).json({
      success: false,
      message: 'Booking ID, destination Room ID, and Reason Category are required.',
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Fetch active booking
    const [bookings] = await conn.query(
      `SELECT b.id, b.room_id, b.guest_id, b.room_rate, b.total_amount, b.check_in_time, b.expected_check_out, b.status,
              r.room_number AS current_room_number, r.category AS current_category
       FROM bookings b
       JOIN rooms r ON b.room_id = r.id
       WHERE b.id = ? AND b.hotel_id = ? FOR UPDATE`,
      [bookingId, hotelId]
    );

    if (bookings.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Active booking not found.' });
    }

    const booking = bookings[0];
    if (booking.status !== 'Active') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: `Cannot shift a booking with status '${booking.status}'.` });
    }

    const fromRoomId = booking.room_id;

    if (parseInt(fromRoomId) === parseInt(toRoomId)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Destination room cannot be the same as current room.' });
    }

    // 2. Fetch and lock destination room
    const [targetRooms] = await conn.query(
      `SELECT id, room_number, category, base_rate, status
       FROM rooms
       WHERE id = ? AND hotel_id = ? FOR UPDATE`,
      [toRoomId, hotelId]
    );

    if (targetRooms.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Destination room not found.' });
    }

    const targetRoom = targetRooms[0];
    if (targetRoom.status !== 'Available') {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: `Destination room ${targetRoom.room_number} is ${targetRoom.status} and cannot be assigned.`,
      });
    }

    // 3. Determine new rates and total amount
    const oldRoomRate = parseFloat(booking.room_rate);
    const newRoomBaseRate = parseFloat(targetRoom.base_rate);
    let finalRoomRate = oldRoomRate;
    let finalTotalAmount = parseFloat(booking.total_amount);
    let rateDifference = 0.00;

    if (ratePolicy === 'apply_new') {
      finalRoomRate = newRoomBaseRate;
      rateDifference = newRoomBaseRate - oldRoomRate;

      // Recalculate remaining stay days
      const checkInDate = new Date(booking.check_in_time);
      const expectedOutDate = new Date(booking.expected_check_out);
      const isOpenStay = expectedOutDate.getFullYear() >= 2099;
      
      if (!isOpenStay) {
        const diffTime = Math.abs(expectedOutDate - checkInDate);
        const totalNights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        finalTotalAmount = finalRoomRate * totalNights;
      }
    }

    // 4. Update old room status (Maintenance or Available)
    const oldRoomNewStatus = markOldRoomMaintenance ? 'Maintenance' : 'Available';
    await conn.query(
      `UPDATE rooms SET status = ? WHERE id = ? AND hotel_id = ?`,
      [oldRoomNewStatus, fromRoomId, hotelId]
    );

    // 5. Update new room status to Occupied
    await conn.query(
      `UPDATE rooms SET status = 'Occupied' WHERE id = ? AND hotel_id = ?`,
      [toRoomId, hotelId]
    );

    // 6. Update booking with new room and rate
    await conn.query(
      `UPDATE bookings 
       SET room_id = ?, room_rate = ?, total_amount = ? 
       WHERE id = ? AND hotel_id = ?`,
      [toRoomId, finalRoomRate, finalTotalAmount, bookingId, hotelId]
    );

    // 7. Insert into room_transfers audit log
    const [transferResult] = await conn.query(
      `INSERT INTO room_transfers 
       (hotel_id, booking_id, guest_id, from_room_id, to_room_id, reason_category, reason_details, 
        mark_old_room_maintenance, rate_policy, old_room_rate, new_room_rate, rate_difference, transferred_by, transferred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        hotelId,
        bookingId,
        booking.guest_id,
        fromRoomId,
        toRoomId,
        reasonCategory,
        reasonDetails,
        markOldRoomMaintenance ? 1 : 0,
        ratePolicy,
        oldRoomRate,
        finalRoomRate,
        rateDifference,
        staffUserId
      ]
    );

    await conn.commit();

    // 8. Publish event for notification / analytics
    eventBus.publish('RoomShifted', {
      hotelId,
      bookingId,
      guestId: booking.guest_id,
      fromRoomId,
      fromRoomNumber: booking.current_room_number,
      toRoomId,
      toRoomNumber: targetRoom.room_number,
      reasonCategory,
      reasonDetails,
      transferredBy: staffUserId,
      transferId: transferResult.insertId,
      timestamp: new Date()
    });

    return res.status(200).json({
      success: true,
      message: `Guest successfully shifted from Room ${booking.current_room_number} to Room ${targetRoom.room_number}.`,
      data: {
        transferId: transferResult.insertId,
        fromRoom: { id: fromRoomId, room_number: booking.current_room_number, newStatus: oldRoomNewStatus },
        toRoom: { id: toRoomId, room_number: targetRoom.room_number, category: targetRoom.category },
        ratePolicy,
        roomRate: finalRoomRate,
        totalAmount: finalTotalAmount
      }
    });

  } catch (error) {
    await conn.rollback();
    console.error('[BookingController] shiftRoom error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to execute room shift.'
    });
  } finally {
    conn.release();
  }
};

// ─── Get Room Transfers for a booking or hotel ───────────────────────────────
export const getBookingTransfers = async (req, res) => {
  const hotelId = req.user.hotelId;
  const { id } = req.params;

  try {
    const [transfers] = await pool.query(
      `SELECT rt.*,
              rf.room_number AS from_room_number, rf.category AS from_room_category,
              rt_to.room_number AS to_room_number, rt_to.category AS to_room_category,
              u.name AS transferred_by_name,
              g.full_name AS guest_name
       FROM room_transfers rt
       JOIN rooms rf ON rt.from_room_id = rf.id
       JOIN rooms rt_to ON rt.to_room_id = rt_to.id
       JOIN users u ON rt.transferred_by = u.id
       JOIN guests g ON rt.guest_id = g.id
       WHERE rt.booking_id = ? AND rt.hotel_id = ?
       ORDER BY rt.transferred_at DESC`,
      [id, hotelId]
    );

    return res.status(200).json({
      success: true,
      transfers
    });
  } catch (error) {
    console.error('[BookingController] getBookingTransfers error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve transfer history.'
    });
  }
};

// ─── Get All Hotel Room Transfers (for dedicated Shift Manager page) ──────────
export const getAllHotelTransfers = async (req, res) => {
  const hotelId = req.user.hotelId;
  try {
    const [transfers] = await pool.query(
      `SELECT rt.*,
              rf.room_number AS from_room_number, rf.category AS from_room_category,
              rt_to.room_number AS to_room_number, rt_to.category AS to_room_category,
              u.name AS transferred_by_name,
              g.full_name AS guest_name, g.phone_number AS guest_phone
       FROM room_transfers rt
       JOIN rooms rf ON rt.from_room_id = rf.id
       JOIN rooms rt_to ON rt.to_room_id = rt_to.id
       JOIN users u ON rt.transferred_by = u.id
       JOIN guests g ON rt.guest_id = g.id
       WHERE rt.hotel_id = ?
       ORDER BY rt.transferred_at DESC`,
      [hotelId]
    );

    return res.status(200).json({
      success: true,
      transfers
    });
  } catch (error) {
    console.error('[BookingController] getAllHotelTransfers error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve all transfer logs.'
    });
  }
};




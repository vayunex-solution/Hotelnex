import pool from '../config/db.js';
import { getSignedFileUrl } from '../config/s3.js';
import eventBus from '../core/eventbus/eventBus.js';


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

// ─── Check-In Flow (Create Booking + Occupy Room) ───────────────────────────
export const checkIn = async (req, res) => {
  const { room_id, guest_id, expected_checkout, room_rate, advance_paid, companion_ids } = req.body;
  const hotel_id = req.user.hotelId;
  const receptionist_id = req.user.userId;

  if (!room_id || !guest_id || !room_rate) {
    return res.status(400).json({
      success: false,
      message: 'Room ID, Guest ID, and Room Rate are required.',
    });
  }

  try {
    // 1. Verify Room status is 'Available'
    const [rooms] = await pool.execute(
      'SELECT id, status, base_rate, room_number FROM rooms WHERE id = ? AND hotel_id = ? LIMIT 1',
      [room_id, hotel_id]
    );

    if (rooms.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found.',
      });
    }

    const room = rooms[0];
    if (room.status !== 'Available') {
      return res.status(400).json({
        success: false,
        message: `Room ${room.room_number} is currently ${room.status} and cannot be checked in.`,
      });
    }

    // 2. Verify Guest exists
    const [guests] = await pool.execute(
      'SELECT id FROM guests WHERE id = ? AND hotel_id = ? LIMIT 1',
      [guest_id, hotel_id]
    );

    if (guests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Guest profile not found.',
      });
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
      // Open stay: Use a far-future date (2099-12-31) as placeholder
      checkOutTime = new Date('2099-12-31T23:59:59');
    }

    const total_amount = parseFloat(room_rate) * nights;
    const advance = advance_paid ? parseFloat(advance_paid) : 0.00;

    // 4. Create Booking and update Room status (Use Transaction logic)
    // NOTE: SQLite doesn't natively support START TRANSACTION in some connection pool mocks, 
    // but running individual queries sequentially works, and we can simulate a manual rollback if needed.
    // For safety across dual db environments, we execute queries in order:
    await pool.execute(
      'UPDATE rooms SET status = "Occupied" WHERE id = ?',
      [room_id]
    );

    const [bookingResult] = await pool.execute(
      `INSERT INTO bookings 
       (hotel_id, room_id, guest_id, receptionist_id, check_in_time, expected_check_out, room_rate, total_amount, advance_paid, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, "Active")`,
      [
        hotel_id,
        room_id,
        guest_id,
        receptionist_id,
        checkInTime.toISOString().slice(0, 19).replace('T', ' '), // Convert to MySQL datetime format
        checkOutTime.toISOString().slice(0, 19).replace('T', ' '),
        parseFloat(room_rate),
        total_amount,
        advance,
      ]
    );

    const bookingId = bookingResult.insertId;

    // 5. Store companion guests if provided (with tenant scope validation)
    if (Array.isArray(companion_ids) && companion_ids.length > 0) {
      // Filter out companion IDs that do not belong to the current hotel_id
      const placeholders = companion_ids.map(() => '?').join(',');
      const [matchedCompanions] = await pool.execute(
        `SELECT id FROM guests WHERE id IN (${placeholders}) AND hotel_id = ?`,
        [...companion_ids, hotel_id]
      );
      const validCompanionIds = matchedCompanions.map(c => c.id);

      for (const cId of validCompanionIds) {
        try {
          await pool.execute(
            'INSERT INTO booking_companions (booking_id, guest_id) VALUES (?, ?)',
            [bookingId, cId]
          );
        } catch (e) {
          console.warn('[BookingController] companion insert warn:', e.message);
        }
      }
    }

    // Publish BookingCheckedIn event to trigger automated workflows
    eventBus.publish('BookingCheckedIn', { bookingId }, {
      tenantId: req.user.tenantId || null,
      propertyId: hotel_id,
      userId: req.user.userId
    }).catch(err => console.error('[BookingController] EventBus publish failed:', err.message));

    return res.status(201).json({
      success: true,
      message: 'Check-in completed successfully. Room status updated to Occupied.',
      bookingId,
      bookingDetails: {
        roomId: room_id,
        guestId: guest_id,
        companions: companion_ids || [],
        nights,
        roomRate: room_rate,
        totalAmount: total_amount,
        advancePaid: advance,
        pendingAmount: total_amount - advance,
      }
    });
  } catch (error) {
    console.error('[BookingController] checkIn error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during check-in.',
    });
  }
};

// ─── Check-Out Flow (Calculate Pending Balance + Complete Booking + Release Room) 
export const checkOut = async (req, res) => {
  const { id } = req.params;
  const hotel_id = req.user.hotelId;

  try {
    // 1. Fetch the active booking
    const [bookings] = await pool.execute(
      'SELECT id, room_id, guest_id, check_in_time, room_rate, total_amount, advance_paid, status FROM bookings WHERE id = ? AND hotel_id = ? LIMIT 1',
      [id, hotel_id]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active booking not found.',
      });
    }

    const booking = bookings[0];
    if (booking.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: `This booking is already in status: ${booking.status}.`,
      });
    }

    // 2. Perform dynamic checkout calculations
    const checkOutTime = new Date();
    const checkInTime = new Date(booking.check_in_time);
    
    // Calculate actual nights (minimum 1 night)
    const diffTime = Math.abs(checkOutTime - checkInTime);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const actualNights = diffDays > 0 ? diffDays : 1;

    // Recalculate total amount in case of early checkout or extended stay
    const actualTotalAmount = parseFloat(booking.room_rate) * actualNights;
    const pendingBalance = actualTotalAmount - parseFloat(booking.advance_paid);

    // 3. Update booking status and release room
    await pool.execute(
      'UPDATE rooms SET status = "Available" WHERE id = ?',
      [booking.room_id]
    );

    await pool.execute(
      `UPDATE bookings 
       SET actual_check_out = ?, total_amount = ?, status = "Completed" 
       WHERE id = ?`,
      [
        checkOutTime.toISOString().slice(0, 19).replace('T', ' '),
        actualTotalAmount,
        id
      ]
    );

    // Publish BookingCheckedOut event to trigger automated workflows
    eventBus.publish('BookingCheckedOut', { bookingId: id }, {
      tenantId: req.user.tenantId || null,
      propertyId: hotel_id,
      userId: req.user.userId
    }).catch(err => console.error('[BookingController] EventBus publish failed:', err.message));

    return res.status(200).json({
      success: true,
      message: 'Check-out finalized. Room status updated to Available.',
      checkoutDetails: {
        bookingId: id,
        nightsStayed: actualNights,
        totalPaid: actualTotalAmount,
        advancePaid: booking.advance_paid,
        settledAmount: pendingBalance,
      }
    });
  } catch (error) {
    console.error('[BookingController] checkOut error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during check-out.',
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
              b.room_rate, b.total_amount, b.advance_paid, b.status, b.created_at,
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

    // 2. Fetch companion guests (secured by matching guest hotel_id)
    const [companions] = await pool.execute(
      `SELECT g.full_name, g.phone_number, g.address
       FROM booking_companions bc
       JOIN guests g ON bc.guest_id = g.id
       WHERE bc.booking_id = ? AND g.hotel_id = ?`,
      [id, hotel_id]
    );

    return res.status(200).json({
      success: true,
      booking: {
        ...booking,
        invoice_id: `INV-${String(booking.id).padStart(5, '0')}`,
        companions,
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



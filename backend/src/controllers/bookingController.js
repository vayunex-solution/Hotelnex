import pool from '../config/db.js';
import { getSignedFileUrl } from '../config/s3.js';

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

    // 5. Store companion guests if provided
    if (Array.isArray(companion_ids) && companion_ids.length > 0) {
      for (const cId of companion_ids) {
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

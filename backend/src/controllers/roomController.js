import pool from '../config/db.js';

const VALID_CATEGORIES = ['Standard', 'Deluxe', 'Suite'];
const VALID_STATUSES = ['Available', 'Occupied', 'Maintenance'];

// ─── GET /api/rooms ────────────────────────────────────────────────────────────
export const getAllRooms = async (req, res) => {
  // Tenant identity comes exclusively from verified JWT — never from request
  const hotelId = req.user.hotelId;

  try {
    const [rooms] = await pool.execute(
      `SELECT id, hotel_id, room_number, category, base_rate, status, created_at
       FROM rooms
       WHERE hotel_id = ?
       ORDER BY room_number ASC`,
      [hotelId]
    );

    return res.status(200).json({
      success: true,
      count: rooms.length,
      data: rooms,
    });
  } catch (error) {
    console.error('[RoomController] getAllRooms error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
    });
  }
};

// ─── POST /api/rooms ───────────────────────────────────────────────────────────
export const createRoom = async (req, res) => {
  const hotelId = req.user.hotelId;
  const { room_number, category, base_rate } = req.body;

  // Validation
  if (!room_number || typeof room_number !== 'string' || room_number.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'room_number is required and must be a non-empty string.',
    });
  }

  if (!category || !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({
      success: false,
      message: `category must be one of: ${VALID_CATEGORIES.join(', ')}.`,
    });
  }

  const parsedRate = parseFloat(base_rate);
  if (base_rate === undefined || base_rate === null || isNaN(parsedRate) || parsedRate < 0) {
    return res.status(400).json({
      success: false,
      message: 'base_rate is required and must be a non-negative number.',
    });
  }

  const sanitizedRoomNumber = room_number.trim();

  try {
    // Prevent duplicate room numbers within the same hotel (tenant-scoped)
    const [existing] = await pool.execute(
      'SELECT id FROM rooms WHERE hotel_id = ? AND room_number = ? LIMIT 1',
      [hotelId, sanitizedRoomNumber]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Room number "${sanitizedRoomNumber}" already exists in this hotel.`,
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO rooms (hotel_id, room_number, category, base_rate, status)
       VALUES (?, ?, ?, ?, 'Available')`,
      [hotelId, sanitizedRoomNumber, category, parsedRate]
    );

    const [newRoom] = await pool.execute(
      'SELECT id, hotel_id, room_number, category, base_rate, status, created_at FROM rooms WHERE id = ?',
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Room created successfully.',
      data: newRoom[0],
    });
  } catch (error) {
    console.error('[RoomController] createRoom error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
    });
  }
};

// ─── PATCH /api/rooms/:id/status ──────────────────────────────────────────────
export const updateRoomStatus = async (req, res) => {
  const hotelId = req.user.hotelId;
  const roomId = parseInt(req.params.id, 10);
  const { status } = req.body;

  if (isNaN(roomId) || roomId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid room ID.',
    });
  }

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${VALID_STATUSES.join(', ')}.`,
    });
  }

  try {
    // Verify room belongs to the authenticated tenant before updating
    const [existing] = await pool.execute(
      'SELECT id FROM rooms WHERE id = ? AND hotel_id = ? LIMIT 1',
      [roomId, hotelId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found.',
      });
    }

    await pool.execute(
      'UPDATE rooms SET status = ? WHERE id = ? AND hotel_id = ?',
      [status, roomId, hotelId]
    );

    const [updatedRoom] = await pool.execute(
      'SELECT id, hotel_id, room_number, category, base_rate, status, created_at FROM rooms WHERE id = ?',
      [roomId]
    );

    return res.status(200).json({
      success: true,
      message: 'Room status updated successfully.',
      data: updatedRoom[0],
    });
  } catch (error) {
    console.error('[RoomController] updateRoomStatus error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
    });
  }
};

// ─── PUT /api/rooms/:id ────────────────────────────────────────────────────────────
export const updateRoom = async (req, res) => {
  const hotelId = req.user.hotelId;
  const roomId = parseInt(req.params.id, 10);
  const { room_number, category, base_rate, status } = req.body;

  if (isNaN(roomId) || roomId <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid room ID.' });
  }

  if (room_number && (typeof room_number !== 'string' || room_number.trim() === '')) {
    return res.status(400).json({ success: false, message: 'Invalid room number format.' });
  }

  if (category && !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ success: false, message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}.` });
  }

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: `Status must be one of: ${VALID_STATUSES.join(', ')}.` });
  }

  try {
    const [existing] = await pool.execute(
      'SELECT id, room_number, category, base_rate, status FROM rooms WHERE id = ? AND hotel_id = ? LIMIT 1',
      [roomId, hotelId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    const room = existing[0];
    const newRoomNumber = room_number ? room_number.trim() : room.room_number;
    const newCategory = category || room.category;
    const newBaseRate = base_rate !== undefined ? parseFloat(base_rate) : room.base_rate;
    const newStatus = status || room.status;

    if (room_number && newRoomNumber !== room.room_number) {
      const [duplicate] = await pool.execute(
        'SELECT id FROM rooms WHERE hotel_id = ? AND room_number = ? LIMIT 1',
        [hotelId, newRoomNumber]
      );
      if (duplicate.length > 0) {
        return res.status(409).json({ success: false, message: `Room number "${newRoomNumber}" already exists.` });
      }
    }

    await pool.execute(
      'UPDATE rooms SET room_number = ?, category = ?, base_rate = ?, status = ? WHERE id = ? AND hotel_id = ?',
      [newRoomNumber, newCategory, newBaseRate, newStatus, roomId, hotelId]
    );

    const [updated] = await pool.execute(
      'SELECT id, hotel_id, room_number, category, base_rate, status, created_at FROM rooms WHERE id = ?',
      [roomId]
    );

    return res.status(200).json({
      success: true,
      message: 'Room updated successfully.',
      data: updated[0],
    });
  } catch (error) {
    console.error('[RoomController] updateRoom error:', error.message);
    return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
};

// ─── DELETE /api/rooms/:id ─────────────────────────────────────────────────────────
export const deleteRoom = async (req, res) => {
  const hotelId = req.user.hotelId;
  const roomId = parseInt(req.params.id, 10);

  if (isNaN(roomId) || roomId <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid room ID.' });
  }

  try {
    const [existing] = await pool.execute(
      'SELECT id FROM rooms WHERE id = ? AND hotel_id = ? LIMIT 1',
      [roomId, hotelId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    await pool.execute('DELETE FROM rooms WHERE id = ? AND hotel_id = ?', [roomId, hotelId]);

    return res.status(200).json({
      success: true,
      message: 'Room deleted successfully.',
    });
  } catch (error) {
    console.error('[RoomController] deleteRoom error:', error.message);
    if (error.code === 'SQLITE_CONSTRAINT' || (error.message && error.message.includes('FOREIGN KEY'))) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete room as it has associated bookings. You can only delete rooms that have no booking history.',
      });
    }
    return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
};

import pool from '../config/db.js';

// ─── GET /api/settings ───────────────────────────────────────────────────────
export const getSettings = async (req, res) => {
  const hotel_id = req.user.hotelId;

  try {
    const [rows] = await pool.execute(
      'SELECT name, phone_number, address FROM hotels WHERE id = ? LIMIT 1',
      [hotel_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Hotel profile not found.' });
    }

    return res.status(200).json({
      success: true,
      settings: {
        name:         rows[0].name         || '',
        phone_number: rows[0].phone_number || '',
        address:      rows[0].address      || '',
      },
    });
  } catch (error) {
    console.error('[SettingsController] getSettings error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to retrieve settings.' });
  }
};

// ─── PUT /api/settings ───────────────────────────────────────────────────────
export const updateSettings = async (req, res) => {
  const hotel_id = req.user.hotelId;
  const { name, phone_number, address } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Hotel name is required.' });
  }

  try {
    await pool.execute(
      'UPDATE hotels SET name = ?, phone_number = ?, address = ? WHERE id = ?',
      [name.trim(), (phone_number || '').trim(), (address || '').trim(), hotel_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Hotel settings updated successfully.',
      settings: {
        name:         name.trim(),
        phone_number: (phone_number || '').trim(),
        address:      (address || '').trim(),
      },
    });
  } catch (error) {
    console.error('[SettingsController] updateSettings error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to update settings.' });
  }
};

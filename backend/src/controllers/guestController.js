import pool from '../config/db.js';
import { uploadToS3, getSignedFileUrl } from '../config/s3.js';

const mapGuestUrls = async (guest) => {
  if (!guest) return null;
  return {
    ...guest,
    guest_photo: await getSignedFileUrl(guest.guest_photo),
    id_front:    await getSignedFileUrl(guest.id_front),
    id_back:     await getSignedFileUrl(guest.id_back),
    id_3:        await getSignedFileUrl(guest.id_3),
    id_4:        await getSignedFileUrl(guest.id_4),
    id_5:        await getSignedFileUrl(guest.id_5),
  };
};

// ─── Search Guest by Phone Number ──────────────────────────────────────────
export const searchGuestByPhone = async (req, res) => {
  const { phone } = req.query;
  const hotel_id = req.user.hotelId;

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: 'Search query (phone or name) is required.',
    });
  }

  const searchTerm = phone.trim();

  try {
    const [rows] = await pool.execute(
      `SELECT g.id, g.hotel_id, g.full_name, g.phone_number, g.document_url, g.address, 
              gd.guest_photo, gd.id_front, gd.id_back, gd.id_3, gd.id_4, gd.id_5 
       FROM guests g 
       LEFT JOIN guest_documents gd ON g.id = gd.guest_id 
       WHERE g.hotel_id = ? AND (g.phone_number = ? OR g.full_name LIKE ?) LIMIT 1`,
      [hotel_id, searchTerm, `%${searchTerm}%`]
    );

    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        exists: false,
        guest: null,
      });
    }

    return res.status(200).json({
      success: true,
      exists: true,
      guest: await mapGuestUrls(rows[0]),
    });
  } catch (error) {
    console.error('[GuestController] search error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to search guest details.',
    });
  }
};

// ─── Create New Guest with Documents ───────────────────────────────────────
export const createGuest = async (req, res) => {
  const { full_name, phone_number, address, document_url } = req.body;
  const hotel_id = req.user.hotelId; // extracted from authenticated token

  if (!full_name || !phone_number) {
    return res.status(400).json({
      success: false,
      message: 'Full name and phone number are required.',
    });
  }

  try {
    // Check if guest already exists
    const [existing] = await pool.execute(
      'SELECT id FROM guests WHERE hotel_id = ? AND phone_number = ? LIMIT 1',
      [hotel_id, phone_number.trim()]
    );

    let guestId;
    if (existing.length > 0) {
      guestId = existing[0].id;
      // Update existing guest
      await pool.execute(
        'UPDATE guests SET full_name = ?, address = ?, document_url = ? WHERE id = ?',
        [full_name.trim(), address ? address.trim() : null, document_url ? document_url.trim() : null, guestId]
      );
    } else {
      // Create guest
      const [insertResult] = await pool.execute(
        'INSERT INTO guests (hotel_id, full_name, phone_number, address, document_url) VALUES (?, ?, ?, ?, ?)',
        [hotel_id, full_name.trim(), phone_number.trim(), address ? address.trim() : null, document_url ? document_url.trim() : null]
      );
      guestId = insertResult.insertId;
    }

    // Handle uploaded files → upload to S3/B2
    const files = req.files || {};
    const uploadFile = async (key) => {
      if (!files[key]) return null;
      return uploadToS3(files[key][0].buffer, files[key][0].originalname, files[key][0].mimetype);
    };

    const guest_photo = await uploadFile('guest_photo');
    const id_front    = await uploadFile('id_front');
    const id_back     = await uploadFile('id_back');
    const id_3        = await uploadFile('id_3');
    const id_4        = await uploadFile('id_4');
    const id_5        = await uploadFile('id_5');

    if (guest_photo || id_front || id_back || id_3 || id_4 || id_5) {
      const [existingDoc] = await pool.execute(
        'SELECT id, guest_photo, id_front, id_back, id_3, id_4, id_5 FROM guest_documents WHERE guest_id = ? LIMIT 1',
        [guestId]
      );

      if (existingDoc.length > 0) {
        const d = existingDoc[0];
        await pool.execute(
          `UPDATE guest_documents 
           SET guest_photo=?, id_front=?, id_back=?, id_3=?, id_4=?, id_5=? 
           WHERE guest_id=?`,
          [
            guest_photo || d.guest_photo,
            id_front    || d.id_front,
            id_back     || d.id_back,
            id_3        || d.id_3,
            id_4        || d.id_4,
            id_5        || d.id_5,
            guestId
          ]
        );
      } else {
        await pool.execute(
          `INSERT INTO guest_documents (guest_id, guest_photo, id_front, id_back, id_3, id_4, id_5) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [guestId, guest_photo, id_front, id_back, id_3, id_4, id_5]
        );
      }
    }

    const [finalGuest] = await pool.execute(
      `SELECT g.*, gd.guest_photo, gd.id_front, gd.id_back, gd.id_3, gd.id_4, gd.id_5 
       FROM guests g 
       LEFT JOIN guest_documents gd ON g.id = gd.guest_id 
       WHERE g.id = ?`,
      [guestId]
    );

    return res.status(201).json({
      success: true,
      message: 'Guest profile and KYC documents registered successfully.',
      guest: await mapGuestUrls(finalGuest[0]),
    });
  } catch (error) {
    console.error('[GuestController] create error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while registering the guest.',
    });
  }
};

// ─── Update Guest Profile ──────────────────────────────────────────────────
export const updateGuest = async (req, res) => {
  const { id } = req.params;
  const { full_name, phone_number, address, document_url } = req.body;

  try {
    const [existing] = await pool.execute('SELECT id FROM guests WHERE id = ? LIMIT 1', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Guest profile not found.',
      });
    }

    await pool.execute(
      'UPDATE guests SET full_name = ?, phone_number = ?, address = ?, document_url = ? WHERE id = ?',
      [full_name.trim(), phone_number.trim(), address ? address.trim() : null, document_url ? document_url.trim() : null, id]
    );

    const files = req.files || {};
    const uploadFile = async (key) => {
      if (!files[key]) return null;
      return uploadToS3(files[key][0].buffer, files[key][0].originalname, files[key][0].mimetype);
    };

    const guest_photo = await uploadFile('guest_photo');
    const id_front    = await uploadFile('id_front');
    const id_back     = await uploadFile('id_back');
    const id_3        = await uploadFile('id_3');
    const id_4        = await uploadFile('id_4');
    const id_5        = await uploadFile('id_5');

    if (guest_photo || id_front || id_back || id_3 || id_4 || id_5) {
      const [docRows] = await pool.execute(
        'SELECT id, guest_photo, id_front, id_back, id_3, id_4, id_5 FROM guest_documents WHERE guest_id = ? LIMIT 1',
        [id]
      );

      if (docRows.length > 0) {
        const d = docRows[0];
        await pool.execute(
          `UPDATE guest_documents 
           SET guest_photo=?, id_front=?, id_back=?, id_3=?, id_4=?, id_5=? 
           WHERE guest_id=?`,
          [
            guest_photo || d.guest_photo,
            id_front    || d.id_front,
            id_back     || d.id_back,
            id_3        || d.id_3,
            id_4        || d.id_4,
            id_5        || d.id_5,
            id
          ]
        );
      } else {
        await pool.execute(
          `INSERT INTO guest_documents (guest_id, guest_photo, id_front, id_back, id_3, id_4, id_5) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, guest_photo, id_front, id_back, id_3, id_4, id_5]
        );
      }
    }

    const [updatedGuest] = await pool.execute(
      `SELECT g.*, gd.guest_photo, gd.id_front, gd.id_back, gd.id_3, gd.id_4, gd.id_5 
       FROM guests g 
       LEFT JOIN guest_documents gd ON g.id = gd.guest_id 
       WHERE g.id = ?`,
      [id]
    );

    return res.status(200).json({
      success: true,
      message: 'Guest profile updated successfully.',
      guest: await mapGuestUrls(updatedGuest[0]),
    });
  } catch (error) {
    console.error('[GuestController] update error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update guest profile.',
    });
  }
};

// ─── Get All Guests under Hotel ──────────────────────────────────────────────
export const getAllGuests = async (req, res) => {
  const hotel_id = req.user.hotelId;
  const { search } = req.query;

  try {
    let sql = `
      SELECT g.id, g.hotel_id, g.full_name, g.phone_number, g.document_url, g.address, g.created_at,
             gd.guest_photo, gd.id_front, gd.id_back, gd.id_3, gd.id_4, gd.id_5 
      FROM guests g 
      LEFT JOIN guest_documents gd ON g.id = gd.guest_id 
      WHERE g.hotel_id = ?
    `;
    const params = [hotel_id];

    if (search && search.trim() !== '') {
      sql += ` AND (g.full_name LIKE ? OR g.phone_number LIKE ? OR g.address LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY g.created_at DESC`;

    const [rows] = await pool.execute(sql, params);

    return res.status(200).json({
      success: true,
      data: await Promise.all(rows.map(mapGuestUrls))
    });
  } catch (error) {
    console.error('[GuestController] getAllGuests error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch guests list.',
    });
  }
};

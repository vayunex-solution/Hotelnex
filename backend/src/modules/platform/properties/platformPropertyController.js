import pool from '../../../config/db.js';
import crypto from 'crypto';
import logger from '../../../core/logger/logger.js';

export const createProperty = async (req, res) => {
  const { tenantId, name, address, timezone, currencyCode } = req.body;
  if (!tenantId || !name) {
    return res.status(400).json({ success: false, message: 'tenantId and name are required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const propertyCode = 'PRP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const [statusRow] = await conn.query("SELECT id FROM property_statuses WHERE name = 'Draft'");

    const [hotelResult] = await conn.query(
      `INSERT INTO hotels (tenant_id, name, address, timezone, currency_code, status_id, property_code, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        name,
        address || '',
        timezone || 'UTC',
        currencyCode || 'USD',
        statusRow[0].id,
        propertyCode,
        req.user.userId,
        req.user.userId
      ]
    );

    const propertyId = hotelResult.insertId;

    await conn.query(
      `INSERT INTO audit_logs (tenant_id, property_id, user_id, action, target_table, target_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tenantId, propertyId, req.user.userId, 'PLATFORM_CREATED_PROPERTY', 'hotels', propertyId]
    );

    await conn.commit();
    res.status(201).json({ success: true, message: 'Property created.', propertyId, propertyCode });
  } catch (error) {
    await conn.rollback();
    logger.error('Create Property Error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
};

export const getAllProperties = async (req, res) => {
  try {
    const [properties] = await pool.query(
      `SELECT h.*, ps.name as status_name, t.name as tenant_name 
       FROM hotels h
       JOIN property_statuses ps ON h.status_id = ps.id
       LEFT JOIN tenants t ON h.tenant_id = t.id
       WHERE h.is_deleted = 0
       ORDER BY h.created_at DESC`
    );
    res.json({ success: true, data: properties });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPropertyById = async (req, res) => {
  const propertyId = req.params.id;
  try {
    const [properties] = await pool.query(
      `SELECT h.*, ps.name as status_name, t.name as tenant_name 
       FROM hotels h
       JOIN property_statuses ps ON h.status_id = ps.id
       LEFT JOIN tenants t ON h.tenant_id = t.id
       WHERE h.id = ? AND h.is_deleted = 0`, 
      [propertyId]
    );
    if (properties.length === 0) return res.status(404).json({ success: false, message: 'Property not found.' });

    const [settings] = await pool.query('SELECT category, setting_key, setting_value FROM property_settings WHERE property_id = ?', [propertyId]);
    const propertyData = { ...properties[0], settings };
    
    res.json({ success: true, data: propertyData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePropertyStatus = async (req, res) => {
  const propertyId = req.params.id;
  const { statusName } = req.body; 
  
  if (!['Suspended', 'Archived', 'Active'].includes(statusName)) {
    return res.status(400).json({ success: false, message: 'Invalid status transition.' });
  }

  try {
    const [statusRow] = await pool.query("SELECT id FROM property_statuses WHERE name = ?", [statusName]);
    const [result] = await pool.query(
      'UPDATE hotels SET status_id = ?, updated_by = ? WHERE id = ?',
      [statusRow[0].id, req.user.userId, propertyId]
    );
    
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Property not found.' });

    await pool.query(
      `INSERT INTO audit_logs (tenant_id, property_id, user_id, action, target_table, target_id, new_value)
       SELECT tenant_id, id, ?, ?, 'hotels', id, ? FROM hotels WHERE id = ?`,
      [req.user.userId, `PLATFORM_PROPERTY_STATUS_CHANGED_${statusName.toUpperCase()}`, statusName, propertyId]
    );

    res.json({ success: true, message: `Property status updated to ${statusName}.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const generateScopedPmsSession = async (req, res) => {
  const propertyId = req.params.id;
  // This generates a short-lived token to auto-login to a specific property's PMS.
  const jwt = await import('jsonwebtoken');
  
  try {
    const [hotels] = await pool.query('SELECT id, tenant_id FROM hotels WHERE id = ?', [propertyId]);
    if (hotels.length === 0) return res.status(404).json({ success: false, message: 'Property not found' });
    
    const payload = {
      userId: req.user.userId,
      hotelId: propertyId,
      tenantId: hotels[0].tenant_id,
      role: 'admin',
      emailVerified: true,
      scope: ['hotel', 'scoped_session']
    };

    const token = jwt.default.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '1h',
      algorithm: 'HS256',
    });

    res.json({ success: true, token, hotelId: propertyId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

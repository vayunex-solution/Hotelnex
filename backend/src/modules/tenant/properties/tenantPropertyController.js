import pool from '../../../config/db.js';
import crypto from 'crypto';
import logger from '../../../core/logger/logger.js';

// --- DRAFTS (Property Wizard Autosave) ---

export const getDrafts = async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const [drafts] = await pool.query('SELECT * FROM property_drafts WHERE tenant_id = ? ORDER BY updated_at DESC', [tenantId]);
    res.json({ success: true, data: drafts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createDraft = async (req, res) => {
  const tenantId = req.user.tenantId;
  const { draftData, step } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO property_drafts (tenant_id, draft_data, step) VALUES (?, ?, ?)',
      [tenantId, JSON.stringify(draftData || {}), step || 1]
    );
    res.status(201).json({ success: true, draftId: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateDraft = async (req, res) => {
  const tenantId = req.user.tenantId;
  const draftId = req.params.id;
  const { draftData, step } = req.body;
  try {
    const [result] = await pool.query(
      'UPDATE property_drafts SET draft_data = ?, step = ? WHERE id = ? AND tenant_id = ?',
      [JSON.stringify(draftData), step, draftId, tenantId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Draft not found.' });
    res.json({ success: true, message: 'Draft autosaved.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const publishDraft = async (req, res) => {
  const tenantId = req.user.tenantId;
  const draftId = req.params.id;
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Fetch Draft
    const [drafts] = await conn.query('SELECT draft_data FROM property_drafts WHERE id = ? AND tenant_id = ?', [draftId, tenantId]);
    if (drafts.length === 0) throw new Error('Draft not found.');
    const draftData = JSON.parse(drafts[0].draft_data);
    
    // 2. Insert into Hotels (Property)
    const propertyCode = 'PRP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const [statusRow] = await conn.query("SELECT id FROM property_statuses WHERE name = 'Configured'");
    
    const [hotelResult] = await conn.query(
      `INSERT INTO hotels (tenant_id, name, address, timezone, currency_code, status_id, property_code, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        draftData.basic?.name || 'Unnamed Property',
        draftData.location?.address || '',
        draftData.taxCurrency?.timezone || 'UTC',
        draftData.taxCurrency?.currency || 'USD',
        statusRow[0].id,
        propertyCode,
        req.user.userId,
        req.user.userId
      ]
    );

    const propertyId = hotelResult.insertId;

    // 3. Insert Branding/Tax Settings into property_settings
    const settings = [
      ['branding', 'logo', draftData.branding?.logo || ''],
      ['branding', 'dark_logo', draftData.branding?.darkLogo || ''],
      ['branding', 'favicon', draftData.branding?.favicon || ''],
      ['branding', 'primary_color', draftData.branding?.primaryColor || ''],
      ['branding', 'secondary_color', draftData.branding?.secondaryColor || ''],
      ['branding', 'accent_color', draftData.branding?.accentColor || ''],
      ['branding', 'invoice_branding', draftData.branding?.invoiceBranding || ''],
      ['branding', 'email_branding', draftData.branding?.emailBranding || ''],
      ['tax', 'tax_id', draftData.taxCurrency?.taxId || ''],
      ['tax', 'tax_rate', draftData.taxCurrency?.taxRate || ''],
      ['business', 'features', JSON.stringify(draftData.business || {})]
    ];

    for (const [category, key, value] of settings) {
      if (value !== undefined && value !== '') {
        await conn.query(
          `INSERT INTO property_settings (property_id, tenant_id, category, setting_key, setting_value, updated_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [propertyId, tenantId, category, key, typeof value === 'object' ? JSON.stringify(value) : value, req.user.userId]
        );
      }
    }

    // 4. Delete Draft & Audit Log
    await conn.query('DELETE FROM property_drafts WHERE id = ?', [draftId]);
    await conn.query(
      `INSERT INTO audit_logs (tenant_id, property_id, user_id, action, target_table, target_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tenantId, propertyId, req.user.userId, 'CREATED_PROPERTY_FROM_WIZARD', 'hotels', propertyId]
    );

    await conn.commit();
    res.status(201).json({ success: true, message: 'Property created successfully.', propertyId });
  } catch (error) {
    await conn.rollback();
    logger.error('Publish Draft Error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
};

// --- PROPERTY CRUD ---

export const getProperties = async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const [properties] = await pool.query(
      `SELECT h.*, ps.name as status_name 
       FROM hotels h
       JOIN property_statuses ps ON h.status_id = ps.id
       WHERE h.tenant_id = ? AND h.is_deleted = 0`, 
      [tenantId]
    );
    res.json({ success: true, data: properties });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPropertyById = async (req, res) => {
  const tenantId = req.user.tenantId;
  const propertyId = req.params.id;
  try {
    const [properties] = await pool.query(
      `SELECT h.*, ps.name as status_name 
       FROM hotels h
       JOIN property_statuses ps ON h.status_id = ps.id
       WHERE h.id = ? AND h.tenant_id = ? AND h.is_deleted = 0`, 
      [propertyId, tenantId]
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
  const tenantId = req.user.tenantId;
  const propertyId = req.params.id;
  const { statusName } = req.body; // e.g., 'Suspended', 'Archived', 'Restore' -> 'Active'
  
  if (!['Suspended', 'Archived', 'Active'].includes(statusName)) {
    return res.status(400).json({ success: false, message: 'Invalid status transition.' });
  }

  try {
    const [statusRow] = await pool.query("SELECT id FROM property_statuses WHERE name = ?", [statusName]);
    const [result] = await pool.query(
      'UPDATE hotels SET status_id = ?, updated_by = ? WHERE id = ? AND tenant_id = ?',
      [statusRow[0].id, req.user.userId, propertyId, tenantId]
    );
    
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Property not found.' });

    await pool.query(
      `INSERT INTO audit_logs (tenant_id, property_id, user_id, action, target_table, target_id, new_value)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, propertyId, req.user.userId, `PROPERTY_STATUS_CHANGED_${statusName.toUpperCase()}`, 'hotels', propertyId, statusName]
    );

    res.json({ success: true, message: `Property status updated to ${statusName}.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

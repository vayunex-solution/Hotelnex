import tenantService from './tenantService.js';

/**
 * TenantController
 * HTTP layer for /api/v1/platform/tenants
 */

// ─── GET /api/v1/platform/tenants ────────────────────────────────────────────
export const listTenants = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const result = await tenantService.listTenants({ page: +page, limit: +limit, search });

    return res.status(200).json({
      success:    true,
      data:       result.rows,
      pagination: {
        page:       result.page,
        limit:      result.limit,
        total:      result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to list tenants.' });
  }
};

// ─── GET /api/v1/platform/tenants/:id ────────────────────────────────────────
export const getTenant = async (req, res) => {
  try {
    const data = await tenantService.getTenantById(req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/v1/platform/tenants ───────────────────────────────────────────
export const provisionTenant = async (req, res) => {
  try {
    const { name, contactEmail, country, timezone, currencyCode } = req.body;

    if (!name || !contactEmail) {
      return res.status(400).json({ success: false, message: 'name and contactEmail are required.' });
    }

    const result = await tenantService.provisionTenant(
      { name, contactEmail, country, timezone, currencyCode },
      req.user.userId,
    );

    return res.status(201).json({
      success: true,
      message: 'Tenant provisioned successfully.',
      data:    result,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Provisioning failed.' });
  }
};

// ─── PUT /api/v1/platform/tenants/:id ────────────────────────────────────────
export const updateTenant = async (req, res) => {
  try {
    const result = await tenantService.updateTenant(req.params.id, req.body, req.user.userId);
    return res.status(200).json({ success: true, message: 'Tenant updated.', data: result });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/v1/platform/tenants/:id/status ───────────────────────────────
export const updateTenantStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'status is required.' });

    const result = await tenantService.updateStatus(req.params.id, status, req.user.userId);
    return res.status(200).json({ success: true, message: `Tenant status updated to ${status}.`, data: result });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

// ─── DELETE /api/v1/platform/tenants/:id ─────────────────────────────────────
export const deleteTenant = async (req, res) => {
  try {
    await tenantService.deleteTenant(req.params.id, req.user.userId);
    return res.status(200).json({ success: true, message: 'Tenant soft-deleted.' });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

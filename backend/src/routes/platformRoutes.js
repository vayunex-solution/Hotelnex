import { Router } from 'express';
import { requireAuth }       from '../middlewares/authMiddleware.js';
import { requireSuperAdmin } from '../middlewares/superAdminMiddleware.js';

import { platformLogin, platformProfile }  from '../modules/platform/auth/platformAuthController.js';
import { getDashboardSummary }             from '../modules/platform/dashboard/platformDashboardController.js';
import {
  listTenants,
  getTenant,
  provisionTenant,
  updateTenant,
  updateTenantStatus,
  deleteTenant,
} from '../modules/platform/tenants/tenantController.js';

import {
  createProperty,
  getAllProperties,
  getPropertyById,
  updatePropertyStatus,
  generateScopedPmsSession
} from '../modules/platform/properties/platformPropertyController.js';

const router = Router();

// ─── Public platform routes (no auth) ────────────────────────────────────────
router.post('/auth/login', platformLogin);

// ─── Protected platform routes (Super Admin only) ─────────────────────────────
const guard = [requireAuth, requireSuperAdmin];

router.get( '/auth/profile',            ...guard, platformProfile);
router.get( '/dashboard/summary',       ...guard, getDashboardSummary);

// Tenant CRUD
router.get(    '/tenants',              ...guard, listTenants);
router.post(   '/tenants',              ...guard, provisionTenant);
router.get(    '/tenants/:id',          ...guard, getTenant);
router.put(    '/tenants/:id',          ...guard, updateTenant);
router.patch(  '/tenants/:id/status',   ...guard, updateTenantStatus);
router.delete( '/tenants/:id',          ...guard, deleteTenant);

// Property CRUD
router.post(   '/properties',           ...guard, createProperty);
router.get(    '/properties',           ...guard, getAllProperties);
router.get(    '/properties/:id',       ...guard, getPropertyById);
router.patch(  '/properties/:id/status',...guard, updatePropertyStatus);
router.post(   '/properties/:id/pms-session', ...guard, generateScopedPmsSession);

export default router;

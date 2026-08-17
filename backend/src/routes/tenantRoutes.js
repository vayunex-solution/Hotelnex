import { Router } from 'express';
import { requireAuth, requireVerification } from '../middlewares/authMiddleware.js';
import {
  getDrafts,
  createDraft,
  updateDraft,
  publishDraft,
  getProperties,
  getPropertyById,
  updatePropertyStatus
} from '../modules/tenant/properties/tenantPropertyController.js';

import {
  startProvisioning,
  getProvisioningStatus,
  retryFailedStep,
  cancelProvisioning,
  resumeProvisioning
} from '../modules/tenant/provisioning/provisioningController.js';

const router = Router();

// Middleware to ensure user belongs to a tenant
const requireTenant = (req, res, next) => {
  if (!req.user.tenantId) {
    return res.status(403).json({ success: false, message: 'Access denied. You are not assigned to a tenant.' });
  }
  next();
};

const guard = [requireAuth, requireVerification, requireTenant];

// --- Property Drafts ---
router.get(   '/properties/drafts',       ...guard, getDrafts);
router.post(  '/properties/drafts',       ...guard, createDraft);
router.put(   '/properties/drafts/:id',   ...guard, updateDraft);
router.post(  '/properties/drafts/:id/publish', ...guard, publishDraft);

// --- Property CRUD ---
router.get(   '/properties',              ...guard, getProperties);
router.get(   '/properties/:id',          ...guard, getPropertyById);
router.patch( '/properties/:id/status',   ...guard, updatePropertyStatus);

// --- Provisioning Engine ---
router.post( '/properties/:id/provision',         ...guard, startProvisioning);
router.get(  '/properties/:id/provision/status',  ...guard, getProvisioningStatus);
router.post( '/properties/:id/provision/retry',   ...guard, retryFailedStep);
router.post( '/properties/:id/provision/cancel',  ...guard, cancelProvisioning);
router.post( '/properties/:id/provision/resume',  ...guard, resumeProvisioning);

export default router;

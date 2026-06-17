import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';

const router = express.Router();

// GET  /api/settings  — fetch hotel profile
router.get('/', getSettings);

// PUT  /api/settings  — update hotel profile
router.put('/', updateSettings);

export default router;

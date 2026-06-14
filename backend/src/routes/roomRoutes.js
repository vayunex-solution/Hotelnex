import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';
import { getAllRooms, createRoom, updateRoomStatus, updateRoom, deleteRoom } from '../controllers/roomController.js';

const router = Router();

// All routes in this module require a valid JWT
router.use(requireAuth);

// GET  /api/rooms           — admin & receptionist can view rooms
router.get('/', requireRole('admin', 'receptionist'), getAllRooms);

// POST /api/rooms           — admin only creates rooms
router.post('/', requireRole('admin'), createRoom);

// PUT  /api/rooms/:id       — admin only updates rooms
router.put('/:id', requireRole('admin'), updateRoom);

// PATCH /api/rooms/:id/status — admin only updates status
router.patch('/:id/status', requireRole('admin'), updateRoomStatus);

// DELETE /api/rooms/:id     — admin only deletes rooms
router.delete('/:id', requireRole('admin'), deleteRoom);

export default router;

import express from 'express';
import { checkIn, checkOut, getBookingHistory, getDashboardStats, getActiveBookingByRoom, getActiveBookings } from '../controllers/bookingController.js';

const router = express.Router();

router.post('/checkin', checkIn);
router.post('/checkout/:id', checkOut);
router.get('/history', getBookingHistory);
router.get('/stats', getDashboardStats);
router.get('/active', getActiveBookings);
router.get('/active/room/:roomId', getActiveBookingByRoom);

export default router;

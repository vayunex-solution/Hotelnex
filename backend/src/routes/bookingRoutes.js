import express from 'express';
import { 
  checkIn, 
  checkOut, 
  getBookingHistory, 
  getDashboardStats, 
  getActiveBookingByRoom, 
  getActiveBookings, 
  getBookingDetails,
  shiftRoom,
  getBookingTransfers
} from '../controllers/bookingController.js';

const router = express.Router();

router.post('/checkin', checkIn);
router.post('/checkout/:id', checkOut);
router.post('/shift-room', shiftRoom);
router.get('/history', getBookingHistory);
router.get('/stats', getDashboardStats);
router.get('/active', getActiveBookings);
router.get('/active/room/:roomId', getActiveBookingByRoom);
router.get('/:id/transfers', getBookingTransfers);
router.get('/:id', getBookingDetails);   // must be LAST to avoid capturing named routes

export default router;



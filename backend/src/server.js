import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import guestRoutes from './routes/guestRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import { requireAuth } from './middlewares/authMiddleware.js';
import { requireRole } from './middlewares/rbacMiddleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Global Security & Utility Middleware ──────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());

// ─── Public Routes ─────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS result');
    res.json({ status: 'OK', database: 'Connected', check: rows[0].result });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', database: 'Disconnected', error: error.message });
  }
});

// Auth (public — no requireAuth)
app.use('/api/auth', authRoutes);

// ─── Self-Healing DB Migration ─────────────────────────────────────────────────
(async () => {
  try {
    // Add phone_number column to hotels if it doesn't exist (MySQL ALTER TABLE)
    await pool.query(
      `ALTER TABLE hotels ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) DEFAULT NULL`
    );
    console.log('[Migration] hotels.phone_number column ensured.');
  } catch (e) {
    // SQLite doesn't support IF NOT EXISTS on ALTER — ignore column already exists
    if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) {
      console.warn('[Migration] phone_number migration warning:', e.message);
    }
  }
})();

// ─── Protected Routes ──────────────────────────────────────────────────────────

// Static files serving for uploaded guest documents
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rooms module — auth enforced inside roomRoutes via router.use(requireAuth)
app.use('/api/rooms', roomRoutes);

// Guest module (requires auth)
app.use('/api/guests', requireAuth, guestRoutes);

// Booking & Check-in / Check-out module (requires auth)
app.use('/api/bookings', requireAuth, bookingRoutes);

// Settings module (requires auth)
app.use('/api/settings', requireAuth, settingsRoutes);

// Profile — any authenticated user
app.get('/api/profile', requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

// Admin dashboard
app.get('/api/admin/dashboard', requireAuth, requireRole('admin'), (req, res) => {
  res.json({
    success: true,
    message: `Welcome, admin. Hotel ID: ${req.user.hotelId}`,
  });
});

// Reception dashboard
app.get('/api/reception/dashboard', requireAuth, requireRole('admin', 'receptionist'), (req, res) => {
  res.json({
    success: true,
    message: `Welcome to reception. Hotel ID: ${req.user.hotelId}, Role: ${req.user.role}`,
  });
});

// ─── 404 Fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ─── Global Error Handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ success: false, message: 'An internal server error occurred.' });
});

// ─── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});

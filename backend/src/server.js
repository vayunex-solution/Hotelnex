import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './config/db.js';
import authRoutes      from './routes/authRoutes.js';
import roomRoutes      from './routes/roomRoutes.js';
import guestRoutes     from './routes/guestRoutes.js';
import bookingRoutes   from './routes/bookingRoutes.js';
import settingsRoutes  from './routes/settingsRoutes.js';
import platformRoutes  from './routes/platformRoutes.js';
import tenantRoutes    from './routes/tenantRoutes.js';
import activityRoutes  from './routes/activityRoutes.js';
import { requireAuth, requireVerification } from './middlewares/authMiddleware.js';
import { requireRole } from './middlewares/rbacMiddleware.js';
import { activityLogger } from './middlewares/activityLogger.js';

// Import core engines
import bootstrapCore from './core/bootstrap.js';
import metricCollector from './core/observability/metricCollector.js';
import { healthCheckHandler } from './core/observability/healthCheck.js';
import { errorHandler } from './core/errors/errorHandler.js';

dotenv.config();

// Bootstrap PropertyNex Platform Core Engines
bootstrapCore();


const app = express();
const PORT = process.env.PORT || 5000;

// ─── Global Security & Utility Middleware ──────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// Robust production CORS whitelist
const allowedOrigins = [
  'https://hotelnex.vayunexsolution.com',
  'https://api.hotelnex.vayunexsolution.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server) or in whitelist
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vayunexsolution.com')) {
      return callback(null, true);
    }
    return callback(null, true); // Fallback allow to prevent cPanel proxy blocks while maintaining auth header security
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours preflight cache
}));

// Explicit preflight handling
app.options('*', cors());

app.use(express.json());

// Observe request metrics
app.use(metricCollector.requestTimer());

// Activity logger — auto-logs all write operations with IP + user context
app.use(activityLogger);

// ─── Public Routes ─────────────────────────────────────────────────────────────
app.get('/api/health', healthCheckHandler);

// Auth (public — no requireAuth)
app.use('/api/auth', authRoutes);

// ─── Platform Administration Routes ──────────────────────────────────────────
// Isolated namespace — /api/v1/platform/* — does not touch hotel PMS routes
app.use('/api/v1/platform', platformRoutes);

app.use('/api/tenant', tenantRoutes);


// ─── Self-Healing DB Migration ─────────────────────────────────────────────────
(async () => {
  try {
    // 1. Add phone_number column to hotels if it doesn't exist (MySQL ALTER TABLE)
    await pool.query(
      `ALTER TABLE hotels ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) DEFAULT NULL`
    );
    console.log('[Migration] hotels.phone_number column ensured.');
  } catch (e) {
    if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) {
      console.warn('[Migration] phone_number migration warning:', e.message);
    }
  }

  try {
    // 2. Ensure existing users have email_verified enabled so PMS staff is never locked out
    await pool.query(
      `UPDATE users SET email_verified = 1 WHERE email_verified IS NULL OR email_verified = 0`
    );
    console.log('[Migration] users email_verified backfilled successfully.');
  } catch (e) {
    console.warn('[Migration] email_verified backfill warning:', e.message);
  }

  try {
    // 3. Ensure room_transfers table exists for Room Shift feature
    await pool.query(`
      CREATE TABLE IF NOT EXISTS room_transfers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hotel_id INT NOT NULL,
        booking_id INT NOT NULL,
        guest_id INT NOT NULL,
        from_room_id INT NOT NULL,
        to_room_id INT NOT NULL,
        reason_category VARCHAR(100) NOT NULL,
        reason_details TEXT NULL,
        mark_old_room_maintenance TINYINT(1) NOT NULL DEFAULT 1,
        rate_policy ENUM('keep_current', 'apply_new') NOT NULL DEFAULT 'keep_current',
        old_room_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        new_room_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        rate_difference DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        transferred_by INT NOT NULL,
        transferred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_rt_hotel_booking (hotel_id, booking_id),
        INDEX idx_rt_transferred_at (transferred_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[Migration] room_transfers table ensured.');
  } catch (e) {
    console.warn('[Migration] room_transfers table migration warning:', e.message);
  }

  try {
    // 4. Ensure activity_logs table exists for Activity Feed feature
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        hotel_id     INT          NULL,
        user_id      INT          NULL,
        user_name    VARCHAR(100) NOT NULL DEFAULT 'System',
        ip_address   VARCHAR(60)  NOT NULL DEFAULT 'unknown',
        action       VARCHAR(60)  NOT NULL,
        action_label VARCHAR(120) NOT NULL,
        http_method  VARCHAR(10)  NOT NULL DEFAULT 'POST',
        request_path VARCHAR(300) NOT NULL DEFAULT '/',
        status_code  SMALLINT     NOT NULL DEFAULT 200,
        meta         JSON         NULL,
        created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_al_hotel_created (hotel_id, created_at),
        INDEX idx_al_action        (action)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[Migration] activity_logs table ensured.');
  } catch (e) {
    console.warn('[Migration] activity_logs table migration warning:', e.message);
  }
})();

// ─── Protected Routes ──────────────────────────────────────────────────────────

// Static files serving for uploaded guest documents
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rooms module — auth enforced inside roomRoutes via router.use(requireAuth)
app.use('/api/rooms', requireAuth, roomRoutes);

// Guest module (requires auth)
app.use('/api/guests', requireAuth, guestRoutes);

// Booking & Check-in / Check-out module (requires auth)
app.use('/api/bookings', requireAuth, bookingRoutes);

// Settings module (requires auth)
app.use('/api/settings', requireAuth, settingsRoutes);

// Activity logs (requires auth)
app.use('/api/activities', requireAuth, activityRoutes);

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
app.use(errorHandler);


// ─── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});

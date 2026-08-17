import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../../config/db.js';

/**
 * PlatformAuthService
 * Handles authentication exclusively for Super Admin users.
 * Completely separate from the hotel-scoped authController.
 */
export class PlatformAuthService {

  // ─── Login ───────────────────────────────────────────────────────────────────
  async login({ email, password, ip = null, userAgent = null }) {
    const [rows] = await db.query(
      `SELECT id, name, email, password_hash, role, is_super_admin, is_active
       FROM users
       WHERE email = ? AND is_super_admin = 1
       LIMIT 1`,
      [email],
    );

    const user = rows[0];

    // Log attempt regardless of outcome
    const eventBase = {
      user_id:    user?.id || null,
      ip_address: ip,
      user_agent: userAgent,
      event_time: new Date(),
    };

    if (!user || !user.is_active) {
      await this._logSecurityEvent({ ...eventBase, event_type: 'login_failed', details: 'User not found or inactive' });
      throw { status: 401, message: 'Invalid credentials.' };
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      await this._logSecurityEvent({ ...eventBase, user_id: user.id, event_type: 'login_failed', details: 'Password mismatch' });
      throw { status: 401, message: 'Invalid credentials.' };
    }

    // Successful login — mint a platform-scoped JWT
    const token = jwt.sign(
      {
        userId:       user.id,
        role:         user.role,
        isSuperAdmin: true,
      },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '8h' },
    );

    await this._logLoginHistory({ user_id: user.id, ip, userAgent, success: true });
    await this._logSecurityEvent({ ...eventBase, user_id: user.id, event_type: 'login_success', details: 'Platform admin login' });

    return {
      token,
      user: {
        id:          user.id,
        name:        user.name,
        email:       user.email,
        role:        user.role,
        isSuperAdmin: true,
      },
    };
  }

  // ─── Profile ─────────────────────────────────────────────────────────────────
  async getProfile(userId) {
    const [rows] = await db.query(
      `SELECT id, name, email, role, is_super_admin, created_at
       FROM users
       WHERE id = ? AND is_super_admin = 1
       LIMIT 1`,
      [userId],
    );

    if (!rows.length) throw { status: 404, message: 'Super admin profile not found.' };

    return rows[0];
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────
  async _logLoginHistory({ user_id, ip, userAgent, success }) {
    try {
      await db.query(
        `INSERT INTO login_history (user_id, ip_address, user_agent, success, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [user_id, ip, userAgent, success ? 1 : 0],
      );
    } catch { /* non-blocking */ }
  }

  async _logSecurityEvent({ user_id, event_type, details, ip_address, user_agent }) {
    try {
      await db.query(
        `INSERT INTO security_events (user_id, event_type, details, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [user_id, event_type, details, ip_address, user_agent],
      );
    } catch { /* non-blocking */ }
  }
}

export default new PlatformAuthService();

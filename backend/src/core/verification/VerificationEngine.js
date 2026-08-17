import crypto from 'crypto';
import db from '../../config/db.js';
import eventBus, { SYSTEM_EVENTS } from '../eventbus/eventBus.js';
import logger from '../logger/logger.js';

class VerificationEngine {
  constructor() {
    this.EXPIRY_MINUTES = 10;
    this.MAX_RESEND = 5;
    this.MAX_ATTEMPTS = 5;
  }

  /**
   * Generates a cryptographically secure numeric OTP
   */
  _generateSecureOTP(length = 6) {
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += crypto.randomInt(0, 10).toString();
    }
    return otp;
  }

  /**
   * Hashes a token for secure storage
   */
  _hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Initiates a verification request (creates or updates)
   * Supported types: 'email_otp', 'magic_link', 'password_reset', 'invitation'
   */
  async createVerification(userId, type, method = 'email') {
    let token;
    let isOtp = type.includes('otp');
    
    if (isOtp) {
      token = this._generateSecureOTP(6);
    } else {
      token = crypto.randomBytes(32).toString('hex');
    }

    const hashedToken = this._hashToken(token);
    const expiresAt = new Date(Date.now() + this.EXPIRY_MINUTES * 60000);

    const conn = await db.getConnection();
    try {
      // Check for existing pending verification to handle resend limits
      const [existing] = await conn.query(
        `SELECT id, attempts, status, created_at FROM user_verifications 
         WHERE user_id = ? AND verification_type = ? AND status IN ('pending', 'locked')
         ORDER BY created_at DESC LIMIT 1`,
        [userId, type]
      );

      if (existing.length > 0) {
        const record = existing[0];
        
        // If locked, check if we should unlock based on time (e.g. 1 hour), for now we just block
        if (record.status === 'locked') {
           throw new Error('Verification is temporarily locked due to too many attempts.');
        }

        // We count resends by checking how many attempts there were, or we can just count total rows.
        // Actually, let's count total pending/failed requests in the last hour for this user+type to enforce MAX_RESEND
        const [recentRequests] = await conn.query(
          `SELECT COUNT(*) as count FROM user_verifications 
           WHERE user_id = ? AND verification_type = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
          [userId, type]
        );

        if (recentRequests[0].count >= this.MAX_RESEND) {
          // Lock the user out of this verification type
          await conn.query(
             `UPDATE user_verifications SET status = 'locked' WHERE user_id = ? AND verification_type = ?`,
             [userId, type]
          );
          eventBus.publish('VerificationLocked', { userId, type });
          this._logAudit(userId, 'VerificationLocked', { type });
          throw new Error('Maximum resend limit reached. Try again later.');
        }
      }

      // Invalidate previous pending requests of this type
      await conn.query(
        `UPDATE user_verifications SET status = 'expired' WHERE user_id = ? AND verification_type = ? AND status = 'pending'`,
        [userId, type]
      );

      // Insert new request
      const [result] = await conn.query(
        `INSERT INTO user_verifications (user_id, verification_type, verification_token, verification_method, expires_at, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [userId, type, hashedToken, method, expiresAt]
      );

      eventBus.publish('VerificationRequested', { userId, type, method, verificationId: result.insertId });
      this._logAudit(userId, 'VerificationRequested', { type, method, verificationId: result.insertId });
      
      // Return raw token ONLY here. It is never stored.
      return { rawToken: token, expiresAt };
    } finally {
      conn.release();
    }
  }

  /**
   * Verifies a provided token
   */
  async verifyToken(userId, type, rawToken) {
    const hashedToken = this._hashToken(rawToken);
    
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [records] = await conn.query(
        `SELECT id, verification_token, expires_at, attempts, status 
         FROM user_verifications 
         WHERE user_id = ? AND verification_type = ? AND status = 'pending'
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [userId, type]
      );

      if (!records.length) {
        throw new Error('No pending verification found.');
      }

      const record = records[0];

      // Check Expiry
      if (new Date() > new Date(record.expires_at)) {
        await conn.query(`UPDATE user_verifications SET status = 'expired' WHERE id = ?`, [record.id]);
        eventBus.publish('VerificationExpired', { userId, type, verificationId: record.id });
        await this._logAudit(userId, 'VerificationExpired', { type, verificationId: record.id });
        await conn.commit();
        throw new Error('Verification code has expired.');
      }

      // Check Attempts
      if (record.attempts >= this.MAX_ATTEMPTS) {
        await conn.query(`UPDATE user_verifications SET status = 'locked' WHERE id = ?`, [record.id]);
        eventBus.publish('VerificationLocked', { userId, type, verificationId: record.id });
        await this._logAudit(userId, 'VerificationLocked', { type, verificationId: record.id });
        await conn.commit();
        throw new Error('Maximum verification attempts reached. Account temporarily locked.');
      }

      // Check Token Match
      if (record.verification_token !== hashedToken) {
        await conn.query(`UPDATE user_verifications SET attempts = attempts + 1 WHERE id = ?`, [record.id]);
        eventBus.publish('VerificationFailed', { userId, type, verificationId: record.id, attempts: record.attempts + 1 });
        await this._logAudit(userId, 'VerificationFailed', { type, verificationId: record.id, attempts: record.attempts + 1 });
        await conn.commit();
        throw new Error('Invalid verification code.');
      }

      // Success!
      await conn.query(
        `UPDATE user_verifications SET status = 'verified', verified_at = NOW() WHERE id = ?`, 
        [record.id]
      );
      
      // Update users table depending on verification type
      if (type === 'email_otp' || type === 'magic_link') {
         await conn.query(
           `UPDATE users SET email_verified = 1, verification_method = ? WHERE id = ?`,
           [type, userId]
         );
      }

      eventBus.publish('VerificationSucceeded', { userId, type, verificationId: record.id });
      await this._logAudit(userId, 'VerificationSucceeded', { type, verificationId: record.id });
      await conn.commit();
      
      return true;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async _logAudit(userId, action, payload) {
    try {
      await db.query(
        `INSERT INTO audit_logs (user_id, action, target_table, new_value) VALUES (?, ?, ?, ?)`,
        [userId, action, 'user_verifications', JSON.stringify(payload)]
      );
    } catch (e) {
      logger.error('Failed to write audit log for verification event', { error: e.message });
    }
  }
}

export default new VerificationEngine();

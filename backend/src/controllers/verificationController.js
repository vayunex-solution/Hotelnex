import verificationEngine from '../core/verification/VerificationEngine.js';
import workflowEngine from '../core/workflow/workflowEngine.js';
import pool from '../config/db.js';

export const sendOtp = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, name } = req.user; // populated by auth middleware
    
    // Create Verification token
    const { rawToken, expiresAt } = await verificationEngine.createVerification(userId, 'email_otp');

    // Dispatch via Event Bus / Workflow Engine
    await workflowEngine.trigger('VerificationRequested', 'user', userId, {
      templateName: 'OTPVerification',
      toEmail: email,
      emailPayload: { name, otp: rawToken, expiry: '10 minutes' }
    });

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      expiresAt
    });
  } catch (error) {
    if (error.message.includes('locked') || error.message.includes('limit')) {
      return res.status(429).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Verification code is required' });
    }

    await verificationEngine.verifyToken(userId, 'email_otp', code.trim());

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully.'
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const saveConsent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { consent, version } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    await pool.query(
      `UPDATE users 
       SET marketing_consent = ?, marketing_consent_at = NOW(), marketing_consent_version = ?, marketing_consent_ip = ?
       WHERE id = ?`,
      [consent ? 1 : 0, version || 'v1.0', ipAddress, userId]
    );

    return res.status(200).json({ success: true, message: 'Consent preferences updated.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to save consent.' });
  }
};

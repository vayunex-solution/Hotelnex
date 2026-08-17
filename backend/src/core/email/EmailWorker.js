import nodemailer from 'nodemailer';
import db from '../../config/db.js';
import logger from '../logger/logger.js';

class EmailWorker {
  constructor() {
    this.interval = null;
    this.isRunning = false;
    this.transporter = null;
    this.maxAttempts = 3;
    
    // Initialize transporter if env vars are present
    this._initTransporter();
  }

  _initTransporter() {
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      logger.info('EmailWorker transporter initialized.');
    } else {
      logger.warn('SMTP configuration missing in .env. EmailWorker will mock sending.');
    }
  }

  /**
   * Starts the polling worker to process the email queue
   * @param {number} intervalMs - Polling interval in milliseconds
   */
  start(intervalMs = 10000) {
    if (this.interval) return;
    
    logger.info(`Starting EmailWorker (polling every \${intervalMs}ms)...`);
    this.interval = setInterval(() => this.processQueue(), intervalMs);
    // Also run immediately
    this.processQueue();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('EmailWorker stopped.');
    }
  }

  /**
   * Replaces {{variable}} in templates with values from the payload
   */
  _renderTemplate(templateString, payload) {
    return templateString.replace(/\{\{(\\w+)\}\}/g, (match, key) => {
      return payload[key] !== undefined ? payload[key] : match;
    });
  }

  async processQueue() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // 1. Fetch pending or failed emails (under max attempts)
      // Only fetch those where send_after is null OR past
      const [emails] = await db.query(
        `SELECT eq.id, eq.to_email, eq.payload, eq.attempts, eq.template_id, 
                et.subject_template, et.html_body
         FROM email_queue eq
         JOIN email_templates et ON eq.template_id = et.id
         WHERE (eq.status = 'pending' OR (eq.status = 'failed' AND eq.attempts < ?))
           AND (eq.send_after IS NULL OR eq.send_after <= NOW())
         ORDER BY eq.created_at ASC
         LIMIT 10`,
        [this.maxAttempts]
      );

      if (!emails.length) {
        this.isRunning = false;
        return;
      }

      for (const email of emails) {
        await this._processSingleEmail(email);
      }
    } catch (error) {
      logger.error('Error processing email queue', { error: error.message });
    } finally {
      this.isRunning = false;
    }
  }

  async _processSingleEmail(email) {
    let conn;
    try {
      conn = await db.getConnection();
      
      // Mark as processing
      await conn.query('UPDATE email_queue SET status = ?, attempts = attempts + 1 WHERE id = ?', ['processing', email.id]);

      const payload = typeof email.payload === 'string' ? JSON.parse(email.payload) : email.payload;
      
      // Render template
      const subject = this._renderTemplate(email.subject_template, payload);
      const html = this._renderTemplate(email.html_body, payload);
      
      let status = 'sent';
      let errorMsg = null;

      try {
        if (this.transporter) {
          await this.transporter.sendMail({
            from: process.env.SMTP_FROM || '"PropertyNex" <noreply@propertynex.com>',
            to: email.to_email,
            subject: subject,
            html: html,
          });
        } else {
          // Mock send for dev environments without SMTP
          logger.info('[MOCK EMAIL SENT] To: ' + email.to_email + ' | Subject: ' + subject);
        }
      } catch (sendError) {
        status = 'failed';
        errorMsg = sendError.message;
        logger.error('SMTP Send Failed', { queueId: email.id, error: errorMsg });
      }

      // Update queue status
      await conn.query('UPDATE email_queue SET status = ? WHERE id = ?', [status, email.id]);

      // Log attempt
      await conn.query(
        `INSERT INTO email_logs (queue_id, to_email, subject, status, error_message, sent_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [email.id, email.to_email, subject, status, errorMsg]
      );

    } catch (error) {
      logger.error('Critical failure processing email ID ' + email.id, { error: error.message });
      // Try to mark as failed
      if (conn) {
        await conn.query('UPDATE email_queue SET status = ? WHERE id = ?', ['failed', email.id]).catch(() => {});
      }
    } finally {
      if (conn) conn.release();
    }
  }
}

export default new EmailWorker();

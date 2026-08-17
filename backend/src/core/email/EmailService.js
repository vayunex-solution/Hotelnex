import db from '../../config/db.js';
import logger from '../logger/logger.js';

class EmailService {
  /**
   * Enqueues an email to be sent asynchronously by the EmailWorker.
   * @param {string} templateName - The name of the template in email_templates table (e.g., 'WelcomeEmail', 'OTPVerification').
   * @param {string} toEmail - The recipient's email address.
   * @param {Object} payload - The variables to inject into the template (e.g., { name: 'John', otp: '123456' }).
   * @param {Date} [sendAfter] - Optional date to delay sending.
   */
  async enqueueEmail(templateName, toEmail, payload, sendAfter = null) {
    try {
      // 1. Fetch template ID
      const [templates] = await db.query(
        'SELECT id, is_active FROM email_templates WHERE name = ?',
        [templateName]
      );

      if (!templates.length) {
        throw new Error(`Email template '\${templateName}' not found.`);
      }

      if (!templates[0].is_active) {
        logger.warn(`Email template '\${templateName}' is inactive. Skipping enqueue.`);
        return false;
      }

      const templateId = templates[0].id;

      // 2. Insert into queue
      const [result] = await db.query(
        `INSERT INTO email_queue (template_id, to_email, payload, status, send_after)
         VALUES (?, ?, ?, 'pending', ?)`,
        [templateId, toEmail, JSON.stringify(payload), sendAfter]
      );

      logger.info(`Email enqueued successfully. Queue ID: \${result.insertId}, To: \${toEmail}, Template: \${templateName}`);
      return result.insertId;
    } catch (error) {
      logger.error('Failed to enqueue email', { error: error.message, templateName, toEmail });
      throw error;
    }
  }
}

export default new EmailService();

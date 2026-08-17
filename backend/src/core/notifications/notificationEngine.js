import pool from '../../config/db.js';
import logger from '../logger/logger.js';

class NotificationEngine {
  constructor() {
    this.providers = new Map(); // channel -> Provider implementation
  }

  registerProvider(channel, providerInstance) {
    this.providers.set(channel, providerInstance);
    logger.info(`[NotificationEngine] Provider registered for channel: ${channel}`);
  }

  /**
   * Enqueues a notification for async sending
   */
  async send({
    tenantId = null,
    propertyId = null,
    userId = null,
    guestId = null,
    templateKey = null,
    channel,
    recipient,
    subject = null,
    body = null,
    variables = {}
  }) {
    try {
      let finalSubject = subject;
      let finalBody = body;

      // 1. Resolve template if templateKey is provided
      if (templateKey) {
        const [templates] = await pool.query(
          `SELECT id, subject, body FROM notification_templates 
           WHERE template_key = ? AND channel = ? AND (tenant_id = ? OR tenant_id IS NULL)
           ORDER BY tenant_id DESC LIMIT 1`,
          [templateKey, channel, tenantId]
        );

        if (templates && templates.length > 0) {
          finalSubject = templates[0].subject;
          finalBody = templates[0].body;

          // Interpolate template variables: e.g. {{guestName}} -> variables.guestName
          if (variables && typeof variables === 'object') {
            for (const [key, val] of Object.entries(variables)) {
              const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
              finalBody = finalBody.replace(regex, val);
              if (finalSubject) {
                finalSubject = finalSubject.replace(regex, val);
              }
            }
          }
        }
      }

      if (!finalBody) {
        throw new Error('Notification body is empty and no template could be resolved.');
      }

      // 2. Insert into notification_queue
      const [insertResult] = await pool.query(
        `INSERT INTO notification_queue 
          (tenant_id, property_id, user_id, guest_id, channel, recipient, subject, body, status, scheduled_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`,
        [tenantId, propertyId, userId, guestId, channel, recipient, finalSubject, finalBody]
      );
      const queueId = insertResult.insertId;

      logger.info(`[NotificationEngine] Notification enqueued (ID: ${queueId}) via channel ${channel}`);

      // 3. Trigger delivery asynchronously
      setImmediate(() => this.deliver(queueId));

      return queueId;
    } catch (err) {
      logger.error(`[NotificationEngine] Send notification failed:`, err.message);
      throw err;
    }
  }

  /**
   * Process a queued notification
   */
  async deliver(queueId) {
    logger.info(`[NotificationEngine] Attempting delivery of queued item: ${queueId}`);
    
    const [rows] = await pool.query(
      `SELECT id, tenant_id, channel, recipient, subject, body, attempts, max_attempts 
       FROM notification_queue WHERE id = ? LIMIT 1`,
      [queueId]
    );

    if (!rows || rows.length === 0) return;
    const item = rows[0];

    // Mark as processing
    await pool.query(
      `UPDATE notification_queue SET status = 'processing', attempts = attempts + 1 WHERE id = ?`,
      [queueId]
    );

    const provider = this.providers.get(item.channel);
    if (!provider) {
      const errMsg = `No provider configured for channel: ${item.channel}`;
      logger.error(`[NotificationEngine] ${errMsg}`);
      
      await pool.query(
        `UPDATE notification_queue SET status = 'failed', failed_at = CURRENT_TIMESTAMP, failure_reason = ? WHERE id = ?`,
        [errMsg, queueId]
      );
      return;
    }

    try {
      // Execute sending via configured channel provider
      const result = await provider.send(item.recipient, item.subject, item.body);
      
      // Update queue to sent
      await pool.query(
        `UPDATE notification_queue SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [queueId]
      );

      // Log delivery status
      await pool.query(
        `INSERT INTO notification_logs (queue_id, tenant_id, channel, recipient, status, provider, provider_msg_id) 
         VALUES (?, ?, ?, ?, 'sent', ?, ?)`,
        [queueId, item.tenant_id, item.channel, item.recipient, provider.name, result.messageId || null]
      );

      logger.info(`[NotificationEngine] Queue item ${queueId} successfully sent.`);

    } catch (err) {
      logger.error(`[NotificationEngine] Delivery failed for item ${queueId}:`, err.message);
      
      const nextStatus = item.attempts + 1 >= item.max_attempts ? 'failed' : 'pending';
      
      await pool.query(
        `UPDATE notification_queue SET status = ?, failed_at = CURRENT_TIMESTAMP, failure_reason = ? WHERE id = ?`,
        [nextStatus, err.message, queueId]
      );

      await pool.query(
        `INSERT INTO notification_logs (queue_id, tenant_id, channel, recipient, status, provider, provider_msg_id) 
         VALUES (?, ?, ?, ?, 'failed', ?, NULL)`,
        [queueId, item.tenant_id, item.channel, item.recipient, provider.name]
      );
    }
  }
}

const notificationEngine = new NotificationEngine();

// Mock Internal/Default Email Provider
notificationEngine.registerProvider('email', {
  name: 'DefaultSMTPProvider',
  send: async (recipient, subject, body) => {
    logger.info(`[MockEmailProvider] Sending Email to ${recipient} | Subject: ${subject}`);
    return { success: true, messageId: `SMTP-MOCK-${Date.now()}` };
  }
});

// Mock Internal/Default WhatsApp Provider
notificationEngine.registerProvider('whatsapp', {
  name: 'DefaultWATIProvider',
  send: async (recipient, subject, body) => {
    logger.info(`[MockWatiProvider] Sending WhatsApp to ${recipient} | Msg: ${body}`);
    return { success: true, messageId: `WATI-MOCK-${Date.now()}` };
  }
});

export default notificationEngine;

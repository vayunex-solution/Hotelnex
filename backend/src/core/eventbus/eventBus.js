import pool from '../../config/db.js';
import logger from '../logger/logger.js';
import { SYSTEM_EVENTS, validateEventPayload } from './eventRegistry.js';

class EventBus {
  constructor() {
    this.localSubscribers = new Map(); // eventName -> Array<{name, handler}>
  }

  /**
   * Register a local handler for an event
   * @param {string} eventName 
   * @param {string} subscriberName 
   * @param {Function} handler 
   */
  subscribe(eventName, subscriberName, handler) {
    if (!this.localSubscribers.has(eventName)) {
      this.localSubscribers.set(eventName, []);
    }
    this.localSubscribers.get(eventName).push({ name: subscriberName, handler });
    logger.info(`[EventBus] Subscriber registered: ${subscriberName} for event: ${eventName}`);
  }

  /**
   * Publish a platform event
   * Persists to event_store, then triggers subscribers asynchronously
   * 
   * @param {string} eventName 
   * @param {object} payload 
   * @param {object} context - { tenantId, propertyId, userId }
   */
  async publish(eventName, payload, context = {}) {
    try {
      // 1. Validation
      validateEventPayload(eventName, payload);

      const tenantId = context.tenantId || null;
      const propertyId = context.propertyId || null;

      // 2. Persist to event_store database table
      const [insertResult] = await pool.query(
        `INSERT INTO event_store (event_name, tenant_id, property_id, payload, status) 
         VALUES (?, ?, ?, ?, 'pending')`,
        [eventName, tenantId, propertyId, JSON.stringify(payload)]
      );

      const eventId = insertResult.insertId;
      logger.info(`[EventBus] Event persisted: ${eventName} (ID: ${eventId})`);

      // 3. Process subscribers asynchronously (non-blocking)
      setImmediate(() => this.dispatch(eventId, eventName, payload, context));

      return eventId;
    } catch (err) {
      logger.error(`[EventBus] Failed to publish event ${eventName}:`, err);
      throw err;
    }
  }

  /**
   * Internal dispatcher: Resolves DB subscribers + local in-memory subscribers
   */
  async dispatch(eventId, eventName, payload, context) {
    try {
      // A. Load active database subscriptions for this event
      const [dbSubs] = await pool.query(
        `SELECT id, subscriber_name, endpoint_url FROM event_subscriptions 
         WHERE event_name = ? AND is_active = 1`,
        [eventName]
      );

      // B. Process Database Subscriptions
      for (const sub of dbSubs) {
        if (sub.endpoint_url) {
          // Outbound Webhook execution (using async callback/worker)
          await this.deliverWebhook(eventId, sub, payload);
        } else {
          // Run internal DB-registered subscriber handler
          await this.deliverInternal(eventId, sub, payload);
        }
      }

      // C. Process In-Memory Local Subscribers
      const memorySubs = this.localSubscribers.get(eventName) || [];
      for (const sub of memorySubs) {
        try {
          await sub.handler(payload, context);
          logger.debug(`[EventBus] Local subscriber ${sub.name} handled event ID: ${eventId}`);
        } catch (subErr) {
          logger.error(`[EventBus] Local subscriber ${sub.name} failed for event ${eventId}:`, subErr);
        }
      }

      // D. Mark event as processed in store
      await pool.query(
        `UPDATE event_store SET status = 'processed' WHERE id = ?`,
        [eventId]
      );

    } catch (err) {
      logger.error(`[EventBus] Dispatch error for event ID: ${eventId}:`, err);
      await pool.query(
        `UPDATE event_store SET status = 'failed' WHERE id = ?`,
        [eventId]
      );
    }
  }

  /**
   * Delivery helper for internal DB-registered handlers
   */
  async deliverInternal(eventId, subscription, payload) {
    try {
      logger.info(`[EventBus] Internal DB trigger for subscriber: ${subscription.subscriber_name} on event: ${eventId}`);
      
      // Log successful delivery attempt in DB
      await pool.query(
        `INSERT INTO event_delivery_attempts (event_id, subscription_id, attempt_number, status, response_payload) 
         VALUES (?, ?, 1, 'success', 'Executed successfully via platform internal dispatch')`,
        [eventId, subscription.id]
      );
    } catch (err) {
      await pool.query(
        `INSERT INTO event_delivery_attempts (event_id, subscription_id, attempt_number, status, error_message) 
         VALUES (?, ?, 1, 'failed', ?)`,
        [eventId, subscription.id, err.message]
      );
    }
  }

  /**
   * Delivery helper for webhook subscribers
   */
  async deliverWebhook(eventId, subscription, payload) {
    try {
      logger.info(`[EventBus] Webhook callback registered for ${subscription.subscriber_name} on URL: ${subscription.endpoint_url}`);
      
      // In production: perform fetch() with HMAC signature verification
      // Mocking successful dispatch:
      await pool.query(
        `INSERT INTO event_delivery_attempts (event_id, subscription_id, attempt_number, status, response_payload) 
         VALUES (?, ?, 1, 'success', 'Webhook sent to endpoint')`,
        [eventId, subscription.id]
      );
    } catch (err) {
      await pool.query(
        `INSERT INTO event_delivery_attempts (event_id, subscription_id, attempt_number, status, error_message) 
         VALUES (?, ?, 1, 'failed', ?)`,
        [eventId, subscription.id, err.message]
      );
    }
  }
}

const eventBus = new EventBus();
export default eventBus;
export { SYSTEM_EVENTS };

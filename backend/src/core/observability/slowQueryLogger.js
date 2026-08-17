import pool from '../../config/db.js';
import logger from '../logger/logger.js';

class SlowQueryLogger {
  constructor() {
    this.thresholdMs = 100; // Log any query taking longer than 100ms
  }

  /**
   * Monitor query duration and persist if it is slow
   * 
   * @param {string} sql 
   * @param {number} durationMs 
   */
  async checkAndLog(sql, durationMs) {
    if (durationMs >= this.thresholdMs) {
      logger.warn(`[SlowQuery] Query took ${durationMs}ms: ${sql.trim().substring(0, 200)}...`);
      try {
        // Run direct insert bypassing the pool check logic
        await pool.query(
          `INSERT INTO slow_queries (query_text, duration_ms) VALUES (?, ?)`,
          [sql, durationMs]
        );
      } catch (err) {
        logger.error(`[SlowQueryLogger] Failed to write slow query to DB:`, err.message);
      }
    }
  }
}

const slowQueryLogger = new SlowQueryLogger();
export default slowQueryLogger;

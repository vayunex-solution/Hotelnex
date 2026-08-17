import pool from '../../config/db.js';
import logger from '../logger/logger.js';

class MetricCollector {
  /**
   * Tracks a system metric in system_metrics database table
   * @param {string} name 
   * @param {number} value 
   * @param {object} tags 
   */
  async trackMetric(name, value, tags = {}) {
    try {
      logger.debug(`[Metrics] ${name}: ${value} | Tags: ${JSON.stringify(tags)}`);
      await pool.query(
        `INSERT INTO system_metrics (metric_name, value, tags_json) VALUES (?, ?, ?)`,
        [name, value, JSON.stringify(tags)]
      );
    } catch (err) {
      logger.error(`[Metrics] Failed to log metric ${name}:`, err.message);
    }
  }

  /**
   * Middleware to log response time of API requests
   */
  requestTimer() {
    return (req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.trackMetric('http_request_duration_ms', duration, {
          method: req.method,
          path: req.baseUrl + req.path,
          statusCode: res.statusCode
        });
      });
      next();
    };
  }
}

const metricCollector = new MetricCollector();
export default metricCollector;

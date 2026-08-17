import pool from '../../config/db.js';
import logger from '../logger/logger.js';

export const healthCheckHandler = async (req, res) => {
  const status = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      storage: 'unknown'
    }
  };

  try {
    // 1. Verify DB
    const start = Date.now();
    await pool.query('SELECT 1');
    status.services.database = `healthy (latency: ${Date.now() - start}ms)`;
  } catch (err) {
    status.services.database = `unhealthy: ${err.message}`;
  }

  // 2. Verify Storage configuration
  const hasS3 = !!(
    process.env.S3_ENDPOINT &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET_NAME
  );
  status.services.storage = hasS3 ? 'configured' : 'unconfigured';

  const isHealthy = !status.services.database.includes('unhealthy');

  res.status(isHealthy ? 200 : 500).json({
    success: isHealthy,
    ...status
  });
};

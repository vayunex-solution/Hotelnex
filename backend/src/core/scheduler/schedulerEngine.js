import pool from '../../config/db.js';
import logger from '../logger/logger.js';

class SchedulerEngine {
  constructor() {
    this.jobs = new Map(); // jobType -> handlerFunction
    this.intervalId = null;
  }

  /**
   * Register a job type and execution handler
   */
  registerJob(jobType, handler) {
    this.jobs.set(jobType, handler);
    logger.info(`[SchedulerEngine] Job registered: ${jobType}`);
  }

  /**
   * Starts the scheduler interval checking loop
   */
  start(tickIntervalMs = 60000) {
    if (this.intervalId) return;
    
    logger.info(`[SchedulerEngine] Starting job scheduler loop (interval: ${tickIntervalMs}ms)`);
    this.intervalId = setInterval(() => this.tick(), tickIntervalMs);
    
    // Run an initial tick shortly after startup
    setTimeout(() => this.tick(), 5000);
  }

  /**
   * Stop the scheduler loop
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info(`[SchedulerEngine] Job scheduler loop stopped.`);
    }
  }

  /**
   * Scans DB for due scheduled jobs and executes them
   */
  async tick() {
    try {
      // Find active scheduled jobs where next_run_at is due (or null/unset)
      const [dueJobs] = await pool.query(
        `SELECT id, name, job_type, cron_expression, payload 
         FROM scheduled_jobs 
         WHERE is_active = 1 AND (next_run_at IS NULL OR next_run_at <= NOW())`
      );

      for (const job of dueJobs) {
        const handler = this.jobs.get(job.job_type);
        if (!handler) {
          logger.warn(`[SchedulerEngine] No handler registered for job type: ${job.job_type} (Job name: ${job.name})`);
          continue;
        }

        // Execute job in background
        setImmediate(() => this.executeJob(job, handler));
      }
    } catch (err) {
      logger.error(`[SchedulerEngine] Error during scheduler poll tick:`, err.message);
    }
  }

  /**
   * Runs the job handler, logs execution metrics, and schedules the next run
   */
  async executeJob(job, handler) {
    const t0 = Date.now();
    logger.info(`[SchedulerEngine] Executing job: ${job.name} (type: ${job.job_type})`);
    
    // Set status/lock so other nodes don't execute it
    const nextRun = this.calculateNextRun(job.cron_expression);
    await pool.query(
      `UPDATE scheduled_jobs SET last_run_at = NOW(), next_run_at = ? WHERE id = ?`,
      [nextRun, job.id]
    );

    try {
      const payload = job.payload ? (typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload) : {};
      await handler(payload);
      
      logger.info(`[SchedulerEngine] Job ${job.name} completed successfully in ${Date.now() - t0}ms`);
    } catch (err) {
      logger.error(`[SchedulerEngine] Job ${job.name} failed:`, err.message);
      
      // Log failure in failed_jobs table
      await pool.query(
        `INSERT INTO failed_jobs (job_id, queue, job_type, payload, exception) 
         VALUES (?, 'scheduler', ?, ?, ?)`,
        [job.id, job.job_type, JSON.stringify(job.payload || {}), err.stack || err.message]
      );
    }
  }

  /**
   * Helper to parse simple cron expressions and return next Date
   */
  calculateNextRun(cronExpression) {
    const now = new Date();
    
    // Simple hourly schedule parser: e.g. "0 * * * *"
    if (cronExpression === '0 * * * *') {
      const next = new Date(now);
      next.setHours(now.getHours() + 1, 0, 0, 0);
      return next;
    }
    
    // Simple daily schedule parser: e.g. "0 2 * * *" (daily at 2am)
    if (cronExpression === '0 2 * * *') {
      const next = new Date(now);
      next.setHours(2, 0, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }

    // Default fallback: schedule next run in 5 minutes
    const fallback = new Date(now.getTime() + 5 * 60 * 1000);
    return fallback;
  }
}

const schedulerEngine = new SchedulerEngine();
export default schedulerEngine;

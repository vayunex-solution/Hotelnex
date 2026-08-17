import pool from '../../config/db.js';
import logger from '../logger/logger.js';
import eventBus from '../eventbus/eventBus.js';
import crypto from 'crypto';

class ProvisioningEngine {
  constructor() {
    this.workerId = `worker-${crypto.randomBytes(4).toString('hex')}`;
  }

  async acquireLock(jobId) {
    const [result] = await pool.query(
      `UPDATE provisioning_jobs 
       SET locked_by = ?, locked_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND locked_by IS NULL`,
      [this.workerId, jobId]
    );
    return result.affectedRows > 0;
  }

  async releaseLock(jobId) {
    await pool.query('UPDATE provisioning_jobs SET locked_by = NULL, locked_at = NULL WHERE id = ?', [jobId]);
  }

  async log(jobId, stepId, level, message) {
    await pool.query(
      `INSERT INTO provisioning_logs (job_id, step_id, log_level, message) VALUES (?, ?, ?, ?)`,
      [jobId, stepId, level, message]
    );
    if (level === 'ERROR') logger.error(`[ProvisionJob:${jobId}] ${message}`);
    else logger.info(`[ProvisionJob:${jobId}] ${message}`);
  }

  async startJob(propertyId, tenantId, createdBy) {
    const idempotencyKey = `prov-${propertyId}-${tenantId}`;
    
    // Check for existing job
    const [existing] = await pool.query('SELECT id FROM provisioning_jobs WHERE idempotency_key = ?', [idempotencyKey]);
    if (existing.length > 0) return existing[0].id;

    const [jobRes] = await pool.query(
      `INSERT INTO provisioning_jobs (property_id, tenant_id, idempotency_key, created_by) 
       VALUES (?, ?, ?, ?)`,
      [propertyId, tenantId, idempotencyKey, createdBy]
    );
    const jobId = jobRes.insertId;

    // Pre-populate steps
    const [defs] = await pool.query('SELECT id FROM provisioning_step_definitions ORDER BY step_order ASC');
    for (const def of defs) {
      await pool.query(
        `INSERT INTO provisioning_steps (job_id, step_definition_id) VALUES (?, ?)`,
        [jobId, def.id]
      );
    }
    
    eventBus.publish('ProvisioningJobCreated', { jobId, propertyId });
    
    // Trigger background execution asynchronously (no await)
    this.processJob(jobId).catch(err => logger.error('Process job error:', err));
    return jobId;
  }

  async resumeJob(jobId) {
    this.processJob(jobId).catch(err => logger.error('Resume job error:', err));
  }

  async processJob(jobId) {
    const locked = await this.acquireLock(jobId);
    if (!locked) {
      logger.warn(`[ProvisioningEngine] Job ${jobId} is already locked by another worker.`);
      return;
    }

    try {
      await pool.query(
        `UPDATE provisioning_jobs SET status = 'Running', started_at = COALESCE(started_at, CURRENT_TIMESTAMP) WHERE id = ?`,
        [jobId]
      );
      eventBus.publish('ProvisioningStarted', { jobId });
      await this.log(jobId, null, 'INFO', 'Provisioning job started.');

      // Fetch pending steps
      const [steps] = await pool.query(
        `SELECT s.id, d.step_name, d.handler_name, d.timeout_seconds, d.retry_limit, s.retry_count 
         FROM provisioning_steps s
         JOIN provisioning_step_definitions d ON s.step_definition_id = d.id
         WHERE s.job_id = ? AND s.status IN ('Pending', 'Failed')
         ORDER BY d.step_order ASC`,
        [jobId]
      );

      let jobFailed = false;

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        
        await pool.query(
          `UPDATE provisioning_steps SET status = 'Running', started_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [step.id]
        );
        await this.log(jobId, step.id, 'INFO', `Starting step: ${step.step_name}`);
        eventBus.publish('ProvisioningStepStarted', { jobId, stepId: step.id, stepName: step.step_name });

        const startTime = Date.now();
        let stepOutput = null;
        let stepError = null;

        try {
          stepOutput = await this.executeStepHandler(step, jobId);
        } catch (err) {
          stepError = err.message;
        }

        const executionTime = Date.now() - startTime;

        if (stepError) {
          await this.log(jobId, step.id, 'ERROR', `Step failed: ${stepError}`);
          await pool.query(
            `UPDATE provisioning_steps 
             SET status = 'Failed', error_message = ?, retry_count = retry_count + 1, execution_time_ms = ?, completed_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [stepError, executionTime, step.id]
          );
          eventBus.publish('ProvisioningStepFailed', { jobId, stepId: step.id, error: stepError });
          jobFailed = true;
          break; // Strict halt on failure
        } else {
          await this.log(jobId, step.id, 'INFO', `Step completed successfully.`);
          await pool.query(
            `UPDATE provisioning_steps 
             SET status = 'Success', output_json = ?, execution_time_ms = ?, completed_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [JSON.stringify(stepOutput || {}), executionTime, step.id]
          );
          eventBus.publish('ProvisioningStepCompleted', { jobId, stepId: step.id });
          
          // Update overall progress
          const progress = Math.round(((i + 1) / 13) * 100);
          await pool.query('UPDATE provisioning_jobs SET progress_percent = ? WHERE id = ?', [progress, jobId]);
        }
      }

      if (jobFailed) {
        await pool.query(`UPDATE provisioning_jobs SET status = 'Failed' WHERE id = ?`, [jobId]);
        await this.log(jobId, null, 'ERROR', 'Provisioning job halted due to step failure.');
        eventBus.publish('ProvisioningFailed', { jobId });
      } else {
        await pool.query(`UPDATE provisioning_jobs SET status = 'Completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`, [jobId]);
        await this.log(jobId, null, 'INFO', 'Provisioning job completed successfully.');
        eventBus.publish('ProvisioningCompleted', { jobId });
      }

    } catch (err) {
      await this.log(jobId, null, 'ERROR', `Engine fatal error: ${err.message}`);
    } finally {
      await this.releaseLock(jobId);
    }
  }

  async executeStepHandler(step, jobId) {
    return new Promise((resolve, reject) => {
      let settled = false;
      
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error(`Step timed out after ${step.timeout_seconds} seconds`));
        }
      }, step.timeout_seconds * 1000);

      // Simulate dynamic handler execution
      // In a real system, we'd map step.handler_name to a class/module
      setTimeout(async () => {
        if (settled) return;
        
        try {
          if (step.handler_name === 'queueWelcomeEmail' && process.env.TEST_FAIL_STEP_11 === 'true') {
            throw new Error('Simulated failure for Step 11');
          }

          if (step.handler_name === 'markPropertyReady') {
            const [job] = await pool.query('SELECT property_id FROM provisioning_jobs WHERE id = ?', [jobId]);
            const [readyStatus] = await pool.query("SELECT id FROM property_statuses WHERE name = 'Ready'");
            await pool.query('UPDATE hotels SET status_id = ? WHERE id = ?', [readyStatus[0].id, job[0].property_id]);
          }
          
          settled = true;
          clearTimeout(timer);
          resolve({ status: 'ok', detail: `Executed ${step.handler_name}` });
        } catch (e) {
          settled = true;
          clearTimeout(timer);
          reject(e);
        }
      }, 1500); // Simulated delay for each step
    });
  }
}

export default new ProvisioningEngine();

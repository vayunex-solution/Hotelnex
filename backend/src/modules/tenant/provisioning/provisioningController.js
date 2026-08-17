import pool from '../../../config/db.js';
import ProvisioningEngine from '../../../core/provisioning/ProvisioningEngine.js';

export const startProvisioning = async (req, res) => {
  const propertyId = req.params.id;
  const tenantId = req.user.tenantId;
  const userId = req.user.userId;

  try {
    const jobId = await ProvisioningEngine.startJob(propertyId, tenantId, userId);
    res.status(202).json({ success: true, message: 'Provisioning started.', jobId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProvisioningStatus = async (req, res) => {
  const propertyId = req.params.id;
  const tenantId = req.user.tenantId;

  try {
    const [jobs] = await pool.query(
      `SELECT * FROM provisioning_jobs WHERE property_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 1`,
      [propertyId, tenantId]
    );

    if (jobs.length === 0) {
      return res.status(404).json({ success: false, message: 'No provisioning job found.' });
    }

    const job = jobs[0];

    const [steps] = await pool.query(
      `SELECT s.*, d.step_name, d.description, d.step_order 
       FROM provisioning_steps s
       JOIN provisioning_step_definitions d ON s.step_definition_id = d.id
       WHERE s.job_id = ?
       ORDER BY d.step_order ASC`,
      [job.id]
    );

    const [logs] = await pool.query(
      `SELECT * FROM provisioning_logs WHERE job_id = ? ORDER BY created_at ASC`,
      [job.id]
    );

    res.json({ success: true, data: { job, steps, logs } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const retryFailedStep = async (req, res) => {
  const propertyId = req.params.id;
  const tenantId = req.user.tenantId;
  
  try {
    const [jobs] = await pool.query('SELECT id, status FROM provisioning_jobs WHERE property_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 1', [propertyId, tenantId]);
    if (jobs.length === 0) return res.status(404).json({ success: false, message: 'Job not found' });
    
    if (jobs[0].status !== 'Failed') {
      return res.status(400).json({ success: false, message: 'Job is not in a failed state.' });
    }

    await pool.query('UPDATE provisioning_jobs SET status = "Retrying" WHERE id = ?', [jobs[0].id]);
    ProvisioningEngine.resumeJob(jobs[0].id);

    res.json({ success: true, message: 'Retrying failed step.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelProvisioning = async (req, res) => {
  const propertyId = req.params.id;
  const tenantId = req.user.tenantId;

  try {
    const [jobs] = await pool.query('SELECT id, status FROM provisioning_jobs WHERE property_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 1', [propertyId, tenantId]);
    if (jobs.length === 0) return res.status(404).json({ success: false, message: 'Job not found' });
    
    if (jobs[0].status === 'Completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel completed job.' });
    }

    await pool.query('UPDATE provisioning_jobs SET status = "Cancelled" WHERE id = ?', [jobs[0].id]);
    res.json({ success: true, message: 'Job cancelled.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resumeProvisioning = async (req, res) => {
  const propertyId = req.params.id;
  const tenantId = req.user.tenantId;

  try {
    const [jobs] = await pool.query('SELECT id, status FROM provisioning_jobs WHERE property_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 1', [propertyId, tenantId]);
    if (jobs.length === 0) return res.status(404).json({ success: false, message: 'Job not found' });
    
    if (['Completed', 'Running'].includes(jobs[0].status)) {
      return res.status(400).json({ success: false, message: 'Job cannot be resumed.' });
    }

    await pool.query('UPDATE provisioning_jobs SET status = "Pending" WHERE id = ?', [jobs[0].id]);
    ProvisioningEngine.resumeJob(jobs[0].id);

    res.json({ success: true, message: 'Job resumed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

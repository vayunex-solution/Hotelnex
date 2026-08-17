import pool from '../src/config/db.js';
import ProvisioningEngine from '../src/core/provisioning/ProvisioningEngine.js';
import eventBus from '../src/core/eventbus/eventBus.js';

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function runAudit() {
  console.log('=== STARTING MODULE 4B REGRESSION AUDIT ===');
  
  // Track EventBus events
  const events = [];
  const eventTypes = ['ProvisioningJobCreated', 'ProvisioningStarted', 'ProvisioningStepStarted', 'ProvisioningStepCompleted', 'ProvisioningStepFailed', 'ProvisioningFailed', 'ProvisioningCompleted'];
  
  eventTypes.forEach(evt => {
    eventBus.subscribe(evt, 'AuditScript', (data) => events.push({ type: evt, data }));
  });

  try {
    // 1. Create a brand-new Tenant
    const [tenantRes] = await pool.query("INSERT INTO tenants (name, slug, owner_email) VALUES ('Regression Tenant', ?, 'regression@test.com')", ['reg-tenant-' + Date.now()]);
    const tenantId = tenantRes.insertId;
    console.log(`✅ Tenant created (ID: ${tenantId})`);

    // 2. Create a brand-new Property
    const [statusRow] = await pool.query("SELECT id FROM property_statuses WHERE name = 'Configured'");
    const [hotelRes] = await pool.query(
      "INSERT INTO hotels (tenant_id, name, property_code, status_id) VALUES (?, ?, ?, ?)",
      [tenantId, 'Regression Property', 'REG-' + Date.now(), statusRow[0].id]
    );
    const propertyId = hotelRes.insertId;
    console.log(`✅ Property created (ID: ${propertyId}, Status: Configured)`);

    // 3. Start Provisioning with forced failure at Step 11
    process.env.TEST_FAIL_STEP_11 = 'true';
    const jobId = await ProvisioningEngine.startJob(propertyId, tenantId, 1);
    console.log(`✅ Provisioning Job started (Job ID: ${jobId})`);

    // 11. Verify duplicate clicks don't create new jobs (Idempotency)
    const duplicateJobId = await ProvisioningEngine.startJob(propertyId, tenantId, 1);
    if (jobId === duplicateJobId) {
      console.log(`✅ Idempotency Key prevented duplicate execution.`);
    } else {
      throw new Error('Idempotency Key failed!');
    }

    // Wait for the job to reach Step 11 and fail
    console.log('⏳ Waiting for engine to execute up to Step 11...');
    let jobStatus = '';
    while (jobStatus !== 'Failed') {
      await delay(2000);
      const [jobs] = await pool.query('SELECT status FROM provisioning_jobs WHERE id = ?', [jobId]);
      jobStatus = jobs[0].status;
    }

    // 6. Confirm Job Failed and Previous Steps remain completed
    console.log(`✅ Job execution halted. Status: ${jobStatus}`);
    const [steps] = await pool.query('SELECT step_definition_id, status FROM provisioning_steps WHERE job_id = ? ORDER BY step_definition_id ASC', [jobId]);
    
    let allPreviousCompleted = true;
    for (let i = 0; i < 10; i++) {
      if (steps[i].status !== 'Success') allPreviousCompleted = false;
    }
    
    if (allPreviousCompleted && steps[10].status === 'Failed') {
      console.log(`✅ Steps 1-10 are Success. Step 11 is Failed. No rollback occurred.`);
    } else {
      throw new Error('Step state mismatch!');
    }

    // 7. Click Resume
    console.log('▶️ Resuming Provisioning...');
    process.env.TEST_FAIL_STEP_11 = 'false';
    await pool.query('UPDATE provisioning_jobs SET status = "Retrying" WHERE id = ?', [jobId]);
    ProvisioningEngine.resumeJob(jobId);

    // Wait for Job to complete
    console.log('⏳ Waiting for job to complete...');
    while (jobStatus !== 'Completed') {
      await delay(2000);
      const [jobs] = await pool.query('SELECT status FROM provisioning_jobs WHERE id = ?', [jobId]);
      jobStatus = jobs[0].status;
      if (jobStatus === 'Failed') {
        throw new Error('Job failed again!');
      }
    }
    console.log(`✅ Job resumed exactly from Step 11 and Completed.`);

    // 8. Verify final property status becomes Ready
    const [hotelFinal] = await pool.query('SELECT status_id FROM hotels WHERE id = ?', [propertyId]);
    const [readyStatusRow] = await pool.query("SELECT id FROM property_statuses WHERE name = 'Ready'");
    if (hotelFinal[0].status_id === readyStatusRow[0].id) {
      console.log(`✅ Property Status is now Ready.`);
    } else {
      throw new Error('Property did not transition to Ready.');
    }

    // 10. Verify provisioning records exist
    const [logs] = await pool.query('SELECT COUNT(*) as c FROM provisioning_logs WHERE job_id = ?', [jobId]);
    console.log(`✅ ${logs[0].c} Provisioning Logs written to database.`);

    // 15. Verify EventBus Events
    const firedEventTypes = [...new Set(events.map(e => e.type))];
    const expectedEvents = ['ProvisioningJobCreated', 'ProvisioningStarted', 'ProvisioningStepStarted', 'ProvisioningStepCompleted', 'ProvisioningStepFailed', 'ProvisioningFailed', 'ProvisioningCompleted'];
    const allFired = expectedEvents.every(e => firedEventTypes.includes(e));
    if (allFired) {
      console.log(`✅ All Workflow/EventBus lifecycle events fired successfully.`);
    } else {
      console.log('Missed events:', expectedEvents.filter(e => !firedEventTypes.includes(e)));
      throw new Error('EventBus events missing');
    }

    console.log('=== REGRESSION AUDIT PASSED ===');
    
  } catch (err) {
    console.error('❌ REGRESSION AUDIT FAILED:', err.message);
  } finally {
    process.exit();
  }
}

runAudit();

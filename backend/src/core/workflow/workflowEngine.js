import pool from '../../config/db.js';
import logger from '../logger/logger.js';

class WorkflowEngine {
  constructor() {
    this.actionRegistry = new Map();
  }

  /**
   * Register a custom executable action handler
   * @param {string} actionType 
   * @param {Function} handlerFn - async function(payload, context, stepConfig)
   */
  registerAction(actionType, handlerFn) {
    this.actionRegistry.set(actionType, handlerFn);
    logger.info(`[WorkflowEngine] Action handler registered: ${actionType}`);
  }

  /**
   * Evaluates and executes workflows for a given trigger event
   * 
   * @param {string} triggerEvent - e.g. 'BookingCheckedIn'
   * @param {string} entityType - e.g. 'booking'
   * @param {number|string} entityId 
   * @param {object} context - { tenantId, propertyId, userId }
   */
  async trigger(triggerEvent, entityType, entityId, context = {}) {
    logger.info(`[WorkflowEngine] Triggered workflows for event: ${triggerEvent} | Entity: ${entityType}:${entityId}`);
    
    const tenantId = context.tenantId || null;
    const propertyId = context.propertyId || null;

    try {
      // 1. Fetch matching active workflows (tenant-specific or global platform default)
      const [workflows] = await pool.query(
        `SELECT id, name FROM workflows 
         WHERE trigger_event = ? AND is_active = 1 AND (tenant_id = ? OR tenant_id IS NULL)
         ORDER BY tenant_id DESC`,
        [triggerEvent, tenantId]
      );

      if (!workflows || workflows.length === 0) {
        logger.debug(`[WorkflowEngine] No active workflows found for trigger: ${triggerEvent}`);
        return;
      }

      for (const flow of workflows) {
        logger.info(`[WorkflowEngine] Executing workflow: ${flow.name} (ID: ${flow.id})`);
        
        // 2. Fetch steps ordered by step_order
        const [steps] = await pool.query(
          `SELECT id, step_order, action_type, configuration_json FROM workflow_steps 
           WHERE workflow_id = ? ORDER BY step_order ASC`,
          [flow.id]
        );

        if (!steps || steps.length === 0) {
          logger.warn(`[WorkflowEngine] Workflow ${flow.name} has no steps configured.`);
          continue;
        }

        // 3. Create workflow run log
        const [runResult] = await pool.query(
          `INSERT INTO workflow_runs (workflow_id, entity_type, entity_id, status, started_at) 
           VALUES (?, ?, ?, 'running', CURRENT_TIMESTAMP)`,
          [flow.id, entityType, entityId]
        );
        const runId = runResult.insertId;

        // 4. Sequentially execute steps
        let workflowFailed = false;
        for (const step of steps) {
          const stepConfig = step.configuration_json ? (typeof step.configuration_json === 'string' ? JSON.parse(step.configuration_json) : step.configuration_json) : {};
          const actionType = step.action_type;

          logger.info(`[WorkflowEngine] Executing Step ${step.step_order} (${actionType}) on Workflow Run ${runId}`);

          // Create step run log
          const [stepRunResult] = await pool.query(
            `INSERT INTO workflow_step_runs (run_id, step_id, status) VALUES (?, ?, 'pending')`,
            [runId, step.id]
          );
          const stepRunId = stepRunResult.insertId;

          const actionHandler = this.actionRegistry.get(actionType);
          if (!actionHandler) {
            const errorMsg = `No action handler registered for type: ${actionType}`;
            logger.error(`[WorkflowEngine] ${errorMsg}`);
            
            await pool.query(
              `UPDATE workflow_step_runs SET status = 'failed', error_message = ?, executed_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [errorMsg, stepRunId]
            );
            workflowFailed = true;
            break;
          }

          try {
            // Invoke actual execution handler
            const payload = { entityType, entityId, flowId: flow.id, runId, stepOrder: step.step_order };
            const result = await actionHandler(payload, context, stepConfig);

            await pool.query(
              `UPDATE workflow_step_runs SET status = 'success', executed_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [stepRunId]
            );
          } catch (stepErr) {
            logger.error(`[WorkflowEngine] Step ${step.step_order} failed:`, stepErr.message);
            await pool.query(
              `UPDATE workflow_step_runs SET status = 'failed', error_message = ?, executed_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [stepErr.message, stepRunId]
            );
            workflowFailed = true;
            break; // Stop sequential execution on step failure
          }
        }

        // 5. Update final workflow run status
        const finalStatus = workflowFailed ? 'failed' : 'completed';
        await pool.query(
          `UPDATE workflow_runs SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [finalStatus, runId]
        );
        logger.info(`[WorkflowEngine] Workflow ${flow.name} run ${runId} finished with status: ${finalStatus}`);
      }

    } catch (err) {
      logger.error(`[WorkflowEngine] Global workflow trigger error:`, err);
    }
  }
}

const workflowEngine = new WorkflowEngine();
export default workflowEngine;

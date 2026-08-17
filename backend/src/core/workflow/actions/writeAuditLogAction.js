import pool from '../../../config/db.js';
import logger from '../../logger/logger.js';

/**
 * Workflow action handler for writing audit log records
 */
export const writeAuditLogAction = async (payload, context, stepConfig) => {
  logger.info(`[WorkflowAction] writeAuditLogAction executing.`);
  const tenantId = context.tenantId || null;
  const propertyId = context.propertyId || null;
  const userId = context.userId || null;
  
  await pool.query(
    `INSERT INTO audit_logs (tenant_id, property_id, user_id, action, target_table, target_id, new_value)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      propertyId,
      userId,
      'WORKFLOW_AUTO_AUDIT',
      payload.entityType,
      payload.entityId.toString(),
      JSON.stringify({ workflowRunId: payload.runId, stepOrder: payload.stepOrder })
    ]
  );
  return { success: true };
};

import logger from '../../logger/logger.js';

/**
 * Workflow action handler for notifying housekeeping
 */
export const notifyHousekeepingAction = async (payload, context, stepConfig) => {
  logger.info(`[WorkflowAction] notifyHousekeepingAction executing for room status update.`);
  // In a real module, this would trigger an internal housekeeping notification/task creation
  return { success: true };
};

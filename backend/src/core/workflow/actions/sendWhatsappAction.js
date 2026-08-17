import logger from '../../logger/logger.js';

/**
 * Workflow action handler for sending WhatsApp notification
 */
export const sendWhatsappAction = async (payload, context, stepConfig) => {
  logger.info(`[WorkflowAction] sendWhatsappAction executing. Sending WhatsApp message via configured template.`);
  // In a real module, this would enqueue a message in notification_queue
  return { success: true, messageId: `WA-MOCK-${Date.now()}` };
};

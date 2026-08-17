import emailService from '../../email/EmailService.js';
import logger from '../../logger/logger.js';

/**
 * Workflow action to enqueue an email.
 * This ensures emails are triggered via the Workflow Engine / Event Bus, and never directly from controllers.
 */
export const sendEmailAction = async (payload, context) => {
  try {
    const { templateName, toEmail, emailPayload, sendAfter } = payload;
    
    if (!templateName || !toEmail) {
      throw new Error('sendEmailAction requires templateName and toEmail in payload');
    }

    const queueId = await emailService.enqueueEmail(templateName, toEmail, emailPayload || {}, sendAfter);
    
    if (queueId) {
      logger.info(`sendEmailAction: Successfully enqueued email to \${toEmail} using template \${templateName}`);
    } else {
      logger.warn(`sendEmailAction: Email template \${templateName} might be inactive.`);
    }

    return { success: true, queueId };
  } catch (error) {
    logger.error('sendEmailAction failed:', { error: error.message });
    throw error;
  }
};

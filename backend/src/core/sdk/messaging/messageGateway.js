import logger from '../../logger/logger.js';

/**
 * Message Gateway Interface
 */
export class MessageGateway {
  async send(recipient, body, subject = null) {
    throw new Error('Method not implemented.');
  }
}

/**
 * Concrete SendGrid Email Adapter
 */
export class SendGridEmailAdapter extends MessageGateway {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.name = 'SendGrid';
  }

  async send(recipient, body, subject) {
    logger.info(`[SendGridSDK] Sending email to ${recipient} | Subject: ${subject}`);
    return { success: true, messageId: `sg_msg_${Math.random().toString(36).substring(2, 10)}` };
  }
}

/**
 * Concrete WATI WhatsApp Adapter
 */
export class WatiWhatsAppAdapter extends MessageGateway {
  constructor(apiEndpoint, apiKey) {
    super();
    this.apiEndpoint = apiEndpoint;
    this.apiKey = apiKey;
    this.name = 'WATI';
  }

  async send(recipient, body) {
    logger.info(`[WatiSDK] Sending WhatsApp to ${recipient} | Msg: ${body}`);
    return { success: true, messageId: `wati_msg_${Math.random().toString(36).substring(2, 10)}` };
  }
}

/**
 * Concrete Twilio SMS Adapter
 */
export class TwilioSmsAdapter extends MessageGateway {
  constructor(accountSid, authToken) {
    super();
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.name = 'TwilioSMS';
  }

  async send(recipient, body) {
    logger.info(`[TwilioSDK] Sending SMS to ${recipient} | Msg: ${body}`);
    return { success: true, messageId: `tw_sms_${Math.random().toString(36).substring(2, 10)}` };
  }
}

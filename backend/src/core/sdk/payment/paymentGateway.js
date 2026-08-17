import logger from '../../logger/logger.js';

/**
 * Abstract Payment Gateway Interface
 */
export class PaymentGateway {
  async processPayment(amount, currency, source) {
    throw new Error('Method not implemented.');
  }

  async processRefund(transactionId, amount) {
    throw new Error('Method not implemented.');
  }
}

/**
 * Concrete Stripe Payment Gateway Adapter
 */
export class StripeAdapter extends PaymentGateway {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.name = 'Stripe';
  }

  async processPayment(amount, currency, source) {
    logger.info(`[StripeSDK] Charging ${amount} ${currency} using token: ${source}`);
    // Simulate API charge call
    return {
      success: true,
      transactionId: `ch_stripe_${Math.random().toString(36).substring(2, 10)}`,
      amount,
      currency
    };
  }

  async processRefund(transactionId, amount) {
    logger.info(`[StripeSDK] Refunding charge ${transactionId} with amount ${amount}`);
    return {
      success: true,
      refundId: `re_stripe_${Math.random().toString(36).substring(2, 10)}`
    };
  }
}

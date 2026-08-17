import logger from '../logger/logger.js';

/**
 * Interface definition for document OCR parsing providers
 */
export class DocumentOcrInterface {
  async parseDocument(fileBuffer, mimeType) {
    throw new Error('Method not implemented.');
  }
}

/**
 * Interface definition for revenue / dynamic pricing forecasting
 */
export class PricingPredictionInterface {
  async predictOptimalPrice(propertyId, roomCategoryId, date) {
    throw new Error('Method not implemented.');
  }
}

/**
 * Abstract AI Engine registry manager
 */
class AIEngine {
  constructor() {
    this.ocrProvider = null;
    this.pricingProvider = null;
  }

  registerOcrProvider(providerInstance) {
    this.ocrProvider = providerInstance;
    logger.info(`[AIEngine] OCR Provider registered.`);
  }

  registerPricingProvider(providerInstance) {
    this.pricingProvider = providerInstance;
    logger.info(`[AIEngine] Pricing Prediction Provider registered.`);
  }

  async parseKYCDocument(fileBuffer, mimeType) {
    if (!this.ocrProvider) {
      logger.warn('[AIEngine] parseKYCDocument called but no OCR Provider is active. Falling back to default mock.');
      return {
        success: true,
        documentType: 'Aadhaar',
        documentNumber: 'XXXX-XXXX-1234',
        extractedData: { name: 'Extracted Guest Name', dob: '1990-01-01' }
      };
    }
    return this.ocrProvider.parseDocument(fileBuffer, mimeType);
  }

  async predictPricing(propertyId, roomCategoryId, date) {
    if (!this.pricingProvider) {
      logger.warn('[AIEngine] predictPricing called but no Pricing Provider is active. Falling back to default mock.');
      return {
        optimalPrice: 2499.00,
        confidenceScore: 0.85,
        factors: { occupancyRate: 0.75, demandIndex: 'medium' }
      };
    }
    return this.pricingProvider.predictOptimalPrice(propertyId, roomCategoryId, date);
  }
}

const aiEngine = new AIEngine();
export default aiEngine;

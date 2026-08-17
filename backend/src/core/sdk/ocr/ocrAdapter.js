import logger from '../../logger/logger.js';

/**
 * OCR Document Parser Interface
 */
export class OcrAdapter {
  async extractDocumentDetails(fileBuffer, mimeType) {
    throw new Error('Method not implemented.');
  }
}

/**
 * Concrete AWS Textract Adapter
 */
export class AwsTextractAdapter extends OcrAdapter {
  constructor(credentials) {
    super();
    this.credentials = credentials;
    this.name = 'AWSTextract';
  }

  async extractDocumentDetails(fileBuffer, mimeType) {
    logger.info(`[AwsTextractSDK] Parsing document buffer...`);
    // Simulate AWS Textract extraction response
    return {
      success: true,
      documentType: 'Aadhaar',
      documentNumber: '1234-5678-9012',
      extractedData: {
        name: 'Grand Vayunex Guest',
        dob: '1985-06-15',
        gender: 'Male',
        address: 'Vayunex Tower, Pune, India'
      }
    };
  }
}

import pool from '../../config/db.js';
import logger from '../logger/logger.js';
import { uploadToS3, getSignedFileUrl } from '../../config/s3.js';

class StorageEngine {
  /**
   * Upload a file and register it in stored_files
   * 
   * @param {Buffer} fileBuffer 
   * @param {string} originalName 
   * @param {string} mimeType 
   * @param {object} context - { tenantId, propertyId, entityType, entityId, userId }
   */
  async upload(fileBuffer, originalName, mimeType, context = {}) {
    try {
      logger.info(`[StorageEngine] Uploading file: ${originalName} (${mimeType})`);

      // 1. Execute upload via S3 (reusing config/s3.js)
      const fileKey = await uploadToS3(fileBuffer, originalName, mimeType);
      
      const tenantId = context.tenantId || null;
      const propertyId = context.propertyId || null;
      const entityType = context.entityType || 'document';
      const entityId = context.entityId || 0;
      const userId = context.userId || null;
      
      // Calculate file size in KB (buffer length / 1024)
      const fileSizeKb = Math.ceil(fileBuffer.length / 1024);

      // Generate public URL format (falls back to bucket endpoints)
      const url = `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${fileKey}`;

      // 2. Fetch default active storage provider from database
      const [providers] = await pool.query(
        `SELECT id FROM storage_providers WHERE is_default = 1 LIMIT 1`
      );
      const providerId = providers[0]?.id || null;

      // 3. Register file metadata in stored_files registry table
      const [insertResult] = await pool.query(
        `INSERT INTO stored_files (tenant_id, property_id, provider_id, entity_type, entity_id, file_name, file_path, file_size_kb, mime_type, url, uploaded_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, propertyId, providerId, entityType, entityId, originalName, fileKey, fileSizeKb, mimeType, url, userId]
      );

      const fileId = insertResult.insertId;
      logger.info(`[StorageEngine] Upload registered in DB. ID: ${fileId} | Key: ${fileKey}`);

      return {
        id: fileId,
        key: fileKey,
        url,
        fileName: originalName
      };
    } catch (err) {
      logger.error(`[StorageEngine] Upload failed:`, err.message);
      throw err;
    }
  }

  /**
   * Retrieves access url (pre-signed if remote) for a registered file key
   * @param {string} fileKey 
   * @returns {Promise<string>}
   */
  async getAccessUrl(fileKey) {
    if (!fileKey) return null;
    return getSignedFileUrl(fileKey);
  }
}

const storageEngine = new StorageEngine();
export default storageEngine;

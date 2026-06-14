import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import path from 'path';

const hasS3Config = !!(
  process.env.S3_ENDPOINT &&
  process.env.S3_ACCESS_KEY_ID &&
  process.env.S3_SECRET_ACCESS_KEY &&
  process.env.S3_BUCKET_NAME
);

const s3Client = hasS3Config ? new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  region: process.env.S3_REGION || 'auto',
}) : null;

/**
 * Uploads a file buffer to S3-compatible storage (e.g. Backblaze B2).
 * @param {Buffer} fileBuffer
 * @param {string} originalName
 * @param {string} mimeType
 * @returns {Promise<string>} The uploaded file's unique key.
 */
export const uploadToS3 = async (fileBuffer, originalName, mimeType) => {
  if (!hasS3Config) {
    throw new Error('S3-compatible storage is not configured. Please add S3 credentials to .env file.');
  }

  const uniqueSuffix = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName);
  const key = `${Date.now()}-${uniqueSuffix}${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);
  return key;
};

/**
 * Generates a temporary pre-signed URL to view/download a file.
 * @param {string} key
 * @returns {Promise<string>} The pre-signed URL (or original path if it's local).
 */
export const getSignedFileUrl = async (key) => {
  if (!key) return null;

  // Return local paths as-is to preserve compatibility with legacy files
  if (key.startsWith('/') || key.startsWith('http')) {
    return key;
  }

  if (!hasS3Config) {
    console.warn('[S3] getSignedFileUrl called but S3 is not fully configured.');
    return null;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
    });

    // Generate link valid for 1 hour
    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  } catch (error) {
    console.error(`[S3] Error generating signed URL for key ${key}:`, error.message);
    return null;
  }
};

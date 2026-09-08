const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const cloudinaryConfig = require('../../config/cloudinary.config');
const { ApiError, CloudinaryError } = require('../../utils/apiError');
const { logger } = require('../../utils/logger');

// Configure Cloudinary v2 SDK
cloudinary.config(cloudinaryConfig);

// Supported image MIME types for Gemini AI vision
const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
]);

/**
 * Normalizes and validates an image URL before downloading
 * @param {string} rawUrl - Image URL
 * @returns {URL} Validated URL instance
 */
const validateAndNormalizeUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw ApiError.badRequest('Image URL is missing or invalid', 'INVALID_IMAGE_URL');
  }

  const trimmed = rawUrl.trim().replace(/^["']|["']$/g, '');

  let parsedUrl;
  try {
    parsedUrl = new URL(trimmed);
  } catch (err) {
    throw ApiError.badRequest(`Malformed image URL: ${trimmed}`, 'INVALID_IMAGE_URL');
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw ApiError.badRequest('Image URL must use HTTP or HTTPS protocol', 'INVALID_IMAGE_URL');
  }

  // Prevent local/internal URIs
  if (
    parsedUrl.hostname === 'localhost' ||
    parsedUrl.hostname === '127.0.0.1' ||
    parsedUrl.protocol === 'file:' ||
    parsedUrl.protocol === 'blob:' ||
    parsedUrl.protocol === 'data:'
  ) {
    throw ApiError.badRequest(
      `Image URL cannot be a local or internal URI: ${parsedUrl.hostname}`,
      'INVALID_IMAGE_URL'
    );
  }

  return parsedUrl;
};

/**
 * Downloads image from Cloudinary URL, validates HTTP response & MIME type,
 * and converts to buffer/base64 inline data format for Gemini AI.
 *
 * @param {string} imageUrl - Cloudinary HTTPS URL
 * @param {number} [timeoutMs=15000] - Download timeout in milliseconds
 * @returns {Promise<{ buffer: Buffer, base64Data: string, mimeType: string, sizeBytes: number }>}
 */
const downloadImageFromCloudinary = async (imageUrl, timeoutMs = 15000) => {
  const parsedUrl = validateAndNormalizeUrl(imageUrl);
  const cleanUrl = parsedUrl.toString();

  logger.info(`Fetching leaf image from Cloudinary CDN [host: ${parsedUrl.hostname}]`);

  let response;
  try {
    response = await axios.get(cleanUrl, {
      responseType: 'arraybuffer',
      timeout: timeoutMs,
      headers: {
        Accept: 'image/jpeg,image/png,image/webp,image/*;q=0.8'
      },
      maxContentLength: 15 * 1024 * 1024, // 15MB limit
      validateStatus: () => true // Handle status codes explicitly
    });
  } catch (err) {
    const errorMsg = err.message || 'Unknown network error';
    logger.error(`Network error while fetching Cloudinary image [host: ${parsedUrl.hostname}]: ${errorMsg}`);

    if (err.code === 'ECONNABORTED' || errorMsg.includes('timeout')) {
      throw new CloudinaryError('Cloudinary image download timed out', 'CLOUDINARY_IMAGE_FETCH_FAILED');
    }
    throw new CloudinaryError(`Failed to connect to Cloudinary: ${errorMsg}`, 'CLOUDINARY_IMAGE_FETCH_FAILED');
  }

  const { status, headers, data } = response;
  const rawContentType = headers['content-type'] || '';
  const contentLength = headers['content-length'] || (data ? data.length : 0);

  // Safe diagnostic logging (NEVER logs credentials or secrets)
  logger.info(`Cloudinary response received [host: ${parsedUrl.hostname}, status: ${status}, content-type: ${rawContentType}, content-length: ${contentLength}]`);

  // Classify HTTP response errors
  if (status === 404) {
    logger.warn(`Cloudinary image not found (404) at URL host: ${parsedUrl.hostname}`);
    throw ApiError.notFound('Cloudinary image not found: resource does not exist (HTTP 404)', 'CLOUDINARY_IMAGE_NOT_FOUND');
  }

  if (status === 401 || status === 403) {
    logger.warn(`Cloudinary image access denied (${status}) at URL host: ${parsedUrl.hostname}`);
    throw ApiError.forbidden(`Cloudinary image access forbidden (HTTP ${status}): check asset permissions or signed delivery`, 'CLOUDINARY_ACCESS_DENIED');
  }

  if (status === 400) {
    logger.warn(`Cloudinary image bad request (400) at URL host: ${parsedUrl.hostname}`);
    throw ApiError.badRequest('Invalid Cloudinary image transformation or delivery request (HTTP 400)', 'INVALID_IMAGE_RESPONSE');
  }

  if (status >= 500) {
    logger.error(`Cloudinary CDN returned server error (${status})`);
    throw new CloudinaryError(`Cloudinary server error (HTTP ${status})`, 'CLOUDINARY_SERVER_ERROR');
  }

  if (status !== 200) {
    throw new CloudinaryError(`Unexpected HTTP status ${status} fetching Cloudinary image`, 'CLOUDINARY_IMAGE_FETCH_FAILED');
  }

  // Validate image data buffer
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (!buffer || buffer.length === 0) {
    logger.error(`Cloudinary returned empty response payload for URL host: ${parsedUrl.hostname}`);
    throw ApiError.unprocessableEntity('Cloudinary returned empty image payload (0 bytes)', 'INVALID_IMAGE_RESPONSE');
  }

  // Validate Content-Type
  const cleanContentType = rawContentType.split(';')[0].trim().toLowerCase();
  let finalMimeType = cleanContentType;

  if (!finalMimeType.startsWith('image/')) {
    // Attempt sniffing from magic bytes if Content-Type was generic (e.g. application/octet-stream)
    if (buffer.length >= 4) {
      if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        finalMimeType = 'image/jpeg';
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        finalMimeType = 'image/png';
      } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
        finalMimeType = 'image/webp';
      }
    }

    if (!finalMimeType.startsWith('image/')) {
      logger.error(`Non-image Content-Type received from Cloudinary: ${rawContentType}`);
      throw ApiError.badRequest(
        `Cloudinary response is not an image (Content-Type: ${rawContentType})`,
        'INVALID_IMAGE_RESPONSE'
      );
    }
  }

  if (finalMimeType === 'image/jpg') {
    finalMimeType = 'image/jpeg';
  }

  if (!SUPPORTED_MIME_TYPES.has(finalMimeType)) {
    logger.warn(`Unsupported image MIME type: ${finalMimeType}`);
    throw ApiError.badRequest(
      `Unsupported image format: ${finalMimeType}. Supported formats: JPEG, PNG, WebP, HEIC`,
      'UNSUPPORTED_IMAGE_FORMAT'
    );
  }

  const base64Data = buffer.toString('base64');

  logger.info(`Cloudinary image validated successfully [size: ${buffer.length} bytes, mime: ${finalMimeType}]`);

  return {
    buffer,
    base64Data,
    mimeType: finalMimeType,
    sizeBytes: buffer.length
  };
};

const getCloudinaryInstance = () => cloudinary;

module.exports = {
  cloudinary,
  getCloudinaryInstance,
  SUPPORTED_MIME_TYPES,
  validateAndNormalizeUrl,
  downloadImageFromCloudinary
};

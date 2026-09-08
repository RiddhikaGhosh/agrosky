const cloudinary = require('cloudinary').v2;
const cloudinaryConfig = require('../config/cloudinary.config');
const cloudinaryAssetRepository = require('../repositories/cloudinaryAsset.repository');
const farmService = require('./farm.service');
const cropService = require('./crop.service');
const { NotFoundError, AuthorizationError, CloudinaryError } = require('../utils/apiError');
const { logger } = require('../utils/logger');

// Initialize Cloudinary configuration
cloudinary.config(cloudinaryConfig);

class CloudinaryService {
  /**
   * Required Cloudinary transformations for agricultural leaf images:
   * - width: 800
   * - height: 600
   * - crop mode: fit (c_fit)
   * - sharpen: 50 (e_sharpen:50)
   * - auto contrast (e_auto_contrast)
   * - automatic quality (q_auto)
   * - automatic format (f_auto)
   */
  getTransformationOptions() {
    return [
      { width: 800, height: 600, crop: 'fit' },
      { effect: 'sharpen:50' },
      { effect: 'auto_contrast' },
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ];
  }

  getTransformationString() {
    return 'c_fit,h_600,w_800/e_sharpen:50/e_auto_contrast/f_auto/q_auto';
  }

  /**
   * Generates a signed Cloudinary upload signature for client-side secure upload
   */
  async generateUploadSignature(userId, farmId, cropId, userRole = 'farmer') {
    try {
      // Verify farm and crop ownership
      await farmService.getFarmById(userId, farmId, userRole);
      await cropService.getCropById(userId, cropId, userRole);

      const timestamp = Math.round(new Date().getTime() / 1000);
      const folder = `agroassist/farmers/${userId}/farms/${farmId}/crops/${cropId}`;
      const eager = this.getTransformationString();

      const paramsToSign = {
        timestamp,
        folder,
        eager
      };

      // Sign payload using Cloudinary API Secret (kept strictly on server)
      const signature = cloudinary.utils.api_sign_request(paramsToSign, cloudinaryConfig.api_secret);

      return {
        signature,
        timestamp,
        apiKey: cloudinaryConfig.api_key,
        cloudName: cloudinaryConfig.cloud_name,
        folder,
        eager,
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
        maxFileSize: 10485760 // 10MB
      };
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error(`Cloudinary signature generation failed: ${error.message}`);
      throw new CloudinaryError(`Failed to generate upload signature: ${error.message}`, 'CLOUDINARY_UPLOAD_FAILED');
    }
  }

  /**
   * Generates the optimized Cloudinary CDN URL applying required transformations
   */
  generateOptimizedUrl(publicId) {
    if (!publicId) return null;
    return cloudinary.url(publicId, {
      transformation: this.getTransformationOptions(),
      secure: true
    });
  }

  /**
   * Uploads an image (base64 data URI, file path, or remote URL) directly to Cloudinary from the server
   */
  async uploadImage(fileOrDataUri, options = {}) {
    try {
      const defaultOptions = {
        folder: options.folder || 'agroassist/scans',
        resource_type: 'image',
        transformation: this.getTransformationOptions()
      };
      const result = await cloudinary.uploader.upload(fileOrDataUri, {
        ...defaultOptions,
        ...options
      });
      return result;
    } catch (error) {
      logger.error(`Cloudinary direct server upload failed: ${error.message}`);
      throw new CloudinaryError(`Cloudinary upload failed: ${error.message}`, 'CLOUDINARY_UPLOAD_FAILED');
    }
  }

  /**
   * Stores Cloudinary asset metadata in MySQL transactional database
   */
  async registerAssetMetadata(userId, assetPayload, userRole = 'farmer') {
    const farm_id = assetPayload.farm_id || assetPayload.farmId || null;
    const crop_id = assetPayload.crop_id || assetPayload.cropId || null;
    const {
      public_id,
      original_url,
      optimized_url,
      secure_url,
      resource_type = 'image',
      annotated_url = null,
      width = 800,
      height = 600,
      format = 'jpg'
    } = assetPayload;

    if (farm_id) await farmService.getFarmById(userId, farm_id, userRole);
    if (crop_id) await cropService.getCropById(userId, crop_id, userRole);

    const finalOriginalUrl = original_url || secure_url;
    // Prefer actual Cloudinary secure_url or optimized_url if provided; fallback to URL generation
    const finalOptimizedUrl = optimized_url || secure_url || (public_id ? this.generateOptimizedUrl(public_id) : null) || finalOriginalUrl;

    return cloudinaryAssetRepository.create({
      user_id: userId,
      farm_id,
      crop_id,
      public_id,
      resource_type,
      original_url: finalOriginalUrl,
      optimized_url: finalOptimizedUrl,
      annotated_url,
      width,
      height,
      format
    });
  }

  /**
   * Retrieves asset metadata by ID after ownership verification
   */
  async getAssetById(userId, assetId, userRole = 'farmer') {
    const asset = await cloudinaryAssetRepository.findById(assetId);
    if (!asset) {
      throw new NotFoundError(`Cloudinary asset not found with ID: ${assetId}`, 'ASSET_NOT_FOUND');
    }

    if (asset.user_id !== userId && userRole !== 'admin') {
      throw new AuthorizationError('Forbidden: You do not own this image asset', 'UNAUTHORIZED_ASSET_ACCESS');
    }

    return asset;
  }

  /**
   * Deletes asset from Cloudinary media storage and removes MySQL metadata record
   */
  async deleteAsset(userId, assetId, userRole = 'farmer') {
    const asset = await this.getAssetById(userId, assetId, userRole);

    // Destroy asset on Cloudinary CDN
    try {
      await cloudinary.uploader.destroy(asset.public_id, {
        resource_type: asset.resource_type || 'image',
        invalidate: true
      });
      logger.info(`Cloudinary asset destroyed from CDN: ${asset.public_id}`);
    } catch (error) {
      logger.warn(`Cloudinary CDN removal warning for public_id ${asset.public_id}: ${error.message}`);
    }

    // Delete MySQL metadata record
    await cloudinaryAssetRepository.delete(assetId);
    return { assetId, public_id: asset.public_id };
  }
}

module.exports = new CloudinaryService();

const farmService = require('./farm.service');
const cropService = require('./crop.service');
const cloudinaryService = require('./cloudinary.service');
const diseaseAnalysisRepository = require('../repositories/diseaseAnalysis.repository');
const recommendationRepository = require('../repositories/recommendation.repository');
const snowflakeService = require('./snowflake.service');
const { analyzeLeafImageWithGemini } = require('../integrations/gemini/geminiClient');
const { parseAndValidateGeminiResponse } = require('../validators/analysis.validator');
const ApiError = require('../utils/apiError');
const { logger } = require('../utils/logger');

class GeminiService {
  /**
   * Orchestrates the 13-step AI crop disease diagnosis process
   */
  async analyzeCropDisease(userId, farmId, cropId, cloudinaryAssetId, userRole = 'farmer', directImageUrl = null) {
    // 1-3. Verify farm, crop, and asset ownership
    const farm = await farmService.getFarmById(userId, farmId, userRole);
    const crop = await cropService.getCropById(userId, cropId, userRole);
    let asset = null;
    let imageUrl = directImageUrl;

    if (cloudinaryAssetId) {
      asset = await cloudinaryService.getAssetById(userId, cloudinaryAssetId, userRole);
      imageUrl = asset.optimized_url || asset.original_url || imageUrl;
    }

    if (!imageUrl) {
      throw ApiError.badRequest('No image URL or Cloudinary asset provided for analysis', 'INVALID_IMAGE_URL');
    }

    // 6. Assemble agricultural context
    const cropContext = {
      crop_name: crop.crop_name,
      crop_variety: crop.crop_variety,
      location: farm.location
    };

    // 7-9. Call Gemini AI API with image & prompt
    let rawResponse;
    try {
      const geminiRes = await analyzeLeafImageWithGemini(imageUrl, cropContext);
      rawResponse = geminiRes.rawResponse;
    } catch (err) {
      if (asset && asset.original_url && asset.original_url !== imageUrl && (err.errorCode === 'CLOUDINARY_IMAGE_NOT_FOUND' || err.statusCode === 404)) {
        logger.warn(`Optimized URL 404, falling back to original_url: ${asset.original_url}`);
        imageUrl = asset.original_url;
        const geminiRes = await analyzeLeafImageWithGemini(imageUrl, cropContext);
        rawResponse = geminiRes.rawResponse;
      } else {
        throw err;
      }
    }

    // 10-11. Validate Gemini AI response strictly against schema
    const validated = parseAndValidateGeminiResponse(rawResponse);

    // 12. Store validated operational result in MySQL
    const analysisRecord = await diseaseAnalysisRepository.create({
      user_id: userId,
      farm_id: farmId,
      crop_id: cropId,
      cloudinary_asset_id: asset ? asset.id : (cloudinaryAssetId || null),
      disease_name: validated.diseaseName,
      confidence_score: validated.confidenceScore,
      severity: validated.severity,
      environmental_risk_level: validated.environmentalRiskLevel,
      symptoms: validated.symptoms,
      recommendations: validated.recommendations,
      prevention_steps: validated.preventionSteps,
      treatment_suggestions: validated.treatmentSuggestions,
      gemini_raw_response: { raw: rawResponse },
      analysis_status: 'completed'
    });

    // Asynchronously trigger Snowflake data warehouse sync (non-blocking)
    snowflakeService.syncOperationalDataToSnowflake('DISEASE_ANALYSIS', analysisRecord);

    // Store individual recommendations in recommendations table
    if (Array.isArray(validated.recommendations)) {
      for (const recText of validated.recommendations) {
        await recommendationRepository.create({
          disease_analysis_id: analysisRecord.id,
          farm_id: farmId,
          crop_id: cropId,
          recommendation_type: 'action',
          recommendation_text: recText,
          priority: validated.severity === 'high' ? 'high' : 'medium'
        });
      }
    }

    logger.info(`Successfully stored disease analysis ID ${analysisRecord.id} for Crop ${cropId}`);

    // 13. Return clean structured output (hiding raw provider details)
    return {
      id: analysisRecord.id,
      farmId: analysisRecord.farm_id,
      cropId: analysisRecord.crop_id,
      cloudinaryAssetId: analysisRecord.cloudinary_asset_id,
      diseaseName: validated.diseaseName,
      confidenceScore: validated.confidenceScore,
      severity: validated.severity,
      environmentalRiskLevel: validated.environmentalRiskLevel,
      symptoms: validated.symptoms,
      recommendations: validated.recommendations,
      preventionSteps: validated.preventionSteps,
      treatmentSuggestions: validated.treatmentSuggestions,
      createdAt: analysisRecord.created_at
    };
  }

  async getAnalysisById(userId, analysisId, userRole = 'farmer') {
    const analysis = await diseaseAnalysisRepository.findById(analysisId);
    if (!analysis) {
      throw ApiError.notFound(`Disease analysis record not found with ID: ${analysisId}`, 'ANALYSIS_NOT_FOUND');
    }

    if (analysis.user_id !== userId && userRole !== 'admin') {
      throw ApiError.forbidden('Forbidden: You do not own this analysis record', 'UNAUTHORIZED_ANALYSIS_ACCESS');
    }

    return analysis;
  }

  /**
   * Retrieves paginated, filtered analysis history for a farm
   */
  async getFarmAnalysisHistory(userId, farmId, queryOptions = {}, userRole = 'farmer') {
    // Validate farm ownership
    await farmService.getFarmById(userId, farmId, userRole);

    const { page = 1, limit = 10, sortBy = 'created_at', order = 'DESC', disease, severity, riskLevel, startDate, endDate } = queryOptions;
    const offset = (page - 1) * limit;

    const { items, totalItems } = await diseaseAnalysisRepository.findHistoryPaginated({
      farmId,
      disease,
      severity,
      riskLevel,
      startDate,
      endDate,
      sortBy,
      order,
      limit,
      offset
    });

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalItems,
        totalPages
      }
    };
  }

  /**
   * Retrieves paginated, filtered analysis history for a specific crop
   */
  async getCropAnalysisHistory(userId, cropId, queryOptions = {}, userRole = 'farmer') {
    // Validate crop ownership
    await cropService.getCropById(userId, cropId, userRole);

    const { page = 1, limit = 10, sortBy = 'created_at', order = 'DESC', disease, severity, riskLevel, startDate, endDate } = queryOptions;
    const offset = (page - 1) * limit;

    const { items, totalItems } = await diseaseAnalysisRepository.findHistoryPaginated({
      cropId,
      disease,
      severity,
      riskLevel,
      startDate,
      endDate,
      sortBy,
      order,
      limit,
      offset
    });

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalItems,
        totalPages
      }
    };
  }
}

module.exports = new GeminiService();

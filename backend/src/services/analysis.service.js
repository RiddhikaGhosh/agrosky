const { randomUUID } = require('crypto');
const farmService = require('./farm.service');
const cropService = require('./crop.service');
const cloudinaryService = require('./cloudinary.service');
const weatherService = require('./weather.service');
const riskService = require('./risk.service');
const recommendationService = require('./recommendation.service');
const snowflakeService = require('./snowflake.service');
const diseaseAnalysisRepository = require('../repositories/diseaseAnalysis.repository');
const recommendationRepository = require('../repositories/recommendation.repository');
const { analyzeLeafImageWithGemini } = require('../integrations/gemini/geminiClient');
const { parseAndValidateGeminiResponse } = require('../validators/analysis.validator');
const { withTransaction } = require('../database/mysql');
const ApiError = require('../utils/apiError');
const { logger } = require('../utils/logger');

class AnalysisService {
  /**
   * Master 14-Step Orchestrator connecting Cloudinary, Gemini, Weather, Risk Engine, MySQL, & Snowflake
   */
  async executeCompleteAnalysis(userId, farmId, cropId, cloudinaryAssetId, userRole = 'farmer', directImageUrl = null) {
    const traceId = randomUUID();
    logger.info(`Starting Master 14-Step Disease Analysis Pipeline [TraceID: ${traceId}]`);

    // STEP 1-4: Authenticate & Validate Farm, Crop, and Cloudinary Asset Ownership
    const farm = await farmService.getFarmById(userId, farmId, userRole);
    const crop = await cropService.getCropById(userId, cropId, userRole);

    let asset = null;
    let targetImageUrl = directImageUrl;

    if (cloudinaryAssetId) {
      asset = await cloudinaryService.getAssetById(userId, cloudinaryAssetId, userRole);
      targetImageUrl = asset.optimized_url || asset.original_url || targetImageUrl;
    } else if (targetImageUrl) {
      try {
        asset = await cloudinaryService.registerAssetMetadata(userId, {
          farm_id: farmId,
          crop_id: cropId,
          public_id: `crop_${cropId}_${Date.now()}`,
          original_url: targetImageUrl,
          optimized_url: targetImageUrl,
          resource_type: 'image'
        }, userRole);
      } catch (assetRegErr) {
        logger.warn(`[TraceID: ${traceId}] Auto-registering asset metadata skipped: ${assetRegErr.message}`);
      }
    }

    if (!targetImageUrl) {
      throw ApiError.badRequest('No image URL or Cloudinary asset provided for analysis', 'INVALID_IMAGE_URL');
    }

    // STEP 6: Retrieve Crop & Farm context
    const cropContext = {
      crop_name: crop.crop_name,
      crop_variety: crop.crop_variety,
      location: farm.location
    };

    // STEP 7: Retrieve Current Weather (graceful fallback if API or coordinates unavailable)
    let weatherObservation = null;
    try {
      weatherObservation = await weatherService.getCurrentWeather(userId, farmId, userRole);
    } catch (weatherError) {
      logger.warn(`[TraceID: ${traceId}] Weather API observation unavailable: ${weatherError.message}`);
    }

    // STEP 8-9: Send Image to Gemini AI & Validate Response strictly
    let rawResponse;
    try {
      const geminiResult = await analyzeLeafImageWithGemini(targetImageUrl, cropContext);
      rawResponse = geminiResult.rawResponse;
    } catch (err) {
      // If optimized transformed URL fails with 404, fallback to asset's original secure_url
      if (asset && asset.original_url && asset.original_url !== targetImageUrl && (err.errorCode === 'CLOUDINARY_IMAGE_NOT_FOUND' || err.statusCode === 404)) {
        logger.warn(`[TraceID: ${traceId}] Optimized URL failed with 404, falling back to original_url: ${asset.original_url}`);
        targetImageUrl = asset.original_url;
        const geminiResult = await analyzeLeafImageWithGemini(targetImageUrl, cropContext);
        rawResponse = geminiResult.rawResponse;
      } else {
        throw err;
      }
    }
    const validatedGemini = parseAndValidateGeminiResponse(rawResponse);

    // STEP 10: Calculate Agricultural Risk Score & Level
    const riskAssessment = await riskService.calculateCropRisk(userId, cropId, userRole);

    // STEP 11: Synthesize Actionable Recommendations via Gemini AI
    let recommendationResult = null;
    try {
      recommendationResult = await recommendationService.generateRecommendations(
        userId, farmId, cropId, asset ? asset.id : null, 'en', userRole
      );
    } catch (recErr) {
      logger.warn(`[TraceID: ${traceId}] Recommendation synthesis warning: ${recErr.message}`);
      recommendationResult = {
        recommendations: validatedGemini.recommendations || [],
        preventionSteps: validatedGemini.preventionSteps || [],
        treatmentSuggestions: validatedGemini.treatmentSuggestions || [],
        timingSuggestions: ['Follow local agricultural authority guidelines']
      };
    }

    // STEP 12: Store Complete Operational Analysis Atomically in MySQL
    let analysisRecord;
    try {
      analysisRecord = await withTransaction(async (conn) => {
        return diseaseAnalysisRepository.create({
          user_id: userId,
          farm_id: farmId,
          crop_id: cropId,
          cloudinary_asset_id: asset ? asset.id : (cloudinaryAssetId || null),
          disease_name: validatedGemini.diseaseName,
          confidence_score: validatedGemini.confidenceScore,
          severity: validatedGemini.severity,
          environmental_risk_level: validatedGemini.environmentalRiskLevel,
          symptoms: validatedGemini.symptoms,
          recommendations: validatedGemini.recommendations,
          prevention_steps: validatedGemini.preventionSteps,
          treatment_suggestions: validatedGemini.treatmentSuggestions,
          gemini_raw_response: { raw: rawResponse, traceId },
          analysis_status: 'completed'
        }, conn);
      });
    } catch (dbError) {
      logger.error(`[TraceID: ${traceId}] MySQL transaction failed: ${dbError.message}`);
      throw ApiError.internal('Failed to persist operational analysis in database', 'DATABASE_TRANSACTION_FAILED');
    }

    // STEP 13: Asynchronously Synchronize Historical Data to Snowflake Data Warehouse
    try {
      snowflakeService.syncOperationalDataToSnowflake('DISEASE_ANALYSIS', analysisRecord);
    } catch (sfErr) {
      logger.warn(`[TraceID: ${traceId}] Background Snowflake sync logged as pending/failed: ${sfErr.message}`);
    }

    // STEP 14: Return Clean Traced Response
    return {
      traceId,
      analysisId: analysisRecord.id,
      analysis: {
        id: analysisRecord.id,
        diseaseName: validatedGemini.diseaseName,
        confidenceScore: validatedGemini.confidenceScore,
        severity: validatedGemini.severity,
        environmentalRiskLevel: validatedGemini.environmentalRiskLevel,
        symptoms: validatedGemini.symptoms,
        preventionSteps: validatedGemini.preventionSteps,
        treatmentSuggestions: validatedGemini.treatmentSuggestions,
        createdAt: analysisRecord.created_at
      },
      weather: weatherObservation ? {
        temperature: weatherObservation.temperature,
        humidity: weatherObservation.humidity,
        rainfall: weatherObservation.rainfall,
        windSpeed: weatherObservation.windSpeed,
        weatherCondition: weatherObservation.weatherCondition,
        rainProbability: weatherObservation.rainProbability
      } : null,
      risk: {
        riskScore: riskAssessment.riskScore,
        riskLevel: riskAssessment.riskLevel,
        riskFactors: riskAssessment.riskFactors
      },
      recommendations: {
        items: recommendationResult.recommendations || validatedGemini.recommendations,
        preventionSteps: recommendationResult.preventionSteps || validatedGemini.preventionSteps,
        treatmentSuggestions: recommendationResult.treatmentSuggestions || validatedGemini.treatmentSuggestions,
        timingSuggestions: recommendationResult.timingSuggestions || []
      },
      image: {
        assetId: asset ? asset.id : (cloudinaryAssetId || null),
        publicId: asset ? asset.public_id : null,
        optimizedUrl: targetImageUrl
      }
    };
  }
}

module.exports = new AnalysisService();

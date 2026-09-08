const Joi = require('joi');
const { ApiError, GeminiError, ValidationError } = require('../utils/apiError');
const { logger } = require('../utils/logger');

const idSchema = Joi.alternatives().try(
  Joi.number().integer().positive(),
  Joi.string().trim().min(1)
);

const diseaseAnalysisRequestSchema = Joi.object({
  farmId: idSchema,
  farm_id: idSchema,
  cropId: idSchema,
  crop_id: idSchema,
  cloudinaryAssetId: idSchema.optional(),
  cloudinary_asset_id: idSchema.optional(),
  imageUrl: Joi.string().uri().optional(),
  image_url: Joi.string().uri().optional(),
  secure_url: Joi.string().uri().optional()
})
.or('farmId', 'farm_id')
.or('cropId', 'crop_id')
.or('cloudinaryAssetId', 'cloudinary_asset_id', 'imageUrl', 'image_url', 'secure_url');

const geminiResponseSchema = Joi.object({
  diseaseName: Joi.string().trim().min(2).max(255).required(),
  confidenceScore: Joi.number().min(0).max(100).required(),
  severity: Joi.string().valid('low', 'medium', 'high').required(),
  environmentalRiskLevel: Joi.string().valid('low', 'medium', 'high').required(),
  symptoms: Joi.array().items(Joi.string().trim()).min(1).required(),
  recommendations: Joi.array().items(Joi.string().trim()).min(1).required(),
  preventionSteps: Joi.array().items(Joi.string().trim()).min(1).required(),
  treatmentSuggestions: Joi.array().items(Joi.string().trim()).min(1).required()
}).unknown();

const historyQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('created_at', 'confidence_score', 'severity', 'disease_name').default('created_at'),
  order: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC'),
  disease: Joi.string().trim().max(100).allow(null, ''),
  severity: Joi.string().valid('low', 'medium', 'high').allow(null, ''),
  riskLevel: Joi.string().valid('low', 'medium', 'high', 'critical').allow(null, ''),
  startDate: Joi.date().iso().allow(null, ''),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).allow(null, '').messages({
    'date.min': 'End date must be on or after start date'
  })
});

const parseAndValidateGeminiResponse = (rawText) => {
  let parsed;

  try {
    let cleanText = rawText.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```(json)?/, '').replace(/```$/, '').trim();
    }
    parsed = JSON.parse(cleanText);
  } catch (error) {
    logger.error(`Failed to parse Gemini JSON output: ${error.message}. Raw text: ${rawText}`);
    throw new GeminiError('Malformed AI response output. Invalid JSON returned.', 'AI_ANALYSIS_ERROR', 422);
  }

  const { value: validated, error } = geminiResponseSchema.validate(parsed, { abortEarly: false });

  if (error) {
    const errorDetails = error.details.map((d) => d.message).join(', ');
    logger.error(`Gemini AI response failed schema validation: ${errorDetails}`);
    throw new GeminiError(`Malformed AI response structure: ${errorDetails}`, 'AI_ANALYSIS_ERROR', 422);
  }

  return validated;
};

module.exports = {
  diseaseAnalysisRequestSchema,
  geminiResponseSchema,
  historyQuerySchema,
  parseAndValidateGeminiResponse
};

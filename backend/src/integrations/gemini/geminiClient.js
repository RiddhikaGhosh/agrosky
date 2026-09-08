const { GoogleGenerativeAI } = require('@google/generative-ai');
const geminiConfig = require('../../config/gemini.config');
const { downloadImageFromCloudinary } = require('../cloudinary');
const { logger } = require('../../utils/logger');
const { ApiError, GeminiError } = require('../../utils/apiError');

const genAI = new GoogleGenerativeAI(geminiConfig.apiKey);

/**
 * Fetches image from Cloudinary URL and converts to base64 inline data format for Gemini API.
 * Validates HTTP response, image bytes, and MIME types.
 */
const fetchImageAsInlineData = async (imageUrl, timeoutMs = 15000) => {
  try {
    const { base64Data, mimeType } = await downloadImageFromCloudinary(imageUrl, timeoutMs);
    return {
      inlineData: {
        data: base64Data,
        mimeType
      }
    };
  } catch (error) {
    // Preserve specialized operational errors (e.g. 404, 403, 415)
    if (error.isOperational) {
      throw error;
    }
    logger.error(`Failed to download image from Cloudinary URL: ${error.message}`);
    throw ApiError.badRequest('Unable to fetch image from Cloudinary for AI analysis', 'IMAGE_FETCH_FAILED');
  }
};

/**
 * Checks if a Gemini API error is transient and can be retried
 */
const isTransientError = (err) => {
  if (!err) return false;
  if (err.message === 'GEMINI_TIMEOUT') return true;

  const status = err.status || (err.response && err.response.status);
  // 429: Rate limit, 500/502/503/504: Google server transient errors
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }

  const msg = (err.message || '').toLowerCase();
  if (
    msg.includes('high demand') ||
    msg.includes('service unavailable') ||
    msg.includes('resource exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('network')
  ) {
    return true;
  }

  return false;
};

/**
 * Executes Gemini generative content call with timeout and max retries
 */
const analyzeLeafImageWithGemini = async (imageUrl, cropContext, maxRetries = 2, timeoutMs = 45000) => {
  // 1. Download and validate the leaf image ONCE before entering retry loop
  // Permanent errors (404, invalid URL, bad format) will fail fast here without wastefully retrying
  const imageInlineData = await fetchImageAsInlineData(imageUrl);

  const modelName = geminiConfig.modelName || 'gemini-2.5-flash';
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2
    }
  });

  const prompt = `
You are an expert agricultural plant pathologist and crop disease specialist.
Analyze the attached crop/leaf image carefully.

Crop Context:
- Crop Name: ${cropContext.crop_name}
- Crop Variety: ${cropContext.crop_variety || 'Not specified'}
- Farm Location: ${cropContext.location || 'Not specified'}

You MUST return your diagnosis in STRICT JSON format with EXACTLY the following keys:
{
  "diseaseName": "Name of disease or Healthy Crop",
  "confidenceScore": 95.0,
  "severity": "low" | "medium" | "high",
  "environmentalRiskLevel": "low" | "medium" | "high",
  "symptoms": ["Detailed visual symptom 1", "Symptom 2"],
  "recommendations": ["Actionable advice 1", "Advice 2"],
  "preventionSteps": ["Preventative measure 1", "Measure 2"],
  "treatmentSuggestions": ["Treatment suggestion 1", "Suggestion 2"]
}

Rules:
1. confidenceScore MUST be a number between 0 and 100.
2. severity MUST be exactly one of: "low", "medium", "high".
3. environmentalRiskLevel MUST be exactly one of: "low", "medium", "high".
4. symptoms, recommendations, preventionSteps, treatmentSuggestions MUST be arrays of descriptive strings.
5. Return ONLY the JSON object. Do not include markdown code block syntax or extra text outside JSON.
`;

  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    attempt++;
    try {
      logger.info(`Sending image analysis request to Gemini AI (${modelName}) (Attempt ${attempt}/${maxRetries + 1})...`);

      // Execute request with Promise timeout wrapper
      const responsePromise = model.generateContent([prompt, imageInlineData]);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeoutMs)
      );

      const result = await Promise.race([responsePromise, timeoutPromise]);
      const responseText = result.response.text();

      return {
        rawResponse: responseText,
        attempt
      };
    } catch (err) {
      lastError = err;
      logger.warn(`Gemini AI analysis attempt ${attempt} failed: ${err.message}`);

      // Check if error is transient
      const transient = isTransientError(err);

      if (!transient) {
        // Permanent error (e.g. 400 Bad Request, 401 Unauthorized, 404 Model Not Found) - do not retry
        logger.error(`Non-retryable Gemini AI error: ${err.message}`);
        const status = err.status || 500;
        const code = status === 401 ? 'GEMINI_UNAUTHORIZED' : (status === 404 ? 'GEMINI_MODEL_NOT_FOUND' : 'GEMINI_API_ERROR');
        throw new GeminiError(`Gemini AI processing error: ${err.message}`, code, status);
      }

      // Retry only on transient errors if attempts remain
      if (attempt <= maxRetries) {
        const backoffMs = 1000 * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s
        logger.info(`Retrying Gemini AI request in ${backoffMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  // Handle exhausted retries
  if (lastError?.message === 'GEMINI_TIMEOUT') {
    throw new GeminiError('Gemini AI API request timed out after multiple attempts', 'GEMINI_TIMEOUT', 504);
  }

  const finalStatus = lastError?.status === 429 ? 429 : 500;
  const finalCode = lastError?.status === 429 ? 'GEMINI_RATE_LIMIT' : 'GEMINI_ANALYSIS_FAILED';
  throw new GeminiError(`Gemini AI Service failed after ${maxRetries + 1} attempts: ${lastError.message}`, finalCode, finalStatus);
};

module.exports = {
  fetchImageAsInlineData,
  analyzeLeafImageWithGemini,
  isTransientError
};

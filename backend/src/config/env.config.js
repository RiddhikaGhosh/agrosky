const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(5000),

  // MySQL configuration
  MYSQL_HOST: Joi.string().required(),
  MYSQL_PORT: Joi.number().default(3306),
  MYSQL_DATABASE: Joi.string().required(),
  MYSQL_USER: Joi.string().required(),
  MYSQL_PASSWORD: Joi.string().allow('').required(),

  // Snowflake configuration
  SNOWFLAKE_ACCOUNT: Joi.string().required(),
  SNOWFLAKE_USERNAME: Joi.string().required(),
  SNOWFLAKE_PASSWORD: Joi.string().allow('').required(),
  SNOWFLAKE_DATABASE: Joi.string().required(),
  SNOWFLAKE_SCHEMA: Joi.string().default('PUBLIC'),
  SNOWFLAKE_WAREHOUSE: Joi.string().required(),
  SNOWFLAKE_ROLE: Joi.string().default('ACCOUNTADMIN'),

  // Cloudinary configuration
  CLOUDINARY_CLOUD_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(),

  // Gemini AI API configuration
  GEMINI_API_KEY: Joi.string().required(),
  GEMINI_MODEL: Joi.string().default('gemini-2.5-flash').optional(),

  // OpenWeatherMap API configuration
  OPENWEATHER_API_KEY: Joi.string().required(),

  // JWT configuration
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  // Google OAuth configuration (Optional / feature toggleable)
  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional()
}).unknown();

/**
 * Validates environment variables at application startup
 */
const validateEnv = () => {
  const { value: envVars, error } = envSchema.validate(process.env, { abortEarly: false });
  if (error) {
    const missingKeys = error.details.map((detail) => detail.path.join('.')).join(', ');
    throw new Error(`Environment Validation Failed. Missing or invalid variables: ${missingKeys}`);
  }
  return envVars;
};

const env = validateEnv();

module.exports = {
  env,
  validateEnv
};

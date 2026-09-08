const { env } = require('./env.config');

module.exports = {
  apiKey: env.GEMINI_API_KEY,
  modelName: process.env.GEMINI_MODEL || env.GEMINI_MODEL || 'gemini-2.5-flash'
};

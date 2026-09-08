const Joi = require('joi');

const idSchema = Joi.alternatives().try(
  Joi.number().integer().positive(),
  Joi.string().trim().min(1)
);

const signatureRequestSchema = Joi.object({
  farmId: idSchema,
  farm_id: idSchema,
  cropId: idSchema,
  crop_id: idSchema
})
.or('farmId', 'farm_id')
.or('cropId', 'crop_id');

const registerMetadataSchema = Joi.object({
  farm_id: idSchema,
  farmId: idSchema,
  crop_id: idSchema,
  cropId: idSchema,
  public_id: Joi.string().trim().required(),
  original_url: Joi.string().uri().required(),
  optimized_url: Joi.string().uri().optional().allow(null, ''),
  secure_url: Joi.string().uri().optional().allow(null, ''),
  resource_type: Joi.string().valid('image', 'raw', 'video').default('image'),
  width: Joi.number().integer().positive().allow(null),
  height: Joi.number().integer().positive().allow(null),
  format: Joi.string().valid('jpg', 'jpeg', 'png', 'webp').default('jpg')
})
.or('farm_id', 'farmId')
.or('crop_id', 'cropId');

module.exports = {
  signatureRequestSchema,
  registerMetadataSchema
};

const { body, validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errorHandler');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));
    
    throw new ValidationError('Validation failed', validationErrors);
  }
  next();
};

const validateRegistration = [
  body('org_name').trim().isLength({ min: 2, max: 100 }).withMessage('Organization name must be between 2 and 100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  validate
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
];

const validateFeature = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Feature name must be between 2 and 100 characters'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Feature description must be between 10 and 1000 characters'),
  validate
];

const validateForgotPassword = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address'),
  validate
];

const validateResetPassword = [
  body('access_token').notEmpty().withMessage('Access token is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  validate
];

const validateResetToken = [
  body('access_token').notEmpty().withMessage('Access token is required'),
  validate
];

const validateApiKey = {
  createApiKey: [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('API key name must be between 2 and 100 characters'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
    body('permissions').optional().isArray().withMessage('Permissions must be an array'),
    body('permissions.*').optional().isIn(['features:read', 'features:write', 'features:delete', 'plans:read', 'plans:write', 'members:read']).withMessage('Invalid permission'),
    body('expiresAt').optional().isISO8601().withMessage('Expiration date must be a valid ISO 8601 date'),
    validate
  ],
  updateApiKey: [
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('API key name must be between 2 and 100 characters'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
    body('permissions').optional().isArray().withMessage('Permissions must be an array'),
    body('permissions.*').optional().isIn(['features:read', 'features:write', 'features:delete', 'plans:read', 'plans:write', 'members:read']).withMessage('Invalid permission'),
    body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
    body('expiresAt').optional().isISO8601().withMessage('Expiration date must be a valid ISO 8601 date'),
    validate
  ]
};

module.exports = {
  validate,
  validateRegistration,
  validateLogin,
  validateFeature,
  validateForgotPassword,
  validateResetPassword,
  validateResetToken,
  validateApiKey
};
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

module.exports = {
  validate,
  validateRegistration,
  validateLogin,
  validateFeature
};
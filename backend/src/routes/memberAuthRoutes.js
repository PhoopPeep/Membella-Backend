const express = require('express');
const MemberAuthController = require('../controllers/memberAuthController');
const { authRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const memberAuthController = new MemberAuthController();

// Create member-specific validation middleware
const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: validationErrors,
      requiresVerification: false,
      rateLimited: false
    });
  }
  next();
};

// Member-specific validation (different from owner validation)
const validateMemberRegistration = [
  body('fullName').trim().isLength({ min: 2, max: 100 }).withMessage('Full name must be between 2 and 100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('phone').optional().trim().isLength({ max: 20 }).withMessage('Phone number must be less than 20 characters'),
  validate
];

const validateMemberLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
];

const validateMemberResendVerification = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address'),
  validate
];

// Member authentication routes with proper validation
router.post('/register', authRateLimiter, validateMemberRegistration, memberAuthController.register);
router.post('/login', authRateLimiter, validateMemberLogin, memberAuthController.login);
router.post('/resend-verification', authRateLimiter, validateMemberResendVerification, memberAuthController.resendVerification);
router.post('/callback', memberAuthController.handleAuthCallback);

module.exports = router;
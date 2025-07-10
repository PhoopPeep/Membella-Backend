const { body, param, query, validationResult } = require('express-validator');
const { ValidationError } = require('./errorHandler');

// Common validation rules
const commonValidations = {
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  password: body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  orgName: body('org_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Organization name must be between 2 and 100 characters'),
  
  description: body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  
  contactInfo: body('contact_info')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Contact info must be less than 200 characters'),
  
  featureName: body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Feature name must be between 2 and 100 characters'),
  
  featureDescription: body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Feature description must be between 10 and 1000 characters'),
  
  planName: body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Plan name must be between 2 and 100 characters'),
  
  planDescription: body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Plan description must be between 10 and 1000 characters'),
  
  price: body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  
  memberName: body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Member name must be between 2 and 100 characters'),
  
  memberEmail: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  idParam: param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
  
  pageQuery: query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  limitQuery: query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  searchQuery: query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters')
};

// Validation middleware
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

// Specific validation chains
const authValidations = {
  register: [
    commonValidations.orgName,
    commonValidations.email,
    commonValidations.password,
    commonValidations.description,
    commonValidations.contactInfo,
    validate
  ],
  
  login: [
    commonValidations.email,
    body('password').notEmpty().withMessage('Password is required'),
    validate
  ],
  
  resendVerification: [
    commonValidations.email,
    validate
  ]
};

const featureValidations = {
  create: [
    commonValidations.featureName,
    commonValidations.featureDescription,
    validate
  ],
  
  update: [
    commonValidations.idParam,
    commonValidations.featureName,
    commonValidations.featureDescription,
    validate
  ],
  
  getById: [
    commonValidations.idParam,
    validate
  ],
  
  delete: [
    commonValidations.idParam,
    validate
  ]
};

const planValidations = {
  create: [
    commonValidations.planName,
    commonValidations.planDescription,
    commonValidations.price,
    validate
  ],
  
  update: [
    commonValidations.idParam,
    commonValidations.planName,
    commonValidations.planDescription,
    commonValidations.price,
    validate
  ],
  
  getById: [
    commonValidations.idParam,
    validate
  ],
  
  delete: [
    commonValidations.idParam,
    validate
  ]
};

const memberValidations = {
  create: [
    commonValidations.memberName,
    commonValidations.memberEmail,
    commonValidations.idParam, // plan_id
    validate
  ],
  
  update: [
    commonValidations.idParam, // member_id
    commonValidations.memberName,
    commonValidations.memberEmail,
    validate
  ],
  
  getById: [
    commonValidations.idParam,
    validate
  ],
  
  delete: [
    commonValidations.idParam,
    validate
  ]
};

const dashboardValidations = {
  getMembers: [
    commonValidations.pageQuery,
    commonValidations.limitQuery,
    commonValidations.searchQuery,
    validate
  ],
  
  getMembersByPlan: [
    commonValidations.idParam, // plan_id
    commonValidations.pageQuery,
    commonValidations.limitQuery,
    validate
  ]
};

const profileValidations = {
  update: [
    commonValidations.orgName,
    commonValidations.description,
    commonValidations.contactInfo,
    validate
  ],
  
  changePassword: [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    commonValidations.password,
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Password confirmation does not match');
        }
        return true;
      })
      .withMessage('Password confirmation does not match'),
    validate
  ]
};

// Sanitization helpers
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.trim().replace(/\s+/g, ' ');
  }
  return input;
};

const sanitizeRequestBody = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    });
  }
  next();
};

module.exports = {
  commonValidations,
  validate,
  authValidations,
  featureValidations,
  planValidations,
  memberValidations,
  dashboardValidations,
  profileValidations,
  sanitizeInput,
  sanitizeRequestBody
}; 
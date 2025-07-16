const winston = require('winston');

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
  }
}

// Error response formatter
const formatErrorResponse = (error, req) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const response = {
    success: false,
    message: error.message || 'Internal server error',
    statusCode: error.statusCode || 500
  };

  // Add validation errors if present
  if (error.errors && Array.isArray(error.errors)) {
    response.errors = error.errors;
  }

  // Add stack trace in development
  if (isDevelopment && error.stack) {
    response.stack = error.stack;
  }

  // Add request ID for tracking
  if (req.id) {
    response.requestId = req.id;
  }

  return response;
};

// Global error handling middleware
const errorHandler = (error, req, res, next) => {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    logger.error('Error occurred after headers sent:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      requestId: req.id
    });
    return next(error);
  }

  // Log the error
  logger.error({
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.userId,
    requestId: req.id
  });

  // Handle Prisma errors
  if (error.code) {
    switch (error.code) {
      case 'P2002':
        return res.status(409).json(formatErrorResponse(
          new ConflictError('A record with this unique field already exists'), req
        ));
      case 'P2025':
        return res.status(404).json(formatErrorResponse(
          new NotFoundError('Record not found'), req
        ));
      case 'P2003':
        return res.status(400).json(formatErrorResponse(
          new ValidationError('Invalid foreign key reference'), req
        ));
      default:
        return res.status(500).json(formatErrorResponse(
          new AppError('Database operation failed', 500), req
        ));
    }
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json(formatErrorResponse(
      new AuthenticationError('Invalid token'), req
    ));
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json(formatErrorResponse(
      new AuthenticationError('Token expired'), req
    ));
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json(formatErrorResponse(
      new ValidationError('Validation failed', error.errors), req
    ));
  }

  // Handle Multer errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json(formatErrorResponse(
      new ValidationError('File too large'), req
    ));
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json(formatErrorResponse(
      new ValidationError('Unexpected file field'), req
    ));
  }

  // Handle custom AppErrors
  if (error instanceof AppError) {
    return res.status(error.statusCode).json(formatErrorResponse(error, req));
  }

  // Handle CORS errors
  if (error.message && error.message.includes('CORS')) {
    return res.status(403).json(formatErrorResponse(
      new AppError('CORS policy violation', 403), req
    ));
  }

  // Handle rate limit errors
  if (error.status === 429 || error.statusCode === 429) {
    return res.status(429).json(formatErrorResponse(
      new RateLimitError('Too many requests'), req
    ));
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';
  
  res.status(statusCode).json(formatErrorResponse(
    new AppError(message, statusCode), req
  ));
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Request ID middleware
const addRequestId = (req, res, next) => {
  req.id = Math.random().toString(36).substring(2, 15);
  res.setHeader('X-Request-ID', req.id);
  next();
};

// Not found handler
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Graceful error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  
  // Give some time for logging to complete
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', {
    promise: promise,
    reason: reason,
    timestamp: new Date().toISOString()
  });
  
  // Give some time for logging to complete
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

module.exports = {
  logger,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  errorHandler,
  asyncHandler,
  addRequestId,
  notFoundHandler,
  formatErrorResponse
};
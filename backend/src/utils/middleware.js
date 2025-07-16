const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { logger } = require('./errorHandler');

// Security middleware
const securityMiddleware = [
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  })
];

// Rate limiting middleware
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests') => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      statusCode: 429
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn({
        message: 'Rate limit exceeded',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url
      });
      res.status(429).json({
        success: false,
        message,
        statusCode: 429
      });
    }
  });
};

// Specific rate limiters
const authRateLimiter = createRateLimiter(15 * 60 * 1000, 5, 'Too many authentication attempts');
const apiRateLimiter = createRateLimiter(15 * 60 * 1000, 100, 'Too many API requests');
const uploadRateLimiter = createRateLimiter(15 * 60 * 1000, 10, 'Too many upload attempts');

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Only attach listener once
  if (!res.headersSent) {
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logData = {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.userId,
        requestId: req.id
      };

      if (res.statusCode >= 400) {
        logger.warn(logData);
      } else {
        logger.info(logData);
      }
    });
  }

  next();
};

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn({
        message: 'CORS blocked request',
        origin,
        url: req?.url
      });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Body size limit middleware
const bodySizeLimit = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength > maxSize) {
    return res.status(413).json({
      success: false,
      message: 'Request entity too large',
      statusCode: 413
    });
  }
  
  next();
};

// Request timeout middleware
const requestTimeout = (timeoutMs = 30000) => {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.error({
          message: 'Request timeout',
          url: req.url,
          method: req.method,
          requestId: req.id
        });
        res.status(408).json({
          success: false,
          message: 'Request timeout',
          statusCode: 408
        });
      }
    }, timeoutMs);

    // Clear timeout when response finishes
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    // Clear timeout when response closes (connection closed by client)
    res.on('close', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

// Health check middleware
const healthCheck = (req, res) => {
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  };

  res.status(200).json(healthData);
};

// Database health check
const databaseHealthCheck = async (req, res) => {
  try {
    const { PrismaClient } = require('../../generated/prisma/client');
    const prisma = new PrismaClient();
    
    // Simple query to test database connection
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    
    res.status(200).json({
      status: 'OK',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({
      message: 'Database health check failed',
      error: error.message
    });
    
    res.status(503).json({
      status: 'ERROR',
      database: 'disconnected',
      message: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
};

// File upload validation middleware
const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded',
      statusCode: 400
    });
  }

  // Check file size (5MB limit)
  const maxSize = 5 * 1024 * 1024;
  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      message: 'File too large. Maximum size is 5MB',
      statusCode: 400
    });
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only images are allowed',
      statusCode: 400
    });
  }

  next();
};

// Pagination middleware
const paginationMiddleware = (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  req.pagination = {
    page,
    limit,
    offset
  };

  next();
};

// Fixed response time header middleware
const responseTimeHeader = (req, res, next) => {
  const start = Date.now();
  
  // Store original methods to avoid double-setting headers
  const originalEnd = res.end;
  const originalSend = res.send;
  const originalJson = res.json;
  
  let headerSet = false;

  const setResponseTimeHeader = () => {
    if (!headerSet && !res.headersSent) {
      const duration = Date.now() - start;
      try {
        res.setHeader('X-Response-Time', `${duration}ms`);
        headerSet = true;
      } catch (error) {
        // Header already sent, ignore
        logger.debug('Could not set response time header - headers already sent');
      }
    }
  };

  // Override response methods to set header before sending
  res.end = function(...args) {
    setResponseTimeHeader();
    return originalEnd.apply(this, args);
  };

  res.send = function(...args) {
    setResponseTimeHeader();
    return originalSend.apply(this, args);
  };

  res.json = function(...args) {
    setResponseTimeHeader();
    return originalJson.apply(this, args);
  };

  // Fallback for other response methods
  res.on('finish', () => {
    setResponseTimeHeader();
  });

  next();
};

module.exports = {
  securityMiddleware,
  createRateLimiter,
  authRateLimiter,
  apiRateLimiter,
  uploadRateLimiter,
  requestLogger,
  corsOptions,
  bodySizeLimit,
  requestTimeout,
  healthCheck,
  databaseHealthCheck,
  validateFileUpload,
  paginationMiddleware,
  responseTimeHeader
};
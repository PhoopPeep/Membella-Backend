const express = require('express');
const PaymentController = require('../controllers/paymentController');
const { requireMember } = require('../middleware/roleAuth');
const { apiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const paymentController = new PaymentController();

// Rate limiters
const paymentRateLimiter = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 payment attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many payment attempts. Please wait before trying again.',
    statusCode: 429
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const statusCheckRateLimiter = require('express-rate-limit')({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 status checks per minute per user
  message: {
    success: false,
    message: 'Too many status check requests. Please wait before trying again.',
    statusCode: 429
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const webhookRateLimiter = require('express-rate-limit')({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // 200 webhook calls per minute
  message: {
    success: false,
    message: 'Webhook rate limit exceeded',
    statusCode: 429
  },
  standardHeaders: false,
  legacyHeaders: false,
  skip: (req) => {
    if (process.env.NODE_ENV === 'development') {
      return req.ip === '127.0.0.1' || req.ip === '::1';
    }
    return false;
  }
});

// Request logging middleware for debugging
if (process.env.NODE_ENV === 'development') {
  router.use((req, res, next) => {
    console.log('=== Payment Route Debug ===');
    console.log('Method:', req.method);
    console.log('Path:', req.path);
    console.log('Full URL:', req.originalUrl);
    console.log('Params:', req.params);
    console.log('Query:', req.query);
    console.log('Headers:', {
      'content-type': req.headers['content-type'],
      'authorization': req.headers.authorization ? 'Present' : 'Missing',
      'user-agent': req.headers['user-agent']?.substring(0, 50) + '...'
    });
    console.log('========================\n');
    next();
  });
}

// Public routes
router.get('/omise-key', apiRateLimiter, paymentController.getOmisePublicKey);
router.get('/methods', apiRateLimiter, paymentController.getPaymentMethods);

// Webhook endpoint
router.post('/webhook', webhookRateLimiter, paymentController.handleWebhook);

// Development
if (process.env.NODE_ENV === 'development') {
  router.get('/webhook-logs', apiRateLimiter, paymentController.getWebhookLogs);
  
  // Debug endpoint to check payment service status
  router.get('/debug/status', apiRateLimiter, (req, res) => {
    try {
      const PaymentService = require('../services/paymentService');
      const paymentService = new PaymentService();
      
      res.json({
        success: true,
        data: {
          webhookCache: paymentService.getWebhookCacheStatus(),
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Debug status check failed',
        error: error.message
      });
    }
  });
}

// All routes
router.use(requireMember);

router.use((req, res, next) => {
  console.log('Payment route authentication check:', {
    hasUser: !!req.user,
    userId: req.user?.userId,
    role: req.user?.role,
    path: req.path,
    method: req.method
  });
  
  if (!req.user || !req.user.userId) {
    console.error('Payment route: No user data found');
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in to continue.'
    });
  }
  
  if (req.user.role !== 'member') {
    console.error('Payment route: Invalid user role:', req.user.role);
    return res.status(403).json({
      success: false,
      message: 'Member access required.'
    });
  }
  
  next();
});

// Payment creation and processing
router.post('/subscription', paymentRateLimiter, paymentController.createSubscriptionPayment);

// Payment status and history
router.get('/status/:paymentId', statusCheckRateLimiter, paymentController.getPaymentStatus);
router.get('/history', apiRateLimiter, paymentController.getPaymentHistory);

// Status checking
router.post('/refresh/:paymentId', statusCheckRateLimiter, paymentController.refreshPaymentFromOmise);

// Polling endpoint for PromptPay payments
router.get('/poll/:paymentId', apiRateLimiter, paymentController.pollPaymentStatus);

// Validation endpoint
router.post('/validate', apiRateLimiter, paymentController.validatePayment);

// Track API usage for monitoring
router.use((req, res, next) => {
  // Track payment API usage
  const startTime = Date.now();
  
  res.on('finish', () => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Log API usage
    console.log('Payment API Usage:', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.userId,
      timestamp: new Date().toISOString(),
      success: res.statusCode < 400
    });
    
    // Log slow requests
    if (duration > 5000) { // 5 seconds
      console.warn('Slow Payment API Request:', {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        userId: req.user?.userId
      });
    }
  });
  
  next();
});

// Error handling middleware specifically for payment routes
router.use((error, req, res, _next) => {
  console.error('Payment Route Error:', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    userId: req.user?.userId,
    timestamp: new Date().toISOString()
  });
  
  // Handle specific payment errors
  if (error.message.includes('Omise')) {
    return res.status(502).json({
      success: false,
      message: 'Payment gateway error. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
  
  if (error.message.includes('rate limit')) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please wait before trying again.',
      retryAfter: '60 seconds'
    });
  }
  
  if (error.message.includes('Payment not found')) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }
  
  if (error.message.includes('Invalid')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  // Default error response
  res.status(500).json({
    success: false,
    message: 'Payment processing error. Please try again.',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;
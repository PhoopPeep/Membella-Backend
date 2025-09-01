const express = require('express');
const PaymentController = require('../controllers/paymentController');
const { requireMember } = require('../middleware/roleAuth');
const { apiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const paymentController = new PaymentController();

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

const webhookRateLimiter = require('express-rate-limit')({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 webhook calls per minute
  message: {
    success: false,
    message: 'Webhook rate limit exceeded',
    statusCode: 429
  },
  standardHeaders: false,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for localhost in development
    if (process.env.NODE_ENV === 'development') {
      return req.ip === '127.0.0.1' || req.ip === '::1';
    }
    return false;
  }
});

// Public routes
router.get('/omise-key', apiRateLimiter, paymentController.getOmisePublicKey);
router.get('/methods', apiRateLimiter, paymentController.getPaymentMethods);

// Webhook endpoint
router.post('/webhook', webhookRateLimiter, paymentController.handleWebhook);

// Protected routes
router.use(requireMember);

// Payment creation and processing
router.post('/subscription', paymentRateLimiter, paymentController.createSubscriptionPayment);

// Payment status and history
router.get('/status/:paymentId', apiRateLimiter, paymentController.getPaymentStatus);
router.get('/poll/:paymentId', apiRateLimiter, paymentController.pollPaymentStatus);
router.get('/history', apiRateLimiter, paymentController.getPaymentHistory);

// Add request logging middleware for debugging
if (process.env.NODE_ENV === 'development') {
  router.use((req, res, next) => {
    console.log('Payment Route:', {
      method: req.method,
      path: req.path,
      params: req.params,
      query: req.query,
      headers: {
        'content-type': req.headers['content-type'],
        'authorization': req.headers.authorization ? 'Present' : 'Missing'
      }
    });
    next();
  });
}

module.exports = router;
const express = require('express');
const PaymentController = require('../controllers/paymentController');
const { requireMember } = require('../middleware/roleAuth');
const { apiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const paymentController = new PaymentController();

// Public routes
router.get('/omise-key', paymentController.getOmisePublicKey);
router.post('/webhook', paymentController.handleWebhook); // Omise webhook

// Protected routes (require member authentication)
router.use(requireMember);

router.post('/subscription', apiRateLimiter, paymentController.createSubscriptionPayment);
router.get('/status/:paymentId', apiRateLimiter, paymentController.getPaymentStatus);
router.get('/history', apiRateLimiter, paymentController.getPaymentHistory);

module.exports = router;
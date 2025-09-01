const express = require('express');
const SubscriptionController = require('../controllers/subscriptionController');
const { requireMember } = require('../middleware/roleAuth');
const { apiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const subscriptionController = new SubscriptionController();

// All routes require member authentication
router.use(requireMember);

router.get('/', apiRateLimiter, subscriptionController.getMemberSubscriptions);
router.get('/stats', apiRateLimiter, subscriptionController.getSubscriptionStats);
router.get('/:subscriptionId', apiRateLimiter, subscriptionController.getSubscriptionById);
router.patch('/:subscriptionId/status', apiRateLimiter, subscriptionController.updateSubscriptionStatus);

module.exports = router;
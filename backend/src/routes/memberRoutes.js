const express = require('express');
const MemberController = require('../controllers/memberController');
const { requireMember } = require('../middleware/roleAuth');
const { apiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const memberController = new MemberController();

// Public routes (no auth required)
router.get('/plans/available', apiRateLimiter, memberController.getAvailablePlans);

// Protected member routes
router.use(requireMember);
router.post('/subscribe', apiRateLimiter, memberController.subscribe);
router.get('/subscription', apiRateLimiter, memberController.getSubscription);

module.exports = router;
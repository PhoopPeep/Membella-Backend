const express = require('express');
const MemberController = require('../controllers/memberController');
const { requireMember } = require('../middleware/roleAuth');
const { apiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const memberController = new MemberController();

// Public routes (no authentication required)
router.get('/plans/available', apiRateLimiter, memberController.getAvailablePlans);
router.get('/owners', apiRateLimiter, memberController.getOwners);
router.get('/owners/search', apiRateLimiter, memberController.searchOwners);

// Owner specific routes (public)
router.get('/owners/:ownerId/plans', apiRateLimiter, memberController.getOwnerPlans);

// Protected member routes (require authentication)
router.use(requireMember);
router.post('/subscribe', apiRateLimiter, memberController.subscribe);
router.get('/subscription', apiRateLimiter, memberController.getSubscription);

module.exports = router;
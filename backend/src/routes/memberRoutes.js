const express = require('express');
const MemberController = require('../controllers/memberController');
const { requireMember } = require('../middleware/roleAuth');
const { apiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const memberController = new MemberController();

// Public routes
router.get('/plans/available', apiRateLimiter, memberController.getAvailablePlans);

// Member dashboard routes
router.get('/owners', apiRateLimiter, memberController.getOwners);    
router.get('/owners/:ownerId/plans', apiRateLimiter, memberController.getOwnerPlans);

// Protected member routes
router.use(requireMember);
router.post('/subscribe', apiRateLimiter, memberController.subscribe);
router.get('/subscription', apiRateLimiter, memberController.getSubscription);

module.exports = router;
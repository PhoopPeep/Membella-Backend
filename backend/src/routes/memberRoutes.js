const express = require('express');
const MemberController = require('../controllers/memberController');
const { apiRateLimiter } = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const memberController = new MemberController();

// Public routes (no authentication required)
router.get('/owners', apiRateLimiter, memberController.getOwners);
router.get('/owners/search', apiRateLimiter, memberController.searchOwners);

// Owner specific routes (public)
router.get('/owners/:ownerId/plans', apiRateLimiter, memberController.getOwnerPlans);
router.get('/plans/:planId', apiRateLimiter, memberController.getPlanDetails);

// Protected routes (authentication required)
router.get('/members', authenticateToken, apiRateLimiter, memberController.getMembers);
router.get('/plan-stats', authenticateToken, apiRateLimiter, memberController.getPlanStats);
router.delete('/members/:memberId', authenticateToken, apiRateLimiter, memberController.deleteMember);

module.exports = router;
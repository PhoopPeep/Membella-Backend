const express = require('express');
const MemberController = require('../controllers/memberController');
const { apiRateLimiter } = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const memberController = new MemberController();

// Public routes
router.get('/owners', apiRateLimiter, memberController.getOwners);

// Owner specific routes
router.get('/owners/:ownerId/plans', apiRateLimiter, memberController.getOwnerPlans);
router.get('/plans/:planId', apiRateLimiter, memberController.getPlanDetails);

// Protected routes
router.get('/members', authenticateToken, apiRateLimiter, memberController.getMembers);
router.get('/plan-stats', authenticateToken, apiRateLimiter, memberController.getPlanStats);
router.delete('/members/:memberId', authenticateToken, apiRateLimiter, memberController.deleteMember);

module.exports = router;
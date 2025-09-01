const express = require('express');
const MemberController = require('../controllers/memberController');
const { apiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const memberController = new MemberController();

// Public routes (no authentication required)
router.get('/owners', apiRateLimiter, memberController.getOwners);
router.get('/owners/search', apiRateLimiter, memberController.searchOwners);

// Owner specific routes (public)
router.get('/owners/:ownerId/plans', apiRateLimiter, memberController.getOwnerPlans);

module.exports = router;
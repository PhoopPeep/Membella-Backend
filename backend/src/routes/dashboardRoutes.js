const express = require('express');
const DashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');
const { apiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const dashboardController = new DashboardController();

// All dashboard routes require authentication
router.use(authenticateToken);

router.get('/stats', apiRateLimiter, dashboardController.getDashboardStats);
router.get('/revenue', apiRateLimiter, dashboardController.getRevenueData);
router.get('/members', apiRateLimiter, dashboardController.getMembers);
router.get('/members-by-plan', apiRateLimiter, dashboardController.getMembersByPlan);

module.exports = router;
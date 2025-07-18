const express = require('express');
const PlansController = require('../controllers/plansController');
const { authenticateToken } = require('../middleware/auth');
const { apiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const plansController = new PlansController();

// All plan routes require authentication
router.use(authenticateToken);

router.get('/', apiRateLimiter, plansController.getPlans);
router.get('/:id', apiRateLimiter, plansController.getPlanById);
router.post('/', apiRateLimiter, plansController.createPlan);
router.put('/:id', apiRateLimiter, plansController.updatePlan);
router.delete('/:id', apiRateLimiter, plansController.deletePlan);

module.exports = router;
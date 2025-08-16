const express = require('express');
const { requireOwner } = require('../middleware/roleAuth');

// Import existing controllers
const DashboardController = require('../controllers/dashboardController');
const FeaturesController = require('../controllers/featuresController');
const PlansController = require('../controllers/plansController');

const router = express.Router();

// All owner routes require owner authentication
router.use(requireOwner);

// Dashboard routes
const dashboardController = new DashboardController();
router.get('/dashboard/stats', dashboardController.getDashboardStats);
router.get('/dashboard/revenue', dashboardController.getRevenueData);
router.get('/dashboard/members', dashboardController.getMembers);
router.get('/dashboard/members-by-plan', dashboardController.getMembersByPlan);

// Features routes
const featuresController = new FeaturesController();
router.get('/features', featuresController.getFeatures);
router.get('/features/:id', featuresController.getFeatureById);
router.post('/features', featuresController.createFeature);
router.put('/features/:id', featuresController.updateFeature);
router.delete('/features/:id', featuresController.deleteFeature);

// Plans routes
const plansController = new PlansController();
router.get('/plans', plansController.getPlans);
router.get('/plans/:id', plansController.getPlanById);
router.post('/plans', plansController.createPlan);
router.put('/plans/:id', plansController.updatePlan);
router.delete('/plans/:id', plansController.deletePlan);

module.exports = router;
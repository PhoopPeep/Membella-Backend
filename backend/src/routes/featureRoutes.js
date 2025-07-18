const express = require('express');
const FeaturesController = require('../controllers/featuresController');
const { authenticateToken } = require('../middleware/auth');
const { apiRateLimiter } = require('../middleware/rateLimiter');
const { validateFeature } = require('../middleware/validation');

const router = express.Router();
const featuresController = new FeaturesController();

router.use(authenticateToken); // All feature routes require authentication

router.get('/', apiRateLimiter, featuresController.getFeatures);
router.get('/:id', apiRateLimiter, featuresController.getFeatureById);
router.post('/', apiRateLimiter, validateFeature, featuresController.createFeature);
router.put('/:id', apiRateLimiter, validateFeature, featuresController.updateFeature);
router.delete('/:id', apiRateLimiter, featuresController.deleteFeature);

module.exports = router;
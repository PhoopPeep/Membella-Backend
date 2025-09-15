const express = require('express');
const FeaturesController = require('../controllers/featuresController');
const { requireOwner } = require('../middleware/roleAuth');
const { apiRateLimiter } = require('../middleware/rateLimiter');
const { validateFeature } = require('../middleware/validation');

const router = express.Router();
const featuresController = new FeaturesController();

router.use(requireOwner); // All feature routes require owner authentication

router.get('/', apiRateLimiter, featuresController.getFeatures);
router.get('/:id', apiRateLimiter, featuresController.getFeatureById);
router.post('/', apiRateLimiter, validateFeature, featuresController.createFeature);
router.put('/:id', apiRateLimiter, validateFeature, featuresController.updateFeature);
router.delete('/:id', apiRateLimiter, featuresController.deleteFeature);

module.exports = router;
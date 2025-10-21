const express = require('express');
const router = express.Router();
const AutoKeyGenerationController = require('../controllers/autoKeyGenerationController');
const { requireOwner } = require('../middleware/roleAuth');

const autoKeyController = new AutoKeyGenerationController();

router.use(requireOwner);

/**
 * @route   POST /api/auto-generate-keys
 * @desc    Auto-generate API keys for owner
 * @access  Owner
 */
router.post('/', 
  autoKeyController.generateKeysForOwner.bind(autoKeyController)
);

/**
 * @route   POST /api/auto-generate-keys/additional
 * @desc    Generate additional API key for owner
 * @access  Owner
 */
router.post('/additional', 
  autoKeyController.generateAdditionalKey.bind(autoKeyController)
);

/**
 * @route   GET /api/auto-generate-keys/stats
 * @desc    Get API key usage statistics
 * @access  Owner
 */
router.get('/stats', 
  autoKeyController.getKeyUsageStats.bind(autoKeyController)
);

module.exports = router;

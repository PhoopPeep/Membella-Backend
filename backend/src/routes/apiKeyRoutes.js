const express = require('express');
const router = express.Router();
const ApiKeyController = require('../controllers/apiKeyController');
const { requireOwner } = require('../middleware/roleAuth');
const { validateApiKey } = require('../middleware/validation');

const apiKeyController = new ApiKeyController();

router.use(requireOwner);

/**
 * @route   POST /api/api-keys
 * @desc    Create a new API key
 * @access  Owner
 */
router.post('/', 
  validateApiKey.createApiKey,
  apiKeyController.createApiKey.bind(apiKeyController)
);

/**
 * @route   GET /api/api-keys
 * @desc    Get all API keys for the owner
 * @access  Owner
 */
router.get('/', 
  apiKeyController.getApiKeys.bind(apiKeyController)
);

/**
 * @route   GET /api/api-keys/:id
 * @desc    Get a specific API key by ID
 * @access  Owner
 */
router.get('/:id', 
  apiKeyController.getApiKeyById.bind(apiKeyController)
);

/**
 * @route   PUT /api/api-keys/:id
 * @desc    Update an API key
 * @access  Owner
 */
router.put('/:id', 
  validateApiKey.updateApiKey,
  apiKeyController.updateApiKey.bind(apiKeyController)
);

/**
 * @route   DELETE /api/api-keys/:id
 * @desc    Delete an API key
 * @access  Owner
 */
router.delete('/:id', 
  apiKeyController.deleteApiKey.bind(apiKeyController)
);

/**
 * @route   PATCH /api/api-keys/:id/toggle
 * @desc    Toggle API key status (activate/deactivate)
 * @access  Owner
 */
router.patch('/:id/toggle', 
  apiKeyController.toggleApiKeyStatus.bind(apiKeyController)
);

module.exports = router;

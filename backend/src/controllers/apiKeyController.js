const ApiKeyService = require('../services/apiKeyService');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errorHandler');

class ApiKeyController {
  constructor() {
    this.apiKeyService = new ApiKeyService();
  }

  /**
   * Create a new API key
   * POST /api/api-keys
   */
  async createApiKey(req, res) {
    try {
      const ownerId = req.user.userId;
      const { name, permissions, expiresAt } = req.body;

      // Validate required fields
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'API key name is required',
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
      }

      const apiKeyData = {
        name: name.trim(),
        permissions: permissions || ['features:read'],
        expiresAt: expiresAt ? new Date(expiresAt) : null
      };

      const apiKey = await this.apiKeyService.createApiKey(ownerId, apiKeyData);

      res.status(201).json({
        success: true,
        data: {
          api_key: apiKey
        },
        message: 'API key created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Create API key error:', error);

      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: {
            message: error.message,
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
      }

      if (error instanceof ConflictError) {
        return res.status(409).json({
          success: false,
          error: {
            message: error.message,
            statusCode: 409,
            timestamp: new Date().toISOString()
          }
        });
      }

      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          statusCode: 500,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get all API keys for the owner
   * GET /api/api-keys
   */
  async getApiKeys(req, res) {
    try {
      // Return empty array for now - API keys are managed via Features API Gateway (DynamoDB)
      // This endpoint exists for UI compatibility
      res.status(200).json({
        success: true,
        data: {
          api_keys: [],
          count: 0
        },
        message: 'API keys are managed via Features API Gateway. Use the "Generate API Key" button.',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get API keys error:', error);

      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          statusCode: 500,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get a specific API key by ID
   * GET /api/api-keys/:id
   */
  async getApiKeyById(req, res) {
    try {
      const ownerId = req.user.userId;
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'API key ID is required',
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
      }

      const apiKey = await this.apiKeyService.getApiKeyById(id, ownerId);

      res.status(200).json({
        success: true,
        data: {
          api_key: apiKey
        },
        message: 'API key retrieved successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get API key by ID error:', error);

      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: {
            message: error.message,
            statusCode: 404,
            timestamp: new Date().toISOString()
          }
        });
      }

      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          statusCode: 500,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Update an API key
   * PUT /api/api-keys/:id
   */
  async updateApiKey(req, res) {
    try {
      const ownerId = req.user.userId;
      const { id } = req.params;
      const { name, permissions, is_active, expiresAt } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'API key ID is required',
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (permissions !== undefined) updateData.permissions = permissions;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (expiresAt !== undefined) updateData.expiresAt = expiresAt;

      const apiKey = await this.apiKeyService.updateApiKey(id, ownerId, updateData);

      res.status(200).json({
        success: true,
        data: {
          api_key: apiKey
        },
        message: 'API key updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Update API key error:', error);

      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: {
            message: error.message,
            statusCode: 404,
            timestamp: new Date().toISOString()
          }
        });
      }

      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: {
            message: error.message,
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
      }

      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          statusCode: 500,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Delete an API key
   * DELETE /api/api-keys/:id
   */
  async deleteApiKey(req, res) {
    try {
      const ownerId = req.user.userId;
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'API key ID is required',
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
      }

      await this.apiKeyService.deleteApiKey(id, ownerId);

      res.status(200).json({
        success: true,
        message: 'API key deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Delete API key error:', error);

      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: {
            message: error.message,
            statusCode: 404,
            timestamp: new Date().toISOString()
          }
        });
      }

      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          statusCode: 500,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Toggle API key status (activate/deactivate)
   * PATCH /api/api-keys/:id/toggle
   */
  async toggleApiKeyStatus(req, res) {
    try {
      const ownerId = req.user.userId;
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'API key ID is required',
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Get current API key to toggle status
      const currentApiKey = await this.apiKeyService.getApiKeyById(id, ownerId);
      const newStatus = !currentApiKey.is_active;

      const apiKey = await this.apiKeyService.updateApiKey(id, ownerId, {
        is_active: newStatus
      });

      res.status(200).json({
        success: true,
        data: {
          api_key: apiKey
        },
        message: `API key ${newStatus ? 'activated' : 'deactivated'} successfully`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Toggle API key status error:', error);

      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: {
            message: error.message,
            statusCode: 404,
            timestamp: new Date().toISOString()
          }
        });
      }

      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          statusCode: 500,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
}

module.exports = ApiKeyController;

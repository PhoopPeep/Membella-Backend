const AutoKeyGenerationService = require('../services/autoKeyGenerationService');

class AutoKeyGenerationController {
  constructor() {
    this.autoKeyService = new AutoKeyGenerationService();
  }

  /**
   * Auto-generate API keys for owner
   * POST /api/auto-generate-keys
   */
  async generateKeysForOwner(req, res) {
    try {
      const ownerId = req.user.userId;
      
      const result = await this.autoKeyService.generateKeysForOwner(ownerId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: {
            message: result.message,
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
      }

      res.status(201).json({
        success: true,
        data: {
          keys: result.keys
        },
        message: 'API keys generated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Auto-generate keys error:', error);

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
   * Generate additional API key
   * POST /api/auto-generate-keys/additional
   */
  async generateAdditionalKey(req, res) {
    try {
      const ownerId = req.user.userId;
      const { name, description, permissions, expiresAt } = req.body;

      const options = {
        name: name || 'Custom API Key',
        description: description || 'Custom API key for specific use case',
        permissions: permissions || ['features:read'],
        expires_at: expiresAt
      };

      const result = await this.autoKeyService.generateAdditionalKey(ownerId, options);

      res.status(201).json({
        success: true,
        data: {
          api_key: result.api_key
        },
        message: 'Additional API key generated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Generate additional key error:', error);

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
   * Get API key usage statistics
   * GET /api/auto-generate-keys/stats
   */
  async getKeyUsageStats(req, res) {
    try {
      const ownerId = req.user.userId;
      
      const stats = await this.autoKeyService.getKeyUsageStats(ownerId);

      res.status(200).json({
        success: true,
        data: {
          stats
        },
        message: 'Key usage statistics retrieved successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get key usage stats error:', error);

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

module.exports = AutoKeyGenerationController;

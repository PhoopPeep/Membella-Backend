const { getPrismaClient } = require('../config/database');
const crypto = require('node:crypto');
const { AppError } = require('../utils/errorHandler');

class AutoKeyGenerationService {
  constructor() {
    this.prisma = getPrismaClient();
  }

  /**
   * Auto-generate API keys for an owner
   * @param {string} ownerId - Owner ID
   * @returns {Object} Generated API keys
   */
  async generateKeysForOwner(ownerId) {
    try {
      // Check if owner already has API keys
      const existingKeys = await this.prisma.apiKey.findMany({
        where: { owner_id: ownerId }
      });

      if (existingKeys.length > 0) {
        return {
          success: false,
          message: 'Owner already has API keys',
          existing_keys: existingKeys.length
        };
      }

      // Generate different types of API keys
      const keysToGenerate = [
        {
          name: 'Production API Key',
          description: 'Main API key for production integrations',
          permissions: ['features:read', 'features:write', 'plans:read', 'members:read'],
          expires_at: null // Never expires
        },
        {
          name: 'Development API Key',
          description: 'API key for development and testing',
          permissions: ['features:read', 'plans:read'],
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        },
        {
          name: 'Read-Only API Key',
          description: 'Read-only access for monitoring and analytics',
          permissions: ['features:read', 'plans:read', 'members:read'],
          expires_at: null // Never expires
        }
      ];

      const generatedKeys = [];

      for (const keyConfig of keysToGenerate) {
        const keyValue = this.generateApiKey();
        
        // Check if key already exists
        const existingKey = await this.prisma.apiKey.findUnique({
          where: { key_value: keyValue }
        });

        if (existingKey) {
          // Regenerate if collision
          keyConfig.key_value = this.generateApiKey();
        } else {
          keyConfig.key_value = keyValue;
        }

        // Create API key
        const apiKey = await this.prisma.apiKey.create({
          data: {
            owner_id: ownerId,
            name: keyConfig.name,
            description: keyConfig.description,
            key_value: keyConfig.key_value,
            permissions: keyConfig.permissions,
            expires_at: keyConfig.expires_at
          }
        });

        generatedKeys.push({
          api_key_id: apiKey.api_key_id,
          name: apiKey.name,
          description: apiKey.description,
          key_value: apiKey.key_value,
          permissions: apiKey.permissions,
          expires_at: apiKey.expires_at,
          create_at: apiKey.create_at
        });
      }

      return {
        success: true,
        message: 'API keys generated successfully',
        keys: generatedKeys
      };
    } catch (error) {
      console.error('Error auto-generating API keys:', error);
      throw new AppError('Failed to generate API keys', 500);
    }
  }

  /**
   * Generate additional API key for owner
   * @param {string} ownerId - Owner ID
   * @param {Object} options - Key generation options
   * @returns {Object} Generated API key
   */
  async generateAdditionalKey(ownerId, options = {}) {
    try {
      const {
        name = 'Custom API Key',
        description = 'Custom API key for specific use case',
        permissions = ['features:read'],
        expires_at = null
      } = options;

      const keyValue = this.generateApiKey();
        
      // Check if key already exists
      const existingKey = await this.prisma.apiKey.findUnique({
        where: { key_value: keyValue }
      });

      if (existingKey) {
        // Regenerate if collision
        return this.generateAdditionalKey(ownerId, options);
      }

      // Create API key
      const apiKey = await this.prisma.apiKey.create({
        data: {
          owner_id: ownerId,
          name,
          description,
          key_value: keyValue,
          permissions,
          expires_at: expires_at ? new Date(expires_at) : null
        }
      });

      return {
        success: true,
        api_key: {
          api_key_id: apiKey.api_key_id,
          name: apiKey.name,
          description: apiKey.description,
          key_value: apiKey.key_value,
          permissions: apiKey.permissions,
          expires_at: apiKey.expires_at,
          create_at: apiKey.create_at
        }
      };
    } catch (error) {
      console.error('Error generating additional API key:', error);
      throw new AppError('Failed to generate additional API key', 500);
    }
  }

  /**
   * Generate a secure API key
   * @returns {string} Generated API key
   */
  generateApiKey() {
    const randomBytes = crypto.randomBytes(32);
    const base64Key = randomBytes.toString('base64');
    
    return `mb_${base64Key}`;
  }

  /**
   * Get API key usage statistics
   * @param {string} ownerId - Owner ID
   * @returns {Object} Usage statistics
   */
  async getKeyUsageStats(ownerId) {
    try {
      const keys = await this.prisma.apiKey.findMany({
        where: { owner_id: ownerId },
        select: {
          api_key_id: true,
          name: true,
          is_active: true,
          last_used_at: true,
          expires_at: true,
          create_at: true
        }
      });

      const stats = {
        total_keys: keys.length,
        active_keys: keys.filter(k => k.is_active).length,
        expired_keys: keys.filter(k => k.expires_at && new Date(k.expires_at) < new Date()).length,
        recently_used: keys.filter(k => k.last_used_at && new Date(k.last_used_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
        keys: keys
      };

      return stats;
    } catch (error) {
      console.error('Error getting key usage stats:', error);
      throw new AppError('Failed to get key usage statistics', 500);
    }
  }
}

module.exports = AutoKeyGenerationService;

const { getPrismaClient } = require('../config/database');
const crypto = require('node:crypto');
const { ValidationError, NotFoundError, ConflictError, AppError } = require('../utils/errorHandler');

class ApiKeyService {
  constructor() {
    this.prisma = getPrismaClient();
  }

  /**
   * Generate a new API key for owner
   * @param {string} ownerId - Owner ID
   * @param {Object} data - API key data
   * @param {string} data.name - API key name
   * @param {string} data.description - API key description
   * @param {string[]} data.permissions - Array of permissions
   * @param {Date} data.expiresAt - Expiration date (optional)
   * @returns {Object} Created API key
   */
  async createApiKey(ownerId, data) {
    try {
      const { 
        name, 
        description, 
        permissions = ['features:read'], 
        expiresAt 
      } = data;

      // Validate input
      if (!name || name.trim().length === 0) {
        throw new ValidationError('API key name is required');
      }

      if (!Array.isArray(permissions) || permissions.length === 0) {
        throw new ValidationError('At least one permission is required');
      }

      // Validate permissions
      const validPermissions = new Set(['features:read', 'features:write', 'features:delete', 'plans:read', 'plans:write', 'members:read']);
      const invalidPermissions = permissions.filter(p => !validPermissions.has(p));
      if (invalidPermissions.length > 0) {
        throw new ValidationError(`Invalid permissions: ${invalidPermissions.join(', ')}`);
      }

      // Generate API key
      const keyValue = this.generateApiKey();

      // Check if key already exists
      const existingKey = await this.prisma.apiKey.findUnique({
        where: { key_value: keyValue }
      });

      if (existingKey) {
        // Regenerate if collision
        return this.createApiKey(ownerId, data);
      }

      // Create API key
      const apiKey = await this.prisma.apiKey.create({
        data: {
          owner_id: ownerId,
          name: name.trim(),
          description: description?.trim() || null,
          key_value: keyValue,
          permissions,
          expires_at: expiresAt ? new Date(expiresAt) : null
        }
      });

      return {
        api_key_id: apiKey.api_key_id,
        name: apiKey.name,
        description: apiKey.description,
        key_value: apiKey.key_value,
        permissions: apiKey.permissions,
        is_active: apiKey.is_active,
        expires_at: apiKey.expires_at,
        create_at: apiKey.create_at
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      console.error('Error creating API key:', error);
      throw new AppError('Failed to create API key', 500);
    }
  }

  /**
   * Get all API keys for an owner
   * @param {string} ownerId - Owner ID
   * @returns {Array} Array of API keys
   */
  async getApiKeys(ownerId) {
    try {
      const apiKeys = await this.prisma.apiKey.findMany({
        where: { owner_id: ownerId },
        select: {
          api_key_id: true,
          name: true,
          key_value: true,
          permissions: true,
          is_active: true,
          last_used_at: true,
          expires_at: true,
          create_at: true,
          update_at: true
        },
        orderBy: { create_at: 'desc' }
      });

      // Mask the key value for security
      return apiKeys.map(key => ({
        ...key,
        key_value: this.maskApiKey(key.key_value)
      }));
    } catch (error) {
      console.error('Error getting API keys:', error);
      throw new AppError('Failed to get API keys', 500);
    }
  }

  /**
   * Get a specific API key by ID
   * @param {string} apiKeyId - API key ID
   * @param {string} ownerId - Owner ID
   * @returns {Object} API key details
   */
  async getApiKeyById(apiKeyId, ownerId) {
    try {
      const apiKey = await this.prisma.apiKey.findFirst({
        where: {
          api_key_id: apiKeyId,
          owner_id: ownerId
        }
      });

      if (!apiKey) {
        throw new NotFoundError('API key not found');
      }

      return {
        api_key_id: apiKey.api_key_id,
        name: apiKey.name,
        key_value: this.maskApiKey(apiKey.key_value),
        permissions: apiKey.permissions,
        is_active: apiKey.is_active,
        last_used_at: apiKey.last_used_at,
        expires_at: apiKey.expires_at,
        create_at: apiKey.create_at,
        update_at: apiKey.update_at
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error('Error getting API key:', error);
      throw new AppError('Failed to get API key', 500);
    }
  }

  /**
   * Update API key
   * @param {string} apiKeyId - API key ID
   * @param {string} ownerId - Owner ID
   * @param {Object} data - Update data
   * @returns {Object} Updated API key
   */
  async updateApiKey(apiKeyId, ownerId, data) {
    try {
      const { name, permissions, is_active, expiresAt } = data;

      // Check if API key exists
      const existingKey = await this.prisma.apiKey.findFirst({
        where: {
          api_key_id: apiKeyId,
          owner_id: ownerId
        }
      });

      if (!existingKey) {
        throw new NotFoundError('API key not found');
      }

      // Validate permissions if provided
      if (permissions) {
        const validPermissions = new Set(['features:read', 'features:write', 'features:delete', 'plans:read', 'plans:write', 'members:read']);
        const invalidPermissions = permissions.filter(p => !validPermissions.has(p));
        if (invalidPermissions.length > 0) {
          throw new ValidationError(`Invalid permissions: ${invalidPermissions.join(', ')}`);
        }
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (permissions !== undefined) updateData.permissions = permissions;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (expiresAt !== undefined) updateData.expires_at = expiresAt ? new Date(expiresAt) : null;

      const updatedKey = await this.prisma.apiKey.update({
        where: { api_key_id: apiKeyId },
        data: updateData
      });

      return {
        api_key_id: updatedKey.api_key_id,
        name: updatedKey.name,
        key_value: this.maskApiKey(updatedKey.key_value),
        permissions: updatedKey.permissions,
        is_active: updatedKey.is_active,
        last_used_at: updatedKey.last_used_at,
        expires_at: updatedKey.expires_at,
        create_at: updatedKey.create_at,
        update_at: updatedKey.update_at
      };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('Error updating API key:', error);
      throw new AppError('Failed to update API key', 500);
    }
  }

  /**
   * Delete API key
   * @param {string} apiKeyId - API key ID
   * @param {string} ownerId - Owner ID
   * @returns {boolean} Success status
   */
  async deleteApiKey(apiKeyId, ownerId) {
    try {
      const existingKey = await this.prisma.apiKey.findFirst({
        where: {
          api_key_id: apiKeyId,
          owner_id: ownerId
        }
      });

      if (!existingKey) {
        throw new NotFoundError('API key not found');
      }

      await this.prisma.apiKey.delete({
        where: { api_key_id: apiKeyId }
      });

      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error('Error deleting API key:', error);
      throw new AppError('Failed to delete API key', 500);
    }
  }

  /**
   * Validate API key
   * @param {string} keyValue - API key value
   * @returns {Object} API key data if valid
   */
  async validateApiKey(keyValue) {
    try {
      const apiKey = await this.prisma.apiKey.findUnique({
        where: { key_value: keyValue },
        include: {
          owner: {
            select: {
              owner_id: true,
              org_name: true,
              email: true
            }
          }
        }
      });

      if (!apiKey) {
        return null;
      }

      // Check if key is active
      if (!apiKey.is_active) {
        return null;
      }

      // Check if key is expired
      if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
        return null;
      }

      // Update last used time
      await this.prisma.apiKey.update({
        where: { api_key_id: apiKey.api_key_id },
        data: { last_used_at: new Date() }
      });

      return {
        api_key_id: apiKey.api_key_id,
        owner_id: apiKey.owner_id,
        permissions: apiKey.permissions,
        owner: apiKey.owner
      };
    } catch (error) {
      console.error('Error validating API key:', error);
      return null;
    }
  }

  /**
   * Generate a secure API key
   * @returns {string} Generated API key
   */
  generateApiKey() {
    // Generate a 32-byte random string and encode as base64
    const randomBytes = crypto.randomBytes(32);
    const base64Key = randomBytes.toString('base64');
    
    // Add prefix for identification
    return `mb_${base64Key}`;
  }

  /**
   * Mask API key for display
   * @param {string} keyValue - Full API key value
   * @returns {string} Masked API key
   */
  maskApiKey(keyValue) {
    if (!keyValue || keyValue.length < 12) {
      return keyValue;
    }
    
    const start = keyValue.substring(0, 8);
    const end = keyValue.substring(keyValue.length - 4);
    const middle = '*'.repeat(Math.max(0, keyValue.length - 12));
    
    return `${start}${middle}${end}`;
  }
}

module.exports = ApiKeyService;

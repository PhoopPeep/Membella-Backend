const FeatureRepository = require('../repositories/featureRepository');
const Feature = require('../models/Features');
const { ValidationError, NotFoundError } = require('../utils/errorHandler');

class FeaturesService {
  constructor() {
    this.featureRepository = new FeatureRepository();
  }

  async getAllFeatures(ownerId) {
    return await this.featureRepository.findAll(ownerId);
  }

  async getFeatureById(id, ownerId) {
    const feature = await this.featureRepository.findById(id, ownerId);
    if (!feature) {
      throw new NotFoundError('Feature not found');
    }
    return feature;
  }

  async createFeature(featureData, ownerId) {
    // Validate input
    const validationErrors = Feature.validate(featureData);
    if (validationErrors.length > 0) {
      throw new ValidationError('Validation failed', validationErrors);
    }

    const newFeature = await this.featureRepository.create({
      name: featureData.name.trim(),
      description: featureData.description.trim(),
      owner_id: ownerId
    });

    return {
      success: true,
      message: 'Feature created successfully',
      data: newFeature
    };
  }

  async updateFeature(id, featureData, ownerId) {
    // Check if feature exists
    const existingFeature = await this.featureRepository.findById(id, ownerId);
    if (!existingFeature) {
      throw new NotFoundError('Feature not found');
    }

    // Validate input
    const validationErrors = Feature.validate(featureData);
    if (validationErrors.length > 0) {
      throw new ValidationError('Validation failed', validationErrors);
    }

    const updatedFeature = await this.featureRepository.update(id, {
      name: featureData.name.trim(),
      description: featureData.description.trim()
    });

    return {
      success: true,
      message: 'Feature updated successfully',
      data: updatedFeature
    };
  }

  async deleteFeature(id, ownerId) {
    // Check if feature exists
    const existingFeature = await this.featureRepository.findById(id, ownerId);
    if (!existingFeature) {
      throw new NotFoundError('Feature not found');
    }

    await this.featureRepository.softDelete(id);

    return {
      success: true,
      message: 'Feature deleted successfully'
    };
  }
}

module.exports = FeaturesService;
const FeaturesService = require('../services/featuresService');
const { asyncHandler } = require('../utils/errorHandler');

class FeaturesController {
  constructor() {
    this.featuresService = new FeaturesService();
  }

  getFeatures = asyncHandler(async (req, res) => {
    const features = await this.featuresService.getAllFeatures(req.user.userId);
    
    res.json({
      success: true,
      data: features
    });
  });

  getFeatureById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const feature = await this.featuresService.getFeatureById(id, req.user.userId);
    
    res.json({
      success: true,
      data: feature
    });
  });

  createFeature = asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    
    const result = await this.featuresService.createFeature(
      { name, description },
      req.user.userId
    );
    
    res.status(201).json(result);
  });

  updateFeature = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    
    const result = await this.featuresService.updateFeature(
      id,
      { name, description },
      req.user.userId
    );
    
    res.json(result);
  });

  deleteFeature = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const result = await this.featuresService.deleteFeature(id, req.user.userId);
    
    res.json(result);
  });
}

module.exports = FeaturesController;
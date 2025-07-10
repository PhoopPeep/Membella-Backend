const { PrismaClient } = require('../generated/prisma/client');
const { authenticateToken } = require('./auth');

// Import error handling utilities
const {
  asyncHandler,
  NotFoundError,
  logger
} = require('./utils/errorHandler');

// Import validation utilities
const { featureValidations } = require('./utils/validation');

const prisma = new PrismaClient();

// Get all features for the authenticated user
const getFeatures = asyncHandler(async (req, res) => {
  const features = await prisma.feature.findMany({
    where: {
      owner_id: req.user.userId,
      delete_at: null
    },
    orderBy: {
      create_at: 'desc'
    }
  });

  res.json({
    success: true,
    data: features
  });
});

// Get a single feature by ID
const getFeatureById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const feature = await prisma.feature.findFirst({
    where: {
      feature_id: id,
      owner_id: req.user.userId,
      delete_at: null
    }
  });

  if (!feature) {
    throw new NotFoundError('Feature not found');
  }

  res.json({
    success: true,
    data: feature
  });
});

// Create a new feature
const createFeature = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const feature = await prisma.feature.create({
    data: {
      name: name.trim(),
      description: description.trim(),
      owner_id: req.user.userId
    }
  });

  res.status(201).json({
    success: true,
    message: 'Feature created successfully',
    data: feature
  });
});

// Update a feature
const updateFeature = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  // Check if feature exists and belongs to user
  const existingFeature = await prisma.feature.findFirst({
    where: {
      feature_id: id,
      owner_id: req.user.userId,
      delete_at: null
    }
  });

  if (!existingFeature) {
    throw new NotFoundError('Feature not found');
  }

  const feature = await prisma.feature.update({
    where: {
      feature_id: id
    },
    data: {
      name: name.trim(),
      description: description.trim(),
      update_at: new Date()
    }
  });

  res.json({
    success: true,
    message: 'Feature updated successfully',
    data: feature
  });
});

// Soft delete a feature
const deleteFeature = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if feature exists and belongs to user
  const existingFeature = await prisma.feature.findFirst({
    where: {
      feature_id: id,
      owner_id: req.user.userId,
      delete_at: null
    }
  });

  if (!existingFeature) {
    throw new NotFoundError('Feature not found');
  }

  // Soft delete the feature
  await prisma.feature.update({
    where: {
      feature_id: id
    },
    data: {
      delete_at: new Date()
    }
  });

  res.json({
    success: true,
    message: 'Feature deleted successfully'
  });
});

module.exports = {
  getFeatures,
  getFeatureById,
  createFeature,
  updateFeature,
  deleteFeature
};
const { PrismaClient } = require('../generated/prisma/client');
const { authenticateToken } = require('./auth');

const prisma = new PrismaClient();

// Get all features for the authenticated user
async function getFeatures(req, res) {
  try {
    const features = await prisma.feature.findMany({
      where: {
        owner_id: req.user.userId,
        delete_at: null
      },
      orderBy: {
        create_at: 'desc'
      }
    });

    res.json(features);
  } catch (error) {
    console.error('Get features error:', error);
    res.status(500).json({ message: 'Failed to fetch features' });
  }
}

// Get a single feature by ID
async function getFeatureById(req, res) {
  try {
    const { id } = req.params;
    
    const feature = await prisma.feature.findFirst({
      where: {
        feature_id: id,
        owner_id: req.user.userId,
        delete_at: null
      }
    });

    if (!feature) {
      return res.status(404).json({ message: 'Feature not found' });
    }

    res.json(feature);
  } catch (error) {
    console.error('Get feature error:', error);
    res.status(500).json({ message: 'Failed to fetch feature' });
  }
}

// Create a new feature
async function createFeature(req, res) {
  try {
    const { name, description } = req.body;

    if (!name || !description) {
      return res.status(400).json({ message: 'Name and description are required' });
    }

    const feature = await prisma.feature.create({
      data: {
        name: name.trim(),
        description: description.trim(),
        owner_id: req.user.userId
      }
    });

    res.status(201).json({
      message: 'Feature created successfully',
      feature
    });
  } catch (error) {
    console.error('Create feature error:', error);
    res.status(500).json({ message: 'Failed to create feature' });
  }
}

// Update a feature
async function updateFeature(req, res) {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || !description) {
      return res.status(400).json({ message: 'Name and description are required' });
    }

    // Check if feature exists and belongs to user
    const existingFeature = await prisma.feature.findFirst({
      where: {
        feature_id: id,
        owner_id: req.user.userId,
        delete_at: null
      }
    });

    if (!existingFeature) {
      return res.status(404).json({ message: 'Feature not found' });
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
      message: 'Feature updated successfully',
      feature
    });
  } catch (error) {
    console.error('Update feature error:', error);
    res.status(500).json({ message: 'Failed to update feature' });
  }
}

// Soft delete a feature
async function deleteFeature(req, res) {
  try {
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
      return res.status(404).json({ message: 'Feature not found' });
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

    res.json({ message: 'Feature deleted successfully' });
  } catch (error) {
    console.error('Delete feature error:', error);
    res.status(500).json({ message: 'Failed to delete feature' });
  }
}

module.exports = {
  getFeatures,
  getFeatureById,
  createFeature,
  updateFeature,
  deleteFeature
};
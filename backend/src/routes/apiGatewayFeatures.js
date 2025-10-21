/**
 * API Gateway Features Routes
 */

const express = require('express');
const { apiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * POST /api/gateway/features/sync
 * Sync features from API Gateway
 */
router.post('/sync', apiRateLimiter, async (req, res) => {
  try {
    const { features, ownerId } = req.body;

    if (!features || !Array.isArray(features)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid request: features array is required',
          statusCode: 400,
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!ownerId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid request: ownerId is required',
          statusCode: 400,
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log(`Received sync request for ${features.length} features from owner ${ownerId}`);

    const results = {
      created: [],
      updated: [],
      failed: []
    };

    // Process each feature
    for (const feature of features) {
      try {
        const featureData = {
          name: feature.name,
          description: feature.description || '',
          owner_id: ownerId,
          external_id: feature.feature_id || feature.external_id,
          source: 'api-gateway'
        };

        // Check if feature already exists by external_id
        let existingFeature = null;
        if (feature.membella_feature_id) {
          // Use Prisma to find existing feature
          const { PrismaClient } = require('@prisma/client');
          const prisma = new PrismaClient();
          
          existingFeature = await prisma.feature.findUnique({
            where: { feature_id: feature.membella_feature_id }
          });

          await prisma.$disconnect();
        }

        if (existingFeature) {
          // Update existing feature
          const { PrismaClient } = require('@prisma/client');
          const prisma = new PrismaClient();

          const updated = await prisma.feature.update({
            where: { feature_id: feature.membella_feature_id },
            data: {
              name: featureData.name,
              description: featureData.description,
              update_at: new Date()
            }
          });

          await prisma.$disconnect();

          results.updated.push({
            feature_id: updated.feature_id,
            external_id: featureData.external_id,
            name: updated.name
          });
        } else {
          // Create new feature
          const { PrismaClient } = require('@prisma/client');
          const prisma = new PrismaClient();

          const created = await prisma.feature.create({
            data: {
              name: featureData.name,
              description: featureData.description,
              owner_id: ownerId,
              create_at: new Date(),
              update_at: new Date()
            }
          });

          await prisma.$disconnect();

          results.created.push({
            feature_id: created.feature_id,
            external_id: featureData.external_id,
            name: created.name
          });
        }
      } catch (error) {
        console.error('Error processing feature:', error);
        results.failed.push({
          feature: feature.name,
          error: error.message
        });
      }
    }

    const totalProcessed = results.created.length + results.updated.length;
    console.log(`Sync completed: ${results.created.length} created, ${results.updated.length} updated, ${results.failed.length} failed`);

    res.status(200).json({
      success: true,
      data: {
        synced_count: totalProcessed,
        created: results.created.length,
        updated: results.updated.length,
        failed: results.failed.length,
        details: results
      },
      message: `Successfully synced ${totalProcessed} features`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Sync features error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to sync features',
        details: error.message,
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/gateway/features
 * Create a single feature from API Gateway
 */
router.post('/', apiRateLimiter, async (req, res) => {
  try {
    const { name, description, ownerId } = req.body;

    if (!name || !ownerId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'name and ownerId are required',
          statusCode: 400,
          timestamp: new Date().toISOString()
        }
      });
    }

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const feature = await prisma.feature.create({
      data: {
        name,
        description: description || '',
        owner_id: ownerId,
        create_at: new Date(),
        update_at: new Date()
      }
    });

    await prisma.$disconnect();

    res.status(201).json({
      success: true,
      data: {
        feature: {
          feature_id: feature.feature_id,
          name: feature.name,
          description: feature.description,
          owner_id: feature.owner_id,
          created_at: feature.create_at,
          updated_at: feature.update_at
        }
      },
      message: 'Feature created successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Create feature error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create feature',
        details: error.message,
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * PUT /api/gateway/features/:id
 * Update a feature from API Gateway
 */
router.put('/:id', apiRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const feature = await prisma.feature.update({
      where: { feature_id: id },
      data: {
        name,
        description,
        update_at: new Date()
      }
    });

    await prisma.$disconnect();

    res.status(200).json({
      success: true,
      data: {
        feature: {
          feature_id: feature.feature_id,
          name: feature.name,
          description: feature.description,
          updated_at: feature.update_at
        }
      },
      message: 'Feature updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Update feature error:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Feature not found',
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update feature',
        details: error.message,
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;


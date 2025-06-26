const { PrismaClient } = require('../generated/prisma/client');
const { authenticateToken } = require('./auth');

const prisma = new PrismaClient();

// Get all plans for the authenticated user
async function getPlans(req, res) {
  try {
    const plans = await prisma.plan.findMany({
      where: {
        owner_id: req.user.userId,
        delete_at: null
      },
      include: {
        plan_features: {
          include: {
            feature: true
          }
        }
      },
      orderBy: {
        create_at: 'desc'
      }
    });

    // Transform the data to match frontend expectations
    const transformedPlans = plans.map(plan => ({
      id: plan.plan_id,
      name: plan.name,
      description: plan.description,
      price: parseFloat(plan.price.toString()),
      duration: plan.duration,
      features: plan.plan_features.map(pf => pf.feature_id),
      createdAt: plan.create_at,
      updatedAt: plan.update_at
    }));

    res.json(transformedPlans);
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ message: 'Failed to fetch plans' });
  }
}

// Get a single plan by ID
async function getPlanById(req, res) {
  try {
    const { id } = req.params;
    
    const plan = await prisma.plan.findFirst({
      where: {
        plan_id: id,
        owner_id: req.user.userId,
        delete_at: null
      },
      include: {
        plan_features: {
          include: {
            feature: true
          }
        }
      }
    });

    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    // Transform the data to match frontend expectations
    const transformedPlan = {
      id: plan.plan_id,
      name: plan.name,
      description: plan.description,
      price: parseFloat(plan.price.toString()),
      duration: plan.duration,
      features: plan.plan_features.map(pf => pf.feature_id),
      createdAt: plan.create_at,
      updatedAt: plan.update_at
    };

    res.json(transformedPlan);
  } catch (error) {
    console.error('Get plan error:', error);
    res.status(500).json({ message: 'Failed to fetch plan' });
  }
}

// Create a new plan
async function createPlan(req, res) {
  try {
    const { name, description, price, duration, features = [] } = req.body;

    if (!name || !description || !price || !duration) {
      return res.status(400).json({ message: 'Name, description, price, and duration are required' });
    }

    // Start a transaction to create plan and its features
    const result = await prisma.$transaction(async (tx) => {
      // Create the plan
      const plan = await tx.plan.create({
        data: {
          name: name.trim(),
          description: description.trim(),
          price: parseFloat(price),
          duration: parseInt(duration),
          owner_id: req.user.userId
        }
      });

      // Create plan-feature relationships if features are provided
      if (features.length > 0) {
        // Verify that all features belong to the user
        const userFeatures = await tx.feature.findMany({
          where: {
            feature_id: { in: features },
            owner_id: req.user.userId,
            delete_at: null
          }
        });

        if (userFeatures.length !== features.length) {
          throw new Error('Some features do not exist or do not belong to you');
        }

        // Create plan-feature relationships
        await tx.planFeature.createMany({
          data: features.map(featureId => ({
            plan_id: plan.plan_id,
            feature_id: featureId
          }))
        });
      }

      return plan;
    });

    // Transform the response
    const transformedPlan = {
      id: result.plan_id,
      name: result.name,
      description: result.description,
      price: parseFloat(result.price.toString()),
      duration: result.duration,
      features: features,
      createdAt: result.create_at,
      updatedAt: result.update_at
    };

    res.status(201).json({
      message: 'Plan created successfully',
      plan: transformedPlan
    });
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ message: 'Failed to create plan' });
  }
}

// Update a plan
async function updatePlan(req, res) {
  try {
    const { id } = req.params;
    const { name, description, price, duration, features = [] } = req.body;

    if (!name || !description || !price || !duration) {
      return res.status(400).json({ message: 'Name, description, price, and duration are required' });
    }

    // Check if plan exists and belongs to user
    const existingPlan = await prisma.plan.findFirst({
      where: {
        plan_id: id,
        owner_id: req.user.userId,
        delete_at: null
      }
    });

    if (!existingPlan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    // Start a transaction to update plan and its features
    const result = await prisma.$transaction(async (tx) => {
      // Update the plan
      const plan = await tx.plan.update({
        where: {
          plan_id: id
        },
        data: {
          name: name.trim(),
          description: description.trim(),
          price: parseFloat(price),
          duration: parseInt(duration),
          update_at: new Date()
        }
      });

      // Remove existing plan-feature relationships
      await tx.planFeature.deleteMany({
        where: {
          plan_id: id
        }
      });

      // Create new plan-feature relationships if features are provided
      if (features.length > 0) {
        // Verify that all features belong to the user
        const userFeatures = await tx.feature.findMany({
          where: {
            feature_id: { in: features },
            owner_id: req.user.userId,
            delete_at: null
          }
        });

        if (userFeatures.length !== features.length) {
          throw new Error('Some features do not exist or do not belong to you');
        }

        // Create plan-feature relationships
        await tx.planFeature.createMany({
          data: features.map(featureId => ({
            plan_id: plan.plan_id,
            feature_id: featureId
          }))
        });
      }

      return plan;
    });

    // Transform the response
    const transformedPlan = {
      id: result.plan_id,
      name: result.name,
      description: result.description,
      price: parseFloat(result.price.toString()),
      duration: result.duration,
      features: features,
      createdAt: result.create_at,
      updatedAt: result.update_at
    };

    res.json({
      message: 'Plan updated successfully',
      plan: transformedPlan
    });
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ message: 'Failed to update plan' });
  }
}

// Soft delete a plan
async function deletePlan(req, res) {
  try {
    const { id } = req.params;

    // Check if plan exists and belongs to user
    const existingPlan = await prisma.plan.findFirst({
      where: {
        plan_id: id,
        owner_id: req.user.userId,
        delete_at: null
      }
    });

    if (!existingPlan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    // Soft delete the plan
    await prisma.plan.update({
      where: {
        plan_id: id
      },
      data: {
        delete_at: new Date()
      }
    });

    res.json({ message: 'Plan deleted successfully' });
  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({ message: 'Failed to delete plan' });
  }
}

module.exports = {
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan
};
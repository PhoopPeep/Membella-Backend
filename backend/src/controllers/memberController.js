const { getPrismaClient } = require('../config/database');
const { asyncHandler } = require('../utils/errorHandler');

const prisma = getPrismaClient();

class MemberController {
  // Get available plans for members
  getAvailablePlans = asyncHandler(async (req, res) => {
    const plans = await prisma.plan.findMany({
      where: {
        delete_at: null
      },
      include: {
        plan_features: {
          include: {
            feature: {
              where: {
                delete_at: null
              }
            }
          }
        },
        owner: {
          select: {
            org_name: true,
            email: true
          }
        }
      },
      orderBy: {
        price: 'asc'
      }
    });

    // Transform data for member view
    const transformedPlans = plans.map(plan => ({
      id: plan.plan_id,
      name: plan.name,
      description: plan.description,
      price: parseFloat(plan.price.toString()),
      duration: plan.duration,
      organization: plan.owner.org_name,
      features: plan.plan_features.map(pf => ({
        id: pf.feature.feature_id,
        name: pf.feature.name,
        description: pf.feature.description
      })),
      createdAt: plan.create_at
    }));

    res.json(transformedPlans);
  });

  // Member subscription (mockup for now)
  subscribe = asyncHandler(async (req, res) => {
    const { planId } = req.body;
    const memberId = req.user.userId;

    // TODO: subscription table
    // for now mockup response
    res.json({
      success: true,
      message: 'Subscription successful! (Mockup)',
      subscription: {
        id: 'sub_' + Math.random().toString(36).substr(2, 9),
        planId,
        memberId,
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    });
  });

  // Get member's subscription status (mockup)
  getSubscription = asyncHandler(async (req, res) => {
    const memberId = req.user.userId;

    // Mockup subscription data
    res.json({
      subscription: {
        id: 'sub_mock123',
        status: 'active',
        planName: 'Basic Plan',
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-02-01T00:00:00.000Z',
        daysRemaining: 15
      }
    });
  });
}

module.exports = MemberController;
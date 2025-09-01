const { getPrismaClient } = require('../config/database');
const { asyncHandler } = require('../utils/errorHandler');

const prisma = getPrismaClient();

class SubscriptionController {
  // Get member's active subscriptions
  getMemberSubscriptions = asyncHandler(async (req, res) => {
    try {
      const memberId = req.user.userId;

      console.log('Getting subscriptions for member:', memberId);

      const subscriptions = await prisma.subscription.findMany({
        where: {
          member_id: memberId
        },
        include: {
          plan: {
            include: {
              owner: {
                select: {
                  org_name: true,
                  email: true
                }
              },
              plan_features: {
                include: {
                  feature: {
                    select: {
                      feature_id: true,
                      name: true,
                      description: true
                    }
                  }
                }
              }
            }
          },
          payment: {
            select: {
              amount: true,
              currency: true,
              payment_method: true,
              create_at: true
            }
          }
        },
        orderBy: {
          create_at: 'desc'
        }
      });

      const transformedSubscriptions = subscriptions.map(subscription => {
        // Calculate days remaining
        const now = new Date();
        const endDate = new Date(subscription.end_date);
        const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));

        return {
          id: subscription.subscription_id,
          planId: subscription.plan_id,
          planName: subscription.plan.name,
          planDescription: subscription.plan.description,
          organization: subscription.plan.owner.org_name,
          price: parseFloat(subscription.plan.price.toString()),
          duration: subscription.plan.duration,
          status: subscription.status,
          startDate: subscription.start_date,
          endDate: subscription.end_date,
          daysRemaining,
          isActive: subscription.status === 'active' && daysRemaining > 0,
          isExpired: subscription.status === 'expired' || daysRemaining <= 0,
          features: subscription.plan.plan_features
            .filter(pf => pf.feature && !pf.feature.delete_at)
            .map(pf => ({
              id: pf.feature.feature_id,
              name: pf.feature.name,
              description: pf.feature.description
            })),
          payment: {
            amount: parseFloat(subscription.payment.amount.toString()),
            currency: subscription.payment.currency,
            method: subscription.payment.payment_method,
            paidAt: subscription.payment.create_at
          },
          createdAt: subscription.create_at,
          updatedAt: subscription.update_at
        };
      });

      res.json({
        success: true,
        data: transformedSubscriptions
      });

    } catch (error) {
      console.error('SubscriptionController get member subscriptions error:', error);
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get subscriptions'
      });
    }
  });

  // Get specific subscription details
  getSubscriptionById = asyncHandler(async (req, res) => {
    try {
      const { subscriptionId } = req.params;
      const memberId = req.user.userId;

      console.log('Getting subscription details:', subscriptionId);

      const subscription = await prisma.subscription.findFirst({
        where: {
          subscription_id: subscriptionId,
          member_id: memberId
        },
        include: {
          plan: {
            include: {
              owner: {
                select: {
                  org_name: true,
                  email: true,
                  contact_info: true
                }
              },
              plan_features: {
                include: {
                  feature: {
                    select: {
                      feature_id: true,
                      name: true,
                      description: true
                    }
                  }
                }
              }
            }
          },
          payment: {
            select: {
              payment_id: true,
              amount: true,
              currency: true,
              payment_method: true,
              status: true,
              description: true,
              create_at: true
            }
          },
          member: {
            select: {
              full_name: true,
              email: true
            }
          }
        }
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Subscription not found'
        });
      }

      // Calculate days remaining
      const now = new Date();
      const endDate = new Date(subscription.end_date);
      const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));

              const transformedSubscription = {
        id: subscription.subscription_id,
        planId: subscription.plan_id,
        planName: subscription.plan.name,
        planDescription: subscription.plan.description,
        organization: subscription.plan.owner.org_name,
        organizationContact: subscription.plan.owner.contact_info,
        price: parseFloat(subscription.plan.price.toString()),
        duration: subscription.plan.duration,
        status: subscription.status,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
        daysRemaining,
        isActive: subscription.status === 'active' && daysRemaining > 0,
        isExpired: subscription.status === 'expired' || daysRemaining <= 0,
        features: subscription.plan.plan_features
          .filter(pf => pf.feature && !pf.feature.delete_at)
          .map(pf => ({
            id: pf.feature.feature_id,
            name: pf.feature.name,
            description: pf.feature.description
          })),
        payment: {
          id: subscription.payment.payment_id,
          amount: parseFloat(subscription.payment.amount.toString()),
          currency: subscription.payment.currency,
          method: subscription.payment.payment_method,
          status: subscription.payment.status,
          description: subscription.payment.description,
          paidAt: subscription.payment.create_at
        },
        member: {
          name: subscription.member.full_name,
          email: subscription.member.email
        },
        createdAt: subscription.create_at,
        updatedAt: subscription.update_at
      };

      res.json({
        success: true,
        data: transformedSubscription
      });

    } catch (error) {
      console.error('SubscriptionController get subscription by ID error:', error);
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get subscription details'
      });
    }
  });

  // Get subscription statistics for member
  getSubscriptionStats = asyncHandler(async (req, res) => {
    try {
      const memberId = req.user.userId;

      console.log('Getting subscription stats for member:', memberId);

      const stats = await prisma.subscription.groupBy({
        by: ['status'],
        where: {
          member_id: memberId
        },
        _count: {
          status: true
        }
      });

      const totalSpent = await prisma.payment.aggregate({
        where: {
          member_id: memberId,
          status: 'successful'
        },
        _sum: {
          amount: true
        }
      });

      const activeSubscriptions = await prisma.subscription.count({
        where: {
          member_id: memberId,
          status: 'active',
          end_date: {
            gt: new Date()
          }
        }
      });

      const expiredSubscriptions = await prisma.subscription.count({
        where: {
          member_id: memberId,
          OR: [
            { status: 'expired' },
            {
              status: 'active',
              end_date: {
                lte: new Date()
              }
            }
          ]
        }
      });

      const transformedStats = {
        totalSubscriptions: stats.reduce((sum, stat) => sum + stat._count.status, 0),
        activeSubscriptions,
        expiredSubscriptions,
        cancelledSubscriptions: stats.find(s => s.status === 'cancelled')?._count.status || 0,
        totalSpent: parseFloat(totalSpent._sum.amount?.toString() || '0'),
        currency: 'THB'
      };

      res.json({
        success: true,
        data: transformedStats
      });

    } catch (error) {
      console.error('SubscriptionController get subscription stats error:', error);
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get subscription statistics'
      });
    }
  });

  // Update subscription status
  updateSubscriptionStatus = asyncHandler(async (req, res) => {
    try {
      const { subscriptionId } = req.params;
      const { status } = req.body;
      const memberId = req.user.userId;

      if (!['active', 'cancelled', 'expired'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be active, cancelled, or expired'
        });
      }

      console.log('Updating subscription status:', subscriptionId, status);

      // Verify subscription belongs to member
      const subscription = await prisma.subscription.findFirst({
        where: {
          subscription_id: subscriptionId,
          member_id: memberId
        }
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Subscription not found'
        });
      }

      // Update subscription
      const updatedSubscription = await prisma.subscription.update({
        where: { subscription_id: subscriptionId },
        data: {
          status,
          update_at: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Subscription status updated successfully',
        data: {
          id: updatedSubscription.subscription_id,
          status: updatedSubscription.status,
          updatedAt: updatedSubscription.update_at
        }
      });

    } catch (error) {
      console.error('SubscriptionController update subscription status error:', error);
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update subscription status'
      });
    }
  });
}

module.exports = SubscriptionController;
const { getPrismaClient } = require('../config/database');
const { asyncHandler } = require('../utils/errorHandler');

const prisma = getPrismaClient();

class DashboardController {
  getDashboardStats = asyncHandler(async (req, res) => {
    const ownerId = req.user.userId;

    // Get current date and calculate previous month dates
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get total plans count
    const totalPlans = await prisma.plan.count({
      where: {
        owner_id: ownerId,
        delete_at: null
      }
    });

    // Get total features count
    const totalFeatures = await prisma.feature.count({
      where: {
        owner_id: ownerId,
        delete_at: null
      }
    });

    // Get actual subscriptions data
    const totalSubscriptions = await prisma.subscription.count({
      where: {
        plan: {
          owner_id: ownerId
        }
      }
    });

    const activeSubscriptions = await prisma.subscription.count({
      where: {
        plan: {
          owner_id: ownerId
        },
        status: 'active'
      }
    });

    const cancelledSubscriptions = await prisma.subscription.count({
      where: {
        plan: {
          owner_id: ownerId
        },
        status: 'cancelled'
      }
    });

    // Get unique members count
    const uniqueMembers = await prisma.subscription.findMany({
      where: {
        plan: {
          owner_id: ownerId
        }
      },
      select: {
        member_id: true
      },
      distinct: ['member_id']
    });
    const totalMembers = uniqueMembers.length;

    // Calculate actual revenue from subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: {
        plan: {
          owner_id: ownerId
        }
      },
      include: {
        plan: {
          select: {
            price: true
          }
        }
      }
    });

    const totalRevenue = subscriptions.reduce((sum, subscription) => {
      return sum + Number.parseFloat(subscription.plan.price.toString());
    }, 0);

    // Calculate revenue for this month
    const thisMonthSubscriptions = await prisma.subscription.findMany({
      where: {
        plan: {
          owner_id: ownerId
        },
        create_at: {
          gte: currentMonthStart
        }
      },
      include: {
        plan: {
          select: {
            price: true
          }
        }
      }
    });

    const revenueThisMonth = thisMonthSubscriptions.reduce((sum, subscription) => {
      return sum + Number.parseFloat(subscription.plan.price.toString());
    }, 0);

    // Calculate revenue for last month
    const lastMonthSubscriptions = await prisma.subscription.findMany({
      where: {
        plan: {
          owner_id: ownerId
        },
        create_at: {
          gte: lastMonthStart,
          lte: lastMonthEnd
        }
      },
      include: {
        plan: {
          select: {
            price: true
          }
        }
      }
    });

    const revenueLastMonth = lastMonthSubscriptions.reduce((sum, subscription) => {
      return sum + Number.parseFloat(subscription.plan.price.toString());
    }, 0);

    // Get new plans this month
    const newPlansThisMonth = await prisma.plan.count({
      where: {
        owner_id: ownerId,
        create_at: {
          gte: currentMonthStart
        },
        delete_at: null
      }
    });

    // Calculate growth percentage
    let growthPercentage = 0;
    if (revenueLastMonth > 0) {
      growthPercentage = Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100);
    } else if (revenueThisMonth > 0) {
      growthPercentage = 100;
    }

    const stats = {
      totalRevenue,
      totalMembers,
      totalPlans,
      totalFeatures,
      growthPercentage,
      activeSubscriptions,
      cancelledSubscriptions,
      totalSubscriptions,
      revenueThisMonth,
      revenueLastMonth,
      newPlansThisMonth
    };

    res.json(stats);
  });

  getRevenueData = asyncHandler(async (req, res) => {
    const ownerId = req.user.userId;
    const { period = '12months' } = req.query;

    let revenueData;

    if (period === '12months') {
      revenueData = await this.getLast12MonthsRevenue(ownerId);
    } else if (period === '6months') {
      revenueData = await this.getLast6MonthsRevenue(ownerId);
    } else {
      revenueData = await this.getLast12MonthsRevenue(ownerId);
    }

    res.json(revenueData);
  });

  getMembers = asyncHandler(async (req, res) => {
    const ownerId = req.user.userId;

    // Get actual members who have subscriptions to this owner's plans
    const members = await prisma.member.findMany({
      where: {
        subscriptions: {
          some: {
            plan: {
              owner_id: ownerId
            }
          }
        }
      },
      include: {
        subscriptions: {
          where: {
            plan: {
              owner_id: ownerId
            }
          },
          include: {
            plan: {
              select: {
                name: true,
                price: true
              }
            }
          }
        }
      }
    });

    const transformedMembers = members.map(member => {
      // Get the most recent subscription status
      const latestSubscription = member.subscriptions
        .sort((a, b) => new Date(b.create_at) - new Date(a.create_at))[0];
      
      return {
        id: member.member_id,
        email: member.email,
        fullName: member.full_name,
        status: latestSubscription?.status || 'inactive',
        subscriptionStart: latestSubscription?.start_date || member.create_at,
        subscriptionEnd: latestSubscription?.end_date || null,
        createdAt: member.create_at,
        subscriptions: member.subscriptions.map(sub => ({
          id: sub.subscription_id,
          planName: sub.plan.name,
          status: sub.status,
          startDate: sub.start_date,
          endDate: sub.end_date,
          price: Number.parseFloat(sub.plan.price.toString())
        }))
      };
    });

    res.json(transformedMembers);
  });

  getMembersByPlan = asyncHandler(async (req, res) => {
    const ownerId = req.user.userId;

    // Get actual member counts by plan
    const plans = await prisma.plan.findMany({
      where: {
        owner_id: ownerId,
        delete_at: null
      },
      include: {
        subscriptions: {
          select: {
            member_id: true
          }
        }
      }
    });

    const result = plans.map(plan => ({
      planId: plan.plan_id,
      planName: plan.name,
      memberCount: plan.subscriptions.length
    }));

    res.json(result);
  });

  // Get members for a specific plan
  getPlanMembers = asyncHandler(async (req, res) => {
    const ownerId = req.user.userId;
    const { planId } = req.params;

    console.log('Getting members for plan:', planId, 'owner:', ownerId);

    // Get members who have subscriptions to this specific plan
    const members = await prisma.member.findMany({
      where: {
        subscriptions: {
          some: {
            plan: {
              plan_id: planId,
              owner_id: ownerId
            }
          }
        }
      },
      include: {
        subscriptions: {
          where: {
            plan: {
              plan_id: planId,
              owner_id: ownerId
            }
          },
          include: {
            plan: {
              select: {
                plan_id: true,
                name: true,
                price: true
              }
            }
          }
        },
        payments: {
          where: {
            plan: {
              owner_id: ownerId
            }
          },
          include: {
            plan: {
              select: {
                plan_id: true,
                name: true
              }
            }
          },
          orderBy: {
            create_at: 'desc'
          }
        }
      },
      orderBy: {
        create_at: 'desc'
      }
    });

    // Transform the data to match frontend expectations
    const transformedMembers = members.map(member => {
      const allPayments = member.payments.map(payment => ({
        id: payment.payment_id,
        amount: Number.parseFloat(payment.amount.toString()),
        status: payment.status,
        planName: payment.plan.name,
        createdAt: payment.create_at
      }));

      return {
        id: member.member_id,
        email: member.email,
        fullName: member.full_name,
        createdAt: member.create_at,
        planId: planId,
        status: member.subscriptions[0]?.status || 'active',
        subscriptionStart: member.subscriptions[0]?.start_date || member.create_at,
        subscriptionEnd: member.subscriptions[0]?.end_date || null,
        paymentHistory: allPayments,
        totalSpent: allPayments
          .filter(p => p.status === 'successful')
          .reduce((sum, p) => sum + p.amount, 0)
      };
    });

    console.log(`Found ${transformedMembers.length} members for plan ${planId}`);

    res.json(transformedMembers);
  });

  // Delete a member (remove from owner's plans)
  deleteMember = asyncHandler(async (req, res) => {
    const ownerId = req.user.userId;
    const { memberId } = req.params;

    console.log('Removing member from owner plans:', memberId, 'for owner:', ownerId);

    // First, verify that the member belongs to this owner's plans
    const member = await prisma.member.findFirst({
      where: {
        member_id: memberId,
        subscriptions: {
          some: {
            plan: {
              owner_id: ownerId
            }
          }
        }
      },
      include: {
        subscriptions: {
          where: {
            plan: {
              owner_id: ownerId
            }
          }
        }
      }
    });

    if (!member) {
      return res.status(404).json({ 
        success: false,
        message: 'Member not found or does not belong to your plans' 
      });
    }

    // Check if member has any active subscriptions
    const hasActiveSubscription = member.subscriptions.some(sub => sub.status === 'active');

    if (hasActiveSubscription) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove member with active subscription',
        detail: 'Member still has an active subscription. Please wait for the subscription to expire or cancel it first.'
      });
    }

    // Delete member's payments related to this owner
    const deletedPayments = await prisma.payment.deleteMany({
      where: {
        member_id: memberId,
        plan: {
          owner_id: ownerId
        }
      }
    });

    // Delete member's subscriptions related to this owner (only non-active ones)
    const deletedSubscriptions = await prisma.subscription.deleteMany({
      where: {
        member_id: memberId,
        plan: {
          owner_id: ownerId
        },
        status: {
          not: 'active'
        }
      }
    });

    console.log(`Member ${memberId} removed from owner's plans. Deleted ${deletedSubscriptions.count} subscriptions and ${deletedPayments.count} payments`);

    res.json({ 
      success: true,
      message: 'Member removed from your plans successfully',
      removedMember: {
        id: member.member_id,
        email: member.email,
        fullName: member.full_name
      },
      deletedRecords: {
        subscriptions: deletedSubscriptions.count,
        payments: deletedPayments.count
      }
    });
  });

  // Helper methods for revenue calculation
  async calculateMonthlyRevenue(ownerId, startDate, endDate) {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        plan: {
          owner_id: ownerId
        },
        create_at: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        plan: {
          select: {
            price: true
          }
        }
      }
    });

    return subscriptions.reduce((sum, subscription) => {
      return sum + Number.parseFloat(subscription.plan.price.toString());
    }, 0);
  }

  async getLast12MonthsRevenue(ownerId) {
    const months = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthName = monthStart.toLocaleDateString('en-US', { month: 'short' });
      
      // Get actual revenue for this month
      const monthRevenue = await this.calculateMonthlyRevenue(ownerId, monthStart, monthEnd);
      
      months.push({
        month: monthName,
        revenue: Math.round(monthRevenue)
      });
    }

    return months;
  }

  async getLast6MonthsRevenue(ownerId) {
    const months = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthName = monthStart.toLocaleDateString('en-US', { month: 'short' });
      
      // Get actual revenue for this month
      const monthRevenue = await this.calculateMonthlyRevenue(ownerId, monthStart, monthEnd);
      
      months.push({
        month: monthName,
        revenue: Math.round(monthRevenue)
      });
    }

    return months;
  }
}

module.exports = DashboardController;
module.exports = DashboardController;
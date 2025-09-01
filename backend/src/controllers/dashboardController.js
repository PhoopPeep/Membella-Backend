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
    const totalMembers = await prisma.subscription.count({
      where: {
        plan: {
          owner_id: ownerId
        }
      },
      distinct: ['member_id']
    });

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
      return sum + parseFloat(subscription.plan.price.toString());
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
      return sum + parseFloat(subscription.plan.price.toString());
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
      return sum + parseFloat(subscription.plan.price.toString());
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
    const growthPercentage = revenueLastMonth > 0 
      ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
      : revenueThisMonth > 0 ? 100 : 0;

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

    const transformedMembers = members.map(member => ({
      id: member.member_id,
      email: member.email,
      fullName: member.full_name,
      phone: member.phone,
      createdAt: member.create_at,
      subscriptions: member.subscriptions.map(sub => ({
        id: sub.subscription_id,
        planName: sub.plan.name,
        status: sub.status,
        startDate: sub.start_date,
        endDate: sub.end_date,
        price: parseFloat(sub.plan.price.toString())
      }))
    }));

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
      return sum + parseFloat(subscription.plan.price.toString());
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
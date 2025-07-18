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

    // Simulate with plans data
    const totalMembers = 0;
    const activeSubscriptions = 0;
    const cancelledSubscriptions = 0;

    // Calculate estimated revenue based on plan prices
    const plans = await prisma.plan.findMany({
      where: {
        owner_id: ownerId,
        delete_at: null
      },
      select: {
        price: true,
        create_at: true
      }
    });

    // Calculate total revenue from all plans
    const totalRevenue = plans.reduce((sum, plan) => {
      return sum + parseFloat(plan.price.toString());
    }, 0);

    // Calculate revenue for this month
    const revenueThisMonth = plans
      .filter(plan => plan.create_at >= currentMonthStart)
      .reduce((sum, plan) => sum + parseFloat(plan.price.toString()), 0);

    // Calculate revenue for last month
    const revenueLastMonth = plans
      .filter(plan => plan.create_at >= lastMonthStart && plan.create_at <= lastMonthEnd)
      .reduce((sum, plan) => sum + parseFloat(plan.price.toString()), 0);

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
    // Mock members for now
    const transformedMembers = [];
    res.json(transformedMembers);
  });

  getMembersByPlan = asyncHandler(async (req, res) => {
    const ownerId = req.user.userId;

    // Get plans with their feature
    const plans = await prisma.plan.findMany({
      where: {
        owner_id: ownerId,
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

    // Simulate member counts
    const result = plans.map(plan => {
      const featureCount = plan.plan_features.length;
      const daysOld = Math.floor((new Date() - new Date(plan.create_at)) / (1000 * 60 * 60 * 24));
      const price = parseFloat(plan.price.toString());
      
      // Simulate member count
      let memberCount = Math.floor(
        (featureCount * 2) + 
        (daysOld * 0.1) + 
        Math.max(0, (100 - price) * 0.05)
      );
      
      // Add some randomness
      memberCount = Math.max(0, memberCount + Math.floor(Math.random() * 5 - 2));

      return {
        planId: plan.plan_id,
        planName: plan.name,
        memberCount: memberCount
      };
    });

    res.json(result);
  });

  // Helper methods
  async calculateMonthlyRevenue(ownerId, startDate, endDate) {
    const plans = await prisma.plan.findMany({
      where: {
        owner_id: ownerId,
        create_at: {
          gte: startDate,
          lte: endDate
        },
        delete_at: null
      },
      select: {
        price: true
      }
    });

    return plans.reduce((sum, plan) => {
      return sum + parseFloat(plan.price.toString());
    }, 0);
  }

  async getLast12MonthsRevenue(ownerId) {
    const months = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthName = monthStart.toLocaleDateString('en-US', { month: 'short' });
      
      // Get plans created in this month
      const monthRevenue = await this.calculateMonthlyRevenue(ownerId, monthStart, monthEnd);
      
      // Add some variation
      const baseRevenue = monthRevenue || 0;
      const variation = Math.random() * 1000;
      const finalRevenue = Math.max(0, baseRevenue + variation);
      
      months.push({
        month: monthName,
        revenue: Math.round(finalRevenue)
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
      
      // Get plans created in this month
      const monthRevenue = await this.calculateMonthlyRevenue(ownerId, monthStart, monthEnd);
      
      // Add some variation
      const baseRevenue = monthRevenue || 0;
      const variation = Math.random() * 1000;
      const finalRevenue = Math.max(0, baseRevenue + variation);
      
      months.push({
        month: monthName,
        revenue: Math.round(finalRevenue)
      });
    }

    return months;
  }
}

module.exports = DashboardController;
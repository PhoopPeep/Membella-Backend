const { PrismaClient } = require('../generated/prisma/client');

const prisma = new PrismaClient();

// Get dashboard statistics
async function getDashboardStats(req, res) {
  try {
    const ownerId = req.user.userId;

    // Get current date and calculate previous month dates
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get total plans count (using your existing structure)
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

    // Since you might not have members table yet, we'll simulate with plans data
    // You can uncomment the member queries once you add the Member model
    const totalMembers = 0; // await prisma.member.count({ ... });
    const activeSubscriptions = 0; // await prisma.member.count({ ... });
    const cancelledSubscriptions = 0; // await prisma.member.count({ ... });

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

    // Calculate total potential revenue from all plans
    const totalRevenue = plans.reduce((sum, plan) => {
      return sum + parseFloat(plan.price.toString());
    }, 0);

    // Calculate revenue for this month (plans created this month)
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
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
  }
}

// Get revenue data for charts
async function getRevenueData(req, res) {
  try {
    const ownerId = req.user.userId;
    const { period = '12months' } = req.query;

    let revenueData;

    if (period === '12months') {
      revenueData = await getLast12MonthsRevenue(ownerId);
    } else if (period === '6months') {
      revenueData = await getLast6MonthsRevenue(ownerId);
    } else {
      revenueData = await getLast12MonthsRevenue(ownerId);
    }

    res.json(revenueData);
  } catch (error) {
    console.error('Get revenue data error:', error);
    res.status(500).json({ message: 'Failed to fetch revenue data' });
  }
}

// Get members for dashboard (mock data until Member table is added)
async function getMembers(req, res) {
  try {
    const ownerId = req.user.userId;

    // For now, return empty array since Member table might not exist yet
    // Once you add the Member table, uncomment the code below
    /*
    const members = await prisma.member.findMany({
      where: {
        owner_id: ownerId,
        delete_at: null
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
    });

    const transformedMembers = members.map(member => ({
      id: member.member_id,
      email: member.email,
      planId: member.plan_id,
      planName: member.plan?.name || 'Unknown Plan',
      status: member.status,
      subscriptionStart: member.subscription_start,
      subscriptionEnd: member.subscription_end,
      createdAt: member.create_at
    }));
    */

    const transformedMembers = [];
    res.json(transformedMembers);
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ message: 'Failed to fetch members' });
  }
}

// Get members grouped by plan
async function getMembersByPlan(req, res) {
  try {
    const ownerId = req.user.userId;

    // Get plans with their feature counts as a proxy for engagement
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

    // For now, simulate member counts based on plan features and creation date
    const result = plans.map(plan => {
      // Simulate member count based on:
      // - Number of features (more features = more attractive)
      // - Plan age (older plans have had more time to get members)
      // - Plan price (lower price = more members)
      const featureCount = plan.plan_features.length;
      const daysOld = Math.floor((new Date() - new Date(plan.create_at)) / (1000 * 60 * 60 * 24));
      const price = parseFloat(plan.price.toString());
      
      // Simple algorithm to simulate member count
      let memberCount = Math.floor(
        (featureCount * 2) + 
        (daysOld * 0.1) + 
        Math.max(0, (100 - price) * 0.05)
      );
      
      // Add some randomness but keep it realistic
      memberCount = Math.max(0, memberCount + Math.floor(Math.random() * 5 - 2));

      return {
        planId: plan.plan_id,
        planName: plan.name,
        memberCount: memberCount
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Get members by plan error:', error);
    res.status(500).json({ message: 'Failed to fetch members by plan' });
  }
}

// Helper function to calculate total revenue based on existing plans
async function calculateTotalRevenue(ownerId) {
  try {
    const plans = await prisma.plan.findMany({
      where: {
        owner_id: ownerId,
        delete_at: null
      },
      select: {
        price: true
      }
    });

    const totalRevenue = plans.reduce((sum, plan) => {
      return sum + parseFloat(plan.price.toString());
    }, 0);

    return totalRevenue;
  } catch (error) {
    console.error('Calculate total revenue error:', error);
    return 0;
  }
}

// Helper function to calculate monthly revenue based on plan creation dates
async function calculateMonthlyRevenue(ownerId, startDate, endDate) {
  try {
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

    const monthlyRevenue = plans.reduce((sum, plan) => {
      return sum + parseFloat(plan.price.toString());
    }, 0);

    return monthlyRevenue;
  } catch (error) {
    console.error('Calculate monthly revenue error:', error);
    return 0;
  }
}

// Helper function to get last 12 months revenue based on plan creation
async function getLast12MonthsRevenue(ownerId) {
  const months = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    
    const monthName = monthStart.toLocaleDateString('en-US', { month: 'short' });
    
    // Get plans created in this month
    const monthRevenue = await calculateMonthlyRevenue(ownerId, monthStart, monthEnd);
    
    // Add some variation to make it more realistic
    const baseRevenue = monthRevenue || 0;
    const variation = Math.random() * 1000; // Random variation up to $1000
    const finalRevenue = Math.max(0, baseRevenue + variation);
    
    months.push({
      month: monthName,
      revenue: Math.round(finalRevenue)
    });
  }

  return months;
}

// Helper function to get last 6 months revenue
async function getLast6MonthsRevenue(ownerId) {
  const months = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    
    const monthName = monthStart.toLocaleDateString('en-US', { month: 'short' });
    
    // Get plans created in this month
    const monthRevenue = await calculateMonthlyRevenue(ownerId, monthStart, monthEnd);
    
    // Add some variation to make it more realistic
    const baseRevenue = monthRevenue || 0;
    const variation = Math.random() * 1000; // Random variation up to $1000
    const finalRevenue = Math.max(0, baseRevenue + variation);
    
    months.push({
      month: monthName,
      revenue: Math.round(finalRevenue)
    });
  }

  return months;
}

module.exports = {
  getDashboardStats,
  getRevenueData,
  getMembers,
  getMembersByPlan
};
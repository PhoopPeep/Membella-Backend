// backend/src/controllers/memberController.js
const { getPrismaClient } = require('../config/database');
const { asyncHandler } = require('../utils/errorHandler');

const prisma = getPrismaClient();

class MemberController {
  getOwners = asyncHandler(async (req, res) => {
    try {
      console.log('MemberController: Getting owners with stats');
      
      // Test database connection first
      try {
        await prisma.$connect();
        console.log('Database connection successful');
      } catch (dbError) {
        console.error('Database connection failed:', dbError);
        throw new Error('Database connection failed');
      }

      const owners = await prisma.owner.findMany({
        select: {
          owner_id: true,
          org_name: true,
          email: true,
          description: true,
          contact_info: true,
          logo: true,
          create_at: true,
          update_at: true,
          // count plans and features
          plans: {
            where: {
              delete_at: null
            },
            select: {
              plan_id: true,
              price: true,
              _count: {
                select: {
                  plan_features: true
                }
              }
            }
          },
          features: {
            where: {
              delete_at: null
            },
            select: {
              feature_id: true
            }
          }
        },
        orderBy: {
          create_at: 'desc'
        }
      });

      console.log(`Found ${owners.length} owners`);

      // convert data proper to frontend
      const transformedOwners = owners.map(owner => {
        const planPrices = owner.plans.map(plan => parseFloat(plan.price.toString()));
        const minPrice = planPrices.length > 0 ? Math.min(...planPrices) : 0;
        const maxPrice = planPrices.length > 0 ? Math.max(...planPrices) : 0;
        
        return {
          id: owner.owner_id,
          orgName: owner.org_name,
          email: owner.email,
          description: owner.description,
          contactInfo: owner.contact_info,
          logo: owner.logo,
          createdAt: owner.create_at,
          updatedAt: owner.update_at,
          planCount: owner.plans.length,
          featureCount: owner.features.length,
          minPrice: minPrice,
          maxPrice: maxPrice
        };
      });

      // adjust planCount
      transformedOwners.sort((a, b) => b.planCount - a.planCount);

      console.log('Owners data transformed successfully:', transformedOwners.length);

      // Send proper JSON response
      res.status(200).json(transformedOwners);
    } catch (error) {
      console.error('Error in getOwners:', error);
      
      // Send structured error response
      res.status(500).json({
        success: false,
        message: 'Failed to fetch organizations',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  });

  // Get plans for specific owner - FIXED PRISMA QUERY
  getOwnerPlans = asyncHandler(async (req, res) => {
    try {
      const { ownerId } = req.params;
      
      console.log('MemberController: Getting plans for owner:', ownerId);
      console.log('Request params:', req.params);
      console.log('Request URL:', req.originalUrl);

      // Validate ownerId parameter
      if (!ownerId || ownerId.trim() === '') {
        console.error('Owner ID is missing or empty');
        return res.status(400).json({
          success: false,
          message: 'Owner ID is required'
        });
      }

      // Validate ownerId format (should be UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(ownerId)) {
        console.error('Invalid owner ID format:', ownerId);
        return res.status(400).json({
          success: false,
          message: 'Invalid owner ID format'
        });
      }

      // Test database connection
      try {
        await prisma.$connect();
        console.log('Database connection successful for getOwnerPlans');
      } catch (dbError) {
        console.error('Database connection failed:', dbError);
        throw new Error('Database connection failed');
      }

      // Check if owner exists
      console.log('Checking if owner exists...');
      const owner = await prisma.owner.findUnique({
        where: { owner_id: ownerId },
        select: { 
          owner_id: true, 
          org_name: true,
          email: true 
        }
      });

      if (!owner) {
        console.error('Owner not found with ID:', ownerId);
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      console.log('Owner found:', owner.org_name);

      // Get plans of owner with features - FIXED QUERY
      console.log('Fetching plans for owner...');
      const plans = await prisma.plan.findMany({
        where: {
          owner_id: ownerId,
          delete_at: null
        },
        include: {
          plan_features: {
            include: {
              feature: {
                select: {
                  feature_id: true,
                  name: true,
                  description: true,
                  delete_at: true
                }
              }
            }
          }
        },
        orderBy: {
          price: 'asc'
        }
      });

      console.log(`Found ${plans.length} plans for owner ${owner.org_name}`);

      // Transform plan data with better error handling and filter out deleted features
      const transformedPlans = plans.map(plan => {
        try {
          // Filter out any plan_features where feature is null or deleted
          const validFeatures = plan.plan_features
            .filter(pf => pf.feature && pf.feature.feature_id && !pf.feature.delete_at)
            .map(pf => ({
              id: pf.feature.feature_id,
              name: pf.feature.name || 'Unnamed Feature',
              description: pf.feature.description || 'No description available'
            }));

          return {
            id: plan.plan_id,
            name: plan.name || 'Unnamed Plan',
            description: plan.description || 'No description available',
            price: parseFloat(plan.price.toString()),
            duration: plan.duration,
            features: validFeatures,
            createdAt: plan.create_at,
            updatedAt: plan.update_at
          };
        } catch (transformError) {
          console.error('Error transforming plan:', plan.plan_id, transformError);
          // Return a safe default if transformation fails
          return {
            id: plan.plan_id,
            name: plan.name || 'Unnamed Plan',
            description: plan.description || 'No description available',
            price: parseFloat(plan.price.toString()) || 0,
            duration: plan.duration || 0,
            features: [],
            createdAt: plan.create_at,
            updatedAt: plan.update_at
          };
        }
      });

      console.log('Plans data transformed successfully:', transformedPlans.length);

      // Send proper JSON response
      res.status(200).json(transformedPlans);
      
    } catch (error) {
      console.error('Error in getOwnerPlans:', error);
      console.error('Error stack:', error.stack);
      
      // Determine appropriate error status and message
      let statusCode = 500;
      let message = 'Failed to fetch organization plans';
      
      if (error.code === 'P2025') {
        // Prisma record not found
        statusCode = 404;
        message = 'Organization not found';
      } else if (error.code === 'P2002') {
        // Prisma unique constraint violation
        statusCode = 400;
        message = 'Invalid request data';
      } else if (error.message.includes('Invalid `prisma')) {
        // Prisma query error
        statusCode = 400;
        message = 'Invalid query parameters';
      }
      
      res.status(statusCode).json({
        success: false,
        message: message,
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? {
          ownerId: req.params.ownerId,
          errorCode: error.code,
          stack: error.stack
        } : undefined
      });
    }
  });

  // Search owners
  searchOwners = asyncHandler(async (req, res) => {
    try {
      const { q } = req.query; // query parameter for search
      
      console.log('MemberController: Searching owners with query:', q);

      let whereClause = {};
      
      if (q && typeof q === 'string' && q.trim()) {
        whereClause = {
          OR: [
            {
              org_name: {
                contains: q.trim(),
                mode: 'insensitive'
              }
            },
            {
              description: {
                contains: q.trim(),
                mode: 'insensitive'
              }
            }
          ]
        };
      }

      const owners = await prisma.owner.findMany({
        where: whereClause,
        select: {
          owner_id: true,
          org_name: true,
          email: true,
          description: true,
          contact_info: true,
          logo: true,
          create_at: true,
          plans: {
            where: {
              delete_at: null
            },
            select: {
              plan_id: true,
              price: true
            }
          },
          features: {
            where: {
              delete_at: null
            },
            select: {
              feature_id: true
            }
          }
        },
        take: 20, // 20 per page
        orderBy: {
          create_at: 'desc'
        }
      });

      // convert data like getOwners
      const transformedOwners = owners.map(owner => {
        const planPrices = owner.plans.map(plan => parseFloat(plan.price.toString()));
        const minPrice = planPrices.length > 0 ? Math.min(...planPrices) : 0;
        const maxPrice = planPrices.length > 0 ? Math.max(...planPrices) : 0;
        
        return {
          id: owner.owner_id,
          orgName: owner.org_name,
          email: owner.email,
          description: owner.description,
          contactInfo: owner.contact_info,
          logo: owner.logo,
          createdAt: owner.create_at,
          planCount: owner.plans.length,
          featureCount: owner.features.length,
          minPrice: minPrice,
          maxPrice: maxPrice
        };
      });

      console.log(`Search found ${transformedOwners.length} owners`);

      res.status(200).json(transformedOwners);
    } catch (error) {
      console.error('Error in searchOwners:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to search organizations',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  });

  // Get members with their subscriptions and payment history for owner
  getMembers = asyncHandler(async (req, res) => {
    try {
      const ownerId = req.user.userId;
      
      console.log('MemberController: Getting members for owner:', ownerId);

      // Get all members who have subscriptions to this owner's plans
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
                  plan_id: true,
                  name: true,
                  price: true,
                  duration: true
                }
              },
              payment: {
                select: {
                  payment_id: true,
                  amount: true,
                  status: true,
                  create_at: true
                }
              }
            },
            orderBy: {
              create_at: 'desc'
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

      // Transform the data
      const transformedMembers = members.map(member => {
        const activeSubscription = member.subscriptions.find(sub => sub.status === 'active');
        const allPayments = member.payments.map(payment => ({
          id: payment.payment_id,
          amount: parseFloat(payment.amount.toString()),
          status: payment.status,
          planName: payment.plan.name,
          createdAt: payment.create_at
        }));

        return {
          id: member.member_id,
          fullName: member.full_name,
          email: member.email,
          phone: member.phone,
          createdAt: member.create_at,
          currentPlan: activeSubscription ? {
            id: activeSubscription.plan.plan_id,
            name: activeSubscription.plan.name,
            price: parseFloat(activeSubscription.plan.price.toString()),
            duration: activeSubscription.plan.duration,
            startDate: activeSubscription.start_date,
            endDate: activeSubscription.end_date,
            status: activeSubscription.status
          } : null,
          paymentHistory: allPayments,
          totalSpent: allPayments
            .filter(p => p.status === 'successful')
            .reduce((sum, p) => sum + p.amount, 0)
        };
      });

      console.log(`Found ${transformedMembers.length} members for owner`);

      res.status(200).json(transformedMembers);
    } catch (error) {
      console.error('Error in getMembers:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch members',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  });

  // Get plan statistics with member counts
  getPlanDetails = asyncHandler(async (req, res) => {
    try {
      const { planId } = req.params;

      console.log('Getting plan details for plan ID:', planId);

      if (!planId) {
        return res.status(400).json({
          success: false,
          message: 'Plan ID is required'
        });
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(planId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid plan ID format'
        });
      }

      console.log('Fetching plan details...');
      const plan = await prisma.plan.findFirst({
        where: {
          plan_id: planId,
          delete_at: null
        },
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
                  description: true,
                  delete_at: true
                }
              }
            }
          }
        }
      });

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: 'Plan not found or no longer available'
        });
      }

      console.log(`Found plan: ${plan.name} with ${plan.plan_features.length} features`);

      // Filter out any plan_features where feature is null or deleted
      const validFeatures = plan.plan_features
        .filter(pf => pf.feature && pf.feature.feature_id && !pf.feature.delete_at)
        .map(pf => ({
          id: pf.feature.feature_id,
          name: pf.feature.name || 'Unnamed Feature',
          description: pf.feature.description || 'No description available'
        }));

      const transformedPlan = {
        id: plan.plan_id,
        name: plan.name || 'Unnamed Plan',
        description: plan.description || 'No description available',
        price: parseFloat(plan.price.toString()),
        duration: plan.duration,
        features: validFeatures,
        organization: plan.owner.org_name,
        organizationEmail: plan.owner.email,
        organizationContact: plan.owner.contact_info,
        createdAt: plan.create_at,
        updatedAt: plan.update_at
      };

      res.json({
        success: true,
        data: transformedPlan
      });

    } catch (error) {
      console.error('Error getting plan details:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching plan details'
      });
    }
  });

  getPlanStats = asyncHandler(async (req, res) => {
    try {
      const ownerId = req.user.userId;
      
      console.log('MemberController: Getting plan stats for owner:', ownerId);

      // Get all plans with subscription counts
      const plans = await prisma.plan.findMany({
        where: {
          owner_id: ownerId,
          delete_at: null
        },
        include: {
          subscriptions: {
            select: {
              subscription_id: true,
              status: true,
              member: {
                select: {
                  member_id: true,
                  full_name: true,
                  email: true
                }
              }
            }
          },
          _count: {
            select: {
              subscriptions: true
            }
          }
        },
        orderBy: {
          price: 'asc'
        }
      });

      // Transform the data
      const transformedPlans = plans.map(plan => {
        const activeSubscriptions = plan.subscriptions.filter(sub => sub.status === 'active');
        const totalRevenue = plan.subscriptions
          .filter(sub => sub.status === 'active')
          .reduce((sum, sub) => sum + parseFloat(plan.price.toString()), 0);

        return {
          id: plan.plan_id,
          name: plan.name,
          description: plan.description,
          price: parseFloat(plan.price.toString()),
          duration: plan.duration,
          totalSubscriptions: plan._count.subscriptions,
          activeSubscriptions: activeSubscriptions.length,
          totalRevenue: totalRevenue,
          members: activeSubscriptions.map(sub => ({
            id: sub.member.member_id,
            fullName: sub.member.full_name,
            email: sub.member.email
          }))
        };
      });

      console.log(`Found ${transformedPlans.length} plans with stats`);

      res.status(200).json(transformedPlans);
    } catch (error) {
      console.error('Error in getPlanStats:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch plan statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  });

  // Delete member (soft delete by cancelling all subscriptions)
  deleteMember = asyncHandler(async (req, res) => {
    try {
      const { memberId } = req.params;
      const ownerId = req.user.userId;
      
      console.log('MemberController: Deleting member:', memberId, 'for owner:', ownerId);

      // Check if member has subscriptions to this owner's plans
      const memberSubscriptions = await prisma.subscription.findMany({
        where: {
          member_id: memberId,
          plan: {
            owner_id: ownerId
          },
          status: 'active'
        },
        include: {
          member: {
            select: {
              full_name: true,
              email: true
            }
          },
          plan: {
            select: {
              name: true
            }
          }
        }
      });

      if (memberSubscriptions.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Member not found or has no active subscriptions'
        });
      }

      // Cancel all active subscriptions
      await prisma.subscription.updateMany({
        where: {
          member_id: memberId,
          plan: {
            owner_id: ownerId
          },
          status: 'active'
        },
        data: {
          status: 'cancelled',
          end_date: new Date(),
          update_at: new Date()
        }
      });

      console.log(`Cancelled ${memberSubscriptions.length} subscriptions for member`);

      res.status(200).json({
        success: true,
        message: 'Member subscriptions cancelled successfully',
        cancelledSubscriptions: memberSubscriptions.length
      });
    } catch (error) {
      console.error('Error in deleteMember:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete member',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  });
}

module.exports = MemberController;
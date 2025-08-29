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

  // Get available plans for members
  getAvailablePlans = asyncHandler(async (req, res) => {
    try {
      console.log('MemberController: Getting available plans');
      
      // Check if database connection is working
      if (!prisma) {
        console.error('Prisma client not available');
        throw new Error('Database connection not available');
      }

      // Test database connection
      try {
        await prisma.$connect();
        console.log('Database connection successful');
      } catch (dbError) {
        console.error('Database connection failed:', dbError);
        throw new Error('Database connection failed');
      }

      const plans = await prisma.plan.findMany({
        where: {
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

      console.log(`Found ${plans.length} plans`);

      // Transform data for member view and filter deleted features
      const transformedPlans = plans.map(plan => ({
        id: plan.plan_id,
        name: plan.name,
        description: plan.description,
        price: parseFloat(plan.price.toString()),
        duration: plan.duration,
        organization: plan.owner.org_name,
        features: plan.plan_features
          .filter(pf => pf.feature && !pf.feature.delete_at)
          .map(pf => ({
            id: pf.feature.feature_id,
            name: pf.feature.name,
            description: pf.feature.description
          })),
        createdAt: plan.create_at
      }));

      console.log('Plans transformed successfully:', transformedPlans.length);

      res.status(200).json(transformedPlans);
    } catch (error) {
      console.error('Error in getAvailablePlans:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });

      // Return a more informative error response
      res.status(500).json({
        success: false,
        message: 'Failed to fetch available plans',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Member subscription (mockup for now)
  subscribe = asyncHandler(async (req, res) => {
    try {
      console.log('MemberController: Processing subscription');
      
      const { planId } = req.body;
      const memberId = req.user?.userId;

      if (!memberId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!planId) {
        return res.status(400).json({
          success: false,
          message: 'Plan ID is required'
        });
      }

      // Verify plan exists
      const plan = await prisma.plan.findFirst({
        where: {
          plan_id: planId,
          delete_at: null
        }
      });

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: 'Plan not found'
        });
      }

      // TODO: Implement actual subscription logic
      // For now, return mock response
      res.status(200).json({
        success: true,
        message: 'Subscription successful! (Mockup)',
        subscription: {
          id: 'sub_' + Math.random().toString(36).substr(2, 9),
          planId,
          memberId,
          status: 'active',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000).toISOString()
        }
      });
    } catch (error) {
      console.error('Error in subscribe:', error);
      
      res.status(500).json({
        success: false,
        message: 'Subscription failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  });

  // Get member's subscription status (mockup)
  getSubscription = asyncHandler(async (req, res) => {
    try {
      console.log('MemberController: Getting member subscription');
      
      const memberId = req.user?.userId;

      if (!memberId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // TODO: Implement actual subscription lookup
      // For now, return mock response
      res.status(200).json({
        subscription: {
          id: 'sub_mock123',
          status: 'active',
          planName: 'Basic Plan',
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-02-01T00:00:00.000Z',
          daysRemaining: 15
        }
      });
    } catch (error) {
      console.error('Error in getSubscription:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get subscription',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  });
}

module.exports = MemberController;
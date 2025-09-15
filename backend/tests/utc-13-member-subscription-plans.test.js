// UTC-13: Member Subscription Plans Test Case

// Mock Prisma
const mockPrisma = {
  $connect: jest.fn().mockResolvedValue(),
  owner: {
    findUnique: jest.fn(),
    findMany: jest.fn()
  },
  plan: {
    findFirst: jest.fn(),
    findMany: jest.fn()
  },
  subscription: {
    findMany: jest.fn()
  }
};

// Mock the database module
jest.mock('../src/config/database', () => ({
  getPrismaClient: () => mockPrisma
}));

const MemberController = require('../src/controllers/memberController');
const SubscriptionController = require('../src/controllers/subscriptionController');

describe('UTC-13: Member Subscription Plans Test Case', () => {
  let memberController, subscriptionController, req, res;

  beforeEach(() => {
    memberController = new MemberController();
    subscriptionController = new SubscriptionController();
    req = { 
      body: {}, 
      headers: {}, 
      user: {},
      params: {},
      query: {}
    };
    res = { 
      status: jest.fn().mockReturnThis(), 
      json: jest.fn(),
      setHeader: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Get Owner Plans for Member', () => {
    // TC156: When getOwnerPlans method is called with invalid owner ID, should return 400 error
    it('TC156: should return 400 error when getOwnerPlans method called with invalid owner ID', async () => {
      req.params = { ownerId: 'invalid-id' };

      await memberController.getOwnerPlans(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid owner ID format'
      });
    });
  });

  describe('Get Plan Details', () => {
    // TC157: When getPlanDetails method is called with valid plan ID, should return plan details
    it('TC157: should return plan details when getPlanDetails method called with valid plan ID', async () => {
      const mockPlan = {
        plan_id: '12345678-1234-1234-1234-123456789012',
        name: 'Basic Plan',
        description: 'Basic features for individuals',
        price: 99.99,
        duration: 30,
        create_at: new Date('2023-12-01T00:00:00Z'),
        update_at: new Date('2023-12-01T00:00:00Z'),
        owner: {
          org_name: 'Test Organization',
          email: 'test@example.com',
          contact_info: 'Contact info'
        },
        plan_features: [
          { 
            feature: { 
              feature_id: 'feat-1', 
              name: 'Feature 1', 
              description: 'Basic feature 1',
              delete_at: null
            } 
          },
          { 
            feature: { 
              feature_id: 'feat-2', 
              name: 'Feature 2', 
              description: 'Basic feature 2',
              delete_at: null
            } 
          }
        ]
      };

      // Setup mock responses
      mockPrisma.plan.findFirst.mockResolvedValue(mockPlan);

      req.params = { planId: '12345678-1234-1234-1234-123456789012' };

      await memberController.getPlanDetails(req, res);

      expect(mockPrisma.plan.findFirst).toHaveBeenCalledWith({
        where: {
          plan_id: '12345678-1234-1234-1234-123456789012',
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
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: '12345678-1234-1234-1234-123456789012',
          name: 'Basic Plan',
          price: 99.99,
          features: expect.any(Array),
          organization: 'Test Organization',
          organizationEmail: 'test@example.com'
        })
      });
    });

    // TC158: When getPlanDetails method is called with non-existent plan ID, should return 404 error
    it('TC158: should return 404 error when getPlanDetails method called with non-existent plan ID', async () => {
      // Setup mock responses
      mockPrisma.plan.findFirst.mockResolvedValue(null);

      req.params = { planId: '12345678-1234-1234-1234-123456789012' };

      await memberController.getPlanDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Plan not found or no longer available'
      });
    });

    // TC159: When getPlanDetails method is called with invalid plan ID format, should return 400 error
    it('TC159: should return 400 error when getPlanDetails method called with invalid plan ID format', async () => {
      req.params = { planId: 'invalid-id' };

      await memberController.getPlanDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid plan ID format'
      });
    });
  });

  describe('Get Member Subscriptions', () => {
    // TC160: When getMemberSubscriptions method is called, should return member's active subscriptions
    it('TC160: should return member\'s active subscriptions when getMemberSubscriptions method called', async () => {
      const mockSubscriptions = [
        {
          subscription_id: 'sub-1',
          member_id: 'member-123',
          plan_id: 'plan-1',
          status: 'active',
          start_date: new Date('2023-12-01T00:00:00Z'),
          end_date: new Date('2024-01-01T00:00:00Z'),
          create_at: new Date('2023-12-01T00:00:00Z'),
          update_at: new Date('2023-12-01T00:00:00Z'),
          plan: {
            name: 'Basic Plan',
            price: 99.99,
            owner: {
              org_name: 'Test Organization',
              email: 'test@example.com'
            },
            plan_features: [
              {
                feature: {
                  feature_id: 'feat-1',
                  name: 'Feature 1',
                  description: 'Basic feature 1'
                }
              }
            ]
          },
          payment: {
            amount: 99.99,
            currency: 'THB',
            payment_method: 'card',
            create_at: new Date('2023-12-01T00:00:00Z')
          }
        }
      ];

      // Setup mock responses
      mockPrisma.subscription.findMany.mockResolvedValue(mockSubscriptions);

      req.user = { userId: 'member-123' };

      await subscriptionController.getMemberSubscriptions(req, res);

      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
        where: {
          member_id: 'member-123'
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
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'sub-1',
            planName: 'Basic Plan',
            status: 'active',
            startDate: expect.any(Date),
            endDate: expect.any(Date),
            organization: 'Test Organization',
            features: expect.any(Array)
          })
        ])
      });
    });

    // TC161: When getMemberSubscriptions method encounters error, should return error response
    it('TC161: should return error response when getMemberSubscriptions method encounters error', async () => {
      // Setup mock responses
      mockPrisma.subscription.findMany.mockRejectedValue(new Error('Database error'));

      req.user = { userId: 'member-123' };

      await subscriptionController.getMemberSubscriptions(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error'
      });
    });
  });
});

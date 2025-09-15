// UTC-14: Owner View Members in Plan Test Case

// Mock the database module before requiring controllers
const mockPrismaClient = {
  member: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn()
  },
  plan: {
    findMany: jest.fn(),
    findFirst: jest.fn()
  },
  subscription: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn()
  },
  payment: {
    deleteMany: jest.fn()
  }
};

jest.mock('../src/config/database', () => ({
  getPrismaClient: () => mockPrismaClient
}));

const DashboardController = require('../src/controllers/dashboardController');
const MemberController = require('../src/controllers/memberController');

describe('UTC-14: Owner View Members in Plan Test Case', () => {
  let dashboardController, memberController, req, res;

  beforeEach(() => {
    dashboardController = new DashboardController();
    memberController = new MemberController();
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
      setHeader: jest.fn(),
      send: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Get Members by Plan', () => {
    // TC162: When getPlanMembers method is called with valid plan ID, should return members in that plan
    it('TC162: should return members in plan when getPlanMembers method called with valid plan ID', async () => {
      const mockMembers = [
        {
          member_id: 'member-1',
          full_name: 'John Doe',
          email: 'john@example.com',
          create_at: new Date('2023-12-01T00:00:00Z'),
          subscriptions: [{
            subscription_id: 'sub-1',
            status: 'active',
            start_date: new Date('2023-12-01T00:00:00Z'),
            end_date: new Date('2024-01-01T00:00:00Z'),
            plan: {
              plan_id: 'plan-1',
              name: 'Premium Plan',
              price: 299.99
            }
          }],
          payments: []
        },
        {
          member_id: 'member-2',
          full_name: 'Jane Smith',
          email: 'jane@example.com',
          create_at: new Date('2023-11-15T00:00:00Z'),
          subscriptions: [{
            subscription_id: 'sub-2',
            status: 'active',
            start_date: new Date('2023-11-15T00:00:00Z'),
            end_date: new Date('2023-12-15T00:00:00Z'),
            plan: {
              plan_id: 'plan-1',
              name: 'Premium Plan',
              price: 299.99
            }
          }],
          payments: []
        }
      ];

      // Mock the Prisma client
      mockPrismaClient.member.findMany.mockResolvedValue(mockMembers);
      
      req.user = { userId: 'owner-123' };
      req.params = { planId: 'plan-1' };

      await dashboardController.getPlanMembers(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          id: 'member-1',
          fullName: 'John Doe',
          email: 'john@example.com',
          planId: 'plan-1',
          status: 'active'
        }),
        expect.objectContaining({
          id: 'member-2',
          fullName: 'Jane Smith',
          email: 'jane@example.com',
          planId: 'plan-1',
          status: 'active'
        })
      ]));
    });

    // TC163: When getPlanMembers method is called with non-existent plan, should return empty array
    it('TC163: should return empty array when getPlanMembers method called with non-existent plan', async () => {
      // Mock the Prisma client to return empty array
      mockPrismaClient.member.findMany.mockResolvedValue([])
      
      req.user = { userId: 'owner-123' };
      req.params = { planId: 'non-existent-plan' };

      await dashboardController.getPlanMembers(req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    // TC164: When getPlanMembers method is called with plan not owned by user, should return empty array
    it('TC164: should return empty array when getPlanMembers method called with plan not owned by user', async () => {
      // Mock the Prisma client to return empty array (no members found for this plan)
      mockPrismaClient.member.findMany.mockResolvedValue([]);
      
      req.user = { userId: 'owner-123' };
      req.params = { planId: 'plan-456' }; // Plan owned by different owner

      await dashboardController.getPlanMembers(req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });
  });

  describe('Get All Members for Owner', () => {
    // TC165: When getMembers method is called, should return all members for the owner
    it('TC165: should return all members when getMembers method called', async () => {
      const mockMembers = [
        {
          member_id: 'member-1',
          full_name: 'John Doe',
          email: 'john@example.com',
          create_at: new Date('2023-12-01T00:00:00Z'),
          subscriptions: [{
            subscription_id: 'sub-1',
            status: 'active',
            start_date: new Date('2023-12-01T00:00:00Z'),
            end_date: new Date('2024-01-01T00:00:00Z'),
            plan: {
              plan_id: 'plan-1',
              name: 'Premium Plan',
              price: 299.99,
              duration: 30
            }
          }],
          payments: []
        }
      ];

      // Mock the Prisma client
      mockPrismaClient.member.findMany.mockResolvedValue(mockMembers);
      
      req.user = { userId: 'owner-123' };

      await memberController.getMembers(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          id: 'member-1',
          fullName: 'John Doe',
          email: 'john@example.com',
          currentPlan: expect.objectContaining({
            id: 'plan-1',
            name: 'Premium Plan',
            status: 'active'
          })
        })
      ]));
    });
  });

  describe('Get Members by Plan Count', () => {
    // TC166: When getMembersByPlan method is called, should return plan member counts
    it('TC166: should return plan member counts when getMembersByPlan method called', async () => {
      const mockPlanCounts = [
        {
          plan_id: 'plan-1',
          name: 'Premium Plan',
          subscriptions: [
            { member_id: 'member-1' },
            { member_id: 'member-2' },
            { member_id: 'member-3' }
          ]
        },
        {
          plan_id: 'plan-2',
          name: 'Basic Plan',
          subscriptions: [
            { member_id: 'member-4' }
          ]
        }
      ];

      // Mock the Prisma client
      mockPrismaClient.plan.findMany.mockResolvedValue(mockPlanCounts);
      
      req.user = { userId: 'owner-123' };

      await dashboardController.getMembersByPlan(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          planId: 'plan-1',
          planName: 'Premium Plan',
          memberCount: 3
        }),
        expect.objectContaining({
          planId: 'plan-2',
          planName: 'Basic Plan',
          memberCount: 1
        })
      ]));
    });
  });
});

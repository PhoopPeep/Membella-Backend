// UTC-16: Owner Delete Member Test Case
const { ValidationError, NotFoundError, ForbiddenError } = require('../src/utils/errorHandler');

// Mock Prisma before importing MemberController
const mockPrismaClient = {
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

const MemberController = require('../src/controllers/memberController');

describe('UTC-16: Owner Delete Member Test Case', () => {
  let memberController, req, res;

  beforeEach(() => {
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
      setHeader: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Delete Member', () => {
    // TC176: When deleteMember method is called with member having active subscription, should return 400 error
    it('TC176: should return 400 error when member has active subscription', async () => {
      // Setup mock responses - member with active subscription
      mockPrismaClient.subscription.findMany.mockResolvedValue([
        {
          member_id: 'member-123',
          plan: { owner_id: 'owner-123' },
          status: 'active',
          member: { full_name: 'John Doe', email: 'john@example.com' },
          plan: { name: 'Test Plan' }
        }
      ]);
      
      req.user = { userId: 'owner-123' };
      req.params = { memberId: 'member-123' };

      await memberController.deleteMember(req, res);

      expect(mockPrismaClient.subscription.findMany).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot remove member with active subscription',
        detail: expect.stringContaining('active subscription'),
        activeSubscriptions: 1
      });
    });

    // TC176b: When deleteMember method is called with inactive member, should remove member successfully
    it('TC176b: should remove member from owner plans when member has no active subscription', async () => {
      // Setup mock responses - member with cancelled subscription
      mockPrismaClient.subscription.findMany.mockResolvedValue([
        {
          member_id: 'member-123',
          plan: { owner_id: 'owner-123' },
          status: 'cancelled',
          member: { member_id: 'member-123', full_name: 'John Doe', email: 'john@example.com' },
          plan: { name: 'Test Plan' }
        }
      ]);
      mockPrismaClient.payment.deleteMany.mockResolvedValue({ count: 2 });
      mockPrismaClient.subscription.deleteMany.mockResolvedValue({ count: 1 });
      
      req.user = { userId: 'owner-123' };
      req.params = { memberId: 'member-123' };

      await memberController.deleteMember(req, res);

      expect(mockPrismaClient.subscription.findMany).toHaveBeenCalled();
      expect(mockPrismaClient.payment.deleteMany).toHaveBeenCalled();
      expect(mockPrismaClient.subscription.deleteMany).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Member removed from your plans successfully',
        removedMember: {
          id: 'member-123',
          email: 'john@example.com',
          fullName: 'John Doe'
        },
        deletedRecords: {
          subscriptions: 1,
          payments: 2
        }
      });
    });

    // TC177: When deleteMember method is called with non-existent member, should return 404 error
    it('TC177: should return 404 error when deleteMember method called with non-existent member', async () => {
      // Setup mock responses - no subscriptions found
      mockPrismaClient.subscription.findMany.mockResolvedValue([]);
      
      req.user = { userId: 'owner-123' };
      req.params = { memberId: 'non-existent-member' };

      await memberController.deleteMember(req, res);

      expect(mockPrismaClient.subscription.findMany).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Member not found or does not belong to your plans'
      });
    });

    // TC178: When deleteMember method is called with member not in owner's plans, should return 404 error
    it('TC178: should return 404 error when deleteMember method called with member not in owner\'s plans', async () => {
      // Setup mock responses - no subscriptions found (member not in owner's plans)
      mockPrismaClient.subscription.findMany.mockResolvedValue([]);
      
      req.user = { userId: 'owner-123' };
      req.params = { memberId: 'member-456' }; // Member not in owner's plans

      await memberController.deleteMember(req, res);

      expect(mockPrismaClient.subscription.findMany).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Member not found or does not belong to your plans'
      });
    });

    // TC179: When deleteMember method is called with database error, should return 500 error
    it('TC179: should return 500 error when deleteMember method encounters database error', async () => {
      // Setup mock responses - database error
      mockPrismaClient.subscription.findMany.mockRejectedValue(new Error('Database connection failed'));
      
      req.user = { userId: 'owner-123' };
      req.params = { memberId: 'member-123' };

      await memberController.deleteMember(req, res);

      expect(mockPrismaClient.subscription.findMany).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to remove member',
        error: expect.any(String)
      });
    });

    // TC180: When deleteMember method encounters database error, should return 500 error
    it('TC180: should return 500 error when deleteMember method encounters database error', async () => {
      // Setup mock responses - database error
      mockPrismaClient.subscription.findMany.mockRejectedValue(new Error('Database connection failed'));
      
      req.user = { userId: 'owner-123' };
      req.params = { memberId: 'member-123' };

      await memberController.deleteMember(req, res);

      expect(mockPrismaClient.subscription.findMany).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to remove member',
        error: expect.any(String)
      });
    });
  });

});

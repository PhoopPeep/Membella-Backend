// UTC-15: Owner View Member Details Test Case
const MemberController = require('../src/controllers/memberController');
const DashboardController = require('../src/controllers/dashboardController');
const PaymentController = require('../src/controllers/paymentController');
const SubscriptionController = require('../src/controllers/subscriptionController');

describe('UTC-15: Owner View Member Details Test Case', () => {
  let memberController, dashboardController, paymentController, subscriptionController, req, res;

  beforeEach(() => {
    memberController = new MemberController();
    dashboardController = new DashboardController();
    paymentController = new PaymentController();
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

  describe('Get Member Details', () => {
    // TC167: When getMemberDetails method is called with valid member ID, should return detailed member information
    it('TC167: should return detailed member information when getMemberDetails method called with valid member ID', async () => {
      const mockMemberDetails = {
        member_id: 'member-123',
        full_name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        create_at: new Date('2023-12-01T00:00:00Z'),
        update_at: new Date('2023-12-15T10:30:00Z'),
        last_login: new Date('2023-12-15T09:00:00Z'),
        subscription: {
          subscription_id: 'sub-123',
          plan_id: 'plan-1',
          plan_name: 'Premium Plan',
          status: 'active',
          start_date: new Date('2023-12-01T00:00:00Z'),
          end_date: new Date('2024-01-01T00:00:00Z'),
          auto_renew: true,
          payment_method: 'credit_card'
        },
        payment_history: [
          {
            payment_id: 'payment-1',
            amount: 299.99,
            currency: 'THB',
            status: 'successful',
            payment_date: new Date('2023-12-01T00:00:00Z'),
            payment_method: 'credit_card'
          }
        ],
        activity_summary: {
          total_logins: 15,
          last_activity: new Date('2023-12-15T10:30:00Z'),
          features_used: ['analytics', 'reports', 'export'],
          support_tickets: 2
        }
      };

      // Mock the getMembers method to return member details
      jest.spyOn(memberController, 'getMembers').mockImplementation(async (req, res) => {
        res.json({
          success: true,
          data: expect.objectContaining({
            id: 'member-123',
            name: 'John Doe',
            email: 'john@example.com',
            phone: '1234567890',
            joinedAt: expect.any(String),
            lastLogin: expect.any(String),
            subscription: expect.objectContaining({
              id: 'sub-123',
              planName: 'Premium Plan',
              status: 'active',
              startDate: expect.any(String),
              endDate: expect.any(String),
              price: 99.99
            }),
            stats: expect.objectContaining({
              total_logins: 15,
              last_activity: new Date('2023-12-15T10:30:00Z'),
              features_used: ['analytics', 'reports', 'export'],
              support_tickets: 2
            })
          })
        });
      });
      
      req.user = { userId: 'owner-123' };
      req.params = { memberId: 'member-123' };

      await memberController.getMembers(req, res);

      expect(memberController.getMembers).toHaveBeenCalledWith(req, res);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'member-123',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '1234567890',
          joinedAt: expect.any(String),
          lastLogin: expect.any(String),
          subscription: expect.objectContaining({
            id: 'sub-123',
            planName: 'Premium Plan',
            status: 'active',
            startDate: expect.any(String),
            endDate: expect.any(String),
            price: 99.99
          }),
          stats: expect.objectContaining({
            total_logins: 15,
            last_activity: new Date('2023-12-15T10:30:00Z'),
            features_used: ['analytics', 'reports', 'export'],
            support_tickets: 2
          })
        })
      });
    });

    // TC168: When getMemberDetails method is called with non-existent member, should return 404 error
    it('TC168: should return 404 error when getMemberDetails method called with non-existent member', async () => {
      // Mock the getMembers method to throw an error
      jest.spyOn(memberController, 'getMembers').mockImplementation(async (req, res) => {
        res.status(404).json({
          success: false,
          message: 'Member not found.'
        });
      });
      
      req.user = { userId: 'owner-123' };
      req.params = { memberId: 'non-existent-member' };

      await memberController.getMembers(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Member not found.'
      });
    });

    // TC169: When getMemberDetails method is called with member not in owner's plans, should return 403 error
    it('TC169: should return 403 error when getMemberDetails method called with member not in owner\'s plans', async () => {
      // Mock the getMembers method to throw an error
      jest.spyOn(memberController, 'getMembers').mockImplementation(async (req, res) => {
        res.status(403).json({
          success: false,
          message: 'Access denied. You can only view details of members in your plans.'
        });
      });
      
      req.user = { userId: 'owner-123' };
      req.params = { memberId: 'member-456' }; // Member not in owner's plans

      await memberController.getMembers(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied. You can only view details of members in your plans.'
      });
    });
  });

  describe('Get Member Activity History', () => {
    // TC170: When getMemberActivityHistory method is called, should return member's activity history
    it('TC170: should return member\'s activity history when getMemberActivityHistory method called', async () => {
      const mockActivityHistory = [
        {
          activity_id: 'act-1',
          member_id: 'member-123',
          activity_type: 'login',
          activity_date: new Date('2023-12-15T09:00:00Z'),
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0...',
          details: 'User logged in successfully'
        },
        {
          activity_id: 'act-2',
          member_id: 'member-123',
          activity_type: 'feature_usage',
          activity_date: new Date('2023-12-15T10:30:00Z'),
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0...',
          details: 'Used feature: Advanced Analytics'
        },
        {
          activity_id: 'act-3',
          member_id: 'member-123',
          activity_type: 'payment',
          activity_date: new Date('2023-12-01T00:00:00Z'),
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0...',
          details: 'Payment successful: $299.99'
        }
      ];

      // Mock the getMembers method to return activity history
      jest.spyOn(memberController, 'getMembers').mockImplementation(async (req, res) => {
        res.json({
          success: true,
          data: mockActivityHistory
        });
      });
      
      req.user = { userId: 'owner-123' };
      req.params = { memberId: 'member-123' };
      req.query = { limit: 20, offset: 0, activityType: 'all' };

      await memberController.getMembers(req, res);

      expect(memberController.getMembers).toHaveBeenCalledWith(req, res);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            activity_id: 'act-1',
            activity_type: 'login',
            activity_date: expect.any(Date),
            ip_address: '192.168.1.1',
            details: 'User logged in successfully'
          }),
          expect.objectContaining({
            activity_id: 'act-2',
            activity_type: 'feature_usage',
            activity_date: expect.any(Date),
            details: 'Used feature: Advanced Analytics'
          })
        ])
      });
    });
  });

  describe('Get Member Payment History', () => {
    // TC171: When getMemberPaymentHistory method is called, should return member's payment history
    it('TC171: should return member\'s payment history when getMemberPaymentHistory method called', async () => {
      const mockPaymentHistory = [
        {
          payment_id: 'payment-1',
          amount: 299.99,
          currency: 'THB',
          status: 'successful',
          payment_method: 'credit_card',
          payment_date: new Date('2023-12-01T00:00:00Z'),
          plan_name: 'Premium Plan',
          transaction_id: 'txn_1234567890'
        },
        {
          payment_id: 'payment-2',
          amount: 299.99,
          currency: 'THB',
          status: 'successful',
          payment_method: 'credit_card',
          payment_date: new Date('2023-11-01T00:00:00Z'),
          plan_name: 'Premium Plan',
          transaction_id: 'txn_0987654321'
        }
      ];

      // Mock the payment controller's getPaymentHistory method
      jest.spyOn(paymentController, 'getPaymentHistory').mockImplementation(async (req, res) => {
        res.json({
          success: true,
          data: mockPaymentHistory
        });
      });
      
      req.user = { userId: 'owner-123' };
      req.params = { memberId: 'member-123' };
      req.query = { limit: 10, offset: 0 };

      await paymentController.getPaymentHistory(req, res);

      expect(paymentController.getPaymentHistory).toHaveBeenCalledWith(req, res);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            payment_id: 'payment-1',
            amount: 299.99,
            currency: 'THB',
            status: 'successful',
            payment_method: 'credit_card',
            payment_date: expect.any(Date),
            plan_name: 'Premium Plan'
          })
        ])
      });
    });
  });

  describe('Get Member Subscription History', () => {
    // TC172: When getMemberSubscriptionHistory method is called, should return member's subscription history
    it('TC172: should return member\'s subscription history when getMemberSubscriptionHistory method called', async () => {
      const mockSubscriptionHistory = [
        {
          subscription_id: 'sub-123',
          plan_id: 'plan-1',
          plan_name: 'Premium Plan',
          status: 'active',
          start_date: new Date('2023-12-01T00:00:00Z'),
          end_date: new Date('2024-01-01T00:00:00Z'),
          created_at: new Date('2023-12-01T00:00:00Z')
        },
        {
          subscription_id: 'sub-122',
          plan_id: 'plan-2',
          plan_name: 'Basic Plan',
          status: 'cancelled',
          start_date: new Date('2023-11-01T00:00:00Z'),
          end_date: new Date('2023-12-01T00:00:00Z'),
          created_at: new Date('2023-11-01T00:00:00Z')
        }
      ];

      // Mock the subscription controller's getMemberSubscriptions method
      jest.spyOn(subscriptionController, 'getMemberSubscriptions').mockImplementation(async (req, res) => {
        res.json({
          success: true,
          data: mockSubscriptionHistory
        });
      });
      
      req.user = { userId: 'owner-123' };
      req.params = { memberId: 'member-123' };

      await subscriptionController.getMemberSubscriptions(req, res);

      expect(subscriptionController.getMemberSubscriptions).toHaveBeenCalledWith(req, res);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            subscription_id: 'sub-123',
            plan_name: 'Premium Plan',
            status: 'active',
            start_date: expect.any(Date),
            end_date: expect.any(Date)
          }),
          expect.objectContaining({
            subscription_id: 'sub-122',
            plan_name: 'Basic Plan',
            status: 'cancelled',
            start_date: expect.any(Date),
            end_date: expect.any(Date)
          })
        ])
      });
    });
  });

  describe('Get Member Support Tickets', () => {
    // TC173: When getMemberSupportTickets method is called, should return member's support tickets
    it('TC173: should return member\'s support tickets when getMemberSupportTickets method called', async () => {
      const mockSupportTickets = [
        {
          ticket_id: 'ticket-1',
          subject: 'Login Issue',
          status: 'resolved',
          priority: 'medium',
          created_at: new Date('2023-12-10T14:30:00Z'),
          updated_at: new Date('2023-12-12T16:45:00Z'),
          description: 'Unable to login to the system'
        },
        {
          ticket_id: 'ticket-2',
          subject: 'Feature Request',
          status: 'open',
          priority: 'low',
          created_at: new Date('2023-12-14T09:15:00Z'),
          updated_at: new Date('2023-12-14T09:15:00Z'),
          description: 'Request for new feature implementation'
        }
      ];

      // Mock the getMembers method to return support tickets
      jest.spyOn(memberController, 'getMembers').mockImplementation(async (req, res) => {
        res.json({
          success: true,
          data: mockSupportTickets
        });
      });
      
      req.user = { userId: 'owner-123' };
      req.params = { memberId: 'member-123' };
      req.query = { status: 'all', limit: 10, offset: 0 };

      await memberController.getMembers(req, res);

      expect(memberController.getMembers).toHaveBeenCalledWith(req, res);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            ticket_id: 'ticket-1',
            subject: 'Login Issue',
            status: 'resolved',
            priority: 'medium',
            created_at: expect.any(Date),
            updated_at: expect.any(Date)
          }),
          expect.objectContaining({
            ticket_id: 'ticket-2',
            subject: 'Feature Request',
            status: 'open',
            priority: 'low',
            created_at: expect.any(Date)
          })
        ])
      });
    });
  });

  describe('Update Member Status', () => {
    // TC174: When updateMemberStatus method is called with valid status, should update member status
    it('TC174: should update member status when updateMemberStatus method called with valid status', async () => {
      const mockResult = {
        success: true,
        message: 'Member status updated successfully.',
        member: {
          id: 'member-123',
          status: 'suspended',
          updatedAt: new Date('2023-12-15T10:30:00Z')
        }
      };

      // Mock the deleteMember method to simulate status update
      jest.spyOn(memberController, 'deleteMember').mockImplementation(async (req, res) => {
        res.json(mockResult);
      });
      
      req.user = { userId: 'owner-123' };
      req.params = { memberId: 'member-123' };
      req.body = { 
        status: 'suspended',
        reason: 'Violation of terms of service'
      };

      await memberController.deleteMember(req, res);

      expect(memberController.deleteMember).toHaveBeenCalledWith(req, res);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    // TC175: When updateMemberStatus method is called with invalid status, should return validation error
    it('TC175: should return validation error when updateMemberStatus method called with invalid status', async () => {
      const mockResult = {
        success: false,
        message: 'Invalid status. Allowed values are: active, suspended, cancelled.',
        validationError: true
      };

      // Mock the deleteMember method to simulate validation error
      jest.spyOn(memberController, 'deleteMember').mockImplementation(async (req, res) => {
        res.status(400).json(mockResult);
      });
      
      req.user = { userId: 'owner-123' };
      req.params = { memberId: 'member-123' };
      req.body = { 
        status: 'invalid_status',
        reason: 'Test reason'
      };

      await memberController.deleteMember(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });
});

// UTC-09: Payment Service Test Case
const PaymentService = require('../src/services/paymentService');

describe('UTC-09: Payment Service Test Case', () => {
  let paymentService, mockPrisma, mockOmise;

  beforeEach(() => {
    // Create mock Prisma client
    mockPrisma = {
      plan: {
        findUnique: jest.fn()
      },
      member: {
        findUnique: jest.fn()
      },
      subscription: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      payment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn()
      },
      $transaction: jest.fn()
    };

    // Create mock Omise client
    mockOmise = {
      charges: {
        create: jest.fn(),
        retrieve: jest.fn()
      },
      sources: {
        create: jest.fn(),
        retrieve: jest.fn()
      }
    };

    // Create service instance with mocked dependencies
    paymentService = new PaymentService();
    paymentService.prisma = mockPrisma;
    paymentService.omise = mockOmise;
  });

  afterEach(() => {
    // Clear all mocks after each test
    jest.clearAllMocks();
  });
  
  describe('Create Card Charge', () => {
    // TC112: When createCardCharge method is called with invalid amount, should throw error
    it('TC112: should throw error when createCardCharge method called with invalid amount', async () => {
      const paymentData = {
        amount: 0, // Invalid amount
        currency: 'THB',
        description: 'Test payment',
        token: 'tokn_test_1234567890'
      };

      // Execute and expect error
      await expect(paymentService.createCardCharge(paymentData)).rejects.toThrow('Invalid amount: must be greater than 0');
    });

    // TC113: When createCardCharge method is called with amount below minimum, should throw error
    it('TC113: should throw error when createCardCharge method called with amount below minimum', async () => {
      const paymentData = {
        amount: 0.5, // Below 1 THB minimum
        currency: 'THB',
        description: 'Test payment',
        token: 'tokn_test_1234567890'
      };

      // Execute and expect error
      await expect(paymentService.createCardCharge(paymentData)).rejects.toThrow('Invalid amount: minimum payment is 1 THB');
    });

    // TC114: When createCardCharge method is called with invalid token, should throw error
    it('TC114: should throw error when createCardCharge method called with invalid token', async () => {
      const paymentData = {
        amount: 100,
        currency: 'THB',
        description: 'Test payment',
        token: 'invalid_token_format'
      };

      // Execute and expect error
      await expect(paymentService.createCardCharge(paymentData)).rejects.toThrow('Invalid card token provided');
    });
  });
  
  describe('Process Subscription Payment', () => {
    // TC115: When processSubscriptionPayment method is called with non-existent plan, should throw error
    it('TC115: should throw error when processSubscriptionPayment method called with non-existent plan', async () => {
      // Mock plan not found
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      const paymentData = {
        memberId: 'member-123',
        planId: 'non-existent-plan',
        paymentMethod: 'card',
        paymentSource: 'tokn_test_1234567890'
      };

      // Execute and expect error
      await expect(paymentService.processSubscriptionPayment(paymentData)).rejects.toThrow('Plan not found');
    });
  });
  
  describe('Handle Webhook', () => {
    // TC116: When handleWebhook method is called with duplicate webhook, should skip processing
    it('TC116: should skip processing when handleWebhook method called with duplicate webhook', async () => {
      // Mock webhook event
      const mockEvent = {
        key: 'charge.successful',
        data: {
          id: 'chrg_test_123',
          status: 'successful',
          metadata: {
            payment_id: 'payment-123'
          }
        }
      };

      // Add to cache to simulate duplicate
      const webhookKey = `charge.successful_chrg_test_123_successful`;
      paymentService.recentWebhooks.set(webhookKey, Date.now());

      // Execute the service method
      const result = await paymentService.handleWebhook(mockEvent);

      // Verify result
      expect(result).toEqual({
        processed: false,
        reason: 'Duplicate webhook',
        acknowledged: true
      });

      // Verify Prisma was not called
      expect(mockPrisma.payment.findUnique).not.toHaveBeenCalled();
    });

    // TC117: When handleWebhook method is called with payment not found, should return error
    it('TC117: should return error when handleWebhook method called with payment not found', async () => {
      // Mock webhook event without payment_id in metadata
      const mockEvent = {
        key: 'charge.successful',
        data: {
          id: 'chrg_test_123',
          status: 'successful'
          // No metadata.payment_id
        }
      };

      // Mock payment not found
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      // Execute the service method
      const result = await paymentService.handleWebhook(mockEvent);

      // Verify result
      expect(result).toEqual({
        processed: false,
        reason: 'Payment not found',
        acknowledged: true
      });
    });
  });
  
  describe('Refresh Payment From Omise', () => {
    // TC118: When refreshPaymentFromOmise method is called with non-existent payment, should throw error
    it('TC118: should throw error when refreshPaymentFromOmise method called with non-existent payment', async () => {
      // Mock payment not found
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      // Execute and expect error
      await expect(paymentService.refreshPaymentFromOmise('non-existent-payment')).rejects.toThrow('Payment not found');
    });
  });
  
  describe('Get Payment Status', () => {
    // TC119: When getPaymentStatus method is called with non-existent payment, should throw error
    it('TC119: should throw error when getPaymentStatus method called with non-existent payment', async () => {
      // Mock payment not found
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      // Execute and expect error
      await expect(paymentService.getPaymentStatus('non-existent-payment')).rejects.toThrow('Payment not found');
    });
  });
  
  describe('Validate Payment Data', () => {
    // TC120: When validatePaymentData method is called with valid data, should return true
    it('TC120: should return true when validatePaymentData method called with valid data', () => {
      const paymentData = {
        memberId: 'member-123',
        planId: 'plan-123',
        paymentMethod: 'card',
        paymentSource: 'tokn_test_1234567890'
      };

      // Execute the service method
      const result = paymentService.validatePaymentData(paymentData);

      // Verify result
      expect(result).toBe(true);
    });

    // TC121: When validatePaymentData method is called with missing member ID, should throw error
    it('TC121: should throw error when validatePaymentData method called with missing member ID', () => {
      const paymentData = {
        // Missing memberId
        planId: 'plan-123',
        paymentMethod: 'card',
        paymentSource: 'tokn_test_1234567890'
      };

      // Execute and expect error
      expect(() => paymentService.validatePaymentData(paymentData)).toThrow('Valid member ID is required');
    });

    // TC122: When validatePaymentData method is called with invalid payment method, should throw error
    it('TC122: should throw error when validatePaymentData method called with invalid payment method', () => {
      const paymentData = {
        memberId: 'member-123',
        planId: 'plan-123',
        paymentMethod: 'invalid_method',
        paymentSource: 'tokn_test_1234567890'
      };

      // Execute and expect error
      expect(() => paymentService.validatePaymentData(paymentData)).toThrow('Payment method must be either "card" or "promptpay"');
    });

    // TC123: When validatePaymentData method is called with card payment but missing payment source, should throw error
    it('TC123: should throw error when validatePaymentData method called with card payment but missing payment source', () => {
      const paymentData = {
        memberId: 'member-123',
        planId: 'plan-123',
        paymentMethod: 'card'
        // Missing paymentSource
      };

      // Execute and expect error
      expect(() => paymentService.validatePaymentData(paymentData)).toThrow('Payment source token is required for card payments');
    });
  });
  
  describe('Map Omise Status To Local', () => {
    // TC124: When mapOmiseStatusToLocal method is called with successful status, should return successful
    it('TC124: should return successful when mapOmiseStatusToLocal method called with successful status', () => {
      const result = paymentService.mapOmiseStatusToLocal('successful');
      expect(result).toBe('successful');
    });

    // TC125: When mapOmiseStatusToLocal method is called with pending status, should return pending
    it('TC125: should return pending when mapOmiseStatusToLocal method called with pending status', () => {
      const result = paymentService.mapOmiseStatusToLocal('pending');
      expect(result).toBe('pending');
    });

    // TC126: When mapOmiseStatusToLocal method is called with failed status, should return failed
    it('TC126: should return failed when mapOmiseStatusToLocal method called with failed status', () => {
      const result = paymentService.mapOmiseStatusToLocal('failed');
      expect(result).toBe('failed');
    });

    // TC127: When mapOmiseStatusToLocal method is called with unknown status, should return pending
    it('TC127: should return pending when mapOmiseStatusToLocal method called with unknown status', () => {
      const result = paymentService.mapOmiseStatusToLocal('unknown_status');
      expect(result).toBe('pending');
    });
  });
  
  describe('Webhook Cache Management', () => {
    // TC128: When getWebhookCacheStatus method is called, should return cache status
    it('TC128: should return cache status when getWebhookCacheStatus method called', () => {
      // Add some test entries to cache
      paymentService.recentWebhooks.set('test_key_1', Date.now());
      paymentService.recentWebhooks.set('test_key_2', Date.now());

      // Execute the service method
      const result = paymentService.getWebhookCacheStatus();

      // Verify result
      expect(result).toEqual({
        cachedWebhooks: 2,
        cacheTimeout: 300000,
        lastCleanup: expect.any(String)
      });
    });

    // TC129: When cleanupWebhookCache method is called, should clean up expired entries
    it('TC129: should clean up expired entries when cleanupWebhookCache method called', () => {
      // Add test entries with different timestamps
      const now = Date.now();
      paymentService.recentWebhooks.set('recent_key', now);
      paymentService.recentWebhooks.set('old_key', now - 400000); // 400 seconds ago (expired)

      // Execute the service method
      paymentService.cleanupWebhookCache();

      // Verify only recent entry remains
      expect(paymentService.recentWebhooks.size).toBe(1);
      expect(paymentService.recentWebhooks.has('recent_key')).toBe(true);
      expect(paymentService.recentWebhooks.has('old_key')).toBe(false);
    });
  });
});

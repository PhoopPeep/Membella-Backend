// UTC-08: Payment Controller Test Case
const PaymentController = require('../src/controllers/paymentController');
const PaymentService = require('../src/services/paymentService');

describe('UTC-08: Payment Controller Test Case', () => {
  let paymentController, req, res;

  beforeEach(() => {
    // Initialize fresh instances for each test
    paymentController = new PaymentController();
    
    // Mock request object with common properties
    req = { 
      body: {}, 
      headers: {}, 
      user: {},
      params: {},
      query: {}
    };
    
    // Mock response object with Jest functions
    res = { 
      status: jest.fn().mockReturnThis(), 
      json: jest.fn(),
      setHeader: jest.fn()
    };
  });

  afterEach(() => {
    // Clear all mocks after each test
    jest.clearAllMocks();
  });
  
  describe('Get Omise Public Key', () => {
    // TC100: When getOmisePublicKey method is called with valid environment, should return public key
    it('TC100: should return public key when getOmisePublicKey method called with valid environment', async () => {
      // Mock environment variable
      const originalEnv = process.env.OMISE_PUBLIC_KEY;
      process.env.OMISE_PUBLIC_KEY = 'pkey_test_1234567890abcdef';

      // Execute the controller method
      await paymentController.getOmisePublicKey(req, res);

      // Verify response
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        publicKey: 'pkey_test_1234567890abcdef'
      });

      // Restore environment
      process.env.OMISE_PUBLIC_KEY = originalEnv;
    });

    // TC101: When getOmisePublicKey method is called without OMISE_PUBLIC_KEY, should return error
    it('TC101: should return error when getOmisePublicKey method called without OMISE_PUBLIC_KEY', async () => {
      // Mock missing environment variable
      const originalEnv = process.env.OMISE_PUBLIC_KEY;
      delete process.env.OMISE_PUBLIC_KEY;

      // Execute the controller method
      await paymentController.getOmisePublicKey(req, res);

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Payment system not properly configured'
      });

      // Restore environment
      process.env.OMISE_PUBLIC_KEY = originalEnv;
    });

    // TC102: When getOmisePublicKey method is called with invalid key format, should return error
    it('TC102: should return error when getOmisePublicKey method called with invalid key format', async () => {
      // Mock invalid environment variable
      const originalEnv = process.env.OMISE_PUBLIC_KEY;
      process.env.OMISE_PUBLIC_KEY = 'invalid_key_format';

      // Execute the controller method
      await paymentController.getOmisePublicKey(req, res);

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid payment configuration'
      });

      // Restore environment
      process.env.OMISE_PUBLIC_KEY = originalEnv;
    });
  });
  
  describe('Create Subscription Payment', () => {
    // TC103: When createSubscriptionPayment method is called with valid card payment data, should process payment successfully
    it('TC103: should process payment successfully when createSubscriptionPayment method called with valid card payment data', async () => {
      // Mock successful payment response
      const mockResult = {
        success: true,
        paymentId: 'payment-123',
        chargeId: 'chrg_test_123',
        amount: 100,
        currency: 'THB',
        status: 'successful'
      };
      
      // Mock the service method
      paymentController.paymentService.processSubscriptionPayment = jest.fn().mockResolvedValue(mockResult);
      
      // Set up request with valid card payment data
      req.user = { userId: 'member-123' };
      req.body = {
        planId: 'plan-123',
        paymentMethod: 'card',
        paymentSource: 'tokn_test_1234567890',
        customerData: {
          name: 'Test User'
        }
      };

      // Execute the controller method
      await paymentController.createSubscriptionPayment(req, res);

      // Verify the service was called with correct data
      expect(paymentController.paymentService.processSubscriptionPayment).toHaveBeenCalledWith({
        memberId: 'member-123',
        planId: 'plan-123',
        paymentMethod: 'card',
        paymentSource: 'tokn_test_1234567890',
        customerData: {
          name: 'Test User'
        }
      });

      // Verify response
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payment processed successfully',
        data: mockResult
      });
    });

    // TC104: When createSubscriptionPayment method is called with valid PromptPay payment data, should process payment successfully
    it('TC104: should process payment successfully when createSubscriptionPayment method called with valid PromptPay payment data', async () => {
      // Mock successful PromptPay payment response
      const mockResult = {
        success: true,
        paymentId: 'payment-123',
        chargeId: 'chrg_test_123',
        amount: 100,
        currency: 'THB',
        status: 'pending',
        qr_code_url: 'https://example.com/qr.png',
        expires_at: '2023-12-31T23:59:59Z'
      };
      
      // Mock the service method
      paymentController.paymentService.processSubscriptionPayment = jest.fn().mockResolvedValue(mockResult);
      
      // Set up request with valid PromptPay payment data
      req.user = { userId: 'member-123' };
      req.body = {
        planId: 'plan-123',
        paymentMethod: 'promptpay'
      };

      // Execute the controller method
      await paymentController.createSubscriptionPayment(req, res);

      // Verify the service was called with correct data
      expect(paymentController.paymentService.processSubscriptionPayment).toHaveBeenCalledWith({
        memberId: 'member-123',
        planId: 'plan-123',
        paymentMethod: 'promptpay',
        paymentSource: undefined,
        customerData: {}
      });

      // Verify response
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payment processed successfully',
        data: mockResult
      });
    });
  });
  
  describe('Get Payment Status', () => {
    // TC105: When getPaymentStatus method is called with valid payment ID, should return payment status
    it('TC105: should return payment status when getPaymentStatus method called with valid payment ID', async () => {
      // Mock payment data
      const mockPayment = {
        payment_id: 'payment-123',
        member_id: 'member-123',
        status: 'successful',
        amount: 100,
        currency: 'THB',
        payment_method: 'card',
        description: 'Test payment',
        plan: {
          name: 'Test Plan',
          owner: {
            org_name: 'Test Org'
          }
        },
        subscription: {
          subscription_id: 'sub-123',
          status: 'active',
          start_date: new Date('2023-01-01'),
          end_date: new Date('2023-12-31')
        },
        create_at: new Date('2023-01-01'),
        update_at: new Date('2023-01-01'),
        omise_charge_id: 'chrg_test_123'
      };

      // Mock the service method
      paymentController.paymentService.getPaymentStatus = jest.fn().mockResolvedValue(mockPayment);
      paymentController.paymentService.refreshPaymentFromOmise = jest.fn().mockResolvedValue(mockPayment);
      
      // Set up request
      req.user = { userId: 'member-123' };
      req.params = { paymentId: 'payment-123' };

      // Execute the controller method
      await paymentController.getPaymentStatus(req, res);

      // Verify the service was called with correct data
      expect(paymentController.paymentService.getPaymentStatus).toHaveBeenCalledWith('payment-123');

      // Verify response
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'payment-123',
          status: 'successful',
          amount: 100,
          currency: 'THB',
          paymentMethod: 'card',
          planName: 'Test Plan',
          organization: 'Test Org',
          subscription: expect.objectContaining({
            id: 'sub-123',
            status: 'active'
          })
        })
      });
    });

    // TC106: When getPaymentStatus method is called with payment belonging to different member, should return 403 error
    it('TC106: should return 403 error when getPaymentStatus method called with payment belonging to different member', async () => {
      // Mock payment data for different member
      const mockPayment = {
        payment_id: 'payment-123',
        member_id: 'different-member-123',
        status: 'successful',
        amount: 100,
        currency: 'THB',
        payment_method: 'card'
      };

      // Mock the service method
      paymentController.paymentService.getPaymentStatus = jest.fn().mockResolvedValue(mockPayment);
      
      // Set up request
      req.user = { userId: 'member-123' };
      req.params = { paymentId: 'payment-123' };

      // Execute the controller method
      await paymentController.getPaymentStatus(req, res);

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied'
      });
    });
  });
  
  describe('Handle Webhook', () => {
    // TC107: When handleWebhook method is called with valid charge.complete event, should process webhook successfully
    it('TC107: should process webhook successfully when handleWebhook method called with valid charge.complete event', async () => {
      // Mock webhook event
      const mockEvent = {
        key: 'charge.complete',
        data: {
          id: 'chrg_test_123',
          object: 'charge',
          status: 'successful',
          amount: 10000,
          currency: 'THB'
        }
      };

      // Mock the service method
      const mockProcessingResult = {
        processed: true,
        statusChanged: true,
        paymentId: 'payment-123',
        chargeId: 'chrg_test_123',
        previousStatus: 'pending',
        newStatus: 'successful'
      };

      paymentController.paymentService.handleWebhook = jest.fn().mockResolvedValue(mockProcessingResult);
      
      // Set up request
      req.body = mockEvent;

      // Execute the controller method
      await paymentController.handleWebhook(req, res);

      // Verify the service was called with correct data
      expect(paymentController.paymentService.handleWebhook).toHaveBeenCalledWith(mockEvent);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        received: true,
        processed: true,
        charge_id: 'chrg_test_123',
        event_type: 'charge.complete',
        processing_time_ms: expect.any(Number),
        timestamp: expect.any(String),
        result: mockProcessingResult
      });
    });
  });
  
  describe('Get Payment Methods', () => {
    // TC108: When getPaymentMethods method is called, should return supported payment methods
    it('TC108: should return supported payment methods when getPaymentMethods method called', async () => {
      // Execute the controller method
      await paymentController.getPaymentMethods(req, res);

      // Verify response
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            type: 'card',
            name: 'Credit/Debit Card',
            enabled: true
          }),
          expect.objectContaining({
            type: 'promptpay',
            name: 'PromptPay QR',
            enabled: true
          })
        ])
      });
    });
  });
  
  describe('Validate Payment', () => {
    // TC109: When validatePayment method is called with valid payment data, should return validation success
    it('TC109: should return validation success when validatePayment method called with valid payment data', async () => {
      // Set up request with valid payment data
      req.body = {
        planId: 'plan-123',
        paymentMethod: 'card',
        amount: 100,
        paymentSource: 'tokn_test_1234567890'
      };

      // Execute the controller method
      await paymentController.validatePayment(req, res);

      // Verify response
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        valid: true,
        message: 'Payment data is valid'
      });
    });
  });
  
  describe('Get Webhook Logs', () => {
    // TC110: When getWebhookLogs method is called in development mode, should return webhook logs
    it('TC110: should return webhook logs when getWebhookLogs method called in development mode', async () => {
      // Mock development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // Set up request
      req.query = { limit: 10 };

      // Execute the controller method
      await paymentController.getWebhookLogs(req, res);

      // Verify response
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            event_type: 'charge.successful',
            charge_id: 'chrg_test_123',
            status: 'processed'
          })
        ]),
        pagination: expect.objectContaining({
          total: 1,
          limit: 10,
          offset: 0
        })
      });

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    // TC111: When getWebhookLogs method is called in production mode, should return 403 error
    it('TC111: should return 403 error when getWebhookLogs method called in production mode', async () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Execute the controller method
      await paymentController.getWebhookLogs(req, res);

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Webhook logs only available in development mode'
      });

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });
});

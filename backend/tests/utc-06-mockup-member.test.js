// UTC-06: Member Authentication Test Case
const MemberAuthController = require('../src/controllers/memberAuthController');
const MemberAuthService = require('../src/services/memberAuthService');
const { requireMember } = require('../src/middleware/roleAuth');

describe('UTC-06: Member Authentication Test Case', () => {
  let memberAuthController, req, res;

  beforeEach(() => {
    // Initialize fresh instances for each test
    memberAuthController = new MemberAuthController();
    
    // Mock request object with common properties
    req = { 
      body: {}, 
      headers: {}, 
      user: {},
      params: {}
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
  
  describe('Member Registration', () => {
    // TC063: When register method is called with valid member data, should create member account and return success
    it('TC063: should create member account and return success when register method called with valid data', async () => {
      // Mock successful registration response
      const mockResult = {
        success: true,
        message: 'Registration successful! Please check your email (including spam folder) to verify your account. The verification email was sent from noreply@mail.supabase.io',
        requiresVerification: true,
        rateLimited: false,
        emailError: false,
        member: {
          member_id: 'member-123',
          email: 'test@example.com',
          full_name: 'Test User',
          phone: '1234567890'
        }
      };
      
      // Mock the service method
      memberAuthController.memberAuthService.register = jest.fn().mockResolvedValue(mockResult);
      
      // Set up request body with valid member data
      req.body = {
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        phone: '1234567890'
      };

      // Execute the controller method
      await memberAuthController.register(req, res);

      // Verify the service was called with correct data
      expect(memberAuthController.memberAuthService.register).toHaveBeenCalledWith({
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        phone: '1234567890'
      });

      // Verify response status and data
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });


    // TC064: When register method is called and member already exists, should return conflict error
    it('TC064: should return conflict error when register method called and member already exists', async () => {
      // Mock service response for existing member
      const mockResult = {
        success: false,
        message: 'This email is already registered. Please try logging in instead.',
        requiresVerification: false,
        rateLimited: false,
        emailError: true
      };
      
      memberAuthController.memberAuthService.register = jest.fn().mockResolvedValue(mockResult);
      
      req.body = {
        fullName: 'Test User',
        email: 'existing@example.com',
        password: 'password123',
        phone: '1234567890'
      };

      // Execute the controller method
      await memberAuthController.register(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    // TC065: When register method encounters service error, should return error response
    it('TC065: should return error response when register method encounters service error', async () => {
      // Mock service to throw error
      memberAuthController.memberAuthService.register = jest.fn().mockRejectedValue(new Error('Service error'));
      
      req.body = {
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        phone: '1234567890'
      };

      // Execute the controller method
      await memberAuthController.register(req, res);

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Registration failed. Please try again.',
        requiresVerification: false,
        rateLimited: false
      });
    });
  });
  
  describe('Member Login', () => {
    // TC066: When login method is called with valid credentials, should authenticate member and return JWT token
    it('TC066: should authenticate member and return JWT token when login method called with valid credentials', async () => {
      // Mock successful login response
      const mockResult = {
        success: true,
        message: 'Login successful.',
        token: 'jwt_token_string',
        user: {
          id: 'member-123',
          email: 'test@example.com',
          fullName: 'Test User',
          phone: '1234567890',
          role: 'member'
        },
        requiresVerification: false,
        rateLimited: false
      };
      
      // Mock the service method
      memberAuthController.memberAuthService.login = jest.fn().mockResolvedValue(mockResult);
      
      // Set up request body with valid credentials
      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      // Execute the controller method
      await memberAuthController.login(req, res);

      // Verify the service was called with correct data
      expect(memberAuthController.memberAuthService.login).toHaveBeenCalledWith('test@example.com', 'password123');

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });


    // TC067: When login method is called with invalid credentials, should return authentication error
    it('TC067: should return authentication error when login method called with invalid credentials', async () => {
      // Mock service response for invalid credentials
      const mockResult = {
        success: false,
        message: 'Invalid email or password. Please check your credentials and try again.',
        requiresVerification: false,
        rateLimited: false
      };
      
      memberAuthController.memberAuthService.login = jest.fn().mockResolvedValue(mockResult);
      
      req.body = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Execute the controller method
      await memberAuthController.login(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    // TC068: When login method is called and email not verified, should return verification required error
    it('TC068: should return verification required error when login method called and email not verified', async () => {
      // Mock service response for unverified email
      const mockResult = {
        success: false,
        message: 'Please verify your email address before signing in.',
        requiresVerification: true,
        rateLimited: false
      };
      
      memberAuthController.memberAuthService.login = jest.fn().mockResolvedValue(mockResult);
      
      req.body = {
        email: 'unverified@example.com',
        password: 'password123'
      };

      // Execute the controller method
      await memberAuthController.login(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    // TC069: When login method encounters service error, should return error response
    it('TC069: should return error response when login method encounters service error', async () => {
      // Mock service to throw error
      memberAuthController.memberAuthService.login = jest.fn().mockRejectedValue(new Error('Service error'));
      
      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      // Execute the controller method
      await memberAuthController.login(req, res);

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        requiresVerification: false,
        rateLimited: false
      });
    });
  });
  
  describe('Resend Verification', () => {
    // TC070: When resendVerification method is called with valid email, should resend verification email
    it('TC070: should resend verification email when resendVerification method called with valid email', async () => {
      // Mock successful resend response
      const mockResult = {
        success: true,
        message: 'Verification email sent successfully. Please check your inbox and spam folder. The email was sent from noreply@mail.supabase.io'
      };
      
      // Mock the service method
      memberAuthController.memberAuthService.resendVerification = jest.fn().mockResolvedValue(mockResult);
      
      // Set up request body with valid email
      req.body = {
        email: 'test@example.com'
      };

      // Execute the controller method
      await memberAuthController.resendVerification(req, res);

      // Verify the service was called with correct email
      expect(memberAuthController.memberAuthService.resendVerification).toHaveBeenCalledWith('test@example.com');

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });


    // TC071: When resendVerification method encounters service error, should return error response
    it('TC071: should return error response when resendVerification method encounters service error', async () => {
      // Mock service to throw error
      memberAuthController.memberAuthService.resendVerification = jest.fn().mockRejectedValue(new Error('Service error'));
      
      req.body = {
        email: 'test@example.com'
      };

      // Execute the controller method
      await memberAuthController.resendVerification(req, res);

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to resend verification email.',
        rateLimited: false
      });
    });
  });
  
  describe('Auth Callback', () => {
    // TC072: When handleAuthCallback method is called without tokens, should return error
    it('TC072: should return error when handleAuthCallback method called without tokens', async () => {
      // Set up request body without tokens
      req.body = {};

      // Execute the controller method
      await memberAuthController.handleAuthCallback(req, res);

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Missing access_token or refresh_token'
      });
    });

    // TC073: When handleAuthCallback method is called with invalid tokens, should return error
    it('TC073: should return error when handleAuthCallback method called with invalid tokens', async () => {
      // Mock Supabase to return error
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Invalid token' }
          })
        }
      };

      // Mock require to return our mock
      jest.doMock('../src/config/supabase', () => ({
        supabase: mockSupabase
      }));

      req.body = {
        access_token: 'invalid_token',
        refresh_token: 'invalid_refresh_token'
      };

      // Execute the controller method
      await memberAuthController.handleAuthCallback(req, res);

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid tokens or user not found'
      });
    });
  });
  
  describe('Change Password', () => {
    // TC074: When changePassword method is called with valid data, should change password successfully
    it('TC074: should change password successfully when changePassword method called with valid data', async () => {
      // Mock successful password change response
      const mockResult = {
        success: true,
        message: 'Password changed successfully'
      };
      
      // Mock the service method
      memberAuthController.memberAuthService.changePassword = jest.fn().mockResolvedValue(mockResult);
      
      // Set up request with valid data and authenticated user
      req.body = {
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123'
      };
      req.user = {
        userId: 'member-123'
      };

      // Execute the controller method
      await memberAuthController.changePassword(req, res);

      // Verify the service was called with correct data
      expect(memberAuthController.memberAuthService.changePassword).toHaveBeenCalledWith(
        'member-123',
        'oldpassword123',
        'newpassword123'
      );

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    // TC075: When changePassword method is called with incorrect current password, should return authentication error
    it('TC075: should return authentication error when changePassword method called with incorrect current password', async () => {
      // Mock service response for incorrect current password
      const mockResult = {
        success: false,
        message: 'Current password is incorrect',
        invalidPassword: true
      };
      
      memberAuthController.memberAuthService.changePassword = jest.fn().mockResolvedValue(mockResult);
      
      req.body = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      };
      req.user = {
        userId: 'member-123'
      };

      // Execute the controller method
      await memberAuthController.changePassword(req, res);

      // Verify response with appropriate status code
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    // TC076: When changePassword method encounters service error, should return error response
    it('TC076: should return error response when changePassword method encounters service error', async () => {
      // Mock service to throw error
      memberAuthController.memberAuthService.changePassword = jest.fn().mockRejectedValue(new Error('Service error'));
      
      req.body = {
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123'
      };
      req.user = {
        userId: 'member-123'
      };

      // Execute the controller method
      await memberAuthController.changePassword(req, res);

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        systemError: true
      });
    });
  });
});

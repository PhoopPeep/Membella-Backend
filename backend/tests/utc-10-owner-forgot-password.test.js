// UTC-10: Owner Forgot Password Test Case
const AuthController = require('../src/controllers/authController');
const AuthService = require('../src/services/authService');
const { ValidationError, NotFoundError } = require('../src/utils/errorHandler');

describe('UTC-10: Owner Forgot Password Test Case', () => {
  let authController, authService, req, res;

  beforeEach(() => {
    authController = new AuthController();
    authService = new AuthService();
    req = { 
      body: {}, 
      headers: {}, 
      user: {} 
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

  describe('Forgot Password', () => {
    // TC130: When forgotPassword method is called with valid email, should send reset email
    it('TC130: should send reset email when forgotPassword method called with valid email', async () => {
      const mockResult = {
        success: true,
        message: 'Password reset email sent successfully. Please check your inbox and spam folder.',
        emailSent: true
      };
      
      authController.authService.forgotPassword = jest.fn().mockResolvedValue(mockResult);
      req.body = {
        email: 'owner@example.com'
      };

      await authController.forgotPassword(req, res);

      expect(authController.authService.forgotPassword).toHaveBeenCalledWith('owner@example.com');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    // TC131: When forgotPassword method is called with non-existent email, should return error
    it('TC131: should return error when forgotPassword method called with non-existent email', async () => {
      const mockResult = {
        success: false,
        message: 'No account found with this email address.',
        emailSent: false
      };
      
      authController.authService.forgotPassword = jest.fn().mockResolvedValue(mockResult);
      req.body = {
        email: 'nonexistent@example.com'
      };

      await authController.forgotPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    // TC132: When forgotPassword method encounters service error, should return error response
    it('TC132: should return error response when forgotPassword method encounters service error', async () => {
      authController.authService.forgotPassword = jest.fn().mockRejectedValue(new Error('Service error'));
      req.body = {
        email: 'owner@example.com'
      };

      await authController.forgotPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        emailSent: false
      });
    });
  });

  describe('Reset Password', () => {
    // TC133: When resetPassword method is called with valid token and new password, should reset password successfully
    it('TC133: should reset password successfully when resetPassword method called with valid token and new password', async () => {
      const mockResult = {
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.'
      };
      
      authController.authService.resetPassword = jest.fn().mockResolvedValue(mockResult);
      req.body = {
        token: 'valid-reset-token',
        newPassword: 'newpassword123'
      };

      await authController.resetPassword(req, res);

      expect(authController.authService.resetPassword).toHaveBeenCalledWith('valid-reset-token', 'newpassword123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    // TC134: When resetPassword method is called with invalid token, should return error
    it('TC134: should return error when resetPassword method called with invalid token', async () => {
      const mockResult = {
        success: false,
        message: 'Invalid or expired reset token. Please request a new password reset.',
        tokenValid: false
      };
      
      authController.authService.resetPassword = jest.fn().mockResolvedValue(mockResult);
      req.body = {
        token: 'invalid-token',
        newPassword: 'newpassword123'
      };

      await authController.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    // TC135: When resetPassword method is called with weak password, should return validation error
    it('TC135: should return validation error when resetPassword method called with weak password', async () => {
      const mockResult = {
        success: false,
        message: 'Password must be at least 8 characters long',
        validationError: true
      };
      
      authController.authService.resetPassword = jest.fn().mockResolvedValue(mockResult);
      req.body = {
        token: 'valid-reset-token',
        newPassword: 'weak'
      };

      await authController.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('Forgot Password Service', () => {
    // TC136: When forgotPassword service is called with valid email, should generate reset token and send email
    it('TC136: should generate reset token and send email when forgotPassword service called with valid email', async () => {
      const mockUser = {
        owner_id: 'owner-123',
        email: 'owner@example.com',
        org_name: 'Test Org'
      };

      authService.userRepository = {
        findByEmail: jest.fn().mockResolvedValue(mockUser)
      };

      authService.generateResetToken = jest.fn().mockReturnValue('reset-token-123');
      authService.sendResetEmail = jest.fn().mockResolvedValue(true);

      const result = await authService.forgotPassword('owner@example.com');

      expect(authService.userRepository.findByEmail).toHaveBeenCalledWith('owner@example.com');
      expect(authService.generateResetToken).toHaveBeenCalledWith('owner-123');
      expect(authService.sendResetEmail).toHaveBeenCalledWith('owner@example.com', 'reset-token-123', 'Test Org');
      expect(result.success).toBe(true);
      expect(result.emailSent).toBe(true);
    });

    // TC137: When forgotPassword service is called with non-existent email, should return not found error
    it('TC137: should return not found error when forgotPassword service called with non-existent email', async () => {
      authService.userRepository = {
        findByEmail: jest.fn().mockResolvedValue(null)
      };

      const result = await authService.forgotPassword('nonexistent@example.com');

      expect(result.success).toBe(false);
      expect(result.message).toBe('No account found with this email address.');
      expect(result.emailSent).toBe(false);
    });
  });
});

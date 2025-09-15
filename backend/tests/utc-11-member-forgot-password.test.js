// UTC-11: Member Forgot Password Test Case
const MemberAuthController = require('../src/controllers/memberAuthController');
const MemberAuthService = require('../src/services/memberAuthService');
const { ValidationError, NotFoundError } = require('../src/utils/errorHandler');

describe('UTC-11: Member Forgot Password Test Case', () => {
  let memberAuthController, memberAuthService, req, res;

  beforeEach(() => {
    memberAuthController = new MemberAuthController();
    memberAuthService = new MemberAuthService();
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

  describe('Member Forgot Password', () => {
    // TC138: When forgotPassword method is called with valid email, should send reset email
    it('TC138: should send reset email when forgotPassword method called with valid email', async () => {
      const mockResult = {
        success: true,
        message: 'Password reset link has been sent to your email. Please check your inbox and spam folder.',
        rateLimited: false
      };
      
      // Mock the service method
      jest.spyOn(memberAuthService, 'forgotPassword').mockResolvedValue(mockResult);
      memberAuthController.memberAuthService = memberAuthService;
      
      req.body = {
        email: 'member@example.com'
      };

      await memberAuthController.forgotPassword(req, res);

      expect(memberAuthService.forgotPassword).toHaveBeenCalledWith('member@example.com');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    // TC139: When forgotPassword method is called with non-existent email, should return error
    it('TC139: should return error when forgotPassword method called with non-existent email', async () => {
      const mockResult = {
        success: false,
        message: 'Email not found in our system.',
        rateLimited: false
      };
      
      jest.spyOn(memberAuthService, 'forgotPassword').mockResolvedValue(mockResult);
      memberAuthController.memberAuthService = memberAuthService;
      
      req.body = {
        email: 'nonexistent@example.com'
      };

      await memberAuthController.forgotPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    // TC140: When forgotPassword method is called with invalid email format, should return validation error
    it('TC140: should return validation error when forgotPassword method called with invalid email format', async () => {
      req.body = {
        email: 'invalid-email-format'
      };

      await memberAuthController.forgotPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Please enter a valid email address',
        rateLimited: false
      });
    });

    // TC141: When forgotPassword method encounters rate limit, should return rate limited error
    it('TC141: should return rate limited error when forgotPassword method encounters rate limit', async () => {
      const mockResult = {
        success: false,
        message: 'Too many password reset attempts. Please wait at least 60 seconds before trying again.',
        rateLimited: true
      };
      
      jest.spyOn(memberAuthService, 'forgotPassword').mockResolvedValue(mockResult);
      memberAuthController.memberAuthService = memberAuthService;
      
      req.body = {
        email: 'member@example.com'
      };

      await memberAuthController.forgotPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    // TC142: When forgotPassword method encounters service error, should return error response
    it('TC142: should return error response when forgotPassword method encounters service error', async () => {
      jest.spyOn(memberAuthService, 'forgotPassword').mockRejectedValue(new Error('Service error'));
      memberAuthController.memberAuthService = memberAuthService;
      
      req.body = {
        email: 'member@example.com'
      };

      await memberAuthController.forgotPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        rateLimited: false
      });
    });
  });

  describe('Member Reset Password', () => {
    // TC143: When resetPassword method is called with valid token and new password, should reset password successfully
    it('TC143: should reset password successfully when resetPassword method called with valid token and new password', async () => {
      const mockResult = {
        success: true,
        message: 'Password has been reset successfully. You can now login with your new password.',
        rateLimited: false
      };
      
      jest.spyOn(memberAuthService, 'resetPassword').mockResolvedValue(mockResult);
      memberAuthController.memberAuthService = memberAuthService;
      
      req.body = {
        access_token: 'valid-reset-token',
        password: 'newpassword123'
      };

      await memberAuthController.resetPassword(req, res);

      expect(memberAuthService.resetPassword).toHaveBeenCalledWith('valid-reset-token', 'newpassword123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    // TC144: When resetPassword method is called with invalid token, should return error
    it('TC144: should return error when resetPassword method called with invalid token', async () => {
      const mockResult = {
        success: false,
        message: 'Invalid or expired reset link. Please request a new one.',
        rateLimited: false
      };
      
      jest.spyOn(memberAuthService, 'resetPassword').mockResolvedValue(mockResult);
      memberAuthController.memberAuthService = memberAuthService;
      
      req.body = {
        access_token: 'invalid-token',
        password: 'newpassword123'
      };

      await memberAuthController.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    // TC145: When resetPassword method is called with weak password, should return validation error
    it('TC145: should return validation error when resetPassword method called with weak password', async () => {
      req.body = {
        access_token: 'valid-reset-token',
        password: 'weak'
      };

      await memberAuthController.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Password must be at least 8 characters long',
        rateLimited: false
      });
    });
  });

  describe('Member Forgot Password Service', () => {
    // TC146: When forgotPassword service is called with valid email, should generate reset token and send email
    it('TC146: should generate reset token and send email when forgotPassword service called with valid email', async () => {
      const mockMember = {
        member_id: 'member-123',
        email: 'member@example.com',
        full_name: 'Test Member'
      };

      // Mock Prisma
      memberAuthService.prisma = {
        member: {
          findUnique: jest.fn().mockResolvedValue(mockMember)
        }
      };

      // Mock Supabase
      memberAuthService.supabase = {
        auth: {
          resetPasswordForEmail: jest.fn().mockResolvedValue({ data: {}, error: null })
        }
      };

      const result = await memberAuthService.forgotPassword('member@example.com');

      expect(memberAuthService.prisma.member.findUnique).toHaveBeenCalledWith({
        where: { email: 'member@example.com' }
      });
      expect(memberAuthService.supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'member@example.com',
        {
          redirectTo: `${process.env.MEMBER_FRONTEND_URL}/reset-password`
        }
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain('Password reset link has been sent');
    });

    // TC147: When forgotPassword service is called with non-existent email, should return not found error
    it('TC147: should return not found error when forgotPassword service called with non-existent email', async () => {
      memberAuthService.prisma = {
        member: {
          findUnique: jest.fn().mockResolvedValue(null)
        }
      };

      const result = await memberAuthService.forgotPassword('nonexistent@example.com');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Email not found in our system.');
      expect(result.rateLimited).toBe(false);
    });
  });
});

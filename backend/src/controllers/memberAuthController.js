const MemberAuthService = require('../services/memberAuthService');
const { asyncHandler } = require('../utils/errorHandler');

class MemberAuthController {
  constructor() {
    this.memberAuthService = new MemberAuthService();
  }

  // Member Registration
  register = asyncHandler(async (req, res) => {
    try {
      console.log('MemberAuthController: Register request received');
      
      const { fullName, email, password, phone } = req.body;
      
      // Basic validation
      if (!fullName || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Full name, email, and password are required',
          requiresVerification: false,
          rateLimited: false
        });
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid email address',
          requiresVerification: false,
          rateLimited: false
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long',
          requiresVerification: false,
          rateLimited: false
        });
      }
      
      const result = await this.memberAuthService.register({
        fullName,
        email,
        password,
        phone
      });

      console.log('Sending member register response:', {
        success: result.success,
        requiresVerification: result.requiresVerification
      });

      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(200).json(result);
      }

    } catch (error) {
      console.error('MemberAuthController register error:', error);
      
      res.status(200).json({
        success: false,
        message: 'Registration failed. Please try again.',
        requiresVerification: false,
        rateLimited: false
      });
    }
  });
  
  // Member Login
  login = asyncHandler(async (req, res) => {
    try {
      console.log('MemberAuthController: Login request received');
      
      const { email, password } = req.body;
      
      // Basic validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required',
          requiresVerification: false,
          rateLimited: false
        });
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid email address',
          requiresVerification: false,
          rateLimited: false
        });
      }
      
      const result = await this.memberAuthService.login(email, password);
      
      console.log('Sending member login response:', {
        success: result.success,
        hasToken: !!result.token,
        hasUser: !!result.user,
        requiresVerification: result.requiresVerification,
        rateLimited: result.rateLimited
      });

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(200).json(result);
      }

    } catch (error) {
      console.error('MemberAuthController login error:', error);
      
      res.status(200).json({
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        requiresVerification: false,
        rateLimited: false
      });
    }
  });
  
  // Resend member email verification
  resendVerification = asyncHandler(async (req, res) => {
    try {
      console.log('MemberAuthController: Resend verification request received');
      
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required',
          rateLimited: false
        });
      }
      
      const result = await this.memberAuthService.resendVerification(email);
      
      console.log('Sending member resend response:', {
        success: result.success
      });

      res.status(200).json(result);

    } catch (error) {
      console.error('MemberAuthController resend error:', error);
      
      res.status(200).json({
        success: false,
        message: 'Failed to resend verification email.',
        rateLimited: false
      });
    }
  });

  // Handle member auth callback (email verification)
  handleAuthCallback = asyncHandler(async (req, res) => {
    try {
      console.log('MemberAuthController: Auth callback request received');
      console.log('Member request body:', { 
        hasAccessToken: !!req.body.access_token, 
        hasRefreshToken: !!req.body.refresh_token,
        type: req.body.type 
      });
      
      const { access_token, refresh_token } = req.body;
      
      if (!access_token || !refresh_token) {
        console.log('Missing tokens in member request');
        return res.status(400).json({
          success: false,
          message: 'Missing access_token or refresh_token'
        });
      }

      // Verify the tokens with Supabase and get user data
      const { supabase } = require('../config/supabase');
      
      const { data: { user }, error } = await supabase.auth.getUser(access_token);
      
      console.log('Member Supabase user verification:', {
        hasUser: !!user,
        userId: user?.id,
        emailConfirmed: !!user?.email_confirmed_at,
        error: error?.message
      });
      
      if (error || !user) {
        console.log('Invalid tokens or user not found:', error?.message);
        return res.status(400).json({
          success: false,
          message: 'Invalid tokens or user not found'
        });
      }

      // Check if user is verified
      if (!user.email_confirmed_at) {
        console.log('Email not confirmed for member:', user.id);
        return res.status(400).json({
          success: false,
          message: 'Email not verified'
        });
      }

      // Get member from database
      const { getPrismaClient } = require('../config/database');
      const prisma = getPrismaClient();
      
      const dbMember = await prisma.member.findUnique({
        where: { member_id: user.id }
      });

      console.log('Member database lookup:', {
        found: !!dbMember,
        userId: user.id,
        dbMemberId: dbMember?.member_id
      });

      if (!dbMember) {
        console.log('Member not found in database:', user.id);
        return res.status(404).json({
          success: false,
          message: 'Member not found in database'
        });
      }

      // Generate JWT token for member
      const token = this.memberAuthService.generateToken(dbMember.member_id, dbMember.email);

      console.log('Member auth callback successful for user:', dbMember.member_id);

      res.json({
        success: true,
        message: 'Authentication successful',
        token,
        user: {
          id: dbMember.member_id,
          email: dbMember.email,
          fullName: dbMember.full_name,
          phone: dbMember.phone,
          role: 'member',
          createdAt: dbMember.create_at,
          updatedAt: dbMember.update_at
        }
      });

    } catch (error) {
      console.error('Member auth callback error:', error);
      res.status(500).json({
        success: false,
        message: 'Authentication callback failed'
      });
    }
  });

  // Member Change Password
  changePassword = asyncHandler(async (req, res) => {
    try {
      console.log('MemberAuthController: Change password request received');
      
      const { currentPassword, newPassword } = req.body;
      const memberId = req.user.userId; // From JWT token
      
      // Basic validation
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required',
          validationError: true
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 8 characters long',
          validationError: true
        });
      }

      if (currentPassword === newPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password must be different from current password',
          validationError: true
        });
      }
      
      const result = await this.memberAuthService.changePassword(
        memberId, 
        currentPassword, 
        newPassword
      );
      
      console.log('Sending member change password response:', {
        success: result.success,
        message: result.message
      });

      if (result.success) {
        res.status(200).json(result);
      } else {
        // Return appropriate status codes based on error type
        let statusCode = 500;
        if (result.validationError) statusCode = 400;
        if (result.invalidPassword) statusCode = 401;
        if (result.rateLimited) statusCode = 429;
        
        res.status(statusCode).json(result);
      }

    } catch (error) {
      console.error('MemberAuthController change password error:', error);
      
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        systemError: true
      });
    }
  });

  // Member Forgot Password
  forgotPassword = asyncHandler(async (req, res) => {
    try {
      console.log('MemberAuthController: Forgot password request received');
      
      const { email } = req.body;
      
      // Basic validation
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required',
          rateLimited: false
        });
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid email address',
          rateLimited: false
        });
      }
      
      const result = await this.memberAuthService.forgotPassword(email.trim());
      
      console.log('Sending member forgot password response:', {
        success: result.success,
        message: result.message,
        rateLimited: result.rateLimited
      });

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(200).json(result);
      }

    } catch (error) {
      console.error('MemberAuthController forgot password error:', error);
      
      res.status(200).json({
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        rateLimited: false
      });
    }
  });

  // Member Reset Password
  resetPassword = asyncHandler(async (req, res) => {
    try {
      console.log('MemberAuthController: Reset password request received');
      
      const { access_token, password } = req.body;
      
      // Basic validation
      if (!access_token || !password) {
        return res.status(400).json({
          success: false,
          message: 'Access token and password are required',
          rateLimited: false
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long',
          rateLimited: false
        });
      }
      
      const result = await this.memberAuthService.resetPassword(access_token, password);
      
      console.log('Sending member reset password response:', {
        success: result.success,
        message: result.message
      });

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(200).json(result);
      }

    } catch (error) {
      console.error('MemberAuthController reset password error:', error);
      
      res.status(200).json({
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        rateLimited: false
      });
    }
  });

  // Member Verify Reset Token
  verifyResetToken = asyncHandler(async (req, res) => {
    try {
      console.log('MemberAuthController: Verify reset token request received');
      
      const { access_token } = req.body;
      
      if (!access_token) {
        return res.status(400).json({
          success: false,
          message: 'Access token is required',
          rateLimited: false
        });
      }
      
      const result = await this.memberAuthService.verifyResetToken(access_token);
      
      console.log('Sending member verify reset token response:', {
        success: result.success,
        message: result.message,
        hasUser: !!result.user
      });

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(200).json(result);
      }

    } catch (error) {
      console.error('MemberAuthController verify reset token error:', error);
      
      res.status(200).json({
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        rateLimited: false
      });
    }
  });
}

module.exports = MemberAuthController;
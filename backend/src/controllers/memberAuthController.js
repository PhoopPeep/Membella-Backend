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
      
      const { access_token, refresh_token, type } = req.body;
      
      if (!access_token || !refresh_token) {
        return res.status(400).json({
          success: false,
          message: 'Missing access_token or refresh_token'
        });
      }

      // Verify the tokens with Supabase and get user data
      const { supabase } = require('../config/supabase');
      
      const { data: { user }, error } = await supabase.auth.getUser(access_token);
      
      if (error || !user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tokens or user not found'
        });
      }

      // Check if user is verified
      if (!user.email_confirmed_at) {
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

      if (!dbMember) {
        return res.status(404).json({
          success: false,
          message: 'Member not found in database'
        });
      }

      // Generate JWT token for member
      const token = this.memberAuthService.generateToken(dbMember.member_id, dbMember.email);

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
}

module.exports = MemberAuthController;
const AuthService = require('../services/authService');
const { asyncHandler } = require('../utils/errorHandler');

class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  // Regiater 
  register = asyncHandler(async (req, res) => {
    try {
      console.log('AuthController: Register request received');
      
      const { org_name, email, password, description, contact_info, logo } = req.body;
      
      const result = await this.authService.register({
        org_name,
        email,
        password,
        description,
        contact_info,
        logo
      });

      console.log('Sending register response:', {
        success: result.success,
        requiresVerification: result.requiresVerification
      });

      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(200).json(result);
      }

    } catch (error) {
      console.error('AuthController register error:', error);
      
      res.status(200).json({
        success: false,
        message: 'Registration failed. Please try again.',
        requiresVerification: false,
        rateLimited: false
      });
    }
  });
  
  // Login
  login = asyncHandler(async (req, res) => {
    try {
      console.log('AuthController: Login request received');
      console.log('Request body:', { 
        email: req.body.email, 
        hasPassword: !!req.body.password 
      });

      const { email, password } = req.body;
      
      // Basic validation
      if (!email || !password) {
        console.log('Missing email or password');
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
        console.log('Invalid email format:', email);
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid email address',
          requiresVerification: false,
          rateLimited: false
        });
      }
      
      console.log('Calling authService.login...');
      const result = await this.authService.login(email, password);
      
      console.log('Sending response:', {
        success: result.success,
        message: result.message,
        hasToken: !!result.token,
        hasUser: !!result.user,
        requiresVerification: result.requiresVerification,
        rateLimited: result.rateLimited
      });

      // return response
      if (result.success) {
        res.status(200).json(result);
      } else {
        // return response
        res.status(200).json(result);
      }

    } catch (error) {
      console.error('AuthController login error:', error);
      
      // return response
      res.status(200).json({
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        requiresVerification: false,
        rateLimited: false
      });
    }
  });
  
  // Resend email verification
  resendVerification = asyncHandler(async (req, res) => {
    try {
      console.log('AuthController: Resend verification request received');
      
      const { email } = req.body;
      
      const result = await this.authService.resendVerification(email);
      
      console.log('Sending resend response:', {
        success: result.success
      });

      res.status(200).json(result);

    } catch (error) {
      console.error('AuthController resend error:', error);
      
      res.status(200).json({
        success: false,
        message: 'Failed to resend verification email.',
        rateLimited: false
      });
    }
  });

  // Add missing handleAuthCallback method
  handleAuthCallback = asyncHandler(async (req, res) => {
    try {
      console.log('AuthController: Auth callback request received');
      console.log('Request body:', { 
        hasAccessToken: !!req.body.access_token, 
        hasRefreshToken: !!req.body.refresh_token
      });
      
      const { access_token, refresh_token } = req.body;
      
      if (!access_token || !refresh_token) {
        console.log('Missing tokens in request');
        return res.status(400).json({
          success: false,
          message: 'Missing access_token or refresh_token'
        });
      }

      // Verify the tokens with Supabase and get user data
      const { supabase } = require('../config/supabase');
      
      const { data: { user }, error } = await supabase.auth.getUser(access_token);
      
      console.log('Supabase user verification:', {
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
        console.log('Email not confirmed for user:', user.id);
        return res.status(400).json({
          success: false,
          message: 'Email not verified'
        });
      }

      // Get user from database
      const { getPrismaClient } = require('../config/database');
      const prisma = getPrismaClient();
      
      const dbUser = await prisma.owner.findUnique({
        where: { owner_id: user.id }
      });

      console.log('Database user lookup:', {
        found: !!dbUser,
        userId: user.id,
        dbUserId: dbUser?.owner_id
      });

      if (!dbUser) {
        console.log('User not found in database:', user.id);
        return res.status(404).json({
          success: false,
          message: 'User not found in database'
        });
      }

      // Generate JWT token
      const token = this.authService.generateToken(dbUser.owner_id, dbUser.email);

      console.log('Auth callback successful for user:', dbUser.owner_id);

      res.json({
        success: true,
        message: 'Authentication successful',
        token,
        user: {
          owner_id: dbUser.owner_id,
          org_name: dbUser.org_name,
          email: dbUser.email,
          description: dbUser.description,
          contact_info: dbUser.contact_info,
          logo: dbUser.logo,
          create_at: dbUser.create_at,
          update_at: dbUser.update_at
        }
      });

    } catch (error) {
      console.error('Auth callback error:', error);
      res.status(500).json({
        success: false,
        message: 'Authentication callback failed'
      });
    }
  });


  // Forgot Password
  forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    
    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }
    
    const result = await this.authService.forgotPassword(email.trim());
    
    res.json(result);
  });

  // Reset Password
  resetPassword = asyncHandler(async (req, res) => {
    const { access_token, password } = req.body;
    
    // Validation
    if (!access_token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Access token and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }
    
    const result = await this.authService.resetPassword(access_token, password);
    
    res.json(result);
  });

  // Verify Reset Token
  verifyResetToken = asyncHandler(async (req, res) => {
    const { access_token } = req.body;
    
    if (!access_token) {
      return res.status(400).json({
        success: false,
        message: 'Access token is required'
      });
    }
    
    const result = await this.authService.verifyResetToken(access_token);
    
    res.json(result);
  });
}

module.exports = AuthController;
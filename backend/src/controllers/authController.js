const AuthService = require('../services/authService');
const { asyncHandler } = require('../utils/errorHandler');

class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  // Regiater 
  register = asyncHandler(async (req, res) => {
    const { org_name, email, password, description, contact_info, logo } = req.body;
    
    const result = await this.authService.register({
      org_name,
      email,
      password,
      description,
      contact_info,
      logo
    });

    res.status(201).json(result);
  });
  
  // Login
  login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    const result = await this.authService.login(email, password);
    
    res.json(result);
  });
  
  // Resend email verification
  resendVerification = asyncHandler(async (req, res) => {
    const { email } = req.body;
    
    const result = await this.authService.resendVerification(email);
    
    res.json(result);
  });

  // Add missing handleAuthCallback method
  handleAuthCallback = asyncHandler(async (req, res) => {
    const { access_token, refresh_token, type } = req.body;
    
    if (!access_token || !refresh_token) {
      return res.status(400).json({
        success: false,
        message: 'Missing access_token or refresh_token'
      });
    }

    try {
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

      // Get user from database
      const { getPrismaClient } = require('../config/database');
      const prisma = getPrismaClient();
      
      const dbUser = await prisma.owner.findUnique({
        where: { owner_id: user.id }
      });

      if (!dbUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found in database'
        });
      }

      // Generate JWT token
      const token = this.authService.generateToken(dbUser.owner_id, dbUser.email);

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
}

module.exports = AuthController;
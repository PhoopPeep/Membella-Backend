const UserRepository = require('../repositories/userRepository');
const { supabase } = require('../config/supabase');
const jwt = require('jsonwebtoken');
const { ValidationError, AuthenticationError, ConflictError, AppError, NotFoundError } = require('../utils/errorHandler');
const User = require('../models/User');

class AuthService {
  constructor() {
    this.userRepository = new UserRepository();
    this.supabase = supabase;
    this.jwtSecret = process.env.JWT_SECRET || '65YHSNjVcJ9q4V2GGGlxvQ1hmGt2x344Po8CYi+U9aD5mdiMJlGMXLHF7YyC5Q5ZTCKWOeWfMYXkqDBG4SxSFw==';
  }

  async register(userData) {
    // Validate input
    const validationErrors = User.validate(userData);
    if (validationErrors.length > 0) {
      throw new ValidationError('Validation failed', validationErrors);
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Create user in Supabase Auth
     const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email: userData.email.toLowerCase().trim(),
      password: userData.password,
      options: {
        emailRedirectTo: `${process.env.FRONTEND_URL}/auth/callback`,
        data: {
          org_name: userData.org_name,
          description: userData.description,
          contact_info: userData.contact_info,
          logo: userData.logo
        }
      }
    });

    if (authData.user) {
      try {
        const newUser = await this.userRepository.create({
          owner_id: authData.user.id,
          org_name: userData.org_name,
          email: userData.email.toLowerCase().trim(),
          password: '',
          description: userData.description,
          contact_info: userData.contact_info,
          logo: userData.logo
        });

        return {
          success: true,
          message: 'Registration successful! Please check your email (including spam folder) to verify your account. The verification email was sent from noreply@mail.supabase.io',
          user: newUser,
          requiresVerification: true,
          supabaseUser: authData.user
        };
      } catch (dbError) {
        console.error('Database error during registration:', dbError);
        
        // Cleanup: Delete Supabase user if database creation fails
        try {
          await this.supabase.auth.admin.deleteUser(authData.user.id);
          console.log('Cleaned up Supabase user after database error');
        } catch (cleanupError) {
          console.error('Failed to cleanup Supabase user:', cleanupError);
        }
        
        throw new AppError('Registration failed due to database error. Please try again.', 500);
      }
    }

    throw new AppError('Failed to create user account. Please try again.', 400);
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }

  async resendVerification(email) {
  try {
    console.log('Attempting to resend verification email to:', email);
    
    const { data, error } = await this.supabase.auth.resend({
      type: 'signup',
      email: email.toLowerCase().trim(),
      options: {
        emailRedirectTo: `${process.env.FRONTEND_URL}/auth/callback`
      }
    });

    if (error) {
      console.error('Resend verification error:', error);
      
      if (error.message.includes('rate limit') || error.message.includes('Email rate limit exceeded')) {
        throw new AppError('Too many requests. Please wait at least 60 seconds before requesting another verification email.', 429);
      }
      if (error.message.includes('not found') || error.message.includes('Unable to process request')) {
        throw new NotFoundError('No account found with this email address, or the account is already verified.');
      }
      
      throw new ValidationError(`Failed to resend verification: ${error.message}`);
    }

    console.log('Resend verification result:', data);

    return {
      success: true,
      message: 'Verification email sent successfully. Please check your inbox and spam folder. The email was sent from noreply@mail.supabase.io'
    };
  } catch (error) {
    console.error('Resend verification service error: ', error);
    throw error;
  }
}

  async login(email, password) {
    // Authenticate with Supabase
    const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password
    });

    if (authError) {
      if (authError.message === 'Email not confirmed') {
        throw new AuthenticationError('Please verify your email address before signing in.');
      }
      if (authError.message.includes('Invalid login credentials')) {
        throw new AuthenticationError('Invalid email or password.');
      }
      throw new AuthenticationError(authError.message);
    }

    if (!authData.user || !authData.user.email_confirmed_at) {
      throw new AuthenticationError('Please verify your email address before signing in.');
    }

    // Get user from local database
    const user = await this.userRepository.findById(authData.user.id);
    if (!user) {
      throw new AuthenticationError('User not found in system.');
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.owner_id, email: user.email },
      this.jwtSecret,
      { expiresIn: '30min' }
    );

    return {
      success: true,
      message: 'Login successful.',
      token,
      user: user.toJSON(),
      supabaseSession: authData.session
    };
  }

  async resendVerification(email) {
    const { data, error } = await this.supabase.auth.resend({
      type: 'signup',
      email: email.toLowerCase(),
      options: {
        emailRedirectTo: `${process.env.FRONTEND_URL}/auth/callback`
      }
    });

    if (error) {
      if (error.message.includes('rate limit')) {
        throw new AppError('Too many requests. Please wait before requesting another verification email.', 429);
      }
      if (error.message.includes('not found')) {
        throw new NotFoundError('No account found with this email address.');
      }
      throw new ValidationError(error.message);
    }

    return {
      success: true,
      message: 'Verification email sent successfully. Please check your inbox and spam folder.'
    };
  }

  generateToken(userId, email) {
    return jwt.sign(
      { userId, email },
      this.jwtSecret,
      { expiresIn: '30min' }
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new AuthenticationError('Invalid or expired token');
    }
  }
}

module.exports = AuthService;
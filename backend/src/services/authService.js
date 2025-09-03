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
  try {
    console.log('AuthService: Starting login process for:', email);
    
    // Authenticate with Supabase
    const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password
    });

    console.log('Supabase auth response:', { 
      hasUser: !!authData.user, 
      hasSession: !!authData.session,
      error: authError?.message 
    });

    if (authError) {
      console.log('Supabase auth error:', authError.message);
      
      if (authError.message === 'Email not confirmed') {
        // return response
        return {
          success: false,
          message: 'Please verify your email address before signing in.',
          requiresVerification: true,
          rateLimited: false
        };
      }
      
      if (authError.message.includes('Invalid login credentials')) {
        // return response
        return {
          success: false,
          message: 'Invalid email or password. Please check your credentials and try again.',
          requiresVerification: false,
          rateLimited: false
        };
      }
      
      if (authError.message.includes('rate limit') || authError.message.includes('Too many')) {
        // return response
        return {
          success: false,
          message: 'Too many login attempts. Please wait a few minutes before trying again.',
          requiresVerification: false,
          rateLimited: true
        };
      }
      
      // return response
      return {
        success: false,
        message: authError.message || 'Login failed. Please try again.',
        requiresVerification: false,
        rateLimited: false
      };
    }

    if (!authData.user || !authData.user.email_confirmed_at) {
      console.log('User not confirmed:', { 
        hasUser: !!authData.user, 
        emailConfirmed: !!authData.user?.email_confirmed_at 
      });
      
      // return response
      return {
        success: false,
        message: 'Please verify your email address before signing in.',
        requiresVerification: true,
        rateLimited: false
      };
    }

    // Get user from local database
    const user = await this.userRepository.findById(authData.user.id);
    if (!user) {
      console.log('User not found in local database:', authData.user.id);
      
      // return response
      return {
        success: false,
        message: 'User account not found. Please contact support.',
        requiresVerification: false,
        rateLimited: false
      };
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.owner_id, email: user.email },
      this.jwtSecret,
      { expiresIn: '1day' }
    );

    console.log('Login successful for user:', user.owner_id);

    return {
      success: true,
      message: 'Login successful.',
      token,
      user: user.toJSON(),
      supabaseSession: authData.session,
      requiresVerification: false,
      rateLimited: false
    };

  } catch (error) {
    console.error('AuthService login error:', error);
    
    // return response
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again later.',
      requiresVerification: false,
      rateLimited: false
    };
  }
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

  // Forgot password - sent email with reset link
  async forgotPassword(email) {
    try {
      console.log('Sending password reset email to:', email);
      
      // Check that email exists in the database
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        // Return error if email does not exist in the system
        return {
          success: false,
          message: 'Email not found in our system.'
        };
      }

      // Send password reset email via Supabase
      const { data, error } = await this.supabase.auth.resetPasswordForEmail(
        email.toLowerCase().trim(),
        {
          redirectTo: `${process.env.OWNER_FRONTEND_URL}/reset-password`
        }
      );

      if (error) {
        console.error('Password reset email error:', error);
        
        if (error.message.includes('rate limit') || error.message.includes('Email rate limit exceeded')) {
          throw new AppError('Too many password reset attempts. Please wait at least 60 seconds before trying again.', 429);
        }
        
        throw new ValidationError(`Failed to send password reset email: ${error.message}`);
      }

      console.log('Password reset email sent successfully:', data);

      return {
        success: true,
        message: 'Password reset link has been sent to your email. Please check your inbox and spam folder.'
      };
    } catch (error) {
      console.error('Forgot password service error:', error);
      throw error;
    }
  }

  // Reset password using access token
  async resetPassword(accessToken, newPassword) {
    try {
      console.log('Attempting to reset password with token');

      if (!accessToken || !newPassword) {
        throw new ValidationError('Access token and new password are required');
      }

      if (newPassword.length < 8) {
        throw new ValidationError('Password must be at least 8 characters long');
      }

      // Verify the access token and reset password
      const { data: { user }, error: userError } = await this.supabase.auth.getUser(accessToken);
      
      if (userError || !user) {
        throw new AuthenticationError('Invalid or expired reset token');
      }

      // Update the user's password in Supabase
      const { error: updateError } = await this.supabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
      );

      if (updateError) {
        console.error('Password update error:', updateError);
        throw new AppError('Failed to update password. Please try again.');
      }

      // Update the user's last updated timestamp in the database
      await this.userRepository.update(user.id, {
        update_at: new Date()
      });

      console.log('Password reset successful for user:', user.id);

      return {
        success: true,
        message: 'Password has been reset successfully. You can now login with your new password.'
      };
    } catch (error) {
      console.error('Reset password service error:', error);
      throw error;
    }
  }

  // Verify reset token and return user info
  async verifyResetToken(accessToken) {
    try {
      console.log('Verifying reset token');

      if (!accessToken) {
        throw new ValidationError('Access token is required');
      }

      const { data: { user }, error } = await this.supabase.auth.getUser(accessToken);
      
      if (error || !user) {
        throw new AuthenticationError('Invalid or expired reset token');
      }

      // Check if user exists in the database
      const dbUser = await this.userRepository.findById(user.id);
      if (!dbUser) {
        throw new NotFoundError('User not found in system');
      }

      return {
        success: true,
        message: 'Reset token is valid',
        user: {
          email: user.email,
          org_name: dbUser.org_name
        }
      };
    } catch (error) {
      console.error('Verify reset token error:', error);
      throw error;
    }
  }
}

module.exports = AuthService;
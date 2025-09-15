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
    try {
      console.log('AuthService: Starting registration process for:', userData.email);
      console.log('AuthService: User data received:', {
        org_name: userData.org_name,
        email: userData.email,
        hasPassword: !!userData.password,
        description: userData.description,
        contact_info: userData.contact_info,
        logo: userData.logo
      });
      
      // Validate input
      console.log('AuthService: Validating user data...');
      const validationErrors = User.validate(userData);
      if (validationErrors.length > 0) {
        console.error('AuthService: Validation errors:', validationErrors);
        throw new ValidationError('Validation failed', validationErrors);
      }
      console.log('AuthService: Validation passed');

      // Check if user already exists
      console.log('AuthService: Checking if user already exists...');
      const existingUser = await this.userRepository.findByEmail(userData.email);
      if (existingUser) {
        console.error('AuthService: User already exists:', existingUser.email);
        throw new ConflictError('Email already registered');
      }
      console.log('AuthService: User does not exist, proceeding with registration');

      // Create user in Supabase Auth
      console.log('AuthService: Creating user in Supabase Auth...');
      
      // Set default frontend URL if not provided
      const frontendUrl = process.env.OWNER_FRONTEND_URL || 'http://localhost:5173';
      const redirectUrl = `${frontendUrl}/auth/callback`;
      
      console.log('🔧 Frontend URL:', frontendUrl);
      console.log('🔧 Redirect URL:', redirectUrl);
      console.log('🔧 Supabase URL:', process.env.SUPABASE_URL);
      
      const { data: authData, error: authError } = await this.supabase.auth.signUp({
        email: userData.email.toLowerCase().trim(),
        password: userData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            org_name: userData.org_name,
            description: userData.description,
            contact_info: userData.contact_info,
            logo: userData.logo
          }
        }
      });

      console.log('AuthService: Supabase signup response:', {
        hasUser: !!authData.user,
        hasSession: !!authData.session,
        error: authError?.message,
        userEmail: authData.user?.email,
        userId: authData.user?.id
      });

      if (authData.user && !authError) {
        try {
          console.log('AuthService: Creating user in database...');
          const newUser = await this.userRepository.create({
            owner_id: authData.user.id,
            org_name: userData.org_name,
            email: userData.email.toLowerCase().trim(),
            password: '',
            description: userData.description,
            contact_info: userData.contact_info,
            logo: userData.logo
          });

          console.log('AuthService: User created successfully in database');
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

      if (authError) {
        console.error('AuthService: Supabase auth error:', authError);
        throw new AppError(`Registration failed: ${authError.message}`, 400);
      }

      console.error('AuthService: No user created and no error - unexpected state');
      throw new AppError('Failed to create user account. Please try again.', 400);
    } catch (error) {
      console.error('Registration error:', error);
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
        { userId: user.owner_id, email: user.email, role: 'owner' },
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
    try {
      console.log('Attempting to resend verification email to:', email);
      
      const { data, error } = await this.supabase.auth.resend({
        type: 'signup',
        email: email.toLowerCase().trim(),
        options: {
          emailRedirectTo: `${process.env.OWNER_FRONTEND_URL || 'http://localhost:5173'}/auth/callback`
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
      if (error instanceof AppError || error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new AppError('Failed to resend verification email. Please try again.', 500);
    }
  }

  generateToken(userId, email) {
    return jwt.sign(
      { userId, email, role: 'owner' },
      this.jwtSecret,
      { expiresIn: '7d' }
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Invalid or expired token');
    }
  }

  // Forgot password - sent email with reset link using Supabase
  async forgotPassword(email) {
    try {
      console.log('Sending password reset email to:', email);
      
      // Check that email exists in the database
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        // Return error if email does not exist in the system
        return {
          success: false,
          message: 'No account found with this email address.',
          emailSent: false,
          rateLimited: false
        };
      }

      // Use Supabase's built-in password reset functionality
      const frontendUrl = process.env.OWNER_FRONTEND_URL || 'http://localhost:5173'
      const redirectUrl = `${frontendUrl}/reset-password`
      
      console.log('🔧 Sending password reset email with redirect URL:', redirectUrl)
      console.log('🔧 Supabase URL:', process.env.SUPABASE_URL)
      console.log('🔧 Frontend URL:', process.env.OWNER_FRONTEND_URL)
      
      const { data, error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
        // Add custom data for email template
        data: {
          site_name: 'Membella',
          support_email: 'support@membella.com'
        }
      });

      if (error) {
        console.error('Supabase password reset error:', error);
        
        if (error.message.includes('rate limit') || error.message.includes('Email rate limit exceeded')) {
          return {
            success: false,
            message: 'Too many requests. Please wait at least 60 seconds before requesting another password reset email.',
            emailSent: false,
            rateLimited: true
          };
        }
        
        return {
          success: false,
          message: 'Failed to send password reset email. Please try again.',
          emailSent: false,
          rateLimited: false
        };
      }

      console.log('Password reset email sent successfully via Supabase');

      return {
        success: true,
        message: 'Password reset email sent successfully. Please check your inbox and spam folder. The email was sent from noreply@mail.supabase.io',
        emailSent: true,
        rateLimited: false
      };
    } catch (error) {
      console.error('Forgot password service error:', error);
      
      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        emailSent: false,
        rateLimited: false
      };
    }
  }

  // Reset password using Supabase session
  async resetPassword(accessToken, newPassword) {
    try {
      console.log('🔧 AuthService: Attempting to reset password with Supabase session');
      console.log('🔧 AuthService: Token present:', !!accessToken);
      console.log('🔧 AuthService: Password present:', !!newPassword);

      if (!accessToken || !newPassword) {
        console.log('🔧 AuthService: Validation failed - missing token or password');
        return {
          success: false,
          message: 'Reset token and new password are required',
          tokenValid: false
        };
      }

      if (newPassword.length < 8) {
        console.log('🔧 AuthService: Validation failed - password too short');
        return {
          success: false,
          message: 'Password must be at least 8 characters long',
          validationError: true
        };
      }

      console.log('🔧 AuthService: Verifying access token with Supabase...');
      // Verify the access token with Supabase
      const { data: { user }, error: userError } = await this.supabase.auth.getUser(accessToken);
      
      if (userError || !user) {
        console.error('Invalid access token:', userError);
        return {
          success: false,
          message: 'Invalid or expired reset token. Please request a new password reset.',
          tokenValid: false
        };
      }

      console.log('🔧 AuthService: User verified, updating password...');
      // For password reset, we need to use admin API to update password
      // because the user doesn't have an active session
      const { data: updateData, error: updateError } = await this.supabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
      );

      if (updateError) {
        console.error('Password update error:', updateError);
        return {
          success: false,
          message: 'Failed to update password. Please try again.'
        };
      }

      console.log('🔧 AuthService: Password updated successfully');

      console.log('Password reset successful for user:', user.id);

      return {
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.'
      };
    } catch (error) {
      console.error('Reset password service error:', error);
      
      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.'
      };
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

  // Generate reset token (for testing purposes)
  generateResetToken(userId) {
    return jwt.sign(
      { userId, type: 'password_reset' },
      this.jwtSecret,
      { expiresIn: '1h' }
    );
  }

  // Send reset email (for testing purposes)
  async sendResetEmail(email, token, orgName) {
    // This would typically send an actual email
    // For testing purposes, we'll just return true
    console.log(`Sending reset email to ${email} for ${orgName} with token: ${token}`);
    return true;
  }

  // Validate reset token (for testing purposes)
  async validateResetToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      if (decoded.type !== 'password_reset') {
        throw new AuthenticationError('Invalid token type');
      }
      return decoded.userId;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Invalid or expired reset token');
    }
  }

  // Invalidate reset token (for testing purposes)
  async invalidateResetToken(token) {
    // In a real implementation, you would store used tokens in a blacklist
    // For testing purposes, we'll just return true
    console.log(`Invalidating reset token: ${token}`);
    return true;
  }
}

module.exports = AuthService;
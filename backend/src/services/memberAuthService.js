const { getPrismaClient } = require('../config/database');
const { supabase } = require('../config/supabase');
const jwt = require('jsonwebtoken');
const { ValidationError, AuthenticationError, ConflictError, AppError, NotFoundError } = require('../utils/errorHandler');

class MemberAuthService {
  constructor() {
    this.prisma = getPrismaClient();
    this.supabase = supabase;
    this.jwtSecret = process.env.JWT_SECRET || '65YHSNjVcJ9q4V2GGGlxvQ1hmGt2x344Po8CYi+U9aD5mdiMJlGMXLHF7YyC5Q5ZTCKWOeWfMYXkqDBG4SxSFw==';
  }

  async register(userData) {
    try {
      console.log('MemberAuthService: Starting member registration for:', userData.email);

      // Validate input
      if (!userData.fullName?.trim()) {
        throw new ValidationError('Full name is required');
      }
      if (!userData.email?.trim()) {
        throw new ValidationError('Email is required');
      }
      if (!userData.password?.trim()) {
        throw new ValidationError('Password is required');
      }
      if (userData.password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters long');
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email.trim())) {
        throw new ValidationError('Please enter a valid email address');
      }

      // Check if member already exists
      const existingMember = await this.prisma.member.findUnique({
        where: { email: userData.email.toLowerCase().trim() }
      });

      if (existingMember) {
        return {
          success: false,
          message: 'This email is already registered. Please try logging in instead.',
          requiresVerification: false,
          rateLimited: false,
          emailError: true
        };
      }

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await this.supabase.auth.signUp({
        email: userData.email.toLowerCase().trim(),
        password: userData.password,
        options: {
          emailRedirectTo: `${process.env.MEMBER_FRONTEND_URL}/auth/callback`,
          data: {
            full_name: userData.fullName,
            phone: userData.phone,
            role: 'member'
          }
        }
      });

      console.log('Supabase member auth response:', { 
        hasUser: !!authData.user, 
        hasSession: !!authData.session,
        error: authError?.message 
      });

      if (authError) {
        console.error('Supabase member auth error:', authError);
        
        if (authError.message.includes('rate limit') || authError.message.includes('Email rate limit exceeded')) {
          return {
            success: false,
            message: 'Email sending limit reached. Please wait 1 hour and try again.',
            requiresVerification: false,
            rateLimited: true,
            emailError: false
          };
        }

        if (authError.message.includes('already registered')) {
          return {
            success: false,
            message: 'This email is already registered. Please try logging in instead.',
            requiresVerification: false,
            rateLimited: false,
            emailError: true
          };
        }

        return {
          success: false,
          message: authError.message || 'Registration failed. Please try again.',
          requiresVerification: false,
          rateLimited: false,
          emailError: false
        };
      }

      if (authData.user) {
        try {
          // Create member in database
          const newMember = await this.prisma.member.create({
            data: {
              member_id: authData.user.id,
              email: userData.email.toLowerCase().trim(),
              full_name: userData.fullName.trim(),
              phone: userData.phone?.trim() || null,
              password: '' // Password is managed by Supabase
            }
          });

          console.log('Member created in database:', newMember.member_id);

          return {
            success: true,
            message: 'Registration successful! Please check your email (including spam folder) to verify your account. The verification email was sent from noreply@mail.supabase.io',
            member: {
              member_id: newMember.member_id,
              email: newMember.email,
              full_name: newMember.full_name,
              phone: newMember.phone,
              create_at: newMember.create_at,
              update_at: newMember.update_at
            },
            requiresVerification: true,
            rateLimited: false,
            emailError: false,
            supabaseUser: authData.user
          };
        } catch (dbError) {
          console.error('Database error during member registration:', dbError);
          
          // Cleanup: Delete Supabase user if database creation fails
          try {
            await this.supabase.auth.admin.deleteUser(authData.user.id);
            console.log('Cleaned up Supabase user after database error');
          } catch (cleanupError) {
            console.error('Failed to cleanup Supabase user:', cleanupError);
          }
          
          return {
            success: false,
            message: 'Registration failed due to database error. Please try again.',
            requiresVerification: false,
            rateLimited: false,
            emailError: false
          };
        }
      }

      return {
        success: false,
        message: 'Failed to create member account. Please try again.',
        requiresVerification: false,
        rateLimited: false,
        emailError: false
      };

    } catch (error) {
      console.error('MemberAuthService registration error:', error);
      
      if (error instanceof ValidationError) {
        return {
          success: false,
          message: error.message,
          requiresVerification: false,
          rateLimited: false,
          emailError: false
        };
      }

      return {
        success: false,
        message: 'Registration failed. Please try again.',
        requiresVerification: false,
        rateLimited: false,
        emailError: false
      };
    }
  }

  async login(email, password) {
    try {
      console.log('MemberAuthService: Starting member login for:', email);
      
      // Authenticate with Supabase
      const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password
      });

      console.log('Supabase member auth response:', { 
        hasUser: !!authData.user, 
        hasSession: !!authData.session,
        error: authError?.message 
      });

      if (authError) {
        console.log('Supabase member auth error:', authError.message);
        
        if (authError.message === 'Email not confirmed') {
          return {
            success: false,
            message: 'Please verify your email address before signing in.',
            requiresVerification: true,
            rateLimited: false
          };
        }
        
        if (authError.message.includes('Invalid login credentials')) {
          return {
            success: false,
            message: 'Invalid email or password. Please check your credentials and try again.',
            requiresVerification: false,
            rateLimited: false
          };
        }
        
        if (authError.message.includes('rate limit') || authError.message.includes('Too many')) {
          return {
            success: false,
            message: 'Too many login attempts. Please wait a few minutes before trying again.',
            requiresVerification: false,
            rateLimited: true
          };
        }
        
        return {
          success: false,
          message: authError.message || 'Login failed. Please try again.',
          requiresVerification: false,
          rateLimited: false
        };
      }

      if (!authData.user || !authData.user.email_confirmed_at) {
        console.log('Member not confirmed:', { 
          hasUser: !!authData.user, 
          emailConfirmed: !!authData.user?.email_confirmed_at 
        });
        
        return {
          success: false,
          message: 'Please verify your email address before signing in.',
          requiresVerification: true,
          rateLimited: false
        };
      }

      // Get member from local database
      const member = await this.prisma.member.findUnique({
        where: { member_id: authData.user.id }
      });

      if (!member) {
        console.log('Member not found in local database:', authData.user.id);
        
        return {
          success: false,
          message: 'Member account not found. Please contact support.',
          requiresVerification: false,
          rateLimited: false
        };
      }

      // Generate JWT token for member
      const token = jwt.sign(
        { 
          userId: member.member_id, 
          email: member.email,
          role: 'member'
        },
        this.jwtSecret,
        { expiresIn: '7d' }
      );

      console.log('Member login successful:', member.member_id);

      return {
        success: true,
        message: 'Login successful.',
        token,
        user: {
          id: member.member_id,
          email: member.email,
          fullName: member.full_name,
          phone: member.phone,
          role: 'member',
          createdAt: member.create_at,
          updatedAt: member.update_at
        },
        supabaseSession: authData.session,
        requiresVerification: false,
        rateLimited: false
      };

    } catch (error) {
      console.error('MemberAuthService login error:', error);
      
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
      console.log('Resending member verification email to:', email);
      
      const { data, error } = await this.supabase.auth.resend({
        type: 'signup',
        email: email.toLowerCase().trim(),
        options: {
          emailRedirectTo: `${process.env.MEMBER_FRONTEND_URL}/auth/callback`
        }
      });

      if (error) {
        console.error('Resend member verification error:', error);
        
        if (error.message.includes('rate limit') || error.message.includes('Email rate limit exceeded')) {
          return {
            success: false,
            message: 'Too many requests. Please wait at least 60 seconds before requesting another verification email.',
            rateLimited: true
          };
        }
        if (error.message.includes('not found') || error.message.includes('Unable to process request')) {
          return {
            success: false,
            message: 'No account found with this email address, or the account is already verified.',
            rateLimited: false
          };
        }
        
        return {
          success: false,
          message: `Failed to resend verification: ${error.message}`,
          rateLimited: false
        };
      }

      console.log('Member resend verification result:', data);

      return {
        success: true,
        message: 'Verification email sent successfully. Please check your inbox and spam folder. The email was sent from noreply@mail.supabase.io'
      };
    } catch (error) {
      console.error('Resend member verification service error: ', error);
      
      return {
        success: false,
        message: 'Failed to resend verification email.',
        rateLimited: false
      };
    }
  }

  // Change Password for Member
  async changePassword(memberId, currentPassword, newPassword) {
    try {
      console.log('MemberAuthService: Changing password for member:', memberId);
      
      // Validate inputs
      if (!currentPassword || !newPassword) {
        throw new ValidationError('Current password and new password are required');
      }

      if (newPassword.length < 8) {
        throw new ValidationError('New password must be at least 8 characters long');
      }

      // Get member from database
      const member = await this.prisma.member.findUnique({
        where: { member_id: memberId }
      });

      if (!member) {
        throw new NotFoundError('Member not found');
      }

      try {
        // First verify current password with Supabase
        const { error: signInError } = await this.supabase.auth.signInWithPassword({
          email: member.email,
          password: currentPassword
        });

        if (signInError) {
          console.log('Current password verification failed:', signInError.message);
          
          if (signInError.message.includes('Invalid login credentials')) {
            return {
              success: false,
              message: 'Current password is incorrect',
              invalidPassword: true
            };
          }
          
          if (signInError.message.includes('rate limit') || signInError.message.includes('Too many')) {
            return {
              success: false,
              message: 'Too many attempts. Please wait a few minutes before trying again.',
              rateLimited: true
            };
          }
          
          return {
            success: false,
            message: signInError.message || 'Password verification failed',
            invalidPassword: true
          };
        }

        // Update password in Supabase
        const { error: updateError } = await this.supabase.auth.admin.updateUserById(
          memberId,
          { password: newPassword }
        );

        if (updateError) {
          console.error('Password update error:', updateError);
          return {
            success: false,
            message: 'Failed to update password. Please try again.',
            systemError: true
          };
        }

        // Update timestamp in database
        await this.prisma.member.update({
          where: { member_id: memberId },
          data: { update_at: new Date() }
        });

        console.log('Password changed successfully for member:', memberId);

        return {
          success: true,
          message: 'Password changed successfully'
        };
        
      } catch (supabaseError) {
        console.error('Supabase password change error:', supabaseError);
        
        return {
          success: false,
          message: 'Failed to change password. Please try again.',
          systemError: true
        };
      }
      
    } catch (error) {
      console.error('MemberAuthService changePassword error:', error);
      
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        return {
          success: false,
          message: error.message,
          validationError: true
        };
      }

      return {
        success: false,
        message: 'An unexpected error occurred. Please try again later.',
        systemError: true
      };
    }
  }

  generateToken(userId, email) {
    return jwt.sign(
      { userId, email, role: 'member' },
      this.jwtSecret,
      { expiresIn: '7d' }
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new AuthenticationError('Invalid or expired token');
    }
  }

  // Forgot password - send email with reset link
  async forgotPassword(email) {
    try {
      console.log('Sending member password reset email to:', email);
      
      // Check that email exists in the database
      const member = await this.prisma.member.findUnique({
        where: { email: email.toLowerCase().trim() }
      });
      
      if (!member) {
        // Return error if email does not exist in the system
        return {
          success: false,
          message: 'Email not found in our system.',
          rateLimited: false
        };
      }

      // Send password reset email via Supabase
      const { data, error } = await this.supabase.auth.resetPasswordForEmail(
        email.toLowerCase().trim(),
        {
          redirectTo: `${process.env.MEMBER_FRONTEND_URL}/reset-password`
        }
      );

      if (error) {
        console.error('Member password reset email error:', error);
        
        if (error.message.includes('rate limit') || error.message.includes('Email rate limit exceeded')) {
          return {
            success: false,
            message: 'Too many password reset attempts. Please wait at least 60 seconds before trying again.',
            rateLimited: true
          };
        }
        
        return {
          success: false,
          message: `Failed to send password reset email: ${error.message}`,
          rateLimited: false
        };
      }

      console.log('Member password reset email sent successfully:', data);

      return {
        success: true,
        message: 'Password reset link has been sent to your email. Please check your inbox and spam folder.',
        rateLimited: false
      };
    } catch (error) {
      console.error('Member forgot password service error:', error);
      
      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        rateLimited: false
      };
    }
  }

  // Reset password using access token
  async resetPassword(accessToken, newPassword) {
    try {
      console.log('Resetting member password with access token');
      
      // Use Supabase to reset password
      const { data, error } = await this.supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('Member password reset error:', error);
        
        if (error.message.includes('rate limit') || error.message.includes('Too many')) {
          return {
            success: false,
            message: 'Too many attempts. Please wait a few minutes before trying again.',
            rateLimited: true
          };
        }
        
        return {
          success: false,
          message: `Failed to reset password: ${error.message}`,
          rateLimited: false
        };
      }

      console.log('Member password reset successful:', data);

      return {
        success: true,
        message: 'Password has been reset successfully. You can now login with your new password.',
        rateLimited: false
      };
    } catch (error) {
      console.error('Member reset password service error:', error);
      
      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        rateLimited: false
      };
    }
  }

  // Verify reset token
  async verifyResetToken(accessToken) {
    try {
      console.log('Verifying member reset token');
      
      // Use Supabase to verify the token
      const { data, error } = await this.supabase.auth.getUser(accessToken);

      if (error) {
        console.error('Member token verification error:', error);
        
        return {
          success: false,
          message: 'Invalid or expired reset link. Please request a new one.',
          rateLimited: false
        };
      }

      if (!data.user) {
        return {
          success: false,
          message: 'Invalid or expired reset link. Please request a new one.',
          rateLimited: false
        };
      }

      // Get member info from database
      const member = await this.prisma.member.findUnique({
        where: { email: data.user.email }
      });

      if (!member) {
        return {
          success: false,
          message: 'Member not found. Please contact support.',
          rateLimited: false
        };
      }

      console.log('Member token verification successful for:', data.user.email);

      return {
        success: true,
        message: 'Reset link is valid.',
        user: {
          email: member.email,
          fullName: member.full_name
        },
        rateLimited: false
      };
    } catch (error) {
      console.error('Member verify reset token service error:', error);
      
      return {
        success: false,
        message: 'Invalid or expired reset link. Please request a new one.',
        rateLimited: false
      };
    }
  }
}

module.exports = MemberAuthService;
// UTC-07: Member Authentication Service Test Case
const MemberAuthService = require('../src/services/memberAuthService');
const { ValidationError, AuthenticationError, NotFoundError } = require('../src/utils/errorHandler');

describe('UTC-07: Member Authentication Service Test Case', () => {
  let memberAuthService, mockPrisma, mockSupabase;

  beforeEach(() => {
    // Create mock Prisma client
    mockPrisma = {
      member: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      }
    };

    // Create mock Supabase client
    mockSupabase = {
      auth: {
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        resend: jest.fn(),
        getUser: jest.fn(),
        admin: {
          deleteUser: jest.fn(),
          updateUserById: jest.fn()
        }
      }
    };

    // Create service instance with mocked dependencies
    memberAuthService = new MemberAuthService();
    memberAuthService.prisma = mockPrisma;
    memberAuthService.supabase = mockSupabase;
  });

  afterEach(() => {
    // Clear all mocks after each test
    jest.clearAllMocks();
  });
  
  describe('Member Registration Service', () => {
    // TC077: When register method is called with valid user data, should create member successfully
    it('TC077: should create member successfully when register method called with valid user data', async () => {
      // Mock Supabase signup response
      const mockAuthData = {
        user: {
          id: 'supabase-user-123',
          email: 'test@example.com',
          email_confirmed_at: null
        },
        session: null
      };

      // Mock Prisma member creation
      const mockMember = {
        member_id: 'supabase-user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        phone: '1234567890',
        create_at: new Date(),
        update_at: new Date()
      };

      mockSupabase.auth.signUp.mockResolvedValue({
        data: mockAuthData,
        error: null
      });

      mockPrisma.member.findUnique.mockResolvedValue(null); // No existing member
      mockPrisma.member.create.mockResolvedValue(mockMember);

      // Test data
      const userData = {
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        phone: '1234567890'
      };

      // Execute the service method
      const result = await memberAuthService.register(userData);

      // Verify Supabase was called correctly
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          emailRedirectTo: `${process.env.MEMBER_FRONTEND_URL}/auth/callback`,
          data: {
            full_name: 'Test User',
            phone: '1234567890',
            role: 'member'
          }
        }
      });

      // Verify Prisma was called correctly
      expect(mockPrisma.member.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      });

      expect(mockPrisma.member.create).toHaveBeenCalledWith({
        data: {
          member_id: 'supabase-user-123',
          email: 'test@example.com',
          full_name: 'Test User',
          phone: '1234567890',
          password: ''
        }
      });

      // Verify result
      expect(result).toEqual({
        success: true,
        message: 'Registration successful! Please check your email (including spam folder) to verify your account. The verification email was sent from noreply@mail.supabase.io',
        member: {
          member_id: 'supabase-user-123',
          email: 'test@example.com',
          full_name: 'Test User',
          phone: '1234567890',
          create_at: mockMember.create_at,
          update_at: mockMember.update_at
        },
        requiresVerification: true,
        rateLimited: false,
        emailError: false,
        supabaseUser: mockAuthData.user
      });
    });

    // TC078: When register method is called with missing full name, should throw ValidationError
    it('TC078: should throw ValidationError when register method called with missing full name', async () => {
      const userData = {
        // Missing fullName
        email: 'test@example.com',
        password: 'password123',
        phone: '1234567890'
      };

      // Execute and expect ValidationError
      const result = await memberAuthService.register(userData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Full name is required');
      expect(result.requiresVerification).toBe(false);
      expect(result.rateLimited).toBe(false);
      expect(result.emailError).toBe(false);
    });

    // TC079: When register method is called with missing email, should throw ValidationError
    it('TC079: should throw ValidationError when register method called with missing email', async () => {
      const userData = {
        fullName: 'Test User',
        // Missing email
        password: 'password123',
        phone: '1234567890'
      };

      // Execute and expect ValidationError
      const result = await memberAuthService.register(userData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Email is required');
      expect(result.requiresVerification).toBe(false);
      expect(result.rateLimited).toBe(false);
      expect(result.emailError).toBe(false);
    });

    // TC080: When register method is called with short password, should throw ValidationError
    it('TC080: should throw ValidationError when register method called with short password', async () => {
      const userData = {
        fullName: 'Test User',
        email: 'test@example.com',
        password: '123', // Too short
        phone: '1234567890'
      };

      // Execute and expect ValidationError
      const result = await memberAuthService.register(userData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Password must be at least 8 characters long');
      expect(result.requiresVerification).toBe(false);
      expect(result.rateLimited).toBe(false);
      expect(result.emailError).toBe(false);
    });

    // TC081: When register method is called with invalid email format, should throw ValidationError
    it('TC081: should throw ValidationError when register method called with invalid email format', async () => {
      const userData = {
        fullName: 'Test User',
        email: 'invalid-email-format',
        password: 'password123',
        phone: '1234567890'
      };

      // Execute and expect ValidationError
      const result = await memberAuthService.register(userData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Please enter a valid email address');
      expect(result.requiresVerification).toBe(false);
      expect(result.rateLimited).toBe(false);
      expect(result.emailError).toBe(false);
    });

    // TC082: When register method is called and member already exists, should return conflict error
    it('TC082: should return conflict error when register method called and member already exists', async () => {
      // Mock existing member
      const existingMember = {
        member_id: 'existing-member-123',
        email: 'test@example.com',
        full_name: 'Existing User'
      };

      mockPrisma.member.findUnique.mockResolvedValue(existingMember);

      const userData = {
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        phone: '1234567890'
      };

      // Execute the service method
      const result = await memberAuthService.register(userData);

      // Verify result
      expect(result).toEqual({
        success: false,
        message: 'This email is already registered. Please try logging in instead.',
        requiresVerification: false,
        rateLimited: false,
        emailError: true
      });

      // Verify Supabase was not called
      expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
    });

    // TC083: When register method encounters database error, should cleanup and return error
    it('TC083: should cleanup and return error when register method encounters database error', async () => {
      // Mock Supabase signup success
      const mockAuthData = {
        user: {
          id: 'supabase-user-123',
          email: 'test@example.com'
        }
      };

      mockSupabase.auth.signUp.mockResolvedValue({
        data: mockAuthData,
        error: null
      });

      mockPrisma.member.findUnique.mockResolvedValue(null); // No existing member
      mockPrisma.member.create.mockRejectedValue(new Error('Database error')); // Database error
      mockSupabase.auth.admin.deleteUser.mockResolvedValue({}); // Cleanup success

      const userData = {
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        phone: '1234567890'
      };

      // Execute the service method
      const result = await memberAuthService.register(userData);

      // Verify cleanup was attempted
      expect(mockSupabase.auth.admin.deleteUser).toHaveBeenCalledWith('supabase-user-123');

      // Verify result
      expect(result).toEqual({
        success: false,
        message: 'Registration failed due to database error. Please try again.',
        requiresVerification: false,
        rateLimited: false,
        emailError: false
      });
    });
  });
  
  describe('Member Login Service', () => {
    // TC084: When login method is called with valid credentials, should authenticate successfully
    it('TC084: should authenticate successfully when login method called with valid credentials', async () => {
      // Mock Supabase login response
      const mockAuthData = {
        user: {
          id: 'supabase-user-123',
          email: 'test@example.com',
          email_confirmed_at: '2023-01-01T00:00:00Z'
        },
        session: {
          access_token: 'access_token',
          refresh_token: 'refresh_token'
        }
      };

      // Mock Prisma member
      const mockMember = {
        member_id: 'supabase-user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        phone: '1234567890',
        create_at: new Date(),
        update_at: new Date()
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: mockAuthData,
        error: null
      });

      mockPrisma.member.findUnique.mockResolvedValue(mockMember);

      // Execute the service method
      const result = await memberAuthService.login('test@example.com', 'password123');

      // Verify Supabase was called correctly
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });

      // Verify Prisma was called correctly
      expect(mockPrisma.member.findUnique).toHaveBeenCalledWith({
        where: { member_id: 'supabase-user-123' }
      });

      // Verify result
      expect(result.success).toBe(true);
      expect(result.message).toBe('Login successful.');
      expect(result.token).toBeDefined();
      expect(result.user).toEqual({
        id: 'supabase-user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        phone: '1234567890',
        role: 'member',
        createdAt: mockMember.create_at,
        updatedAt: mockMember.update_at
      });
      expect(result.requiresVerification).toBe(false);
      expect(result.rateLimited).toBe(false);
    });

    // TC085: When login method is called with unverified email, should return verification required
    it('TC085: should return verification required when login method called with unverified email', async () => {
      // Mock Supabase response for unverified email
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'supabase-user-123',
            email: 'test@example.com',
            email_confirmed_at: null // Not verified
          }
        },
        error: null
      });

      // Execute the service method
      const result = await memberAuthService.login('test@example.com', 'password123');

      // Verify result
      expect(result).toEqual({
        success: false,
        message: 'Please verify your email address before signing in.',
        requiresVerification: true,
        rateLimited: false
      });
    });

    // TC086: When login method is called and member not found in database, should return error
    it('TC086: should return error when login method called and member not found in database', async () => {
      // Mock Supabase login success
      const mockAuthData = {
        user: {
          id: 'supabase-user-123',
          email: 'test@example.com',
          email_confirmed_at: '2023-01-01T00:00:00Z'
        }
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: mockAuthData,
        error: null
      });

      mockPrisma.member.findUnique.mockResolvedValue(null); // Member not found

      // Execute the service method
      const result = await memberAuthService.login('test@example.com', 'password123');

      // Verify result
      expect(result).toEqual({
        success: false,
        message: 'Member account not found. Please contact support.',
        requiresVerification: false,
        rateLimited: false
      });
    });
  });
  
  describe('Resend Verification Service', () => {
    // TC087: When resendVerification method is called with valid email, should resend successfully
    it('TC087: should resend successfully when resendVerification method called with valid email', async () => {
      // Mock Supabase resend success
      mockSupabase.auth.resend.mockResolvedValue({
        data: { message: 'Email sent' },
        error: null
      });

      // Execute the service method
      const result = await memberAuthService.resendVerification('test@example.com');

      // Verify Supabase was called correctly
      expect(mockSupabase.auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'test@example.com',
        options: {
          emailRedirectTo: `${process.env.MEMBER_FRONTEND_URL}/auth/callback`
        }
      });

      // Verify result
      expect(result).toEqual({
        success: true,
        message: 'Verification email sent successfully. Please check your inbox and spam folder. The email was sent from noreply@mail.supabase.io'
      });
    });

    // TC088: When resendVerification method encounters rate limit error, should return rate limited error
    it('TC088: should return rate limited error when resendVerification method encounters rate limit error', async () => {
      // Mock Supabase rate limit error
      mockSupabase.auth.resend.mockResolvedValue({
        data: null,
        error: { message: 'Email rate limit exceeded' }
      });

      // Execute the service method
      const result = await memberAuthService.resendVerification('test@example.com');

      // Verify result
      expect(result).toEqual({
        success: false,
        message: 'Too many requests. Please wait at least 60 seconds before requesting another verification email.',
        rateLimited: true
      });
    });

    // TC089: When resendVerification method encounters user not found error, should return appropriate error
    it('TC089: should return appropriate error when resendVerification method encounters user not found error', async () => {
      // Mock Supabase user not found error
      mockSupabase.auth.resend.mockResolvedValue({
        data: null,
        error: { message: 'User not found' }
      });

      // Execute the service method
      const result = await memberAuthService.resendVerification('test@example.com');

      // Verify result
      expect(result).toEqual({
        success: false,
        message: 'No account found with this email address, or the account is already verified.',
        rateLimited: false
      });
    });
  });
  
  describe('Change Password Service', () => {
    // TC090: When changePassword method is called with valid data, should change password successfully
    it('TC090: should change password successfully when changePassword method called with valid data', async () => {
      // Mock member from database
      const mockMember = {
        member_id: 'member-123',
        email: 'test@example.com',
        full_name: 'Test User'
      };

      mockPrisma.member.findUnique.mockResolvedValue(mockMember);
      mockSupabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null }); // Current password valid
      mockSupabase.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null }); // Password update success
      mockPrisma.member.update.mockResolvedValue({}); // Database update success

      // Execute the service method
      const result = await memberAuthService.changePassword('member-123', 'oldpassword', 'newpassword123');

      // Verify Prisma was called correctly
      expect(mockPrisma.member.findUnique).toHaveBeenCalledWith({
        where: { member_id: 'member-123' }
      });

      // Verify Supabase current password verification
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'oldpassword'
      });

      // Verify Supabase password update
      expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledWith('member-123', {
        password: 'newpassword123'
      });

      // Verify database update
      expect(mockPrisma.member.update).toHaveBeenCalledWith({
        where: { member_id: 'member-123' },
        data: { update_at: expect.any(Date) }
      });

      // Verify result
      expect(result).toEqual({
        success: true,
        message: 'Password changed successfully'
      });
    });

    // TC091: When changePassword method is called with missing passwords, should throw ValidationError
    it('TC091: should throw ValidationError when changePassword method called with missing passwords', async () => {
      // Execute and expect ValidationError
      const result = await memberAuthService.changePassword('member-123', '', 'newpassword123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Current password and new password are required');
      expect(result.validationError).toBe(true);
    });

    // TC092: When changePassword method is called with short new password, should throw ValidationError
    it('TC092: should throw ValidationError when changePassword method called with short new password', async () => {
      // Execute and expect ValidationError
      const result = await memberAuthService.changePassword('member-123', 'oldpassword', '123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('New password must be at least 8 characters long');
      expect(result.validationError).toBe(true);
    });

    // TC093: When changePassword method is called with non-existent member, should throw NotFoundError
    it('TC093: should throw NotFoundError when changePassword method called with non-existent member', async () => {
      mockPrisma.member.findUnique.mockResolvedValue(null); // Member not found

      // Execute and expect NotFoundError
      const result = await memberAuthService.changePassword('non-existent-member', 'oldpassword', 'newpassword123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Member not found');
      expect(result.validationError).toBe(true);
    });

    // TC094: When changePassword method is called with incorrect current password, should return invalid password error
    it('TC094: should return invalid password error when changePassword method called with incorrect current password', async () => {
      // Mock member from database
      const mockMember = {
        member_id: 'member-123',
        email: 'test@example.com',
        full_name: 'Test User'
      };

      mockPrisma.member.findUnique.mockResolvedValue(mockMember);
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      });

      // Execute the service method
      const result = await memberAuthService.changePassword('member-123', 'wrongpassword', 'newpassword123');

      // Verify result
      expect(result).toEqual({
        success: false,
        message: 'Current password is incorrect',
        invalidPassword: true
      });
    });

    // TC095: When changePassword method encounters rate limit error, should return rate limited error
    it('TC095: should return rate limited error when changePassword method encounters rate limit error', async () => {
      // Mock member from database
      const mockMember = {
        member_id: 'member-123',
        email: 'test@example.com',
        full_name: 'Test User'
      };

      mockPrisma.member.findUnique.mockResolvedValue(mockMember);
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Too many requests' }
      });

      // Execute the service method
      const result = await memberAuthService.changePassword('member-123', 'oldpassword', 'newpassword123');

      // Verify result
      expect(result).toEqual({
        success: false,
        message: 'Too many attempts. Please wait a few minutes before trying again.',
        rateLimited: true
      });
    });
  });
  
  describe('Token Utilities', () => {
    // TC096: When generateToken method is called with valid parameters, should return JWT string
    it('TC096: should return JWT string when generateToken method called with valid parameters', () => {
      const userId = 'member-123';
      const email = 'test@example.com';
      
      const token = memberAuthService.generateToken(userId, email);
      
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      
      // Verify token can be decoded
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, memberAuthService.jwtSecret);
      expect(decoded.userId).toBe(userId);
      expect(decoded.email).toBe(email);
      expect(decoded.role).toBe('member');
    });

    // TC097: When verifyToken method is called with valid token, should return decoded payload
    it('TC097: should return decoded payload when verifyToken method called with valid token', () => {
      const userId = 'member-123';
      const email = 'test@example.com';
      
      const token = memberAuthService.generateToken(userId, email);
      const decoded = memberAuthService.verifyToken(token);
      
      expect(decoded.userId).toBe(userId);
      expect(decoded.email).toBe(email);
      expect(decoded.role).toBe('member');
    });

    // TC098: When verifyToken method is called with invalid token, should throw AuthenticationError
    it('TC098: should throw AuthenticationError when verifyToken method called with invalid token', () => {
      expect(() => {
        memberAuthService.verifyToken('invalid_jwt_token');
      }).toThrow(AuthenticationError);
    });

    // TC099: When verifyToken method is called with expired token, should throw AuthenticationError
    it('TC099: should throw AuthenticationError when verifyToken method called with expired token', () => {
      // Create an expired token
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: 'member-123', email: 'test@example.com', role: 'member' },
        memberAuthService.jwtSecret,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      expect(() => {
        memberAuthService.verifyToken(expiredToken);
      }).toThrow(AuthenticationError);
    });
  });
});

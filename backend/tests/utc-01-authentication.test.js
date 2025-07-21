// UTC-01: Authentication Test Case
const AuthController = require('../src/controllers/authController');
const AuthService = require('../src/services/authService');
const { authenticateToken } = require('../src/middleware/auth');
const { validateRegistration, validateLogin } = require('../src/middleware/validation');

describe('UTC-01: Authentication Test Case', () => {
  let authController, authService, req, res, next;

  beforeEach(() => {
    authController = new AuthController();
    authService = new AuthService();
    req = { body: {}, headers: {}, user: {} };
    res = { 
      status: jest.fn().mockReturnThis(), 
      json: jest.fn(),
      setHeader: jest.fn()
    };
    next = jest.fn();
  });

  // TC001: When register method is called with valid user data, should create user account and return success
  it('TC001: should create user account and return success when register method called with valid data', async () => {
    const mockResult = {
      success: true,
      message: 'Registration successful!',
      requiresVerification: true
    };
    
    authController.authService.register = jest.fn().mockResolvedValue(mockResult);
    req.body = {
      org_name: 'TestOrg',
      email: 'test@example.com',
      password: 'password123',
      description: 'Test Org'
    };

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  // TC002: When login method is called with valid credentials, should authenticate user and return JWT token
  it('TC002: should authenticate user and return JWT token when login method called with valid credentials', async () => {
    const mockResult = {
      success: true,
      message: 'Login successful.',
      token: 'jwt_token_string',
      user: {}
    };
    
    authController.authService.login = jest.fn().mockResolvedValue(mockResult);
    req.body = {
      email: 'test@example.com',
      password: 'password123'
    };

    await authController.login(req, res);

    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  // TC003: When resendVerification method is called with valid email, should resend verification email
  it('TC003: should resend verification email when resendVerification method called with valid email', async () => {
    const mockResult = {
      success: true,
      message: 'Verification email sent successfully.'
    };
    
    authController.authService.resendVerification = jest.fn().mockResolvedValue(mockResult);
    req.body = { email: 'test@example.com' };

    await authController.resendVerification(req, res);

    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  // TC004: When handleAuthCallback is called without tokens, should return error
  it('TC004: should return error when handleAuthCallback called without tokens', async () => {
    req.body = {};

    await authController.handleAuthCallback(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Missing access_token or refresh_token'
    });
  });

  // TC005: When register method is called and user already exists, should throw ConflictError
  it('TC005: should throw ConflictError when register method called and user already exists', async () => {
    const ConflictError = require('../src/utils/errorHandler').ConflictError;
    authService.userRepository = {
      findByEmail: jest.fn().mockResolvedValue(true)
    };

    const userData = {
      org_name: 'Test',
      email: 'existing@example.com',
      password: 'pass123'
    };

    await expect(authService.register(userData)).rejects.toThrow(ConflictError);
  });

  // TC006: When generateToken method is called with valid parameters, should return JWT string
  it('TC006: should return JWT string when generateToken method called with valid parameters', () => {
    const userId = 'user-123';
    const email = 'test@example.com';
    
    const token = authService.generateToken(userId, email);
    
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  // TC007: When login method is called with invalid credentials, should throw AuthenticationError
  it('TC007: should throw AuthenticationError when login method called with invalid credentials', async () => {
    const AuthenticationError = require('../src/utils/errorHandler').AuthenticationError;
    authService.supabase = {
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Invalid login credentials' }
        })
      }
    };

    await expect(authService.login('test@example.com', 'wrongpass')).rejects.toThrow(AuthenticationError);
  });

  // TC008: When verifyToken method is called with invalid token, should throw AuthenticationError
  it('TC008: should throw AuthenticationError when verifyToken method called with invalid token', () => {
    const AuthenticationError = require('../src/utils/errorHandler').AuthenticationError;
    
    expect(() => {
      authService.verifyToken('invalid_jwt_token');
    }).toThrow(AuthenticationError);
  });

  // TC009: When authenticateToken middleware receives valid JWT token, should set req.user and call next()
  it('TC009: should set req.user and call next when authenticateToken middleware receives valid JWT token', () => {
    const jwt = require('jsonwebtoken');
    const mockUser = { userId: 'user-123', email: 'test@example.com' };
    
    jwt.verify = jest.fn().mockReturnValue(mockUser);
    req.headers.authorization = 'Bearer valid_jwt_token';

    authenticateToken(req, res, next);

    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalled();
  });

  // TC010: When authenticateToken middleware receives no token, should return 401 error
  it('TC010: should return 401 error when authenticateToken middleware receives no token', () => {
    req.headers.authorization = undefined;

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Access token required.'
    });
  });

  // TC011: When authenticateToken middleware receives invalid token, should return 403 error
  it('TC011: should return 403 error when authenticateToken middleware receives invalid token', () => {
    const jwt = require('jsonwebtoken');
    jwt.verify = jest.fn().mockImplementation(() => {
      throw new Error('Invalid token');
    });
    req.headers.authorization = 'Bearer invalid_token';

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid or expired token.'
    });
  });

  // TC012: When validateRegistration middleware processes invalid data, should throw ValidationError
  it('TC012: should throw ValidationError when validateRegistration middleware processes invalid data', async () => {
    const ValidationError = require('../src/utils/errorHandler').ValidationError;
    req.body = {
      org_name: 'A',
      email: 'invalid-email',
      password: '123'
    };

    // Mock validation result
    const { validationResult } = require('express-validator');
    jest.doMock('express-validator', () => ({
      body: jest.fn(() => ({ trim: jest.fn(() => ({ isLength: jest.fn(() => ({ withMessage: jest.fn() })) })) })),
      validationResult: jest.fn(() => ({
        isEmpty: () => false,
        array: () => [
          { path: 'org_name', msg: 'Too short', value: 'A' },
          { path: 'email', msg: 'Invalid email', value: 'invalid-email' },
          { path: 'password', msg: 'Too short', value: '123' }
        ]
      }))
    }));

    expect(() => {
      const { validate } = require('../src/middleware/validation');
      validate(req, res, next);
    }).toThrow(ValidationError);
  });

  // TC013: When validateLogin middleware processes valid credentials, should call next()
  it('TC013: should call next when validateLogin middleware processes valid credentials', () => {
    req.body = {
      email: 'test@example.com',
      password: 'password123'
    };

    // Mock validation result for valid data
    const { validationResult } = require('express-validator');
    jest.doMock('express-validator', () => ({
      body: jest.fn(() => ({ isEmail: jest.fn(() => ({ normalizeEmail: jest.fn(() => ({ withMessage: jest.fn() })) })) })),
      validationResult: jest.fn(() => ({
        isEmpty: () => true,
        array: () => []
      }))
    }));

    const { validate } = require('../src/middleware/validation');
    validate(req, res, next);
    
    expect(next).toHaveBeenCalled();
  });
});
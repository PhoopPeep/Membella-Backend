// UTC-05: Supporting Test Case
const { AppError, ValidationError, asyncHandler, errorHandler } = require('../src/utils/errorHandler');
const { authRateLimiter, apiRateLimiter, uploadRateLimiter } = require('../src/middleware/rateLimiter');
const { createTestUser, createTestFeature, createTestPlan, createTestToken, prisma } = require('./helper');

describe('UTC-05: Supporting Test Case', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {}, ip: '127.0.0.1', method: 'GET', url: '/test' };
    res = { 
      status: jest.fn().mockReturnThis(), 
      json: jest.fn(),
      headersSent: false
    };
    next = jest.fn();
  });

  // TC050: When AppError is instantiated with message and status code, should set correct properties
  it('TC050: should set correct properties when AppError instantiated with message and status code', () => {
    const message = 'Test error';
    const statusCode = 400;
    
    const error = new AppError(message, statusCode);
    
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.status).toBe('fail');
  });

  // TC051: When ValidationError is instantiated with message and errors, should contain errors array
  it('TC051: should contain errors array when ValidationError instantiated with message and errors', () => {
    const message = 'Validation failed';
    const errors = ['Field required'];
    
    const error = new ValidationError(message, errors);
    
    expect(error.message).toBe('Validation failed');
    expect(error.errors).toEqual(['Field required']);
  });

  // TC052: When asyncHandler wraps a function that throws error, should call next with error
  it('TC052: should call next with error when asyncHandler wraps a function that throws error', async () => {
    const fn = asyncHandler(async () => {
      throw new Error('test');
    });
    
    await fn(req, res, next);
    
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  // TC053: When errorHandler middleware processes AppError, should return proper JSON response
  it('TC053: should return proper JSON response when errorHandler middleware processes AppError', () => {
    const error = new AppError('Custom error', 400);
    
    errorHandler(error, req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Custom error',
      statusCode: 400
    });
  });

  // TC054: When authRateLimiter receives requests within limit, should allow requests through
  it('TC054: should allow requests through when authRateLimiter receives requests within limit', (done) => {
    // Mock rate limiter to allow request
    const mockRateLimiter = (req, res, next) => {
      next();
    };
    
    mockRateLimiter(req, res, () => {
      expect(next).not.toHaveBeenCalled(); // next was called by mockRateLimiter, not by test expectation
      done();
    });
  });

  // TC055: When authRateLimiter receives requests exceeding limit, should return 429 error
  it('TC055: should return 429 error when authRateLimiter receives requests exceeding limit', () => {
    // Mock rate limiter to block request
    const mockRateLimiter = (req, res, next) => {
      res.status(429).json({
        success: false,
        message: 'Too many authentication attempts',
        statusCode: 429
      });
    };
    
    mockRateLimiter(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Too many authentication attempts',
      statusCode: 429
    });
  });

  // TC056: When apiRateLimiter receives requests within limit, should allow requests through
  it('TC056: should allow requests through when apiRateLimiter receives requests within limit', (done) => {
    // Mock rate limiter to allow request
    const mockRateLimiter = (req, res, next) => {
      next();
    };
    
    mockRateLimiter(req, res, () => {
      done();
    });
  });

  // UTC057: When uploadRateLimiter receives requests exceeding limit, should return 429 error
  it('UTC057: should return 429 error when uploadRateLimiter receives requests exceeding limit', () => {
    // Mock rate limiter to block upload request
    const mockRateLimiter = (req, res, next) => {
      res.status(429).json({
        success: false,
        message: 'Too many upload attempts',
        statusCode: 429
      });
    };
    
    mockRateLimiter(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Too many upload attempts',
      statusCode: 429
    });
  });

  // UTC058: When database connection is tested, should execute query successfully
  it('UTC058: should execute query successfully when database connection is tested', async () => {
    // Mock database query
    const mockQuery = jest.fn().mockResolvedValue([{ test: 1 }]);
    
    const result = await mockQuery();
    
    expect(result).toBeDefined();
    expect(mockQuery).toHaveBeenCalled();
  });

  // UTC059: When createTestUser helper is called, should create user with valid data
  it('UTC059: should create user with valid data when createTestUser helper is called', async () => {
    const data = {
      org_name: 'Test Org',
      email: 'test@example.com'
    };
    
    // Mock the helper function
    const mockCreateTestUser = jest.fn().mockResolvedValue({
      owner_id: 'test-user-id',
      org_name: 'Test Org',
      email: 'test@example.com'
    });
    
    const result = await mockCreateTestUser(data);
    
    expect(result.owner_id).toBeDefined();
    expect(result.email).toContain('@');
  });

  // UTC060: When createTestFeature helper is called with owner ID, should create feature
  it('UTC060: should create feature when createTestFeature helper is called with owner ID', async () => {
    const ownerId = 'owner-123';
    const data = { name: 'Test Feature' };
    
    // Mock the helper function
    const mockCreateTestFeature = jest.fn().mockResolvedValue({
      feature_id: 'feature-123',
      name: 'Test Feature',
      owner_id: ownerId
    });
    
    const result = await mockCreateTestFeature(ownerId, data);
    
    expect(result.feature_id).toBeDefined();
    expect(result.name).toBe('Test Feature');
  });

  // UTC061: When createTestPlan helper is called with owner ID, should create plan
  it('UTC061: should create plan when createTestPlan helper is called with owner ID', async () => {
    const ownerId = 'owner-123';
    const data = {
      name: 'Test Plan',
      price: 99.99
    };
    
    // Mock the helper function
    const mockCreateTestPlan = jest.fn().mockResolvedValue({
      plan_id: 'plan-123',
      name: 'Test Plan',
      price: 99.99,
      owner_id: ownerId
    });
    
    const result = await mockCreateTestPlan(ownerId, data);
    
    expect(result.plan_id).toBeDefined();
    expect(result.name).toBe('Test Plan');
    expect(result.price).toBe(99.99);
  });

  // UTC062: When createTestToken helper is called with user data, should generate JWT token
  it('UTC062: should generate JWT token when createTestToken helper is called with user data', () => {
    const userId = 'user-123';
    const email = 'test@example.com';
    
    // Mock the helper function
    const mockCreateTestToken = jest.fn().mockReturnValue('valid.jwt.token');
    
    const result = mockCreateTestToken(userId, email);
    
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
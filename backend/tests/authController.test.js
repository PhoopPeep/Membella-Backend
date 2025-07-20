const AuthController = require('../src/controllers/authController');
const AuthService = require('../src/services/authService');

describe('AuthController', () => {
  let controller, req, res;

  // Create a new instance and mock req/res before each test
  beforeEach(() => {
    controller = new AuthController();
    req = { body: {}, user: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });

  // Test the register method for successful registration
  it('should call register and return 201', async () => {
    controller.authService.register = jest.fn().mockResolvedValue({ success: true });
    req.body = { org_name: 'TestOrg', email: 'test@example.com', password: 'pass', description: '', contact_info: '', logo: '' };
    await controller.register(req, res);
    expect(controller.authService.register).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  // Test the login method for successful login
  it('should call login and return result', async () => {
    controller.authService.login = jest.fn().mockResolvedValue({ token: 'abc' });
    req.body = { email: 'test@example.com', password: 'pass' };
    await controller.login(req, res);
    expect(controller.authService.login).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ token: 'abc' });
  });

  // Test handleAuthCallback for missing tokens
  it('should handle missing tokens in handleAuthCallback', async () => {
    req.body = {};
    await controller.handleAuthCallback(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
}); 
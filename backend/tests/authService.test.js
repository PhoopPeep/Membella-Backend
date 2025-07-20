const AuthService = require('../src/services/authService');

describe('AuthService', () => {
  let service;

  // Create a new instance before each test and mock dependencies
  beforeEach(() => {
    service = new AuthService();
    service.userRepository = { findByEmail: jest.fn(), create: jest.fn(), findById: jest.fn() };
    service.supabase = { auth: { signUp: jest.fn(), signInWithPassword: jest.fn(), resend: jest.fn(), admin: { deleteUser: jest.fn() } } };
  });

  // Test that register throws if user already exists
  it('should throw if user already exists on register', async () => {
    service.userRepository.findByEmail.mockResolvedValue(true);
    await expect(service.register({ email: 'test@example.com', password: 'pass', org_name: 'org' })).rejects.toThrow();
  });

  // Test that generateToken returns a string JWT
  it('should generate a JWT token', () => {
    const token = service.generateToken('id', 'email@test.com');
    expect(typeof token).toBe('string');
  });

  // Test that login throws if user is not found
  it('should throw on login if user not found', async () => {
    service.supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { email_confirmed_at: true } }, error: null });
    service.userRepository.findById.mockResolvedValue(null);
    await expect(service.login('test@example.com', 'pass')).rejects.toThrow();
  });
}); 
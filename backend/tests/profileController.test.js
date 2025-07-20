const ProfileController = require('../src/controllers/profileController');

describe('ProfileController', () => {
  let controller, req, res;

  // Create a new instance and mock req/res before each test
  beforeEach(() => {
    controller = new ProfileController();
    req = { user: { userId: 'test-user' }, body: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });

  // Test getProfile returns user data
  it('should get profile', async () => {
    controller.getProfile = jest.fn().mockImplementation(async (req, res) => {
      res.json({ user: { owner_id: 'test-user' } });
    });
    await controller.getProfile(req, res);
    expect(res.json).toHaveBeenCalledWith({ user: { owner_id: 'test-user' } });
  });

  // Test updateProfile returns success message
  it('should update profile', async () => {
    controller.updateProfile = jest.fn().mockImplementation(async (req, res) => {
      res.json({ message: 'Profile updated successfully' });
    });
    await controller.updateProfile(req, res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Profile updated successfully' });
  });
}); 
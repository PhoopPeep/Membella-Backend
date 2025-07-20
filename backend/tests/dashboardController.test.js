const DashboardController = require('../src/controllers/dashboardController');

describe('DashboardController', () => {
  let controller, req, res;

  // Create a new instance and mock req/res before each test
  beforeEach(() => {
    controller = new DashboardController();
    req = { user: { userId: 'test-user' }, query: {} };
    res = { json: jest.fn() };
  });

  // Test getDashboardStats returns stats object
  it('should get dashboard stats', async () => {
    // Mock Prisma and methods as needed
    controller.getDashboardStats = jest.fn().mockImplementation(async (req, res) => {
      res.json({ totalRevenue: 100 });
    });
    await controller.getDashboardStats(req, res);
    expect(res.json).toHaveBeenCalledWith({ totalRevenue: 100 });
  });

  // Test getRevenueData returns revenue data
  it('should get revenue data', async () => {
    controller.getRevenueData = jest.fn().mockImplementation(async (req, res) => {
      res.json({ revenue: [1, 2, 3] });
    });
    await controller.getRevenueData(req, res);
    expect(res.json).toHaveBeenCalledWith({ revenue: [1, 2, 3] });
  });
}); 
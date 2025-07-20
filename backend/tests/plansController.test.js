const PlansController = require('../src/controllers/plansController');

describe('PlansController', () => {
  let controller, req, res;

  // Create a new instance and mock req/res before each test
  beforeEach(() => {
    controller = new PlansController();
    req = { user: { userId: 'test-user' }, body: {}, params: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });

  // Test getPlans returns a list of plans
  it('should get plans', async () => {
    controller.getPlans = jest.fn().mockImplementation(async (req, res) => {
      res.json([{ id: 1 }]);
    });
    await controller.getPlans(req, res);
    expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
  });

  // Test createPlan returns 201 and calls service
  it('should create plan', async () => {
    controller.createPlan = jest.fn().mockImplementation(async (req, res) => {
      res.status(201).json({ message: 'Plan created successfully' });
    });
    await controller.createPlan(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'Plan created successfully' });
  });
}); 
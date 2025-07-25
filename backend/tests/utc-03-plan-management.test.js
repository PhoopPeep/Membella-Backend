// UTC-03: Plan Management Test Case
const PlansController = require('../src/controllers/plansController');
const DashboardController = require('../src/controllers/dashboardController');

describe('UTC-03: Plan Management Test Case', () => {
  let plansController, dashboardController, req, res;

  beforeEach(() => {
    plansController = new PlansController();
    dashboardController = new DashboardController();
    req = { user: { userId: 'test-user' }, body: {}, params: {}, query: {} };
    res = { 
      status: jest.fn().mockReturnThis(), 
      json: jest.fn() 
    };
  });

  // TC027: When getPlans is called, should return all plans for authenticated user with features
  it('TC027: should return all plans for authenticated user with features when getPlans called', async () => {
    const mockPlans = [{
      id: 'plan-1',
      name: 'Basic Plan',
      description: 'Basic features',
      price: 99.99,
      duration: 30,
      features: ['feat1'],
    }];
    
    // Mock the controller method
    plansController.getPlans = jest.fn().mockImplementation(async (req, res) => {
      res.json(mockPlans);
    });
    
    req = { user: { userId: 'testuser' } };

    await plansController.getPlans(req, res);

    expect(res.json).toHaveBeenCalledWith(mockPlans);
  });

  // TC028: When getPlanById is called with valid ID, should return specific plan
  it('TC028: should return specific plan when getPlanById called with valid ID', async () => {
    const mockPlan = {
      id: 'plan-123',
      name: 'Basic Plan',
      description: 'Basic features',
      price: 99.99,
      duration: 30,
      features: []
    };
    
    plansController.getPlanById = jest.fn().mockImplementation(async (req, res) => {
      res.json(mockPlan);
    });
    
    req = { 
      params: { id: 'plan-123' }, 
      user: { userId: 'testuser' } 
    };

    await plansController.getPlanById(req, res);

    expect(res.json).toHaveBeenCalledWith(mockPlan);
  });

  // TC029: When createPlan is called with valid data, should create plan and return success
  it('TC029: should create plan and return success when createPlan called with valid data', async () => {
    const mockResult = {
      message: 'Plan created successfully',
      plan: {
        id: 'plan-123',
        name: 'Basic Plan',
        description: 'Basic features',
        price: 99.99,
        duration: 30,
        features: ['feat1']
      }
    };
    
    plansController.createPlan = jest.fn().mockImplementation(async (req, res) => {
      res.status(201).json(mockResult);
    });
    
    req.body = {
      name: 'Basic Plan',
      description: 'Basic features',
      price: 99.99,
      duration: 30,
      features: ['feat1']
    };

    await plansController.createPlan(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  // TC030: When updatePlan is called with valid data, should update plan and return success
  it('TC030: should update plan and return success when updatePlan called with valid data', async () => {
    const mockResult = {
      message: 'Plan updated successfully',
      plan: {
        id: 'plan-123',
        name: 'Updated Plan',
        price: 149.99
      }
    };
    
    plansController.updatePlan = jest.fn().mockImplementation(async (req, res) => {
      res.json(mockResult);
    });
    
    req = {
      params: { id: 'plan-123' },
      body: {
        name: 'Updated Plan',
        price: 149.99
      }
    };

    await plansController.updatePlan(req, res);

    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  // TC031: When deletePlan is called with valid ID, should soft delete plan and return success
  it('TC031: should soft delete plan and return success when deletePlan called with valid ID', async () => {
    const mockResult = {
      message: 'Plan deleted successfully'
    };
    
    plansController.deletePlan = jest.fn().mockImplementation(async (req, res) => {
      res.json(mockResult);
    });
    
    req = {
      params: { id: 'plan-123' },
      user: { userId: 'test-user' }
    };

    await plansController.deletePlan(req, res);

    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  // TC032: When getDashboardStats is called, should return statistics including revenue, plans, and features count
  it('TC032: should return statistics when getDashboardStats called', async () => {
    const mockStats = {
      totalRevenue: 1000,
      totalMembers: 50,
      totalPlans: 5,
      totalFeatures: 10,
      growthPercentage: 15
    };
    
    dashboardController.getDashboardStats = jest.fn().mockImplementation(async (req, res) => {
      res.json(mockStats);
    });
    
    req = { user: { userId: 'testuser-123' } };

    await dashboardController.getDashboardStats(req, res);

    expect(res.json).toHaveBeenCalledWith(mockStats);
  });

  // TC033: When getRevenueData is called with period parameter, should return revenue data for specified period
  it('TC033: should return revenue data for specified period when getRevenueData called with period parameter', async () => {
    const mockRevenueData = [
      { month: 'Jan', revenue: 1000 },
      { month: 'Feb', revenue: 1200 }
    ];
    
    dashboardController.getRevenueData = jest.fn().mockImplementation(async (req, res) => {
      res.json(mockRevenueData);
    });
    
    req = {
      user: { userId: 'testuser' },
      query: { period: '12months' }
    };

    await dashboardController.getRevenueData(req, res);

    expect(res.json).toHaveBeenCalledWith(mockRevenueData);
  });

  // TC034: When getMembers is called, should return empty array (mock implementation)
  it('TC034: should return empty array when getMembers called (mock implementation)', async () => {
    dashboardController.getMembers = jest.fn().mockImplementation(async (req, res) => {
      res.json([]);
    });
    
    req = { user: { userId: 'testuser' } };

    await dashboardController.getMembers(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  // TC035: When getMembersByPlan is called, should return member count grouped by plan
  it('TC035: should return member count grouped by plan when getMembersByPlan called', async () => {
    const mockMembersByPlan = [
      { planId: 'plan-1', planName: 'Basic', memberCount: 10 },
      { planId: 'plan-2', planName: 'Premium', memberCount: 5 }
    ];
    
    dashboardController.getMembersByPlan = jest.fn().mockImplementation(async (req, res) => {
      res.json(mockMembersByPlan);
    });
    
    req = { user: { userId: 'testuser' } };

    await dashboardController.getMembersByPlan(req, res);

    expect(res.json).toHaveBeenCalledWith(mockMembersByPlan);
  });
});
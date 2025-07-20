const FeaturesController = require('../src/controllers/featuresController');

describe('FeaturesController', () => {
  let controller, req, res;

  // Create a new instance and mock req/res before each test
  beforeEach(() => {
    controller = new FeaturesController();
    req = { user: { userId: 'test-user' }, body: {}, params: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });

  // Test getFeatures returns a list of features
  it('should get features', async () => {
    controller.featuresService.getAllFeatures = jest.fn().mockResolvedValue([{ id: 1 }]);
    await controller.getFeatures(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 1 }] });
  });

  // Test createFeature returns 201 and calls service
  it('should create feature', async () => {
    controller.featuresService.createFeature = jest.fn().mockResolvedValue({ success: true });
    req.body = { name: 'Test', description: 'desc' };
    await controller.createFeature(req, res);
    expect(controller.featuresService.createFeature).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
}); 
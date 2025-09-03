// UTC-02: Feature Management Test Case
const FeaturesController = require('../src/controllers/featuresController');
const FeaturesService = require('../src/services/featuresService');
const FeatureRepository = require('../src/repositories/featureRepository');
const Feature = require('../src/models/Features');
const { validateFeature } = require('../src/middleware/validation');

describe('UTC-02: Feature Management Test Case', () => {
  let featuresController, featuresService, featureRepository, req, res, next;

  beforeEach(() => {
    featuresController = new FeaturesController();
    featuresService = new FeaturesService();
    featureRepository = new FeatureRepository();
    req = { user: { userId: 'test-user' }, body: {}, params: {} };
    res = { 
      status: jest.fn().mockReturnThis(), 
      json: jest.fn() 
    };
    next = jest.fn();
  });

  // TC012: When getFeatures is called, should return all features for authenticated user
  it('TC012: should return all features for authenticated user when getFeatures called', async () => {
    const mockFeatures = [{ id: 'feature-1', name: 'Feature 1' }];
    featuresController.featuresService.getAllFeatures = jest.fn().mockResolvedValue(mockFeatures);
    req = { user: { userId: 'testuser' } };

    await featuresController.getFeatures(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: mockFeatures
    });
  });

  // TC013: When getFeatureById is called with valid ID, should return specific feature
  it('TC013: should return specific feature when getFeatureById called with valid ID', async () => {
    const mockFeature = { id: 'feature-123', name: 'Feature' };
    featuresController.featuresService.getFeatureById = jest.fn().mockResolvedValue(mockFeature);
    req = { 
      params: { id: 'feature-123' }, 
      user: { userId: 'test-user' } 
    };

    await featuresController.getFeatureById(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: mockFeature
    });
  });

  // TC014: When createFeature is called with valid data, should create new feature and return success
  it('TC014: should create new feature and return success when createFeature called with valid data', async () => {
    const mockResult = {
      success: true,
      message: 'Feature created successfully',
      data: { id: 'feature-123' }
    };
    featuresController.featuresService.createFeature = jest.fn().mockResolvedValue(mockResult);
    req.body = {
      name: 'New Feature',
      description: 'Feature description'
    };

    await featuresController.createFeature(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  // TC015: When getAllFeatures is called with valid owner ID, should return array of features
  it('TC015: should return array of features when getAllFeatures called with valid owner ID', async () => {
    const mockFeatures = [{ id: 'feature-1' }, { id: 'feature-2' }];
    featuresService.featureRepository = {
      findAll: jest.fn().mockResolvedValue(mockFeatures)
    };
    const ownerId = 'owner-123';

    const result = await featuresService.getAllFeatures(ownerId);

    expect(result).toEqual(mockFeatures);
  });

  // TC016: When getFeatureById is called with non-existing ID, should throw NotFoundError
  it('TC016: should throw NotFoundError when getFeatureById called with non-existing ID', async () => {
    const NotFoundError = require('../src/utils/errorHandler').NotFoundError;
    featuresService.featureRepository = {
      findById: jest.fn().mockResolvedValue(null)
    };

    await expect(featuresService.getFeatureById('non-existing-id', 'owner-123'))
      .rejects.toThrow(NotFoundError);
  });

  // TC017: When createFeature is called with invalid data, should throw ValidationError
  it('TC017: should throw ValidationError when createFeature called with invalid data', async () => {
    const ValidationError = require('../src/utils/errorHandler').ValidationError;
    const featureData = { name: '', description: '' };
    const ownerId = 'owner-123';

    await expect(featuresService.createFeature(featureData, ownerId))
      .rejects.toThrow(ValidationError);
  });

  // TC018: When featureRepository.findAll is called with owner ID, should return array of Feature objects
  it('TC018: should return array of Feature objects when featureRepository.findAll called with owner ID', async () => {
    const mockPrismaFeatures = [
      { feature_id: '1', name: 'Feature 1', owner_id: 'owner-123' }
    ];
    featureRepository.prisma = {
      feature: {
        findMany: jest.fn().mockResolvedValue(mockPrismaFeatures)
      }
    };

    const result = await featureRepository.findAll('owner-123');

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
  });

  // TC019: When featureRepository.create is called with feature data, should create and return Feature
  it('TC019: should create and return Feature when featureRepository.create called with feature data', async () => {
    const featureData = {
      name: 'Feature',
      description: 'Description',
      owner_id: 'owner-123'
    };
    const mockCreatedFeature = { feature_id: '123', ...featureData };
    featureRepository.prisma = {
      feature: {
        create: jest.fn().mockResolvedValue(mockCreatedFeature)
      }
    };

    const result = await featureRepository.create(featureData);

    expect(result).toBeInstanceOf(Feature);
  });

  // TC020: When Feature.validate is called with valid data, should return empty errors array
  it('TC020: should return empty errors array when Feature.validate called with valid data', () => {
    const data = {
      name: 'Valid Feature',
      description: 'Valid description with enough characters'
    };

    const errors = Feature.validate(data);

    expect(errors).toEqual([]);
  });

  // TC021: When Feature.validate is called with invalid data, should return validation errors
  it('TC021: should return validation errors when Feature.validate called with invalid data', () => {
    const data = {
      name: '',
      description: 'short'
    };

    const errors = Feature.validate(data);

    expect(errors).toContain('Feature name is required');
    expect(errors).toContain('Feature description must be at least 10 characters');
  });
});
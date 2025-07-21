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

  // TC014: When getFeatures is called, should return all features for authenticated user
  it('TC014: should return all features for authenticated user when getFeatures called', async () => {
    const mockFeatures = [{ id: 'feature-1', name: 'Feature 1' }];
    featuresController.featuresService.getAllFeatures = jest.fn().mockResolvedValue(mockFeatures);
    req = { user: { userId: 'testuser' } };

    await featuresController.getFeatures(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: mockFeatures
    });
  });

  // TC015: When getFeatureById is called with valid ID, should return specific feature
  it('TC015: should return specific feature when getFeatureById called with valid ID', async () => {
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

  // TC016: When createFeature is called with valid data, should create new feature and return success
  it('TC016: should create new feature and return success when createFeature called with valid data', async () => {
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

  // TC017: When updateFeature is called with valid data, should update feature and return success
  it('TC017: should update feature and return success when updateFeature called with valid data', async () => {
    const mockResult = {
      success: true,
      message: 'Feature updated successfully',
      data: { id: 'feature-123', name: 'Updated Feature' }
    };
    featuresController.featuresService.updateFeature = jest.fn().mockResolvedValue(mockResult);
    req = {
      params: { id: 'feature-123' },
      body: {
        name: 'Updated Feature',
        description: 'Updated desc'
      }
    };

    await featuresController.updateFeature(req, res);

    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  // TC018: When deleteFeature is called with valid ID, should soft delete feature and return success
  it('TC018: should soft delete feature and return success when deleteFeature called with valid ID', async () => {
    const mockResult = {
      success: true,
      message: 'Feature deleted successfully'
    };
    featuresController.featuresService.deleteFeature = jest.fn().mockResolvedValue(mockResult);
    req = {
      params: { id: 'feature-123' },
      user: { userId: 'test-user' }
    };

    await featuresController.deleteFeature(req, res);

    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  // TC019: When getAllFeatures is called with valid owner ID, should return array of features
  it('TC019: should return array of features when getAllFeatures called with valid owner ID', async () => {
    const mockFeatures = [{ id: 'feature-1' }, { id: 'feature-2' }];
    featuresService.featureRepository = {
      findAll: jest.fn().mockResolvedValue(mockFeatures)
    };
    const ownerId = 'owner-123';

    const result = await featuresService.getAllFeatures(ownerId);

    expect(result).toEqual(mockFeatures);
  });

  // TC020: When getFeatureById is called with non-existing ID, should throw NotFoundError
  it('TC020: should throw NotFoundError when getFeatureById called with non-existing ID', async () => {
    const NotFoundError = require('../src/utils/errorHandler').NotFoundError;
    featuresService.featureRepository = {
      findById: jest.fn().mockResolvedValue(null)
    };

    await expect(featuresService.getFeatureById('non-existing-id', 'owner-123'))
      .rejects.toThrow(NotFoundError);
  });

  // TC021: When createFeature is called with invalid data, should throw ValidationError
  it('TC021: should throw ValidationError when createFeature called with invalid data', async () => {
    const ValidationError = require('../src/utils/errorHandler').ValidationError;
    const featureData = { name: '', description: '' };
    const ownerId = 'owner-123';

    await expect(featuresService.createFeature(featureData, ownerId))
      .rejects.toThrow(ValidationError);
  });

  // TC022: When featureRepository.findAll is called with owner ID, should return array of Feature objects
  it('TC022: should return array of Feature objects when featureRepository.findAll called with owner ID', async () => {
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

  // TC023: When featureRepository.create is called with feature data, should create and return Feature
  it('TC023: should create and return Feature when featureRepository.create called with feature data', async () => {
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

  // TC024: When Feature.validate is called with valid data, should return empty errors array
  it('TC024: should return empty errors array when Feature.validate called with valid data', () => {
    const data = {
      name: 'Valid Feature',
      description: 'Valid description with enough characters'
    };

    const errors = Feature.validate(data);

    expect(errors).toEqual([]);
  });

  // TC025: When Feature.validate is called with invalid data, should return validation errors
  it('TC025: should return validation errors when Feature.validate called with invalid data', () => {
    const data = {
      name: '',
      description: 'short'
    };

    const errors = Feature.validate(data);

    expect(errors).toContain('Feature name is required');
    expect(errors).toContain('Feature description must be at least 10 characters');
  });

  // TC026: When validateFeature middleware processes invalid feature data, should throw ValidationError
  it('TC026: should throw ValidationError when validateFeature middleware processes invalid feature data', () => {
    const ValidationError = require('../src/utils/errorHandler').ValidationError;
    req.body = {
      name: 'A',
      description: 'short'
    };

    // Mock validation result
    const { validationResult } = require('express-validator');
    jest.doMock('express-validator', () => ({
      body: jest.fn(() => ({ trim: jest.fn(() => ({ isLength: jest.fn(() => ({ withMessage: jest.fn() })) })) })),
      validationResult: jest.fn(() => ({
        isEmpty: () => false,
        array: () => [
          { path: 'name', msg: 'Name too short', value: 'A' },
          { path: 'description', msg: 'Description too short', value: 'short' }
        ]
      }))
    }));

    expect(() => {
      const { validate } = require('../src/middleware/validation');
      validate(req, res, next);
    }).toThrow(ValidationError);
  });
});
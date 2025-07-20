const FeaturesService = require('../src/services/featuresService');

// Test suite for FeaturesService
describe('FeaturesService', () => {
  let service;

  // Create a new instance and mock dependencies before each test
  beforeEach(() => {
    service = new FeaturesService();
    service.featureRepository = { findAll: jest.fn(), create: jest.fn(), findById: jest.fn(), update: jest.fn(), softDelete: jest.fn() };
  });

  // Test that getAllFeatures returns an array of features
  it('should get all features', async () => {
    service.featureRepository.findAll.mockResolvedValue([{ id: 1 }]);
    const result = await service.getAllFeatures('owner');
    expect(result).toEqual([{ id: 1 }]);
  });

  // Test that getFeatureById throws if feature is not found
  it('should throw if feature not found on getFeatureById', async () => {
    service.featureRepository.findById.mockResolvedValue(null);
    await expect(service.getFeatureById('id', 'owner')).rejects.toThrow();
  });
}); 
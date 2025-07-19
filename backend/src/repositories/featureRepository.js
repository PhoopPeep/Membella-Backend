const { getPrismaClient } = require('../config/database');
const Feature = require('../models/Features');

class FeatureRepository {
  constructor() {
    this.prisma = getPrismaClient();
  }

  async findAll(ownerId) {
    const features = await this.prisma.feature.findMany({
      where: {
        owner_id: ownerId,
        delete_at: null
      },
      orderBy: {
        create_at: 'desc'
      }
    });
    return features.map(feature => Feature.fromPrisma(feature));
  }

  async findById(id, ownerId) {
    const feature = await this.prisma.feature.findFirst({
      where: {
        feature_id: id,
        owner_id: ownerId,
        delete_at: null
      }
    });
    return feature ? Feature.fromPrisma(feature) : null;
  }

  async create(featureData) {
    const feature = await this.prisma.feature.create({
      data: featureData
    });
    return Feature.fromPrisma(feature);
  }

  async update(id, updateData) {
    const feature = await this.prisma.feature.update({
      where: { feature_id: id },
      data: {
        ...updateData,
        update_at: new Date()
      }
    });
    return Feature.fromPrisma(feature);
  }

  async softDelete(id) {
    await this.prisma.feature.update({
      where: { feature_id: id },
      data: {
        delete_at: new Date()
      }
    });
  }
}

module.exports = FeatureRepository;
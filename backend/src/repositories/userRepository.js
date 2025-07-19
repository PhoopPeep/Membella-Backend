const { getPrismaClient } = require('../config/database');
const User = require('../models/User');

class UserRepository {
  constructor() {
    this.prisma = getPrismaClient();
  }

  async findById(id) {
    const user = await this.prisma.owner.findUnique({
      where: { owner_id: id }
    });
    return user ? User.fromPrisma(user) : null;
  }

  async findByEmail(email) {
    const user = await this.prisma.owner.findUnique({
      where: { email: email.toLowerCase() }
    });
    return user ? User.fromPrisma(user) : null;
  }

  async create(userData) {
    const user = await this.prisma.owner.create({
      data: {
        owner_id: userData.owner_id,
        org_name: userData.org_name,
        email: userData.email.toLowerCase(),
        password: userData.password || '',
        description: userData.description || null,
        contact_info: userData.contact_info || null,
        logo: userData.logo || null
      }
    });
    return User.fromPrisma(user);
  }

  async update(id, updateData) {
    const user = await this.prisma.owner.update({
      where: { owner_id: id },
      data: {
        ...updateData,
        update_at: new Date()
      }
    });
    return User.fromPrisma(user);
  }

  async delete(id) {
    await this.prisma.owner.delete({
      where: { owner_id: id }
    });
  }
}

module.exports = UserRepository;
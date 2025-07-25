require('dotenv').config({ path: '.env.test' });
const { PrismaClient } = require('../generated/prisma/client');
const jwt = require('jsonwebtoken');

const prisma = global.prisma || new PrismaClient();
if (!global.prisma) global.prisma = prisma;

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Create a test user
async function createTestUser(data = {}) {
  const defaultData = {
    owner_id: 'test-user-id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    org_name: 'Test Organization',
    email: `test${Date.now()}${Math.random().toString(36).substr(2, 5)}@example.com`,
    password: '',
    description: 'Test description',
    contact_info: 'test@example.com'
  };
  return await prisma.owner.create({ data: { ...defaultData, ...data } });
}

// Create a test feature
async function createTestFeature(ownerId, data = {}) {
  const defaultData = {
    name: 'Test Feature',
    description: 'Test feature description',
    owner_id: ownerId
  };
  return await prisma.feature.create({ data: { ...defaultData, ...data } });
}

// Create a test plan
async function createTestPlan(ownerId, data = {}) {
  const defaultData = {
    name: 'Test Plan',
    description: 'Test plan description',
    price: 99.99,
    duration: 30,
    owner_id: ownerId
  };
  return await prisma.plan.create({ data: { ...defaultData, ...data } });
}

// Create a JWT token for test
function createTestToken(userId, email) {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '1h' });
}

// Optional: Clean up all test data (call in afterEach/afterAll if needed)
async function cleanupTestData() {
  await prisma.plan.deleteMany({});
  await prisma.feature.deleteMany({});
  await prisma.owner.deleteMany({});
}

// Optional: Disconnect Prisma after all tests
async function disconnectPrisma() {
  await prisma.$disconnect();
}

module.exports = {
  prisma,
  createTestUser,
  createTestFeature,
  createTestPlan,
  createTestToken,
  cleanupTestData,
  disconnectPrisma
};
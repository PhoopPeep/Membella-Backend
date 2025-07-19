const { PrismaClient } = require('@prisma/client');

let prismaInstance = null;

// Get prisma
function getPrismaClient() {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
  }
  return prismaInstance;
}

// Connect to database
async function connectDatabase() {
  try {
    const prisma = getPrismaClient();
    await prisma.$connect();
    console.log('Database connected successfully');
    return prisma;
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

// Disconnect database
async function disconnectDatabase() {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
    console.log('Database disconnected');
  }
}

module.exports = {
  getPrismaClient,
  connectDatabase,
  disconnectDatabase
};
const { PrismaClient } = require('../../generated/prisma/client');

let prismaInstance = null;

function getPrismaClient() {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

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

async function disconnectDatabase() {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

module.exports = {
  getPrismaClient,
  connectDatabase,
  disconnectDatabase
};
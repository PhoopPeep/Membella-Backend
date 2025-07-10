const { PrismaClient } = require('../generated/prisma/client')

module.exports = async function globalTeardown() {
  console.log('Cleaning up test environment...')
  const prisma = new PrismaClient()
  await prisma.$disconnect()
  console.log('Test cleanup completed')
}
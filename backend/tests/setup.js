require('dotenv').config({ path: '.env.test' })
const { PrismaClient } = require('../generated/prisma/client')

let prisma

beforeAll(async () => {
  prisma = new PrismaClient()
  
  try {
    await prisma.$connect()
    console.log('Test database connected')
    
    console.log('Available models:', Object.keys(prisma).filter(key => 
      typeof prisma[key] === 'object' && 
      prisma[key] !== null && 
      'findMany' in prisma[key]
    ))
  } catch (error) {
    console.error('Test database connection failed:', error.message)
    throw error
  }
})

beforeEach(async () => {
  try {
    if (prisma.payment) await prisma.payment.deleteMany()
    if (prisma.member) await prisma.member.deleteMany()
    if (prisma.planFeature) await prisma.planFeature.deleteMany()
    if (prisma.plan) await prisma.plan.deleteMany()
    if (prisma.feature) await prisma.feature.deleteMany()
    if (prisma.owner) await prisma.owner.deleteMany()
  } catch (error) {
    console.error('Error cleaning database:', error.message)
  }
})

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect()
  }
})

global.prisma = prisma
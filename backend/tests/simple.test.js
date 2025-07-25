const { createTestUser, createTestFeature, prisma } = require('../tests/helper')

describe('Simple Database Test', () => {
  it('should connect to database', async () => {
    await expect(prisma.$queryRaw`SELECT 1 as test`).resolves.toBeDefined()
  })

  it('should create test user', async () => {
    const user = await createTestUser()
    expect(user.owner_id).toBeDefined()
    expect(user.email).toContain('@')
  })

  it('should create test feature', async () => {
    const user = await createTestUser()
    const feature = await createTestFeature(user.owner_id)
    expect(feature.feature_id).toBeDefined()
    expect(feature.name).toBe('Test Feature')
  })
})
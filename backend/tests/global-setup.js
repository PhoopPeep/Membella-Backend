const { execSync } = require('child_process')
require('dotenv').config({ path: '.env.test' })

module.exports = async function globalSetup() {
  console.log('Setting up test environment...')
  
  // set environment
  process.env.NODE_ENV = 'test'
  
  // reset database schema
  try {
    execSync('npx prisma db push --force-reset', { 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' },
      cwd: __dirname + '/..'
    })
    console.log('Test database schema created')
  } catch (error) {
    console.error('Failed to setup test database:', error.message)
    throw error
  }
}
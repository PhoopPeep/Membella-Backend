#!/usr/bin/env node

/**
 * Debug script to check payment system configuration
 * Run with: node debug-payment.js
 */

require('dotenv').config();

console.log('🔍 Membella Payment System Debug\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log('========================');

const requiredVars = [
  'OMISE_SECRET_KEY',
  'OMISE_PUBLIC_KEY',
  'OMISE_WEBHOOK_SECRET',
  'DATABASE_URL',
  'JWT_SECRET'
];

let allVarsPresent = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 10)}...`);
  } else {
    console.log(`❌ ${varName}: NOT SET`);
    allVarsPresent = false;
  }
});

console.log('\n🔧 Omise Configuration:');
console.log('======================');

try {
  const { omise, OMISE_CONFIG } = require('./src/config/omise');
  
  console.log('✅ Omise module loaded successfully');
  console.log(`✅ Currency: ${OMISE_CONFIG.currency}`);
  console.log(`✅ Test Mode: ${OMISE_CONFIG.isTestMode}`);
  console.log(`✅ Supported Methods: ${OMISE_CONFIG.supportedPaymentMethods.join(', ')}`);
  
  // Test Omise connection
  console.log('\n🌐 Testing Omise Connection:');
  console.log('============================');
  
  omise.charges.list({ limit: 1 }, (err, charges) => {
    if (err) {
      console.log('❌ Omise connection failed:', err.message);
    } else {
      console.log('✅ Omise connection successful');
      console.log(`✅ API Version: ${charges.object}`);
    }
  });
  
} catch (error) {
  console.log('❌ Failed to load Omise configuration:', error.message);
}

console.log('\n🗄️ Database Configuration:');
console.log('==========================');

try {
  const { getPrismaClient } = require('./src/config/database');
  const prisma = getPrismaClient();
  
  console.log('✅ Prisma client loaded successfully');
  
  // Test database connection
  prisma.$connect().then(() => {
    console.log('✅ Database connection successful');
    
    // Test payment table
    prisma.payment.count().then(count => {
      console.log(`✅ Payment table accessible (${count} records)`);
      process.exit(0);
    }).catch(err => {
      console.log('❌ Payment table error:', err.message);
      process.exit(1);
    });
  }).catch(err => {
    console.log('❌ Database connection failed:', err.message);
    process.exit(1);
  });
  
} catch (error) {
  console.log('❌ Failed to load database configuration:', error.message);
  process.exit(1);
}

console.log('\n📊 Summary:');
console.log('===========');

if (allVarsPresent) {
  console.log('✅ All required environment variables are set');
} else {
  console.log('❌ Some environment variables are missing');
  console.log('   Please check your .env file');
}

console.log('\n🚀 Next Steps:');
console.log('==============');
console.log('1. Make sure all environment variables are set');
console.log('2. Start the server: npm start');
console.log('3. Test the payment endpoints');
console.log('4. Check the webhook configuration');

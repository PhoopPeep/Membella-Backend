const Omise = require('omise');

console.log('Initializing Omise with keys:', {
  secretKey: process.env.OMISE_SECRET_KEY.substring(0, 10) + '...',
  publicKey: process.env.OMISE_PUBLIC_KEY.substring(0, 10) + '...',
  isTest: process.env.OMISE_SECRET_KEY.includes('test')
});

// Initialize Omise
const omise = Omise({
  secretKey: process.env.OMISE_SECRET_KEY,
  publicKey: process.env.OMISE_PUBLIC_KEY,
  apiVersion: '2019-05-29'
});

const OMISE_CONFIG = {
  currency: 'THB', // Thai Baht
  supportedPaymentMethods: ['card', 'promptpay'],
  webhookEndpoint: '/api/payments/webhook',
  minAmount: {
    card: 100, // 1 THB minimum for cards (100 satang)
    promptpay: 2000 // 20 THB minimum for PromptPay (2000 satang)
  },
  maxAmount: {
    card: 20000000, // 200,000 THB maximum for cards
    promptpay: 5000000 // 50,000 THB maximum for PromptPay
  },
  // Test mode detection
  isTestMode: process.env.OMISE_SECRET_KEY.includes('test'),
  // API endpoints
  apiEndpoint: 'https://api.omise.co',
  // Webhook events to listen for
  webhookEvents: [
    'charge.complete',
    'charge.successful', 
    'charge.failed',
    'charge.expired'
  ]
};

// Test the connection function
async function testOmiseConnection() {
  try {
    console.log('Testing Omise connection...');
    
    // Test basic connection by retrieving account
    const account = await omise.account.retrieve();
    console.log('Omise connection successful:', {
      id: account.id,
      email: account.email,
      currency: account.currency,
      supported_currencies: account.supported_currencies
    });
    
    // Check capabilities
    const capabilities = await omise.capability.retrieve();
    const promptpaySupported = capabilities.payment_methods.some(method => 
      method.name === 'promptpay' && method.currencies.includes('THB')
    );
    
    console.log('PromptPay capability:', promptpaySupported ? 'Supported' : 'Not supported');
    
    if (!promptpaySupported) {
      console.warn('PromptPay is not enabled for this account. Please contact Omise support at support@omise.co');
    }
    
    return {
      connected: true,
      account: account,
      promptpaySupported
    };
  } catch (error) {
    console.error('Omise connection failed:', error.message);
    
    // More detailed error info
    if (error.response) {
      console.error('API Response:', error.response.status, error.response.statusText);
      console.error('Response Data:', error.response.data);
    }
    
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    
    return {
      connected: false,
      error: error.message
    };
  }
}

module.exports = {
  omise,
  OMISE_CONFIG,
  testOmiseConnection
};
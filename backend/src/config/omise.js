const Omise = require('omise');

// Validate environment variables
if (!process.env.OMISE_SECRET_KEY) {
  throw new Error('OMISE_SECRET_KEY environment variable is required');
}

if (!process.env.OMISE_PUBLIC_KEY) {
  throw new Error('OMISE_PUBLIC_KEY environment variable is required');
}

console.log('Initializing Omise with configuration:', {
  secretKey: process.env.OMISE_SECRET_KEY.substring(0, 15) + '...',
  publicKey: process.env.OMISE_PUBLIC_KEY.substring(0, 15) + '...',
  isTestMode: process.env.OMISE_SECRET_KEY.includes('test'),
  environment: process.env.NODE_ENV || 'development'
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
    card: 100, // 1 THB minimum for cards
    promptpay: 2000 // 20 THB minimum for PromptPay
  },
  maxAmount: {
    card: 20000000, // 200,000 THB maximum for cards
    promptpay: 5000000 // 50,000 THB maximum for PromptPay
  },
  // Test mode detection
  isTestMode: process.env.OMISE_SECRET_KEY.includes('test'),
  // API endpoints
  apiEndpoint: 'https://api.omise.co',
  vaultEndpoint: 'https://vault.omise.co',
  // Webhook events to listen for
  webhookEvents: [
    'charge.complete',
    'charge.successful', 
    'charge.failed',
    'charge.expired'
  ],
  // Card validation settings
  card: {
    requireSecurityCodeCheck: true,
    supportedBrands: ['visa', 'mastercard', 'jcb', 'amex'],
    cvvLength: {
      visa: [3],
      mastercard: [3],
      amex: [4],
      jcb: [3]
    }
  },
  // PromptPay settings
  promptpay: {
    expiryMinutes: 15, // QR code expires in 15 minutes
    pollIntervalSeconds: 3, // Poll every 3 seconds
    maxPollAttempts: 300 // Poll for up to 15 minutes (300 * 3 seconds)
  }
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
      country: account.country,
      supported_currencies: account.supported_currencies
    });
    
    // Check capabilities
    const capabilities = await omise.capability.retrieve();
    
    // Check supported payment methods
    const supportedMethods = capabilities.payment_methods || [];
    const cardSupported = supportedMethods.some(method => 
      method.name === 'card' && method.currencies.includes('THB')
    );
    
    const promptpaySupported = supportedMethods.some(method => 
      method.name === 'promptpay' && method.currencies.includes('THB')
    );
    
    console.log('Payment method capabilities:');
    console.log('- Card payments:', cardSupported ? 'Supported ✓' : 'Not supported ✗');
    console.log('- PromptPay payments:', promptpaySupported ? 'Supported ✓' : 'Not supported ✗');
    
    if (!cardSupported) {
      console.warn('Card payments are not enabled for this account. Please contact Omise support at support@omise.co');
    }
    
    if (!promptpaySupported) {
      console.warn('PromptPay is not enabled for this account. Please contact Omise support at support@omise.co');
    }
    
    // Log all available payment methods
    console.log('Available payment methods:');
    supportedMethods.forEach(method => {
      console.log(`  - ${method.name}: ${method.currencies.join(', ')}`);
    });
    
    return {
      connected: true,
      account: account,
      cardSupported,
      promptpaySupported,
      supportedMethods
    };
  } catch (error) {
    console.error('Omise connection failed:', error.message);
    
    // More detailed error info
    if (error.response) {
      console.error('API Response:', error.response.status, error.response.statusText);
      if (error.response.data) {
        console.error('Response Data:', error.response.data);
      }
    }
    
    if (error.code) {
      console.error('Error Code:', error.code);
    }

    // Common error troubleshooting
    if (error.message.includes('authentication')) {
      console.error('Authentication failed. Please check your OMISE_SECRET_KEY');
    } else if (error.message.includes('network') || error.code === 'ENOTFOUND') {
      console.error('Network error. Please check your internet connection');
    }
    
    return {
      connected: false,
      error: error.message
    };
  }
}

// Validate token format
function validateToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token must be a string' };
  }
  
  if (!token.startsWith('tokn_')) {
    return { valid: false, error: 'Invalid token format - must start with tokn_' };
  }
  
  if (token.length < 25) {
    return { valid: false, error: 'Token appears to be too short' };
  }
  
  return { valid: true };
}

// Validate amount for different payment methods
function validateAmount(amount, paymentMethod) {
  const numAmount = parseFloat(amount);
  
  if (isNaN(numAmount) || numAmount <= 0) {
    return { valid: false, error: 'Amount must be a positive number' };
  }
  
  const amountInSatang = Math.round(numAmount * 100);
  const config = OMISE_CONFIG;
  
  if (paymentMethod === 'card') {
    if (amountInSatang < config.minAmount.card) {
      return { valid: false, error: `Card payment minimum is ${config.minAmount.card / 100} THB` };
    }
    if (amountInSatang > config.maxAmount.card) {
      return { valid: false, error: `Card payment maximum is ${config.maxAmount.card / 100} THB` };
    }
  } else if (paymentMethod === 'promptpay') {
    if (amountInSatang < config.minAmount.promptpay) {
      return { valid: false, error: `PromptPay minimum is ${config.minAmount.promptpay / 100} THB` };
    }
    if (amountInSatang > config.maxAmount.promptpay) {
      return { valid: false, error: `PromptPay maximum is ${config.maxAmount.promptpay / 100} THB` };
    }
  }
  
  return { valid: true, amountInSatang };
}

// Format error messages for better user experience
function formatOmiseError(error) {
  const errorMessages = {
    'authentication_failure': 'Payment authentication failed. Please try again.',
    'bad_request': 'Invalid payment request. Please check your information.',
    'invalid_card': 'Invalid card information. Please check your card details.',
    'insufficient_fund': 'Insufficient funds. Please check your card balance.',
    'stolen_or_lost_card': 'This card has been reported as stolen or lost.',
    'expired_card': 'Your card has expired. Please use a different card.',
    'processing_error': 'Payment processing error. Please try again.',
    'invalid_security_code': 'Invalid CVV/CVC code. Please check and try again.',
    'failed_processing': 'Payment processing failed. Please try again.',
    'limit_exceeded': 'Transaction limit exceeded. Please contact your bank.',
    'service_not_found': 'Payment service temporarily unavailable.',
    'rate_limit_exceeded': 'Too many requests. Please wait and try again.'
  };
  
  const code = error.code || error.type;
  const userMessage = errorMessages[code];
  
  if (userMessage) {
    return {
      code,
      message: userMessage,
      originalMessage: error.message
    };
  }
  
  return {
    code: code || 'unknown_error',
    message: error.message || 'An unexpected error occurred',
    originalMessage: error.message
  };
}

// Log successful initialization
if (process.env.NODE_ENV !== 'test') {
  testOmiseConnection().then(result => {
    if (result.connected) {
      console.log('Omise initialized successfully');
    } else {
      console.error('Omise initialization failed:', result.error);
    }
  }).catch(error => {
    console.error('Omise initialization error:', error.message);
  });
}

module.exports = {
  omise,
  OMISE_CONFIG,
  testOmiseConnection,
  validateToken,
  validateAmount,
  formatOmiseError
};
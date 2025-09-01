const Omise = require('omise');

const omise = Omise({
  secretKey: process.env.OMISE_SECRET_KEY,
  publicKey: process.env.OMISE_PUBLIC_KEY, 
});

const OMISE_CONFIG = {
  currency: 'THB', // Thai Baht
  supportedPaymentMethods: ['card', 'promptpay'],
  webhookEndpoint: '/api/payments/webhook',
};

module.exports = {
  omise,
  OMISE_CONFIG
};
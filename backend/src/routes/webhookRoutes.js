const express = require('express');
const WebhookController = require('../controllers/webhookController');

const router = express.Router();
const webhookController = new WebhookController();

console.log('Webhook Routes Module Loaded');

// Middleware to parse JSON for webhooks
router.use(express.json({ limit: '10mb' }));

// Health check endpoint
router.get('/health', webhookController.webhookHealthCheck);

// Database webhook endpoints
router.post('/user-created', webhookController.handleUserCreated);

// Legacy endpoints
router.post('/email-verification', webhookController.handleEmailVerification);

// Omise payment webhook
router.post('/omise-payment', webhookController.handleOmisePayment);

module.exports = router;

const express = require('express');
const WebhookController = require('../controllers/webhookController');

const router = express.Router();
const webhookController = new WebhookController();

console.log('Webhook Routes Module Loaded');

// Middleware to parse JSON for webhooks
router.use(express.json({ limit: '10mb' }));

// Health check endpoint
router.get('/health', webhookController.webhookHealthCheck);

// Database webhook endpoint
router.post('/user-created', webhookController.handleUserCreated);

// Auth webhook endpoint
router.post('/auth/user-created', webhookController.handleAuthEvent);

// Generic auth events webhook
router.post('/auth/events', webhookController.handleAuthEvent);

module.exports = router;

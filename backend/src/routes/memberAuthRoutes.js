const express = require('express');
const MemberAuthController = require('../controllers/memberAuthController');
const { authRateLimiter } = require('../middleware/rateLimiter');
const { 
    validateRegistration,
    validateLogin
} = require('../middleware/validation');

const router = express.Router();
const memberAuthController = new MemberAuthController();

// Member authentication routes
router.post('/register', authRateLimiter, validateRegistration, memberAuthController.register);
router.post('/login', authRateLimiter, validateLogin, memberAuthController.login);
router.post('/resend-verification', authRateLimiter, memberAuthController.resendVerification);
router.post('/callback', memberAuthController.handleAuthCallback);

module.exports = router;
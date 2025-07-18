const express = require('express');
const AuthController = require('../controllers/authController');
const { authRateLimiter } = require('../middleware/rateLimiter');
const { validateRegistration, validateLogin } = require('../middleware/validation');

const router = express.Router();
const authController = new AuthController();

router.post('/register', authRateLimiter, validateRegistration, authController.register);
router.post('/login', authRateLimiter, validateLogin, authController.login);
router.post('/resend-verification', authRateLimiter, authController.resendVerification);
router.post('/callback', authController.handleAuthCallback);

module.exports = router;
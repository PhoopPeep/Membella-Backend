const express = require('express');
const AuthController = require('../controllers/authController');
const { authRateLimiter } = require('../middleware/rateLimiter');
const { 
    validateRegistration,
    validateLogin,
    validateForgotPassword,
    validateResetPassword,
    validateResetToken
} = require('../middleware/validation');

const router = express.Router();
const authController = new AuthController();

router.post('/register', authRateLimiter, validateRegistration, authController.register);
router.post('/login', authRateLimiter, validateLogin, authController.login);
router.post('/resend-verification', authRateLimiter, authController.resendVerification);
router.post('/callback', authController.handleAuthCallback);
router.post('/forgot-password', authRateLimiter, validateForgotPassword, authController.forgotPassword);
router.post('/reset-password', authRateLimiter, validateResetPassword, authController.resetPassword);
router.post('/verify-reset-token', authRateLimiter, validateResetToken, authController.verifyResetToken);

module.exports = router;
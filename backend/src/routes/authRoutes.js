const express = require('express');
const multer = require('multer');
const AuthController = require('../controllers/authController');
const ProfileController = require('../controllers/profileController');
const { authRateLimiter, uploadRateLimiter } = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');
const { 
    validateRegistration,
    validateLogin,
    validateForgotPassword,
    validateResetPassword,
    validateResetToken
} = require('../middleware/validation');

const router = express.Router();
const authController = new AuthController();
const profileController = new ProfileController();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

router.post('/register', authRateLimiter, validateRegistration, authController.register);
router.post('/login', authRateLimiter, validateLogin, authController.login);
router.post('/resend-verification', authRateLimiter, authController.resendVerification);
router.post('/callback', authController.handleAuthCallback);
router.post('/forgot-password', authRateLimiter, validateForgotPassword, authController.forgotPassword);
router.post('/reset-password', authRateLimiter, validateResetPassword, authController.resetPassword);
router.post('/verify-reset-token', authRateLimiter, validateResetToken, authController.verifyResetToken);

// Profile routes (for compatibility with frontend)
router.get('/profile', authenticateToken, profileController.getProfile);
router.put('/profile', authenticateToken, profileController.updateProfile);
router.put('/change-password', authenticateToken, profileController.changePassword);
router.post('/upload-avatar', uploadRateLimiter, upload.single('logo'), authenticateToken, profileController.uploadAvatar);
router.delete('/avatar', authenticateToken, profileController.removeAvatar);

module.exports = router;
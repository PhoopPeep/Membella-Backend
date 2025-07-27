const express = require('express');
const multer = require('multer');
const ProfileController = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/auth');
const { apiRateLimiter, uploadRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const profileController = new ProfileController();

console.log('Profile Routes Module Loaded');

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

// Debug middleware
router.use((req, res, next) => {
  console.log('Profile Router Hit:', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl
  });
  next();
});

// All profile routes require authentication
router.use(authenticateToken);

router.get('/profile', apiRateLimiter, (req, res, next) => {
  console.log('GET /api/auth/profile route handler called');
  profileController.getProfile(req, res, next);
});

router.put('/profile', apiRateLimiter, (req, res, next) => {
  console.log('PUT /api/auth/profile route handler called');
  profileController.updateProfile(req, res, next);
});

router.put('/change-password', apiRateLimiter, (req, res, next) => {
  console.log('PUT /api/auth/change-password route handler called');
  profileController.changePassword(req, res, next);
});

router.post('/upload-avatar', uploadRateLimiter, upload.single('logo'), (req, res, next) => {
  console.log('POST /api/auth/upload-avatar route handler called');
  profileController.uploadAvatar(req, res, next);
});

router.delete('/avatar', apiRateLimiter, (req, res, next) => {
  console.log('DELETE /api/auth/avatar route handler called');
  profileController.removeAvatar(req, res, next);
});

console.log('Profile Routes Registered:', {
  'GET /profile': 'getProfile → /api/auth/profile',
  'PUT /profile': 'updateProfile → /api/auth/profile',
  'PUT /change-password': 'changePassword → /api/auth/change-password',
  'POST /upload-avatar': 'uploadAvatar → /api/auth/upload-avatar',
  'DELETE /avatar': 'removeAvatar → /api/auth/avatar'
});

module.exports = router;
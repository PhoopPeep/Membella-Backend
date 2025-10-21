const express = require('express');
const multer = require('multer');
const ProfileController = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/auth');
const { authenticateTokenOrSupabase } = require('../middleware/supabaseAuth');
const { apiRateLimiter, uploadRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const profileController = new ProfileController();

console.log('Profile Routes Module Loaded');

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

// Request logging middleware for debugging
router.use((req, res, next) => {
  console.log('Profile Router Hit:', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl
  });
  next();
});

// Authentication middleware
router.use(authenticateToken);

router.get('/profile', apiRateLimiter, authenticateTokenOrSupabase, (req, res, next) => {
  console.log('GET /api/profile/profile route handler called');
  profileController.getProfile(req, res, next);
});

router.put('/profile', apiRateLimiter, (req, res, next) => {
  console.log('PUT /api/profile/profile route handler called');
  profileController.updateProfile(req, res, next);
});

router.put('/change-password', apiRateLimiter, (req, res, next) => {
  console.log('PUT /api/profile/change-password route handler called');
  profileController.changePassword(req, res, next);
});

router.post('/upload-avatar', uploadRateLimiter, upload.single('logo'), (req, res, next) => {
  console.log('POST /api/profile/upload-avatar route handler called');
  profileController.uploadAvatar(req, res, next);
});

router.delete('/avatar', apiRateLimiter, (req, res, next) => {
  console.log('DELETE /api/profile/avatar route handler called');
  profileController.removeAvatar(req, res, next);
});

console.log('Profile Routes Registered:', {
  'GET /profile': 'getProfile → /api/profile/profile',
  'PUT /profile': 'updateProfile → /api/profile/profile',
  'PUT /change-password': 'changePassword → /api/profile/change-password',
  'POST /upload-avatar': 'uploadAvatar → /api/profile/upload-avatar',
  'DELETE /avatar': 'removeAvatar → /api/profile/avatar'
});

module.exports = router;
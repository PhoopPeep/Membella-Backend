const express = require('express');
const multer = require('multer');
const ProfileController = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/auth');
const { apiRateLimiter, uploadRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
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

// All profile routes require authentication
router.use(authenticateToken);

router.get('/', apiRateLimiter, profileController.getProfile);
router.put('/', apiRateLimiter, profileController.updateProfile);
router.put('/change-password', apiRateLimiter, profileController.changePassword);
router.post('/upload-avatar', uploadRateLimiter, upload.single('logo'), profileController.uploadAvatar);
router.delete('/avatar', apiRateLimiter, profileController.removeAvatar);

module.exports = router;
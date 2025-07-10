const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('../generated/prisma/client');
require('dotenv').config();

// Import error handling utilities
const {
  errorHandler,
  addRequestId,
  notFoundHandler,
  logger
} = require('./utils/errorHandler');

// Import middleware utilities
const {
  securityMiddleware,
  corsOptions,
  requestLogger,
  bodySizeLimit,
  requestTimeout,
  healthCheck,
  databaseHealthCheck,
  validateFileUpload,
  responseTimeHeader,
  authRateLimiter,
  apiRateLimiter,
  uploadRateLimiter
} = require('./utils/middleware');

// Import validation utilities
const { sanitizeRequestBody } = require('./utils/validation');

// Import all auth functions
const { 
  registerUser, 
  loginUser, 
  authenticateToken,
  resendVerification,
  handleAuthCallback,
  handleAuthUrlCallback
} = require('./auth');

// Features routes
const { 
  getFeatures, 
  getFeatureById, 
  createFeature, 
  updateFeature, 
  deleteFeature 
} = require('./features');

// Plans routes
const {
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan
} = require('./plans');

// Dashboard routes
const {
  getDashboardStats,
  getRevenueData,
  getMembers,
  getMembersByPlan
} = require('./dashboard');

// Profile routes
const {
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
  removeAvatar
} = require('./profile');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Configure multer for file uploads
const multer = require('multer');
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

// Apply security middleware
app.use(securityMiddleware);

// Apply CORS
app.use(cors(corsOptions));

// Request ID middleware
app.use(addRequestId);

// Response time header
app.use(responseTimeHeader);

// Request timeout (30 seconds)
app.use(requestTimeout(30000));

// Body size limit
app.use(bodySizeLimit);

// Request logging
app.use(requestLogger);

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Sanitize request body
app.use(sanitizeRequestBody);

// Health check routes
app.get('/api/health', healthCheck);
app.get('/api/health/db', databaseHealthCheck);

// Auth routes (with rate limiting)
app.post('/api/auth/register', authRateLimiter, registerUser);
app.post('/api/auth/login', authRateLimiter, loginUser);
app.post('/api/auth/resend-verification', authRateLimiter, resendVerification);
app.post('/api/auth/callback', handleAuthCallback);
app.get('/api/auth/callback', handleAuthUrlCallback);

// Protected profile routes (with rate limiting)
app.get('/api/auth/profile', apiRateLimiter, authenticateToken, getProfile);
app.put('/api/auth/profile', apiRateLimiter, authenticateToken, updateProfile);
app.put('/api/auth/change-password', apiRateLimiter, authenticateToken, changePassword);
app.post('/api/auth/upload-avatar', uploadRateLimiter, authenticateToken, upload.single('logo'), validateFileUpload, uploadAvatar);
app.delete('/api/auth/avatar', apiRateLimiter, authenticateToken, removeAvatar);

// Features routes (with rate limiting)
app.get('/api/features', apiRateLimiter, authenticateToken, getFeatures);
app.get('/api/features/:id', apiRateLimiter, authenticateToken, getFeatureById);
app.post('/api/features', apiRateLimiter, authenticateToken, createFeature);
app.put('/api/features/:id', apiRateLimiter, authenticateToken, updateFeature);
app.delete('/api/features/:id', apiRateLimiter, authenticateToken, deleteFeature);

// Plans routes (with rate limiting)
app.get('/api/plans', apiRateLimiter, authenticateToken, getPlans);
app.get('/api/plans/:id', apiRateLimiter, authenticateToken, getPlanById);
app.post('/api/plans', apiRateLimiter, authenticateToken, createPlan);
app.put('/api/plans/:id', apiRateLimiter, authenticateToken, updatePlan);
app.delete('/api/plans/:id', apiRateLimiter, authenticateToken, deletePlan);

// Dashboard routes (with rate limiting)
app.get('/api/dashboard/stats', apiRateLimiter, authenticateToken, getDashboardStats);
app.get('/api/dashboard/revenue', apiRateLimiter, authenticateToken, getRevenueData);
app.get('/api/dashboard/members', apiRateLimiter, authenticateToken, getMembers);
app.get('/api/dashboard/members-by-plan', apiRateLimiter, authenticateToken, getMembersByPlan);

// 404 handler
app.use(notFoundHandler);

// Global error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/api/health`);
  logger.info(`Database health check: http://localhost:${PORT}/api/health/db`);
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    await prisma.$disconnect();
    logger.info('Database connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
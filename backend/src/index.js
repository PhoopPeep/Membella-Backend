const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('../generated/prisma/client');
require('dotenv').config();

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

// Add multer import for file uploads
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Add request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.query && Object.keys(req.query).length > 0) {
    console.log('Query params:', req.query);
  }
  next();
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Auth routes (no authentication required)
app.post('/api/auth/register', registerUser);
app.post('/api/auth/login', loginUser);
app.post('/api/auth/resend-verification', resendVerification);
app.post('/api/auth/callback', handleAuthCallback);
app.get('/api/auth/callback', handleAuthUrlCallback);  // Handle URL-based auth callback

// Protected profile routes (authentication required)
app.get('/api/auth/profile', authenticateToken, getProfile);
app.put('/api/auth/profile', authenticateToken, updateProfile);
app.put('/api/auth/change-password', authenticateToken, changePassword);
app.post('/api/auth/upload-avatar', authenticateToken, upload.single('logo'), uploadAvatar);
app.delete('/api/auth/avatar', authenticateToken, removeAvatar);

// Features routes (authentication required)
app.get('/api/features', authenticateToken, getFeatures);
app.get('/api/features/:id', authenticateToken, getFeatureById);
app.post('/api/features', authenticateToken, createFeature);
app.put('/api/features/:id', authenticateToken, updateFeature);
app.delete('/api/features/:id', authenticateToken, deleteFeature);

// Plans routes (authentication required)
app.get('/api/plans', authenticateToken, getPlans);
app.get('/api/plans/:id', authenticateToken, getPlanById);
app.post('/api/plans', authenticateToken, createPlan);
app.put('/api/plans/:id', authenticateToken, updatePlan);
app.delete('/api/plans/:id', authenticateToken, deletePlan);

// Dashboard routes (authentication required)
app.get('/api/dashboard/stats', authenticateToken, getDashboardStats);
app.get('/api/dashboard/revenue', authenticateToken, getRevenueData);
app.get('/api/dashboard/members', authenticateToken, getMembers);
app.get('/api/dashboard/members-by-plan', authenticateToken, getMembersByPlan);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});
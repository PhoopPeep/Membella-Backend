const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('../generated/prisma/client');
require('dotenv').config();
const { registerUser, loginUser, authenticateToken } = require('./auth');
const { 
  getFeatures, 
  getFeatureById, 
  createFeature, 
  updateFeature, 
  deleteFeature 
} = require('./features');
const {
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan
} = require('./plans');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Add request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Auth routes
app.post('/api/auth/register', registerUser);
app.post('/api/auth/login', loginUser);

// Protected auth routes
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.owner.findUnique({
      where: { owner_id: req.user.userId },
      select: {
        owner_id: true,
        org_name: true,
        email: true,
        description: true,
        contact_info: true,
        logo: true,
        create_at: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// Features routes
app.get('/api/features', authenticateToken, getFeatures);
app.get('/api/features/:id', authenticateToken, getFeatureById);
app.post('/api/features', authenticateToken, createFeature);
app.put('/api/features/:id', authenticateToken, updateFeature);
app.delete('/api/features/:id', authenticateToken, deleteFeature);

// Plans routes
app.get('/api/plans', authenticateToken, getPlans);
app.get('/api/plans/:id', authenticateToken, getPlanById);
app.post('/api/plans', authenticateToken, createPlan);
app.put('/api/plans/:id', authenticateToken, updatePlan);
app.delete('/api/plans/:id', authenticateToken, deletePlan);

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

//shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});
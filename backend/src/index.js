const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('../generated/prisma/client');
require('dotenv').config();
const { registerUser, loginUser } = require('./auth');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5432;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running!' });
});

app.post('/api/auth/register', registerUser);
app.post('/api/auth/login', loginUser);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
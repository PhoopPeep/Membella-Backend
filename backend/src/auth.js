const { PrismaClient } = require('../generated/prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// JWT secret - make sure to add this to your .env file
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Register a new Owner
async function registerUser(req, res) {
  const { org_name, email, password, description, contact_info, logo } = req.body;
  
  if (!org_name || !email || !password) {
    return res.status(400).json({ message: 'org_name, email, and password are required.' });
  }
  
  try {
    const existingUser = await prisma.owner.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered.' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = await prisma.owner.create({
      data: {
        org_name,
        email,
        password: hashedPassword,
        description,
        contact_info,
        logo,
      },
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
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.owner_id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    return res.status(201).json({ 
      message: 'Registration successful.',
      token,
      user: newUser
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Registration failed.', error: error.message });
  }
}

// Login an Owner
async function loginUser(req, res) {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  
  try {
    const user = await prisma.owner.findUnique({ 
      where: { email },
      select: {
        owner_id: true,
        org_name: true,
        email: true,
        password: true,
        description: true,
        contact_info: true,
        logo: true,
        create_at: true
      }
    });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.owner_id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    return res.json({ 
      message: 'Login successful.',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed.', error: error.message });
  }
}

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ message: 'Access token required.' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
}

module.exports = { registerUser, loginUser, authenticateToken };
const { PrismaClient } = require('../generated/prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

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
    await prisma.owner.create({
      data: {
        org_name,
        email,
        password: hashedPassword,
        description,
        contact_info,
        logo,
      },
    });
    return res.status(201).json({ message: 'Registration successful.' });
  } catch (error) {
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
    const user = await prisma.owner.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    return res.json({ message: 'Login successful.' });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed.', error: error.message });
  }
}

module.exports = { registerUser, loginUser };

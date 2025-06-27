const { PrismaClient } = require('../generated/prisma/client');
const { supabase } = require('./supabaseClient');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Register a new Owner with Supabase Auth
async function registerUser(req, res) {
  const { org_name, email, password, description, contact_info, logo } = req.body;
  
  if (!org_name || !email || !password) {
    return res.status(400).json({ message: 'org_name, email, and password are required.' });
  }

  // Enhanced email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }

  // Password validation
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }
  
  try {
    console.log('🚀 Starting registration for:', email);

    // Check if user already exists in our database
    const existingUser = await prisma.owner.findUnique({ where: { email } });
    if (existingUser) {
      console.log('❌ User already exists in database:', email);
      return res.status(409).json({ message: 'Email already registered.' });
    }

    console.log('✅ User not found in database, proceeding with Supabase registration');

    // Create user in Supabase Auth with explicit email confirmation
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Require email confirmation
      user_metadata: {
        org_name,
        description,
        contact_info,
        logo
      }
    });

    if (authError) {
      console.error('❌ Supabase auth error:', authError);
      if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
        return res.status(409).json({ message: 'Email already registered.' });
      }
      return res.status(400).json({ message: authError.message });
    }

    console.log('✅ Supabase user created:', authData.user.id);

    // Create user in our database with Supabase user ID
    const newUser = await prisma.owner.create({
      data: {
        owner_id: authData.user.id, // Use Supabase user ID
        org_name,
        email,
        password: '', // Empty since Supabase handles auth
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

    console.log('✅ User created in database:', newUser.owner_id);

    // Generate confirmation link and send email
    try {
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'signup',
        email,
        options: {
          redirectTo: `${process.env.FRONTEND_URL}/auth/callback`
        }
      });

      if (linkError) {
        console.error('❌ Error generating confirmation link:', linkError);
      } else {
        console.log('✅ Confirmation email sent to:', email);
        console.log('🔗 Confirmation link generated:', linkData.properties?.action_link || 'Link generated');
      }
    } catch (emailError) {
      console.error('❌ Error with email sending:', emailError);
    }
    
    return res.status(201).json({ 
      message: 'Registration successful! Please check your email (including spam folder) to verify your account before signing in.',
      user: newUser,
      requiresVerification: true,
      debug: {
        supabaseUserId: authData.user.id,
        emailSent: true,
        checkSpamFolder: true
      }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    return res.status(500).json({ 
      message: 'Registration failed.', 
      error: error.message,
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Login with enhanced error handling
async function loginUser(req, res) {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  
  try {
    console.log('🔐 Login attempt for:', email);

    // Sign in with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error('❌ Supabase login error:', authError);
      
      if (authError.message === 'Email not confirmed') {
        console.log('📧 Email not confirmed for:', email);
        return res.status(401).json({ 
          message: 'Please verify your email address before signing in. Check your inbox and spam folder.',
          requiresVerification: true,
          email: email
        });
      }
      
      if (authError.message.includes('Invalid login credentials')) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }
      
      return res.status(401).json({ message: authError.message });
    }

    if (!authData.user) {
      return res.status(401).json({ message: 'Authentication failed.' });
    }

    console.log('✅ Supabase login successful:', authData.user.id);

    // Check email confirmation status
    if (!authData.user.email_confirmed_at) {
      console.log('📧 Email not confirmed for user:', authData.user.id);
      return res.status(401).json({ 
        message: 'Please verify your email address before signing in. Check your inbox and spam folder.',
        requiresVerification: true,
        email: email
      });
    }

    // Get user from our database
    const user = await prisma.owner.findUnique({ 
      where: { owner_id: authData.user.id },
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
      console.error('❌ User not found in database:', authData.user.id);
      return res.status(401).json({ message: 'User not found in system.' });
    }

    console.log('✅ User found in database:', user.owner_id);
    
    // Generate our JWT token for API access
    const token = jwt.sign(
      { userId: user.owner_id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    return res.json({ 
      message: 'Login successful.',
      token,
      user,
      supabaseSession: authData.session
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    return res.status(500).json({ 
      message: 'Login failed.', 
      error: error.message 
    });
  }
}

// Enhanced resend verification
async function resendVerification(req, res) {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  console.log('📧 Resending verification for:', email);

  try {
    // First check if user exists in Supabase
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return res.status(500).json({ message: 'Failed to verify user existence.' });
    }

    const supabaseUser = users.users.find(user => user.email === email);
    
    if (!supabaseUser) {
      return res.status(404).json({ message: 'No account found with this email address.' });
    }

    if (supabaseUser.email_confirmed_at) {
      return res.status(400).json({ message: 'Email is already verified. You can sign in now.' });
    }

    // Generate new confirmation link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      options: {
        redirectTo: `${process.env.FRONTEND_URL}/auth/callback`
      }
    });

    if (linkError) {
      console.error('❌ Error generating verification link:', linkError);
      return res.status(400).json({ message: 'Failed to send verification email. Please try again.' });
    }

    console.log('✅ Verification email resent to:', email);

    return res.json({ 
      message: 'Verification email sent successfully. Please check your inbox and spam folder.',
      debug: {
        linkGenerated: true,
        checkSpamFolder: true
      }
    });
  } catch (error) {
    console.error('❌ Resend verification error:', error);
    return res.status(500).json({ message: 'Failed to resend verification email.' });
  }
}

// Rest of the functions remain the same...
async function handleAuthCallback(req, res) {
  const { access_token, refresh_token } = req.body;

  try {
    console.log('🔄 Processing auth callback');

    const { data: { user }, error } = await supabase.auth.getUser(access_token);

    if (error || !user) {
      console.error('❌ Invalid token in callback:', error);
      return res.status(400).json({ message: 'Invalid token.' });
    }

    console.log('✅ User verified from token:', user.id);

    const dbUser = await prisma.owner.findUnique({
      where: { owner_id: user.id },
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

    if (!dbUser) {
      console.error('❌ User not found in database during callback:', user.id);
      return res.status(404).json({ message: 'User not found in system.' });
    }

    const token = jwt.sign(
      { userId: dbUser.owner_id, email: dbUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ Auth callback successful for:', dbUser.email);

    return res.json({
      message: 'Authentication successful.',
      token,
      user: dbUser
    });
  } catch (error) {
    console.error('❌ Auth callback error:', error);
    return res.status(500).json({ message: 'Authentication failed.' });
  }
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
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

module.exports = { 
  registerUser, 
  loginUser, 
  resendVerification,
  handleAuthCallback,
  authenticateToken 
};
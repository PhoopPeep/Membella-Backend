const { PrismaClient } = require('../generated/prisma/client');
const { supabase } = require('./supabaseClient');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || '65YHSNjVcJ9q4V2GGGlxvQ1hmGt2x344Po8CYi+U9aD5mdiMJlGMXLHF7YyC5Q5ZTCKWOeWfMYXkqDBG4SxSFw==';

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

    // **FIXED: Use the correct Supabase auth signup method**
    // Instead of admin.createUser, use regular signup which sends confirmation email automatically
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.FRONTEND_URL}/auth/callback`,
        data: {
          org_name,
          description,
          contact_info,
          logo
        }
      }
    });

    if (authError) {
      console.error('❌ Supabase auth error:', authError);
      
      if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
        return res.status(409).json({ message: 'Email already registered.' });
      }
      if (authError.message.includes('rate limit')) {
        return res.status(429).json({ 
          message: 'Too many registration attempts. Please wait before trying again.',
          rateLimited: true
        });
      }
      return res.status(400).json({ message: authError.message });
    }

    console.log('✅ Supabase user created:', authData.user?.id);
    console.log('📧 User email confirmed status:', authData.user?.email_confirmed_at);

    // **IMPORTANT**: Only create user in database AFTER email confirmation
    // For now, we'll store minimal info and complete it after confirmation
    if (authData.user) {
      try {
        const newUser = await prisma.owner.create({
          data: {
            owner_id: authData.user.id,
            org_name,
            email: email.toLowerCase(),
            password: '', // Empty since Supabase handles auth
            description: description || null,
            contact_info: contact_info || null,
            logo: logo || null,
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
        
        return res.status(201).json({ 
          message: 'Registration successful! Please check your email (including spam folder) to verify your account before signing in.',
          user: newUser,
          requiresVerification: true,
          debug: {
            supabaseUserId: authData.user.id,
            emailSent: true,
            checkSpamFolder: true,
            fromEmail: 'noreply@mail.supabase.io',
            redirectUrl: `${process.env.FRONTEND_URL}/auth/callback`
          }
        });
      } catch (dbError) {
        console.error('❌ Database error after successful Supabase signup:', dbError);
        
        // Clean up Supabase user if database creation fails
        try {
          await supabase.auth.admin.deleteUser(authData.user.id);
          console.log('🧹 Cleaned up Supabase user after database error');
        } catch (cleanupError) {
          console.error('❌ Failed to cleanup Supabase user:', cleanupError);
        }
        
        return res.status(500).json({ 
          message: 'Registration failed due to database error. Please try again.',
          error: dbError.message
        });
      }
    } else {
      return res.status(400).json({ message: 'Failed to create user account.' });
    }
  } catch (error) {
    console.error('❌ Registration error:', error);
    return res.status(500).json({ 
      message: 'Registration failed.', 
      error: error.message
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
      email: email.toLowerCase(),
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
    // **FIXED: Use the correct resend method**
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email: email.toLowerCase(),
      options: {
        emailRedirectTo: `${process.env.FRONTEND_URL}/auth/callback`
      }
    });

    if (error) {
      console.error('❌ Error resending verification:', error);
      
      if (error.message.includes('rate limit')) {
        return res.status(429).json({ 
          message: 'Too many requests. Please wait before requesting another verification email.',
          rateLimited: true
        });
      }
      
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'No account found with this email address.' });
      }
      
      return res.status(400).json({ message: error.message });
    }

    console.log('✅ Verification email resent to:', email);

    return res.json({ 
      message: 'Verification email sent successfully. Please check your inbox and spam folder.',
      debug: {
        emailSent: true,
        checkSpamFolder: true
      }
    });
  } catch (error) {
    console.error('❌ Resend verification error:', error);
    return res.status(500).json({ message: 'Failed to resend verification email.' });
  }
}

// **FIXED: Improved auth callback handling**
async function handleAuthCallback(req, res) {
  try {
    console.log('🔄 Processing auth callback');
    
    // Get the current session from Supabase
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('❌ Session error in callback:', sessionError);
      return res.status(400).json({ message: 'Session error: ' + sessionError.message });
    }

    if (!session || !session.user) {
      console.error('❌ No valid session found in callback');
      return res.status(400).json({ message: 'No valid session found.' });
    }

    console.log('✅ User verified from session:', session.user.id);

    // Check if user is confirmed
    if (!session.user.email_confirmed_at) {
      console.error('❌ User email not confirmed:', session.user.id);
      return res.status(400).json({ message: 'Email not confirmed.' });
    }

    // Get user from database
    const dbUser = await prisma.owner.findUnique({
      where: { owner_id: session.user.id },
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
      console.error('❌ User not found in database during callback:', session.user.id);
      return res.status(404).json({ message: 'User not found in system.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: dbUser.owner_id, email: dbUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ Auth callback successful for:', dbUser.email);

    return res.json({
      message: 'Authentication successful.',
      token,
      user: dbUser,
      session: session
    });
  } catch (error) {
    console.error('❌ Auth callback error:', error);
    return res.status(500).json({ message: 'Authentication failed: ' + error.message });
  }
}

// **NEW: Handle URL-based auth callback (for email link verification)**
async function handleAuthUrlCallback(req, res) {
  try {
    const { access_token, refresh_token, type } = req.query;
    
    if (!access_token || !refresh_token) {
      return res.status(400).json({ message: 'Missing auth tokens in URL.' });
    }

    console.log('🔄 Processing URL auth callback, type:', type);

    // Set the session with the tokens
    const { data: { session }, error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token
    });

    if (sessionError || !session) {
      console.error('❌ Failed to set session:', sessionError);
      return res.status(400).json({ message: 'Invalid auth tokens.' });
    }

    // Now handle like a regular callback
    return handleAuthCallback(req, res);
  } catch (error) {
    console.error('❌ URL auth callback error:', error);
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
  handleAuthUrlCallback,  // Export the new URL callback handler
  authenticateToken 
};
// Import required dependencies
const { PrismaClient } = require('../generated/prisma/client');
const { supabase } = require('./supabaseClient');
const jwt = require('jsonwebtoken');

// Import error handling utilities
const {
  asyncHandler,
  AppError,
  ValidationError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
  logger
} = require('./utils/errorHandler');

// Import validation utilities
const { authValidations } = require('./utils/validation');

// Initialize Prisma client for database operations
const prisma = new PrismaClient();

// JWT secret key - uses environment variable or fallback default
const JWT_SECRET = process.env.JWT_SECRET || '65YHSNjVcJ9q4V2GGGlxvQ1hmGt2x344Po8CYi+U9aD5mdiMJlGMXLHF7YyC5Q5ZTCKWOeWfMYXkqDBG4SxSFw==';

// Register a new Owner with Supabase Auth
// Creates both Supabase auth user and local database record
const registerUser = asyncHandler(async (req, res) => {
  const { org_name, email, password, description, contact_info, logo } = req.body;
  
  logger.info('Starting registration for:', email);

  // Check if user already exists in our local database
  const existingUser = await prisma.owner.findUnique({ where: { email } });
  if (existingUser) {
    logger.warn('User already exists in database:', email);
    throw new ConflictError('Email already registered');
  }

  logger.info('User not found in database, proceeding with Supabase registration');

  // Create user in Supabase Auth with email confirmation
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

  // Handle Supabase authentication errors
  if (authError) {
    logger.error('Supabase auth error:', authError);
    
    if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
      throw new ConflictError('Email already registered');
    }
    if (authError.message.includes('rate limit')) {
      throw new AppError('Too many registration attempts. Please wait before trying again.', 429);
    }
    throw new ValidationError(authError.message);
  }

  logger.info('Supabase user created:', authData.user?.id);

  // Create user record in local database after successful Supabase registration
  if (authData.user) {
    try {
      const newUser = await prisma.owner.create({
        data: {
          owner_id: authData.user.id,
          org_name,
          email: email.toLowerCase(),
          password: '',
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

      logger.info('User created in database:', newUser.owner_id);
      
      res.status(201).json({ 
        success: true,
        message: 'Registration successful! Please check your email (including spam folder) to verify your account before signing in.',
        user: newUser,
        requiresVerification: true
      });
    } catch (dbError) {
      logger.error('Database error after successful Supabase signup:', dbError);
      
      // Cleanup: Delete Supabase user if database creation fails
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
        logger.info('Cleaned up Supabase user after database error');
      } catch (cleanupError) {
        logger.error('Failed to cleanup Supabase user:', cleanupError);
      }
      
      throw new AppError('Registration failed due to database error. Please try again.', 500);
    }
  } else {
    throw new AppError('Failed to create user account.', 400);
  }
});


// Login user with enhanced error handling
// Authenticates with Supabase and returns JWT token for API access
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  logger.info('Login attempt for:', email);

  // Authenticate with Supabase
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password
  });

  // Handle authentication errors
  if (authError) {
    logger.error('Supabase login error:', authError);
    
    // Handle email not confirmed error
    if (authError.message === 'Email not confirmed') {
      logger.warn('Email not confirmed for:', email);
      throw new AuthenticationError('Please verify your email address before signing in. Check your inbox and spam folder.');
    }
    
    // Handle invalid credentials
    if (authError.message.includes('Invalid login credentials')) {
      throw new AuthenticationError('Invalid email or password.');
    }
    
    throw new AuthenticationError(authError.message);
  }

  // Validate authentication data
  if (!authData.user) {
    throw new AuthenticationError('Authentication failed.');
  }

  logger.info('Supabase login successful:', authData.user.id);

  // Double-check email confirmation status
  if (!authData.user.email_confirmed_at) {
    logger.warn('Email not confirmed for user:', authData.user.id);
    throw new AuthenticationError('Please verify your email address before signing in. Check your inbox and spam folder.');
  }

  // Retrieve user data from local database
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
  
  // Verify user exists in local database
  if (!user) {
    logger.error('User not found in database:', authData.user.id);
    throw new AuthenticationError('User not found in system.');
  }

  logger.info('User found in database:', user.owner_id);
  
  // Generate JWT token for API access (expires in 7 days)
  const token = jwt.sign(
    { userId: user.owner_id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  // Return successful login response
  res.json({ 
    success: true,
    message: 'Login successful.',
    token,
    user,
    supabaseSession: authData.session
  });
});


// Resend email verification to user
const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  logger.info('Resending verification for:', email);

  // Use Supabase resend method for signup verification
  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email: email.toLowerCase(),
    options: {
      emailRedirectTo: `${process.env.FRONTEND_URL}/auth/callback`
    }
  });

  // Handle resend errors
  if (error) {
    logger.error('Error resending verification:', error);
    
    // Handle rate limiting
    if (error.message.includes('rate limit')) {
      throw new AppError('Too many requests. Please wait before requesting another verification email.', 429);
    }
    
    // Handle user not found
    if (error.message.includes('not found')) {
      throw new NotFoundError('No account found with this email address.');
    }
    
    throw new ValidationError(error.message);
  }

  logger.info('Verification email resent to:', email);

  res.json({ 
    success: true,
    message: 'Verification email sent successfully. Please check your inbox and spam folder.'
  });
});


//Handle authentication callback from email verification
//Processes the callback after user clicks verification link
async function handleAuthCallback(req, res) {
  try {
    console.log('Processing auth callback');
    
    // Get the current session from Supabase
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    // Handle session errors
    if (sessionError) {
      console.error('Session error in callback:', sessionError);
      return res.status(400).json({ message: 'Session error: ' + sessionError.message });
    }

    // Validate session exists
    if (!session || !session.user) {
      console.error('No valid session found in callback');
      return res.status(400).json({ message: 'No valid session found.' });
    }

    console.log('User verified from session:', session.user.id);

    // Verify email is confirmed
    if (!session.user.email_confirmed_at) {
      console.error('User email not confirmed:', session.user.id);
      return res.status(400).json({ message: 'Email not confirmed.' });
    }

    // Retrieve user from local database
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

    // Verify user exists in database
    if (!dbUser) {
      console.error('User not found in database during callback:', session.user.id);
      return res.status(404).json({ message: 'User not found in system.' });
    }

    // Generate JWT token for authenticated user
    const token = jwt.sign(
      { userId: dbUser.owner_id, email: dbUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('Auth callback successful for:', dbUser.email);

    return res.json({
      message: 'Authentication successful.',
      token,
      user: dbUser,
      session: session
    });
  } catch (error) {
    console.error('Auth callback error:', error);
    return res.status(500).json({ message: 'Authentication failed: ' + error.message });
  }
}


//Handle URL-based auth callback (for email link verification)
//Processes authentication tokens from URL parameters
async function handleAuthUrlCallback(req, res) {
  try {
    // Extract authentication tokens from URL query parameters
    const { access_token, refresh_token, type } = req.query;
    
    // Validate required tokens are present
    if (!access_token || !refresh_token) {
      return res.status(400).json({ message: 'Missing auth tokens in URL.' });
    }

    console.log('Processing URL auth callback, type:', type);

    // Set the session using the provided tokens
    const { data: { session }, error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token
    });

    // Handle session creation errors
    if (sessionError || !session) {
      console.error('Failed to set session:', sessionError);
      return res.status(400).json({ message: 'Invalid auth tokens.' });
    }

    // Delegate to regular callback handler
    return handleAuthCallback(req, res);
  } catch (error) {
    console.error('URL auth callback error:', error);
    return res.status(500).json({ message: 'Authentication failed.' });
  }
}


//Middleware to authenticate JWT token on protected routes
//Verifies the JWT token and adds user info to request object
function authenticateToken(req, res, next) {
  // Extract token from Authorization header (Bearer token format)
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  // Check if token is provided
  if (!token) {
    return res.status(401).json({ message: 'Access token required.' });
  }
  
  // Verify and decode the JWT token
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }
    // Add decoded user info to request object for use in protected routes
    req.user = user;
    next(); // Continue to next middleware/route handler
  });
}

// Export all authentication functions for use in other modules
module.exports = { 
  registerUser, 
  loginUser, 
  resendVerification,
  handleAuthCallback,
  handleAuthUrlCallback,  // Export the new URL callback handler
  authenticateToken 
};
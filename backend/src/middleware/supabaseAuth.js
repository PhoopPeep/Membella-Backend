const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');
const { AuthenticationError } = require('../utils/errorHandler');

const JWT_SECRET = process.env.JWT_SECRET

async function authenticateTokenOrSupabase(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access token required.' });
  }
  
  try {
    // First try JWT token (normal authentication)
    try {
      const user = jwt.verify(token, JWT_SECRET);
      req.user = user;
      console.log('JWT authentication successful for user:', user.userId);
      return next();
    } catch (jwtError) {
      console.log('JWT verification failed, trying Supabase token...', jwtError.message);
      
      // If JWT fails, try Supabase token
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        console.log('Supabase token verification failed:', error?.message);
        return res.status(403).json({ message: 'Invalid or expired token.' });
      }
      
      // Set user data for Supabase token
      req.user = {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at
      };
      
      console.log('Supabase authentication successful for user:', user.id);
      return next();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = { authenticateTokenOrSupabase };

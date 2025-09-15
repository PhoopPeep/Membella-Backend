const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || '65YHSNjVcJ9q4V2GGGlxvQ1hmGt2x344Po8CYi+U9aD5mdiMJlGMXLHF7YyC5Q5ZTCKWOeWfMYXkqDBG4SxSFw==';

// Middleware for Owner
const requireOwner = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  console.log('requireOwner middleware:', {
    hasAuthHeader: !!authHeader,
    hasToken: !!token,
    url: req.url,
    method: req.method
  });
  
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ message: 'Access token required.' });
  }
  
  try {
    const user = jwt.verify(token, JWT_SECRET);
    console.log('Token verified:', { userId: user.userId, role: user.role, email: user.email });
    
    // Check that user is owner
    if (user.role !== 'owner') {
      console.log('User is not owner:', user.role);
      return res.status(403).json({ message: 'Owner access required.' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.log('Token verification failed:', error.message);
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

// Middleware for Member
const requireMember = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access token required.' });
  }
  
  try {
    const user = jwt.verify(token, JWT_SECRET);
    
    // Check that user is member
    if (user.role !== 'member') {
      return res.status(403).json({ message: 'Member access required.' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

module.exports = { requireOwner, requireMember };
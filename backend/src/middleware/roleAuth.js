const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || '65YHSNjVcJ9q4V2GGGlxvQ1hmGt2x344Po8CYi+U9aD5mdiMJlGMXLHF7YyC5Q5ZTCKWOeWfMYXkqDBG4SxSFw==';

// Middleware for Owner
const requireOwner = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access token required.' });
  }
  
  try {
    const user = jwt.verify(token, JWT_SECRET);
    
    // Check that user is owner
    if (user.role !== 'owner') {
      return res.status(403).json({ message: 'Owner access required.' });
    }
    
    req.user = user;
    next();
  } catch (error) {
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
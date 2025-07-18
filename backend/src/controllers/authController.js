const AuthService = require('../services/authService');
const { asyncHandler } = require('../utils/errorHandler');

class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  register = asyncHandler(async (req, res) => {
    const { org_name, email, password, description, contact_info, logo } = req.body;
    
    const result = await this.authService.register({
      org_name,
      email,
      password,
      description,
      contact_info,
      logo
    });

    res.status(201).json(result);
  });

  login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    const result = await this.authService.login(email, password);
    
    res.json(result);
  });

  resendVerification = asyncHandler(async (req, res) => {
    const { email } = req.body;
    
    const result = await this.authService.resendVerification(email);
    
    res.json(result);
  });
}

module.exports = AuthController;
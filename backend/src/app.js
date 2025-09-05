const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { connectDatabase } = require('./config/database');

const {
  errorHandler,
  addRequestId,
  notFoundHandler,
  logger
} = require('./utils/errorHandler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const featureRoutes = require('./routes/featureRoutes');
const planRoutes = require('./routes/planRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const profileRoutes = require('./routes/profileRoutes');
const ownerRouts = require('./routes/ownerRoutes');
const memberRoutes = require('./routes/memberRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');

class App {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS configuration
    const corsOptions = {
      origin: function (origin, callback) {
        const allowedOrigins = [
          process.env.OWNER_FRONTEND_URL,
          process.env.MEMBER_FRONTEND_URL
        ];
        
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          logger.warn({
            message: 'CORS blocked request',
            origin,
            url: req?.url
          });
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      optionsSuccessStatus: 200
    };

    this.app.use(cors(corsOptions));
    this.app.use(addRequestId);
    
    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          userId: req.user?.userId,
          requestId: req.id
        };

        if (res.statusCode >= 400) {
          logger.warn(logData);
        } else {
          logger.info(logData);
        }
      });

      next();
    });

    // Request timeout (30 seconds)
    this.app.use((req, res, next) => {
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          logger.error({
            message: 'Request timeout',
            url: req.url,
            method: req.method,
            requestId: req.id
          });
          res.status(408).json({
            success: false,
            message: 'Request timeout',
            statusCode: 408
          });
        }
      }, 30000);

      res.on('finish', () => {
        clearTimeout(timeout);
      });

      res.on('close', () => {
        clearTimeout(timeout);
      });

      next();
    });

    // Body size limit
    this.app.use((req, res, next) => {
      const contentLength = parseInt(req.headers['content-length'] || '0');
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (contentLength > maxSize) {
        return res.status(413).json({
          success: false,
          message: 'Request entity too large',
          statusCode: 413
        });
      }
      
      next();
    });
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));

    // Sanitize request body
    this.app.use((req, res, next) => {
      if (req.body) {
        Object.keys(req.body).forEach(key => {
          if (typeof req.body[key] === 'string') {
            req.body[key] = req.body[key].trim().replace(/\s+/g, ' ');
          }
        });
      }
      next();
    });
  }

  setupRoutes() {
    // Health check routes
    this.app.get('/api/health', (req, res) => {
      const healthData = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
      };
  
      res.status(200).json(healthData);
    });
  
    // Database health check
    this.app.get('/api/health/db', async (req, res) => {
      try {
        const { getPrismaClient } = require('./config/database');
        const prisma = getPrismaClient();
        
        await prisma.$queryRaw`SELECT 1`;
        
        res.status(200).json({
          status: 'OK',
          database: 'connected',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({
          message: 'Database health check failed',
          error: error.message
        });
        
        res.status(503).json({
          status: 'ERROR',
          database: 'disconnected',
          message: 'Database connection failed',
          timestamp: new Date().toISOString()
        });
      }
    });
  
    this.app.use('/api', (req, res, next) => {
      console.log('API Request:', {
        method: req.method,
        url: req.url,
        originalUrl: req.originalUrl,
        headers: {
          authorization: req.headers.authorization ? 'Present' : 'Missing',
          'content-type': req.headers['content-type']
        }
      });
      next();
    });
  
    // Import member auth routes
    const memberAuthRoutes = require('./routes/memberAuthRoutes');
    const webhookRoutes = require('./routes/webhookRoutes');
  
    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/member/auth', memberAuthRoutes);
    this.app.use('/api/features', featureRoutes);
    this.app.use('/api/plans', planRoutes);
    this.app.use('/api/dashboard', dashboardRoutes);
    this.app.use('/api/auth', profileRoutes);
    this.app.use('/api/owner', ownerRouts);
    this.app.use('/api/member', memberRoutes);
    
    // Webhook routes
    this.app.use('/api/webhooks', webhookRoutes);
    
    // Payment and Subscription routes
    this.app.use('/api/payments', paymentRoutes);
    this.app.use('/api/subscriptions', subscriptionRoutes);
  
    if (process.env.NODE_ENV === 'development') {
      this.app.get('/api/debug/routes', (req, res) => {
        const routes = [];
        
        this.app._router.stack.forEach((middleware) => {
          if (middleware.route) {
            routes.push({
              path: middleware.route.path,
              methods: Object.keys(middleware.route.methods)
            });
          } else if (middleware.name === 'router') {
            middleware.handle.stack.forEach((handler) => {
              if (handler.route) {
                routes.push({
                  path: middleware.regexp.source + handler.route.path,
                  methods: Object.keys(handler.route.methods)
                });
              }
            });
          }
        });
        
        res.json({ registeredRoutes: routes });
      });
    }
  }

  setupErrorHandling() {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  async start(port = 3001) {
    try {
      await connectDatabase();
      
      this.app.listen(port, () => {
        logger.info(`Server running on http://localhost:${port}`);
        logger.info(`Health check: http://localhost:${port}/api/health`);
        logger.info(`Database health check: http://localhost:${port}/api/health/db`);
        logger.info(`Payment webhook: http://localhost:${port}/api/payments/webhook`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  getApp() {
    return this.app;
  }
}

module.exports = App;
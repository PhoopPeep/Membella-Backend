const PaymentService = require('../services/paymentService');
const { asyncHandler } = require('../utils/errorHandler');

class PaymentController {
  constructor() {
    this.paymentService = new PaymentService();
  }

  // Get Omise public key for frontend
  getOmisePublicKey = asyncHandler(async (req, res) => {
    try {
      const publicKey = process.env.OMISE_PUBLIC_KEY;
      
      if (!publicKey) {
        console.error('OMISE_PUBLIC_KEY not configured in environment');
        return res.status(500).json({
          success: false,
          message: 'Payment system not properly configured'
        });
      }

      // Validate key format
      if (!publicKey.startsWith('pkey_')) {
        console.error('Invalid Omise public key format');
        return res.status(500).json({
          success: false,
          message: 'Invalid payment configuration'
        });
      }

      console.log('Providing Omise public key to frontend:', publicKey.substring(0, 15) + '...');
      
      res.json({
        success: true,
        publicKey
      });
    } catch (error) {
      console.error('Error providing Omise public key:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment configuration'
      });
    }
  });

  // Create subscription payment
  createSubscriptionPayment = asyncHandler(async (req, res) => {
    try {
      console.log('PaymentController: Create subscription payment request received');
      console.log('Request headers:', {
        'content-type': req.headers['content-type'],
        'authorization': req.headers.authorization ? 'Present' : 'Missing',
        'user-agent': req.headers['user-agent']?.substring(0, 50) + '...'
      });
      console.log('Request body:', {
        ...req.body,
        paymentSource: req.body.paymentSource ? '[TOKEN_REDACTED]' : 'null'
      });
      console.log('User from token:', {
        userId: req.user?.userId,
        role: req.user?.role
      });
      
      const memberId = req.user.userId;
      const { planId, paymentMethod, paymentSource, customerData } = req.body;

      // Validation
      if (!planId || typeof planId !== 'string' || planId.trim() === '') {
        console.error('Validation failed: Invalid planId:', planId);
        return res.status(400).json({
          success: false,
          message: 'Plan ID is required'
        });
      }

      if (!paymentMethod || !['card', 'promptpay'].includes(paymentMethod)) {
        console.error('Validation failed: Invalid paymentMethod:', paymentMethod);
        return res.status(400).json({
          success: false,
          message: 'Valid payment method is required (card or promptpay)'
        });
      }

      // Card-specific validation
      if (paymentMethod === 'card') {
        if (!paymentSource || typeof paymentSource !== 'string' || paymentSource.trim() === '') {
          console.error('Validation failed: Missing paymentSource for card payment');
          return res.status(400).json({
            success: false,
            message: 'Payment source token is required for card payments'
          });
        }

        // Validate token format
        if (!paymentSource.startsWith('tokn_')) {
          console.error('Validation failed: Invalid token format:', paymentSource.substring(0, 10));
          return res.status(400).json({
            success: false,
            message: 'Invalid payment token format'
          });
        }

        // Validate customer data for card payments
        if (customerData?.name && (typeof customerData.name !== 'string' || customerData.name.trim() === '')) {
          console.error('Validation failed: Invalid customer name');
          return res.status(400).json({
            success: false,
            message: 'Valid cardholder name is required for card payments'
          });
        }
      }

      console.log('Validation passed. Processing subscription payment:', { 
        memberId, 
        planId: planId.trim(), 
        paymentMethod 
      });

      // Process payment through service
      const result = await this.paymentService.processSubscriptionPayment({
        memberId,
        planId: planId.trim(),
        paymentMethod,
        paymentSource: paymentSource?.trim(),
        customerData: customerData || {}
      });

      console.log('Payment processed successfully:', {
        paymentId: result.paymentId,
        status: result.status,
        amount: result.amount,
        hasQrCode: !!result.qr_code_url
      });

      res.status(201).json({
        success: true,
        message: 'Payment processed successfully',
        data: result
      });

    } catch (error) {
      console.error('PaymentController subscription payment error:', error);
      console.error('Error stack:', error.stack);
      
      // Handle specific error types
      let statusCode = 500;
      let message = 'Payment processing failed';

      if (error.message.includes('Plan not found')) {
        statusCode = 404;
        message = 'The selected plan is no longer available';
      } else if (error.message.includes('Member not found')) {
        statusCode = 401;
        message = 'Authentication required';
      } else if (error.message.includes('already have an active subscription')) {
        statusCode = 409;
        message = 'You already have an active subscription to this plan';
      } else if (error.message.includes('Invalid card') || error.message.includes('card details')) {
        statusCode = 400;
        message = error.message;
      } else if (error.message.includes('Insufficient funds')) {
        statusCode = 402;
        message = error.message;
      } else if (error.message.includes('expired') || error.message.includes('stolen')) {
        statusCode = 400;
        message = error.message;
      } else if (error.message.includes('amount') || error.message.includes('minimum')) {
        statusCode = 400;
        message = error.message;
      } else if (error.message.includes('PromptPay')) {
        statusCode = 400;
        message = error.message;
      }

      console.error('Sending error response:', { statusCode, message });

      res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? {
          original: error.message,
          stack: error.stack
        } : undefined
      });
    }
  });

  // Get payment status
  getPaymentStatus = asyncHandler(async (req, res) => {
    try {
      const { paymentId } = req.params;
      const memberId = req.user.userId;

      if (!paymentId || paymentId.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Payment ID is required'
        });
      }

      console.log('Getting payment status:', paymentId);

      const payment = await this.paymentService.getPaymentStatus(paymentId.trim());

      // Verify payment belongs to the requesting member
      if (payment.member_id !== memberId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Calculate days remaining for active subscriptions
      let daysRemaining = null;
      if (payment.subscription && payment.subscription.status === 'active') {
        const now = new Date();
        const endDate = new Date(payment.subscription.end_date);
        daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
      }

      const responseData = {
        id: payment.payment_id,
        status: payment.status,
        amount: parseFloat(payment.amount.toString()),
        currency: payment.currency,
        paymentMethod: payment.payment_method,
        description: payment.description,
        planName: payment.plan?.name,
        organization: payment.plan?.owner?.org_name,
        subscription: payment.subscription ? {
          id: payment.subscription.subscription_id,
          status: payment.subscription.status,
          startDate: payment.subscription.start_date,
          endDate: payment.subscription.end_date,
          daysRemaining
        } : null,
        createdAt: payment.create_at,
        updatedAt: payment.update_at
      };

      res.json({
        success: true,
        data: responseData
      });

    } catch (error) {
      console.error('PaymentController get payment status error:', error);
      
      let statusCode = 500;
      let message = 'Failed to get payment status';

      if (error.message.includes('Payment not found')) {
        statusCode = 404;
        message = 'Payment not found';
      }
      
      res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Get member's payment history
  getPaymentHistory = asyncHandler(async (req, res) => {
    try {
      const memberId = req.user.userId;
      const { limit = 50, offset = 0, status } = req.query;

      console.log('Getting payment history for member:', memberId);

      // Validate query parameters
      const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100 per request
      const offsetNum = Math.max(parseInt(offset) || 0, 0);

      if (status && !['pending', 'successful', 'failed', 'expired', 'refunded'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status filter'
        });
      }

      let payments = await this.paymentService.getMemberPaymentHistory(memberId);

      // Filter by status if provided
      if (status) {
        payments = payments.filter(payment => payment.status === status);
      }

      // Apply pagination
      const total = payments.length;
      const paginatedPayments = payments.slice(offsetNum, offsetNum + limitNum);

      res.json({
        success: true,
        data: paginatedPayments,
        pagination: {
          total,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < total
        }
      });

    } catch (error) {
      console.error('PaymentController get payment history error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get payment history',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Handle Omise webhook
  handleWebhook = asyncHandler(async (req, res) => {
    try {
      console.log('PaymentController: Webhook received');
      console.log('Webhook headers:', {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        'omise-signature': req.headers['omise-signature'] ? 'Present' : 'Missing'
      });
      console.log('Webhook event type:', req.body.key);
      console.log('Webhook data preview:', {
        key: req.body.key,
        hasData: !!req.body.data,
        dataId: req.body.data?.id,
        dataObject: req.body.data?.object
      });
      
      const event = req.body;

      // Validate webhook event structure
      if (!event.key || !event.data) {
        console.error('Invalid webhook event structure');
        return res.status(400).json({ 
          received: false, 
          error: 'Invalid event structure' 
        });
      }

      // Process webhook based on event type
      switch (event.key) {
        case 'charge.complete':
        case 'charge.successful':
          console.log('Processing successful charge webhook');
          await this.paymentService.handleWebhook(event);
          break;
        case 'charge.failed':
        case 'charge.expired':
          console.log('Processing failed/expired charge webhook');
          await this.paymentService.handleWebhook(event);
          break;
        default:
          console.log('Unhandled webhook event type:', event.key);
          // Still acknowledge receipt
          break;
      }

      console.log('Webhook processed successfully');
      res.status(200).json({ 
        received: true,
        processed: true
      });

    } catch (error) {
      console.error('PaymentController webhook error:', error);
      
      // Always return success to prevent webhook retries for our errors
      // But log the error for debugging
      res.status(200).json({ 
        received: true,
        processed: false,
        error: 'Processing failed but acknowledged'
      });
    }
  });

  // Poll payment status for PromptPay
  pollPaymentStatus = asyncHandler(async (req, res) => {
    try {
      const { paymentId } = req.params;
      const memberId = req.user.userId;
      const { maxAttempts = 60 } = req.query;

      if (!paymentId || paymentId.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Payment ID is required'
        });
      }

      // Validate maxAttempts
      const maxAttemptsNum = Math.min(Math.max(parseInt(maxAttempts) || 60, 1), 300); // 1-300 attempts

      console.log('Starting payment status polling:', paymentId, 'max attempts:', maxAttemptsNum);

      // Verify payment belongs to member first
      const payment = await this.paymentService.getPaymentStatus(paymentId.trim());
      if (payment.member_id !== memberId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Start polling
      const result = await this.paymentService.pollPaymentStatus(
        paymentId.trim(), 
        maxAttemptsNum
      );

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('PaymentController poll payment status error:', error);
      
      let statusCode = 500;
      let message = 'Payment polling failed';

      if (error.message.includes('Payment not found')) {
        statusCode = 404;
        message = 'Payment not found';
      } else if (error.message.includes('timeout')) {
        statusCode = 408;
        message = error.message;
      } else if (error.message.includes('failed') || error.message.includes('expired')) {
        statusCode = 402;
        message = error.message;
      }

      res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Get payment methods for frontend
  getPaymentMethods = asyncHandler(async (req, res) => {
    try {
      // Return supported payment methods with current status
      const paymentMethods = [
        {
          type: 'card',
          name: 'Credit/Debit Card',
          description: 'Visa, Mastercard, JCB, American Express',
          icon: 'credit-card',
          enabled: true,
          currencies: ['THB'],
          processing_time: 'Instant',
          min_amount: 1,
          max_amount: 200000,
          features: ['instant_confirmation', '3d_secure_support']
        },
        {
          type: 'promptpay',
          name: 'PromptPay QR',
          description: 'Scan to pay with mobile banking app',
          icon: 'qrcode',
          enabled: true,
          currencies: ['THB'],
          processing_time: 'Up to 5 minutes',
          min_amount: 20,
          max_amount: 50000,
          features: ['qr_code', 'mobile_banking']
        }
      ];

      res.json({
        success: true,
        data: paymentMethods
      });
    } catch (error) {
      console.error('PaymentController get payment methods error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment methods'
      });
    }
  });

  // Validate payment before processing (utility endpoint)
  validatePayment = asyncHandler(async (req, res) => {
    try {
      const { planId, paymentMethod, amount, paymentSource } = req.body;

      const errors = [];

      // Validate plan ID
      if (!planId || typeof planId !== 'string' || planId.trim() === '') {
        errors.push('Valid plan ID is required');
      }

      // Validate payment method
      if (!paymentMethod || !['card', 'promptpay'].includes(paymentMethod)) {
        errors.push('Valid payment method is required (card or promptpay)');
      }

      // Validate payment source for card payments
      if (paymentMethod === 'card') {
        if (!paymentSource || typeof paymentSource !== 'string') {
          errors.push('Payment source token is required for card payments');
        } else if (!paymentSource.startsWith('tokn_')) {
          errors.push('Invalid payment token format');
        }
      }

      // Validate amount
      if (amount !== undefined) {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
          errors.push('Amount must be a positive number');
        } else {
          const amountInSatang = Math.round(numAmount * 100);
          
          if (paymentMethod === 'card' && amountInSatang < 100) {
            errors.push('Card payment minimum is 1 THB');
          } else if (paymentMethod === 'promptpay' && amountInSatang < 2000) {
            errors.push('PromptPay minimum is 20 THB');
          }
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          valid: false,
          errors
        });
      }

      res.json({
        success: true,
        valid: true,
        message: 'Payment data is valid'
      });

    } catch (error) {
      console.error('PaymentController validate payment error:', error);
      res.status(500).json({
        success: false,
        message: 'Validation failed'
      });
    }
  });
}

module.exports = PaymentController;
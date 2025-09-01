const PaymentService = require('../services/paymentService');
const { asyncHandler } = require('../utils/errorHandler');

class PaymentController {
  constructor() {
    this.paymentService = new PaymentService();
  }

  // Create subscription payment
  createSubscriptionPayment = asyncHandler(async (req, res) => {
    try {
      console.log('PaymentController: Create subscription payment request received');
      
      const memberId = req.user.userId;
      const { planId, paymentMethod, paymentSource, customerData } = req.body;

      // Validation
      if (!planId) {
        return res.status(400).json({
          success: false,
          message: 'Plan ID is required'
        });
      }

      if (!paymentMethod || !['card', 'promptpay'].includes(paymentMethod)) {
        return res.status(400).json({
          success: false,
          message: 'Valid payment method is required (card or promptpay)'
        });
      }

      if (paymentMethod === 'card' && !paymentSource) {
        return res.status(400).json({
          success: false,
          message: 'Payment source is required for card payments'
        });
      }

      console.log('Processing subscription payment:', { memberId, planId, paymentMethod });

      const result = await this.paymentService.processSubscriptionPayment({
        memberId,
        planId,
        paymentMethod,
        paymentSource,
        customerData: customerData || {}
      });

      console.log('Payment processed successfully:', result.paymentId);

      res.status(201).json({
        success: true,
        message: 'Payment processed successfully',
        data: result
      });

    } catch (error) {
      console.error('PaymentController subscription payment error:', error);
      
      res.status(500).json({
        success: false,
        message: error.message || 'Payment processing failed',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Get payment status
  getPaymentStatus = asyncHandler(async (req, res) => {
    try {
      const { paymentId } = req.params;
      const memberId = req.user.userId;

      console.log('Getting payment status:', paymentId);

      const payment = await this.paymentService.getPaymentStatus(paymentId);

      // Verify payment belongs to the requesting member
      if (payment.member_id !== memberId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: {
          id: payment.payment_id,
          status: payment.status,
          amount: parseFloat(payment.amount.toString()),
          currency: payment.currency,
          paymentMethod: payment.payment_method,
          description: payment.description,
          planName: payment.plan?.name,
          organization: payment.plan?.owner?.org_name,
          createdAt: payment.create_at,
          updatedAt: payment.update_at
        }
      });

    } catch (error) {
      console.error('PaymentController get payment status error:', error);
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get payment status'
      });
    }
  });

  // Get member's payment history
  getPaymentHistory = asyncHandler(async (req, res) => {
    try {
      const memberId = req.user.userId;

      console.log('Getting payment history for member:', memberId);

      const payments = await this.paymentService.getMemberPaymentHistory(memberId);

      res.json({
        success: true,
        data: payments
      });

    } catch (error) {
      console.error('PaymentController get payment history error:', error);
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get payment history'
      });
    }
  });

  // Handle Omise webhook
  handleWebhook = asyncHandler(async (req, res) => {
    try {
      console.log('PaymentController: Webhook received');
      console.log('Webhook event:', req.body.key);

      const event = req.body;

      await this.paymentService.handleWebhook(event);

      console.log('Webhook processed successfully');

      res.status(200).json({ received: true });

    } catch (error) {
      console.error('PaymentController webhook error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Webhook processing failed'
      });
    }
  });

  // Get Omise public key for frontend
  getOmisePublicKey = asyncHandler(async (req, res) => {
    const publicKey = process.env.OMISE_PUBLIC_KEY;
    
    if (!publicKey) {
      return res.status(500).json({
        success: false,
        message: 'Omise public key not configured'
      });
    }

    res.json({
      success: true,
      publicKey
    });
  });

  // Cancel subscription
  cancelSubscription = asyncHandler(async (req, res) => {
    try {
      const memberId = req.user.userId;
      const { subscriptionId } = req.params;

      console.log('Cancelling subscription:', subscriptionId);

      const { getPrismaClient } = require('../config/database');
      const prisma = getPrismaClient();

      // Find and verify subscription
      const subscription = await prisma.subscription.findFirst({
        where: {
          subscription_id: subscriptionId,
          member_id: memberId,
          status: 'active'
        }
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Active subscription not found'
        });
      }

      // Update subscription status
      await prisma.subscription.update({
        where: { subscription_id: subscriptionId },
        data: {
          status: 'cancelled',
          update_at: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Subscription cancelled successfully'
      });

    } catch (error) {
      console.error('PaymentController cancel subscription error:', error);
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to cancel subscription'
      });
    }
  });

  // Verify webhook signature
  verifyWebhookSignature(payload, signature) {
    // TODO: Implement Omise webhook signature verification
    return true;
  }
}

module.exports = PaymentController;
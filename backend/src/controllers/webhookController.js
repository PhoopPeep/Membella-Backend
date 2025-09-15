const { asyncHandler } = require('../utils/errorHandler');
const { getPrismaClient } = require('../config/database');
const crypto = require('crypto');

class WebhookController {
  constructor() {
    this.prisma = getPrismaClient();
  }

  // Handle user created webhook from Supabase
  handleUserCreated = asyncHandler(async (req, res) => {
    try {
      console.log('Webhook: User created event received');
      console.log('Webhook payload:', JSON.stringify(req.body, null, 2));

      const { type, table, record } = req.body;

      // Verify webhook signature (optional but recommended)
      const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
      if (webhookSecret) {
        const signature = req.headers['x-supabase-signature'];
        if (!signature) {
          console.log('Missing webhook signature');
          return res.status(401).json({ error: 'Missing webhook signature' });
        }
        // Add signature verification logic here if needed
      }

      // Handle user creation event
      if (type === 'INSERT' && table === 'users') {
        const user = record;
        console.log('New user created:', user.id, user.email);

        // Check if this is an owner or member based on email domain or other criteria
        // For now, we'll check the user metadata to determine type
        const userMetadata = user.raw_user_meta_data || {};
        const isOwner = userMetadata.role === 'owner' || userMetadata.org_name;
        const isMember = userMetadata.role === 'member' || userMetadata.full_name;

        console.log('User metadata:', userMetadata);
        console.log('User type determination:', { isOwner, isMember });

        if (isOwner) {
          // Create owner record in database
          try {
            const newOwner = await this.prisma.owner.create({
              data: {
                owner_id: user.id,
                org_name: userMetadata.org_name || 'Default Organization',
                email: user.email,
                password: '', // Password is handled by Supabase
                description: userMetadata.description || null,
                contact_info: userMetadata.contact_info || null,
                logo: userMetadata.logo || null,
                create_at: new Date(),
                update_at: new Date()
              }
            });
            console.log('Owner record created:', newOwner.owner_id);
          } catch (dbError) {
            console.error('Error creating owner record:', dbError);
            // Don't fail the webhook, just log the error
          }
        } else if (isMember) {
          // Create member record in database
          try {
            const newMember = await this.prisma.member.create({
              data: {
                member_id: user.id,
                full_name: userMetadata.full_name || 'Unknown',
                email: user.email,
                password: '', // Password is handled by Supabase
                phone: userMetadata.phone || null,
                role: userMetadata.role || 'member',
                create_at: new Date(),
                update_at: new Date()
              }
            });
            console.log('Member record created:', newMember.member_id);
          } catch (dbError) {
            console.error('Error creating member record:', dbError);
            // Don't fail the webhook, just log the error
          }
        } else {
          console.log('Unknown user type, skipping database record creation');
        }
      }

      res.status(200).json({ success: true, message: 'Webhook processed successfully' });

    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Handle email verification webhook from Supabase
  handleEmailVerification = asyncHandler(async (req, res) => {
    try {
      console.log('Webhook: Email verification event received');
      console.log('Webhook payload:', JSON.stringify(req.body, null, 2));

      const { type, table, record } = req.body;

      // Verify webhook signature (optional but recommended)
      const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
      if (webhookSecret) {
        const signature = req.headers['x-supabase-signature'];
        if (!signature) {
          console.log('Missing webhook signature');
          return res.status(401).json({ error: 'Missing webhook signature' });
        }
        // Add signature verification logic here if needed
      }

      // Handle email confirmation event
      if (type === 'UPDATE' && table === 'users') {
        const user = record;
        const oldUser = old_record;
        
        // Check if email_confirmed_at was just set (email verification)
        if (!oldUser.email_confirmed_at && user.email_confirmed_at) {
          console.log('Email verification completed for user:', user.id, user.email);
          
          // Update user status in our database if needed
          try {
            // Check if this is an owner
            const owner = await this.prisma.owner.findUnique({
              where: { owner_id: user.id }
            });
            
            if (owner) {
              console.log('Owner email verified:', owner.owner_id);
              // You can add additional logic here if needed
            } else {
              // Check if this is a member
              const member = await this.prisma.member.findUnique({
                where: { member_id: user.id }
              });
              
              if (member) {
                console.log('Member email verified:', member.member_id);
                // You can add additional logic here if needed
              }
            }
          } catch (dbError) {
            console.error('Error updating user verification status:', dbError);
            // Don't fail the webhook, just log the error
          }
        }
      }

      res.status(200).json({ success: true, message: 'Email verification webhook processed successfully' });

    } catch (error) {
      console.error('Email verification webhook processing error:', error);
      res.status(500).json({ error: 'Email verification webhook processing failed' });
    }
  });

  // Handle user updated webhook (for email verification and other updates)
  handleUserUpdated = asyncHandler(async (req, res) => {
    try {
      console.log('Webhook: User updated event received');
      console.log('Webhook payload:', JSON.stringify(req.body, null, 2));

      const { type, table, record } = req.body;

      // Verify webhook signature (optional but recommended)
      const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
      if (webhookSecret) {
        const signature = req.headers['x-supabase-signature'];
        if (!signature) {
          console.log('Missing webhook signature');
          return res.status(401).json({ error: 'Missing webhook signature' });
        }
        // Add signature verification logic here if needed
      }

      // Handle user update event
      if (type === 'UPDATE' && table === 'users') {
        const user = record;
        const oldUser = old_record;
        
        console.log('User update details:', {
          userId: user.id,
          email: user.email,
          emailConfirmed: !!user.email_confirmed_at,
          oldEmailConfirmed: !!oldUser.email_confirmed_at,
          lastSignInAt: user.last_sign_in_at,
          oldLastSignInAt: oldUser.last_sign_in_at
        });

        // Check if email was just confirmed (email verification)
        if (!oldUser.email_confirmed_at && user.email_confirmed_at) {
          console.log('🎉 Email verification completed for user:', user.id, user.email);
          
          // Update user status in our database if needed
          try {
            // Check if this is an owner
            const owner = await this.prisma.owner.findUnique({
              where: { owner_id: user.id }
            });
            
            if (owner) {
              console.log('✅ Owner email verified:', owner.owner_id);
              // You can add additional logic here if needed
              // For example, send welcome email, update user status, etc.
            } else {
              // Check if this is a member
              const member = await this.prisma.member.findUnique({
                where: { member_id: user.id }
              });
              
              if (member) {
                console.log('✅ Member email verified:', member.member_id);
                // You can add additional logic here if needed
              }
            }
          } catch (dbError) {
            console.error('Error updating user verification status:', dbError);
            // Don't fail the webhook, just log the error
          }
        }

        // Check if user signed in (optional - for analytics or logging)
        if (!oldUser.last_sign_in_at && user.last_sign_in_at) {
          console.log('User signed in:', user.id, user.email);
          // You can add sign-in tracking logic here if needed
        }
      }

      res.status(200).json({ success: true, message: 'User updated webhook processed successfully' });

    } catch (error) {
      console.error('User updated webhook processing error:', error);
      res.status(500).json({ error: 'User updated webhook processing failed' });
    }
  });

  // Handle Omise payment webhook
  handleOmisePayment = asyncHandler(async (req, res) => {
    try {
      console.log('Webhook: Omise payment event received');
      console.log('Webhook payload:', JSON.stringify(req.body, null, 2));

      const { type, data } = req.body;

      // Verify webhook signature
      const webhookSecret = process.env.OMISE_WEBHOOK_SECRET;
      if (webhookSecret) {
        const signature = req.headers['x-omise-signature'];
        if (!signature) {
          console.log('Missing Omise webhook signature');
          return res.status(401).json({ error: 'Missing webhook signature' });
        }

        // Verify signature
        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(JSON.stringify(req.body))
          .digest('hex');

        if (signature !== expectedSignature) {
          console.log('Invalid webhook signature');
          return res.status(401).json({ error: 'Invalid webhook signature' });
        }
      }

      // Handle different payment events
      if (type === 'charge.complete' || type === 'charge.successful') {
        await this.handleSuccessfulPayment(data);
      } else if (type === 'charge.failed') {
        await this.handleFailedPayment(data);
      } else if (type === 'charge.expired') {
        await this.handleExpiredPayment(data);
      } else {
        console.log('Unhandled webhook event type:', type);
      }

      res.status(200).json({ success: true, message: 'Omise webhook processed successfully' });

    } catch (error) {
      console.error('Omise webhook processing error:', error);
      res.status(500).json({ error: 'Omise webhook processing failed' });
    }
  });

  // Handle successful payment
  async handleSuccessfulPayment(chargeData) {
    try {
      console.log('Processing successful payment:', chargeData.id);

      // Find the payment record
      const payment = await this.prisma.payment.findFirst({
        where: {
          omise_charge_id: chargeData.id
        },
        include: {
          plan: true,
          member: true
        }
      });

      if (!payment) {
        console.log('Payment record not found for charge:', chargeData.id);
        return;
      }

      // Update payment status
      await this.prisma.payment.update({
        where: { payment_id: payment.payment_id },
        data: {
          status: 'successful',
          omise_charge_id: chargeData.id,
          omise_transaction_id: chargeData.transaction,
          update_at: new Date()
        }
      });

      // Create subscription
      const subscription = await this.prisma.subscription.create({
        data: {
          member_id: payment.member_id,
          plan_id: payment.plan_id,
          payment_id: payment.payment_id,
          status: 'active',
          start_date: new Date(),
          end_date: new Date(Date.now() + payment.plan.duration * 24 * 60 * 60 * 1000), // Add duration in days
          create_at: new Date(),
          update_at: new Date()
        }
      });

      console.log('Subscription created successfully:', subscription.subscription_id);

      // Send confirmation email (optional)
      // await this.sendPaymentConfirmationEmail(payment, subscription);

    } catch (error) {
      console.error('Error handling successful payment:', error);
      throw error;
    }
  }

  // Handle failed payment
  async handleFailedPayment(chargeData) {
    try {
      console.log('Processing failed payment:', chargeData.id);

      // Find the payment record
      const payment = await this.prisma.payment.findFirst({
        where: {
          omise_charge_id: chargeData.id
        }
      });

      if (!payment) {
        console.log('Payment record not found for charge:', chargeData.id);
        return;
      }

      // Update payment status
      await this.prisma.payment.update({
        where: { payment_id: payment.payment_id },
        data: {
          status: 'failed',
          omise_charge_id: chargeData.id,
          update_at: new Date()
        }
      });

      console.log('Payment marked as failed:', payment.payment_id);

    } catch (error) {
      console.error('Error handling failed payment:', error);
      throw error;
    }
  }

  // Handle expired payment
  async handleExpiredPayment(chargeData) {
    try {
      console.log('Processing expired payment:', chargeData.id);

      // Find the payment record
      const payment = await this.prisma.payment.findFirst({
        where: {
          omise_charge_id: chargeData.id
        }
      });

      if (!payment) {
        console.log('Payment record not found for charge:', chargeData.id);
        return;
      }

      // Update payment status
      await this.prisma.payment.update({
        where: { payment_id: payment.payment_id },
        data: {
          status: 'expired',
          omise_charge_id: chargeData.id,
          update_at: new Date()
        }
      });

      console.log('Payment marked as expired:', payment.payment_id);

    } catch (error) {
      console.error('Error handling expired payment:', error);
      throw error;
    }
  }

  // Health check for webhooks
  webhookHealthCheck = asyncHandler(async (req, res) => {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      message: 'Webhook endpoint is working' 
    });
  });
}

module.exports = WebhookController;

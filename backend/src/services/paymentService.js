const { omise, OMISE_CONFIG } = require('../config/omise');
const { getPrismaClient } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const prisma = getPrismaClient();

class PaymentService {
  constructor() {
    // Cache for recent webhook processing to prevent duplicates
    this.recentWebhooks = new Map();
    this.webhookCacheTimeout = 300000; // 5 minutes
  }

  // Create a card payment charge
  async createCardCharge(paymentData) {
    const { 
      amount, 
      currency = 'THB', 
      description, 
      token, 
      customerId, 
      metadata = {},
      capture = true
    } = paymentData;

    try {
      console.log('Creating Omise card charge:', { amount, currency, description, hasToken: !!token });

      const amountInSatang = Math.round(amount * 100);
      if (amountInSatang <= 0) {
        throw new Error('Invalid amount: must be greater than 0');
      }

      if (amountInSatang < 100) {
        throw new Error('Invalid amount: minimum payment is 1 THB');
      }

      if (!token || typeof token !== 'string' || !token.startsWith('tokn_')) {
        throw new Error('Invalid card token provided');
      }

      const charge = await omise.charges.create({
        amount: amountInSatang,
        currency: currency.toUpperCase(),
        description: description || 'Card payment',
        card: token,
        capture: capture,
        metadata: {
          ...metadata,
          customer_id: customerId,
          payment_method: 'card',
          created_by: 'membella_platform'
        },
      });

      console.log('Omise card charge created:', {
        id: charge.id,
        amount: charge.amount,
        status: charge.status,
        paid: charge.paid,
        authorized: charge.authorized,
        captured: charge.captured
      });

      if (!charge || !charge.id) {
        throw new Error('Failed to create charge - invalid response from payment gateway');
      }

      return {
        charge,
        success: charge.paid || (charge.authorized && charge.captured),
        requiresAuthorization: !!charge.authorize_uri
      };
    } catch (error) {
      console.error('Omise card charge creation failed:', error);
      
      if (error.code) {
        switch (error.code) {
          case 'invalid_card':
            throw new Error('Invalid card information. Please check your card details and try again.');
          case 'insufficient_fund':
          case 'insufficient_funds':
            throw new Error('Insufficient funds on your card. Please use a different card.');
          case 'stolen_or_lost_card':
            throw new Error('This card has been reported as stolen or lost. Please use a different card.');
          case 'expired_card':
            throw new Error('This card has expired. Please check the expiry date.');
          case 'processing_error':
            throw new Error('Payment processing error. Please try again in a few moments.');
          case 'failed_processing':
            throw new Error('Card processing failed. Please check your card details.');
          case 'invalid_security_code':
            throw new Error('Invalid security code (CVV). Please check and try again.');
          case 'limit_exceeded':
            throw new Error('Transaction limit exceeded. Please contact your bank.');
          default:
            throw new Error(`Card payment failed: ${error.message}`);
        }
      }

      if (error.response && error.response.data) {
        const responseData = error.response.data;
        if (responseData.message) {
          throw new Error(`Payment failed: ${responseData.message}`);
        }
      }
      
      throw new Error(`Card payment failed: ${error.message}`);
    }
  }

  // Create PromptPay payment
  async createPromptPayCharge(paymentData) {
    const { amount, description, customerId, metadata = {} } = paymentData;

    try {
      console.log('Creating PromptPay charge:', { amount, description });

      const amountInSatang = Math.round(amount * 100);
      if (amountInSatang <= 0 || amountInSatang < 2000) {
        throw new Error('Invalid amount: minimum payment for PromptPay is 20 THB');
      }

      console.log('Amount in satang:', amountInSatang);

      const source = await omise.sources.create({
        type: 'promptpay',
        amount: amountInSatang,
        currency: 'THB',
      });

      console.log('PromptPay source created:', {
        id: source.id,
        type: source.type,
        amount: source.amount,
        currency: source.currency,
        has_scannable_code: !!source.scannable_code
      });

      if (!source || !source.id) {
        throw new Error('Failed to create PromptPay source');
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const charge = await omise.charges.create({
        amount: amountInSatang,
        currency: 'THB',
        description: description || 'PromptPay Payment',
        source: source.id,
        capture: false,
        metadata: {
          ...metadata,
          customer_id: customerId,
          payment_method: 'promptpay',
          created_by: 'membella_platform'
        },
      });

      console.log('PromptPay charge created:', {
        id: charge.id,
        source_id: charge.source?.id,
        status: charge.status,
        amount: charge.amount,
        authorized: charge.authorized,
        paid: charge.paid
      });

      let qrCodeUrl = null;
      let expiresAt = null;

      if (source.scannable_code && source.scannable_code.image) {
        qrCodeUrl = source.scannable_code.image.download_uri;
      } else if (charge.source && charge.source.scannable_code && charge.source.scannable_code.image) {
        qrCodeUrl = charge.source.scannable_code.image.download_uri;
      }

      if (source.expires_at) {
        expiresAt = source.expires_at;
      } else if (charge.source && charge.source.expires_at) {
        expiresAt = charge.source.expires_at;
      }

      if (!qrCodeUrl) {
        console.warn('No QR code found in source response');
        try {
          const retrievedSource = await omise.sources.retrieve(source.id);
          console.log('Retrieved source:', retrievedSource);
          if (retrievedSource.scannable_code && retrievedSource.scannable_code.image) {
            qrCodeUrl = retrievedSource.scannable_code.image.download_uri;
          }
        } catch (retrieveError) {
          console.error('Failed to retrieve source:', retrieveError);
        }
      }

      if (!qrCodeUrl) {
        throw new Error('Failed to generate QR code for PromptPay payment');
      }

      console.log('QR code URL generated:', qrCodeUrl ? 'Yes' : 'No');

      return {
        charge,
        source,
        qr_code_url: qrCodeUrl,
        expires_at: expiresAt
      };
    } catch (error) {
      console.error('PromptPay charge creation failed:', error);
      
      if (error.response) {
        console.error('Omise API Error Response:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      }
      
      if (error.code) {
        console.error('Omise Error Code:', error.code);
      }

      if (error.message && error.message.includes('amount')) {
        throw new Error('Invalid payment amount. PromptPay requires minimum 20 THB.');
      }
      
      if (error.message && error.message.includes('currency')) {
        throw new Error('PromptPay only supports THB currency.');
      }

      if (error.message && error.message.includes('type')) {
        throw new Error('PromptPay payment method is not available.');
      }

      throw new Error(`PromptPay payment failed: ${error.message}`);
    }
  }

  // Process subscription payment with error handling
  async processSubscriptionPayment({
    memberId,
    planId,
    paymentMethod,
    paymentSource,
    customerData
  }) {
    try {
      console.log('Processing subscription payment:', { memberId, planId, paymentMethod });

      const plan = await prisma.plan.findUnique({
        where: { plan_id: planId },
        include: {
          owner: {
            select: {
              org_name: true,
              email: true
            }
          }
        }
      });

      if (!plan) {
        throw new Error('Plan not found');
      }

      const member = await prisma.member.findUnique({
        where: { member_id: memberId }
      });

      if (!member) {
        throw new Error('Member not found');
      }

      const existingSubscription = await prisma.subscription.findFirst({
        where: {
          member_id: memberId,
          plan_id: planId,
          status: 'active'
        }
      });

      if (existingSubscription) {
        throw new Error('You already have an active subscription to this plan');
      }

      const amount = parseFloat(plan.price.toString());
      
      if (paymentMethod === 'promptpay' && amount < 20) {
        throw new Error('PromptPay requires minimum payment of 20 THB');
      } else if (paymentMethod === 'card' && amount < 1) {
        throw new Error('Card payment requires minimum payment of 1 THB');
      }

      const description = `Subscription: ${plan.name} - ${plan.owner.org_name}`;

      return await prisma.$transaction(async (tx) => {
        const paymentRecord = await tx.payment.create({
          data: {
            payment_id: uuidv4(),
            member_id: memberId,
            plan_id: planId,
            amount: plan.price,
            currency: 'THB',
            payment_method: paymentMethod,
            status: 'pending',
            description,
            metadata: {
              plan_name: plan.name,
              organization: plan.owner.org_name,
              member_email: member.email,
              member_name: member.full_name,
              customer_data: customerData || {},
              webhook_ready: true // Flag to indicate this payment expects webhooks
            }
          }
        });

        let chargeResult;

        try {
          if (paymentMethod === 'promptpay') {
            chargeResult = await this.createPromptPayCharge({
              amount,
              description,
              customerId: memberId,
              metadata: {
                payment_id: paymentRecord.payment_id,
                plan_id: planId,
                member_id: memberId
              }
            });
          } else if (paymentMethod === 'card') {
            if (!paymentSource) {
              throw new Error('Payment source token is required for card payments');
            }
            
            chargeResult = await this.createCardCharge({
              amount,
              currency: 'THB',
              description,
              token: paymentSource,
              customerId: memberId,
              metadata: {
                payment_id: paymentRecord.payment_id,
                plan_id: planId,
                member_id: memberId
              },
              capture: true
            });
          } else {
            throw new Error('Unsupported payment method');
          }

          const updateData = {
            omise_charge_id: chargeResult.charge?.id || chargeResult.id,
            status: this.mapOmiseStatusToLocal(chargeResult.charge?.status || chargeResult.status),
            omise_response: chargeResult.charge || chargeResult,
            update_at: new Date()
          };

          if (paymentMethod === 'promptpay' && chargeResult.source) {
            updateData.omise_source_id = chargeResult.source.id;
          }

          await tx.payment.update({
            where: { payment_id: paymentRecord.payment_id },
            data: updateData
          });

          const finalStatus = chargeResult.charge?.status || chargeResult.status;
          const isSuccessful = paymentMethod === 'card' ? 
            (chargeResult.charge?.paid || (chargeResult.charge?.authorized && chargeResult.charge?.captured)) :
            finalStatus === 'successful';

          if (isSuccessful) {
            if (paymentMethod === 'card') {
              await tx.payment.update({
                where: { payment_id: paymentRecord.payment_id },
                data: {
                  status: 'successful',
                  update_at: new Date()
                }
              });
            }
            
            await this.createSubscriptionFromPayment(paymentRecord.payment_id, tx);
          }

          console.log('Subscription payment processed:', paymentRecord.payment_id);

          const response = {
            success: true,
            paymentId: paymentRecord.payment_id,
            chargeId: chargeResult.charge?.id || chargeResult.id,
            amount,
            currency: 'THB',
            status: paymentMethod === 'card' && isSuccessful ? 'successful' : finalStatus
          };

          if (paymentMethod === 'promptpay') {
            response.qr_code_url = chargeResult.qr_code_url;
            response.expires_at = chargeResult.expires_at;
          }

          return response;

        } catch (chargeError) {
          console.error('Charge creation error:', chargeError);
          
          await tx.payment.update({
            where: { payment_id: paymentRecord.payment_id },
            data: {
              status: 'failed',
              omise_response: { 
                error: chargeError.message,
                error_code: chargeError.code,
                timestamp: new Date().toISOString()
              },
              update_at: new Date()
            }
          });
          
          throw chargeError;
        }
      });

    } catch (error) {
      console.error('Subscription payment processing failed:', error);
      throw error;
    }
  }

  // Webhook handler with duplicate detection and logging
  async handleWebhook(event) {
    try {
      console.log('Processing webhook event:', event.key);

      const { data: charge } = event;
      const chargeId = charge.id;
      
      // Check for duplicate webhook processing
      const webhookKey = `${event.key}_${chargeId}_${charge.status}`;
      if (this.recentWebhooks.has(webhookKey)) {
        console.log('Duplicate webhook detected, skipping:', webhookKey);
        return { processed: false, reason: 'Duplicate webhook', acknowledged: true };
      }

      // Add to cache with expiration
      this.recentWebhooks.set(webhookKey, Date.now());
      setTimeout(() => {
        this.recentWebhooks.delete(webhookKey);
      }, this.webhookCacheTimeout);

      const paymentId = charge.metadata?.payment_id;

      if (!paymentId) {
        console.warn('No payment_id found in webhook metadata for charge:', chargeId);
        // Try to find payment by charge ID
        const payment = await prisma.payment.findFirst({
          where: { omise_charge_id: chargeId }
        });
        
        if (!payment) {
          console.error('No payment found for charge:', chargeId);
          return { processed: false, reason: 'Payment not found', acknowledged: true };
        }
      }

      // Find payment record with full details
      const payment = await prisma.payment.findUnique({
        where: paymentId ? { payment_id: paymentId } : { omise_charge_id: chargeId },
        include: {
          plan: true,
          member: true,
          subscription: true
        }
      });

      if (!payment) {
        console.error('Payment not found for webhook:', paymentId || chargeId);
        return { processed: false, reason: 'Payment record not found', acknowledged: true };
      }

      const newStatus = this.mapOmiseStatusToLocal(charge.status);
      const statusChanged = payment.status !== newStatus;
      
      console.log('Webhook processing details:', {
        paymentId: payment.payment_id,
        chargeId,
        currentStatus: payment.status,
        newStatus,
        statusChanged,
        eventType: event.key
      });

      // Process webhook in transaction
      await prisma.$transaction(async (tx) => {
        // Update payment status and Omise response
        await tx.payment.update({
          where: { payment_id: payment.payment_id },
          data: {
            status: newStatus,
            omise_response: charge,
            update_at: new Date()
          }
        });

        // If payment became successful and no subscription exists, create one
        if (charge.status === 'successful' && !payment.subscription) {
          console.log('Creating subscription for successful payment:', payment.payment_id);
          await this.createSubscriptionFromPayment(payment.payment_id, tx);
        }

        // If payment failed and subscription exists, mark it as cancelled
        if ((charge.status === 'failed' || charge.status === 'expired') && payment.subscription) {
          console.log('Updating subscription status for failed payment:', payment.payment_id);
          await tx.subscription.update({
            where: { payment_id: payment.payment_id },
            data: {
              status: 'cancelled',
              update_at: new Date()
            }
          });
        }
      });

      console.log('Webhook processed successfully for payment:', payment.payment_id);
      
      return { 
        processed: true, 
        statusChanged, 
        paymentId: payment.payment_id,
        chargeId,
        previousStatus: payment.status,
        newStatus
      };
      
    } catch (error) {
      console.error('Webhook processing failed:', error);
      throw error;
    }
  }

  // Refresh payment status from Omise API
  async refreshPaymentFromOmise(paymentId) {
    try {
      console.log('Refreshing payment from Omise:', paymentId);
      
      const payment = await prisma.payment.findUnique({
        where: { payment_id: paymentId },
        include: {
          plan: true,
          member: true
        }
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (!payment.omise_charge_id) {
        throw new Error('No charge ID associated with this payment');
      }

      // Get latest status from Omise
      const omiseCharge = await omise.charges.retrieve(payment.omise_charge_id);
      console.log('Retrieved charge from Omise:', {
        id: omiseCharge.id,
        status: omiseCharge.status,
        paid: omiseCharge.paid
      });

      const newStatus = this.mapOmiseStatusToLocal(omiseCharge.status);
      const statusChanged = payment.status !== newStatus;

      if (statusChanged) {
        console.log('Payment status changed:', payment.status, '->', newStatus);
        
        // Update payment in transaction
        const updatedPayment = await prisma.$transaction(async (tx) => {
          const updated = await tx.payment.update({
            where: { payment_id: paymentId },
            data: {
              status: newStatus,
              omise_response: omiseCharge,
              update_at: new Date()
            }
          });

          // Handle subscription creation/updates
          if (omiseCharge.status === 'successful') {
            const existingSubscription = await tx.subscription.findFirst({
              where: { payment_id: paymentId }
            });

            if (!existingSubscription) {
              await this.createSubscriptionFromPayment(paymentId, tx);
            }
          }

          return updated;
        });

        return updatedPayment;
      } else {
        console.log('Payment status unchanged:', newStatus);
        
        // Update last checked timestamp
        const updatedPayment = await prisma.payment.update({
          where: { payment_id: paymentId },
          data: {
            omise_response: omiseCharge,
            update_at: new Date()
          }
        });

        return updatedPayment;
      }

    } catch (error) {
      console.error('Failed to refresh payment from Omise:', error);
      throw error;
    }
  }

  // Polling with Omise integration
  async pollPaymentStatusEnhanced(paymentId, maxAttempts = 60) {
    let attempts = 0;
    const pollInterval = 3000; // 3 seconds

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          attempts++;
          console.log(`Enhanced polling attempt ${attempts}/${maxAttempts} for payment: ${paymentId}`);

          // Get payment from database
          const payment = await this.getPaymentStatus(paymentId);
          
          // Every 5th attempt, also check with Omise API for the latest status
          if (payment.omise_charge_id && (attempts % 5 === 0 || attempts === 1)) {
            try {
              console.log('Checking with Omise API on attempt:', attempts);
              await this.refreshPaymentFromOmise(paymentId);
              // Get updated payment after refresh
              const refreshedPayment = await this.getPaymentStatus(paymentId);
              
              if (refreshedPayment.status !== payment.status) {
                console.log('Status updated from Omise:', payment.status, '->', refreshedPayment.status);
                
                // If successful, resolve immediately
                if (refreshedPayment.status === 'successful') {
                  return resolve({
                    id: refreshedPayment.payment_id,
                    status: refreshedPayment.status,
                    amount: parseFloat(refreshedPayment.amount.toString()),
                    currency: refreshedPayment.currency,
                    paymentMethod: refreshedPayment.payment_method,
                    planName: refreshedPayment.plan?.name,
                    organization: refreshedPayment.plan?.owner?.org_name,
                    attempts,
                    lastChecked: new Date().toISOString()
                  });
                }
                
                // If failed or expired, reject
                if (refreshedPayment.status === 'failed' || refreshedPayment.status === 'expired') {
                  return reject(new Error(`Payment ${refreshedPayment.status}`));
                }
              }
            } catch (omiseError) {
              console.warn('Failed to check Omise API on attempt', attempts, ':', omiseError.message);
            }
          }
          
          // Check current status
          if (payment.status === 'successful') {
            console.log('Payment successful, stopping polling');
            resolve({
              id: payment.payment_id,
              status: payment.status,
              amount: parseFloat(payment.amount.toString()),
              currency: payment.currency,
              paymentMethod: payment.payment_method,
              planName: payment.plan?.name,
              organization: payment.plan?.owner?.org_name,
              attempts,
              lastChecked: new Date().toISOString()
            });
          } else if (payment.status === 'failed' || payment.status === 'expired') {
            console.log(`Payment ${payment.status}, stopping polling`);
            reject(new Error(`Payment ${payment.status}`));
          } else if (attempts >= maxAttempts) {
            console.log('Polling timeout reached');
            reject(new Error('Payment verification timeout. Please check your payment status manually.'));
          } else {
            console.log(`Payment still ${payment.status}, continuing to poll... (${attempts}/${maxAttempts})`);
            setTimeout(poll, pollInterval);
          }
        } catch (error) {
          console.error(`Enhanced polling attempt ${attempts} failed:`, error);

          if (attempts >= maxAttempts) {
            reject(error);
          } else {
            // Retry after interval on error
            setTimeout(poll, pollInterval);
          }
        }
      };

      // Start polling immediately
      poll();
    });
  }

  // Create subscription after successful payment
  async createSubscriptionFromPayment(paymentId, tx = null) {
    const prismaClient = tx || prisma;
    
    try {
      const payment = await prismaClient.payment.findUnique({
        where: { payment_id: paymentId },
        include: {
          plan: true,
          member: true
        }
      });

      if (!payment || payment.status !== 'successful') {
        throw new Error('Payment not found or not successful');
      }

      // Check if subscription already exists
      const existingSubscription = await prismaClient.subscription.findFirst({
        where: { payment_id: paymentId }
      });

      if (existingSubscription) {
        console.log('Subscription already exists:', existingSubscription.subscription_id);
        return existingSubscription;
      }

      // Calculate subscription dates
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + payment.plan.duration);

      // Create subscription
      const subscription = await prismaClient.subscription.create({
        data: {
          subscription_id: uuidv4(),
          member_id: payment.member_id,
          plan_id: payment.plan_id,
          payment_id: paymentId,
          status: 'active',
          start_date: startDate,
          end_date: endDate,
        }
      });

      console.log('Subscription created successfully:', {
        subscriptionId: subscription.subscription_id,
        paymentId: paymentId,
        planName: payment.plan.name,
        memberName: payment.member.full_name,
        duration: payment.plan.duration,
        endDate: endDate.toISOString()
      });

      return subscription;
    } catch (error) {
      console.error('Failed to create subscription from payment:', error);
      throw error;
    }
  }

  // Map Omise status to local status
  mapOmiseStatusToLocal(omiseStatus) {
    const statusMap = {
      'pending': 'pending',
      'successful': 'successful',
      'failed': 'failed',
      'expired': 'expired',
      'reversed': 'refunded',
      'voided': 'failed',
      'completed': 'successful'
    };
    return statusMap[omiseStatus] || 'pending';
  }

  // Get payment status
  async getPaymentStatus(paymentId) {
    try {
      const payment = await prisma.payment.findUnique({
        where: { payment_id: paymentId },
        include: {
          plan: {
            select: {
              name: true,
              price: true,
              owner: {
                select: {
                  org_name: true
                }
              }
            }
          },
          member: {
            select: {
              email: true,
              full_name: true
            }
          },
          subscription: {
            select: {
              subscription_id: true,
              status: true,
              start_date: true,
              end_date: true
            }
          }
        }
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      return payment;
    } catch (error) {
      console.error('Failed to get payment status:', error);
      throw error;
    }
  }

  // Member payment history
  async getMemberPaymentHistory(memberId) {
    try {
      const payments = await prisma.payment.findMany({
        where: { member_id: memberId },
        include: {
          plan: {
            select: {
              name: true,
              price: true,
              duration: true,
              owner: {
                select: {
                  org_name: true
                }
              }
            }
          },
          subscription: {
            select: {
              subscription_id: true,
              status: true,
              start_date: true,
              end_date: true
            }
          }
        },
        orderBy: {
          create_at: 'desc'
        }
      });

      return payments.map(payment => ({
        id: payment.payment_id,
        planName: payment.plan.name,
        organization: payment.plan.owner.org_name,
        amount: parseFloat(payment.amount.toString()),
        currency: payment.currency,
        paymentMethod: payment.payment_method,
        status: payment.status,
        description: payment.description,
        subscription: payment.subscription ? {
          id: payment.subscription.subscription_id,
          status: payment.subscription.status,
          startDate: payment.subscription.start_date,
          endDate: payment.subscription.end_date
        } : null,
        createdAt: payment.create_at,
        updatedAt: payment.update_at,
        omiseChargeId: payment.omise_charge_id,
        canRefresh: payment.status === 'pending' && !!payment.omise_charge_id,
        metadata: payment.metadata
      }));
    } catch (error) {
      console.error('Failed to get payment history:', error);
      throw error;
    }
  }

  // Payment status polling
  async pollPaymentStatus(paymentId, maxAttempts = 60) {
    return this.pollPaymentStatusEnhanced(paymentId, maxAttempts);
  }

  // Validate payment data
  validatePaymentData(paymentData) {
    const { memberId, planId, paymentMethod, paymentSource } = paymentData;

    if (!memberId || typeof memberId !== 'string') {
      throw new Error('Valid member ID is required');
    }

    if (!planId || typeof planId !== 'string') {
      throw new Error('Valid plan ID is required');
    }

    if (!paymentMethod || !['card', 'promptpay'].includes(paymentMethod)) {
      throw new Error('Payment method must be either "card" or "promptpay"');
    }

    if (paymentMethod === 'card' && !paymentSource) {
      throw new Error('Payment source token is required for card payments');
    }

    if (paymentMethod === 'card' && paymentSource && !paymentSource.startsWith('tokn_')) {
      throw new Error('Invalid payment token format');
    }

    return true;
  }

  // Get charge from Omise API with error handling
  async getChargeFromOmise(chargeId) {
    try {
      const charge = await omise.charges.retrieve(chargeId);
      return charge;
    } catch (error) {
      console.error('Failed to retrieve charge from Omise:', error);
      throw error;
    }
  }

  // Get payment statistics for monitoring
  async getPaymentStatistics(memberId = null) {
    try {
      const whereClause = memberId ? { member_id: memberId } : {};
      
      const stats = await prisma.payment.groupBy({
        by: ['status', 'payment_method'],
        where: whereClause,
        _count: {
          payment_id: true
        },
        _sum: {
          amount: true
        }
      });

      const totalPayments = await prisma.payment.count({ where: whereClause });
      const totalAmount = await prisma.payment.aggregate({
        where: { ...whereClause, status: 'successful' },
        _sum: { amount: true }
      });

      return {
        totalPayments,
        totalSuccessfulAmount: parseFloat(totalAmount._sum.amount?.toString() || '0'),
        breakdown: stats.map(stat => ({
          status: stat.status,
          paymentMethod: stat.payment_method,
          count: stat._count.payment_id,
          totalAmount: parseFloat(stat._sum.amount?.toString() || '0')
        }))
      };
    } catch (error) {
      console.error('Failed to get payment statistics:', error);
      throw error;
    }
  }

  // Cleanup old webhook cache entries
  cleanupWebhookCache() {
    const now = Date.now();
    for (const [key, timestamp] of this.recentWebhooks.entries()) {
      if (now - timestamp > this.webhookCacheTimeout) {
        this.recentWebhooks.delete(key);
      }
    }
  }

  // Get webhook processing status
  getWebhookCacheStatus() {
    this.cleanupWebhookCache();
    return {
      cachedWebhooks: this.recentWebhooks.size,
      cacheTimeout: this.webhookCacheTimeout,
      lastCleanup: new Date().toISOString()
    };
  }
}

module.exports = PaymentService;
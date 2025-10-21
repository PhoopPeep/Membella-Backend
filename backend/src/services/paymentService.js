const { omise } = require('../config/omise');
const { getPrismaClient } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const prisma = getPrismaClient();

class PaymentService {
  constructor() {
    this.recentWebhooks = new Map();
    this.webhookCacheTimeout = 300000; // 5 minutes
  }

  // Helper: Validate card charge amount
  validateCardAmount(amount) {
    const amountInSatang = Math.round(amount * 100);
    if (amountInSatang <= 0) {
      throw new Error('Invalid amount: must be greater than 0');
    }
    if (amountInSatang < 100) {
      throw new Error('Invalid amount: minimum payment is 1 THB');
    }
    return amountInSatang;
  }

  // Helper: Validate card token
  validateCardToken(token) {
    if (!token || typeof token !== 'string' || !token.startsWith('tokn_')) {
      throw new Error('Invalid card token provided');
    }
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

      const amountInSatang = this.validateCardAmount(amount);
      this.validateCardToken(token);

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

  // Helper: Validate PromptPay amount
  validatePromptPayAmount(amount) {
    const amountInSatang = Math.round(amount * 100);
    if (amountInSatang <= 0 || amountInSatang < 2000) {
      throw new Error('Invalid amount: minimum payment for PromptPay is 20 THB');
    }
    return amountInSatang;
  }

  // Helper: Extract QR code from charge source
  extractQRFromChargeSource(charge) {
    let qrCodeUrl = null;
    let expiresAt = null;
    let sourceId = null;

    if (charge.source) {
      sourceId = charge.source.id;
      console.log('Charge source details:', {
        id: charge.source.id,
        type: charge.source.type,
        has_scannable_code: !!charge.source.scannable_code,
        scannable_code_type: charge.source.scannable_code?.type
      });

      if (charge.source.scannable_code && charge.source.scannable_code.image) {
        qrCodeUrl = charge.source.scannable_code.image.download_uri;
        console.log('QR code found in charge source:', qrCodeUrl);
      }

      if (charge.source.expires_at) {
        expiresAt = charge.source.expires_at;
      }
    }

    return { qrCodeUrl, expiresAt, sourceId };
  }

  // Helper: Retrieve QR code from Omise source
  async retrieveQRFromSource(sourceId) {
    try {
      console.log('Retrieving source separately...');
      const source = await omise.sources.retrieve(sourceId);
      console.log('Retrieved source:', {
        id: source.id,
        type: source.type,
        has_scannable_code: !!source.scannable_code,
        scannable_code_type: source.scannable_code?.type
      });

      let qrCodeUrl = null;
      let expiresAt = null;

      if (source.scannable_code && source.scannable_code.image) {
        qrCodeUrl = source.scannable_code.image.download_uri;
        console.log('QR code found in retrieved source:', qrCodeUrl);
      }

      if (source.expires_at) {
        expiresAt = source.expires_at;
      }

      return { qrCodeUrl, expiresAt };
    } catch (retrieveError) {
      console.error('Failed to retrieve source:', retrieveError);
      return { qrCodeUrl: null, expiresAt: null };
    }
  }

  // Helper: Create fallback QR code
  createFallbackQRCode(amountInSatang, chargeId, sourceId) {
    try {
      console.warn('Creating fallback QR code');
      const qrData = {
        type: 'promptpay',
        amount: amountInSatang,
        currency: 'THB',
        charge_id: chargeId,
        source_id: sourceId
      };
      
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(JSON.stringify(qrData))}`;
      console.log('Fallback QR code created:', qrCodeUrl);
      return qrCodeUrl;
    } catch (fallbackError) {
      console.error('Failed to create fallback QR code:', fallbackError);
      return null;
    }
  }

  // Helper: Process QR code for PromptPay
  async processPromptPayQRCode(charge, amountInSatang) {
    let { qrCodeUrl, expiresAt, sourceId } = this.extractQRFromChargeSource(charge);

    if (!qrCodeUrl && sourceId) {
      const retrieved = await this.retrieveQRFromSource(sourceId);
      qrCodeUrl = retrieved.qrCodeUrl;
      expiresAt = retrieved.expiresAt || expiresAt;
    }

    if (!qrCodeUrl) {
      qrCodeUrl = this.createFallbackQRCode(amountInSatang, charge.id, sourceId);
    }

    console.log('QR code URL generated:', qrCodeUrl ? 'Yes' : 'No');
    return { qrCodeUrl, expiresAt };
  }

  // Helper: Handle PromptPay errors
  handlePromptPayError(error) {
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

    if (error.message?.includes('amount')) {
      throw new Error('Invalid payment amount. PromptPay requires minimum 20 THB.');
    }
    
    if (error.message?.includes('currency')) {
      throw new Error('PromptPay only supports THB currency.');
    }

    if (error.message?.includes('type')) {
      throw new Error('PromptPay payment method is not available.');
    }

    throw new Error(`PromptPay payment failed: ${error.message}`);
  }

  // Create PromptPay payment
  async createPromptPayCharge(paymentData) {
    const { amount, description, customerId, metadata = {} } = paymentData;

    try {
      console.log('Creating PromptPay charge:', { amount, description });

      const amountInSatang = this.validatePromptPayAmount(amount);
      console.log('Amount in satang:', amountInSatang);

      // Create charge directly with PromptPay source
      const charge = await omise.charges.create({
        amount: amountInSatang,
        currency: 'THB',
        description: description || 'PromptPay Payment',
        source: {
          type: 'promptpay'
        },
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
        status: charge.status,
        amount: charge.amount,
        currency: charge.currency,
        has_source: !!charge.source,
        source_type: charge.source?.type
      });

      if (!charge || !charge.id) {
        throw new Error('Failed to create PromptPay charge');
      }

      // Process QR code
      const { qrCodeUrl, expiresAt } = await this.processPromptPayQRCode(charge, amountInSatang);

      return {
        charge,
        source: charge.source,
        qr_code_url: qrCodeUrl,
        expires_at: expiresAt
      };
    } catch (error) {
      this.handlePromptPayError(error);
    }
  }

  // Helper: Create charge based on payment method
  async createChargeForPayment(paymentMethod, paymentSource, amount, description, memberId, paymentRecordId, planId) {
    if (paymentMethod === 'promptpay') {
      return await this.createPromptPayCharge({
        amount,
        description,
        customerId: memberId,
        metadata: {
          payment_id: paymentRecordId,
          plan_id: planId,
          member_id: memberId
        }
      });
    } else if (paymentMethod === 'card') {
      if (!paymentSource) {
        throw new Error('Payment source token is required for card payments');
      }
      
      return await this.createCardCharge({
        amount,
        currency: 'THB',
        description,
        token: paymentSource,
        customerId: memberId,
        metadata: {
          payment_id: paymentRecordId,
          plan_id: planId,
          member_id: memberId
        },
        capture: true
      });
    } else {
      throw new Error('Unsupported payment method');
    }
  }

  // Helper: Update payment with charge result
  async updatePaymentWithCharge(tx, paymentRecordId, chargeResult, paymentMethod) {
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
      where: { payment_id: paymentRecordId },
      data: updateData
    });

    return updateData;
  }

  // Helper: Check if payment is successful
  isPaymentSuccessful(chargeResult, paymentMethod) {
    const finalStatus = chargeResult.charge?.status || chargeResult.status;
    if (paymentMethod === 'card') {
      return chargeResult.charge?.paid || (chargeResult.charge?.authorized && chargeResult.charge?.captured);
    }
    return finalStatus === 'successful';
  }

  // Helper: Build payment response
  buildPaymentResponse(paymentRecordId, chargeResult, amount, paymentMethod, isSuccessful) {
    const finalStatus = chargeResult.charge?.status || chargeResult.status;
    const response = {
      success: true,
      paymentId: paymentRecordId,
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

      const amount = Number.parseFloat(plan.price.toString());
      
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
            omise_charge_id: null, // Will be updated after charge creation
            omise_source_id: null, // Will be updated after source creation
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
          chargeResult = await this.createChargeForPayment(
            paymentMethod,
            paymentSource,
            amount,
            description,
            memberId,
            paymentRecord.payment_id,
            planId
          );

          await this.updatePaymentWithCharge(tx, paymentRecord.payment_id, chargeResult, paymentMethod);

          const isSuccessful = this.isPaymentSuccessful(chargeResult, paymentMethod);

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

          return this.buildPaymentResponse(paymentRecord.payment_id, chargeResult, amount, paymentMethod, isSuccessful);

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
  // Helper: Build payment status response
  buildPaymentStatusResponse(payment, attempts) {
    return {
      id: payment.payment_id,
      status: payment.status,
      amount: Number.parseFloat(payment.amount.toString()),
      currency: payment.currency,
      paymentMethod: payment.payment_method,
      planName: payment.plan?.name,
      organization: payment.plan?.owner?.org_name,
      attempts,
      lastChecked: new Date().toISOString()
    };
  }

  // Helper: Check payment with Omise API
  async checkPaymentWithOmise(paymentId, payment, attempts) {
    try {
      console.log('Checking with Omise API on attempt:', attempts);
      await this.refreshPaymentFromOmise(paymentId);
      const refreshedPayment = await this.getPaymentStatus(paymentId);
      
      if (refreshedPayment.status !== payment.status) {
        console.log('Status updated from Omise:', payment.status, '->', refreshedPayment.status);
        return refreshedPayment;
      }
      return null;
    } catch (omiseError) {
      console.warn('Failed to check Omise API on attempt', attempts, ':', omiseError.message);
      return null;
    }
  }

  // Helper: Check if payment is in final state
  isPaymentInFinalState(payment) {
    return payment.status === 'successful' || payment.status === 'failed' || payment.status === 'expired';
  }

  // Helper: Resolve successful payment
  resolveSuccessfulPayment(payment, attempts, resolve) {
    console.log('Payment successful, stopping polling');
    resolve(this.buildPaymentStatusResponse(payment, attempts));
  }

  // Helper: Reject failed payment
  rejectFailedPayment(payment, reject) {
    console.log(`Payment ${payment.status}, stopping polling`);
    reject(new Error(`Payment ${payment.status}`));
  }

  // Helper: Check payment status and decide action
  handlePaymentStatus(payment, attempts, maxAttempts, resolve, reject, pollInterval, poll) {
    if (payment.status === 'successful') {
      this.resolveSuccessfulPayment(payment, attempts, resolve);
      return true;
    }
    
    if (payment.status === 'failed' || payment.status === 'expired') {
      this.rejectFailedPayment(payment, reject);
      return true;
    }
    
    if (attempts >= maxAttempts) {
      console.log('Polling timeout reached');
      reject(new Error('Payment verification timeout. Please check your payment status manually.'));
      return true;
    }
    
    console.log(`Payment still ${payment.status}, continuing to poll... (${attempts}/${maxAttempts})`);
    setTimeout(poll, pollInterval);
    return false;
  }

  // Helper: Process Omise refresh check
  async processOmiseRefresh(paymentId, payment, attempts) {
    const refreshedPayment = await this.checkPaymentWithOmise(paymentId, payment, attempts);
    
    if (!refreshedPayment) {
      return { payment, shouldContinue: false, resolved: false };
    }

    if (refreshedPayment.status === 'successful') {
      return { payment: refreshedPayment, shouldContinue: false, resolved: true, response: this.buildPaymentStatusResponse(refreshedPayment, attempts) };
    }
    
    if (refreshedPayment.status === 'failed' || refreshedPayment.status === 'expired') {
      return { payment: refreshedPayment, shouldContinue: false, resolved: false, error: new Error(`Payment ${refreshedPayment.status}`) };
    }
    
    return { payment: refreshedPayment, shouldContinue: true, resolved: false };
  }

  async pollPaymentStatusEnhanced(paymentId, maxAttempts = 60) {
    let attempts = 0;
    const pollInterval = 3000; // 3 seconds

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          attempts++;
          console.log(`Enhanced polling attempt ${attempts}/${maxAttempts} for payment: ${paymentId}`);

          let payment = await this.getPaymentStatus(paymentId);
          
          // Every 5th attempt, check with Omise API
          if (payment.omise_charge_id && (attempts % 5 === 0 || attempts === 1)) {
            const result = await this.processOmiseRefresh(paymentId, payment, attempts);
            
            if (result.resolved) {
              return resolve(result.response);
            }
            
            if (result.error) {
              return reject(result.error);
            }
            
            if (result.shouldContinue) {
              payment = result.payment;
            }
          }
          
          // Check current status and decide action
          this.handlePaymentStatus(payment, attempts, maxAttempts, resolve, reject, pollInterval, poll);
          
        } catch (error) {
          console.error(`Enhanced polling attempt ${attempts} failed:`, error);

          if (attempts >= maxAttempts) {
            reject(error);
          } else {
            setTimeout(poll, pollInterval);
          }
        }
      };

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
        amount: Number.parseFloat(payment.amount.toString()),
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
        totalSuccessfulAmount: Number.parseFloat(totalAmount._sum.amount?.toString() || '0'),
        breakdown: stats.map(stat => ({
          status: stat.status,
          paymentMethod: stat.payment_method,
          count: stat._count.payment_id,
          totalAmount: Number.parseFloat(stat._sum.amount?.toString() || '0')
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
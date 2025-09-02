const { omise, OMISE_CONFIG } = require('../config/omise');
const { getPrismaClient } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const prisma = getPrismaClient();

class PaymentService {
  // Create a payment charge
  async createCharge(paymentData) {
    const { 
      amount, 
      currency = 'THB', 
      description, 
      source, 
      customerId, 
      metadata = {} 
    } = paymentData;

    try {
      console.log('Creating Omise charge:', { amount, currency, description });

      // Validate amount
      const amountInSatang = Math.round(amount * 100);
      if (amountInSatang <= 0) {
        throw new Error('Invalid amount: must be greater than 0');
      }

      const charge = await omise.charges.create({
        amount: amountInSatang,
        currency: currency.toUpperCase(),
        description,
        source,
        capture: true,
        metadata: {
          ...metadata,
          customer_id: customerId,
          created_by: 'membella_platform'
        },
      });

      console.log('Omise charge created:', {
        id: charge.id,
        amount: charge.amount,
        status: charge.status,
        paid: charge.paid
      });

      return charge;
    } catch (error) {
      console.error('Omise charge creation failed:', error);
      
      // Handle specific Omise errors
      if (error.code) {
        switch (error.code) {
          case 'invalid_card':
            throw new Error('Invalid card information. Please check your card details.');
          case 'insufficient_fund':
            throw new Error('Insufficient funds on your card.');
          case 'stolen_or_lost_card':
            throw new Error('This card has been reported as stolen or lost.');
          case 'expired_card':
            throw new Error('This card has expired.');
          case 'processing_error':
            throw new Error('Payment processing error. Please try again.');
          default:
            throw new Error(`Payment failed: ${error.message}`);
        }
      }
      
      throw new Error(`Payment failed: ${error.message}`);
    }
  }

  // Create PromptPay payment
  async createPromptPayCharge(paymentData) {
    const { amount, description, customerId, metadata = {} } = paymentData;

    try {
      console.log('Creating PromptPay charge:', { amount, description });

      // Validate amount
      const amountInSatang = Math.round(amount * 100);
      if (amountInSatang <= 0 || amountInSatang < 2000) { // Minimum 20 THB for PromptPay
        throw new Error('Invalid amount: must be at least 20 THB');
      }

      console.log('Amount in satang:', amountInSatang);

      // Create PromptPay source first using SECRET KEY
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

      // Check if source creation was successful
      if (!source || !source.id) {
        throw new Error('Failed to create PromptPay source');
      }

      // Wait a moment for source to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create charge with the source
      const charge = await omise.charges.create({
        amount: amountInSatang,
        currency: 'THB',
        description: description || 'PromptPay Payment',
        source: source.id,
        capture: false, // PromptPay is always manual capture
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

      // Get QR code - it should be in the source object
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
        // Try to retrieve the source again
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
      
      // Log detailed error information
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

      // More specific error handling for PromptPay
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

  // Process subscription payment
  async processSubscriptionPayment({
    memberId,
    planId,
    paymentMethod,
    paymentSource,
    customerData
  }) {
    try {
      console.log('Processing subscription payment:', { memberId, planId, paymentMethod });

      // Get plan details with owner info
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

      // Get member details
      const member = await prisma.member.findUnique({
        where: { member_id: memberId }
      });

      if (!member) {
        throw new Error('Member not found');
      }

      // Check for existing active subscription
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
      
      // Validate minimum amount for PromptPay
      if (paymentMethod === 'promptpay' && amount < 20) {
        throw new Error('PromptPay requires minimum payment of 20 THB');
      }

      const description = `Subscription: ${plan.name} - ${plan.owner.org_name}`;

      // Start transaction
      return await prisma.$transaction(async (tx) => {
        // Create payment record first
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
              customer_data: customerData || {}
            }
          }
        });

        let chargeResult;

        try {
          // Create charge based on payment method
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
            
            chargeResult = await this.createCharge({
              amount,
              currency: 'THB',
              description,
              source: paymentSource,
              customerId: memberId,
              metadata: {
                payment_id: paymentRecord.payment_id,
                plan_id: planId,
                member_id: memberId
              }
            });
          } else {
            throw new Error('Unsupported payment method');
          }

          // Update payment record with charge info
          const updateData = {
            omise_charge_id: chargeResult.charge?.id || chargeResult.id,
            status: this.mapOmiseStatusToLocal(chargeResult.charge?.status || chargeResult.status),
            omise_response: chargeResult.charge || chargeResult,
            update_at: new Date()
          };

          // Add source info for PromptPay
          if (paymentMethod === 'promptpay' && chargeResult.source) {
            updateData.omise_source_id = chargeResult.source.id;
          }

          await tx.payment.update({
            where: { payment_id: paymentRecord.payment_id },
            data: updateData
          });

          // If card payment is immediately successful, create subscription
          const finalStatus = chargeResult.charge?.status || chargeResult.status;
          if (finalStatus === 'successful') {
            await this.createSubscriptionFromPayment(paymentRecord.payment_id, tx);
          }

          console.log('Subscription payment processed:', paymentRecord.payment_id);

          const response = {
            success: true,
            paymentId: paymentRecord.payment_id,
            chargeId: chargeResult.charge?.id || chargeResult.id,
            amount,
            currency: 'THB',
            status: finalStatus
          };

          // Add PromptPay specific data
          if (paymentMethod === 'promptpay') {
            response.qr_code_url = chargeResult.qr_code_url;
            response.expires_at = chargeResult.expires_at;
          }

          return response;

        } catch (chargeError) {
          console.error('Charge creation error:', chargeError);
          
          // Update payment record with error status
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

  // Handle webhook events
  async handleWebhook(event) {
    try {
      console.log('Processing webhook event:', event.key);

      const { data: charge } = event;
      const paymentId = charge.metadata?.payment_id;

      if (!paymentId) {
        console.warn('No payment_id found in webhook metadata');
        return;
      }

      // Find payment record
      const payment = await prisma.payment.findUnique({
        where: { payment_id: paymentId },
        include: {
          plan: true,
          member: true
        }
      });

      if (!payment) {
        console.error('Payment not found for webhook:', paymentId);
        return;
      }

      const newStatus = this.mapOmiseStatusToLocal(charge.status);
      
      // Update payment record in transaction
      await prisma.$transaction(async (tx) => {
        // Update payment status
        await tx.payment.update({
          where: { payment_id: paymentId },
          data: {
            status: newStatus,
            omise_response: charge,
            update_at: new Date()
          }
        });

        // If payment is successful and no subscription exists, create one
        if (charge.status === 'successful') {
          const existingSubscription = await tx.subscription.findFirst({
            where: {
              payment_id: paymentId
            }
          });

          if (!existingSubscription) {
            await this.createSubscriptionFromPayment(paymentId, tx);
          }
        }
      });

      console.log('Webhook processed successfully for payment:', paymentId);
    } catch (error) {
      console.error('Webhook processing failed:', error);
      throw error;
    }
  }

  // Create subscription after successful payment with transaction support
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
        where: {
          payment_id: paymentId
        }
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

      console.log('Subscription created:', subscription.subscription_id);
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
      'voided': 'failed'
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

  // Get member's payment history
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
        updatedAt: payment.update_at
      }));
    } catch (error) {
      console.error('Failed to get payment history:', error);
      throw error;
    }
  }

  // Poll payment status for PromptPay payments
  async pollPaymentStatus(paymentId, maxAttempts = 60) {
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          attempts++;
          console.log(`Polling payment status attempt ${attempts}/${maxAttempts} for payment: ${paymentId}`);

          // Get payment from database first
          const payment = await this.getPaymentStatus(paymentId);
          
          // Also check with Omise API if we have charge ID
          if (payment.omise_charge_id && attempts % 5 === 0) { // Check every 5th attempt
            try {
              const omiseCharge = await omise.charges.retrieve(payment.omise_charge_id);
              console.log('Omise charge status:', omiseCharge.status);
              
              // Update local status if different
              if (this.mapOmiseStatusToLocal(omiseCharge.status) !== payment.status) {
                await prisma.payment.update({
                  where: { payment_id: paymentId },
                  data: {
                    status: this.mapOmiseStatusToLocal(omiseCharge.status),
                    omise_response: omiseCharge,
                    update_at: new Date()
                  }
                });
                // Refresh payment data
                const updatedPayment = await this.getPaymentStatus(paymentId);
                if (updatedPayment.status === 'successful') {
                  await this.createSubscriptionFromPayment(paymentId);
                }
                return poll(); // Check again immediately
              }
            } catch (omiseError) {
              console.warn('Failed to check Omise charge status:', omiseError.message);
            }
          }
          
          if (payment.status === 'successful') {
            console.log('Payment successful, stopping polling');
            resolve({
              id: payment.payment_id,
              status: payment.status,
              amount: parseFloat(payment.amount.toString()),
              currency: payment.currency,
              paymentMethod: payment.payment_method,
              planName: payment.plan.name,
              organization: payment.plan.owner.org_name
            });
          } else if (payment.status === 'failed' || payment.status === 'expired') {
            console.log(`Payment ${payment.status}, stopping polling`);
            reject(new Error(`Payment ${payment.status}`));
          } else if (attempts >= maxAttempts) {
            console.log('Polling timeout reached');
            reject(new Error('Payment verification timeout. Please check your payment status manually.'));
          } else {
            // Continue polling after 3 seconds for PromptPay
            console.log(`Payment still ${payment.status}, continuing to poll...`);
            setTimeout(poll, 3000);
          }
        } catch (error) {
          console.error(`Polling attempt ${attempts} failed:`, error);

          if (attempts >= maxAttempts) {
            reject(error);
          } else {
            // Retry after 3 seconds on error
            setTimeout(poll, 3000);
          }
        }
      };

      // Start polling immediately
      poll();
    });
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

    return true;
  }

  // Get charge from Omise API
  async getChargeFromOmise(chargeId) {
    try {
      const charge = await omise.charges.retrieve(chargeId);
      return charge;
    } catch (error) {
      console.error('Failed to retrieve charge from Omise:', error);
      throw error;
    }
  }
}

module.exports = PaymentService;
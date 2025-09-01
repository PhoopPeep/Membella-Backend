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

      const charge = await omise.charges.create({
        amount: amount * 100, // Convert to satang (smallest unit)
        currency,
        description,
        source,
        metadata: {
          ...metadata,
          customer_id: customerId
        },
      });

      console.log('Omise charge created:', charge.id);
      return charge;
    } catch (error) {
      console.error('Omise charge creation failed:', error);
      throw new Error(`Payment failed: ${error.message}`);
    }
  }

  // Create PromptPay payment
  async createPromptPayCharge(paymentData) {
    const { amount, description, customerId, metadata = {} } = paymentData;

    try {
      console.log('Creating PromptPay charge:', { amount, description });

      const source = await omise.sources.create({
        type: 'promptpay',
        amount: amount * 100, // Convert to satang
        currency: 'THB',
      });

      const charge = await omise.charges.create({
        amount: amount * 100,
        currency: 'THB',
        description,
        source: source.id,
        metadata: {
          ...metadata,
          customer_id: customerId,
          payment_method: 'promptpay'
        },
      });

      console.log('PromptPay charge created:', charge.id);
      return {
        charge,
        qr_code_url: source.scannable_code.image.download_uri,
        expires_at: source.expires_at
      };
    } catch (error) {
      console.error('PromptPay charge creation failed:', error);
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

      // Get plan details
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

      const amount = parseFloat(plan.price.toString());
      const description = `Subscription to ${plan.name} - ${plan.owner.org_name}`;

      // Create payment record first
      const paymentRecord = await prisma.payment.create({
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
            member_name: member.full_name
          }
        }
      });

      let chargeResult;

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
      } else {
        // Card payment
        chargeResult = await this.createCharge({
          amount,
          description,
          source: paymentSource,
          customerId: memberId,
          metadata: {
            payment_id: paymentRecord.payment_id,
            plan_id: planId,
            member_id: memberId
          }
        });
      }

      // Update payment record with Omise charge ID
      await prisma.payment.update({
        where: { payment_id: paymentRecord.payment_id },
        data: {
          omise_charge_id: chargeResult.charge?.id || chargeResult.id,
          omise_source_id: chargeResult.charge?.source?.id || chargeResult.source,
          updated_at: new Date()
        }
      });

      console.log('Subscription payment processed:', paymentRecord.payment_id);

      return {
        success: true,
        paymentId: paymentRecord.payment_id,
        chargeId: chargeResult.charge?.id || chargeResult.id,
        amount,
        currency: 'THB',
        status: chargeResult.charge?.status || chargeResult.status,
        ...(paymentMethod === 'promptpay' && {
          qr_code_url: chargeResult.qr_code_url,
          expires_at: chargeResult.expires_at
        })
      };
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

      // Update payment record
      await prisma.payment.update({
        where: { payment_id: paymentId },
        data: {
          status: this.mapOmiseStatusToLocal(charge.status),
          omise_response: charge,
          updated_at: new Date()
        }
      });

      // If payment is successful, create subscription
      if (charge.status === 'successful') {
        await this.createSubscriptionFromPayment(paymentId);
      }

      console.log('Webhook processed successfully for payment:', paymentId);
    } catch (error) {
      console.error('Webhook processing failed:', error);
      throw error;
    }
  }

  // Create subscription after successful payment
  async createSubscriptionFromPayment(paymentId) {
    try {
      const payment = await prisma.payment.findUnique({
        where: { payment_id: paymentId },
        include: {
          plan: true
        }
      });

      if (!payment || payment.status !== 'successful') {
        throw new Error('Payment not found or not successful');
      }

      // Check if subscription already exists
      const existingSubscription = await prisma.subscription.findFirst({
        where: {
          member_id: payment.member_id,
          plan_id: payment.plan_id,
          status: 'active'
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
      const subscription = await prisma.subscription.create({
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
      'reversed': 'refunded'
    };
    return statusMap[omiseStatus] || 'unknown';
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
        createdAt: payment.create_at,
        updatedAt: payment.updated_at
      }));
    } catch (error) {
      console.error('Failed to get payment history:', error);
      throw error;
    }
  }
}

module.exports = PaymentService;
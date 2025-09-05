const { asyncHandler } = require('../utils/errorHandler');
const { getPrismaClient } = require('../config/database');

class WebhookController {
  constructor() {
    this.prisma = getPrismaClient();
  }

  // Handle user created webhook from Supabase
  handleUserCreated = asyncHandler(async (req, res) => {
    try {
      console.log('Webhook: User created event received');
      console.log('Webhook payload:', JSON.stringify(req.body, null, 2));

      const { type, table, record, old_record, schema, event } = req.body;

      // Verify webhook signature (optional but recommended)
      const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
      if (webhookSecret) {
        const signature = req.headers['x-supabase-signature'];
        if (!signature) {
          return res.status(401).json({ error: 'Missing webhook signature' });
        }
        // Add signature verification logic here
      }

      // Handle user creation event
      if (type === 'INSERT' && table === 'users') {
        const user = record;
        console.log('New user created:', user.id, user.email);

        // Check if this is an owner or member based on email domain or other criteria
        // For now, we'll assume all users are owners unless specified otherwise
        const isOwner = true; // You can add logic here to determine user type

        if (isOwner) {
          // Create owner record in database
          try {
            const newOwner = await this.prisma.owner.create({
              data: {
                owner_id: user.id,
                org_name: user.raw_user_meta_data?.org_name || 'Default Organization',
                email: user.email,
                password: '', // Password is handled by Supabase
                description: user.raw_user_meta_data?.description || null,
                contact_info: user.raw_user_meta_data?.contact_info || null,
                logo: user.raw_user_meta_data?.logo || null,
                create_at: new Date(),
                update_at: new Date()
              }
            });
            console.log('Owner record created:', newOwner.owner_id);
          } catch (dbError) {
            console.error('Error creating owner record:', dbError);
            // Don't fail the webhook, just log the error
          }
        } else {
          // Create member record in database
          try {
            const newMember = await this.prisma.member.create({
              data: {
                member_id: user.id,
                full_name: user.raw_user_meta_data?.full_name || 'Unknown',
                email: user.email,
                password: '', // Password is handled by Supabase
                phone: user.raw_user_meta_data?.phone || null,
                role: user.raw_user_meta_data?.role || 'member',
                create_at: new Date(),
                update_at: new Date()
              }
            });
            console.log('Member record created:', newMember.member_id);
          } catch (dbError) {
            console.error('Error creating member record:', dbError);
            // Don't fail the webhook, just log the error
          }
        }
      }

      res.status(200).json({ success: true, message: 'Webhook processed successfully' });

    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Handle auth events webhook from Supabase
  handleAuthEvent = asyncHandler(async (req, res) => {
    try {
      console.log('Webhook: Auth event received');
      console.log('Auth webhook payload:', JSON.stringify(req.body, null, 2));

      const { type, user, email } = req.body;

      // Handle different auth events
      switch (type) {
        case 'user.created':
          console.log('User created via auth webhook:', user?.id, user?.email);
          // User creation is handled by database webhook
          break;

        case 'user.updated':
          console.log('User updated via auth webhook:', user?.id, user?.email);
          // Handle user updates if needed
          break;

        case 'user.deleted':
          console.log('User deleted via auth webhook:', user?.id, user?.email);
          // Handle user deletion if needed
          break;

        case 'user.signed_in':
          console.log('User signed in:', user?.id, user?.email);
          // Handle sign in events if needed
          break;

        case 'user.signed_out':
          console.log('User signed out:', user?.id, user?.email);
          // Handle sign out events if needed
          break;

        default:
          console.log('Unknown auth event type:', type);
      }

      res.status(200).json({ success: true, message: 'Auth webhook processed successfully' });

    } catch (error) {
      console.error('Auth webhook processing error:', error);
      res.status(500).json({ error: 'Auth webhook processing failed' });
    }
  });

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

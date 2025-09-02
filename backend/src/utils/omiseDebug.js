const { omise } = require('../config/omise');

class OmiseDebugger {
  static async testConnection() {
    console.log('Testing Omise Connection...');
    
    try {
      // Test basic connection
      const account = await omise.account.retrieve();
      console.log('Account retrieved:', {
        id: account.id,
        email: account.email,
        currency: account.currency
      });

      // Test capabilities
      const capabilities = await omise.capability.retrieve();
      console.log('Capabilities retrieved');
      
      // Check PromptPay support
      const promptpaySupported = capabilities.payment_methods.some(method => 
        method.name === 'promptpay' && method.currencies.includes('THB')
      );
      
      console.log('Payment methods supported:');
      capabilities.payment_methods.forEach(method => {
        const supported = method.currencies.includes('THB') ? '✅' : '❌';
        console.log(`   ${supported} ${method.name} (${method.currencies.join(', ')})`);
      });
      
      return { success: true, promptpaySupported };
      
    } catch (error) {
      console.error('Connection test failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  static async testPromptPaySource(amount = 5000) {
    console.log('Testing PromptPay Source Creation...');
    console.log('Amount (satang):', amount);
    
    try {
      const source = await omise.sources.create({
        type: 'promptpay',
        amount: amount,
        currency: 'THB'
      });
      
      console.log('PromptPay source created:', {
        id: source.id,
        type: source.type,
        amount: source.amount,
        currency: source.currency,
        flow: source.flow,
        has_qr_code: !!source.scannable_code?.image?.download_uri
      });
      
      if (source.scannable_code?.image?.download_uri) {
        console.log('QR Code URL:', source.scannable_code.image.download_uri);
      } else {
        console.log('No QR code found in source');
      }
      
      return { success: true, source };
      
    } catch (error) {
      console.error('PromptPay source creation failed:', error.message);
      if (error.response) {
        console.error('API Response:', error.response.data);
      }
      return { success: false, error: error.message };
    }
  }

  static async testPromptPayCharge(amount = 5000) {
    console.log('Testing Full PromptPay Flow...');
    
    try {
      // Step 1: Create source
      console.log('Step 1: Creating PromptPay source...');
      const source = await omise.sources.create({
        type: 'promptpay',
        amount: amount,
        currency: 'THB'
      });
      
      console.log('Source created:', source.id);
      
      // Step 2: Create charge
      console.log('Step 2: Creating charge with source...');
      const charge = await omise.charges.create({
        amount: amount,
        currency: 'THB',
        source: source.id,
        description: 'Test PromptPay Payment'
      });
      
      console.log('Charge created:', {
        id: charge.id,
        amount: charge.amount,
        status: charge.status,
        authorized: charge.authorized,
        paid: charge.paid
      });
      
      // Check for QR code
      const qrCodeUrl = source.scannable_code?.image?.download_uri || 
                       charge.source?.scannable_code?.image?.download_uri;
      
      if (qrCodeUrl) {
        console.log('QR Code available:', qrCodeUrl);
      } else {
        console.log('No QR code found');
      }
      
      return { 
        success: true, 
        source, 
        charge, 
        qr_code_url: qrCodeUrl 
      };
      
    } catch (error) {
      console.error('PromptPay charge creation failed:', error.message);
      if (error.response) {
        console.error('API Response:', JSON.stringify(error.response.data, null, 2));
      }
      return { success: false, error: error.message };
    }
  }

  static async listRecentCharges(limit = 5) {
    console.log('Listing Recent Charges...');
    
    try {
      const charges = await omise.charges.list({ limit });
      
      console.log(`Found ${charges.data.length} recent charges:`);
      
      charges.data.forEach((charge, index) => {
        console.log(`   ${index + 1}. ${charge.id}`);
        console.log(`      Amount: ${charge.amount} ${charge.currency}`);
        console.log(`      Status: ${charge.status}`);
        console.log(`      Method: ${charge.source?.type || charge.card?.brand || 'card'}`);
        console.log(`      Created: ${charge.created_at}`);
        console.log('');
      });
      
      return { success: true, charges: charges.data };
      
    } catch (error) {
      console.error('Failed to list charges:', error.message);
      return { success: false, error: error.message };
    }
  }

  static async getChargeStatus(chargeId) {
    console.log('Getting Charge Status:', chargeId);
    
    try {
      const charge = await omise.charges.retrieve(chargeId);
      
      console.log('Charge status:', {
        id: charge.id,
        status: charge.status,
        amount: charge.amount,
        currency: charge.currency,
        authorized: charge.authorized,
        paid: charge.paid,
        refunded: charge.refunded_amount > 0,
        failure_code: charge.failure_code,
        failure_message: charge.failure_message
      });
      
      return { success: true, charge };
      
    } catch (error) {
      console.error('Failed to get charge status:', error.message);
      return { success: false, error: error.message };
    }
  }

  static async runFullDiagnostics() {
    console.log('Running Full Omise Diagnostics...');
    console.log('='.repeat(50));
    
    const results = {
      connection: null,
      promptpaySource: null,
      promptpayCharge: null,
      recentCharges: null
    };
    
    // Test connection
    results.connection = await this.testConnection();
    console.log('');
    
    if (!results.connection.success) {
      console.log('Connection failed - skipping other tests');
      return results;
    }
    
    // Test PromptPay source creation
    results.promptpaySource = await this.testPromptPaySource(5000);
    console.log('');
    
    // Test full PromptPay charge
    results.promptpayCharge = await this.testPromptPayCharge(10000);
    console.log('');
    
    // List recent charges
    results.recentCharges = await this.listRecentCharges(3);
    
    console.log('='.repeat(50));
    console.log('Diagnostics Complete');
    
    const allPassed = Object.values(results).every(result => result?.success);
    console.log(allPassed ? 'All tests passed!' : 'Some tests failed');
    
    return results;
  }
}

// CLI usage
if (require.main === module) {
  // Run diagnostics if called directly
  require('dotenv').config();
  
  console.log('Omise Diagnostics Tool');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Omise Mode:', process.env.OMISE_SECRET_KEY?.includes('test') ? 'Test' : 'Live');
  console.log('');
  
  OmiseDebugger.runFullDiagnostics()
    .then(() => {
      console.log('\nDiagnostics completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nDiagnostics failed:', error);
      process.exit(1);
    });
}

module.exports = OmiseDebugger;
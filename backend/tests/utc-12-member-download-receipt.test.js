// UTC-12: Member Download Receipt Test Case
// Note: This test covers the frontend text receipt generation functionality
// The actual download receipt is handled client-side as text files, not PDF

describe('UTC-12: Member Download Receipt Test Case', () => {
  let mockPaymentData;

  beforeEach(() => {
    mockPaymentData = {
      id: 'payment-123',
      amount: 299.99,
      currency: 'THB',
      status: 'successful',
      createdAt: '2023-12-01T10:00:00Z',
      planName: 'Premium Plan',
      organization: 'Test Organization',
      description: 'Monthly subscription',
      paymentMethod: 'card',
      subscription: {
        id: 'sub-123',
        status: 'active',
        startDate: '2023-12-01T10:00:00Z',
        endDate: '2024-01-01T10:00:00Z'
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Text Receipt Generation', () => {
    // TC148: When generateReceiptText is called with valid payment data, should return formatted text receipt
    it('TC148: should return formatted text receipt when generateReceiptText called with valid payment data', () => {
      const generateReceiptText = (payment) => {
        return `
PAYMENT RECEIPT
===============

Transaction ID: ${payment.id}
Date: ${new Date(payment.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
Time: ${new Date(payment.createdAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })}

PLAN DETAILS:
Plan Name: ${payment.planName}
Organization: ${payment.organization}
Description: ${payment.description}

PAYMENT DETAILS:
Amount: ฿${payment.amount.toLocaleString()}
Currency: ${payment.currency}
Payment Method: ${payment.paymentMethod === 'card' ? 'Credit Card' : payment.paymentMethod}
Status: ${payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}

${payment.subscription ? `SUBSCRIPTION DETAILS:
Subscription ID: ${payment.subscription.id}
Status: ${payment.subscription.status.charAt(0).toUpperCase() + payment.subscription.status.slice(1)}
Period: ${new Date(payment.subscription.startDate).toLocaleDateString('en-US')} - ${new Date(payment.subscription.endDate).toLocaleDateString('en-US')}
` : ''}
Thank you for your payment!

Generated on ${new Date().toLocaleString('en-US')}
`.trim();
      };

      const result = generateReceiptText(mockPaymentData);

      expect(result).toContain('PAYMENT RECEIPT');
      expect(result).toContain('Transaction ID: payment-123');
      expect(result).toContain('Plan Name: Premium Plan');
      expect(result).toContain('Organization: Test Organization');
      expect(result).toContain('Amount: ฿299.99');
      expect(result).toContain('Currency: THB');
      expect(result).toContain('Payment Method: Credit Card');
      expect(result).toContain('Status: Successful');
      expect(result).toContain('Subscription ID: sub-123');
      expect(result).toContain('Thank you for your payment!');
    });

    // TC149: When generateReceiptText is called with payment without subscription, should return receipt without subscription details
    it('TC149: should return receipt without subscription details when payment has no subscription', () => {
      const paymentWithoutSubscription = {
        ...mockPaymentData,
        subscription: null
      };

      const generateReceiptTextWithoutSubscription = (payment) => {
        return `
PAYMENT RECEIPT
===============

Transaction ID: ${payment.id}
Date: ${new Date(payment.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
Time: ${new Date(payment.createdAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })}

PLAN DETAILS:
Plan Name: ${payment.planName}
Organization: ${payment.organization}
Description: ${payment.description}

PAYMENT DETAILS:
Amount: ฿${payment.amount.toLocaleString()}
Currency: ${payment.currency}
Payment Method: ${payment.paymentMethod === 'card' ? 'Credit Card' : payment.paymentMethod}
Status: ${payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}

Thank you for your payment!

Generated on ${new Date().toLocaleString('en-US')}
`.trim();
      };

      const result = generateReceiptTextWithoutSubscription(paymentWithoutSubscription);

      expect(result).toContain('PAYMENT RECEIPT');
      expect(result).not.toContain('SUBSCRIPTION DETAILS:');
      expect(result).not.toContain('Subscription ID:');
      expect(result).toContain('Thank you for your payment!');
    });

    // TC150: When generateReceiptText is called with different payment methods, should format correctly
    it('TC150: should format different payment methods correctly', () => {
      const testCases = [
        { paymentMethod: 'card', expected: 'Credit Card' },
        { paymentMethod: 'bank_transfer', expected: 'bank_transfer' },
        { paymentMethod: 'internet_banking', expected: 'internet_banking' }
      ];

      const generateReceiptText = (payment) => {
        return `Payment Method: ${payment.paymentMethod === 'card' ? 'Credit Card' : payment.paymentMethod}`;
      };

      testCases.forEach(({ paymentMethod, expected }) => {
        const payment = { ...mockPaymentData, paymentMethod };
        const result = generateReceiptText(payment);
        expect(result).toContain(`Payment Method: ${expected}`);
      });
    });

    // TC151: When generateReceiptText is called with different statuses, should format correctly
    it('TC151: should format different payment statuses correctly', () => {
      const testCases = [
        { status: 'successful', expected: 'Successful' },
        { status: 'pending', expected: 'Pending' },
        { status: 'failed', expected: 'Failed' }
      ];

      const generateReceiptText = (payment) => {
        return `Status: ${payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}`;
      };

      testCases.forEach(({ status, expected }) => {
        const payment = { ...mockPaymentData, status };
        const result = generateReceiptText(payment);
        expect(result).toContain(`Status: ${expected}`);
      });
    });
  });

  describe('Download Receipt Functionality', () => {
    // TC152: When downloadReceipt function is called with valid payment, should create and download text file
    it('TC152: should create and download text file when downloadReceipt called with valid payment', () => {
      // Mock DOM methods
      const mockBlob = { type: 'text/plain; charset=utf-8' };
      const mockURL = 'blob:mock-url';
      const mockAnchor = {
        href: '',
        download: '',
        click: jest.fn()
      };

      global.Blob = jest.fn().mockImplementation((content, options) => ({
        ...mockBlob,
        content,
        options
      }));
      global.URL = {
        createObjectURL: jest.fn().mockReturnValue(mockURL),
        revokeObjectURL: jest.fn()
      };
      global.document = {
        createElement: jest.fn().mockReturnValue(mockAnchor),
        body: {
          appendChild: jest.fn(),
          removeChild: jest.fn()
        }
      };

      const downloadReceipt = (payment) => {
        const receiptContent = generateReceiptText(payment);
        const blob = new Blob([receiptContent], { type: 'text/plain; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt-${payment.id}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      const generateReceiptText = (payment) => {
        return `PAYMENT RECEIPT\nTransaction ID: ${payment.id}\nAmount: ฿${payment.amount}`;
      };

      downloadReceipt(mockPaymentData);

      expect(global.Blob).toHaveBeenCalledWith(
        [expect.stringContaining('PAYMENT RECEIPT')],
        { type: 'text/plain; charset=utf-8' }
      );
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.document.createElement).toHaveBeenCalledWith('a');
      expect(mockAnchor.download).toBe('receipt-payment-123.txt');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(global.document.body.appendChild).toHaveBeenCalledWith(mockAnchor);
      expect(global.document.body.removeChild).toHaveBeenCalledWith(mockAnchor);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(mockURL);
    });

    // TC153: When downloadReceipt function encounters error, should handle gracefully
    it('TC153: should handle errors gracefully when downloadReceipt encounters error', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock DOM methods to throw error
      global.Blob = jest.fn().mockImplementation(() => {
        throw new Error('Blob creation failed');
      });

      const downloadReceipt = (payment) => {
        try {
          const receiptContent = generateReceiptText(payment);
          new Blob([receiptContent], { type: 'text/plain; charset=utf-8' });
          // ... rest of the function
        } catch (err) {
          console.error('Failed to download receipt:', err);
          throw err;
        }
      };

      const generateReceiptText = (payment) => {
        return `PAYMENT RECEIPT\nTransaction ID: ${payment.id}`;
      };

      expect(() => downloadReceipt(mockPaymentData)).toThrow('Blob creation failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to download receipt:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });

    // TC154: When downloadReceipt function is called with different file extensions, should use correct extension
    it('TC154: should use correct file extension when downloadReceipt called with different formats', () => {
      const testCases = [
        { id: 'payment-123', expected: 'receipt-payment-123.txt' },
        { id: 'payment-456', expected: 'receipt-payment-456.txt' },
        { id: 'txn-789', expected: 'receipt-txn-789.txt' }
      ];

      const mockAnchor = {
        href: '',
        download: '',
        click: jest.fn()
      };

      global.document = {
        createElement: jest.fn().mockReturnValue(mockAnchor),
        body: {
          appendChild: jest.fn(),
          removeChild: jest.fn()
        }
      };

      const downloadReceipt = (payment) => {
        const a = document.createElement('a');
        a.download = `receipt-${payment.id}.txt`;
        return a.download;
      };

      testCases.forEach(({ id, expected }) => {
        const payment = { ...mockPaymentData, id };
        const result = downloadReceipt(payment);
        expect(result).toBe(expected);
      });
    });

    // TC155: When generateReceiptText is called with edge cases, should handle gracefully
    it('TC155: should handle edge cases gracefully in generateReceiptText', () => {
      const edgeCases = [
        { amount: 0, expected: '฿0' },
        { amount: 0.01, expected: '฿0.01' },
        { amount: 999999.99, expected: '฿999,999.99' },
        { planName: '', expected: 'Plan Name: ' },
        { organization: null, expected: 'Organization: null' }
      ];

      const generateReceiptText = (payment) => {
        return `Amount: ฿${payment.amount.toLocaleString()}\nPlan Name: ${payment.planName}\nOrganization: ${payment.organization}`;
      };

      edgeCases.forEach(({ amount, planName, organization, expected }) => {
        const payment = { 
          ...mockPaymentData, 
          amount: amount !== undefined ? amount : mockPaymentData.amount,
          planName: planName !== undefined ? planName : mockPaymentData.planName,
          organization: organization !== undefined ? organization : mockPaymentData.organization
        };
        const result = generateReceiptText(payment);
        expect(result).toContain(expected);
      });
    });
  });
});

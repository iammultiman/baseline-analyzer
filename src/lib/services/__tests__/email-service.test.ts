import { EmailService } from '../email-service';

// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
}));

describe('EmailService', () => {
  let emailService: EmailService;
  const mockSend = require('@sendgrid/mail').send;

  beforeEach(() => {
    jest.clearAllMocks();
    emailService = EmailService.getInstance();
    
    // Set up environment variables for testing
    process.env.SENDGRID_API_KEY = 'test-api-key';
    process.env.SENDGRID_FROM_EMAIL = 'test@example.com';
    process.env.SENDGRID_FROM_NAME = 'Test App';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_FROM_EMAIL;
    delete process.env.SENDGRID_FROM_NAME;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  describe('sendInvitationEmail', () => {
    const mockInvitationData = {
      id: 'inv-123',
      email: 'user@example.com',
      token: 'test-token-123',
      organizationName: 'Test Organization',
      inviterName: 'John Doe',
      inviterEmail: 'john@example.com',
      role: 'MEMBER',
      expiresAt: new Date('2024-01-15'),
    };

    it('should send invitation email successfully', async () => {
      mockSend.mockResolvedValueOnce([{ statusCode: 202 }]);

      await emailService.sendInvitationEmail(mockInvitationData);

      expect(mockSend).toHaveBeenCalledWith({
        to: 'user@example.com',
        from: {
          email: 'test@example.com',
          name: 'Test App',
        },
        subject: "You're invited to join Test Organization on Baseline Analyzer",
        text: expect.stringContaining('John Doe (john@example.com) has invited you'),
        html: expect.stringContaining('John Doe'),
      });
    });

    it('should include accept URL in email content', async () => {
      mockSend.mockResolvedValueOnce([{ statusCode: 202 }]);

      await emailService.sendInvitationEmail(mockInvitationData);

      const call = mockSend.mock.calls[0][0];
      expect(call.text).toContain('http://localhost:3000/invitations/accept?token=test-token-123');
      expect(call.html).toContain('http://localhost:3000/invitations/accept?token=test-token-123');
    });

    it('should handle missing API key gracefully', async () => {
      delete process.env.SENDGRID_API_KEY;

      // Should not throw an error
      await expect(emailService.sendInvitationEmail(mockInvitationData)).resolves.toBeUndefined();
      
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should throw error when SendGrid fails', async () => {
      mockSend.mockRejectedValueOnce(new Error('SendGrid error'));

      await expect(emailService.sendInvitationEmail(mockInvitationData))
        .rejects.toThrow('Failed to send invitation email');
    });

    it('should include expiration date in email', async () => {
      mockSend.mockResolvedValueOnce([{ statusCode: 202 }]);

      await emailService.sendInvitationEmail(mockInvitationData);

      const call = mockSend.mock.calls[0][0];
      expect(call.text).toContain('1/15/2024');
      expect(call.html).toContain('1/15/2024');
    });

    it('should include organization and role information', async () => {
      mockSend.mockResolvedValueOnce([{ statusCode: 202 }]);

      await emailService.sendInvitationEmail(mockInvitationData);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('Test Organization');
      expect(call.html).toContain('MEMBER');
      expect(call.text).toContain('Test Organization');
      expect(call.text).toContain('member');
    });
  });

  describe('sendTestEmail', () => {
    it('should send test email successfully', async () => {
      mockSend.mockResolvedValueOnce([{ statusCode: 202 }]);

      await emailService.sendTestEmail('test@example.com');

      expect(mockSend).toHaveBeenCalledWith({
        to: 'test@example.com',
        from: {
          email: 'test@example.com',
          name: 'Test App',
        },
        subject: 'Baseline Analyzer - Email Configuration Test',
        text: 'This is a test email to verify your email configuration is working correctly.',
        html: expect.stringContaining('Email Configuration Test'),
      });
    });

    it('should throw error when API key is missing', async () => {
      delete process.env.SENDGRID_API_KEY;

      await expect(emailService.sendTestEmail('test@example.com'))
        .rejects.toThrow('SendGrid API key not configured');
    });

    it('should throw error when SendGrid fails', async () => {
      mockSend.mockRejectedValueOnce(new Error('SendGrid error'));

      await expect(emailService.sendTestEmail('test@example.com'))
        .rejects.toThrow('Failed to send test email');
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = EmailService.getInstance();
      const instance2 = EmailService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('email template generation', () => {
    it('should generate proper HTML template', async () => {
      mockSend.mockResolvedValueOnce([{ statusCode: 202 }]);

      const invitationData = {
        id: 'inv-123',
        email: 'user@example.com',
        token: 'test-token',
        organizationName: 'Test Org',
        inviterName: 'Jane Smith',
        inviterEmail: 'jane@example.com',
        role: 'ADMIN',
        expiresAt: new Date('2024-01-15'),
      };

      await emailService.sendInvitationEmail(invitationData);

      const call = mockSend.mock.calls[0][0];
      
      // Check HTML structure
      expect(call.html).toContain('<!DOCTYPE html>');
      expect(call.html).toContain('<title>Organization Invitation</title>');
      expect(call.html).toContain('class="cta-button"');
      
      // Check content
      expect(call.html).toContain('Jane Smith');
      expect(call.html).toContain('Test Org');
      expect(call.html).toContain('ADMIN');
    });

    it('should generate proper text template', async () => {
      mockSend.mockResolvedValueOnce([{ statusCode: 202 }]);

      const invitationData = {
        id: 'inv-123',
        email: 'user@example.com',
        token: 'test-token',
        organizationName: 'Test Org',
        inviterName: 'Jane Smith',
        inviterEmail: 'jane@example.com',
        role: 'VIEWER',
        expiresAt: new Date('2024-01-15'),
      };

      await emailService.sendInvitationEmail(invitationData);

      const call = mockSend.mock.calls[0][0];
      
      // Check text content
      expect(call.text).toContain('Jane Smith (jane@example.com) has invited you');
      expect(call.text).toContain('Test Org');
      expect(call.text).toContain('viewer');
      expect(call.text).toContain('To accept this invitation, click the link below:');
    });
  });
});
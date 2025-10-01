import { NextRequest } from 'next/server';
import { POST } from '../test/route';

// Mock the email service
jest.mock('@/lib/services/email-service', () => ({
  emailService: {
    sendTestEmail: jest.fn(),
  },
}));

// Mock auth middleware
jest.mock('@/lib/auth-middleware', () => ({
  withAuth: (handler: any) => handler,
}));

describe('/api/admin/email/test', () => {
  const mockEmailService = require('@/lib/services/email-service').emailService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('should send test email successfully', async () => {
      mockEmailService.sendTestEmail.mockResolvedValueOnce(undefined);

      const request = new NextRequest('http://localhost:3000/api/admin/email/test', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const user = { uid: 'user-123', email: 'admin@example.com' };
      const response = await POST(request, user);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Test email sent successfully');
      expect(mockEmailService.sendTestEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should return validation error for invalid email', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/email/test', {
        method: 'POST',
        body: JSON.stringify({ email: 'invalid-email' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const user = { uid: 'user-123', email: 'admin@example.com' };
      const response = await POST(request, user);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation error');
      expect(data.details).toBeDefined();
      expect(mockEmailService.sendTestEmail).not.toHaveBeenCalled();
    });

    it('should return validation error for missing email', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/email/test', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const user = { uid: 'user-123', email: 'admin@example.com' };
      const response = await POST(request, user);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation error');
      expect(mockEmailService.sendTestEmail).not.toHaveBeenCalled();
    });

    it('should handle email service errors', async () => {
      mockEmailService.sendTestEmail.mockRejectedValueOnce(new Error('SendGrid error'));

      const request = new NextRequest('http://localhost:3000/api/admin/email/test', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const user = { uid: 'user-123', email: 'admin@example.com' };
      const response = await POST(request, user);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to send test email');
      expect(data.details).toBe('SendGrid error');
    });

    it('should handle unknown errors', async () => {
      mockEmailService.sendTestEmail.mockRejectedValueOnce('Unknown error');

      const request = new NextRequest('http://localhost:3000/api/admin/email/test', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const user = { uid: 'user-123', email: 'admin@example.com' };
      const response = await POST(request, user);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to send test email');
      expect(data.details).toBe('Unknown error');
    });
  });
});
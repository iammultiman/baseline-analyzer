import sgMail from '@sendgrid/mail';

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export interface InvitationEmailData {
  id: string;
  email: string;
  token: string;
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
  role: string;
  expiresAt: Date;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private static instance: EmailService;
  private fromEmail: string;
  private fromName: string;
  private baseUrl: string;

  private constructor() {
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@baseline-analyzer.com';
    this.fromName = process.env.SENDGRID_FROM_NAME || 'Baseline Analyzer';
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Send organization invitation email
   */
  async sendInvitationEmail(data: InvitationEmailData): Promise<void> {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SendGrid API key not configured. Email not sent.');
      return;
    }

    const template = this.generateInvitationTemplate(data);
    const acceptUrl = `${this.baseUrl}/invitations/accept?token=${data.token}`;

    const msg = {
      to: data.email,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      subject: template.subject,
      text: template.text.replace('{{acceptUrl}}', acceptUrl),
      html: template.html.replace('{{acceptUrl}}', acceptUrl),
    };

    try {
      await sgMail.send(msg);
      console.log(`Invitation email sent to ${data.email} for organization ${data.organizationName}`);
    } catch (error) {
      console.error('Error sending invitation email:', error);
      throw new Error('Failed to send invitation email');
    }
  }

  /**
   * Generate invitation email template
   */
  private generateInvitationTemplate(data: InvitationEmailData): EmailTemplate {
    const expirationDate = data.expiresAt.toLocaleDateString();
    
    const subject = `You're invited to join ${data.organizationName} on Baseline Analyzer`;
    
    const text = `
Hi there!

${data.inviterName} (${data.inviterEmail}) has invited you to join "${data.organizationName}" on Baseline Analyzer as a ${data.role.toLowerCase()}.

Baseline Analyzer helps teams analyze their code repositories against web platform baseline standards using AI-powered insights.

To accept this invitation, click the link below:
{{acceptUrl}}

This invitation will expire on ${expirationDate}.

If you don't have an account yet, you'll be able to create one during the invitation acceptance process.

If you have any questions, feel free to reach out to ${data.inviterEmail}.

Best regards,
The Baseline Analyzer Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Organization Invitation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e1e5e9;
            border-top: none;
        }
        .organization-info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
        }
        .cta-button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 14px;
            color: #6c757d;
            border: 1px solid #e1e5e9;
            border-top: none;
            border-radius: 0 0 8px 8px;
        }
        .expiration {
            color: #dc3545;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎯 You're Invited!</h1>
        <p>Join ${data.organizationName} on Baseline Analyzer</p>
    </div>
    
    <div class="content">
        <p>Hi there!</p>
        
        <p><strong>${data.inviterName}</strong> (${data.inviterEmail}) has invited you to join their organization on Baseline Analyzer.</p>
        
        <div class="organization-info">
            <h3>📋 Invitation Details</h3>
            <ul>
                <li><strong>Organization:</strong> ${data.organizationName}</li>
                <li><strong>Role:</strong> ${data.role}</li>
                <li><strong>Invited by:</strong> ${data.inviterName}</li>
            </ul>
        </div>
        
        <p>Baseline Analyzer helps teams analyze their code repositories against web platform baseline standards using AI-powered insights. As a ${data.role.toLowerCase()}, you'll be able to collaborate with your team to improve code quality and web standards compliance.</p>
        
        <div style="text-align: center;">
            <a href="{{acceptUrl}}" class="cta-button">Accept Invitation</a>
        </div>
        
        <p class="expiration">⏰ This invitation expires on ${expirationDate}</p>
        
        <p>If you don't have an account yet, you'll be able to create one during the invitation acceptance process.</p>
        
        <p>If you have any questions, feel free to reach out to ${data.inviterEmail}.</p>
    </div>
    
    <div class="footer">
        <p>Best regards,<br>The Baseline Analyzer Team</p>
        <p><small>If you didn't expect this invitation, you can safely ignore this email.</small></p>
    </div>
</body>
</html>
    `.trim();

    return { subject, text, html };
  }

  /**
   * Send test email (for configuration validation)
   */
  async sendTestEmail(to: string): Promise<void> {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SendGrid API key not configured');
    }

    const msg = {
      to,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      subject: 'Baseline Analyzer - Email Configuration Test',
      text: 'This is a test email to verify your email configuration is working correctly.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>✅ Email Configuration Test</h2>
          <p>This is a test email to verify your email configuration is working correctly.</p>
          <p>If you received this email, your SendGrid integration is properly configured!</p>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      console.log(`Test email sent to ${to}`);
    } catch (error) {
      console.error('Error sending test email:', error);
      throw new Error('Failed to send test email');
    }
  }
}

export const emailService = EmailService.getInstance();
#!/usr/bin/env tsx

import { EmailService } from '../src/lib/services/email-service';

async function testEmailService() {
  console.log('Testing email service configuration...');
  
  const emailService = new EmailService();
  
  try {
    // Test configuration
    const isConfigured = await emailService.validateConfiguration();
    
    if (!isConfigured) {
      console.log('❌ Email service is not properly configured');
      process.exit(1);
    }
    
    console.log('✅ Email service configuration is valid');
    
    // Test template rendering
    const templateData = {
      organizationName: 'Test Organization',
      inviterName: 'Test User',
      inviteUrl: 'https://example.com/invite/test'
    };
    
    const renderedEmail = await emailService.renderTemplate('invitation', templateData);
    
    if (renderedEmail.subject && renderedEmail.html) {
      console.log('✅ Email template rendering works');
    } else {
      console.log('❌ Email template rendering failed');
      process.exit(1);
    }
    
    // Test email sending (only if TEST_EMAIL is provided)
    const testEmail = process.env.TEST_EMAIL;
    if (testEmail) {
      console.log(`Sending test email to ${testEmail}...`);
      
      const result = await emailService.sendEmail({
        to: testEmail,
        subject: 'Production Validation Test',
        text: 'This is a test email from production validation.',
        html: '<p>This is a test email from production validation.</p>'
      });
      
      if (result.success) {
        console.log('✅ Test email sent successfully');
        console.log(`Message ID: ${result.messageId}`);
      } else {
        console.log('❌ Test email failed to send');
        process.exit(1);
      }
    } else {
      console.log('ℹ️  Skipping email sending test (TEST_EMAIL not provided)');
    }
    
    console.log('✅ Email service test completed successfully');
    
  } catch (error) {
    console.error('❌ Email service test failed:', error);
    process.exit(1);
  }
}

testEmailService();
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const testEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type TestEmailForm = z.infer<typeof testEmailSchema>;

export function EmailConfig() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TestEmailForm>({
    resolver: zodResolver(testEmailSchema),
  });

  const sendTestEmail = async (data: TestEmailForm) => {
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/admin/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send test email');
      }

      setTestResult({
        success: true,
        message: 'Test email sent successfully! Check your inbox.',
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send test email',
      });
    } finally {
      setTesting(false);
    }
  };

  const isConfigured = !!(
    process.env.NEXT_PUBLIC_SENDGRID_CONFIGURED || 
    typeof window !== 'undefined'
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Configuration
        </CardTitle>
        <CardDescription>
          Configure and test email service for invitation notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration Status */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Configuration Status</h3>
          <div className="grid gap-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm">SendGrid API Key</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {isConfigured ? 'Configured' : 'Not configured'}
              </span>
            </div>
          </div>
        </div>

        {/* Environment Variables Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Required Environment Variables</h3>
          <div className="bg-muted p-4 rounded-lg">
            <code className="text-xs">
              SENDGRID_API_KEY=your_sendgrid_api_key<br />
              SENDGRID_FROM_EMAIL=noreply@your-domain.com<br />
              SENDGRID_FROM_NAME=Baseline Analyzer
            </code>
          </div>
        </div>

        {/* Test Email */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Test Email Configuration</h3>
          <form onSubmit={handleSubmit(sendTestEmail)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Test Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="test@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
            
            <Button type="submit" disabled={testing || !isConfigured}>
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending Test Email...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Test Email
                </>
              )}
            </Button>
          </form>

          {testResult && (
            <Alert className={testResult.success ? 'border-green-200' : 'border-red-200'}>
              {testResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                {testResult.message}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Setup Instructions */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Setup Instructions</h3>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>1. Create a SendGrid account at <a href="https://sendgrid.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">sendgrid.com</a></p>
            <p>2. Generate an API key in your SendGrid dashboard</p>
            <p>3. Add the environment variables to your deployment</p>
            <p>4. Verify your sender domain in SendGrid</p>
            <p>5. Test the configuration using the form above</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
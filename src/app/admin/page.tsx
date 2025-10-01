'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { Navigation } from '@/components/navigation';
import { PricingConfig } from '@/components/admin/pricing-config';
import { UsageAnalytics } from '@/components/admin/usage-analytics';
import { AIProviderConfigComponent } from '@/components/admin/ai-provider-config';
import { BaselineDataConfig } from '@/components/admin/baseline-data-config';
import { SystemMonitoring } from '@/components/admin/system-monitoring';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, BarChart3, Shield, Bot, Database, Mail, RefreshCw } from 'lucide-react';
import { EmailConfig } from '@/components/admin/email-config';
import { RetryManagement } from '@/components/admin/retry-management';
import { useAuth } from '@/lib/auth-context';

export default function AdminPage() {
  const { } = useAuth();
  
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <Navigation />
            
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-6">
                <Shield className="h-8 w-8" />
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              </div>

      <Tabs defaultValue="monitoring" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            System Monitoring
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Usage Analytics
          </TabsTrigger>
          <TabsTrigger value="pricing" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Pricing Configuration
          </TabsTrigger>
          <TabsTrigger value="ai-providers" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI Providers
          </TabsTrigger>
          <TabsTrigger value="baseline-data" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Baseline Data
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Config
          </TabsTrigger>
          <TabsTrigger value="retry" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry Management
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="monitoring" className="space-y-4">
          <SystemMonitoring />
        </TabsContent>
        
        <TabsContent value="analytics" className="space-y-4">
          <UsageAnalytics />
        </TabsContent>
        
        <TabsContent value="pricing" className="space-y-4">
          <PricingConfig />
        </TabsContent>
        
        <TabsContent value="ai-providers" className="space-y-4">
          <AIProviderConfigComponent organizationId="default" />
        </TabsContent>
        
        <TabsContent value="baseline-data" className="space-y-4">
          <BaselineDataConfig />
        </TabsContent>
        
        <TabsContent value="email" className="space-y-4">
          <EmailConfig />
        </TabsContent>
        
        <TabsContent value="retry" className="space-y-4">
          <RetryManagement />
        </TabsContent>
      </Tabs>

      {/* Admin Information */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>This admin dashboard provides comprehensive management capabilities:</p>
            
            <div className="mt-4 space-y-3">
              <div>
                <h4 className="font-medium text-foreground">System Monitoring</h4>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Real-time system health and performance metrics</li>
                  <li>Monitor database, AI providers, and storage status</li>
                  <li>Track CPU, memory, disk, and network usage</li>
                  <li>View system alerts and uptime statistics</li>
                  <li>Performance monitoring with response times and error rates</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-foreground">Usage Analytics</h4>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Monitor user activity and credit consumption</li>
                  <li>View transaction history across the organization</li>
                  <li>Track daily usage patterns and trends</li>
                  <li>Analyze user credit balances and spending</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-foreground">Pricing Configuration</h4>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Configure credit packages and pricing with validation</li>
                  <li>Set free tier limits and usage restrictions</li>
                  <li>Adjust credit cost calculation parameters</li>
                  <li>Real-time pricing updates with user notifications</li>
                  <li>Advanced free tier configuration and trial management</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-foreground">AI Provider Configuration</h4>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Configure multiple AI providers (OpenAI, Gemini, Claude, Qwen, OpenRouter)</li>
                  <li>Set up API keys and provider-specific settings with validation</li>
                  <li>Configure provider priority and failover logic</li>
                  <li>Test provider connections and monitor performance</li>
                  <li>Manage cost per token and usage optimization</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-foreground">Baseline Data Management</h4>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Manage web platform baseline data for analysis</li>
                  <li>Update baseline data from web.dev automatically</li>
                  <li>Search and test vector similarity functionality</li>
                  <li>Monitor baseline data statistics and distribution</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-foreground">Email Configuration</h4>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Configure SendGrid email service for notifications</li>
                  <li>Test email delivery and template rendering</li>
                  <li>Manage sender identity and domain verification</li>
                  <li>Monitor email delivery status and failures</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-foreground">Retry Management</h4>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Monitor failed analysis retries and success rates</li>
                  <li>Manually trigger retries for failed analyses</li>
                  <li>View retry statistics and failure patterns</li>
                  <li>Configure automatic retry policies and limits</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-800">
              <strong>Access Control:</strong> This dashboard is only accessible to users with admin role within an organization.
            </div>
          </div>
        </CardContent>
      </Card>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
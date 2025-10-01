'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { Navigation } from '@/components/navigation';
import { CreditManagementDashboard } from '@/components/credits/credit-management-dashboard';
import { CreditCalculator } from '@/components/credits/credit-calculator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CreditsPage() {
  const handleCalculate = (cost: number, hasSufficientCredits: boolean) => {
    console.log('Analysis cost:', cost, 'Has sufficient credits:', hasSufficientCredits);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <Navigation />
            
            <div className="space-y-6">
              {/* Main Credit Management Dashboard */}
              <CreditManagementDashboard />

              {/* Credit Calculator */}
              <Card>
                <CardHeader>
                  <CardTitle>Credit Calculator</CardTitle>
                </CardHeader>
                <CardContent>
                  <CreditCalculator 
                    repositorySize={1500}
                    fileCount={75}
                    onCalculate={handleCalculate}
                  />
                </CardContent>
              </Card>

              {/* Demo Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Demo Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <p>This is a demonstration of the credit management system. Key features:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Comprehensive credit balance display with low balance warnings</li>
                      <li>Real-time usage analytics and spending projections</li>
                      <li>Smart notifications for low balance, usage limits, and recommendations</li>
                      <li>Detailed transaction history with filtering and pagination</li>
                      <li>Streamlined credit purchase flow with package recommendations</li>
                      <li>Usage analytics dashboard with trends and breakdowns</li>
                    </ul>
                  </div>
                  
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="text-sm text-amber-800">
                      <strong>Note:</strong> This is a demo environment. Credit purchases are simulated and no actual payments are processed.
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
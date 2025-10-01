'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CreditCard, 
  TrendingUp, 
  AlertTriangle, 
  Bell,
  BarChart3,
  History,
  Settings,
  Coins
} from 'lucide-react';
import { CreditBalance } from './credit-balance';
import { CreditPurchase } from './credit-purchase';
import { CreditHistory } from './credit-history';
import { CreditNotifications } from './credit-notifications';
import { UsageAnalyticsDashboard } from './usage-analytics-dashboard';
import { useCreditBalance } from '@/lib/hooks/use-credit-balance';

interface CreditManagementDashboardProps {
  showNotifications?: boolean;
  showAnalytics?: boolean;
  compact?: boolean;
}

export function CreditManagementDashboard({ 
  showNotifications = true, 
  showAnalytics = true,
  compact = false 
}: CreditManagementDashboardProps) {
  const { balance, refreshBalance } = useCreditBalance();
  const [activeTab, setActiveTab] = useState('overview');
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  const isLowBalance = balance < 10;
  const isCriticalBalance = balance < 5;

  const handlePurchaseComplete = () => {
    refreshBalance();
    setShowPurchaseDialog(false);
  };

  if (compact) {
    return (
      <div className="space-y-4">
        {/* Compact Credit Balance */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Coins className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">{balance}</span>
                    {isLowBalance && (
                      <Badge variant={isCriticalBalance ? "destructive" : "secondary"} className="text-xs">
                        {isCriticalBalance ? "Critical" : "Low"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Credits available</p>
                </div>
              </div>
              <Button 
                size="sm" 
                onClick={() => setShowPurchaseDialog(true)}
                variant={isLowBalance ? "default" : "outline"}
              >
                Buy Credits
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Low Balance Warning */}
        {isLowBalance && (
          <Alert variant={isCriticalBalance ? "destructive" : "default"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {isCriticalBalance 
                ? "Critical: You have very few credits remaining. Purchase more to continue analyzing repositories."
                : "Low balance: Consider purchasing more credits to avoid interruptions."
              }
            </AlertDescription>
          </Alert>
        )}

        {/* Purchase Dialog */}
        {showPurchaseDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Purchase Credits</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowPurchaseDialog(false)}
                >
                  ×
                </Button>
              </div>
              <CreditPurchase onPurchaseComplete={handlePurchaseComplete} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Credit Management</h2>
        </div>
        <div className="flex items-center gap-2">
          {isLowBalance && (
            <Badge variant={isCriticalBalance ? "destructive" : "secondary"}>
              <AlertTriangle className="h-3 w-3 mr-1" />
              {isCriticalBalance ? "Critical Balance" : "Low Balance"}
            </Badge>
          )}
        </div>
      </div>

      {/* Notifications */}
      {showNotifications && <CreditNotifications />}

      {/* Main Dashboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="purchase" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Purchase
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Credit Balance */}
            <div className="lg:col-span-1">
              <CreditBalance onPurchaseClick={() => setActiveTab('purchase')} />
            </div>

            {/* Quick Stats */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Quick Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">15</div>
                      <div className="text-sm text-muted-foreground">Analyses This Month</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">8.5</div>
                      <div className="text-sm text-muted-foreground">Avg Credits/Analysis</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Usage Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div className="text-sm">
                        <p className="font-medium">Consider the Professional Pack</p>
                        <p className="text-muted-foreground">Based on your usage, you could save 15% with a larger package</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      <div className="text-sm">
                        <p className="font-medium">Optimize repository size</p>
                        <p className="text-muted-foreground">Smaller repositories use fewer credits per analysis</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {showAnalytics && <UsageAnalyticsDashboard />}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <CreditHistory />
        </TabsContent>

        <TabsContent value="purchase" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Purchase Credits</CardTitle>
            </CardHeader>
            <CardContent>
              <CreditPurchase onPurchaseComplete={handlePurchaseComplete} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Credit Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p>Manage your credit preferences and notification settings.</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Low Balance Alerts</div>
                      <div className="text-sm text-muted-foreground">Get notified when credits are running low</div>
                    </div>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Usage Analytics</div>
                      <div className="text-sm text-muted-foreground">Track your credit usage patterns</div>
                    </div>
                    <Button variant="outline" size="sm">View Details</Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Auto-Purchase</div>
                      <div className="text-sm text-muted-foreground">Automatically buy credits when running low</div>
                    </div>
                    <Button variant="outline" size="sm">Set Up</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
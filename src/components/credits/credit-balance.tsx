'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Coins, TrendingUp, AlertTriangle } from 'lucide-react';

interface CreditBalanceProps {
  onPurchaseClick?: () => void;
}

interface CreditInfo {
  balance: number;
  stats?: {
    totalCreditsUsed: number;
    analysisCount: number;
    averageCreditsPerAnalysis: number;
    period: string;
  };
  usageLimits?: {
    dailyUsage: number;
    monthlyUsage: number;
    dailyLimitReached: boolean;
    monthlyLimitReached: boolean;
    limits: {
      freeUserDailyLimit: number;
      freeUserMonthlyLimit: number;
    };
  };
}

export function CreditBalance({ onPurchaseClick }: CreditBalanceProps) {
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCreditInfo();
  }, []);

  const fetchCreditInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/credits?includeStats=true');
      
      if (!response.ok) {
        throw new Error('Failed to fetch credit information');
      }

      const data = await response.json();
      setCreditInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-red-600">Error: {error}</div>
          <Button onClick={fetchCreditInfo} variant="outline" size="sm" className="mt-2">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!creditInfo) {
    return null;
  }

  const isLowBalance = creditInfo.balance < 10;
  const hasUsageLimits = creditInfo.usageLimits?.dailyLimitReached || creditInfo.usageLimits?.monthlyLimitReached;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Credit Balance</CardTitle>
        <Coins className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold flex items-center gap-2">
              {creditInfo.balance}
              {isLowBalance && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Low
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Available credits
            </p>
            {isLowBalance && (
              <p className="text-xs text-amber-600 mt-1">
                Consider purchasing more credits to continue analyzing repositories
              </p>
            )}
          </div>
          <Button 
            onClick={onPurchaseClick}
            size="sm"
            variant={isLowBalance ? "default" : "outline"}
            className={isLowBalance ? "bg-orange-600 hover:bg-orange-700" : ""}
          >
            Buy Credits
          </Button>
        </div>

        {creditInfo.stats && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium">{creditInfo.stats.totalCreditsUsed}</div>
                <div className="text-muted-foreground">Used ({creditInfo.stats.period})</div>
              </div>
              <div>
                <div className="font-medium">{creditInfo.stats.analysisCount}</div>
                <div className="text-muted-foreground">Analyses</div>
              </div>
            </div>
            {creditInfo.stats.averageCreditsPerAnalysis > 0 && (
              <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Avg: {creditInfo.stats.averageCreditsPerAnalysis.toFixed(1)} credits per analysis
              </div>
            )}
          </div>
        )}

        {hasUsageLimits && creditInfo.usageLimits && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm">
              <div className="font-medium text-amber-600 mb-2">Usage Limits</div>
              {creditInfo.usageLimits.dailyLimitReached && (
                <div className="text-xs text-muted-foreground">
                  Daily limit reached: {creditInfo.usageLimits.dailyUsage}/{creditInfo.usageLimits.limits.freeUserDailyLimit}
                </div>
              )}
              {creditInfo.usageLimits.monthlyLimitReached && (
                <div className="text-xs text-muted-foreground">
                  Monthly limit reached: {creditInfo.usageLimits.monthlyUsage}/{creditInfo.usageLimits.limits.freeUserMonthlyLimit}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
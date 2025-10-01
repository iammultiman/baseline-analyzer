'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  Activity, 
  CreditCard, 
  TrendingUp, 
  Loader2,
  ArrowUpCircle,
  ArrowDownCircle,
  Gift,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';

interface UsageStats {
  period: string;
  summary: {
    totalUsers: number;
    activeUsers: number;
    totalTransactions: number;
    totalCreditsUsed: number;
    totalCreditsPurchased: number;
  };
  dailyUsage: Array<{
    date: Date;
    transactions: number;
    creditsUsed: number;
    creditsPurchased: number;
  }>;
  recentTransactions: Array<{
    id: string;
    type: 'PURCHASE' | 'DEDUCTION' | 'REFUND' | 'BONUS';
    amount: number;
    description: string;
    createdAt: string;
    user: {
      displayName: string;
      email: string;
    };
  }>;
  userBalances: Array<{
    id: string;
    displayName: string;
    email: string;
    creditBalance: number;
    createdAt: string;
  }>;
}

export function UsageAnalytics() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    fetchStats();
  }, [period]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/usage?days=${period}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch usage statistics');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'PURCHASE':
        return <ArrowUpCircle className="h-4 w-4 text-green-600" />;
      case 'DEDUCTION':
        return <ArrowDownCircle className="h-4 w-4 text-red-600" />;
      case 'BONUS':
        return <Gift className="h-4 w-4 text-blue-600" />;
      case 'REFUND':
        return <RefreshCw className="h-4 w-4 text-orange-600" />;
      default:
        return <ArrowUpCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatAmount = (amount: number, type: string) => {
    const sign = type === 'DEDUCTION' ? '' : '+';
    return `${sign}${amount}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600">Error: {error}</div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Usage Analytics</h2>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.summary.totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.summary.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.period}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.summary.totalTransactions}</div>
            <p className="text-xs text-muted-foreground">
              {stats.period}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Used</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.summary.totalCreditsUsed}</div>
            <p className="text-xs text-muted-foreground">
              {stats.period}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Purchased</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.summary.totalCreditsPurchased}</div>
            <p className="text-xs text-muted-foreground">
              {stats.period}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {stats.recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getTransactionIcon(transaction.type)}
                      <div>
                        <div className="font-medium text-sm">
                          {transaction.user.displayName || transaction.user.email}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {transaction.description}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(transaction.createdAt), 'MMM d, h:mm a')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {formatAmount(transaction.amount, transaction.type)}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {transaction.type.toLowerCase()}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* User Balances */}
        <Card>
          <CardHeader>
            <CardTitle>User Credit Balances</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {stats.userBalances.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-sm">
                        {user.displayName || user.email}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Joined {format(new Date(user.createdAt), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">
                        {user.creditBalance}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        credits
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Daily Usage Chart (Simple Table for now) */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Usage Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
              <div>Date</div>
              <div>Transactions</div>
              <div>Credits Used</div>
              <div>Credits Purchased</div>
            </div>
            {stats.dailyUsage.slice(0, 10).map((day, index) => (
              <div key={index} className="grid grid-cols-4 gap-4 text-sm py-2 border-b">
                <div>{format(new Date(day.date), 'MMM d')}</div>
                <div>{day.transactions}</div>
                <div>{day.creditsUsed}</div>
                <div>{day.creditsPurchased}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
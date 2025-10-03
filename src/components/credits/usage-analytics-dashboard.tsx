'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Calendar,
  DollarSign,
  Target,
  RefreshCw,
  Loader2
} from 'lucide-react';

interface UsageAnalytics {
  overview: {
    totalCreditsUsed: number;
    totalAnalyses: number;
    averageCreditsPerAnalysis: number;
    totalSpent: number;
    period: string;
  };
  trends: {
    daily: Array<{
      date: string;
      creditsUsed: number;
      analyses: number;
      cost: number;
    }>;
    weekly: Array<{
      week: string;
      creditsUsed: number;
      analyses: number;
      cost: number;
    }>;
    monthly: Array<{
      month: string;
      creditsUsed: number;
      analyses: number;
      cost: number;
    }>;
  };
  breakdown: {
    byComplexity: Array<{
      complexity: string;
      creditsUsed: number;
      percentage: number;
      color: string;
    }>;
    byRepositorySize: Array<{
      sizeRange: string;
      creditsUsed: number;
      analyses: number;
    }>;
  };
  projections: {
    monthlyProjection: number;
    recommendedPackage?: string;
    savingsOpportunity?: number;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function UsageAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/credits/analytics?range=${timeRange}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch usage analytics');
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatTrend = (current: number, previous: number) => {
    if (previous === 0) return { value: 0, isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(change), isPositive: change >= 0 };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading analytics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-red-600 text-center">
            <p>Error: {error}</p>
            <Button onClick={fetchAnalytics} variant="outline" size="sm" className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Usage Analytics</h2>
        <div className="inline-flex items-center rounded-md border bg-muted p-1 text-muted-foreground" role="tablist" aria-label="Select time range">
          {([
            { value: '7d', label: '7 Days' },
            { value: '30d', label: '30 Days' },
            { value: '90d', label: '90 Days' },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={timeRange === value}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                timeRange === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => setTimeRange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Used</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.totalCreditsUsed}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.overview.period}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analyses</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.totalAnalyses}</div>
            <p className="text-xs text-muted-foreground">
              Avg: {analytics.overview.averageCreditsPerAnalysis.toFixed(1)} credits each
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.overview.totalSpent)}</div>
            <p className="text-xs text-muted-foreground">
              Credit purchases
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Projection</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.projections.monthlyProjection}</div>
            <p className="text-xs text-muted-foreground">
              Credits per month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="trends" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="trends">Usage Trends</TabsTrigger>
          <TabsTrigger value="breakdown">Usage Breakdown</TabsTrigger>
          <TabsTrigger value="projections">Projections</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Credit Usage Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.trends.daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="creditsUsed" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    name="Credits Used"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="analyses" 
                    stroke="#82ca9d" 
                    strokeWidth={2}
                    name="Analyses"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Usage by Complexity</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analytics.breakdown.byComplexity}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="creditsUsed"
                    >
                      {analytics.breakdown.byComplexity.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usage by Repository Size</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.breakdown.byRepositorySize}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="sizeRange" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="creditsUsed" fill="#8884d8" name="Credits Used" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="projections" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Projection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {analytics.projections.monthlyProjection}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Credits per month (projected)
                  </div>
                </div>
                
                {analytics.projections.recommendedPackage && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="font-medium text-blue-900">Recommended Package</div>
                    <div className="text-sm text-blue-700">
                      {analytics.projections.recommendedPackage}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {analytics.projections.savingsOpportunity && (
              <Card>
                <CardHeader>
                  <CardTitle>Savings Opportunity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {formatCurrency(analytics.projections.savingsOpportunity)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Potential monthly savings
                    </div>
                  </div>
                  
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="font-medium text-green-900">Optimization Tip</div>
                    <div className="text-sm text-green-700">
                      Consider purchasing a larger package to reduce per-credit costs
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
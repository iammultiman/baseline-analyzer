'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  Download, 
  Share2, 
  Calendar,
  Filter,
  RefreshCw
} from 'lucide-react';

import { AnalysisVisualization } from './analysis-visualization';
import { ComplianceTrends } from './compliance-trends';
import { PDFReportGenerator } from './pdf-report-generator';
import { ReportSharing } from './report-sharing';

interface ReportingDashboardProps {
  organizationId?: string;
  userId?: string;
}

interface DashboardData {
  totalAnalyses: number;
  averageCompliance: number;
  trendsData: TrendData[];
  topIssues: IssueData[];
  recentAnalyses: AnalysisData[];
}

interface TrendData {
  date: string;
  complianceScore: number;
  analysisCount: number;
}

interface IssueData {
  category: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
}

interface AnalysisData {
  id: string;
  repositoryName: string;
  complianceScore: number;
  analysisDate: Date;
  status: string;
}

export function ReportingDashboard({ organizationId, userId }: ReportingDashboardProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedAnalyses, setSelectedAnalyses] = useState<string[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [timeRange, organizationId, userId]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        timeRange,
        ...(organizationId && { organizationId }),
        ...(userId && { userId })
      });

      const response = await fetch(`/api/reporting/dashboard?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load dashboard data');
      }

      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to load reporting dashboard data', err);
      setError('Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportReport = async (format: 'pdf' | 'csv' | 'json') => {
    if (!dashboardData) return;

    try {
      const params = new URLSearchParams({
        format,
        timeRange,
        ...(organizationId && { organizationId }),
        ...(userId && { userId }),
        ...(selectedAnalyses.length > 0 && { analyses: selectedAnalyses.join(',') })
      });

      const response = await fetch(`/api/reporting/export?${params}`);
      if (!response.ok) {
        throw new Error('Failed to export report');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `baseline-analysis-report-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export report:', error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <BarChart3 className="h-8 w-8 mx-auto text-red-400" />
            <p className="text-red-600">{error}</p>
            <Button onClick={loadDashboardData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!dashboardData) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reporting Dashboard</h1>
          <p className="text-gray-600">
            Analyze trends and generate reports for baseline compliance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="reporting-time-range">
            Time range
          </label>
          <select
            id="reporting-time-range"
            data-testid="time-range-select"
            value={timeRange}
            onChange={(event) => setTimeRange(event.target.value)}
            className="flex h-10 w-32 items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <Button onClick={() => handleExportReport('pdf')} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-total-analyses">
              {dashboardData.totalAnalyses}
            </div>
            <p className="text-xs text-muted-foreground">
              In the last {timeRange}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Compliance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className="text-2xl font-bold"
              data-testid="metric-average-compliance"
            >
              {Math.round(dashboardData.averageCompliance)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Baseline compliance score
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Issues</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-top-issues">
              {dashboardData.topIssues.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Categories identified
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-recent-analyses">
              {dashboardData.recentAnalyses.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Recent analyses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="sharing">Sharing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Compliance Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Compliance Score Distribution</CardTitle>
                <CardDescription>
                  Distribution of compliance scores across all analyses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AnalysisVisualization 
                  data={dashboardData.recentAnalyses}
                  type="distribution"
                />
              </CardContent>
            </Card>

            {/* Top Issues */}
            <Card>
              <CardHeader>
                <CardTitle>Most Common Issues</CardTitle>
                <CardDescription>
                  Issues found across all repository analyses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardData.topIssues.map((issue, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={
                            issue.severity === 'high' ? 'destructive' :
                            issue.severity === 'medium' ? 'default' : 'secondary'
                          }
                        >
                          {issue.severity}
                        </Badge>
                        <span className="font-medium">{issue.category}</span>
                      </div>
                      <span className="text-sm text-gray-600">{issue.count} occurrences</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Analyses */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Analyses</CardTitle>
              <CardDescription>
                Latest repository analyses and their compliance scores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboardData.recentAnalyses.map((analysis) => (
                  <div key={analysis.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{analysis.repositoryName}</div>
                      <div className="text-sm text-gray-600">
                        {analysis.analysisDate.toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={analysis.status === 'COMPLETED' ? 'default' : 'secondary'}>
                        {analysis.status}
                      </Badge>
                      <div className="text-right">
                        <div className="font-bold text-lg">{analysis.complianceScore}%</div>
                        <div className="text-xs text-gray-600">compliance</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <ComplianceTrends 
            data={dashboardData.trendsData}
            timeRange={timeRange}
          />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <PDFReportGenerator 
            dashboardData={dashboardData}
            timeRange={timeRange}
            organizationId={organizationId}
            selectedAnalyses={selectedAnalyses}
            onAnalysisSelectionChange={setSelectedAnalyses}
          />
        </TabsContent>

        <TabsContent value="sharing" className="space-y-6">
          <ReportSharing 
            dashboardData={dashboardData}
            timeRange={timeRange}
            organizationId={organizationId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
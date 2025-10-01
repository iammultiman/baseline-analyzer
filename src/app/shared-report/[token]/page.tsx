'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  Download, 
  Calendar,
  RefreshCw,
  AlertCircle,
  Lock,
  Eye
} from 'lucide-react';

import { AnalysisVisualization } from '@/components/reporting/analysis-visualization';
import { ComplianceTrends } from '@/components/reporting/compliance-trends';

interface SharedReportPageProps {
  params: {
    token: string;
  };
}

interface SharedReportData {
  id: string;
  title: string;
  includeData: {
    overview: boolean;
    trends: boolean;
    analyses: boolean;
    issues: boolean;
  };
  access: {
    isPublic: boolean;
    requireAuth: boolean;
    allowDownload: boolean;
  };
  timeRange: string;
  dashboardData: any;
  createdAt: string;
  expiresAt: string;
}

export default function SharedReportPage({ params }: SharedReportPageProps) {
  const [reportData, setReportData] = useState<SharedReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSharedReport();
  }, [params.token]);

  const loadSharedReport = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/reporting/shared/${params.token}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Report not found');
        } else if (response.status === 410) {
          throw new Error('This report has expired');
        } else if (response.status === 401) {
          throw new Error('Authentication required to view this report');
        } else if (response.status === 403) {
          throw new Error('You do not have permission to view this report');
        } else {
          throw new Error('Failed to load report');
        }
      }

      const data = await response.json();
      setReportData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadReport = async (format: 'pdf' | 'json' | 'csv') => {
    if (!reportData || !reportData.access.allowDownload) return;

    try {
      const params = new URLSearchParams({
        format,
        timeRange: reportData.timeRange,
      });

      const response = await fetch(`/api/reporting/export?${params}`);
      if (!response.ok) {
        throw new Error('Failed to download report');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download report:', error);
      alert('Failed to download report. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center space-y-2">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-600">Loading shared report...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-red-400" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Unable to Load Report</h2>
                <p className="text-red-600 mt-2">{error}</p>
              </div>
              <Button onClick={loadSharedReport} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!reportData) {
    return null;
  }

  const { dashboardData } = reportData;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Report Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{reportData.title}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Created: {new Date(reportData.createdAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Expires: {new Date(reportData.expiresAt).toLocaleDateString()}
                </span>
                <Badge variant={reportData.access.isPublic ? 'default' : 'secondary'}>
                  {reportData.access.isPublic ? (
                    <><Eye className="h-3 w-3 mr-1" />Public</>
                  ) : (
                    <><Lock className="h-3 w-3 mr-1" />Private</>
                  )}
                </Badge>
              </div>
            </div>
            {reportData.access.allowDownload && (
              <div className="flex items-center gap-2">
                <Button onClick={() => handleDownloadReport('pdf')} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button onClick={() => handleDownloadReport('csv')} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button onClick={() => handleDownloadReport('json')} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  JSON
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Report Content */}
        <div className="space-y-6">
          {/* Overview Section */}
          {reportData.includeData.overview && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Overview
                </CardTitle>
                <CardDescription>
                  Key metrics from the analysis period ({reportData.timeRange})
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {dashboardData.totalAnalyses}
                    </div>
                    <div className="text-sm text-gray-600">Total Analyses</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {Math.round(dashboardData.averageCompliance)}%
                    </div>
                    <div className="text-sm text-gray-600">Average Compliance</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">
                      {dashboardData.topIssues.length}
                    </div>
                    <div className="text-sm text-gray-600">Issue Categories</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600">
                      {dashboardData.recentAnalyses.length}
                    </div>
                    <div className="text-sm text-gray-600">Recent Analyses</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trends Section */}
          {reportData.includeData.trends && dashboardData.trendsData && (
            <ComplianceTrends 
              data={dashboardData.trendsData}
              timeRange={reportData.timeRange}
            />
          )}

          {/* Analyses Section */}
          {reportData.includeData.analyses && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Compliance Distribution</CardTitle>
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

              <Card>
                <CardHeader>
                  <CardTitle>Repository Comparison</CardTitle>
                  <CardDescription>
                    Top performing repositories by compliance score
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AnalysisVisualization 
                    data={dashboardData.recentAnalyses}
                    type="comparison"
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Issues Section */}
          {reportData.includeData.issues && dashboardData.topIssues && (
            <Card>
              <CardHeader>
                <CardTitle>Common Issues</CardTitle>
                <CardDescription>
                  Most frequently identified issues across all analyses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardData.topIssues.map((issue: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
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
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Generated by Baseline Analyzer • {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
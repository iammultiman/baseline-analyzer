'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Share2, 
  Link, 
  Copy, 
  Mail, 
  Calendar,
  Eye,
  EyeOff,
  Trash2,
  ExternalLink,
  CheckCircle,
  Clock
} from 'lucide-react';

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

interface ReportSharingProps {
  dashboardData: DashboardData;
  timeRange: string;
  organizationId?: string;
}

interface SharedReport {
  id: string;
  title: string;
  url: string;
  expiresAt: Date;
  isPublic: boolean;
  accessCount: number;
  createdAt: Date;
}

interface ShareConfig {
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
  expiration: string; // '1d', '7d', '30d', 'never'
}

export function ReportSharing({ dashboardData, timeRange, organizationId }: ReportSharingProps) {
  const [sharedReports, setSharedReports] = useState<SharedReport[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [shareConfig, setShareConfig] = useState<ShareConfig>({
    title: `Baseline Analysis Report - ${new Date().toLocaleDateString()}`,
    includeData: {
      overview: true,
      trends: true,
      analyses: true,
      issues: true,
    },
    access: {
      isPublic: false,
      requireAuth: true,
      allowDownload: true,
    },
    expiration: '30d'
  });

  React.useEffect(() => {
    loadSharedReports();
  }, [organizationId]);

  const loadSharedReports = async () => {
    try {
      const params = new URLSearchParams({
        ...(organizationId && { organizationId })
      });

      const response = await fetch(`/api/reporting/shared?${params}`);
      if (response.ok) {
        const reports = await response.json();
        setSharedReports(reports.map((report: any) => ({
          ...report,
          createdAt: new Date(report.createdAt),
          expiresAt: new Date(report.expiresAt)
        })));
      }
    } catch (error) {
      console.error('Failed to load shared reports:', error);
    }
  };

  const createSharedReport = async () => {
    try {
      setIsCreating(true);

      const response = await fetch('/api/reporting/shared', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...shareConfig,
          timeRange,
          organizationId,
          dashboardData
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create shared report');
      }

      const newReport = await response.json();
      setSharedReports(prev => [
        {
          ...newReport,
          createdAt: new Date(newReport.createdAt),
          expiresAt: new Date(newReport.expiresAt)
        },
        ...prev
      ]);

      // Copy URL to clipboard
      await navigator.clipboard.writeText(newReport.url);
      alert('Shared report created and URL copied to clipboard!');

    } catch (error) {
      console.error('Failed to create shared report:', error);
      alert('Failed to create shared report. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert('URL copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const deleteSharedReport = async (reportId: string) => {
    try {
      const response = await fetch(`/api/reporting/shared/${reportId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSharedReports(prev => prev.filter(report => report.id !== reportId));
      }
    } catch (error) {
      console.error('Failed to delete shared report:', error);
    }
  };

  const getExpirationDate = (expiration: string) => {
    const now = new Date();
    switch (expiration) {
      case '1d': return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case '7d': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case '30d': return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      case 'never': return new Date('2099-12-31');
      default: return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  };

  const isExpired = (expiresAt: Date) => {
    return new Date() > expiresAt;
  };

  return (
    <div className="space-y-6">
      {/* Create New Shared Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Create Shared Report
          </CardTitle>
          <CardDescription>
            Generate a secure, shareable link to your analysis dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Report Configuration */}
          <div>
            <label className="text-sm font-medium">Report Title</label>
            <Input
              value={shareConfig.title}
              onChange={(e) => setShareConfig(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter report title"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Data Inclusion */}
            <div>
              <h4 className="font-medium mb-3">Include Data</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-overview"
                    checked={shareConfig.includeData.overview}
                    onCheckedChange={(checked) => 
                      setShareConfig(prev => ({
                        ...prev,
                        includeData: { ...prev.includeData, overview: !!checked }
                      }))
                    }
                  />
                  <label htmlFor="include-overview" className="text-sm">Overview & Metrics</label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-trends"
                    checked={shareConfig.includeData.trends}
                    onCheckedChange={(checked) => 
                      setShareConfig(prev => ({
                        ...prev,
                        includeData: { ...prev.includeData, trends: !!checked }
                      }))
                    }
                  />
                  <label htmlFor="include-trends" className="text-sm">Compliance Trends</label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-analyses"
                    checked={shareConfig.includeData.analyses}
                    onCheckedChange={(checked) => 
                      setShareConfig(prev => ({
                        ...prev,
                        includeData: { ...prev.includeData, analyses: !!checked }
                      }))
                    }
                  />
                  <label htmlFor="include-analyses" className="text-sm">Analysis Results</label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-issues"
                    checked={shareConfig.includeData.issues}
                    onCheckedChange={(checked) => 
                      setShareConfig(prev => ({
                        ...prev,
                        includeData: { ...prev.includeData, issues: !!checked }
                      }))
                    }
                  />
                  <label htmlFor="include-issues" className="text-sm">Common Issues</label>
                </div>
              </div>
            </div>

            {/* Access Control */}
            <div>
              <h4 className="font-medium mb-3">Access Control</h4>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="public-access"
                    checked={shareConfig.access.isPublic}
                    onCheckedChange={(checked) => 
                      setShareConfig(prev => ({
                        ...prev,
                        access: { ...prev.access, isPublic: !!checked }
                      }))
                    }
                  />
                  <label htmlFor="public-access" className="text-sm">Public Access</label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="require-auth"
                    checked={shareConfig.access.requireAuth}
                    onCheckedChange={(checked) => 
                      setShareConfig(prev => ({
                        ...prev,
                        access: { ...prev.access, requireAuth: !!checked }
                      }))
                    }
                  />
                  <label htmlFor="require-auth" className="text-sm">Require Authentication</label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="allow-download"
                    checked={shareConfig.access.allowDownload}
                    onCheckedChange={(checked) => 
                      setShareConfig(prev => ({
                        ...prev,
                        access: { ...prev.access, allowDownload: !!checked }
                      }))
                    }
                  />
                  <label htmlFor="allow-download" className="text-sm">Allow Downloads</label>
                </div>

                <div>
                  <label className="text-sm font-medium">Expiration</label>
                  <Select 
                    value={shareConfig.expiration} 
                    onValueChange={(value) => 
                      setShareConfig(prev => ({ ...prev, expiration: value }))
                    }
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1d">1 Day</SelectItem>
                      <SelectItem value="7d">7 Days</SelectItem>
                      <SelectItem value="30d">30 Days</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Expires: {shareConfig.expiration === 'never' 
                ? 'Never' 
                : getExpirationDate(shareConfig.expiration).toLocaleDateString()
              }
            </div>
            <Button 
              onClick={createSharedReport} 
              disabled={isCreating}
              className="flex items-center gap-2"
            >
              <Link className="h-4 w-4" />
              {isCreating ? 'Creating...' : 'Create Shared Link'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Shared Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Shared Reports</CardTitle>
          <CardDescription>
            Manage your existing shared report links
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sharedReports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Share2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>No shared reports yet</p>
              <p className="text-sm">Create your first shared report above</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sharedReports.map((report) => (
                <div key={report.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{report.title}</h4>
                        <Badge variant={report.isPublic ? 'default' : 'secondary'}>
                          {report.isPublic ? 'Public' : 'Private'}
                        </Badge>
                        {isExpired(report.expiresAt) && (
                          <Badge variant="destructive">Expired</Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Created: {report.createdAt.toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires: {report.expiresAt.toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            Views: {report.accessCount}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 p-2 bg-gray-50 rounded text-sm font-mono break-all">
                        {report.url}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(report.url)}
                      className="flex items-center gap-1"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(report.url, '_blank')}
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const subject = encodeURIComponent(`Baseline Analysis Report: ${report.title}`);
                        const body = encodeURIComponent(`Please find the baseline analysis report at: ${report.url}`);
                        window.open(`mailto:?subject=${subject}&body=${body}`);
                      }}
                      className="flex items-center gap-1"
                    >
                      <Mail className="h-3 w-3" />
                      Email
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteSharedReport(report.id)}
                      className="flex items-center gap-1 ml-auto"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sharing Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Sharing Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <div>
                <strong>Public Access:</strong> Anyone with the link can view the report without authentication
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <div>
                <strong>Private Access:</strong> Viewers must be authenticated users in your organization
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <div>
                <strong>Expiration:</strong> Links automatically expire based on your settings for security
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <div>
                <strong>Download Control:</strong> You can allow or prevent viewers from downloading reports
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
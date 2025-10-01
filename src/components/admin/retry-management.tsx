'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  BarChart3,
  Clock,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';

interface RetryStatistics {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  averageRetryCount: number;
  retryReasons: { [key: string]: number };
}

interface FailedAnalysis {
  id: string;
  repositoryUrl: string;
  status: string;
  createdAt: string;
  lastError?: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string;
  isRetryable: boolean;
}

export function RetryManagement() {
  const [statistics, setStatistics] = useState<RetryStatistics | null>(null);
  const [failedAnalyses, setFailedAnalyses] = useState<FailedAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string[]>([]);
  const [selectedAnalyses, setSelectedAnalyses] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch retry statistics
      const statsResponse = await fetch('/api/admin/retry/statistics');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStatistics(statsData);
      }

      // Fetch failed analyses
      const failedResponse = await fetch('/api/admin/retry/failed-analyses');
      if (failedResponse.ok) {
        const failedData = await failedResponse.json();
        setFailedAnalyses(failedData.analyses);
      }
    } catch (error) {
      toast.error('Failed to load retry data');
    } finally {
      setLoading(false);
    }
  };

  const retryAnalysis = async (analysisId: string) => {
    try {
      setRetrying(prev => [...prev, analysisId]);
      
      const response = await fetch('/api/admin/retry/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisIds: [analysisId] }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Retry failed');
      }

      toast.success('Analysis retry initiated');
      await fetchData(); // Refresh data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Retry failed');
    } finally {
      setRetrying(prev => prev.filter(id => id !== analysisId));
    }
  };

  const bulkRetry = async () => {
    if (selectedAnalyses.length === 0) {
      toast.error('Please select analyses to retry');
      return;
    }

    try {
      setRetrying(prev => [...prev, ...selectedAnalyses]);
      
      const response = await fetch('/api/admin/retry/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisIds: selectedAnalyses }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Bulk retry failed');
      }

      const result = await response.json();
      toast.success(`Retried ${result.successful} analyses successfully`);
      
      if (result.failed > 0) {
        toast.warning(`${result.failed} analyses could not be retried`);
      }

      setSelectedAnalyses([]);
      await fetchData(); // Refresh data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bulk retry failed');
    } finally {
      setRetrying([]);
    }
  };

  const toggleAnalysisSelection = (analysisId: string) => {
    setSelectedAnalyses(prev => 
      prev.includes(analysisId)
        ? prev.filter(id => id !== analysisId)
        : [...prev, analysisId]
    );
  };

  const selectAllRetryable = () => {
    const retryableIds = failedAnalyses
      .filter(analysis => analysis.isRetryable)
      .map(analysis => analysis.id);
    setSelectedAnalyses(retryableIds);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (analysis: FailedAnalysis) => {
    if (analysis.isRetryable) {
      return <Badge variant="secondary">Retryable</Badge>;
    } else {
      return <Badge variant="destructive">Max Retries Exceeded</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Retry Management</h2>
          <p className="text-muted-foreground">
            Monitor and manage failed analysis retries
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="statistics" className="w-full">
        <TabsList>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          <TabsTrigger value="failed-analyses">Failed Analyses</TabsTrigger>
        </TabsList>

        <TabsContent value="statistics" className="space-y-4">
          {statistics && (
            <>
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Retries</CardTitle>
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{statistics.totalRetries}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Successful Retries</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {statistics.successfulRetries}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Failed Retries</CardTitle>
                    <XCircle className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {statistics.failedRetries}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Retry Count</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {statistics.averageRetryCount.toFixed(1)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Retry Reasons */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Retry Reasons
                  </CardTitle>
                  <CardDescription>
                    Common reasons for analysis failures and retries
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(statistics.retryReasons)
                      .sort(([, a], [, b]) => b - a)
                      .map(([reason, count]) => (
                        <div key={reason} className="flex items-center justify-between">
                          <span className="text-sm">{reason}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full"
                                style={{
                                  width: `${(count / Math.max(...Object.values(statistics.retryReasons))) * 100}%`
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium w-8 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="failed-analyses" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                onClick={selectAllRetryable}
                variant="outline"
                size="sm"
              >
                Select All Retryable
              </Button>
              {selectedAnalyses.length > 0 && (
                <Button
                  onClick={bulkRetry}
                  disabled={retrying.length > 0}
                  size="sm"
                >
                  {retrying.length > 0 ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry Selected ({selectedAnalyses.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {failedAnalyses.map((analysis) => (
              <Card key={analysis.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedAnalyses.includes(analysis.id)}
                        onChange={() => toggleAnalysisSelection(analysis.id)}
                        disabled={!analysis.isRetryable}
                        className="rounded"
                      />
                      <div>
                        <div className="font-medium">{analysis.repositoryUrl}</div>
                        <div className="text-sm text-muted-foreground">
                          Failed: {formatDate(analysis.createdAt)}
                        </div>
                        {analysis.lastError && (
                          <div className="text-sm text-red-600 mt-1">
                            {analysis.lastError}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-right text-sm">
                        <div>Retries: {analysis.retryCount}/{analysis.maxRetries}</div>
                        {analysis.nextRetryAt && (
                          <div className="text-muted-foreground">
                            Next: {formatDate(analysis.nextRetryAt)}
                          </div>
                        )}
                      </div>
                      
                      {getStatusBadge(analysis)}
                      
                      <Button
                        onClick={() => retryAnalysis(analysis.id)}
                        disabled={!analysis.isRetryable || retrying.includes(analysis.id)}
                        size="sm"
                        variant="outline"
                      >
                        {retrying.includes(analysis.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {failedAnalyses.length === 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  No failed analyses found. All analyses are either completed or in progress.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
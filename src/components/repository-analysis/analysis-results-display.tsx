'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

import { useRepositoryAnalysis } from '@/lib/hooks/use-repository-analysis';
import { 
  BarChart3, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  Target,
  Download,
  Share2,
  RefreshCw,
  ExternalLink,
  Zap,

} from 'lucide-react';

interface AnalysisResultsDisplayProps {
  analysisId: string;
}

interface AnalysisResults {
  complianceScore: number;
  recommendations: Recommendation[];
  baselineMatches: BaselineMatch[];
  issues: Issue[];
  tokensUsed?: number;
  provider?: string;
  model?: string;
  processingTime?: number;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  actionItems?: string[];
  resources?: string[];
}

interface BaselineMatch {
  feature: string;
  status: 'baseline' | 'limited' | 'not-baseline';
  confidence?: number;
  description?: string;
  documentation?: string;
}

interface Issue {
  id: string;
  title: string;
  description: string;
  type: 'error' | 'warning' | 'info';
  file?: string;
  line?: number;
  suggestion?: string;
}

export function AnalysisResultsDisplay({ analysisId }: AnalysisResultsDisplayProps) {
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    currentAnalysis,
    getAnalysisById
  } = useRepositoryAnalysis();

  useEffect(() => {
    loadAnalysisResults();
  }, [loadAnalysisResults]);

  const loadAnalysisResults = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const analysis = await getAnalysisById(analysisId);
      if (analysis?.results) {
        setResults(analysis.results);
      } else {
        setError('No results available for this analysis');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results');
    } finally {
      setIsLoading(false);
    }
  }, [analysisId, getAnalysisById]);

  const handleDownloadReport = async (format: 'pdf' | 'json') => {
    if (!currentAnalysis || !results) return;

    try {
      const reportData = {
        analysis: currentAnalysis,
        results: results,
        generatedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentAnalysis.repositoryName}-analysis-report.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download report:', error);
    }
  };

  const handleShareResults = async () => {
    if (!currentAnalysis) return;

    try {
      const shareUrl = `${window.location.origin}/repository-analysis/shared/${analysisId}`;
      
      if (navigator.share) {
        await navigator.share({
          title: `Analysis Results: ${currentAnalysis.repositoryName}`,
          text: `Check out the baseline analysis results for ${currentAnalysis.repositoryName}`,
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        // You could show a toast notification here
        alert('Share link copied to clipboard!');
      }
    } catch (error) {
      console.error('Failed to share results:', error);
    }
  };

  const getComplianceColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getComplianceLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'baseline': return 'default';
      case 'limited': return 'secondary';
      case 'not-baseline': return 'destructive';
      default: return 'secondary';
    }
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'info': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-600">Loading analysis results...</p>
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
            <AlertCircle className="h-8 w-8 mx-auto text-red-400" />
            <p className="text-red-600">{error}</p>
            <Button onClick={loadAnalysisResults} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!results || !currentAnalysis) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <BarChart3 className="h-8 w-8 mx-auto text-gray-400" />
            <p className="text-gray-600">No results available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Results Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Analysis Results
              </CardTitle>
              <CardDescription>
                {currentAnalysis.repositoryName} • Completed {currentAnalysis.analysisDate.toLocaleString()}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => handleDownloadReport('json')} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button onClick={handleShareResults} variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className={`text-3xl font-bold ${getComplianceColor(results.complianceScore)}`}>
                {results.complianceScore}
              </div>
              <div className="text-sm text-gray-600">Compliance Score</div>
              <div className={`text-xs font-medium ${getComplianceColor(results.complianceScore)}`}>
                {getComplianceLabel(results.complianceScore)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{results.recommendations.length}</div>
              <div className="text-sm text-gray-600">Recommendations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{results.baselineMatches.length}</div>
              <div className="text-sm text-gray-600">Baseline Features</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{results.issues.length}</div>
              <div className="text-sm text-gray-600">Issues Found</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{currentAnalysis.creditsCost || 0}</div>
              <div className="text-sm text-gray-600">Credits Used</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Score Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Baseline Compliance Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Compliance Score</span>
              <span className={getComplianceColor(results.complianceScore)}>
                {results.complianceScore}/100
              </span>
            </div>
            <Progress value={results.complianceScore} className="w-full" />
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-lg font-bold text-green-600">
                {results.baselineMatches.filter(m => m.status === 'baseline').length}
              </div>
              <div className="text-sm text-gray-600">Baseline Features</div>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-yellow-600">
                {results.baselineMatches.filter(m => m.status === 'limited').length}
              </div>
              <div className="text-sm text-gray-600">Limited Support</div>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-red-600">
                {results.baselineMatches.filter(m => m.status === 'not-baseline').length}
              </div>
              <div className="text-sm text-gray-600">Not Baseline</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results Tabs */}
      <Tabs defaultValue="recommendations" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="recommendations">
            Recommendations ({results.recommendations.length})
          </TabsTrigger>
          <TabsTrigger value="features">
            Baseline Features ({results.baselineMatches.length})
          </TabsTrigger>
          <TabsTrigger value="issues">
            Issues ({results.issues.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-4">
          {results.recommendations.length > 0 ? (
            results.recommendations.map((rec, index) => (
              <Card key={rec.id || index}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{rec.title}</CardTitle>
                      <CardDescription>{rec.category}</CardDescription>
                    </div>
                    <Badge variant={getPriorityColor(rec.priority)}>
                      {rec.priority} priority
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-gray-700">{rec.description}</p>
                  
                  {rec.actionItems && rec.actionItems.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Action Items:</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                        {rec.actionItems.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {rec.resources && rec.resources.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Resources:</h4>
                      <div className="flex flex-wrap gap-2">
                        {rec.resources.map((resource, i) => (
                          <a
                            key={i}
                            href={resource}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                          >
                            {resource}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center p-8">
                <div className="text-center space-y-2">
                  <TrendingUp className="h-8 w-8 mx-auto text-gray-400" />
                  <p className="text-gray-600">No recommendations available</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          {results.baselineMatches.length > 0 ? (
            <div className="grid gap-3">
              {results.baselineMatches.map((match, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{match.feature}</div>
                        {match.description && (
                          <div className="text-sm text-gray-600 mt-1">{match.description}</div>
                        )}
                        {match.documentation && (
                          <a
                            href={match.documentation}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1"
                          >
                            Documentation
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusColor(match.status)}>
                          {match.status}
                        </Badge>
                        {match.confidence && (
                          <span className="text-sm text-gray-500">
                            {Math.round(match.confidence * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center p-8">
                <div className="text-center space-y-2">
                  <Target className="h-8 w-8 mx-auto text-gray-400" />
                  <p className="text-gray-600">No baseline features detected</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          {results.issues.length > 0 ? (
            results.issues.map((issue, index) => (
              <Card key={issue.id || index}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {getIssueIcon(issue.type)}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{issue.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{issue.description}</p>
                        </div>
                        <Badge variant={issue.type === 'error' ? 'destructive' : 'secondary'}>
                          {issue.type}
                        </Badge>
                      </div>
                      
                      {issue.file && (
                        <div className="text-xs text-gray-500 mt-2">
                          File: {issue.file}{issue.line && `:${issue.line}`}
                        </div>
                      )}

                      {issue.suggestion && (
                        <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded mt-2">
                          <strong>Suggestion:</strong> {issue.suggestion}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center p-8">
                <div className="text-center space-y-2">
                  <CheckCircle className="h-8 w-8 mx-auto text-green-400" />
                  <p className="text-gray-600">No issues found</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Analysis Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Analysis Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-600">AI Provider</div>
              <div className="font-medium">{results.provider || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-gray-600">Model</div>
              <div className="font-medium">{results.model || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-gray-600">Processing Time</div>
              <div className="font-medium">
                {results.processingTime ? `${(results.processingTime / 1000).toFixed(1)}s` : 'Unknown'}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Tokens Used</div>
              <div className="font-medium">{results.tokensUsed || 'Unknown'}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
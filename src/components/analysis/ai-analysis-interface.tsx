'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useAIAnalysis } from '@/lib/hooks/use-ai-analysis';
import { useCreditBalance } from '@/lib/hooks/use-credit-balance';
import { AlertCircle, CheckCircle, Clock, Zap, TrendingUp, AlertTriangle } from 'lucide-react';

export function AIAnalysisInterface() {
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [analysisType, setAnalysisType] = useState<'compatibility' | 'recommendations' | 'full'>('full');
  
  const {
    isAnalyzing,
    isEstimating,
    result,
    estimate,
    error,
    progress,
    estimateAnalysisCost,
    analyzeRepository,
    clearError,
    clearResult
  } = useAIAnalysis();

  const { balance, refreshBalance } = useCreditBalance();

  const handleEstimate = async () => {
    if (!repositoryUrl.trim()) return;
    
    try {
      clearError();
      await estimateAnalysisCost(repositoryUrl.trim());
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleAnalyze = async () => {
    if (!repositoryUrl.trim()) return;
    
    try {
      clearError();
      await analyzeRepository(repositoryUrl.trim(), analysisType);
      await refreshBalance(); // Refresh balance after analysis
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleNewAnalysis = () => {
    clearResult();
    setRepositoryUrl('');
  };

  const canAffordAnalysis = estimate ? balance >= estimate.creditsCost : true;

  return (
    <div className="space-y-6">
      {/* Analysis Form */}
      {!result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              AI Repository Analysis
            </CardTitle>
            <CardDescription>
              Analyze your repository against web platform baseline standards using AI
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repository-url">Repository URL</Label>
              <Input
                id="repository-url"
                type="url"
                placeholder="https://github.com/username/repository"
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
                disabled={isAnalyzing || isEstimating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="analysis-type">Analysis Type</Label>
              <Select value={analysisType} onValueChange={(value: any) => setAnalysisType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compatibility">Compatibility Check</SelectItem>
                  <SelectItem value="recommendations">Recommendations Only</SelectItem>
                  <SelectItem value="full">Full Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleEstimate}
                variant="outline"
                disabled={!repositoryUrl.trim() || isAnalyzing || isEstimating}
              >
                {isEstimating ? 'Estimating...' : 'Get Cost Estimate'}
              </Button>
              
              <Button
                onClick={handleAnalyze}
                disabled={!repositoryUrl.trim() || isAnalyzing || isEstimating || (estimate && !canAffordAnalysis)}
              >
                {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
              </Button>
            </div>

            {isAnalyzing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Analysis Progress</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cost Estimate */}
      {estimate && !result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Analysis Estimate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-600">Repository</Label>
                <p className="font-medium">{estimate.repositoryInfo.name}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Owner</Label>
                <p className="font-medium">{estimate.repositoryInfo.owner}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Estimated Files</Label>
                <p className="font-medium">{estimate.estimatedMetadata.fileCount}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Estimated Size</Label>
                <p className="font-medium">{Math.round(estimate.estimatedMetadata.totalSize / 1024)} KB</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm text-gray-600">Analysis Cost</Label>
                <p className="text-2xl font-bold">{estimate.creditsCost} credits</p>
              </div>
              <div className="text-right">
                <Label className="text-sm text-gray-600">Your Balance</Label>
                <p className={`text-lg font-medium ${canAffordAnalysis ? 'text-green-600' : 'text-red-600'}`}>
                  {balance} credits
                </p>
              </div>
            </div>

            {!canAffordAnalysis && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-700">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">
                  Insufficient credits. You need {estimate.creditsCost - balance} more credits.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Analysis Results */}
      {result && (
        <div className="space-y-6">
          {/* Results Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Analysis Complete
                  </CardTitle>
                  <CardDescription>
                    {result.repositoryMetadata.repositoryName} • {result.creditsCost} credits used
                  </CardDescription>
                </div>
                <Button onClick={handleNewAnalysis} variant="outline">
                  New Analysis
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{result.complianceScore}</div>
                  <div className="text-sm text-gray-600">Compliance Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{result.recommendations.length}</div>
                  <div className="text-sm text-gray-600">Recommendations</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{result.baselineMatches.length}</div>
                  <div className="text-sm text-gray-600">Baseline Features</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{result.issues.length}</div>
                  <div className="text-sm text-gray-600">Issues Found</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.recommendations.map((rec, index) => (
                  <div key={rec.id || index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium">{rec.title}</h4>
                      <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}>
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{rec.description}</p>
                    
                    {rec.actionItems && rec.actionItems.length > 0 && (
                      <div className="mb-3">
                        <Label className="text-sm font-medium">Action Items:</Label>
                        <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                          {rec.actionItems.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {rec.resources && rec.resources.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium">Resources:</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {rec.resources.map((resource, i) => (
                            <a
                              key={i}
                              href={resource}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {resource}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Baseline Features */}
          {result.baselineMatches.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Baseline Feature Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {result.baselineMatches.map((match, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{match.feature}</div>
                        {match.description && (
                          <div className="text-sm text-gray-600">{match.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={
                            match.status === 'baseline' ? 'default' : 
                            match.status === 'limited' ? 'secondary' : 
                            'destructive'
                          }
                        >
                          {match.status}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {Math.round((match.confidence || 0) * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Issues */}
          {result.issues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Issues Found
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.issues.map((issue, index) => (
                    <div key={issue.id || index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium">{issue.title}</h4>
                        <Badge variant={issue.type === 'error' ? 'destructive' : issue.type === 'warning' ? 'default' : 'secondary'}>
                          {issue.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{issue.description}</p>
                      
                      {issue.file && (
                        <div className="text-xs text-gray-500 mb-2">
                          File: {issue.file}{issue.line && `:${issue.line}`}
                        </div>
                      )}

                      {issue.suggestion && (
                        <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                          <strong>Suggestion:</strong> {issue.suggestion}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
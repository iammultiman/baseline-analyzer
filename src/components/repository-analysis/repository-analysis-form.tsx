'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useRepositoryProcessor } from '@/lib/hooks/use-repository-processor';
import { useRepositoryAnalysis } from '@/lib/hooks/use-repository-analysis';
import { useCreditBalance } from '@/lib/hooks/use-credit-balance';
import { ValidationResult } from '@/lib/types/repository';
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Github, 
  GitBranch, 
  Lock, 
  Unlock,
  AlertTriangle,
  Zap,

  DollarSign
} from 'lucide-react';

interface RepositoryAnalysisFormProps {
  onAnalysisStarted?: () => void;
}

interface EstimateResponse {
  creditsCost: number;
  estimatedMetadata: {
    fileCount: number;
    totalSize: number;
  };
}

export function RepositoryAnalysisForm({ onAnalysisStarted }: RepositoryAnalysisFormProps) {
  const [url, setUrl] = useState('');
  const [analysisType, setAnalysisType] = useState<'compatibility' | 'recommendations' | 'full'>('full');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [hasValidated, setHasValidated] = useState(false);
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);

  const {
    validateRepository,
    validationLoading,
    validationError
  } = useRepositoryProcessor();

  const {
    submitAnalysis,
    isLoading: analysisLoading,
    error: analysisError
  } = useRepositoryAnalysis();

  const { balance, refreshBalance } = useCreditBalance();

  const handleValidate = async () => {
    if (!url.trim()) return;

    const result = await validateRepository(url.trim());
    setValidation(result);
    setHasValidated(true);

    // Get cost estimate if validation succeeds
    if (result.isValid) {
      await getEstimate();
    }
  };

  const getEstimate = async () => {
    if (!url.trim()) return;

    try {
      const response = await fetch('/api/analysis/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repositoryUrl: url.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setEstimate(data.estimate);
      }
    } catch (error) {
      console.error('Failed to get estimate:', error);
    }
  };

  const handleSubmit = async () => {
    if (!validation?.isValid || !estimate) return;

    try {
      await submitAnalysis(url.trim(), analysisType, priority);
      await refreshBalance(); // Refresh balance after submission
      
      if (onAnalysisStarted) {
        onAnalysisStarted();
      }
    } catch {
      // Error is handled by the hook
    }
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setValidation(null);
    setHasValidated(false);
    setEstimate(null);
  };

  const isValidUrl = url.trim().length > 0;
  const canValidate = isValidUrl && !validationLoading;
  const canAffordAnalysis = estimate ? balance >= estimate.creditsCost : true;
  const canSubmit = validation?.isValid && estimate && canAffordAnalysis && !analysisLoading;

  const getAnalysisTypeDescription = (type: string) => {
    switch (type) {
      case 'compatibility':
        return 'Quick analysis focused on browser compatibility and baseline feature support';
      case 'recommendations':
        return 'Focused analysis that provides specific, actionable recommendations for improvement';
      case 'full':
        return 'Comprehensive analysis including compatibility, recommendations, and detailed insights';
      default:
        return '';
    }
  };

  const getPriorityDescription = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'Standard processing time (5-10 minutes)';
      case 'normal':
        return 'Normal processing time (2-5 minutes)';
      case 'high':
        return 'Priority processing (1-2 minutes)';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Repository Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            Repository Information
          </CardTitle>
          <CardDescription>
            Enter a GitHub or GitLab repository URL to analyze against web platform baseline standards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repository-url">Repository URL</Label>
            <div className="flex gap-2">
              <Input
                id="repository-url"
                placeholder="https://github.com/username/repository"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleValidate}
                disabled={!canValidate}
                variant="outline"
              >
                {validationLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Validate'
                )}
              </Button>
            </div>
          </div>

          {validationError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
              <XCircle className="h-4 w-4" />
              {validationError}
            </div>
          )}

          {hasValidated && validation && (
            <div className="space-y-3">
              {validation.isValid ? (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-md">
                  <CheckCircle className="h-4 w-4" />
                  Repository is valid and accessible
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  <XCircle className="h-4 w-4" />
                  {validation.error}
                </div>
              )}

              {validation.repositoryInfo && (
                <div className="bg-gray-50 p-4 rounded-md space-y-3">
                  <h4 className="font-medium text-sm">Repository Details</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Github className="h-4 w-4" />
                      <span className="font-medium">{validation.repositoryInfo.owner}/{validation.repositoryInfo.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      <span>{validation.repositoryInfo.branch || 'main'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {validation.repositoryInfo.isPrivate ? (
                        <Lock className="h-4 w-4 text-red-500" />
                      ) : (
                        <Unlock className="h-4 w-4 text-green-500" />
                      )}
                      <Badge variant={validation.repositoryInfo.isPrivate ? "destructive" : "secondary"}>
                        {validation.repositoryInfo.isPrivate ? 'Private' : 'Public'}
                      </Badge>
                    </div>
                    {validation.repositoryInfo.size && (
                      <div className="text-gray-600">
                        Size: {Math.round(validation.repositoryInfo.size / 1024)} KB
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Configuration */}
      {validation?.isValid && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Analysis Configuration
            </CardTitle>
            <CardDescription>
              Configure the type and priority of your analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="analysis-type">Analysis Type</Label>
                <Select value={analysisType} onValueChange={(value: 'compatibility' | 'recommendations' | 'full') => setAnalysisType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compatibility">Compatibility Check</SelectItem>
                    <SelectItem value="recommendations">Recommendations Only</SelectItem>
                    <SelectItem value="full">Full Analysis</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-600">
                  {getAnalysisTypeDescription(analysisType)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Processing Priority</Label>
                <Select value={priority} onValueChange={(value: 'low' | 'normal' | 'high') => setPriority(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low Priority</SelectItem>
                    <SelectItem value="normal">Normal Priority</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-600">
                  {getPriorityDescription(priority)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost Estimate */}
      {estimate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Estimate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-600">Estimated Files</Label>
                <p className="text-lg font-medium">{estimate.estimatedMetadata.fileCount}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Estimated Size</Label>
                <p className="text-lg font-medium">{Math.round(estimate.estimatedMetadata.totalSize / 1024)} KB</p>
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
                  Insufficient credits. You need {estimate.creditsCost - balance} more credits to run this analysis.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {analysisError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
          <XCircle className="h-4 w-4" />
          {analysisError}
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSubmit}
          disabled={!canSubmit}
          size="lg"
          className="min-w-40"
        >
          {analysisLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Starting Analysis...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Start Analysis
            </>
          )}
        </Button>
      </div>

      {/* Information */}
      <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-3 rounded-md">
        <p className="font-medium">Analysis Information:</p>
        <p>• Analysis uses AI to evaluate your code against web platform baseline standards</p>
        <p>• Processing time varies based on repository size and selected priority</p>
        <p>• Credits are deducted only when analysis starts successfully</p>
        <p>• You can track progress and view results in real-time</p>
      </div>
    </div>
  );
}
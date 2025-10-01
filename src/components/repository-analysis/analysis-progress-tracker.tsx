'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

import { useRepositoryAnalysis } from '@/lib/hooks/use-repository-analysis';
import { 
  Clock, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Timer,
  Zap,
  GitBranch,
  BarChart3,
  RefreshCw
} from 'lucide-react';

interface AnalysisProgressTrackerProps {
  analysisId: string;
  onCompleted?: () => void;
}

export function AnalysisProgressTracker({ onCompleted }: AnalysisProgressTrackerProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [startTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState(0);

  const {
    currentAnalysis,
    updateAnalysisStatus,
    isLoading,
    error
  } = useRepositoryAnalysis();

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((new Date().getTime() - startTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  // Update progress based on analysis status
  useEffect(() => {
    if (!currentAnalysis) return;

    switch (currentAnalysis.status) {
      case 'PENDING':
        setProgress(10);
        setCurrentStep('Queued for processing');
        break;
      case 'PROCESSING':
        setProgress(50);
        setCurrentStep('Analyzing repository content');
        break;
      case 'COMPLETED':
        setProgress(100);
        setCurrentStep('Analysis completed');
        if (onCompleted) {
          onCompleted();
        }
        break;
      case 'FAILED':
        setProgress(0);
        setCurrentStep('Analysis failed');
        break;
    }
  }, [currentAnalysis, onCompleted]);

  const handleRefresh = async () => {
    if (currentAnalysis) {
      await updateAnalysisStatus(currentAnalysis.id);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStatusIcon = () => {
    if (!currentAnalysis) return <Loader2 className="h-5 w-5 animate-spin" />;
    
    switch (currentAnalysis.status) {
      case 'PENDING':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'PROCESSING':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'COMPLETED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin" />;
    }
  };

  const getStatusBadge = () => {
    if (!currentAnalysis) return <Badge variant="secondary">Loading...</Badge>;
    
    switch (currentAnalysis.status) {
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>;
      case 'PROCESSING':
        return <Badge variant="default">Processing</Badge>;
      case 'COMPLETED':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (!currentAnalysis) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-600">Loading analysis details...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Progress Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <CardTitle>Analysis Progress</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <CardDescription>
            {currentAnalysis.repositoryUrl}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{currentStep}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>

          {/* Analysis Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-sm text-gray-600">Repository</div>
              <div className="font-medium truncate">{currentAnalysis.repositoryName}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Type</div>
              <div className="font-medium capitalize">
                {currentAnalysis.metadata?.analysisType || 'Full'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Priority</div>
              <div className="font-medium capitalize">
                {currentAnalysis.metadata?.priority || 'Normal'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Elapsed Time</div>
              <div className="font-medium">{formatDuration(elapsedTime)}</div>
            </div>
          </div>

          {/* Status-specific Information */}
          {currentAnalysis.status === 'PENDING' && (
            <div className="bg-yellow-50 p-4 rounded-md">
              <div className="flex items-center gap-2 text-sm font-medium text-yellow-700">
                <Clock className="h-4 w-4" />
                Analysis Queued
              </div>
              <div className="text-sm text-yellow-600 mt-1">
                Your analysis is in the queue and will start processing shortly. 
                Estimated wait time: {currentAnalysis.metadata?.estimatedTime || '2-5 minutes'}
              </div>
            </div>
          )}

          {currentAnalysis.status === 'PROCESSING' && (
            <div className="bg-blue-50 p-4 rounded-md">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                <Zap className="h-4 w-4" />
                AI Analysis in Progress
              </div>
              <div className="text-sm text-blue-600 mt-1">
                Our AI is analyzing your repository against web platform baseline standards. 
                This process typically takes 2-5 minutes depending on repository size.
              </div>
            </div>
          )}

          {currentAnalysis.status === 'COMPLETED' && (
            <div className="bg-green-50 p-4 rounded-md">
              <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                <CheckCircle className="h-4 w-4" />
                Analysis Completed Successfully
              </div>
              <div className="text-sm text-green-600 mt-1">
                Your repository analysis is complete! 
                {currentAnalysis.creditsCost && ` Credits used: ${currentAnalysis.creditsCost}`}
              </div>
            </div>
          )}

          {currentAnalysis.status === 'FAILED' && (
            <div className="bg-red-50 p-4 rounded-md">
              <div className="flex items-center gap-2 text-sm font-medium text-red-700">
                <XCircle className="h-4 w-4" />
                Analysis Failed
              </div>
              <div className="text-sm text-red-600 mt-1">
                {currentAnalysis.metadata?.error || 'The analysis encountered an error and could not be completed.'}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 p-4 rounded-md">
              <div className="flex items-center gap-2 text-sm font-medium text-red-700">
                <AlertCircle className="h-4 w-4" />
                Error
              </div>
              <div className="text-sm text-red-600 mt-1">{error}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Analysis Steps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className={`flex items-center gap-3 ${progress >= 10 ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                progress >= 10 ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                {progress >= 10 ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <span className="text-sm font-medium">1</span>
                )}
              </div>
              <div>
                <div className="font-medium">Repository Validation</div>
                <div className="text-sm text-gray-600">Validate repository access and extract metadata</div>
              </div>
            </div>

            <div className={`flex items-center gap-3 ${progress >= 30 ? 'text-green-600' : progress >= 10 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                progress >= 30 ? 'bg-green-100' : progress >= 10 ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                {progress >= 30 ? (
                  <CheckCircle className="h-4 w-4" />
                ) : progress >= 10 ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-sm font-medium">2</span>
                )}
              </div>
              <div>
                <div className="font-medium">Content Processing</div>
                <div className="text-sm text-gray-600">Extract and process repository files</div>
              </div>
            </div>

            <div className={`flex items-center gap-3 ${progress >= 70 ? 'text-green-600' : progress >= 30 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                progress >= 70 ? 'bg-green-100' : progress >= 30 ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                {progress >= 70 ? (
                  <CheckCircle className="h-4 w-4" />
                ) : progress >= 30 ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-sm font-medium">3</span>
                )}
              </div>
              <div>
                <div className="font-medium">AI Analysis</div>
                <div className="text-sm text-gray-600">Analyze code against baseline standards using AI</div>
              </div>
            </div>

            <div className={`flex items-center gap-3 ${progress >= 100 ? 'text-green-600' : progress >= 70 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                progress >= 100 ? 'bg-green-100' : progress >= 70 ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                {progress >= 100 ? (
                  <CheckCircle className="h-4 w-4" />
                ) : progress >= 70 ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-sm font-medium">4</span>
                )}
              </div>
              <div>
                <div className="font-medium">Results Generation</div>
                <div className="text-sm text-gray-600">Generate recommendations and compliance report</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {currentAnalysis.status === 'COMPLETED' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button onClick={onCompleted} className="flex-1">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Results
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Metadata */}
      <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-3 rounded-md">
        <div className="flex items-center gap-2">
          <Timer className="h-3 w-3" />
          <span>Started: {currentAnalysis.analysisDate.toLocaleString()}</span>
        </div>
        <div>Analysis ID: {currentAnalysis.id}</div>
        {currentAnalysis.metadata?.estimatedTime && (
          <div>Estimated completion: {currentAnalysis.metadata.estimatedTime}</div>
        )}
      </div>
    </div>
  );
}
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RepositoryAnalysisForm } from '@/components/repository-analysis/repository-analysis-form';
import { AnalysisProgressTracker } from '@/components/repository-analysis/analysis-progress-tracker';
import { AnalysisResultsDisplay } from '@/components/repository-analysis/analysis-results-display';
import { RepositoryHistoryManager } from '@/components/repository-analysis/repository-history-manager';
import { useRepositoryAnalysis } from '@/lib/hooks/use-repository-analysis';
import { GitBranch, History, BarChart3, Zap } from 'lucide-react';

export default function RepositoryAnalysisPage() {
  const [activeTab, setActiveTab] = useState('analyze');
  const {
    currentAnalysis,
    analysisHistory,
    isLoading,
    error,
    refreshHistory
  } = useRepositoryAnalysis();

  useEffect(() => {
    // Load analysis history on page load
    refreshHistory();
  }, [refreshHistory]);

  // Switch to results tab when analysis completes
  useEffect(() => {
    if (currentAnalysis?.status === 'COMPLETED') {
      setActiveTab('results');
    }
  }, [currentAnalysis?.status]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Repository Analysis</h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Analyze your code repositories against web platform baseline standards. 
          Get detailed insights, compliance scores, and actionable recommendations.
        </p>
      </div>

      {/* Main Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="analyze" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Analyze
          </TabsTrigger>
          <TabsTrigger value="progress" className="flex items-center gap-2" disabled={!currentAnalysis}>
            <GitBranch className="h-4 w-4" />
            Progress
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2" disabled={!currentAnalysis || currentAnalysis.status !== 'COMPLETED'}>
            <BarChart3 className="h-4 w-4" />
            Results
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analyze" className="space-y-6">
          <RepositoryAnalysisForm 
            onAnalysisStarted={() => setActiveTab('progress')}
          />
        </TabsContent>

        <TabsContent value="progress" className="space-y-6">
          {currentAnalysis ? (
            <AnalysisProgressTracker 
              analysisId={currentAnalysis.id}
              onCompleted={() => setActiveTab('results')}
            />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center p-8">
                <div className="text-center space-y-2">
                  <GitBranch className="h-12 w-12 mx-auto text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-600">No Active Analysis</h3>
                  <p className="text-gray-500">Start an analysis to track its progress here.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {currentAnalysis?.status === 'COMPLETED' ? (
            <AnalysisResultsDisplay analysisId={currentAnalysis.id} />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center p-8">
                <div className="text-center space-y-2">
                  <BarChart3 className="h-12 w-12 mx-auto text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-600">No Results Available</h3>
                  <p className="text-gray-500">Complete an analysis to view detailed results here.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <RepositoryHistoryManager 
            analyses={analysisHistory}
            isLoading={isLoading}
            error={error}
            onRefresh={refreshHistory}
            onAnalysisSelect={(analysis) => {
              // Set as current analysis and switch to results
              if (analysis.status === 'COMPLETED') {
                setActiveTab('results');
              }
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Total Analyses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-center text-blue-600">
              {analysisHistory.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-center text-green-600">
              {analysisHistory.filter(a => a.status === 'COMPLETED').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-lg">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-center text-orange-600">
              {analysisHistory.filter(a => ['PENDING', 'PROCESSING'].includes(a.status)).length}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
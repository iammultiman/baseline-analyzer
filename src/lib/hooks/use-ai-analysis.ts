import { useState, useCallback } from 'react';
import { AnalysisEngineResponse } from '@/lib/services/ai-analysis-engine';

export interface AnalysisEstimate {
  creditsCost: number;
  repositoryInfo: {
    url: string;
    name: string;
    owner: string;
    isPrivate: boolean;
    size?: number;
    fileCount?: number;
  };
  estimatedMetadata: {
    fileCount: number;
    totalSize: number;
    repositoryName: string;
  };
}

export interface AnalysisState {
  isAnalyzing: boolean;
  isEstimating: boolean;
  result: AnalysisEngineResponse | null;
  estimate: AnalysisEstimate | null;
  error: string | null;
  progress: number;
}

export function useAIAnalysis() {
  const [state, setState] = useState<AnalysisState>({
    isAnalyzing: false,
    isEstimating: false,
    result: null,
    estimate: null,
    error: null,
    progress: 0
  });

  const estimateAnalysisCost = useCallback(async (repositoryUrl: string) => {
    setState(prev => ({ ...prev, isEstimating: true, error: null }));

    try {
      const response = await fetch('/api/analysis/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repositoryUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to estimate analysis cost');
      }

      setState(prev => ({
        ...prev,
        isEstimating: false,
        estimate: data.estimate,
        error: null
      }));

      return data.estimate;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isEstimating: false,
        error: errorMessage
      }));
      throw error;
    }
  }, []);

  const analyzeRepository = useCallback(async (
    repositoryUrl: string,
    analysisType: 'compatibility' | 'recommendations' | 'full' = 'full'
  ) => {
    setState(prev => ({ 
      ...prev, 
      isAnalyzing: true, 
      error: null, 
      result: null,
      progress: 0
    }));

    try {
      // Start analysis
      setState(prev => ({ ...prev, progress: 10 }));

      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repositoryUrl, analysisType }),
      });

      setState(prev => ({ ...prev, progress: 50 }));

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setState(prev => ({ ...prev, progress: 100 }));

      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        result: data.analysis,
        error: null,
        progress: 100
      }));

      return data.analysis;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: errorMessage,
        progress: 0
      }));
      throw error;
    }
  }, []);

  const getAnalysisById = useCallback(async (analysisId: string) => {
    setState(prev => ({ ...prev, isAnalyzing: true, error: null }));

    try {
      const response = await fetch(`/api/analysis/${analysisId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to retrieve analysis');
      }

      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        result: data.analysis,
        error: null
      }));

      return data.analysis;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: errorMessage
      }));
      throw error;
    }
  }, []);

  const deleteAnalysis = useCallback(async (analysisId: string) => {
    try {
      const response = await fetch(`/api/analysis/${analysisId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete analysis');
      }

      // Clear result if it matches the deleted analysis
      setState(prev => ({
        ...prev,
        result: prev.result?.analysisId === analysisId ? null : prev.result
      }));

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const clearResult = useCallback(() => {
    setState(prev => ({ ...prev, result: null, estimate: null }));
  }, []);

  return {
    ...state,
    estimateAnalysisCost,
    analyzeRepository,
    getAnalysisById,
    deleteAnalysis,
    clearError,
    clearResult
  };
}
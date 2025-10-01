import { useState, useCallback, useEffect } from 'react';

export interface RepositoryAnalysis {
  id: string;
  repositoryUrl: string;
  repositoryName: string;
  analysisDate: Date;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  creditsCost?: number;
  results?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AnalysisListResponse {
  success: boolean;
  analyses: RepositoryAnalysis[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AnalysisState {
  currentAnalysis: RepositoryAnalysis | null;
  analysisHistory: RepositoryAnalysis[];
  isLoading: boolean;
  error: string | null;
}

export function useRepositoryAnalysis() {
  const [state, setState] = useState<AnalysisState>({
    currentAnalysis: null,
    analysisHistory: [],
    isLoading: false,
    error: null
  });

  const submitAnalysis = useCallback(async (
    repositoryUrl: string,
    analysisType: 'compatibility' | 'recommendations' | 'full' = 'full',
    priority: 'low' | 'normal' | 'high' = 'normal'
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repositoryUrl, analysisType, priority }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit analysis');
      }

      // Create analysis object
      const analysis: RepositoryAnalysis = {
        id: data.analysisId,
        repositoryUrl,
        repositoryName: repositoryUrl.split('/').pop() || 'Unknown Repository',
        analysisDate: new Date(),
        status: data.status,
        metadata: {
          analysisType,
          priority,
          estimatedTime: data.estimatedTime
        }
      };

      setState(prev => ({
        ...prev,
        isLoading: false,
        currentAnalysis: analysis,
        analysisHistory: [analysis, ...prev.analysisHistory],
        error: null
      }));

      return analysis;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      throw error;
    }
  }, []);

  const getAnalysisById = useCallback(async (analysisId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/analysis/${analysisId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to retrieve analysis');
      }

      const analysis: RepositoryAnalysis = {
        id: data.analysis.id,
        repositoryUrl: data.analysis.repositoryUrl,
        repositoryName: data.analysis.repositoryName,
        analysisDate: new Date(data.analysis.analysisDate),
        status: data.analysis.status,
        creditsCost: data.analysis.creditsCost,
        results: data.analysis.results,
        metadata: data.analysis.metadata
      };

      setState(prev => ({
        ...prev,
        isLoading: false,
        currentAnalysis: analysis,
        error: null
      }));

      return analysis;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      throw error;
    }
  }, []);

  const refreshHistory = useCallback(async (
    page: number = 1,
    limit: number = 20,
    status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (status) {
        params.append('status', status);
      }

      const response = await fetch(`/api/analysis?${params}`);
      const data: AnalysisListResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.success ? 'Unknown error' : 'Failed to load analysis history');
      }

      const analyses = data.analyses.map(analysis => ({
        ...analysis,
        analysisDate: new Date(analysis.analysisDate)
      }));

      setState(prev => ({
        ...prev,
        isLoading: false,
        analysisHistory: analyses,
        error: null
      }));

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isLoading: false,
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

      // Remove from history and clear current if it matches
      setState(prev => ({
        ...prev,
        analysisHistory: prev.analysisHistory.filter(a => a.id !== analysisId),
        currentAnalysis: prev.currentAnalysis?.id === analysisId ? null : prev.currentAnalysis
      }));

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const updateAnalysisStatus = useCallback(async (analysisId: string) => {
    try {
      const response = await fetch(`/api/analysis/${analysisId}/status`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get analysis status');
      }

      const updatedAnalysis: RepositoryAnalysis = {
        id: data.analysis.id,
        repositoryUrl: data.analysis.repositoryUrl,
        repositoryName: data.analysis.repositoryName,
        analysisDate: new Date(data.analysis.analysisDate),
        status: data.analysis.status,
        creditsCost: data.analysis.creditsCost,
        results: data.analysis.results,
        metadata: data.analysis.metadata
      };

      setState(prev => ({
        ...prev,
        currentAnalysis: prev.currentAnalysis?.id === analysisId ? updatedAnalysis : prev.currentAnalysis,
        analysisHistory: prev.analysisHistory.map(a => 
          a.id === analysisId ? updatedAnalysis : a
        )
      }));

      return updatedAnalysis;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const clearCurrentAnalysis = useCallback(() => {
    setState(prev => ({ ...prev, currentAnalysis: null }));
  }, []);

  // Auto-refresh current analysis if it's in progress
  useEffect(() => {
    if (!state.currentAnalysis || 
        !['PENDING', 'PROCESSING'].includes(state.currentAnalysis.status)) {
      return;
    }

    const interval = setInterval(() => {
      updateAnalysisStatus(state.currentAnalysis!.id).catch(console.error);
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [state.currentAnalysis, updateAnalysisStatus]);

  return {
    ...state,
    submitAnalysis,
    getAnalysisById,
    refreshHistory,
    deleteAnalysis,
    updateAnalysisStatus,
    clearError,
    clearCurrentAnalysis
  };
}
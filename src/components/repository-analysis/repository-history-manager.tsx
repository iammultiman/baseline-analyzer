'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  History, 
  Search, 
  Filter, 
  RefreshCw, 
  Trash2, 
  Eye, 
  Download,
  Calendar,
  GitBranch,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { RepositoryAnalysis } from '@/lib/hooks/use-repository-analysis';

interface RepositoryHistoryManagerProps {
  analyses: RepositoryAnalysis[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onAnalysisSelect: (analysis: RepositoryAnalysis) => void;
}

export function RepositoryHistoryManager({
  analyses,
  isLoading,
  error,
  onRefresh,
  onAnalysisSelect
}: RepositoryHistoryManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'status'>('date');

  const filteredAnalyses = analyses
    .filter(analysis => {
      const matchesSearch = analysis.repositoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           analysis.repositoryUrl.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || analysis.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.repositoryName.localeCompare(b.repositoryName);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'date':
        default:
          return new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime();
      }
    });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'PROCESSING':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
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

  const handleDeleteAnalysis = async (analysisId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this analysis? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/analysis/${analysisId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onRefresh();
      } else {
        const data = await response.json();
        alert(`Failed to delete analysis: ${data.error}`);
      }
    } catch {
      alert('Failed to delete analysis. Please try again.');
    }
  };

  const handleDownloadAnalysis = async (analysis: RepositoryAnalysis, event: React.MouseEvent) => {
    event.stopPropagation();

    if (analysis.status !== 'COMPLETED' || !analysis.results) {
      alert('Analysis must be completed to download results.');
      return;
    }

    try {
      const reportData = {
        analysis,
        results: analysis.results,
        generatedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${analysis.repositoryName}-analysis-${analysis.analysisDate.toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download analysis results.');
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getComplianceScore = (analysis: RepositoryAnalysis) => {
    return analysis.results?.complianceScore || 0;
  };

  const getComplianceColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Analysis History
              </CardTitle>
              <CardDescription>
                View and manage your repository analysis history
              </CardDescription>
            </div>
            <Button onClick={onRefresh} variant="outline" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search repositories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="PROCESSING">Processing</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value: 'date' | 'name' | 'status') => setSortBy(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{analyses.length}</div>
              <div className="text-sm text-gray-600">Total Analyses</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {analyses.filter(a => a.status === 'COMPLETED').length}
              </div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {analyses.filter(a => ['PENDING', 'PROCESSING'].includes(a.status)).length}
              </div>
              <div className="text-sm text-gray-600">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {analyses.filter(a => a.status === 'FAILED').length}
              </div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Analysis List */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center space-y-2">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-600">Loading analysis history...</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredAnalyses.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center space-y-2">
              <History className="h-8 w-8 mx-auto text-gray-400" />
              <h3 className="text-lg font-medium text-gray-600">
                {analyses.length === 0 ? 'No Analyses Yet' : 'No Matching Analyses'}
              </h3>
              <p className="text-gray-500">
                {analyses.length === 0 
                  ? 'Start your first repository analysis to see results here.'
                  : 'Try adjusting your search or filter criteria.'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAnalyses.map((analysis) => (
            <Card 
              key={analysis.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onAnalysisSelect(analysis)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(analysis.status)}
                      <div>
                        <h3 className="font-medium text-lg">{analysis.repositoryName}</h3>
                        <p className="text-sm text-gray-600 truncate max-w-md">
                          {analysis.repositoryUrl}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(analysis.analysisDate)}
                      </div>
                      
                      {analysis.metadata?.analysisType && (
                        <div className="flex items-center gap-1">
                          <GitBranch className="h-4 w-4" />
                          {analysis.metadata.analysisType}
                        </div>
                      )}

                      {analysis.creditsCost && (
                        <div className="flex items-center gap-1">
                          <span>{analysis.creditsCost} credits</span>
                        </div>
                      )}
                    </div>

                    {analysis.status === 'COMPLETED' && analysis.results && (
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <BarChart3 className="h-4 w-4" />
                          <span className={`font-medium ${getComplianceColor(getComplianceScore(analysis))}`}>
                            Score: {getComplianceScore(analysis)}
                          </span>
                        </div>
                        <div>
                          {analysis.results.recommendations?.length || 0} recommendations
                        </div>
                        <div>
                          {analysis.results.issues?.length || 0} issues
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(analysis.status)}
                    
                    <div className="flex items-center gap-1">
                      {analysis.status === 'COMPLETED' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleDownloadAnalysis(analysis, e)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAnalysisSelect(analysis);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleDeleteAnalysis(analysis.id, e)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination could be added here if needed */}
      {filteredAnalyses.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          Showing {filteredAnalyses.length} of {analyses.length} analyses
        </div>
      )}
    </div>
  );
}
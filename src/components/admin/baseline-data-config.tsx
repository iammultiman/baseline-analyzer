'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Database, Search, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface BaselineStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
}

interface SearchResult {
  feature: {
    id: string;
    feature: string;
    category?: string;
    status?: string;
    description?: string;
    documentation?: string;
  };
  similarity: number;
}

export function BaselineDataConfig() {
  const [stats, setStats] = useState<BaselineStats | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/baseline/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.statistics);
      }
    } catch (error) {
      console.error('Error fetching baseline stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    setUpdateResult(null);

    try {
      const response = await fetch('/api/baseline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'update' }),
      });

      const data = await response.json();

      if (response.ok) {
        setUpdateResult(`✅ ${data.message}`);
        await fetchStats(); // Refresh stats after update
      } else {
        setUpdateResult(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setUpdateResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch('/api/baseline/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery, limit: 5 }),
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error('Error searching baseline data:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'baseline':
        return 'bg-green-100 text-green-800';
      case 'limited':
        return 'bg-yellow-100 text-yellow-800';
      case 'not-baseline':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Baseline Data Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading baseline data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Baseline Data Management
          </CardTitle>
          <CardDescription>
            Manage web platform baseline data used for repository analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Statistics */}
          {stats && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Statistics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                  <div className="text-sm text-blue-600">Total Features</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {stats.byStatus.baseline || 0}
                  </div>
                  <div className="text-sm text-green-600">Baseline Features</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {stats.byStatus.limited || 0}
                  </div>
                  <div className="text-sm text-yellow-600">Limited Support</div>
                </div>
              </div>

              {/* Status Distribution */}
              <div className="mb-4">
                <h4 className="font-medium mb-2">Status Distribution</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.byStatus).map(([status, count]) => (
                    <Badge key={status} className={getStatusColor(status)}>
                      {status}: {count}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Category Distribution */}
              <div>
                <h4 className="font-medium mb-2">Category Distribution</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.byCategory).map(([category, count]) => (
                    <Badge key={category} variant="outline">
                      {category}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Update Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Update Baseline Data</h3>
            <p className="text-sm text-gray-600 mb-4">
              Fetch the latest baseline data from web.dev and update the vector database.
            </p>
            <Button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? 'Updating...' : 'Update Baseline Data'}
            </Button>
            {updateResult && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md">
                <pre className="text-sm whitespace-pre-wrap">{updateResult}</pre>
              </div>
            )}
          </div>

          <Separator />

          {/* Search Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search Baseline Data
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Test the vector similarity search functionality.
            </p>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Enter search query (e.g., 'fetch API', 'CSS grid')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Search Results</h4>
                {searchResults.map((result, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-medium">{result.feature.feature}</h5>
                      <Badge variant="outline">
                        {(result.similarity * 100).toFixed(1)}% match
                      </Badge>
                    </div>
                    <div className="flex gap-2 mb-2">
                      {result.feature.category && (
                        <Badge variant="secondary">{result.feature.category}</Badge>
                      )}
                      {result.feature.status && (
                        <Badge className={getStatusColor(result.feature.status)}>
                          {result.feature.status}
                        </Badge>
                      )}
                    </div>
                    {result.feature.description && (
                      <p className="text-sm text-gray-600 mb-2">
                        {result.feature.description}
                      </p>
                    )}
                    {result.feature.documentation && (
                      <a
                        href={result.feature.documentation}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View Documentation →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
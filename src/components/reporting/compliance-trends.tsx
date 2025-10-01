'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement
);

interface TrendData {
  date: string;
  complianceScore: number;
  analysisCount: number;
}

interface ComplianceTrendsProps {
  data: TrendData[];
  timeRange: string;
}

export function ComplianceTrends({ data, timeRange }: ComplianceTrendsProps) {
  // Calculate trend direction
  const calculateTrend = () => {
    if (data.length < 2) return { direction: 'stable', change: 0 };
    
    const recent = data.slice(-7); // Last 7 data points
    const older = data.slice(-14, -7); // Previous 7 data points
    
    if (recent.length === 0 || older.length === 0) return { direction: 'stable', change: 0 };
    
    const recentAvg = recent.reduce((sum, d) => sum + d.complianceScore, 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + d.complianceScore, 0) / older.length;
    
    const change = recentAvg - olderAvg;
    
    if (Math.abs(change) < 1) return { direction: 'stable', change: 0 };
    return { 
      direction: change > 0 ? 'up' : 'down', 
      change: Math.abs(change) 
    };
  };

  const trend = calculateTrend();

  const getTrendIcon = () => {
    switch (trend.direction) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendColor = () => {
    switch (trend.direction) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Prepare chart data
  const chartData = {
    labels: data.map(d => new Date(d.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Compliance Score',
        data: data.map(d => d.complianceScore),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1,
        fill: true,
        yAxisID: 'y',
      },
      {
        label: 'Analysis Count',
        data: data.map(d => d.analysisCount),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.1,
        fill: false,
        yAxisID: 'y1',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Compliance Score and Analysis Volume Trends',
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Date',
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Compliance Score (%)',
        },
        min: 0,
        max: 100,
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Analysis Count',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  // Prepare analysis volume chart
  const volumeData = {
    labels: data.map(d => new Date(d.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Daily Analyses',
        data: data.map(d => d.analysisCount),
        backgroundColor: '#3b82f6',
        borderColor: '#1d4ed8',
        borderWidth: 1,
      },
    ],
  };

  const volumeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Analysis Volume Over Time',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Analyses',
        },
      },
    },
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <BarChart3 className="h-8 w-8 mx-auto text-gray-400" />
            <p className="text-gray-600">No trend data available</p>
            <p className="text-sm text-gray-500">
              Run more analyses to see compliance trends
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Trend Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trend Direction</CardTitle>
            {getTrendIcon()}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getTrendColor()}`}>
              {trend.direction === 'stable' ? 'Stable' : 
               trend.direction === 'up' ? 'Improving' : 'Declining'}
            </div>
            <p className="text-xs text-muted-foreground">
              {trend.change > 0 && `${trend.change.toFixed(1)}% change`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.length > 0 
                ? Math.round(data.reduce((sum, d) => sum + d.complianceScore, 0) / data.length)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Over {timeRange}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.reduce((sum, d) => sum + d.analysisCount, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              In {timeRange}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Score Trends</CardTitle>
          <CardDescription>
            Track compliance scores and analysis volume over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ height: '400px' }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        </CardContent>
      </Card>

      {/* Analysis Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Volume</CardTitle>
          <CardDescription>
            Daily analysis activity over the selected time period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ height: '300px' }}>
            <Bar data={volumeData} options={volumeOptions} />
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Trend Insights</CardTitle>
          <CardDescription>
            Key observations from your compliance trends
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {trend.direction === 'up' && (
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium text-green-800">Improving Compliance</div>
                  <div className="text-sm text-green-700">
                    Your compliance scores have improved by {trend.change.toFixed(1)}% recently. 
                    Keep up the good work!
                  </div>
                </div>
              </div>
            )}
            
            {trend.direction === 'down' && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-600" />
                <div>
                  <div className="font-medium text-red-800">Declining Compliance</div>
                  <div className="text-sm text-red-700">
                    Your compliance scores have decreased by {trend.change.toFixed(1)}% recently. 
                    Consider reviewing recent changes.
                  </div>
                </div>
              </div>
            )}

            {trend.direction === 'stable' && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <Minus className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium text-blue-800">Stable Performance</div>
                  <div className="text-sm text-blue-700">
                    Your compliance scores have remained consistent. 
                    This indicates stable development practices.
                  </div>
                </div>
              </div>
            )}

            {/* Activity insights */}
            {data.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <BarChart3 className="h-5 w-5 text-gray-600" />
                <div>
                  <div className="font-medium text-gray-800">Analysis Activity</div>
                  <div className="text-sm text-gray-700">
                    You've run {data.reduce((sum, d) => sum + d.analysisCount, 0)} analyses 
                    over {data.length} days, averaging{' '}
                    {Math.round(data.reduce((sum, d) => sum + d.analysisCount, 0) / data.length)} 
                    analyses per day.
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
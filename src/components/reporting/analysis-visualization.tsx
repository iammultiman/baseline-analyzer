'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

interface AnalysisData {
  id: string;
  repositoryName: string;
  complianceScore: number;
  analysisDate: Date;
  status: string;
}

interface AnalysisVisualizationProps {
  data: AnalysisData[];
  type: 'distribution' | 'timeline' | 'comparison';
  title?: string;
  height?: number;
}

export function AnalysisVisualization({ 
  data, 
  type, 
  title,
  height = 300 
}: AnalysisVisualizationProps) {
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: !!title,
        text: title,
      },
    },
  };

  const renderDistributionChart = () => {
    // Group compliance scores into ranges
    const ranges = {
      'Excellent (80-100%)': 0,
      'Good (60-79%)': 0,
      'Fair (40-59%)': 0,
      'Poor (0-39%)': 0,
    };

    data.forEach(analysis => {
      const score = analysis.complianceScore;
      if (score >= 80) ranges['Excellent (80-100%)']++;
      else if (score >= 60) ranges['Good (60-79%)']++;
      else if (score >= 40) ranges['Fair (40-59%)']++;
      else ranges['Poor (0-39%)']++;
    });

    const chartData = {
      labels: Object.keys(ranges),
      datasets: [
        {
          data: Object.values(ranges),
          backgroundColor: [
            '#10b981', // green for excellent
            '#f59e0b', // yellow for good
            '#f97316', // orange for fair
            '#ef4444', // red for poor
          ],
          borderColor: [
            '#059669',
            '#d97706',
            '#ea580c',
            '#dc2626',
          ],
          borderWidth: 1,
        },
      ],
    };

    return <Doughnut data={chartData} options={chartOptions} height={height} />;
  };

  const renderTimelineChart = () => {
    // Group data by date and calculate average compliance
    const timelineData = data.reduce((acc, analysis) => {
      const date = analysis.analysisDate.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { total: 0, count: 0 };
      }
      acc[date].total += analysis.complianceScore;
      acc[date].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>);

    const sortedDates = Object.keys(timelineData).sort();
    const averageScores = sortedDates.map(date => 
      Math.round(timelineData[date].total / timelineData[date].count)
    );

    const chartData = {
      labels: sortedDates.map(date => new Date(date).toLocaleDateString()),
      datasets: [
        {
          label: 'Average Compliance Score',
          data: averageScores,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.1,
          fill: true,
        },
      ],
    };

    const lineOptions = {
      ...chartOptions,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value: any) {
              return value + '%';
            }
          }
        },
      },
    };

    return <Line data={chartData} options={lineOptions} height={height} />;
  };

  const renderComparisonChart = () => {
    // Show top 10 repositories by compliance score
    const sortedData = [...data]
      .sort((a, b) => b.complianceScore - a.complianceScore)
      .slice(0, 10);

    const chartData = {
      labels: sortedData.map(analysis => 
        analysis.repositoryName.length > 20 
          ? analysis.repositoryName.substring(0, 20) + '...'
          : analysis.repositoryName
      ),
      datasets: [
        {
          label: 'Compliance Score',
          data: sortedData.map(analysis => analysis.complianceScore),
          backgroundColor: sortedData.map(analysis => {
            const score = analysis.complianceScore;
            if (score >= 80) return '#10b981';
            if (score >= 60) return '#f59e0b';
            if (score >= 40) return '#f97316';
            return '#ef4444';
          }),
          borderColor: sortedData.map(analysis => {
            const score = analysis.complianceScore;
            if (score >= 80) return '#059669';
            if (score >= 60) return '#d97706';
            if (score >= 40) return '#ea580c';
            return '#dc2626';
          }),
          borderWidth: 1,
        },
      ],
    };

    const barOptions = {
      ...chartOptions,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value: any) {
              return value + '%';
            }
          }
        },
      },
      plugins: {
        ...chartOptions.plugins,
        tooltip: {
          callbacks: {
            label: function(context: any) {
              return `${context.dataset.label}: ${context.parsed.y}%`;
            }
          }
        }
      }
    };

    return <Bar data={chartData} options={barOptions} height={height} />;
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="text-lg font-medium">No data available</div>
          <div className="text-sm">Run some analyses to see visualizations</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: `${height}px` }}>
      {type === 'distribution' && renderDistributionChart()}
      {type === 'timeline' && renderTimelineChart()}
      {type === 'comparison' && renderComparisonChart()}
    </div>
  );
}
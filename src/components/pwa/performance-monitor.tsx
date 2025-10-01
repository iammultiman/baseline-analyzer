'use client';

import { useEffect, useState } from 'react';
import { measureWebVitals, PerformanceMetrics } from '@/lib/utils/performance-optimizer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, Zap, Eye, Layout, Clock } from 'lucide-react';

interface PerformanceScore {
  metric: keyof PerformanceMetrics;
  value: number;
  score: 'good' | 'needs-improvement' | 'poor';
  threshold: { good: number; poor: number };
  icon: React.ReactNode;
  label: string;
  description: string;
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<Partial<PerformanceMetrics>>({});
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show in development or when explicitly enabled
    const showMonitor = process.env.NODE_ENV === 'development' || 
                       localStorage.getItem('show-performance-monitor') === 'true';
    
    setIsVisible(showMonitor);

    if (showMonitor) {
      measureWebVitals(setMetrics);
    }
  }, []);

  if (!isVisible) return null;

  const getScore = (metric: keyof PerformanceMetrics, value: number): 'good' | 'needs-improvement' | 'poor' => {
    const thresholds = {
      fcp: { good: 1800, poor: 3000 },
      lcp: { good: 2500, poor: 4000 },
      fid: { good: 100, poor: 300 },
      cls: { good: 0.1, poor: 0.25 },
      ttfb: { good: 800, poor: 1800 }
    };

    const threshold = thresholds[metric];
    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  };

  const performanceScores: PerformanceScore[] = [
    {
      metric: 'fcp',
      value: metrics.fcp || 0,
      score: metrics.fcp ? getScore('fcp', metrics.fcp) : 'good',
      threshold: { good: 1800, poor: 3000 },
      icon: <Eye className="w-4 h-4" />,
      label: 'FCP',
      description: 'First Contentful Paint'
    },
    {
      metric: 'lcp',
      value: metrics.lcp || 0,
      score: metrics.lcp ? getScore('lcp', metrics.lcp) : 'good',
      threshold: { good: 2500, poor: 4000 },
      icon: <Layout className="w-4 h-4" />,
      label: 'LCP',
      description: 'Largest Contentful Paint'
    },
    {
      metric: 'fid',
      value: metrics.fid || 0,
      score: metrics.fid ? getScore('fid', metrics.fid) : 'good',
      threshold: { good: 100, poor: 300 },
      icon: <Zap className="w-4 h-4" />,
      label: 'FID',
      description: 'First Input Delay'
    },
    {
      metric: 'cls',
      value: metrics.cls || 0,
      score: metrics.cls ? getScore('cls', metrics.cls) : 'good',
      threshold: { good: 0.1, poor: 0.25 },
      icon: <Activity className="w-4 h-4" />,
      label: 'CLS',
      description: 'Cumulative Layout Shift'
    },
    {
      metric: 'ttfb',
      value: metrics.ttfb || 0,
      score: metrics.ttfb ? getScore('ttfb', metrics.ttfb) : 'good',
      threshold: { good: 800, poor: 1800 },
      icon: <Clock className="w-4 h-4" />,
      label: 'TTFB',
      description: 'Time to First Byte'
    }
  ];

  const getScoreColor = (score: string) => {
    switch (score) {
      case 'good': return 'bg-green-500';
      case 'needs-improvement': return 'bg-yellow-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getScoreVariant = (score: string) => {
    switch (score) {
      case 'good': return 'default';
      case 'needs-improvement': return 'secondary';
      case 'poor': return 'destructive';
      default: return 'outline';
    }
  };

  const formatValue = (metric: keyof PerformanceMetrics, value: number) => {
    if (metric === 'cls') {
      return value.toFixed(3);
    }
    return `${Math.round(value)}ms`;
  };

  const getProgressValue = (score: PerformanceScore) => {
    const { value, threshold } = score;
    if (value <= threshold.good) return 100;
    if (value <= threshold.poor) return 60;
    return 30;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Card className="bg-white/95 backdrop-blur-sm border-gray-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Performance
            </CardTitle>
            <button
              onClick={() => {
                localStorage.setItem('show-performance-monitor', 'false');
                setIsVisible(false);
              }}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              Hide
            </button>
          </div>
          <CardDescription className="text-xs">
            Web Vitals Monitoring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {performanceScores.map((score) => (
            <div key={score.metric} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {score.icon}
                  <span className="text-sm font-medium">{score.label}</span>
                  <Badge 
                    variant={getScoreVariant(score.score)}
                    className="text-xs"
                  >
                    {score.value > 0 ? formatValue(score.metric, score.value) : 'N/A'}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Progress 
                  value={getProgressValue(score)} 
                  className="flex-1 h-2"
                />
                <span className="text-xs text-gray-500 capitalize">
                  {score.score.replace('-', ' ')}
                </span>
              </div>
              <p className="text-xs text-gray-500">{score.description}</p>
            </div>
          ))}
          
          <div className="pt-2 border-t border-gray-200">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Good</span>
              <span>Needs Improvement</span>
              <span>Poor</span>
            </div>
            <div className="flex mt-1">
              <div className="flex-1 h-2 bg-green-500 rounded-l"></div>
              <div className="flex-1 h-2 bg-yellow-500"></div>
              <div className="flex-1 h-2 bg-red-500 rounded-r"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
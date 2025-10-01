/**
 * Lazy-loaded components for code splitting optimization
 */

import { lazy } from 'react';
import { lazyLoadComponent } from '@/lib/utils/performance-optimizer';

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
  </div>
);

// Admin components (loaded only when needed)
export const LazyAdminConfig = lazyLoadComponent(
  () => import('@/components/admin/ai-provider-config'),
  LoadingFallback
);

export const LazyPricingConfig = lazyLoadComponent(
  () => import('@/components/admin/pricing-config'),
  LoadingFallback
);

export const LazyUsageAnalytics = lazyLoadComponent(
  () => import('@/components/admin/usage-analytics'),
  LoadingFallback
);

export const LazySystemMonitoring = lazyLoadComponent(
  () => import('@/components/admin/system-monitoring'),
  LoadingFallback
);

// Reporting components (heavy with Chart.js)
export const LazyReportingDashboard = lazyLoadComponent(
  () => import('@/components/reporting/reporting-dashboard'),
  LoadingFallback
);

export const LazyAnalysisVisualization = lazyLoadComponent(
  () => import('@/components/reporting/analysis-visualization'),
  LoadingFallback
);

export const LazyComplianceTrends = lazyLoadComponent(
  () => import('@/components/reporting/compliance-trends'),
  LoadingFallback
);

export const LazyPDFReportGenerator = lazyLoadComponent(
  () => import('@/components/reporting/pdf-report-generator'),
  LoadingFallback
);

// Credit management components
export const LazyCreditManagementDashboard = lazyLoadComponent(
  () => import('@/components/credits/credit-management-dashboard'),
  LoadingFallback
);

export const LazyUsageAnalyticsDashboard = lazyLoadComponent(
  () => import('@/components/credits/usage-analytics-dashboard'),
  LoadingFallback
);

// Repository analysis components
export const LazyRepositoryAnalysisForm = lazyLoadComponent(
  () => import('@/components/repository-analysis/repository-analysis-form'),
  LoadingFallback
);

export const LazyAnalysisResultsDisplay = lazyLoadComponent(
  () => import('@/components/repository-analysis/analysis-results-display'),
  LoadingFallback
);

export const LazyRepositoryHistoryManager = lazyLoadComponent(
  () => import('@/components/repository-analysis/repository-history-manager'),
  LoadingFallback
);

// AI Analysis components
export const LazyAIAnalysisInterface = lazyLoadComponent(
  () => import('@/components/analysis/ai-analysis-interface'),
  LoadingFallback
);

// Performance monitoring (development only)
export const LazyPerformanceMonitor = lazy(() => 
  import('@/components/pwa/performance-monitor').then(module => ({
    default: module.PerformanceMonitor
  }))
);

// Preload critical components
export function preloadCriticalComponents() {
  if (typeof window !== 'undefined') {
    // Preload components that are likely to be used soon
    import('@/components/repository-analysis/repository-analysis-form');
    import('@/components/credits/credit-balance');
    import('@/components/auth/login-form');
  }
}

// Preload admin components when user has admin role
export function preloadAdminComponents() {
  if (typeof window !== 'undefined') {
    import('@/components/admin/ai-provider-config');
    import('@/components/admin/pricing-config');
    import('@/components/admin/usage-analytics');
  }
}

// Preload reporting components when user navigates to reports
export function preloadReportingComponents() {
  if (typeof window !== 'undefined') {
    import('@/components/reporting/reporting-dashboard');
    import('@/components/reporting/analysis-visualization');
  }
}
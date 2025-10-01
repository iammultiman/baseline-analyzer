/**
 * Performance Optimization Utilities
 * Provides utilities for code splitting, lazy loading, and performance monitoring
 */

import { lazy, ComponentType } from 'react';

// Performance metrics interface
export interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
}

/**
 * Lazy load component with loading fallback
 */
export function lazyLoadComponent<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: ComponentType
): ComponentType<any> {
  const LazyComponent = lazy(importFunc);
  
  if (fallback) {
    return (props: any) => (
      <React.Suspense fallback={<fallback />}>
        <LazyComponent {...props} />
      </React.Suspense>
    );
  }
  
  return LazyComponent;
}

/**
 * Preload component for better performance
 */
export function preloadComponent(importFunc: () => Promise<any>): void {
  if (typeof window !== 'undefined') {
    // Use requestIdleCallback if available, otherwise setTimeout
    const preload = () => {
      importFunc().catch(console.error);
    };
    
    if ('requestIdleCallback' in window) {
      requestIdleCallback(preload);
    } else {
      setTimeout(preload, 100);
    }
  }
}

/**
 * Measure and report Web Vitals
 */
export function measureWebVitals(callback: (metrics: Partial<PerformanceMetrics>) => void): void {
  if (typeof window === 'undefined') return;

  const metrics: Partial<PerformanceMetrics> = {};

  // First Contentful Paint
  const fcpObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
    if (fcpEntry) {
      metrics.fcp = fcpEntry.startTime;
      callback(metrics);
    }
  });
  fcpObserver.observe({ entryTypes: ['paint'] });

  // Largest Contentful Paint
  const lcpObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    if (lastEntry) {
      metrics.lcp = lastEntry.startTime;
      callback(metrics);
    }
  });
  lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

  // First Input Delay
  const fidObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry: any) => {
      if (entry.processingStart && entry.startTime) {
        metrics.fid = entry.processingStart - entry.startTime;
        callback(metrics);
      }
    });
  });
  fidObserver.observe({ entryTypes: ['first-input'] });

  // Cumulative Layout Shift
  let clsValue = 0;
  const clsObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry: any) => {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
      }
    });
    metrics.cls = clsValue;
    callback(metrics);
  });
  clsObserver.observe({ entryTypes: ['layout-shift'] });

  // Time to First Byte
  const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (navigationEntries.length > 0) {
    const navEntry = navigationEntries[0];
    metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
    callback(metrics);
  }
}

/**
 * Optimize images with lazy loading and WebP support
 */
export function optimizeImage(src: string, options: {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'auto';
} = {}): string {
  if (typeof window === 'undefined') return src;

  const { width, height, quality = 75, format = 'auto' } = options;
  
  // Check if browser supports WebP
  const supportsWebP = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  })();

  // Check if browser supports AVIF
  const supportsAVIF = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
  })();

  let optimizedSrc = src;
  
  // Add Next.js Image optimization parameters
  const params = new URLSearchParams();
  if (width) params.set('w', width.toString());
  if (height) params.set('h', height.toString());
  params.set('q', quality.toString());
  
  // Set format based on browser support
  if (format === 'auto') {
    if (supportsAVIF) {
      params.set('f', 'avif');
    } else if (supportsWebP) {
      params.set('f', 'webp');
    }
  } else {
    params.set('f', format);
  }
  
  if (params.toString()) {
    optimizedSrc = `/_next/image?url=${encodeURIComponent(src)}&${params.toString()}`;
  }
  
  return optimizedSrc;
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Intersection Observer for lazy loading
 */
export function createIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null;
  }
  
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px',
    threshold: 0.1,
    ...options
  };
  
  return new IntersectionObserver(callback, defaultOptions);
}

/**
 * Resource hints for better performance
 */
export function addResourceHints(resources: Array<{
  href: string;
  as?: string;
  type?: string;
  crossorigin?: string;
}>): void {
  if (typeof document === 'undefined') return;
  
  resources.forEach(({ href, as, type, crossorigin }) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    if (as) link.as = as;
    if (type) link.type = type;
    if (crossorigin) link.crossOrigin = crossorigin;
    
    document.head.appendChild(link);
  });
}

/**
 * Critical CSS inlining
 */
export function inlineCriticalCSS(css: string): void {
  if (typeof document === 'undefined') return;
  
  const style = document.createElement('style');
  style.textContent = css;
  style.setAttribute('data-critical', 'true');
  
  document.head.insertBefore(style, document.head.firstChild);
}

/**
 * Bundle analyzer helper
 */
export function analyzeBundleSize(): void {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return;
  }
  
  console.group('Bundle Analysis');
  
  // Analyze loaded scripts
  const scripts = Array.from(document.querySelectorAll('script[src]'));
  scripts.forEach((script: HTMLScriptElement) => {
    if (script.src.includes('_next/static')) {
      console.log(`Script: ${script.src}`);
    }
  });
  
  // Analyze loaded stylesheets
  const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
  stylesheets.forEach((link: HTMLLinkElement) => {
    console.log(`Stylesheet: ${link.href}`);
  });
  
  console.groupEnd();
}

/**
 * Memory usage monitoring
 */
export function monitorMemoryUsage(): void {
  if (typeof window === 'undefined' || !('performance' in window)) {
    return;
  }
  
  const memory = (performance as any).memory;
  if (memory) {
    console.log('Memory Usage:', {
      used: `${Math.round(memory.usedJSHeapSize / 1048576)} MB`,
      total: `${Math.round(memory.totalJSHeapSize / 1048576)} MB`,
      limit: `${Math.round(memory.jsHeapSizeLimit / 1048576)} MB`
    });
  }
}

// Export React import for lazy loading
export { Suspense } from 'react';
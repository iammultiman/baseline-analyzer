'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const LazyPerformanceMonitor = dynamic(
  () =>
    import('./performance-monitor').then((mod) => ({
      default: mod.PerformanceMonitor,
    })),
  {
    ssr: false,
    loading: () => null,
  },
);

export function PerformanceMonitorClient() {
  return (
    <Suspense fallback={null}>
      <LazyPerformanceMonitor />
    </Suspense>
  );
}

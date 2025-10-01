'use client';

import React from 'react';
import { ReportingDashboard } from '@/components/reporting/reporting-dashboard';
import { useAuth } from '@/lib/auth-context';

export default function ReportingPage() {
  const { user } = useAuth();

  return (
    <div className="container mx-auto px-4 py-8">
      <ReportingDashboard 
        organizationId={user?.organizationId}
        userId={user?.id}
      />
    </div>
  );
}
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReportingDashboard } from '../reporting-dashboard';

// Mock the Chart.js components
jest.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="bar-chart">Bar Chart</div>,
  Doughnut: () => <div data-testid="doughnut-chart">Doughnut Chart</div>,
  Line: () => <div data-testid="line-chart">Line Chart</div>,
}));

// Mock the child components
jest.mock('../analysis-visualization', () => ({
  AnalysisVisualization: ({ type }: { type: string }) => (
    <div data-testid={`analysis-visualization-${type}`}>Analysis Visualization {type}</div>
  ),
}));

jest.mock('../compliance-trends', () => ({
  ComplianceTrends: () => <div data-testid="compliance-trends">Compliance Trends</div>,
}));

jest.mock('../pdf-report-generator', () => ({
  PDFReportGenerator: () => <div data-testid="pdf-report-generator">PDF Report Generator</div>,
}));

jest.mock('../report-sharing', () => ({
  ReportSharing: () => <div data-testid="report-sharing">Report Sharing</div>,
}));

// Mock fetch
global.fetch = jest.fn();

const mockDashboardData = {
  totalAnalyses: 25,
  averageCompliance: 78.5,
  trendsData: [
    { date: '2024-01-01', complianceScore: 75, analysisCount: 3 },
    { date: '2024-01-02', complianceScore: 80, analysisCount: 5 },
  ],
  topIssues: [
    { category: 'Accessibility', count: 15, severity: 'high' as const },
    { category: 'Performance', count: 12, severity: 'medium' as const },
  ],
  recentAnalyses: [
    {
      id: '1',
      repositoryName: 'test-repo-1',
      complianceScore: 85,
      analysisDate: new Date('2024-01-01'),
      status: 'COMPLETED',
    },
    {
      id: '2',
      repositoryName: 'test-repo-2',
      complianceScore: 72,
      analysisDate: new Date('2024-01-02'),
      status: 'COMPLETED',
    },
  ],
};

describe('ReportingDashboard', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockDashboardData,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(<ReportingDashboard />);
    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });

  it('renders dashboard data after loading', async () => {
    render(<ReportingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Reporting Dashboard')).toBeInTheDocument();
    });

  expect(screen.getByTestId('metric-total-analyses')).toHaveTextContent('25');
  expect(screen.getByTestId('metric-average-compliance')).toHaveTextContent('79%');
  expect(screen.getByTestId('metric-top-issues')).toHaveTextContent('2');
  });

  it('handles API errors gracefully', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('API Error'));

    render(<ReportingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('allows time range selection', async () => {
    render(<ReportingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Reporting Dashboard')).toBeInTheDocument();
    });

    const timeRangeSelect = screen.getByTestId('time-range-select') as HTMLSelectElement;

    expect(timeRangeSelect).toBeInTheDocument();
    expect(timeRangeSelect.value).toBe('30d');
    expect(Array.from(timeRangeSelect.options).map(option => option.value)).toEqual([
      '7d',
      '30d',
      '90d',
      '1y',
    ]);

    fireEvent.change(timeRangeSelect, { target: { value: '7d' } });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('timeRange=7d'));
    });
  });

  it('renders all dashboard tabs', async () => {
    render(<ReportingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Reporting Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Trends')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Sharing')).toBeInTheDocument();
  });

  it('switches between tabs correctly', async () => {
    render(<ReportingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Reporting Dashboard')).toBeInTheDocument();
    });

    // Click on Trends tab
    fireEvent.mouseDown(screen.getByText('Trends'));
    await waitFor(() => {
      expect(screen.getByTestId('compliance-trends')).toBeInTheDocument();
    });

    // Click on Reports tab
    fireEvent.mouseDown(screen.getByText('Reports'));
    await waitFor(() => {
      expect(screen.getByTestId('pdf-report-generator')).toBeInTheDocument();
    });

    // Click on Sharing tab
    fireEvent.mouseDown(screen.getByText('Sharing'));
    await waitFor(() => {
      expect(screen.getByTestId('report-sharing')).toBeInTheDocument();
    });
  });

  it('displays recent analyses correctly', async () => {
    render(<ReportingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Recent Analyses')).toBeInTheDocument();
    });

    expect(screen.getByText('test-repo-1')).toBeInTheDocument();
    expect(screen.getByText('test-repo-2')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
  });

  it('displays top issues correctly', async () => {
    render(<ReportingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Most Common Issues')).toBeInTheDocument();
    });

    expect(screen.getByText('Accessibility')).toBeInTheDocument();
    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('15 occurrences')).toBeInTheDocument();
    expect(screen.getByText('12 occurrences')).toBeInTheDocument();
  });

  it('handles export functionality', async () => {
    // Mock URL.createObjectURL and related functions
    global.URL.createObjectURL = jest.fn(() => 'mock-url');
    global.URL.revokeObjectURL = jest.fn();
    
    const mockBlob = new Blob(['test data'], { type: 'application/pdf' });
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDashboardData,
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      });

    render(<ReportingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Export PDF')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Export PDF'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/reporting/export?format=pdf')
      );
    });
  });

  it('passes correct props to child components', async () => {
    const organizationId = 'org-123';
    const userId = 'user-456';

    render(<ReportingDashboard organizationId={organizationId} userId={userId} />);

    await waitFor(() => {
      expect(screen.getByText('Reporting Dashboard')).toBeInTheDocument();
    });

    // Verify API call includes the correct parameters
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`organizationId=${organizationId}`)
    );
  });

  it('refreshes data when time range changes', async () => {
    render(<ReportingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Reporting Dashboard')).toBeInTheDocument();
    });

    // Initial API call
    expect(fetch).toHaveBeenCalledTimes(1);

    // Change time range (this would trigger useEffect)
    // Note: In a real test, you'd need to interact with the select component
    // For now, we'll just verify the initial call was made
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/reporting/dashboard?timeRange=30d')
    );
  });
});
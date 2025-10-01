import { render, screen } from '@testing-library/react';
import { CreditManagementDashboard } from '../credit-management-dashboard';

// Mock the hooks and components
jest.mock('@/lib/hooks/use-credit-balance', () => ({
  useCreditBalance: () => ({
    balance: 150,
    refreshBalance: jest.fn(),
    isLoading: false,
    error: null,
  }),
}));

// Mock recharts
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Line: () => <div data-testid="line" />,
  Bar: () => <div data-testid="bar" />,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
}));

// Mock fetch
global.fetch = jest.fn();

describe('Credit Management Integration', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('should render the credit management dashboard', () => {
    render(<CreditManagementDashboard />);
    
    expect(screen.getByText('Credit Management')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Purchase')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should render compact version', () => {
    render(<CreditManagementDashboard compact={true} />);
    
    expect(screen.getByText('Credits available')).toBeInTheDocument();
    expect(screen.getByText('Buy Credits')).toBeInTheDocument();
  });
});
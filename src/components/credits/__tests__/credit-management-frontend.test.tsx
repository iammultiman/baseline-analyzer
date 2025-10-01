import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { CreditBalance } from '../credit-balance';
import { CreditHistory } from '../credit-history';
import { CreditPurchase } from '../credit-purchase';
import { CreditNotifications } from '../credit-notifications';
import { UsageAnalyticsDashboard } from '../usage-analytics-dashboard';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock recharts components
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

describe('Credit Management Frontend', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('CreditBalance Component', () => {
    it('should display credit balance and statistics', async () => {
      const mockCreditInfo = {
        balance: 150,
        stats: {
          totalCreditsUsed: 50,
          analysisCount: 5,
          averageCreditsPerAnalysis: 10,
          period: 'Last 30 days',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreditInfo,
      } as Response);

      render(<CreditBalance />);

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument();
        expect(screen.getByText('50')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
      });
    });

    it('should show low balance warning', async () => {
      const mockCreditInfo = {
        balance: 5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreditInfo,
      } as Response);

      render(<CreditBalance />);

      await waitFor(() => {
        expect(screen.getByText('Low')).toBeInTheDocument();
      });
    });

    it('should handle purchase button click', async () => {
      const mockCreditInfo = { balance: 100 };
      const onPurchaseClick = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreditInfo,
      } as Response);

      render(<CreditBalance onPurchaseClick={onPurchaseClick} />);

      await waitFor(() => {
        const purchaseButton = screen.getByText('Buy Credits');
        fireEvent.click(purchaseButton);
        expect(onPurchaseClick).toHaveBeenCalled();
      });
    });
  });

  describe('CreditHistory Component', () => {
    it('should display transaction history', async () => {
      const mockHistory = {
        history: [
          {
            id: '1',
            type: 'PURCHASE',
            amount: 100,
            description: 'Credit purchase',
            createdAt: '2024-01-01T00:00:00Z',
          },
          {
            id: '2',
            type: 'DEDUCTION',
            amount: -10,
            description: 'Repository analysis',
            createdAt: '2024-01-02T00:00:00Z',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHistory,
      } as Response);

      render(<CreditHistory />);

      await waitFor(() => {
        expect(screen.getByText('Credit purchase')).toBeInTheDocument();
        expect(screen.getByText('Repository analysis')).toBeInTheDocument();
      });
    });

    it('should handle load more functionality', async () => {
      const mockHistory = {
        history: Array.from({ length: 20 }, (_, i) => ({
          id: `${i + 1}`,
          type: 'PURCHASE',
          amount: 10,
          description: `Transaction ${i + 1}`,
          createdAt: '2024-01-01T00:00:00Z',
        })),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHistory,
      } as Response);

      render(<CreditHistory />);

      await waitFor(() => {
        const loadMoreButton = screen.getByText('Load More');
        expect(loadMoreButton).toBeInTheDocument();
      });
    });
  });

  describe('CreditPurchase Component', () => {
    it('should display credit packages', async () => {
      const mockPackages = {
        packages: [
          {
            id: 'starter',
            name: 'Starter Pack',
            credits: 100,
            price: 1000, // $10.00
            description: 'Perfect for small projects',
          },
          {
            id: 'professional',
            name: 'Professional Pack',
            credits: 500,
            price: 4500, // $45.00
            description: 'Great for regular use',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPackages,
      } as Response);

      render(<CreditPurchase />);

      // Open the dialog
      const buyButton = screen.getByText('Buy Credits');
      fireEvent.click(buyButton);

      await waitFor(() => {
        expect(screen.getByText('Starter Pack')).toBeInTheDocument();
        expect(screen.getByText('Professional Pack')).toBeInTheDocument();
      });
    });

    it('should handle purchase flow', async () => {
      const mockPackages = {
        packages: [
          {
            id: 'starter',
            name: 'Starter Pack',
            credits: 100,
            price: 1000,
          },
        ],
      };

      const mockPurchaseResult = {
        package: { credits: 100 },
        newBalance: 200,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPackages,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPurchaseResult,
        } as Response);

      const onPurchaseComplete = jest.fn();
      render(<CreditPurchase onPurchaseComplete={onPurchaseComplete} />);

      // Open dialog and make purchase
      fireEvent.click(screen.getByText('Buy Credits'));

      await waitFor(() => {
        const purchaseButton = screen.getByText('Purchase');
        fireEvent.click(purchaseButton);
      });

      await waitFor(() => {
        expect(onPurchaseComplete).toHaveBeenCalledWith(200);
      });
    });
  });

  describe('CreditNotifications Component', () => {
    it('should display credit notifications', async () => {
      const mockNotifications = {
        notifications: [
          {
            id: '1',
            type: 'low_balance',
            severity: 'warning',
            title: 'Low Credit Balance',
            message: 'You have 5 credits remaining',
            dismissible: true,
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      const mockSettings = {
        settings: {
          lowBalanceThreshold: 10,
          enableLowBalanceAlerts: true,
          enableUsageLimitAlerts: true,
          enableSpendingAlerts: true,
          enableRecommendations: true,
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockNotifications,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSettings,
        } as Response);

      render(<CreditNotifications />);

      await waitFor(() => {
        expect(screen.getByText('Low Credit Balance')).toBeInTheDocument();
        expect(screen.getByText('You have 5 credits remaining')).toBeInTheDocument();
      });
    });

    it('should handle notification dismissal', async () => {
      const mockNotifications = {
        notifications: [
          {
            id: '1',
            type: 'low_balance',
            severity: 'warning',
            title: 'Low Credit Balance',
            message: 'You have 5 credits remaining',
            dismissible: true,
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      const mockSettings = {
        settings: {
          lowBalanceThreshold: 10,
          enableLowBalanceAlerts: true,
          enableUsageLimitAlerts: true,
          enableSpendingAlerts: true,
          enableRecommendations: true,
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockNotifications,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSettings,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);

      render(<CreditNotifications />);

      await waitFor(() => {
        const dismissButton = screen.getByRole('button', { name: /dismiss/i });
        fireEvent.click(dismissButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/credits/notifications/1', {
          method: 'DELETE',
        });
      });
    });
  });

  describe('UsageAnalyticsDashboard Component', () => {
    it('should display usage analytics', async () => {
      const mockAnalytics = {
        overview: {
          totalCreditsUsed: 150,
          totalAnalyses: 15,
          averageCreditsPerAnalysis: 10,
          totalSpent: 5000,
          period: 'Last 30 days',
        },
        trends: {
          daily: [
            {
              date: '2024-01-01',
              creditsUsed: 10,
              analyses: 1,
              cost: 100,
            },
          ],
          weekly: [],
          monthly: [],
        },
        breakdown: {
          byComplexity: [
            {
              complexity: 'Simple',
              creditsUsed: 30,
              percentage: 20,
              color: '#0088FE',
            },
          ],
          byRepositorySize: [
            {
              sizeRange: '< 100KB',
              creditsUsed: 50,
              analyses: 5,
            },
          ],
        },
        projections: {
          monthlyProjection: 200,
          recommendedPackage: 'Professional Pack',
          savingsOpportunity: 500,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnalytics,
      } as Response);

      render(<UsageAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument();
        expect(screen.getByText('200')).toBeInTheDocument();
      });
    });

    it('should handle time range changes', async () => {
      const mockAnalytics = {
        overview: {
          totalCreditsUsed: 50,
          totalAnalyses: 5,
          averageCreditsPerAnalysis: 10,
          totalSpent: 1000,
          period: 'Last 7 days',
        },
        trends: { daily: [], weekly: [], monthly: [] },
        breakdown: { byComplexity: [], byRepositorySize: [] },
        projections: { monthlyProjection: 100 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnalytics,
      } as Response);

      render(<UsageAnalyticsDashboard />);

      await waitFor(() => {
        const sevenDaysTab = screen.getByText('7 Days');
        fireEvent.click(sevenDaysTab);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/credits/analytics?range=7d');
      });
    });
  });
});
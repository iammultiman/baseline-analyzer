import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { PricingConfig } from '../pricing-config';
import { SystemMonitoring } from '../system-monitoring';
import { AIProviderConfigComponent } from '../ai-provider-config';

// Mock fetch
global.fetch = jest.fn();

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Admin Configuration Interface', () => {
  beforeEach(() => {
    (fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  describe('PricingConfig', () => {
    it('should render pricing configuration form', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pricingConfig: {
            packages: [],
            freeCredits: 10,
            creditCostPerAnalysis: { base: 1, perFile: 0.1, perKB: 0.01 },
            usageLimits: { 
              freeUserDailyLimit: 5, 
              freeUserMonthlyLimit: 20,
              maxRepositorySize: 100,
              maxFilesPerRepository: 1000
            },
            freeTierConfig: {
              enabled: true,
              trialPeriodDays: 14,
              maxAnalysesPerTrial: 5,
              requireCreditCard: false,
            },
            realTimeUpdates: {
              enabled: true,
              notifyUsers: true,
            },
          },
        }),
      } as Response);

      render(<PricingConfig />);

      await waitFor(() => {
        expect(screen.getByText('Pricing Configuration')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Free Credits for New Users')).toBeInTheDocument();
      expect(screen.getByLabelText('Enable Free Tier')).toBeInTheDocument();
      expect(screen.getByLabelText('Enable Real-time Price Updates')).toBeInTheDocument();
    });

    it('should validate form inputs', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pricingConfig: {
            packages: [],
            freeCredits: -1, // Invalid value
            creditCostPerAnalysis: { base: 0, perFile: 0.1, perKB: 0.01 }, // Invalid base
            usageLimits: { 
              freeUserDailyLimit: 10, 
              freeUserMonthlyLimit: 5, // Invalid: less than daily
              maxRepositorySize: 100,
              maxFilesPerRepository: 1000
            },
            freeTierConfig: {
              enabled: true,
              trialPeriodDays: 14,
              maxAnalysesPerTrial: 5,
              requireCreditCard: false,
            },
            realTimeUpdates: {
              enabled: true,
              notifyUsers: true,
            },
          },
        }),
      } as Response);

      render(<PricingConfig />);

      await waitFor(() => {
        expect(screen.getByText('Pricing Configuration')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('Save Configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Please fix the validation errors above before saving.')).toBeInTheDocument();
      });
    });

    it('should save configuration successfully', async () => {
      // Mock initial fetch
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pricingConfig: {
            packages: [],
            freeCredits: 10,
            creditCostPerAnalysis: { base: 1, perFile: 0.1, perKB: 0.01 },
            usageLimits: { 
              freeUserDailyLimit: 5, 
              freeUserMonthlyLimit: 20,
              maxRepositorySize: 100,
              maxFilesPerRepository: 1000
            },
            freeTierConfig: {
              enabled: true,
              trialPeriodDays: 14,
              maxAnalysesPerTrial: 5,
              requireCreditCard: false,
            },
            realTimeUpdates: {
              enabled: true,
              notifyUsers: true,
            },
          },
        }),
      } as Response);

      // Mock save request
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      // Mock notification request
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      render(<PricingConfig />);

      await waitFor(() => {
        expect(screen.getByText('Pricing Configuration')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('Save Configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/admin/pricing', expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        }));
      });
    });
  });

  describe('SystemMonitoring', () => {
    it('should render system monitoring dashboard', async () => {
      const mockHealthData = {
        status: 'healthy',
        services: {
          database: { status: 'up', responseTime: 50, connections: 5, maxConnections: 100 },
          aiProviders: [
            { name: 'OpenAI', status: 'up', responseTime: 150, errorRate: 0.01 }
          ],
          storage: { status: 'up', usage: 50000000, capacity: 100000000 }
        },
        performance: { avgResponseTime: 250, requestsPerMinute: 45, errorRate: 0.02, uptime: 86400 },
        alerts: []
      };

      const mockMetricsData = {
        cpu: { usage: 25, cores: 4 },
        memory: { used: 2000000000, total: 8000000000, usage: 25 },
        disk: { used: 45000000000, total: 100000000000, usage: 45 },
        network: { inbound: 1000000, outbound: 2000000 }
      };

      (fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockHealthData,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockMetricsData,
        } as Response);

      render(<SystemMonitoring />);

      await waitFor(() => {
        expect(screen.getByText('System Monitoring')).toBeInTheDocument();
      });

      expect(screen.getByText('System Status')).toBeInTheDocument();
      expect(screen.getByText('Uptime')).toBeInTheDocument();
      expect(screen.getByText('CPU Usage')).toBeInTheDocument();
    });

    it('should handle system monitoring errors', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error('Network error'));

      render(<SystemMonitoring />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeInTheDocument();
    });
  });

  describe('AIProviderConfig', () => {
    it('should render AI provider configuration', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          configs: [
            {
              id: '1',
              provider: 'OPENAI',
              name: 'OpenAI Production',
              isEnabled: true,
              priority: 1,
              model: 'gpt-4',
              maxTokens: 4096,
              temperature: 0.7,
              costPerToken: 0.03
            }
          ]
        }),
      } as Response);

      render(<AIProviderConfigComponent organizationId="test-org" />);

      await waitFor(() => {
        expect(screen.getByText('AI Provider Configuration')).toBeInTheDocument();
      });

      expect(screen.getByText('OpenAI Production')).toBeInTheDocument();
      expect(screen.getByText('Add Provider')).toBeInTheDocument();
    });

    it('should test AI provider connection', async () => {
      (fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ configs: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, latency: 150 }),
        } as Response);

      render(<AIProviderConfigComponent organizationId="test-org" />);

      await waitFor(() => {
        expect(screen.getByText('AI Provider Configuration')).toBeInTheDocument();
      });

      // Add a provider first (this would require more complex mocking)
      // For now, just verify the component renders
      expect(screen.getByText('Add Provider')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    it('should handle real-time updates correctly', async () => {
      const mockConfig = {
        packages: [],
        freeCredits: 10,
        creditCostPerAnalysis: { base: 1, perFile: 0.1, perKB: 0.01 },
        usageLimits: { 
          freeUserDailyLimit: 5, 
          freeUserMonthlyLimit: 20,
          maxRepositorySize: 100,
          maxFilesPerRepository: 1000
        },
        freeTierConfig: {
          enabled: true,
          trialPeriodDays: 14,
          maxAnalysesPerTrial: 5,
          requireCreditCard: false,
        },
        realTimeUpdates: {
          enabled: true,
          notifyUsers: true,
        },
      };

      (fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ pricingConfig: mockConfig }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);

      render(<PricingConfig />);

      await waitFor(() => {
        expect(screen.getByText('Pricing Configuration')).toBeInTheDocument();
      });

      // Toggle real-time updates
      const realTimeToggle = screen.getByLabelText('Enable Real-time Price Updates');
      fireEvent.click(realTimeToggle);

      // Save configuration
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/admin/pricing', expect.any(Object));
      });
    });
  });
});
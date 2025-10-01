import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PWANotifications } from '../pwa-notifications';
import { PWAStatus } from '../pwa-status';

// Mock the PWA hook
jest.mock('@/lib/hooks/use-pwa');

const mockUsePWA = require('@/lib/hooks/use-pwa').usePWA as jest.MockedFunction<any>;

describe('PWA Integration', () => {
  beforeEach(() => {
    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      isOnline: true,
      hasUpdate: false,
      queuedRequests: 0,
      installApp: jest.fn().mockResolvedValue(true),
      updateApp: jest.fn(),
      processQueue: jest.fn(),
      clearCache: jest.fn()
    });
  });

  it('should render PWA notifications', () => {
    render(<PWANotifications />);
    
    // Should show install prompt
    expect(screen.getByText('Install App')).toBeInTheDocument();
    expect(screen.getByText('Install Baseline Analyzer for a better experience')).toBeInTheDocument();
  });

  it('should render PWA status component', () => {
    render(<PWAStatus showDetails={true} />);
    
    // Should show connection status
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    
    // Should show installation status
    expect(screen.getByText('App Installation')).toBeInTheDocument();
    expect(screen.getByText('Install')).toBeInTheDocument();
  });

  it('should handle install button click', async () => {
    const mockInstallApp = jest.fn().mockResolvedValue(true);
    
    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      isOnline: true,
      hasUpdate: false,
      queuedRequests: 0,
      installApp: mockInstallApp,
      updateApp: jest.fn(),
      processQueue: jest.fn(),
      clearCache: jest.fn()
    });

    render(<PWANotifications />);
    
    const installButton = screen.getByText('Install');
    fireEvent.click(installButton);

    await waitFor(() => {
      expect(mockInstallApp).toHaveBeenCalled();
    });
  });

  it('should show offline status when offline', () => {
    mockUsePWA.mockReturnValue({
      isInstallable: false,
      isInstalled: false,
      isOnline: false,
      hasUpdate: false,
      queuedRequests: 2,
      installApp: jest.fn(),
      updateApp: jest.fn(),
      processQueue: jest.fn(),
      clearCache: jest.fn()
    });

    render(<PWAStatus showDetails={false} />);
    
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Queued requests
  });

  it('should show update notification when available', () => {
    mockUsePWA.mockReturnValue({
      isInstallable: false,
      isInstalled: true,
      isOnline: true,
      hasUpdate: true,
      queuedRequests: 0,
      installApp: jest.fn(),
      updateApp: jest.fn(),
      processQueue: jest.fn(),
      clearCache: jest.fn()
    });

    render(<PWANotifications />);
    
    expect(screen.getByText('Update Available')).toBeInTheDocument();
    expect(screen.getByText('A new version of the app is ready')).toBeInTheDocument();
  });
});
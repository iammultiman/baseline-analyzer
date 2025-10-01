import { renderHook, act } from '@testing-library/react';
import { usePWA } from '../use-pwa';

// Mock service worker
const mockServiceWorker = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  getRegistration: jest.fn().mockResolvedValue(null),
  controller: {
    postMessage: jest.fn()
  }
};

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    onLine: true,
    serviceWorker: mockServiceWorker
  },
  writable: true
});

// Mock window events
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();
Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener,
  writable: true
});
Object.defineProperty(window, 'removeEventListener', {
  value: mockRemoveEventListener,
  writable: true
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
  writable: true
});

describe('usePWA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true
    });
  });

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => usePWA());

    expect(result.current.isInstallable).toBe(false);
    expect(result.current.isInstalled).toBe(false);
    expect(result.current.isOnline).toBe(true);
    expect(result.current.hasUpdate).toBe(false);
    expect(result.current.queuedRequests).toBe(0);
  });

  it('should detect online/offline status', () => {
    const { result } = renderHook(() => usePWA());

    expect(result.current.isOnline).toBe(true);

    // Simulate going offline
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true
    });

    // Trigger offline event
    const offlineHandler = mockAddEventListener.mock.calls.find(
      call => call[0] === 'offline'
    )?.[1];

    act(() => {
      if (offlineHandler) offlineHandler();
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('should handle install prompt', async () => {
    const mockPrompt = jest.fn().mockResolvedValue(undefined);
    const mockUserChoice = Promise.resolve({ outcome: 'accepted' });
    
    const mockEvent = {
      preventDefault: jest.fn(),
      prompt: mockPrompt,
      userChoice: mockUserChoice
    };

    const { result } = renderHook(() => usePWA());

    // Simulate beforeinstallprompt event
    const installHandler = mockAddEventListener.mock.calls.find(
      call => call[0] === 'beforeinstallprompt'
    )?.[1];

    act(() => {
      if (installHandler) installHandler(mockEvent);
    });

    expect(result.current.isInstallable).toBe(true);

    // Test install app
    const installResult = await act(async () => {
      return result.current.installApp();
    });

    expect(mockPrompt).toHaveBeenCalled();
    expect(installResult).toBe(true);
  });

  it('should handle service worker messages', () => {
    const { result } = renderHook(() => usePWA());

    // Simulate service worker message
    const messageHandler = mockServiceWorker.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1];

    act(() => {
      if (messageHandler) {
        messageHandler({
          data: {
            type: 'ANALYSIS_QUEUED',
            data: { url: '/api/analysis', timestamp: Date.now() }
          }
        });
      }
    });

    expect(result.current.queuedRequests).toBe(1);

    act(() => {
      if (messageHandler) {
        messageHandler({
          data: {
            type: 'ANALYSIS_PROCESSED',
            data: { url: '/api/analysis', timestamp: Date.now() }
          }
        });
      }
    });

    expect(result.current.queuedRequests).toBe(0);
  });

  it('should handle app updates', () => {
    const { result } = renderHook(() => usePWA());

    // Mock service worker registration with update
    const mockRegistration = {
      waiting: true,
      addEventListener: jest.fn(),
      installing: {
        addEventListener: jest.fn(),
        state: 'installed'
      }
    };

    mockServiceWorker.getRegistration.mockResolvedValue(mockRegistration);

    act(() => {
      result.current.updateApp();
    });

    expect(mockServiceWorker.controller.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING'
    });
  });

  it('should process queue', () => {
    const { result } = renderHook(() => usePWA());

    act(() => {
      result.current.processQueue();
    });

    expect(mockServiceWorker.controller.postMessage).toHaveBeenCalledWith({
      type: 'PROCESS_QUEUE'
    });
  });

  it('should clear cache', async () => {
    // Mock caches API
    const mockCaches = {
      keys: jest.fn().mockResolvedValue(['cache1', 'cache2']),
      delete: jest.fn().mockResolvedValue(true)
    };

    Object.defineProperty(window, 'caches', {
      value: mockCaches,
      writable: true
    });

    const { result } = renderHook(() => usePWA());

    await act(async () => {
      await result.current.clearCache();
    });

    expect(mockServiceWorker.controller.postMessage).toHaveBeenCalledWith({
      type: 'CLEAR_CACHE'
    });
    expect(mockCaches.keys).toHaveBeenCalled();
    expect(mockCaches.delete).toHaveBeenCalledTimes(2);
  });

  it('should detect installed app', () => {
    // Mock standalone display mode
    Object.defineProperty(window, 'matchMedia', {
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
      writable: true
    });

    const { result } = renderHook(() => usePWA());

    expect(result.current.isInstalled).toBe(true);
  });

  it('should handle failed install', async () => {
    const mockPrompt = jest.fn().mockResolvedValue(undefined);
    const mockUserChoice = Promise.resolve({ outcome: 'dismissed' });
    
    const mockEvent = {
      preventDefault: jest.fn(),
      prompt: mockPrompt,
      userChoice: mockUserChoice
    };

    const { result } = renderHook(() => usePWA());

    // Simulate beforeinstallprompt event
    const installHandler = mockAddEventListener.mock.calls.find(
      call => call[0] === 'beforeinstallprompt'
    )?.[1];

    act(() => {
      if (installHandler) installHandler(mockEvent);
    });

    // Test install app with dismissal
    const installResult = await act(async () => {
      return result.current.installApp();
    });

    expect(installResult).toBe(false);
  });
});
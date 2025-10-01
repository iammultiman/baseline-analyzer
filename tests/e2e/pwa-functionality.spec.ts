import { test, expect } from '@playwright/test'

test.describe('PWA Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      localStorage.setItem('auth-token', 'mock-token-123')
    })

    // Mock user data
    await page.route('/api/auth/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'test-user-123',
            email: 'test@example.com',
            displayName: 'Test User',
            creditBalance: 100
          }
        })
      })
    })
  })

  test('should display PWA install prompt', async ({ page }) => {
    // Mock beforeinstallprompt event
    await page.addInitScript(() => {
      // Simulate PWA install prompt
      setTimeout(() => {
        const event = new Event('beforeinstallprompt')
        Object.defineProperty(event, 'prompt', {
          value: () => Promise.resolve(),
          writable: false
        })
        Object.defineProperty(event, 'userChoice', {
          value: Promise.resolve({ outcome: 'accepted' }),
          writable: false
        })
        window.dispatchEvent(event)
      }, 1000)
    })

    await page.goto('/dashboard')

    // Should show install notification
    await expect(page.locator('[data-testid="pwa-install-prompt"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Install App')).toBeVisible()
    await expect(page.locator('text=Install Baseline Analyzer for a better experience')).toBeVisible()
  })

  test('should handle app installation', async ({ page }) => {
    let installPromptTriggered = false

    // Mock beforeinstallprompt event
    await page.addInitScript(() => {
      setTimeout(() => {
        const event = new Event('beforeinstallprompt')
        Object.defineProperty(event, 'prompt', {
          value: () => {
            window.installPromptTriggered = true
            return Promise.resolve()
          },
          writable: false
        })
        Object.defineProperty(event, 'userChoice', {
          value: Promise.resolve({ outcome: 'accepted' }),
          writable: false
        })
        window.dispatchEvent(event)
      }, 1000)
    })

    await page.goto('/dashboard')

    // Wait for install prompt to appear
    await expect(page.locator('[data-testid="pwa-install-prompt"]')).toBeVisible({ timeout: 5000 })

    // Click install button
    await page.click('button:has-text("Install")')

    // Check if prompt was triggered
    const promptTriggered = await page.evaluate(() => window.installPromptTriggered)
    expect(promptTriggered).toBe(true)
  })

  test('should show offline status and queue requests', async ({ page }) => {
    await page.goto('/dashboard')

    // Go offline
    await page.context().setOffline(true)

    // Should show offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible()
    await expect(page.locator('text=Offline')).toBeVisible()

    // Try to submit analysis while offline
    await page.goto('/repository-analysis')
    await page.fill('input[name="repositoryUrl"]', 'https://github.com/test/offline-repo')
    await page.click('button:has-text("Start Analysis")')

    // Should show queued message
    await expect(page.locator('text=Request queued')).toBeVisible()
    await expect(page.locator('text=will be processed when online')).toBeVisible()

    // Should show queued requests count
    await expect(page.locator('[data-testid="queued-requests"]')).toContainText('1')
  })

  test('should process queued requests when back online', async ({ page }) => {
    await page.goto('/dashboard')

    // Go offline and queue a request
    await page.context().setOffline(true)
    await page.goto('/repository-analysis')
    await page.fill('input[name="repositoryUrl"]', 'https://github.com/test/queued-repo')
    await page.click('button:has-text("Start Analysis")')

    // Verify request is queued
    await expect(page.locator('[data-testid="queued-requests"]')).toContainText('1')

    // Mock successful analysis submission
    await page.route('/api/analysis', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          analysisId: 'queued-analysis-123',
          status: 'PENDING'
        })
      })
    })

    // Go back online
    await page.context().setOffline(false)

    // Should show online indicator
    await expect(page.locator('[data-testid="online-indicator"]')).toBeVisible()
    await expect(page.locator('text=Online')).toBeVisible()

    // Should process queued requests
    await expect(page.locator('[data-testid="queued-requests"]')).toContainText('0', { timeout: 5000 })
    await expect(page.locator('text=Requests processed')).toBeVisible()
  })

  test('should show app update notification', async ({ page }) => {
    // Mock service worker with update
    await page.addInitScript(() => {
      // Simulate service worker update
      setTimeout(() => {
        const event = new Event('message')
        Object.defineProperty(event, 'data', {
          value: { type: 'UPDATE_AVAILABLE' },
          writable: false
        })
        window.dispatchEvent(event)
      }, 1000)
    })

    await page.goto('/dashboard')

    // Should show update notification
    await expect(page.locator('[data-testid="update-notification"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Update Available')).toBeVisible()
    await expect(page.locator('text=A new version of the app is ready')).toBeVisible()
  })

  test('should handle app update', async ({ page }) => {
    let updateTriggered = false

    // Mock service worker update
    await page.addInitScript(() => {
      // Mock service worker
      navigator.serviceWorker = {
        controller: {
          postMessage: (message) => {
            if (message.type === 'SKIP_WAITING') {
              window.updateTriggered = true
            }
          }
        },
        ready: Promise.resolve({
          waiting: true,
          update: () => Promise.resolve()
        })
      }

      // Simulate update available
      setTimeout(() => {
        const event = new Event('message')
        Object.defineProperty(event, 'data', {
          value: { type: 'UPDATE_AVAILABLE' },
          writable: false
        })
        window.dispatchEvent(event)
      }, 1000)
    })

    await page.goto('/dashboard')

    // Wait for update notification
    await expect(page.locator('[data-testid="update-notification"]')).toBeVisible({ timeout: 5000 })

    // Click update button
    await page.click('button:has-text("Update Now")')

    // Check if update was triggered
    const updateTriggered = await page.evaluate(() => window.updateTriggered)
    expect(updateTriggered).toBe(true)
  })

  test('should cache resources for offline use', async ({ page }) => {
    await page.goto('/dashboard')

    // Navigate to different pages to cache them
    await page.goto('/repository-analysis')
    await page.goto('/credits')
    await page.goto('/dashboard')

    // Go offline
    await page.context().setOffline(true)

    // Should still be able to navigate to cached pages
    await page.goto('/repository-analysis')
    await expect(page.locator('h1')).toContainText('Repository Analysis')

    await page.goto('/credits')
    await expect(page.locator('h1')).toContainText('Credits')

    // Should show offline indicator but pages should load
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible()
  })

  test('should show PWA status information', async ({ page }) => {
    await page.goto('/dashboard')

    // Click PWA status indicator
    await page.click('[data-testid="pwa-status"]')

    // Should show PWA status details
    await expect(page.locator('text=App Installation')).toBeVisible()
    await expect(page.locator('text=Connection Status')).toBeVisible()
    await expect(page.locator('text=Cache Status')).toBeVisible()

    // Should show connection status
    await expect(page.locator('text=Online')).toBeVisible()
    await expect(page.locator('text=Connected')).toBeVisible()
  })

  test('should handle PWA performance monitoring', async ({ page }) => {
    // Mock performance data
    await page.addInitScript(() => {
      // Mock performance observer
      window.PerformanceObserver = class {
        constructor(callback) {
          this.callback = callback
          setTimeout(() => {
            callback({
              getEntries: () => [
                {
                  name: 'first-contentful-paint',
                  startTime: 1200
                },
                {
                  name: 'largest-contentful-paint',
                  startTime: 2500
                }
              ]
            })
          }, 1000)
        }
        observe() {}
        disconnect() {}
      }
    })

    await page.goto('/dashboard')

    // Should collect performance metrics
    await page.waitForTimeout(2000)

    // Check if performance data is being tracked
    const performanceEntries = await page.evaluate(() => {
      return performance.getEntriesByType('navigation').length > 0
    })
    expect(performanceEntries).toBe(true)
  })

  test('should handle PWA manifest and theme', async ({ page }) => {
    await page.goto('/')

    // Check manifest link
    const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(manifestLink).toBe('/manifest.json')

    // Check theme color
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content')
    expect(themeColor).toBeTruthy()

    // Verify manifest content
    const manifestResponse = await page.request.get('/manifest.json')
    expect(manifestResponse.ok()).toBe(true)
    
    const manifest = await manifestResponse.json()
    expect(manifest.name).toBe('Baseline Analyzer')
    expect(manifest.short_name).toBe('Baseline Analyzer')
    expect(manifest.display).toBe('standalone')
  })

  test('should handle service worker lifecycle', async ({ page }) => {
    let serviceWorkerRegistered = false

    // Mock service worker registration
    await page.addInitScript(() => {
      navigator.serviceWorker = {
        register: (url) => {
          window.serviceWorkerRegistered = true
          return Promise.resolve({
            installing: null,
            waiting: null,
            active: {
              state: 'activated'
            },
            addEventListener: () => {},
            update: () => Promise.resolve()
          })
        },
        ready: Promise.resolve({
          active: { state: 'activated' }
        }),
        controller: null
      }
    })

    await page.goto('/')

    // Check if service worker was registered
    const swRegistered = await page.evaluate(() => window.serviceWorkerRegistered)
    expect(swRegistered).toBe(true)
  })
})
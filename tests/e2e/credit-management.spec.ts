import { test, expect } from '@playwright/test'

test.describe('Credit Management Workflow', () => {
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
            creditBalance: 50,
            organizationId: 'org-123'
          }
        })
      })
    })
  })

  test('should display credit balance and statistics', async ({ page }) => {
    // Mock credit data
    await page.route('/api/credits', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balance: 50,
          stats: {
            totalCreditsUsed: 150,
            analysisCount: 15,
            averageCreditsPerAnalysis: 10,
            period: 'Last 30 days'
          }
        })
      })
    })

    await page.goto('/credits')

    // Should show credit balance
    await expect(page.locator('text=50')).toBeVisible()
    await expect(page.locator('text=Credits available')).toBeVisible()

    // Should show usage statistics
    await expect(page.locator('text=150')).toBeVisible() // Total used
    await expect(page.locator('text=15')).toBeVisible() // Analysis count
    await expect(page.locator('text=10')).toBeVisible() // Average per analysis
  })

  test('should show low balance warning', async ({ page }) => {
    // Mock low credit balance
    await page.route('/api/credits', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balance: 5,
          stats: {
            totalCreditsUsed: 95,
            analysisCount: 10,
            averageCreditsPerAnalysis: 9.5
          }
        })
      })
    })

    await page.goto('/credits')

    // Should show low balance warning
    await expect(page.locator('[data-testid="low-balance-warning"]')).toBeVisible()
    await expect(page.locator('text=Low')).toBeVisible()
    await expect(page.locator('button:has-text("Buy Credits")')).toBeVisible()
  })

  test('should purchase credits', async ({ page }) => {
    // Mock credit packages
    await page.route('/api/credits/packages', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          packages: [
            {
              id: 'starter',
              name: 'Starter Pack',
              credits: 100,
              price: 1000, // $10.00
              description: 'Perfect for small projects'
            },
            {
              id: 'professional',
              name: 'Professional Pack',
              credits: 500,
              price: 4500, // $45.00
              description: 'Great for regular use'
            },
            {
              id: 'enterprise',
              name: 'Enterprise Pack',
              credits: 1000,
              price: 8000, // $80.00
              description: 'For large organizations'
            }
          ]
        })
      })
    })

    await page.goto('/credits')

    // Click buy credits button
    await page.click('button:has-text("Buy Credits")')

    // Should show credit packages
    await expect(page.locator('text=Starter Pack')).toBeVisible()
    await expect(page.locator('text=Professional Pack')).toBeVisible()
    await expect(page.locator('text=Enterprise Pack')).toBeVisible()

    // Should show prices
    await expect(page.locator('text=$10.00')).toBeVisible()
    await expect(page.locator('text=$45.00')).toBeVisible()
    await expect(page.locator('text=$80.00')).toBeVisible()

    // Mock purchase
    await page.route('/api/credits/purchase', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          package: { credits: 100 },
          newBalance: 150,
          transaction: {
            id: 'txn-123',
            amount: 100,
            type: 'PURCHASE'
          }
        })
      })
    })

    // Select and purchase starter pack
    await page.click('[data-package="starter"] button:has-text("Purchase")')

    // Should show success message
    await expect(page.locator('text=Purchase successful')).toBeVisible()
    await expect(page.locator('text=150')).toBeVisible() // New balance
  })

  test('should display credit history', async ({ page }) => {
    // Mock credit history
    await page.route('/api/credits', async route => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('include') === 'history') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            balance: 50,
            history: [
              {
                id: 'txn-1',
                type: 'PURCHASE',
                amount: 100,
                description: 'Credit purchase - Starter Pack',
                createdAt: '2024-01-01T00:00:00Z'
              },
              {
                id: 'txn-2',
                type: 'DEDUCTION',
                amount: -10,
                description: 'Repository analysis - sample-repo',
                createdAt: '2024-01-02T00:00:00Z'
              },
              {
                id: 'txn-3',
                type: 'DEDUCTION',
                amount: -15,
                description: 'Repository analysis - large-repo',
                createdAt: '2024-01-03T00:00:00Z'
              }
            ]
          })
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ balance: 50 })
        })
      }
    })

    await page.goto('/credits')

    // Click history tab
    await page.click('text=History')

    // Should show transaction history
    await expect(page.locator('text=Credit purchase - Starter Pack')).toBeVisible()
    await expect(page.locator('text=Repository analysis - sample-repo')).toBeVisible()
    await expect(page.locator('text=+100')).toBeVisible()
    await expect(page.locator('text=-10')).toBeVisible()
    await expect(page.locator('text=-15')).toBeVisible()

    // Should show transaction types
    await expect(page.locator('[data-type="PURCHASE"]')).toBeVisible()
    await expect(page.locator('[data-type="DEDUCTION"]')).toHaveCount(2)
  })

  test('should show usage analytics', async ({ page }) => {
    // Mock analytics data
    await page.route('/api/credits/analytics', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          overview: {
            totalCreditsUsed: 150,
            totalAnalyses: 15,
            averageCreditsPerAnalysis: 10,
            totalSpent: 5000,
            period: 'Last 30 days'
          },
          trends: {
            daily: [
              { date: '2024-01-01', creditsUsed: 10, analyses: 1, cost: 100 },
              { date: '2024-01-02', creditsUsed: 15, analyses: 2, cost: 150 },
              { date: '2024-01-03', creditsUsed: 20, analyses: 2, cost: 200 }
            ]
          },
          breakdown: {
            byComplexity: [
              { complexity: 'Simple', creditsUsed: 30, percentage: 20, color: '#0088FE' },
              { complexity: 'Medium', creditsUsed: 75, percentage: 50, color: '#00C49F' },
              { complexity: 'Complex', creditsUsed: 45, percentage: 30, color: '#FFBB28' }
            ]
          },
          projections: {
            monthlyProjection: 200,
            recommendedPackage: 'Professional Pack',
            savingsOpportunity: 500
          }
        })
      })
    })

    await page.goto('/credits')

    // Click analytics tab
    await page.click('text=Analytics')

    // Should show overview metrics
    await expect(page.locator('text=150')).toBeVisible() // Total credits used
    await expect(page.locator('text=15')).toBeVisible() // Total analyses
    await expect(page.locator('text=10')).toBeVisible() // Average per analysis

    // Should show projections
    await expect(page.locator('text=200')).toBeVisible() // Monthly projection
    await expect(page.locator('text=Professional Pack')).toBeVisible() // Recommended package

    // Should show charts
    await expect(page.locator('[data-testid="usage-chart"]')).toBeVisible()
    await expect(page.locator('[data-testid="complexity-chart"]')).toBeVisible()
  })

  test('should configure credit notifications', async ({ page }) => {
    // Mock notification settings
    await page.route('/api/credits/notification-settings', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            settings: {
              lowBalanceThreshold: 10,
              enableLowBalanceAlerts: true,
              enableUsageLimitAlerts: true,
              enableSpendingAlerts: false,
              enableRecommendations: true
            }
          })
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      }
    })

    await page.goto('/credits')

    // Click settings tab
    await page.click('text=Settings')

    // Should show notification settings
    await expect(page.locator('input[name="lowBalanceThreshold"]')).toHaveValue('10')
    await expect(page.locator('input[name="enableLowBalanceAlerts"]')).toBeChecked()
    await expect(page.locator('input[name="enableUsageLimitAlerts"]')).toBeChecked()
    await expect(page.locator('input[name="enableSpendingAlerts"]')).not.toBeChecked()

    // Update settings
    await page.fill('input[name="lowBalanceThreshold"]', '20')
    await page.check('input[name="enableSpendingAlerts"]')

    // Save settings
    await page.click('button:has-text("Save Settings")')

    // Should show success message
    await expect(page.locator('text=Settings saved')).toBeVisible()
  })

  test('should handle payment errors', async ({ page }) => {
    await page.goto('/credits')

    // Mock credit packages
    await page.route('/api/credits/packages', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          packages: [
            {
              id: 'starter',
              name: 'Starter Pack',
              credits: 100,
              price: 1000
            }
          ]
        })
      })
    })

    // Click buy credits
    await page.click('button:has-text("Buy Credits")')

    // Mock payment failure
    await page.route('/api/credits/purchase', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Payment failed: Insufficient funds'
        })
      })
    })

    // Try to purchase
    await page.click('[data-package="starter"] button:has-text("Purchase")')

    // Should show error message
    await expect(page.locator('[role="alert"]')).toContainText('Payment failed')
  })

  test('should calculate credit requirements for analysis', async ({ page }) => {
    // Mock credit calculator
    await page.route('/api/credits/calculate', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          estimatedCredits: 25,
          breakdown: {
            baseCredits: 5,
            fileCredits: 15,
            sizeCredits: 5
          },
          repositoryStats: {
            fileCount: 150,
            totalSize: 5120000,
            complexity: 'high'
          }
        })
      })
    })

    await page.goto('/credits')

    // Click calculator tab
    await page.click('text=Calculator')

    // Fill repository URL
    await page.fill('input[name="repositoryUrl"]', 'https://github.com/test/large-repo')

    // Calculate credits
    await page.click('button:has-text("Calculate")')

    // Should show estimation
    await expect(page.locator('text=25 credits')).toBeVisible()
    await expect(page.locator('text=150 files')).toBeVisible()
    await expect(page.locator('text=5.0 MB')).toBeVisible()
    await expect(page.locator('text=High complexity')).toBeVisible()

    // Should show breakdown
    await expect(page.locator('text=Base: 5 credits')).toBeVisible()
    await expect(page.locator('text=Files: 15 credits')).toBeVisible()
    await expect(page.locator('text=Size: 5 credits')).toBeVisible()
  })
})
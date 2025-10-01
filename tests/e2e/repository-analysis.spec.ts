import { test, expect } from '@playwright/test'

test.describe('Repository Analysis Workflow', () => {
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
            creditBalance: 100,
            organizationId: 'org-123'
          }
        })
      })
    })

    // Mock credit balance
    await page.route('/api/credits', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balance: 100,
          stats: {
            totalCreditsUsed: 50,
            analysisCount: 5,
            averageCreditsPerAnalysis: 10
          }
        })
      })
    })
  })

  test('should submit repository for analysis', async ({ page }) => {
    await page.goto('/repository-analysis')

    // Should show repository analysis form
    await expect(page.locator('h1')).toContainText('Repository Analysis')
    await expect(page.locator('input[name="repositoryUrl"]')).toBeVisible()

    // Fill repository URL
    await page.fill('input[name="repositoryUrl"]', 'https://github.com/test/sample-repo')

    // Mock cost estimation
    await page.route('/api/analysis/estimate', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          estimatedCredits: 15,
          breakdown: {
            baseCredits: 5,
            fileCredits: 8,
            sizeCredits: 2
          },
          repositoryStats: {
            fileCount: 80,
            totalSize: 2048000,
            complexity: 'medium'
          }
        })
      })
    })

    // Trigger cost estimation
    await page.click('button:has-text("Estimate Cost")')

    // Should show cost estimation
    await expect(page.locator('text=15 credits')).toBeVisible()
    await expect(page.locator('text=80 files')).toBeVisible()

    // Mock analysis submission
    await page.route('/api/analysis', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          analysisId: 'analysis-123',
          status: 'PENDING',
          estimatedCredits: 15
        })
      })
    })

    // Submit analysis
    await page.click('button:has-text("Start Analysis")')

    // Should redirect to analysis status page
    await expect(page).toHaveURL(/\/analysis\/analysis-123/)
  })

  test('should show analysis progress', async ({ page }) => {
    // Mock analysis status endpoint
    let progressValue = 0
    await page.route('/api/analysis/analysis-123/status', async route => {
      progressValue += 25
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'analysis-123',
          status: progressValue >= 100 ? 'COMPLETED' : 'PROCESSING',
          progress: Math.min(progressValue, 100),
          estimatedTimeRemaining: Math.max(0, 60000 - (progressValue * 600))
        })
      })
    })

    await page.goto('/analysis/analysis-123')

    // Should show progress indicator
    await expect(page.locator('[role="progressbar"]')).toBeVisible()
    await expect(page.locator('text=Processing')).toBeVisible()

    // Wait for progress updates
    await page.waitForTimeout(2000)

    // Should eventually show completion
    await expect(page.locator('text=Completed')).toBeVisible({ timeout: 10000 })
  })

  test('should display analysis results', async ({ page }) => {
    // Mock completed analysis
    await page.route('/api/analysis/analysis-123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'analysis-123',
          repositoryUrl: 'https://github.com/test/sample-repo',
          repositoryName: 'sample-repo',
          status: 'COMPLETED',
          results: {
            complianceScore: 85,
            recommendations: [
              {
                category: 'Accessibility',
                severity: 'medium',
                title: 'Add alt text to images',
                description: 'Images should have descriptive alt text for screen readers',
                files: ['src/components/image.tsx']
              },
              {
                category: 'Performance',
                severity: 'high',
                title: 'Optimize bundle size',
                description: 'Bundle size exceeds recommended limits',
                files: ['dist/main.js']
              }
            ],
            baselineMatches: [
              {
                feature: 'CSS Grid',
                status: 'baseline',
                usage: ['src/styles/layout.css']
              }
            ],
            issues: [
              {
                category: 'Performance',
                severity: 'high',
                title: 'Large bundle size',
                description: 'Bundle size exceeds 1MB',
                files: ['dist/main.js']
              }
            ]
          },
          metadata: {
            repositorySize: 2048000,
            fileCount: 80,
            processingTime: 45000,
            aiProvider: 'openai'
          }
        })
      })
    })

    await page.goto('/analysis/analysis-123')

    // Should show analysis results
    await expect(page.locator('text=85%')).toBeVisible() // Compliance score
    await expect(page.locator('text=Add alt text to images')).toBeVisible()
    await expect(page.locator('text=Optimize bundle size')).toBeVisible()
    await expect(page.locator('text=CSS Grid')).toBeVisible()

    // Should show different severity levels
    await expect(page.locator('[data-severity="high"]')).toBeVisible()
    await expect(page.locator('[data-severity="medium"]')).toBeVisible()

    // Should show file references
    await expect(page.locator('text=src/components/image.tsx')).toBeVisible()
  })

  test('should handle repository validation errors', async ({ page }) => {
    await page.goto('/repository-analysis')

    // Fill invalid repository URL
    await page.fill('input[name="repositoryUrl"]', 'invalid-url')

    // Mock validation error
    await page.route('/api/repositories/validate', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid repository URL format'
        })
      })
    })

    // Try to estimate cost
    await page.click('button:has-text("Estimate Cost")')

    // Should show error message
    await expect(page.locator('[role="alert"]')).toContainText('Invalid repository URL')
  })

  test('should handle insufficient credits', async ({ page }) => {
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

    await page.goto('/repository-analysis')

    // Should show low credit warning
    await expect(page.locator('text=Low credit balance')).toBeVisible()

    // Fill repository URL
    await page.fill('input[name="repositoryUrl"]', 'https://github.com/test/large-repo')

    // Mock high cost estimation
    await page.route('/api/analysis/estimate', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          estimatedCredits: 25,
          breakdown: {
            baseCredits: 5,
            fileCredits: 15,
            sizeCredits: 5
          }
        })
      })
    })

    await page.click('button:has-text("Estimate Cost")')

    // Should show insufficient credits warning
    await expect(page.locator('text=Insufficient credits')).toBeVisible()
    await expect(page.locator('button:has-text("Buy Credits")')).toBeVisible()
  })

  test('should export analysis results', async ({ page }) => {
    // Mock analysis data
    await page.route('/api/analysis/analysis-123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'analysis-123',
          repositoryName: 'sample-repo',
          status: 'COMPLETED',
          results: {
            complianceScore: 85,
            recommendations: [],
            baselineMatches: [],
            issues: []
          }
        })
      })
    })

    // Mock export endpoint
    await page.route('/api/reporting/export**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('mock-pdf-content')
      })
    })

    await page.goto('/analysis/analysis-123')

    // Click export button
    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Export PDF")')
    const download = await downloadPromise

    // Should download file
    expect(download.suggestedFilename()).toContain('analysis-report')
  })

  test('should show analysis history', async ({ page }) => {
    // Mock analysis history
    await page.route('/api/analysis', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          analyses: [
            {
              id: 'analysis-1',
              repositoryName: 'repo-1',
              repositoryUrl: 'https://github.com/test/repo-1',
              status: 'COMPLETED',
              analysisDate: '2024-01-01T00:00:00Z',
              results: { complianceScore: 85 }
            },
            {
              id: 'analysis-2',
              repositoryName: 'repo-2',
              repositoryUrl: 'https://github.com/test/repo-2',
              status: 'FAILED',
              analysisDate: '2024-01-02T00:00:00Z',
              results: null
            }
          ],
          totalCount: 2,
          hasMore: false
        })
      })
    })

    await page.goto('/repository-analysis')

    // Click history tab
    await page.click('text=History')

    // Should show analysis history
    await expect(page.locator('text=repo-1')).toBeVisible()
    await expect(page.locator('text=repo-2')).toBeVisible()
    await expect(page.locator('text=85%')).toBeVisible()
    await expect(page.locator('[data-status="COMPLETED"]')).toBeVisible()
    await expect(page.locator('[data-status="FAILED"]')).toBeVisible()
  })

  test('should filter analysis history', async ({ page }) => {
    await page.goto('/repository-analysis')
    await page.click('text=History')

    // Mock filtered results
    await page.route('/api/analysis?status=COMPLETED**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          analyses: [
            {
              id: 'analysis-1',
              repositoryName: 'completed-repo',
              status: 'COMPLETED',
              results: { complianceScore: 90 }
            }
          ],
          totalCount: 1,
          hasMore: false
        })
      })
    })

    // Apply status filter
    await page.selectOption('select[name="status"]', 'COMPLETED')

    // Should show only completed analyses
    await expect(page.locator('text=completed-repo')).toBeVisible()
  })
})
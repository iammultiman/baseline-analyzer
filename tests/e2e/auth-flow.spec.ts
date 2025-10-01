import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Firebase Auth for testing
    await page.addInitScript(() => {
      // Mock Firebase Auth
      window.mockFirebaseAuth = {
        currentUser: null,
        signInWithEmailAndPassword: async (email: string, password: string) => {
          if (email === 'test@example.com' && password === 'password123') {
            return {
              user: {
                uid: 'test-user-123',
                email: 'test@example.com',
                displayName: 'Test User',
                getIdToken: async () => 'mock-token-123'
              }
            }
          }
          throw new Error('Invalid credentials')
        },
        createUserWithEmailAndPassword: async (email: string, password: string) => {
          return {
            user: {
              uid: 'new-user-123',
              email,
              displayName: null,
              getIdToken: async () => 'mock-token-456'
            }
          }
        },
        signOut: async () => {
          window.mockFirebaseAuth.currentUser = null
        }
      }
    })
  })

  test('should display login form on homepage for unauthenticated users', async ({ page }) => {
    await page.goto('/')
    
    // Should redirect to login or show login form
    await expect(page.locator('h1')).toContainText(['Sign In', 'Login', 'Welcome'])
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Fill login form
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    
    // Mock successful API response
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
            organizationId: null
          }
        })
      })
    })
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('h1')).toContainText('Dashboard')
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Fill login form with invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Should show error message
    await expect(page.locator('[role="alert"]')).toContainText(['Invalid', 'error', 'failed'])
  })

  test('should register new user', async ({ page }) => {
    await page.goto('/auth/signup')
    
    // Fill registration form
    await page.fill('input[name="email"]', 'newuser@example.com')
    await page.fill('input[name="password"]', 'newpassword123')
    await page.fill('input[name="confirmPassword"]', 'newpassword123')
    await page.fill('input[name="displayName"]', 'New User')
    await page.check('input[name="acceptTerms"]')
    
    // Mock successful registration
    await page.route('/api/auth/register', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'new-user-123',
            email: 'newuser@example.com',
            displayName: 'New User',
            creditBalance: 10
          }
        })
      })
    })
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Should redirect to dashboard or show success message
    await expect(page).toHaveURL(/\/(dashboard|welcome)/)
  })

  test('should validate registration form', async ({ page }) => {
    await page.goto('/auth/signup')
    
    // Try to submit empty form
    await page.click('button[type="submit"]')
    
    // Should show validation errors
    await expect(page.locator('input[name="email"]:invalid')).toBeVisible()
    await expect(page.locator('input[name="password"]:invalid')).toBeVisible()
  })

  test('should logout user', async ({ page }) => {
    // First login
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    
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
    
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')
    
    // Now logout
    await page.click('[data-testid="user-menu"]')
    await page.click('text=Logout')
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/(auth\/login|login|\/)/)
  })

  test('should handle forgot password flow', async ({ page }) => {
    await page.goto('/auth/forgot-password')
    
    // Fill email
    await page.fill('input[type="email"]', 'test@example.com')
    
    // Mock password reset
    await page.route('/api/auth/forgot-password', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Should show success message
    await expect(page.locator('text=email sent')).toBeVisible()
  })

  test('should protect authenticated routes', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/dashboard')
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/(auth\/login|login)/)
  })

  test('should persist authentication across page reloads', async ({ page }) => {
    // Login first
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    
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
    
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')
    
    // Reload page
    await page.reload()
    
    // Should still be authenticated
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('h1')).toContainText('Dashboard')
  })
})
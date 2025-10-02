import { test, expect, Page } from '@playwright/test';

test.describe('User Acceptance Testing - Complete User Workflows', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Complete User Registration to Analysis Workflow', () => {
    test('should complete full user journey from registration to repository analysis', async () => {
      // Step 1: Navigate to application
      await page.goto('/');
      await expect(page).toHaveTitle(/Baseline Analyzer/);

      // Step 2: User Registration
      await page.click('[data-testid="signup-button"]');
      await page.fill('[data-testid="email-input"]', 'testuser@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.fill('[data-testid="confirm-password-input"]', 'TestPassword123!');
      await page.click('[data-testid="register-submit"]');

      // Wait for registration success and redirect
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible();

      // Step 3: Check initial credit balance
      const creditBalance = page.locator('[data-testid="credit-balance"]');
      await expect(creditBalance).toBeVisible();
      await expect(creditBalance).toContainText('100'); // Default free credits

      // Step 4: Submit repository for analysis
      await page.click('[data-testid="analyze-repository-button"]');
      await page.fill('[data-testid="repository-url-input"]', 'https://github.com/microsoft/TypeScript');
      await page.click('[data-testid="submit-analysis"]');

      // Step 5: Monitor analysis progress
      await expect(page.locator('[data-testid="analysis-status"]')).toContainText('Processing');
      
      // Wait for analysis completion (with timeout)
      await expect(page.locator('[data-testid="analysis-status"]')).toContainText('Completed', { timeout: 60000 });

      // Step 6: View analysis results
      await expect(page.locator('[data-testid="compliance-score"]')).toBeVisible();
      await expect(page.locator('[data-testid="recommendations-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="baseline-matches"]')).toBeVisible();

      // Step 7: Verify credit deduction
      const updatedBalance = await page.locator('[data-testid="credit-balance"]').textContent();
      expect(parseInt(updatedBalance || '0')).toBeLessThan(100);

      // Step 8: Export analysis report
      await page.click('[data-testid="export-pdf-button"]');
      const downloadPromise = page.waitForEvent('download');
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/analysis-report.*\.pdf/);
    });

    test('should handle repository analysis with insufficient credits', async () => {
      // Login with user that has low credits
      await page.goto('/auth/login');
      await page.fill('[data-testid="email-input"]', 'lowcredit@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-submit"]');

      await expect(page).toHaveURL(/\/dashboard/);

      // Try to analyze repository
      await page.click('[data-testid="analyze-repository-button"]');
      await page.fill('[data-testid="repository-url-input"]', 'https://github.com/facebook/react');
      await page.click('[data-testid="submit-analysis"]');

      // Should show insufficient credits error
      await expect(page.locator('[data-testid="insufficient-credits-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="purchase-credits-button"]')).toBeVisible();

      // Navigate to credit purchase
      await page.click('[data-testid="purchase-credits-button"]');
      await expect(page).toHaveURL(/\/credits/);
      await expect(page.locator('[data-testid="credit-packages"]')).toBeVisible();
    });
  });

  test.describe('Organization Management and Team Collaboration', () => {
    test('should create organization and invite team members', async () => {
      // Login as organization owner
      await page.goto('/auth/login');
      await page.fill('[data-testid="email-input"]', 'orgowner@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-submit"]');

      await expect(page).toHaveURL(/\/dashboard/);

      // Create new organization
      await page.click('[data-testid="create-organization-button"]');
      await page.fill('[data-testid="organization-name-input"]', 'Test Organization');
      await page.fill('[data-testid="organization-slug-input"]', 'test-org');
      await page.click('[data-testid="create-org-submit"]');

      await expect(page.locator('[data-testid="organization-created-success"]')).toBeVisible();

      // Navigate to team management
      await page.click('[data-testid="manage-team-button"]');
      await expect(page).toHaveURL(/\/organization\/team/);

      // Invite team member
      await page.click('[data-testid="invite-member-button"]');
      await page.fill('[data-testid="invite-email-input"]', 'teammember@example.com');
      await page.selectOption('[data-testid="invite-role-select"]', 'member');
      await page.click('[data-testid="send-invitation"]');

      await expect(page.locator('[data-testid="invitation-sent-success"]')).toBeVisible();

      // Verify invitation appears in pending list
      await expect(page.locator('[data-testid="pending-invitations"]')).toContainText('teammember@example.com');
    });

    test('should accept team invitation and access organization resources', async () => {
      // Simulate clicking invitation link (in real scenario, this would come from email)
      const invitationToken = 'test-invitation-token-123';
      await page.goto(`/invitations/accept?token=${invitationToken}`);

      // Should redirect to login if not authenticated
      await expect(page).toHaveURL(/\/auth\/login/);

      // Login as invited user
      await page.fill('[data-testid="email-input"]', 'teammember@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-submit"]');

      // Should redirect back to invitation acceptance
      await expect(page).toHaveURL(/\/invitations\/accept/);
      await page.click('[data-testid="accept-invitation-button"]');

      await expect(page.locator('[data-testid="invitation-accepted-success"]')).toBeVisible();

      // Verify access to organization dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.locator('[data-testid="organization-name"]')).toContainText('Test Organization');

      // Verify can view organization analyses
      await expect(page.locator('[data-testid="organization-analyses"]')).toBeVisible();
    });

    test('should enforce role-based permissions', async () => {
      // Login as member (not admin)
      await page.goto('/auth/login');
      await page.fill('[data-testid="email-input"]', 'member@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-submit"]');

      await expect(page).toHaveURL(/\/dashboard/);

      // Try to access admin settings
      await page.goto('/admin');
      await expect(page.locator('[data-testid="access-denied-message"]')).toBeVisible();

      // Verify can access allowed features
      await page.goto('/repository-analysis');
      await expect(page.locator('[data-testid="repository-analysis-form"]')).toBeVisible();

      // Try to invite team members (should be restricted)
      await page.goto('/organization/team');
      await expect(page.locator('[data-testid="invite-member-button"]')).not.toBeVisible();
    });
  });

  test.describe('PWA Functionality and Offline Support', () => {
    test('should work as PWA with offline capabilities', async () => {
      await page.goto('/');

      // Check PWA manifest
      const manifestLink = page.locator('link[rel="manifest"]');
      await expect(manifestLink).toHaveAttribute('href', '/manifest.json');

      // Check service worker registration
      const swRegistration = await page.evaluate(() => {
        return navigator.serviceWorker.getRegistration();
      });
      expect(swRegistration).toBeTruthy();

      // Test offline functionality
      await page.context().setOffline(true);
      
      // Navigate to cached page
      await page.goto('/dashboard');
      await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

      // Try to submit analysis while offline
      await page.click('[data-testid="analyze-repository-button"]');
      await page.fill('[data-testid="repository-url-input"]', 'https://github.com/vuejs/vue');
      await page.click('[data-testid="submit-analysis"]');

      // Should queue request for when online
      await expect(page.locator('[data-testid="queued-for-online"]')).toBeVisible();

      // Go back online
      await page.context().setOffline(false);
      await page.reload();

      // Queued request should be processed
      await expect(page.locator('[data-testid="analysis-status"]')).toContainText('Processing');
    });

    test('should show app update notifications', async () => {
      await page.goto('/');

      // Simulate service worker update
      await page.evaluate(() => {
        // Trigger update available event
        window.dispatchEvent(new CustomEvent('sw-update-available'));
      });

      await expect(page.locator('[data-testid="app-update-notification"]')).toBeVisible();
      await expect(page.locator('[data-testid="update-app-button"]')).toBeVisible();

      // Click update
      await page.click('[data-testid="update-app-button"]');
      
      // Should reload with new version
      await page.waitForLoadState('networkidle');
      await expect(page.locator('[data-testid="app-updated-success"]')).toBeVisible();
    });
  });

  test.describe('Credit Management and Payment Flow', () => {
    test('should complete credit purchase workflow', async () => {
      await page.goto('/auth/login');
      await page.fill('[data-testid="email-input"]', 'buyer@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-submit"]');

      await expect(page).toHaveURL(/\/dashboard/);

      // Navigate to credit purchase
      await page.goto('/credits');
      await expect(page.locator('[data-testid="credit-packages"]')).toBeVisible();

      // Select credit package
      await page.click('[data-testid="package-500-credits"]');
      await expect(page.locator('[data-testid="selected-package"]')).toContainText('500 Credits');

      // Proceed to payment
      await page.click('[data-testid="proceed-to-payment"]');
      await expect(page.locator('[data-testid="payment-form"]')).toBeVisible();

      // Fill payment details (test mode)
      await page.fill('[data-testid="card-number"]', '4242424242424242');
      await page.fill('[data-testid="card-expiry"]', '12/25');
      await page.fill('[data-testid="card-cvc"]', '123');
      await page.click('[data-testid="complete-payment"]');

      // Wait for payment processing
      await expect(page.locator('[data-testid="payment-processing"]')).toBeVisible();
      await expect(page.locator('[data-testid="payment-success"]')).toBeVisible({ timeout: 10000 });

      // Verify credits added to account
      await page.goto('/dashboard');
      const creditBalance = await page.locator('[data-testid="credit-balance"]').textContent();
      expect(parseInt(creditBalance || '0')).toBeGreaterThanOrEqual(500);
    });

    test('should show usage analytics and history', async () => {
      await page.goto('/auth/login');
      await page.fill('[data-testid="email-input"]', 'analytics@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-submit"]');

      await page.goto('/credits');

      // Check usage analytics
      await page.click('[data-testid="usage-analytics-tab"]');
      await expect(page.locator('[data-testid="usage-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="monthly-usage"]')).toBeVisible();

      // Check credit history
      await page.click('[data-testid="credit-history-tab"]');
      await expect(page.locator('[data-testid="transaction-history"]')).toBeVisible();
      await expect(page.locator('[data-testid="transaction-item"]')).toHaveCount.greaterThan(0);
    });
  });

  test.describe('Admin Configuration and Management', () => {
    test('should configure AI providers and pricing', async () => {
      // Login as admin
      await page.goto('/auth/login');
      await page.fill('[data-testid="email-input"]', 'admin@example.com');
      await page.fill('[data-testid="password-input"]', 'AdminPassword123!');
      await page.click('[data-testid="login-submit"]');

      await page.goto('/admin');
      await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();

      // Configure AI provider
      await page.click('[data-testid="ai-providers-tab"]');
      await page.click('[data-testid="add-provider-button"]');
      await page.selectOption('[data-testid="provider-type"]', 'openai');
      await page.fill('[data-testid="provider-name"]', 'OpenAI Production');
      await page.fill('[data-testid="api-key"]', 'sk-test-key-123');
      await page.click('[data-testid="save-provider"]');

      await expect(page.locator('[data-testid="provider-saved-success"]')).toBeVisible();

      // Test provider connection
      await page.click('[data-testid="test-provider-connection"]');
      await expect(page.locator('[data-testid="connection-test-result"]')).toBeVisible();

      // Configure pricing
      await page.click('[data-testid="pricing-tab"]');
      await page.fill('[data-testid="base-cost-per-analysis"]', '10');
      await page.fill('[data-testid="cost-per-file"]', '0.5');
      await page.fill('[data-testid="markup-percentage"]', '20');
      await page.click('[data-testid="save-pricing"]');

      await expect(page.locator('[data-testid="pricing-saved-success"]')).toBeVisible();
    });

    test('should monitor system health and usage', async () => {
      await page.goto('/auth/login');
      await page.fill('[data-testid="email-input"]', 'admin@example.com');
      await page.fill('[data-testid="password-input"]', 'AdminPassword123!');
      await page.click('[data-testid="login-submit"]');

      await page.goto('/admin');
      await page.click('[data-testid="monitoring-tab"]');

      // Check system health metrics
      await expect(page.locator('[data-testid="system-health-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="database-status"]')).toContainText('Healthy');
      await expect(page.locator('[data-testid="ai-provider-status"]')).toContainText('Operational');

      // Check usage statistics
      await expect(page.locator('[data-testid="total-analyses"]')).toBeVisible();
      await expect(page.locator('[data-testid="active-users"]')).toBeVisible();
      await expect(page.locator('[data-testid="revenue-metrics"]')).toBeVisible();

      // Check recent activity
      await expect(page.locator('[data-testid="recent-analyses"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-logs"]')).toBeVisible();
    });
  });

  test.describe('CI/CD Integration Workflow', () => {
    test('should create and use API keys for CI/CD integration', async () => {
      await page.goto('/auth/login');
      await page.fill('[data-testid="email-input"]', 'devops@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-submit"]');

      await page.goto('/dashboard');
      await page.click('[data-testid="cicd-integration-tab"]');

      // Create API key
      await page.click('[data-testid="create-api-key-button"]');
      await page.fill('[data-testid="api-key-name"]', 'Production CI/CD');
      await page.fill('[data-testid="api-key-description"]', 'For GitHub Actions integration');
      await page.click('[data-testid="create-api-key"]');

      // Copy API key
      await expect(page.locator('[data-testid="api-key-created"]')).toBeVisible();
      const apiKey = await page.locator('[data-testid="api-key-value"]').textContent();
      expect(apiKey).toMatch(/^ba_[a-zA-Z0-9]{32}$/);

      // Test API key usage
      const response = await page.request.post('/api/cicd/analyze', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          repositoryUrl: 'https://github.com/microsoft/vscode',
          webhookUrl: 'https://example.com/webhook'
        }
      });

      expect(response.status()).toBe(200);
      const result = await response.json();
      expect(result.analysisId).toBeTruthy();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle invalid repository URLs gracefully', async () => {
      await page.goto('/auth/login');
      await page.fill('[data-testid="email-input"]', 'user@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-submit"]');

      await page.goto('/repository-analysis');

      // Test invalid URL
      await page.fill('[data-testid="repository-url-input"]', 'not-a-valid-url');
      await page.click('[data-testid="submit-analysis"]');
      await expect(page.locator('[data-testid="url-validation-error"]')).toBeVisible();

      // Test private repository without access
      await page.fill('[data-testid="repository-url-input"]', 'https://github.com/private/repo');
      await page.click('[data-testid="submit-analysis"]');
      await expect(page.locator('[data-testid="access-denied-error"]')).toBeVisible();

      // Test non-existent repository
      await page.fill('[data-testid="repository-url-input"]', 'https://github.com/nonexistent/repo');
      await page.click('[data-testid="submit-analysis"]');
      await expect(page.locator('[data-testid="repository-not-found-error"]')).toBeVisible();
    });

    test('should handle AI provider failures with fallback', async () => {
      await page.goto('/auth/login');
      await page.fill('[data-testid="email-input"]', 'user@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-submit"]');

      // Submit analysis that will trigger provider failure
      await page.goto('/repository-analysis');
      await page.fill('[data-testid="repository-url-input"]', 'https://github.com/test/trigger-failure');
      await page.click('[data-testid="submit-analysis"]');

      // Should show fallback provider being used
      await expect(page.locator('[data-testid="provider-fallback-notice"]')).toBeVisible();
      await expect(page.locator('[data-testid="analysis-status"]')).toContainText('Processing with backup provider');
    });
  });
}); 
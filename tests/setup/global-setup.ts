import { chromium, FullConfig } from '@playwright/test'
import { setupTestDatabase } from './test-db'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...')

  // Setup test database
  if (process.env.DATABASE_URL) {
    console.log('📊 Setting up test database...')
    await setupTestDatabase()
    console.log('✅ Test database setup complete')
  }

  // Start the application server if needed
  if (process.env.CI) {
    console.log('🌐 Starting application server for CI...')
    // In CI, the server is started by the GitHub Actions workflow
  }

  // Setup browser for authentication state
  console.log('🔐 Setting up authentication state...')
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  // Mock authentication for tests
  await page.addInitScript(() => {
    // Mock localStorage auth token
    localStorage.setItem('auth-token', 'test-token-123')
    
    // Mock Firebase Auth
    window.mockFirebaseAuth = {
      currentUser: {
        uid: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        getIdToken: async () => 'mock-token-123'
      },
      onAuthStateChanged: (callback: any) => {
        callback(window.mockFirebaseAuth.currentUser)
        return () => {}
      }
    }
  })

  // Save authentication state
  await page.context().storageState({ path: 'tests/setup/auth-state.json' })

  await browser.close()
  console.log('✅ Authentication state saved')

  console.log('🎉 Global test setup complete!')
}

export default globalSetup
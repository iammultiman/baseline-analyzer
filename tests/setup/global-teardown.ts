import { FullConfig } from '@playwright/test'
import { cleanupTestDatabase, testPrisma } from './test-db'
import fs from 'fs'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global test teardown...')

  // Cleanup test database
  if (process.env.DATABASE_URL) {
    console.log('📊 Cleaning up test database...')
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    console.log('✅ Test database cleanup complete')
  }

  // Remove authentication state file
  const authStatePath = 'tests/setup/auth-state.json'
  if (fs.existsSync(authStatePath)) {
    fs.unlinkSync(authStatePath)
    console.log('🔐 Authentication state file removed')
  }

  // Cleanup test artifacts
  const testArtifacts = [
    'test-results',
    'playwright-report',
    'coverage'
  ]

  for (const artifact of testArtifacts) {
    if (fs.existsSync(artifact)) {
      fs.rmSync(artifact, { recursive: true, force: true })
      console.log(`🗑️ Removed ${artifact} directory`)
    }
  }

  console.log('✨ Global test teardown complete!')
}

export default globalTeardown
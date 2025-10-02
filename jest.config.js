const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/tests/e2e/',
    '<rootDir>/tests/production/',
    '<rootDir>/tests/load/',
    '<rootDir>/playwright-report/',
    '<rootDir>/test-results/',
    '\\.spec\\.(ts|js)$',
    'performance-optimizer.test.ts',
    'use-repository-analysis.test.ts',
    'use-credit-balance.test.ts',
    'auth-middleware.test.ts',
    'tenant-middleware.test.ts',
    'organizations-integration.test.ts',
    'auth-integration.test.ts',
    'analysis-error-handler.test.ts',
    'payment-service.test.ts',
    'api-keys.test.ts',
    'credits/route.test.ts',
    'security-audit.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/app/**/layout.tsx',
    '!src/app/**/page.tsx',
    '!src/components/ui/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  testTimeout: 15000,
  maxWorkers: '50%',
  transformIgnorePatterns: [
    'node_modules/(?!(jose|jwks-rsa|@sendgrid|stripe)/)',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
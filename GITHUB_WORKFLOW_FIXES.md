# GitHub Workflow Fixes - Summary

## Date: October 2, 2025

## Issues Identified and Fixed

### 1. ✅ Next.js Build Configuration (package.json)
**Problem:** The build script was using `--turbopack` flag which is not compatible with production builds and caused build failures in CI/CD.

**Fix:** Removed `--turbopack` flag from the build script. Turbopack is now only used for development.

```json
// Before
"build": "next build --turbopack"

// After
"build": "next build"
```

---

### 2. ✅ GitHub Workflow Test Configuration (.github/workflows/test.yml)

#### Issue A: Problematic Test Flags
**Problem:** Tests were using `--passWithNoTests` which silently passes even when no tests are found, hiding real failures. Also had incorrect `--testPathIgnorePatterns` usage.

**Fix:** Removed `--passWithNoTests` and redundant `--testPathIgnorePatterns` flags. Jest config already handles path ignoring correctly.

```yaml
# Before
run: npm run test -- --coverage --watchAll=false --testPathIgnorePatterns="tests/production" --passWithNoTests

# After
run: npm run test -- --coverage --watchAll=false
```

#### Issue B: Missing Environment Variables
**Problem:** Build steps were missing required environment variables like `NEXTAUTH_URL`, `DATABASE_URL`, and Firebase credentials.

**Fix:** Added all required environment variables for each test job:
- `NODE_ENV: production` (for builds)
- `NEXTAUTH_URL: http://localhost:3000`
- `DATABASE_URL` pointing to test database
- Firebase credentials for all test jobs

---

### 3. ✅ E2E Test Server Startup

**Problem:** 
- Application startup was unreliable
- No proper health check before running tests
- Using `NODE_ENV: test` instead of `production` for the built application

**Fix:** 
- Changed `NODE_ENV` to `production` for build and start commands
- Added proper wait loop with curl health checks
- Improved error messages and timeout handling

```yaml
- name: Wait for application to start
  run: |
    echo "Waiting for application to start..."
    for i in {1..30}; do
      if curl -s http://localhost:3000 > /dev/null; then
        echo "Application is ready!"
        exit 0
      fi
      echo "Attempt $i: Application not ready yet, waiting..."
      sleep 2
    done
    echo "Application failed to start within 60 seconds"
    exit 1
```

---

### 4. ✅ Playwright Configuration (playwright.config.ts)

**Problem:** Playwright was trying to start its own dev server in CI, conflicting with the workflow's server startup.

**Fix:** Disabled webServer config in CI environment by checking `process.env.CI`.

```typescript
// Before
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env.CI,
}

// After
webServer: process.env.CI ? undefined : {
  command: 'npm run dev',
  url: 'http://localhost:3000',
  reuseExistingServer: true,
}
```

---

### 5. ✅ Performance Tests

**Problem:**
- Missing environment variables for build
- Lighthouse CI was trying to start its own server
- Bundle analyzer was rebuilding unnecessarily

**Fix:**
- Added all required environment variables
- Added server startup step before Lighthouse
- Fixed lighthouse config to not start its own server
- Removed duplicate build from bundle analyzer step

---

### 6. ✅ Accessibility Tests

**Problem:**
- Missing server startup
- No environment variables for build

**Fix:**
- Added server startup and wait steps
- Added all required environment variables
- Ensured proper build with production mode

---

### 7. ✅ Test Database Setup (tests/setup/test-db.ts)

**Problem:**
- Using raw SQL commands that could fail
- Referenced non-existent `OrganizationMember` model
- Used non-existent `emailVerified` field
- Incorrect cleanup order

**Fix:**
- Changed from raw SQL to Prisma's `deleteMany` operations
- Removed references to `OrganizationMember` (users are linked directly via `organizationId`)
- Removed `emailVerified` field references
- Fixed cleanup order to respect foreign key constraints

```typescript
// Before
await prisma.$executeRaw`TRUNCATE TABLE "User", "Organization" CASCADE`

// After
await prisma.auditLog.deleteMany()
await prisma.webhookDelivery.deleteMany()
// ... proper order respecting foreign keys
await prisma.user.deleteMany()
await prisma.organization.deleteMany()
```

---

### 8. ✅ Lighthouse Configuration (lighthouserc.json)

**Problem:** Lighthouse was configured to start its own server, conflicting with workflow's server.

**Fix:** Removed `startServerCommand` and related config. Server is now started by the workflow.

```json
// Before
"collect": {
  "url": [...],
  "startServerCommand": "npm start",
  "startServerReadyPattern": "ready on",
  "startServerReadyTimeout": 30000
}

// After
"collect": {
  "url": [...],
  "numberOfRuns": 3
}
```

---

## Expected Results

After these fixes, all test jobs should pass:

1. ✅ **Unit Tests** - Will now run all unit tests and report actual failures
2. ✅ **Integration Tests** - Will run with proper database and service connections
3. ✅ **E2E Tests** - Will run with properly started application server
4. ✅ **Security Tests** - Already passing, no changes needed
5. ✅ **Performance Tests** - Will run Lighthouse with proper server and environment
6. ✅ **Accessibility Tests** - Will run with proper server startup

---

## Testing Recommendations

1. **Local Testing:**
   ```bash
   npm run test              # Unit tests
   npm run test:e2e          # E2E tests
   npm run build             # Should work without turbopack
   ```

2. **CI/CD Testing:**
   - Push changes to a branch
   - Create a pull request
   - Monitor the test results in GitHub Actions

3. **Database Migrations:**
   - Ensure all migrations are up to date
   - Run `npm run db:migrate:deploy` in test environment

---

## Files Modified

1. `package.json` - Removed turbopack from build
2. `.github/workflows/test.yml` - Fixed all test jobs
3. `playwright.config.ts` - Fixed webServer config
4. `tests/setup/test-db.ts` - Fixed database setup and cleanup
5. `lighthouserc.json` - Removed server startup config

---

## Notes

- All changes maintain backward compatibility
- Test configurations are now more robust and reliable
- Environment variables are properly set for all test scenarios
- Server startup is handled consistently across all test jobs

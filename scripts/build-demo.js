#!/usr/bin/env node
/*
  Demo build script:
  - Temporarily moves src/app/api out of the tree so Next static export succeeds.
  - Restores after build regardless of success.
*/
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const projectRoot = process.cwd();
const apiDir = path.join(projectRoot, 'src', 'app', 'api');
const sharedReportDynamicDir = path.join(projectRoot, 'src', 'app', 'shared-report', '[token]');
const backupDir = path.join(projectRoot, '.demo-backup-api');
const backupSharedReportDir = path.join(projectRoot, '.demo-backup-shared-report-token');

function moveOut() {
  if (fs.existsSync(apiDir)) {
    if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true, force: true });
    fs.renameSync(apiDir, backupDir);
    console.log('[demo-build] Moved api routes out for static export');
  }
  if (fs.existsSync(sharedReportDynamicDir)) {
    if (fs.existsSync(backupSharedReportDir)) fs.rmSync(backupSharedReportDir, { recursive: true, force: true });
    fs.renameSync(sharedReportDynamicDir, backupSharedReportDir);
    console.log('[demo-build] Moved shared-report dynamic route out for static export');
  }
}

function restore() {
  if (fs.existsSync(backupDir)) {
    fs.renameSync(backupDir, apiDir);
    console.log('[demo-build] Restored api routes');
  }
  if (fs.existsSync(backupSharedReportDir)) {
    const parent = path.dirname(sharedReportDynamicDir);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    fs.renameSync(backupSharedReportDir, sharedReportDynamicDir);
    console.log('[demo-build] Restored shared-report dynamic route');
  }
}

process.env.NEXT_PUBLIC_DEMO_MODE = 'true';

moveOut();
let buildFailed = false;
try {
  cp.execSync('npx next build', { stdio: 'inherit' });
} catch (e) {
  buildFailed = true;
}
restore();
process.exit(buildFailed ? 1 : 0);
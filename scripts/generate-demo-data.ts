import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

// Simple generator; could be expanded later.
const analyses = Array.from({ length: 6 }).map((_, i) => ({
  id: `demo-gen-${i + 1}`,
  repo: `github.com/example/generated-${i + 1}`,
  baselineScore: 70 + i * 4,
  nonBaselineApis: [
    { api: 'WebUSB', status: 'experimental' },
    { api: 'FileSystemSyncAccessHandle', status: 'limited' }
  ],
  createdAt: new Date(Date.now() - i * 43200000).toISOString()
}));

const summary = {
  totalProjects: analyses.length,
  averageScore: Math.round(analyses.reduce((a, b) => a + b.baselineScore, 0) / analyses.length),
  lastUpdated: new Date().toISOString()
};

const org = {
  id: 'demo-generated-org',
  name: 'Generated Demo Org',
  projects: analyses.map(a => ({ repo: a.repo, score: a.baselineScore }))
};

const outDir = path.join(process.cwd(), 'public', 'demo-data');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'analyses.generated.json'), JSON.stringify(analyses, null, 2));
writeFileSync(path.join(outDir, 'summary.generated.json'), JSON.stringify(summary, null, 2));
writeFileSync(path.join(outDir, 'org.generated.json'), JSON.stringify(org, null, 2));

console.log('Generated demo data written to public/demo-data');
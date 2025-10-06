export interface DemoAnalysis {
  id: string;
  repo: string;
  baselineScore: number;
  nonBaselineApis: { api: string; status: string }[];
  createdAt: string;
}

export const demoAnalyses: DemoAnalysis[] = Array.from({ length: 6 }).map((_, i) => ({
  id: `demo-${i + 1}`,
  repo: `github.com/example/project-${i + 1}`,
  baselineScore: 75 + i * 3,
  nonBaselineApis: [
    { api: 'CSSViewTransition', status: 'emerging' },
    { api: 'FileSystemSyncAccessHandle', status: 'limited' }
  ],
  createdAt: new Date(Date.now() - i * 86400000).toISOString()
}));

export const demoOrganization = {
  id: 'demo-org',
  name: 'Demo Organization',
  projects: demoAnalyses.map(a => ({ repo: a.repo, score: a.baselineScore }))
};

export const demoSummary = {
  totalProjects: demoAnalyses.length,
  averageScore: Math.round(demoAnalyses.reduce((a, b) => a + b.baselineScore, 0) / demoAnalyses.length),
  lastUpdated: new Date().toISOString()
};

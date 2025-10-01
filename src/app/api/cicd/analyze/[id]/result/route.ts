import { NextRequest, NextResponse } from 'next/server';
import { CICDAnalysisService } from '@/lib/services/cicd-analysis-service';
import { API_PERMISSIONS } from '@/lib/types/cicd';
import { withApiKeyAuth } from '@/lib/middleware/api-key-auth';

export const GET = withApiKeyAuth(
  async (context, request: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const result = await CICDAnalysisService.getAnalysisResult(
        context.organizationId,
        params.id
      );
      
      if (!result) {
        return NextResponse.json(
          { 
            error: 'Analysis result not found or not completed',
            code: 'RESULT_NOT_FOUND'
          },
          { status: 404 }
        );
      }

      const url = new URL(request.url);
      const format = url.searchParams.get('format') || 'json';
      
      if (format === 'json') {
        return NextResponse.json(result);
      } else if (format === 'junit') {
        // Convert to JUnit XML format for CI/CD integration
        const junitXml = convertToJUnitXML(result);
        return new Response(junitXml, {
          headers: {
            'Content-Type': 'application/xml',
            'Content-Disposition': `attachment; filename="baseline-analysis-${params.id}.xml"`,
          },
        });
      } else if (format === 'sarif') {
        // Convert to SARIF format for security scanning tools
        const sarifJson = convertToSARIF(result);
        return NextResponse.json(sarifJson);
      } else {
        return NextResponse.json(
          { error: 'Unsupported format. Supported formats: json, junit, sarif' },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('Error fetching analysis result:', error);
      return NextResponse.json(
        { error: 'Failed to fetch analysis result' },
        { status: 500 }
      );
    }
  },
  [API_PERMISSIONS.ANALYSIS_READ]
);

function convertToJUnitXML(result: any): string {
  const { summary, issues } = result;
  
  const testCases = issues.map((issue: any, index: number) => {
    const failure = issue.severity === 'critical' || issue.severity === 'warning';
    
    return `
    <testcase name="${escapeXml(issue.title)}" classname="${escapeXml(issue.category)}" time="0">
      ${failure ? `
      <failure message="${escapeXml(issue.description)}" type="${issue.severity}">
        ${escapeXml(issue.recommendation)}
        ${issue.file ? `\nFile: ${issue.file}` : ''}
        ${issue.line ? `\nLine: ${issue.line}` : ''}
      </failure>` : ''}
    </testcase>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite 
  name="Baseline Analysis" 
  tests="${summary.totalChecks}" 
  failures="${summary.criticalIssues + summary.warningIssues}" 
  errors="0" 
  time="0"
  timestamp="${result.completedAt}">
  ${testCases.join('')}
</testsuite>`;
}

function convertToSARIF(result: any): any {
  const rules = result.issues.map((issue: any, index: number) => ({
    id: `baseline-${index}`,
    name: issue.title,
    shortDescription: {
      text: issue.title,
    },
    fullDescription: {
      text: issue.description,
    },
    defaultConfiguration: {
      level: issue.severity === 'critical' ? 'error' : issue.severity === 'warning' ? 'warning' : 'note',
    },
    helpUri: issue.baselineFeature ? `https://web.dev/baseline/${issue.baselineFeature}` : undefined,
  }));

  const results = result.issues.map((issue: any, index: number) => ({
    ruleId: `baseline-${index}`,
    message: {
      text: issue.description,
    },
    locations: issue.file ? [{
      physicalLocation: {
        artifactLocation: {
          uri: issue.file,
        },
        region: issue.line ? {
          startLine: issue.line,
          startColumn: issue.column || 1,
        } : undefined,
      },
    }] : [],
    level: issue.severity === 'critical' ? 'error' : issue.severity === 'warning' ? 'warning' : 'note',
  }));

  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{
      tool: {
        driver: {
          name: 'Baseline Analyzer',
          version: '1.0.0',
          informationUri: 'https://baseline-analyzer.dev',
          rules,
        },
      },
      results,
    }],
  };
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
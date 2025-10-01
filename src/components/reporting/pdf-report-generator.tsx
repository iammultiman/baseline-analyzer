'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  FileText, 
  Settings, 
  Calendar,
  BarChart3,
  CheckCircle,
  Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface DashboardData {
  totalAnalyses: number;
  averageCompliance: number;
  trendsData: TrendData[];
  topIssues: IssueData[];
  recentAnalyses: AnalysisData[];
}

interface TrendData {
  date: string;
  complianceScore: number;
  analysisCount: number;
}

interface IssueData {
  category: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
}

interface AnalysisData {
  id: string;
  repositoryName: string;
  complianceScore: number;
  analysisDate: Date;
  status: string;
}

interface PDFReportGeneratorProps {
  dashboardData: DashboardData;
  timeRange: string;
  organizationId?: string;
  selectedAnalyses: string[];
  onAnalysisSelectionChange: (analyses: string[]) => void;
}

interface ReportConfig {
  includeOverview: boolean;
  includeTrends: boolean;
  includeAnalyses: boolean;
  includeIssues: boolean;
  includeCharts: boolean;
  format: 'summary' | 'detailed';
  orientation: 'portrait' | 'landscape';
}

export function PDFReportGenerator({ 
  dashboardData, 
  timeRange, 
  organizationId,
  selectedAnalyses,
  onAnalysisSelectionChange 
}: PDFReportGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    includeOverview: true,
    includeTrends: true,
    includeAnalyses: true,
    includeIssues: true,
    includeCharts: false, // Charts are complex to render in PDF
    format: 'summary',
    orientation: 'portrait'
  });

  const handleAnalysisToggle = (analysisId: string, checked: boolean) => {
    if (checked) {
      onAnalysisSelectionChange([...selectedAnalyses, analysisId]);
    } else {
      onAnalysisSelectionChange(selectedAnalyses.filter(id => id !== analysisId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onAnalysisSelectionChange(dashboardData.recentAnalyses.map(a => a.id));
    } else {
      onAnalysisSelectionChange([]);
    }
  };

  const generatePDF = async () => {
    try {
      setIsGenerating(true);

      const pdf = new jsPDF({
        orientation: reportConfig.orientation,
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = margin;

      // Helper function to add text with word wrapping
      const addText = (text: string, x: number, y: number, maxWidth: number, fontSize = 12) => {
        pdf.setFontSize(fontSize);
        const lines = pdf.splitTextToSize(text, maxWidth);
        pdf.text(lines, x, y);
        return y + (lines.length * fontSize * 0.35); // Return new Y position
      };

      // Helper function to check if we need a new page
      const checkNewPage = (requiredHeight: number) => {
        if (yPosition + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
      };

      // Title Page
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Baseline Analysis Report', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;
      pdf.text(`Time Range: ${timeRange}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;

      // Overview Section
      if (reportConfig.includeOverview) {
        checkNewPage(40);
        
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        yPosition = addText('Executive Summary', margin, yPosition, pageWidth - 2 * margin, 18);
        yPosition += 5;

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        
        const overviewText = `This report provides an analysis of ${dashboardData.totalAnalyses} repository analyses conducted over the ${timeRange}. The average compliance score across all analyses is ${Math.round(dashboardData.averageCompliance)}%.`;
        yPosition = addText(overviewText, margin, yPosition, pageWidth - 2 * margin);
        yPosition += 10;

        // Key Metrics
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        yPosition = addText('Key Metrics', margin, yPosition, pageWidth - 2 * margin, 14);
        yPosition += 5;

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        yPosition = addText(`• Total Analyses: ${dashboardData.totalAnalyses}`, margin + 5, yPosition, pageWidth - 2 * margin);
        yPosition = addText(`• Average Compliance Score: ${Math.round(dashboardData.averageCompliance)}%`, margin + 5, yPosition, pageWidth - 2 * margin);
        yPosition = addText(`• Issues Identified: ${dashboardData.topIssues.length} categories`, margin + 5, yPosition, pageWidth - 2 * margin);
        yPosition += 15;
      }

      // Issues Section
      if (reportConfig.includeIssues && dashboardData.topIssues.length > 0) {
        checkNewPage(60);
        
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        yPosition = addText('Common Issues', margin, yPosition, pageWidth - 2 * margin, 16);
        yPosition += 10;

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        
        dashboardData.topIssues.forEach((issue, index) => {
          checkNewPage(15);
          const issueText = `${index + 1}. ${issue.category} (${issue.severity} severity) - ${issue.count} occurrences`;
          yPosition = addText(issueText, margin + 5, yPosition, pageWidth - 2 * margin);
        });
        yPosition += 15;
      }

      // Analyses Section
      if (reportConfig.includeAnalyses) {
        checkNewPage(60);
        
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        yPosition = addText('Analysis Results', margin, yPosition, pageWidth - 2 * margin, 16);
        yPosition += 10;

        const analysesToInclude = selectedAnalyses.length > 0 
          ? dashboardData.recentAnalyses.filter(a => selectedAnalyses.includes(a.id))
          : dashboardData.recentAnalyses;

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');

        analysesToInclude.forEach((analysis, index) => {
          checkNewPage(20);
          
          pdf.setFont('helvetica', 'bold');
          yPosition = addText(`${index + 1}. ${analysis.repositoryName}`, margin + 5, yPosition, pageWidth - 2 * margin);
          
          pdf.setFont('helvetica', 'normal');
          yPosition = addText(`   Compliance Score: ${analysis.complianceScore}%`, margin + 10, yPosition, pageWidth - 2 * margin);
          yPosition = addText(`   Analysis Date: ${analysis.analysisDate.toLocaleDateString()}`, margin + 10, yPosition, pageWidth - 2 * margin);
          yPosition = addText(`   Status: ${analysis.status}`, margin + 10, yPosition, pageWidth - 2 * margin);
          yPosition += 5;
        });
        yPosition += 10;
      }

      // Trends Section
      if (reportConfig.includeTrends && dashboardData.trendsData.length > 0) {
        checkNewPage(40);
        
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        yPosition = addText('Compliance Trends', margin, yPosition, pageWidth - 2 * margin, 16);
        yPosition += 10;

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        
        const trendsText = `Based on ${dashboardData.trendsData.length} data points, the compliance trends show the evolution of your baseline compliance over time.`;
        yPosition = addText(trendsText, margin, yPosition, pageWidth - 2 * margin);
        yPosition += 10;

        // Calculate trend direction
        if (dashboardData.trendsData.length >= 2) {
          const recent = dashboardData.trendsData.slice(-3);
          const older = dashboardData.trendsData.slice(0, 3);
          
          if (recent.length > 0 && older.length > 0) {
            const recentAvg = recent.reduce((sum, d) => sum + d.complianceScore, 0) / recent.length;
            const olderAvg = older.reduce((sum, d) => sum + d.complianceScore, 0) / older.length;
            const change = recentAvg - olderAvg;
            
            let trendText = '';
            if (Math.abs(change) < 1) {
              trendText = 'Your compliance scores have remained stable over the analyzed period.';
            } else if (change > 0) {
              trendText = `Your compliance scores have improved by ${change.toFixed(1)}% on average.`;
            } else {
              trendText = `Your compliance scores have decreased by ${Math.abs(change).toFixed(1)}% on average.`;
            }
            
            yPosition = addText(trendText, margin, yPosition, pageWidth - 2 * margin);
          }
        }
        yPosition += 15;
      }

      // Footer
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(
          `Page ${i} of ${totalPages} - Generated by Baseline Analyzer`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      // Save the PDF
      const fileName = `baseline-analysis-report-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            PDF Report Generator
          </CardTitle>
          <CardDescription>
            Generate comprehensive PDF reports of your baseline analysis data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Report Configuration */}
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Report Configuration
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-medium">Include Sections</h4>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="overview"
                    checked={reportConfig.includeOverview}
                    onCheckedChange={(checked) => 
                      setReportConfig(prev => ({ ...prev, includeOverview: !!checked }))
                    }
                  />
                  <label htmlFor="overview" className="text-sm">Executive Summary</label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="trends"
                    checked={reportConfig.includeTrends}
                    onCheckedChange={(checked) => 
                      setReportConfig(prev => ({ ...prev, includeTrends: !!checked }))
                    }
                  />
                  <label htmlFor="trends" className="text-sm">Compliance Trends</label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="analyses"
                    checked={reportConfig.includeAnalyses}
                    onCheckedChange={(checked) => 
                      setReportConfig(prev => ({ ...prev, includeAnalyses: !!checked }))
                    }
                  />
                  <label htmlFor="analyses" className="text-sm">Analysis Results</label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="issues"
                    checked={reportConfig.includeIssues}
                    onCheckedChange={(checked) => 
                      setReportConfig(prev => ({ ...prev, includeIssues: !!checked }))
                    }
                  />
                  <label htmlFor="issues" className="text-sm">Common Issues</label>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Format Options</h4>
                
                <div>
                  <label className="text-sm font-medium">Report Type</label>
                  <Select 
                    value={reportConfig.format} 
                    onValueChange={(value: 'summary' | 'detailed') => 
                      setReportConfig(prev => ({ ...prev, format: value }))
                    }
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="summary">Summary Report</SelectItem>
                      <SelectItem value="detailed">Detailed Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Orientation</label>
                  <Select 
                    value={reportConfig.orientation} 
                    onValueChange={(value: 'portrait' | 'landscape') => 
                      setReportConfig(prev => ({ ...prev, orientation: value }))
                    }
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Analysis Selection */}
          {reportConfig.includeAnalyses && (
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Select Analyses to Include
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="select-all"
                      checked={selectedAnalyses.length === dashboardData.recentAnalyses.length}
                      onCheckedChange={handleSelectAll}
                    />
                    <label htmlFor="select-all" className="text-sm font-medium">
                      Select All ({dashboardData.recentAnalyses.length} analyses)
                    </label>
                  </div>
                  <Badge variant="secondary">
                    {selectedAnalyses.length} selected
                  </Badge>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-3">
                  {dashboardData.recentAnalyses.map((analysis) => (
                    <div key={analysis.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={analysis.id}
                          checked={selectedAnalyses.includes(analysis.id)}
                          onCheckedChange={(checked) => handleAnalysisToggle(analysis.id, !!checked)}
                        />
                        <div>
                          <div className="font-medium text-sm">{analysis.repositoryName}</div>
                          <div className="text-xs text-gray-600">
                            {analysis.analysisDate.toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">{analysis.complianceScore}%</div>
                        <Badge 
                          variant={analysis.status === 'COMPLETED' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {analysis.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Generate Button */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Report will include data from the last {timeRange}
            </div>
            <Button 
              onClick={generatePDF} 
              disabled={isGenerating}
              className="flex items-center gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isGenerating ? 'Generating...' : 'Generate PDF Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Report Preview</CardTitle>
          <CardDescription>
            Preview of what will be included in your PDF report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {reportConfig.includeOverview && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Executive Summary with key metrics</span>
              </div>
            )}
            {reportConfig.includeTrends && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Compliance trends analysis</span>
              </div>
            )}
            {reportConfig.includeAnalyses && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">
                  {selectedAnalyses.length > 0 
                    ? `${selectedAnalyses.length} selected analyses`
                    : `All ${dashboardData.recentAnalyses.length} analyses`
                  }
                </span>
              </div>
            )}
            {reportConfig.includeIssues && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Common issues and recommendations</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
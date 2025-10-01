'use client';

import React from 'react';
import { AIAnalysisInterface } from '@/components/analysis/ai-analysis-interface';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Brain, Target, TrendingUp } from 'lucide-react';

export default function AnalysisPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">AI Repository Analysis</h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Leverage AI to analyze your code repositories against web platform baseline standards. 
          Get actionable insights and recommendations to improve compatibility and performance.
        </p>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="text-center">
            <Brain className="h-8 w-8 mx-auto text-blue-600" />
            <CardTitle className="text-lg">AI-Powered Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Advanced AI models analyze your code against the latest web platform baseline standards
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <Target className="h-8 w-8 mx-auto text-green-600" />
            <CardTitle className="text-lg">Baseline Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Check compatibility with baseline browser features and get detailed compliance scores
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <TrendingUp className="h-8 w-8 mx-auto text-purple-600" />
            <CardTitle className="text-lg">Smart Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Receive prioritized, actionable recommendations to improve your code quality
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <Zap className="h-8 w-8 mx-auto text-orange-600" />
            <CardTitle className="text-lg">Pay-as-you-go</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Credit-based pricing ensures you only pay for the analysis you actually use
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Interface */}
      <AIAnalysisInterface />

      {/* How it Works */}
      <Card>
        <CardHeader>
          <CardTitle>How AI Analysis Works</CardTitle>
          <CardDescription>
            Our AI analysis engine follows a comprehensive process to evaluate your repository
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <h3 className="font-semibold">Repository Processing</h3>
              <p className="text-sm text-gray-600">
                We extract and process your repository content, analyzing file structure and code patterns
              </p>
            </div>
            
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-green-600 font-bold">2</span>
              </div>
              <h3 className="font-semibold">Baseline Matching</h3>
              <p className="text-sm text-gray-600">
                AI matches your code features against our comprehensive baseline database using RAG technology
              </p>
            </div>
            
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-purple-600 font-bold">3</span>
              </div>
              <h3 className="font-semibold">Smart Analysis</h3>
              <p className="text-sm text-gray-600">
                Generate detailed reports with compliance scores, recommendations, and actionable insights
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Types */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Types</CardTitle>
          <CardDescription>
            Choose the type of analysis that best fits your needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-2">Compatibility Check</h3>
              <p className="text-gray-600 mb-2">
                Quick analysis focused on browser compatibility and baseline feature support.
              </p>
              <div className="text-sm text-blue-600">
                ✓ Browser compatibility assessment • ✓ Baseline feature detection • ✓ Compatibility score
              </div>
            </div>
            
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-2">Recommendations Only</h3>
              <p className="text-gray-600 mb-2">
                Focused analysis that provides specific, actionable recommendations for improvement.
              </p>
              <div className="text-sm text-blue-600">
                ✓ Prioritized recommendations • ✓ Modernization opportunities • ✓ Best practices
              </div>
            </div>
            
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-2">Full Analysis</h3>
              <p className="text-gray-600 mb-2">
                Comprehensive analysis including compatibility, recommendations, and detailed insights.
              </p>
              <div className="text-sm text-blue-600">
                ✓ Complete compatibility report • ✓ Detailed recommendations • ✓ Risk assessment • ✓ Modernization roadmap
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
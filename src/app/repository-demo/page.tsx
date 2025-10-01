'use client'

import { useState } from 'react'
import { RepositoryInput } from '@/components/repository/repository-input'
import { ProcessingStatus } from '@/components/repository/processing-status'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function RepositoryDemoPage() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [completedJobs, setCompletedJobs] = useState<string[]>([])

  const handleProcessingStarted = (jobId: string) => {
    setCurrentJobId(jobId)
  }

  const handleJobCompleted = (job: any) => {
    setCompletedJobs(prev => [...prev, job.id])
    // Keep showing the current job for result download
  }

  const handleJobError = (error: string) => {
    console.error('Job processing error:', error)
  }

  const startNewAnalysis = () => {
    setCurrentJobId(null)
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Repository Analysis Demo</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Test the repository processing pipeline by submitting a GitHub or GitLab repository URL. 
          The system will validate, process, and convert the repository for AI analysis.
        </p>
      </div>

      {!currentJobId ? (
        <RepositoryInput onProcessingStarted={handleProcessingStarted} />
      ) : (
        <div className="space-y-6">
          <ProcessingStatus
            jobId={currentJobId}
            onCompleted={handleJobCompleted}
            onError={handleJobError}
          />
          
          <div className="text-center">
            <button
              onClick={startNewAnalysis}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Start New Analysis
            </button>
          </div>
        </div>
      )}

      {completedJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Completed Analyses</CardTitle>
            <CardDescription>
              Previous repository analyses from this session
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completedJobs.map((jobId, index) => (
                <div key={jobId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm font-mono">{jobId}</span>
                  <span className="text-xs text-gray-500">Analysis #{index + 1}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">1. Repository Validation</h4>
              <p className="text-sm text-gray-600">
                Validates the repository URL format and checks if the repository is publicly accessible 
                via GitHub or GitLab APIs.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">2. Content Extraction</h4>
              <p className="text-sm text-gray-600">
                Uses GitIngest API to extract and process repository content, filtering for web-relevant 
                files and excluding build artifacts.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">3. LLM Formatting</h4>
              <p className="text-sm text-gray-600">
                Converts the extracted content into an optimized format for AI analysis, including 
                analysis instructions and context.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">4. Queue Management</h4>
              <p className="text-sm text-gray-600">
                Manages processing jobs in a queue with real-time status updates and progress tracking.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
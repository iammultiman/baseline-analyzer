'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useRepositoryProcessor } from '@/lib/hooks/use-repository-processor'
import { RepositoryProcessingJob, QueueStatus } from '@/lib/types/repository'
import { 
  Clock, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Download, 
  Eye,
  Users,
  Timer
} from 'lucide-react'

interface ProcessingStatusProps {
  jobId: string
  onCompleted?: (job: RepositoryProcessingJob) => void
  onError?: (error: string) => void
}

export function ProcessingStatus({ jobId, onCompleted, onError }: ProcessingStatusProps) {
  const [job, setJob] = useState<RepositoryProcessingJob | null>(null)
  const [queue, setQueue] = useState<QueueStatus | null>(null)
  const [progress, setProgress] = useState(0)

  const {
    getJobStatus,
    getJobResult,
    startPolling,
    stopPolling,
    isPolling,
    resultLoading
  } = useRepositoryProcessor()

  useEffect(() => {
    const handleJobUpdate = (updatedJob: RepositoryProcessingJob) => {
      setJob(updatedJob)
      
      // Update progress based on status
      switch (updatedJob.status) {
        case 'pending':
          setProgress(10)
          break
        case 'processing':
          setProgress(50)
          break
        case 'completed':
          setProgress(100)
          if (onCompleted) {
            onCompleted(updatedJob)
          }
          break
        case 'failed':
          setProgress(0)
          if (onError && updatedJob.error) {
            onError(updatedJob.error)
          }
          break
      }
    }

    // Start polling for job updates
    startPolling(jobId, handleJobUpdate)

    // Initial status fetch
    getJobStatus(jobId).then(result => {
      if (result) {
        setJob(result.job)
        setQueue(result.queue)
        handleJobUpdate(result.job)
      }
    })

    return () => {
      stopPolling()
    }
  }, [jobId, startPolling, stopPolling, getJobStatus, onCompleted, onError])

  const handleDownloadResult = async (format: 'json' | 'llm') => {
    if (!job || job.status !== 'completed') return

    const result = await getJobResult(jobId, format)
    if (result) {
      const blob = new Blob([typeof result === 'string' ? result : JSON.stringify(result, null, 2)], {
        type: format === 'llm' ? 'text/plain' : 'application/json'
      })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${job.repositoryUrl.split('/').pop()}-${format}.${format === 'llm' ? 'txt' : 'json'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const getStatusIcon = () => {
    if (!job) return <Loader2 className="h-4 w-4 animate-spin" />
    
    switch (job.status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />
    }
  }

  const getStatusBadge = () => {
    if (!job) return <Badge variant="secondary">Loading...</Badge>
    
    switch (job.status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      case 'processing':
        return <Badge variant="default">Processing</Badge>
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const formatDuration = (start: Date, end?: Date) => {
    const endTime = end || new Date()
    const duration = Math.floor((endTime.getTime() - start.getTime()) / 1000)
    
    if (duration < 60) return `${duration}s`
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
  }

  if (!job) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading job status...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            Repository Processing
          </div>
          {getStatusBadge()}
        </CardTitle>
        <CardDescription>
          {job.repositoryUrl}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>

        {/* Queue Information */}
        {queue && job.status === 'pending' && (
          <div className="bg-yellow-50 p-3 rounded-md space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              Queue Position
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Position</div>
                <div className="font-medium">{queue.position}</div>
              </div>
              <div>
                <div className="text-gray-600">Total in Queue</div>
                <div className="font-medium">{queue.totalInQueue}</div>
              </div>
              <div>
                <div className="text-gray-600">Est. Wait Time</div>
                <div className="font-medium">{Math.ceil(queue.estimatedWaitTime / 60)}m</div>
              </div>
            </div>
          </div>
        )}

        {/* Processing Information */}
        {job.status === 'processing' && (
          <div className="bg-blue-50 p-3 rounded-md">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing repository content...
            </div>
            <div className="text-sm text-blue-600 mt-1">
              This may take a few minutes depending on repository size
            </div>
          </div>
        )}

        {/* Completion Information */}
        {job.status === 'completed' && job.result && (
          <div className="bg-green-50 p-3 rounded-md space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-green-700">
              <CheckCircle className="h-4 w-4" />
              Processing completed successfully
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Files Processed</div>
                <div className="font-medium">{job.result.metadata.fileCount}</div>
              </div>
              <div>
                <div className="text-gray-600">Total Size</div>
                <div className="font-medium">
                  {(job.result.metadata.totalSize / 1024).toFixed(1)} KB
                </div>
              </div>
              <div>
                <div className="text-gray-600">Processing Time</div>
                <div className="font-medium">
                  {(job.result.metadata.processingTime / 1000).toFixed(1)}s
                </div>
              </div>
              <div>
                <div className="text-gray-600">Extracted At</div>
                <div className="font-medium">
                  {new Date(job.result.metadata.extractedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownloadResult('json')}
                disabled={resultLoading}
              >
                <Download className="h-4 w-4 mr-1" />
                Download JSON
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownloadResult('llm')}
                disabled={resultLoading}
              >
                <Eye className="h-4 w-4 mr-1" />
                Download LLM Format
              </Button>
            </div>
          </div>
        )}

        {/* Error Information */}
        {job.status === 'failed' && (
          <div className="bg-red-50 p-3 rounded-md">
            <div className="flex items-center gap-2 text-sm font-medium text-red-700">
              <XCircle className="h-4 w-4" />
              Processing failed
            </div>
            {job.error && (
              <div className="text-sm text-red-600 mt-1">
                {job.error}
              </div>
            )}
          </div>
        )}

        {/* Job Metadata */}
        <div className="text-xs text-gray-500 space-y-1 pt-2 border-t">
          <div className="flex items-center gap-2">
            <Timer className="h-3 w-3" />
            <span>Started: {job.createdAt.toLocaleString()}</span>
          </div>
          {job.status !== 'pending' && (
            <div className="flex items-center gap-2">
              <Timer className="h-3 w-3" />
              <span>Duration: {formatDuration(job.createdAt, job.updatedAt)}</span>
            </div>
          )}
          <div>Job ID: {job.id}</div>
        </div>
      </CardContent>
    </Card>
  )
}
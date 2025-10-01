import { useState, useCallback, useEffect } from 'react'
import { ValidationResult, RepositoryProcessingJob, QueueStatus, ProcessedRepository } from '@/lib/types/repository'

interface UseRepositoryProcessorReturn {
  // Validation
  validateRepository: (url: string) => Promise<ValidationResult>
  validationLoading: boolean
  validationError: string | null

  // Processing
  processRepository: (url: string) => Promise<string | null>
  processingLoading: boolean
  processingError: string | null

  // Job status
  getJobStatus: (jobId: string) => Promise<{ job: RepositoryProcessingJob; queue: QueueStatus | null } | null>
  jobStatusLoading: boolean
  jobStatusError: string | null

  // Result
  getJobResult: (jobId: string, format?: 'json' | 'llm') => Promise<ProcessedRepository | string | null>
  resultLoading: boolean
  resultError: string | null

  // Polling
  startPolling: (jobId: string, onUpdate: (job: RepositoryProcessingJob) => void) => void
  stopPolling: () => void
  isPolling: boolean
}

export function useRepositoryProcessor(): UseRepositoryProcessorReturn {
  const [validationLoading, setValidationLoading] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  
  const [processingLoading, setProcessingLoading] = useState(false)
  const [processingError, setProcessingError] = useState<string | null>(null)
  
  const [jobStatusLoading, setJobStatusLoading] = useState(false)
  const [jobStatusError, setJobStatusError] = useState<string | null>(null)
  
  const [resultLoading, setResultLoading] = useState(false)
  const [resultError, setResultError] = useState<string | null>(null)
  
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  const validateRepository = useCallback(async (url: string): Promise<ValidationResult> => {
    setValidationLoading(true)
    setValidationError(null)

    try {
      const response = await fetch('/api/repositories/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Validation failed')
      }

      return result.data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed'
      setValidationError(errorMessage)
      return {
        isValid: false,
        error: errorMessage
      }
    } finally {
      setValidationLoading(false)
    }
  }, [])

  const processRepository = useCallback(async (url: string): Promise<string | null> => {
    setProcessingLoading(true)
    setProcessingError(null)

    try {
      const response = await fetch('/api/repositories/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Processing failed')
      }

      return result.data.jobId
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed'
      setProcessingError(errorMessage)
      return null
    } finally {
      setProcessingLoading(false)
    }
  }, [])

  const getJobStatus = useCallback(async (jobId: string) => {
    setJobStatusLoading(true)
    setJobStatusError(null)

    try {
      const response = await fetch(`/api/repositories/status/${jobId}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to get job status')
      }

      return result.data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get job status'
      setJobStatusError(errorMessage)
      return null
    } finally {
      setJobStatusLoading(false)
    }
  }, [])

  const getJobResult = useCallback(async (jobId: string, format: 'json' | 'llm' = 'json') => {
    setResultLoading(true)
    setResultError(null)

    try {
      const url = `/api/repositories/result/${jobId}${format === 'llm' ? '?format=llm' : ''}`
      const response = await fetch(url)

      if (format === 'llm') {
        if (!response.ok) {
          throw new Error('Failed to get LLM-formatted result')
        }
        return await response.text()
      } else {
        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || 'Failed to get job result')
        }
        return result.data
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get job result'
      setResultError(errorMessage)
      return null
    } finally {
      setResultLoading(false)
    }
  }, [])

  const startPolling = useCallback((jobId: string, onUpdate: (job: RepositoryProcessingJob) => void) => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
    }

    setIsPolling(true)

    const poll = async () => {
      try {
        const status = await getJobStatus(jobId)
        if (status?.job) {
          onUpdate(status.job)
          
          // Stop polling if job is completed or failed
          if (status.job.status === 'completed' || status.job.status === 'failed') {
            stopPolling()
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }

    // Poll immediately, then every 2 seconds
    poll()
    const interval = setInterval(poll, 2000)
    setPollingInterval(interval)
  }, [pollingInterval, getJobStatus])

  const stopPolling = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      setPollingInterval(null)
    }
    setIsPolling(false)
  }, [pollingInterval])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [pollingInterval])

  return {
    validateRepository,
    validationLoading,
    validationError,
    
    processRepository,
    processingLoading,
    processingError,
    
    getJobStatus,
    jobStatusLoading,
    jobStatusError,
    
    getJobResult,
    resultLoading,
    resultError,
    
    startPolling,
    stopPolling,
    isPolling
  }
}
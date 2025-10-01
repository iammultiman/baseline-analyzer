export interface RepositoryInfo {
  url: string
  name: string
  owner: string
  branch?: string
  isPrivate: boolean
  size?: number
  fileCount?: number
}

export interface ValidationResult {
  isValid: boolean
  error?: string
  repositoryInfo?: RepositoryInfo
}

export interface ProcessedRepository {
  id: string
  content: string
  metadata: {
    repositoryUrl: string
    repositoryName: string
    fileCount: number
    totalSize: number
    processingTime: number
    extractedAt: Date
  }
}

export interface GitIngestResponse {
  success: boolean
  content?: string
  metadata?: {
    file_count: number
    total_size: number
    processing_time: number
  }
  error?: string
}

export interface RepositoryProcessingJob {
  id: string
  userId: string
  organizationId: string
  repositoryUrl: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: Date
  updatedAt: Date
  error?: string
  result?: ProcessedRepository
}

export interface QueueStatus {
  position: number
  estimatedWaitTime: number
  totalInQueue: number
}
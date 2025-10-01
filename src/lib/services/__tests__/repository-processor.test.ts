import { RepositoryProcessor } from '../repository-processor'

// Mock fetch globally
global.fetch = jest.fn()

describe('RepositoryProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Clear the processing queue between tests
    RepositoryProcessor['processingQueue'].clear()
    RepositoryProcessor['queueOrder'].length = 0
  })

  describe('validateRepository', () => {
    it('should reject invalid URLs', async () => {
      const result = await RepositoryProcessor.validateRepository('invalid-url')
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Invalid repository URL')
    })

    it('should reject non-GitHub/GitLab URLs', async () => {
      const result = await RepositoryProcessor.validateRepository('https://bitbucket.org/user/repo')
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Only GitHub and GitLab repositories are supported')
    })

    it('should validate accessible GitHub repository', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          private: false,
          size: 1024
        })
      }
      
      ;(fetch as jest.Mock).mockResolvedValue(mockResponse)

      const result = await RepositoryProcessor.validateRepository('https://github.com/user/repo')
      
      expect(result.isValid).toBe(true)
      expect(result.repositoryInfo).toEqual({
        url: 'https://github.com/user/repo',
        name: 'repo',
        owner: 'user',
        branch: 'main',
        isPrivate: false,
        size: 1024
      })
    })

    it('should validate accessible GitLab repository', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          visibility: 'public'
        })
      }
      
      ;(fetch as jest.Mock).mockResolvedValue(mockResponse)

      const result = await RepositoryProcessor.validateRepository('https://gitlab.com/user/repo')
      
      expect(result.isValid).toBe(true)
      expect(result.repositoryInfo?.isPrivate).toBe(false)
    })

    it('should reject inaccessible repository', async () => {
      const mockResponse = {
        ok: false,
        status: 404
      }
      
      ;(fetch as jest.Mock).mockResolvedValue(mockResponse)

      const result = await RepositoryProcessor.validateRepository('https://github.com/user/nonexistent')
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('not accessible')
    })

    it('should handle network errors gracefully', async () => {
      ;(fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const result = await RepositoryProcessor.validateRepository('https://github.com/user/repo')
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('not accessible')
    })
  })

  describe('processRepository', () => {
    it('should create processing job and return job ID', async () => {
      const jobId = await RepositoryProcessor.processRepository(
        'https://github.com/user/repo',
        'user123',
        'org456'
      )

      expect(jobId).toBeDefined()
      expect(typeof jobId).toBe('string')

      const job = RepositoryProcessor.getJobStatus(jobId)
      expect(job).toBeDefined()
      expect(job?.userId).toBe('user123')
      expect(job?.organizationId).toBe('org456')
      expect(job?.repositoryUrl).toBe('https://github.com/user/repo')
      expect(['pending', 'processing']).toContain(job?.status)
    })

    it('should add job to queue in correct order', async () => {
      const jobId1 = await RepositoryProcessor.processRepository('https://github.com/user/repo1', 'user1', 'org1')
      const jobId2 = await RepositoryProcessor.processRepository('https://github.com/user/repo2', 'user2', 'org2')

      const queue1 = RepositoryProcessor.getQueueStatus(jobId1)
      const queue2 = RepositoryProcessor.getQueueStatus(jobId2)

      expect(queue1?.position).toBe(1)
      expect(queue2?.position).toBe(2)
      expect(queue2?.totalInQueue).toBe(2)
    })
  })

  describe('getJobStatus', () => {
    it('should return null for non-existent job', () => {
      const status = RepositoryProcessor.getJobStatus('non-existent')
      expect(status).toBeNull()
    })

    it('should return job status for existing job', async () => {
      const jobId = await RepositoryProcessor.processRepository('https://github.com/user/repo', 'user123', 'org456')
      const status = RepositoryProcessor.getJobStatus(jobId)

      expect(status).toBeDefined()
      expect(status?.id).toBe(jobId)
      expect(['pending', 'processing']).toContain(status?.status)
    })
  })

  describe('getQueueStatus', () => {
    it('should return null for non-existent job', () => {
      const queueStatus = RepositoryProcessor.getQueueStatus('non-existent')
      expect(queueStatus).toBeNull()
    })

    it('should return correct queue position', async () => {
      const jobId1 = await RepositoryProcessor.processRepository('https://github.com/user/repo1', 'user1', 'org1')
      const jobId2 = await RepositoryProcessor.processRepository('https://github.com/user/repo2', 'user2', 'org2')

      const queue1 = RepositoryProcessor.getQueueStatus(jobId1)
      const queue2 = RepositoryProcessor.getQueueStatus(jobId2)

      expect(queue1?.position).toBe(1)
      expect(queue2?.position).toBe(2)
      expect(queue1?.totalInQueue).toBe(2)
      expect(queue2?.totalInQueue).toBe(2)
    })
  })

  describe('formatForLLM', () => {
    it('should format processed repository for LLM analysis', () => {
      const processedRepo = {
        id: 'test-id',
        content: 'console.log("Hello World")',
        metadata: {
          repositoryUrl: 'https://github.com/user/repo',
          repositoryName: 'repo',
          fileCount: 5,
          totalSize: 1024,
          processingTime: 2000,
          extractedAt: new Date('2024-01-01T00:00:00Z')
        }
      }

      const formatted = RepositoryProcessor.formatForLLM(processedRepo)

      expect(formatted).toContain('# Repository Analysis: repo')
      expect(formatted).toContain('**Repository URL:** https://github.com/user/repo')
      expect(formatted).toContain('**Files Processed:** 5')
      expect(formatted).toContain('**Total Size:** 1 KB')
      expect(formatted).toContain('console.log("Hello World")')
      expect(formatted).toContain('## Analysis Instructions')
      expect(formatted).toContain('Compatibility Assessment')
    })

    it('should handle zero bytes correctly', () => {
      const processedRepo = {
        id: 'test-id',
        content: '',
        metadata: {
          repositoryUrl: 'https://github.com/user/empty',
          repositoryName: 'empty',
          fileCount: 0,
          totalSize: 0,
          processingTime: 100,
          extractedAt: new Date()
        }
      }

      const formatted = RepositoryProcessor.formatForLLM(processedRepo)
      expect(formatted).toContain('**Total Size:** 0 Bytes')
    })
  })

  describe('cleanupCompletedJobs', () => {
    it('should remove old completed jobs', async () => {
      // Create a job and manually set it as completed with old timestamp
      const jobId = await RepositoryProcessor.processRepository('https://github.com/user/repo', 'user123', 'org456')
      const job = RepositoryProcessor.getJobStatus(jobId)
      
      if (job) {
        job.status = 'completed'
        job.updatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      }

      // Cleanup jobs older than 24 hours
      RepositoryProcessor.cleanupCompletedJobs(24 * 60 * 60 * 1000)

      // Job should be removed
      const cleanedJob = RepositoryProcessor.getJobStatus(jobId)
      expect(cleanedJob).toBeNull()
    })

    it('should keep recent completed jobs', async () => {
      const jobId = await RepositoryProcessor.processRepository('https://github.com/user/repo', 'user123', 'org456')
      const job = RepositoryProcessor.getJobStatus(jobId)
      
      if (job) {
        job.status = 'completed'
        job.updatedAt = new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
      }

      // Cleanup jobs older than 24 hours
      RepositoryProcessor.cleanupCompletedJobs(24 * 60 * 60 * 1000)

      // Job should still exist
      const existingJob = RepositoryProcessor.getJobStatus(jobId)
      expect(existingJob).toBeDefined()
    })

    it('should not remove pending or processing jobs', async () => {
      const jobId1 = await RepositoryProcessor.processRepository('https://github.com/user/repo1', 'user1', 'org1')
      const jobId2 = await RepositoryProcessor.processRepository('https://github.com/user/repo2', 'user2', 'org2')
      
      const job1 = RepositoryProcessor.getJobStatus(jobId1)
      const job2 = RepositoryProcessor.getJobStatus(jobId2)
      
      if (job1 && job2) {
        job1.status = 'pending'
        job1.updatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
        job2.status = 'processing'
        job2.updatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      }

      RepositoryProcessor.cleanupCompletedJobs(24 * 60 * 60 * 1000)

      // Both jobs should still exist
      expect(RepositoryProcessor.getJobStatus(jobId1)).toBeDefined()
      expect(RepositoryProcessor.getJobStatus(jobId2)).toBeDefined()
    })
  })
})
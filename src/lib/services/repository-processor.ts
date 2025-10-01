import { ValidationResult, RepositoryInfo, ProcessedRepository, GitIngestResponse, RepositoryProcessingJob, QueueStatus } from '@/lib/types/repository'

export class RepositoryProcessor {
  private static readonly GITINGEST_API_URL = 'https://gitingest.com/api/ingest'
  private static readonly GITHUB_API_URL = 'https://api.github.com'
  private static readonly GITLAB_API_URL = 'https://gitlab.com/api/v4'
  
  // In-memory queue for demo purposes - in production, use Redis or similar
  private static processingQueue: Map<string, RepositoryProcessingJob> = new Map()
  private static queueOrder: string[] = []

  /**
   * Validates a repository URL and checks accessibility
   */
  static async validateRepository(url: string): Promise<ValidationResult> {
    try {
      // Basic URL validation
      const urlPattern = /^https?:\/\/(github\.com|gitlab\.com)\/[\w\-\.]+\/[\w\-\.]+\/?$/
      if (!urlPattern.test(url)) {
        return {
          isValid: false,
          error: 'Invalid repository URL. Only GitHub and GitLab repositories are supported.'
        }
      }

      const repositoryInfo = await this.extractRepositoryInfo(url)
      
      // Check if repository is accessible
      const isAccessible = await this.checkRepositoryAccessibility(repositoryInfo)
      if (!isAccessible) {
        return {
          isValid: false,
          error: 'Repository is not accessible. It may be private or does not exist.'
        }
      }

      return {
        isValid: true,
        repositoryInfo
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      }
    }
  }

  /**
   * Extracts repository information from URL
   */
  private static extractRepositoryInfo(url: string): RepositoryInfo {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/').filter(Boolean)
    
    if (pathParts.length < 2) {
      throw new Error('Invalid repository URL format')
    }

    const owner = pathParts[0]
    const name = pathParts[1].replace(/\.git$/, '')
    const isGitHub = urlObj.hostname === 'github.com'
    const isGitLab = urlObj.hostname === 'gitlab.com'

    return {
      url: url.replace(/\.git$/, ''),
      name,
      owner,
      isPrivate: false, // Will be determined by accessibility check
      branch: 'main' // Default branch, could be enhanced to detect actual default branch
    }
  }

  /**
   * Checks if repository is publicly accessible
   */
  private static async checkRepositoryAccessibility(repoInfo: RepositoryInfo): Promise<boolean> {
    try {
      const isGitHub = repoInfo.url.includes('github.com')
      const apiUrl = isGitHub 
        ? `${this.GITHUB_API_URL}/repos/${repoInfo.owner}/${repoInfo.name}`
        : `${this.GITLAB_API_URL}/projects/${encodeURIComponent(`${repoInfo.owner}/${repoInfo.name}`)}`

      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Baseline-Analyzer/1.0'
        }
      })

      if (response.status === 200) {
        const data = await response.json()
        // Update repository info with actual data
        if (isGitHub) {
          repoInfo.isPrivate = data.private
          repoInfo.size = data.size
        } else {
          repoInfo.isPrivate = data.visibility === 'private'
        }
        return !repoInfo.isPrivate
      }

      return false
    } catch (error) {
      console.error('Error checking repository accessibility:', error)
      return false
    }
  }

  /**
   * Processes repository using GitIngest API
   */
  static async processRepository(
    repositoryUrl: string, 
    userId: string, 
    organizationId: string
  ): Promise<string> {
    // Create processing job
    const jobId = crypto.randomUUID()
    const job: RepositoryProcessingJob = {
      id: jobId,
      userId,
      organizationId,
      repositoryUrl,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Add to queue
    this.processingQueue.set(jobId, job)
    this.queueOrder.push(jobId)

    // Start processing (in production, this would be handled by a background worker)
    this.processJobAsync(jobId).catch(error => {
      console.error(`Error processing job ${jobId}:`, error)
      const failedJob = this.processingQueue.get(jobId)
      if (failedJob) {
        failedJob.status = 'failed'
        failedJob.error = error.message
        failedJob.updatedAt = new Date()
      }
    })

    return jobId
  }

  /**
   * Gets the status of a processing job
   */
  static getJobStatus(jobId: string): RepositoryProcessingJob | null {
    return this.processingQueue.get(jobId) || null
  }

  /**
   * Gets queue status for a job
   */
  static getQueueStatus(jobId: string): QueueStatus | null {
    const position = this.queueOrder.indexOf(jobId)
    if (position === -1) return null

    return {
      position: position + 1,
      estimatedWaitTime: position * 30, // Estimate 30 seconds per job
      totalInQueue: this.queueOrder.length
    }
  }

  /**
   * Processes a job asynchronously
   */
  private static async processJobAsync(jobId: string): Promise<void> {
    const job = this.processingQueue.get(jobId)
    if (!job) return

    try {
      // Update status to processing
      job.status = 'processing'
      job.updatedAt = new Date()

      // Validate repository first
      const validation = await this.validateRepository(job.repositoryUrl)
      if (!validation.isValid) {
        throw new Error(validation.error || 'Repository validation failed')
      }

      // Process with GitIngest
      const processed = await this.callGitIngestAPI(job.repositoryUrl)
      
      job.result = processed
      job.status = 'completed'
      job.updatedAt = new Date()

      // Remove from queue order
      const queueIndex = this.queueOrder.indexOf(jobId)
      if (queueIndex > -1) {
        this.queueOrder.splice(queueIndex, 1)
      }

    } catch (error) {
      job.status = 'failed'
      job.error = error instanceof Error ? error.message : 'Unknown processing error'
      job.updatedAt = new Date()

      // Remove from queue order
      const queueIndex = this.queueOrder.indexOf(jobId)
      if (queueIndex > -1) {
        this.queueOrder.splice(queueIndex, 1)
      }
    }
  }

  /**
   * Calls GitIngest API to process repository
   */
  private static async callGitIngestAPI(repositoryUrl: string): Promise<ProcessedRepository> {
    const startTime = Date.now()
    
    try {
      const response = await fetch(this.GITINGEST_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Baseline-Analyzer/1.0'
        },
        body: JSON.stringify({
          url: repositoryUrl,
          format: 'text', // Request text format for LLM processing
          include_patterns: [
            '*.js', '*.ts', '*.jsx', '*.tsx', '*.vue', '*.svelte',
            '*.html', '*.css', '*.scss', '*.sass', '*.less',
            '*.json', '*.md', '*.yml', '*.yaml',
            'package.json', 'tsconfig.json', 'webpack.config.*',
            'vite.config.*', 'rollup.config.*', 'next.config.*'
          ],
          exclude_patterns: [
            'node_modules/**', 'dist/**', 'build/**', '.git/**',
            '*.min.js', '*.min.css', '*.map', 'coverage/**',
            '.next/**', '.nuxt/**', '.output/**'
          ]
        })
      })

      if (!response.ok) {
        throw new Error(`GitIngest API error: ${response.status} ${response.statusText}`)
      }

      const result: GitIngestResponse = await response.json()
      
      if (!result.success || !result.content) {
        throw new Error(result.error || 'Failed to process repository with GitIngest')
      }

      const processingTime = Date.now() - startTime
      const repoName = repositoryUrl.split('/').pop()?.replace(/\.git$/, '') || 'unknown'

      return {
        id: crypto.randomUUID(),
        content: result.content,
        metadata: {
          repositoryUrl,
          repositoryName: repoName,
          fileCount: result.metadata?.file_count || 0,
          totalSize: result.metadata?.total_size || 0,
          processingTime,
          extractedAt: new Date()
        }
      }
    } catch (error) {
      throw new Error(`Repository processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Converts processed repository to LLM-optimized format
   */
  static formatForLLM(processed: ProcessedRepository): string {
    const { content, metadata } = processed
    
    const header = `# Repository Analysis: ${metadata.repositoryName}

**Repository URL:** ${metadata.repositoryUrl}
**Files Processed:** ${metadata.fileCount}
**Total Size:** ${this.formatBytes(metadata.totalSize)}
**Extracted At:** ${metadata.extractedAt.toISOString()}

---

## Repository Content

The following is the complete content of the repository, formatted for analysis:

`

    const footer = `

---

## Analysis Instructions

Please analyze this repository against web platform baseline standards and provide:

1. **Compatibility Assessment**: Identify any features or APIs that may not be baseline-compatible
2. **Recommendations**: Suggest specific improvements for better baseline compliance
3. **Priority Issues**: Highlight the most critical compatibility concerns
4. **Modern Alternatives**: Recommend baseline-compatible alternatives for any problematic code

Focus on:
- Web API usage and compatibility
- CSS features and browser support
- JavaScript features and polyfill requirements
- Build tool configurations
- Package dependencies that might affect baseline compatibility
`

    return header + content + footer
  }

  /**
   * Utility function to format bytes
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Cleans up completed jobs (should be called periodically)
   */
  static cleanupCompletedJobs(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = new Date(Date.now() - maxAge)
    
    for (const [jobId, job] of this.processingQueue.entries()) {
      if ((job.status === 'completed' || job.status === 'failed') && job.updatedAt < cutoff) {
        this.processingQueue.delete(jobId)
      }
    }
  }
}
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useRepositoryProcessor } from '@/lib/hooks/use-repository-processor'
import { ValidationResult } from '@/lib/types/repository'
import { CheckCircle, XCircle, Loader2, Github, GitBranch, Lock, Unlock } from 'lucide-react'

interface RepositoryInputProps {
  onProcessingStarted?: (jobId: string) => void
}

export function RepositoryInput({ onProcessingStarted }: RepositoryInputProps) {
  const [url, setUrl] = useState('')
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [hasValidated, setHasValidated] = useState(false)

  const {
    validateRepository,
    validationLoading,
    validationError,
    processRepository,
    processingLoading,
    processingError
  } = useRepositoryProcessor()

  const handleValidate = async () => {
    if (!url.trim()) return

    const result = await validateRepository(url.trim())
    setValidation(result)
    setHasValidated(true)
  }

  const handleProcess = async () => {
    if (!validation?.isValid) return

    const jobId = await processRepository(url.trim())
    if (jobId && onProcessingStarted) {
      onProcessingStarted(jobId)
    }
  }

  const handleUrlChange = (value: string) => {
    setUrl(value)
    setValidation(null)
    setHasValidated(false)
  }

  const isValidUrl = url.trim().length > 0
  const canValidate = isValidUrl && !validationLoading
  const canProcess = validation?.isValid && !processingLoading

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Github className="h-5 w-5" />
          Repository Analysis
        </CardTitle>
        <CardDescription>
          Enter a GitHub or GitLab repository URL to analyze against web platform baseline standards
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="https://github.com/username/repository"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            className="flex-1"
          />
          <Button 
            onClick={handleValidate}
            disabled={!canValidate}
            variant="outline"
          >
            {validationLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Validate'
            )}
          </Button>
        </div>

        {validationError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
            <XCircle className="h-4 w-4" />
            {validationError}
          </div>
        )}

        {hasValidated && validation && (
          <div className="space-y-3">
            {validation.isValid ? (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-md">
                <CheckCircle className="h-4 w-4" />
                Repository is valid and accessible
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
                <XCircle className="h-4 w-4" />
                {validation.error}
              </div>
            )}

            {validation.repositoryInfo && (
              <div className="bg-gray-50 p-4 rounded-md space-y-2">
                <h4 className="font-medium text-sm">Repository Information</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Github className="h-4 w-4" />
                    <span className="font-medium">{validation.repositoryInfo.owner}/{validation.repositoryInfo.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    <span>{validation.repositoryInfo.branch || 'main'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {validation.repositoryInfo.isPrivate ? (
                      <Lock className="h-4 w-4 text-red-500" />
                    ) : (
                      <Unlock className="h-4 w-4 text-green-500" />
                    )}
                    <Badge variant={validation.repositoryInfo.isPrivate ? "destructive" : "secondary"}>
                      {validation.repositoryInfo.isPrivate ? 'Private' : 'Public'}
                    </Badge>
                  </div>
                  {validation.repositoryInfo.size && (
                    <div className="text-gray-600">
                      Size: {validation.repositoryInfo.size} KB
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {processingError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
            <XCircle className="h-4 w-4" />
            {processingError}
          </div>
        )}

        <div className="flex justify-end">
          <Button 
            onClick={handleProcess}
            disabled={!canProcess}
            className="min-w-32"
          >
            {processingLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              'Start Analysis'
            )}
          </Button>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Only public GitHub and GitLab repositories are supported</p>
          <p>• Analysis focuses on web platform baseline compatibility</p>
          <p>• Processing may take 30-60 seconds depending on repository size</p>
        </div>
      </CardContent>
    </Card>
  )
}
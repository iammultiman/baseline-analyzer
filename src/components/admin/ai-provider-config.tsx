'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertCircle, CheckCircle, Plus, Settings, Trash2, TestTube, Zap } from 'lucide-react'
import { AIProvider, AIProviderConfig, AI_PROVIDER_DEFAULTS } from '@/lib/types/ai-provider'

interface AIProviderConfigProps {
  organizationId: string
}

export function AIProviderConfigComponent({ organizationId }: AIProviderConfigProps) {
  const [configs, setConfigs] = useState<AIProviderConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<AIProviderConfig | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string; latency?: number }>>({})

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/ai-providers')
      
      if (!response.ok) {
        throw new Error('Failed to fetch AI provider configurations')
      }

      const data = await response.json()
      setConfigs(data.configs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const testProvider = async (configId: string) => {
    try {
      const response = await fetch(`/api/admin/ai-providers/${configId}/test`, {
        method: 'POST'
      })

      const result = await response.json()
      setTestResults(prev => ({
        ...prev,
        [configId]: result
      }))
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [configId]: {
          success: false,
          error: 'Test failed'
        }
      }))
    }
  }

  const deleteProvider = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this AI provider configuration?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/ai-providers/${configId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete AI provider configuration')
      }

      await fetchConfigs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete configuration')
    }
  }

  const getProviderIcon = (provider: AIProvider) => {
    switch (provider) {
      case AIProvider.OPENAI:
        return '🤖'
      case AIProvider.GEMINI:
        return '💎'
      case AIProvider.CLAUDE:
        return '🧠'
      case AIProvider.QWEN:
        return '🐉'
      case AIProvider.OPENROUTER:
        return '🔀'
      default:
        return '⚡'
    }
  }

  const getStatusBadge = (config: AIProviderConfig) => {
    const testResult = testResults[config.id]
    
    if (testResult) {
      return testResult.success ? (
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Connected
        </Badge>
      ) : (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Error
        </Badge>
      )
    }

    return config.isEnabled ? (
      <Badge variant="secondary">
        <Zap className="w-3 h-3 mr-1" />
        Enabled
      </Badge>
    ) : (
      <Badge variant="outline">Disabled</Badge>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>{error}</p>
            <Button onClick={fetchConfigs} className="mt-4">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Provider Configuration</h2>
          <p className="text-gray-600">
            Configure and manage AI providers for repository analysis
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <AIProviderForm
              onSuccess={() => {
                setIsCreateDialogOpen(false)
                fetchConfigs()
              }}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {configs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Settings className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">No AI Providers Configured</h3>
            <p className="text-gray-600 mb-4">
              Add your first AI provider to start analyzing repositories
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Provider
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {configs.map((config) => (
            <Card key={config.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getProviderIcon(config.provider)}</span>
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <span>{config.name}</span>
                        {getStatusBadge(config)}
                      </CardTitle>
                      <CardDescription>
                        {config.provider} • Priority: {config.priority} • Model: {config.model || 'Default'}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testProvider(config.id)}
                    >
                      <TestTube className="w-4 h-4 mr-1" />
                      Test
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingConfig(config)}
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteProvider(config.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-gray-500">Base URL</Label>
                    <p className="truncate">{config.baseUrl || 'Default'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Max Tokens</Label>
                    <p>{config.maxTokens || 'Default'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Temperature</Label>
                    <p>{config.temperature || 'Default'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Cost per 1K Tokens</Label>
                    <p>${config.costPerToken || 'Default'}</p>
                  </div>
                </div>
                
                {testResults[config.id] && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Test Result:</span>
                      <span className={testResults[config.id].success ? 'text-green-600' : 'text-red-600'}>
                        {testResults[config.id].success ? 'Success' : 'Failed'}
                      </span>
                    </div>
                    {testResults[config.id].latency && (
                      <div className="text-xs text-gray-600 mt-1">
                        Latency: {testResults[config.id].latency}ms
                      </div>
                    )}
                    {testResults[config.id].error && (
                      <div className="text-xs text-red-600 mt-1">
                        Error: {testResults[config.id].error}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editingConfig && (
        <Dialog open={!!editingConfig} onOpenChange={() => setEditingConfig(null)}>
          <DialogContent className="max-w-2xl">
            <AIProviderForm
              config={editingConfig}
              onSuccess={() => {
                setEditingConfig(null)
                fetchConfigs()
              }}
              onCancel={() => setEditingConfig(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

interface AIProviderFormProps {
  config?: AIProviderConfig
  onSuccess: () => void
  onCancel: () => void
}

function AIProviderForm({ config, onSuccess, onCancel }: AIProviderFormProps) {
  const [formData, setFormData] = useState({
    provider: config?.provider || AIProvider.OPENAI,
    name: config?.name || '',
    apiKey: config ? '' : '', // Don't pre-fill API key for security
    baseUrl: config?.baseUrl || '',
    model: config?.model || '',
    maxTokens: config?.maxTokens || undefined,
    temperature: config?.temperature || 0.7,
    isEnabled: config?.isEnabled ?? true,
    priority: config?.priority || 1,
    costPerToken: config?.costPerToken || undefined
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleProviderChange = (provider: AIProvider) => {
    const defaults = AI_PROVIDER_DEFAULTS[provider]
    setFormData(prev => ({
      ...prev,
      provider,
      baseUrl: defaults.baseUrl || '',
      model: defaults.model || '',
      maxTokens: defaults.maxTokens,
      temperature: defaults.temperature || 0.7,
      costPerToken: defaults.costPerToken
    }))
  }

  const validateForm = () => {
    const errors: string[] = [];

    if (!formData.name.trim()) {
      errors.push('Configuration name is required');
    }

    if (!config && !formData.apiKey.trim()) {
      errors.push('API key is required');
    }

    if (formData.maxTokens && formData.maxTokens <= 0) {
      errors.push('Max tokens must be greater than 0');
    }

    if (formData.temperature < 0 || formData.temperature > 2) {
      errors.push('Temperature must be between 0 and 2');
    }

    if (formData.priority <= 0) {
      errors.push('Priority must be greater than 0');
    }

    if (formData.costPerToken && formData.costPerToken < 0) {
      errors.push('Cost per token cannot be negative');
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validate form
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '));
      setLoading(false);
      return;
    }

    try {
      const url = config ? `/api/admin/ai-providers/${config.id}` : '/api/admin/ai-providers'
      const method = config ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save configuration')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {config ? 'Edit AI Provider' : 'Add AI Provider'}
        </DialogTitle>
        <DialogDescription>
          Configure an AI provider for repository analysis
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="provider">Provider</Label>
            <Select
              value={formData.provider}
              onValueChange={(value) => handleProviderChange(value as AIProvider)}
              disabled={!!config} // Don't allow changing provider for existing configs
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(AIProvider).map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    {provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="name">Configuration Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Production OpenAI"
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="apiKey">API Key</Label>
          <Input
            id="apiKey"
            type="password"
            value={formData.apiKey}
            onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
            placeholder={config ? "Leave empty to keep current key" : "Enter API key"}
            required={!config}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input
              id="baseUrl"
              value={formData.baseUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, baseUrl: e.target.value }))}
              placeholder="API base URL"
            />
          </div>

          <div>
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              value={formData.model}
              onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
              placeholder="Model name"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="maxTokens">Max Tokens</Label>
            <Input
              id="maxTokens"
              type="number"
              value={formData.maxTokens || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                maxTokens: e.target.value ? parseInt(e.target.value) : undefined 
              }))}
              placeholder="4096"
            />
          </div>

          <div>
            <Label htmlFor="temperature">Temperature</Label>
            <Input
              id="temperature"
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={formData.temperature}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                temperature: parseFloat(e.target.value) 
              }))}
            />
          </div>

          <div>
            <Label htmlFor="priority">Priority</Label>
            <Input
              id="priority"
              type="number"
              min="1"
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                priority: parseInt(e.target.value) 
              }))}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="costPerToken">Cost per 1000 Tokens ($)</Label>
          <Input
            id="costPerToken"
            type="number"
            step="0.001"
            min="0"
            value={formData.costPerToken || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              costPerToken: e.target.value ? parseFloat(e.target.value) : undefined 
            }))}
            placeholder="0.03"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isEnabled"
            checked={formData.isEnabled}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isEnabled: checked }))}
          />
          <Label htmlFor="isEnabled">Enable this provider</Label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : config ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
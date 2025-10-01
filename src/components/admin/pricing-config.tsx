'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, Save, Loader2, Settings, AlertTriangle, CheckCircle, DollarSign } from 'lucide-react';

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  description?: string;
}

interface PricingConfig {
  packages: CreditPackage[];
  freeCredits: number;
  creditCostPerAnalysis: {
    base: number;
    perFile: number;
    perKB: number;
  };
  usageLimits: {
    freeUserDailyLimit: number;
    freeUserMonthlyLimit: number;
    maxRepositorySize: number; // in MB
    maxFilesPerRepository: number;
  };
  freeTierConfig: {
    enabled: boolean;
    trialPeriodDays: number;
    maxAnalysesPerTrial: number;
    requireCreditCard: boolean;
  };
  realTimeUpdates: {
    enabled: boolean;
    notifyUsers: boolean;
  };
}

const defaultConfig: PricingConfig = {
  packages: [
    { id: 'starter', name: 'Starter Pack', credits: 100, price: 999, description: '100 credits for small projects' },
    { id: 'professional', name: 'Professional Pack', credits: 500, price: 4499, description: '500 credits for regular use' },
    { id: 'enterprise', name: 'Enterprise Pack', credits: 2000, price: 15999, description: '2000 credits for large teams' },
  ],
  freeCredits: 10,
  creditCostPerAnalysis: {
    base: 1,
    perFile: 0.1,
    perKB: 0.01,
  },
  usageLimits: {
    freeUserDailyLimit: 5,
    freeUserMonthlyLimit: 20,
    maxRepositorySize: 100, // 100MB
    maxFilesPerRepository: 1000,
  },
  freeTierConfig: {
    enabled: true,
    trialPeriodDays: 14,
    maxAnalysesPerTrial: 5,
    requireCreditCard: false,
  },
  realTimeUpdates: {
    enabled: true,
    notifyUsers: true,
  },
};

export function PricingConfig() {
  const [config, setConfig] = useState<PricingConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/pricing');
      
      if (!response.ok) {
        throw new Error('Failed to fetch pricing configuration');
      }

      const data = await response.json();
      setConfig(data.pricingConfig || defaultConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setConfig(defaultConfig);
    } finally {
      setLoading(false);
    }
  };

  const validateConfig = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate basic settings
    if (config.freeCredits < 0) {
      errors.freeCredits = 'Free credits cannot be negative';
    }

    // Validate credit cost calculation
    if (config.creditCostPerAnalysis.base <= 0) {
      errors.baseCost = 'Base cost must be greater than 0';
    }
    if (config.creditCostPerAnalysis.perFile < 0) {
      errors.perFileCost = 'Per file cost cannot be negative';
    }
    if (config.creditCostPerAnalysis.perKB < 0) {
      errors.perKBCost = 'Per KB cost cannot be negative';
    }

    // Validate usage limits
    if (config.usageLimits.freeUserDailyLimit < 0) {
      errors.dailyLimit = 'Daily limit cannot be negative';
    }
    if (config.usageLimits.freeUserMonthlyLimit < config.usageLimits.freeUserDailyLimit) {
      errors.monthlyLimit = 'Monthly limit must be greater than or equal to daily limit';
    }
    if (config.usageLimits.maxRepositorySize <= 0) {
      errors.maxRepoSize = 'Max repository size must be greater than 0';
    }
    if (config.usageLimits.maxFilesPerRepository <= 0) {
      errors.maxFiles = 'Max files per repository must be greater than 0';
    }

    // Validate packages
    config.packages.forEach((pkg, index) => {
      if (!pkg.name.trim()) {
        errors[`package_${index}_name`] = 'Package name is required';
      }
      if (pkg.credits <= 0) {
        errors[`package_${index}_credits`] = 'Credits must be greater than 0';
      }
      if (pkg.price <= 0) {
        errors[`package_${index}_price`] = 'Price must be greater than 0';
      }
    });

    // Validate free tier config
    if (config.freeTierConfig.trialPeriodDays <= 0) {
      errors.trialPeriod = 'Trial period must be greater than 0';
    }
    if (config.freeTierConfig.maxAnalysesPerTrial <= 0) {
      errors.maxTrialAnalyses = 'Max analyses per trial must be greater than 0';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveConfig = async () => {
    if (!validateConfig()) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save configuration');
      }

      setHasUnsavedChanges(false);
      
      if (config.realTimeUpdates.notifyUsers) {
        // Notify users about pricing changes
        await fetch('/api/admin/pricing/notify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: 'Pricing configuration has been updated' }),
        });
      }

      // Use dynamic import for toast to avoid SSR issues
      const { toast } = await import('sonner');
      toast.success('Pricing configuration saved successfully');
    } catch (err) {
      const { toast } = await import('sonner');
      toast.error(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const addPackage = () => {
    const newPackage: CreditPackage = {
      id: `package_${Date.now()}`,
      name: 'New Package',
      credits: 100,
      price: 999,
      description: '',
    };
    setConfig(prev => ({
      ...prev,
      packages: [...prev.packages, newPackage],
    }));
  };

  const updatePackage = (index: number, field: keyof CreditPackage, value: string | number) => {
    setConfig(prev => ({
      ...prev,
      packages: prev.packages.map((pkg, i) => 
        i === index ? { ...pkg, [field]: value } : pkg
      ),
    }));
  };

  const removePackage = (index: number) => {
    setConfig(prev => ({
      ...prev,
      packages: prev.packages.filter((_, i) => i !== index),
    }));
  };

  const formatPrice = (priceInCents: number) => {
    return `$${(priceInCents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Pricing Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Basic Settings</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="freeCredits">Free Credits for New Users</Label>
                <Input
                  id="freeCredits"
                  type="number"
                  value={config.freeCredits}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    freeCredits: parseInt(e.target.value) || 0,
                  }))}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Credit Cost Calculation */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Credit Cost Calculation</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="baseCost">Base Cost per Analysis</Label>
                <Input
                  id="baseCost"
                  type="number"
                  step="0.1"
                  value={config.creditCostPerAnalysis.base}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    creditCostPerAnalysis: {
                      ...prev.creditCostPerAnalysis,
                      base: parseFloat(e.target.value) || 0,
                    },
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="perFileCost">Cost per File</Label>
                <Input
                  id="perFileCost"
                  type="number"
                  step="0.01"
                  value={config.creditCostPerAnalysis.perFile}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    creditCostPerAnalysis: {
                      ...prev.creditCostPerAnalysis,
                      perFile: parseFloat(e.target.value) || 0,
                    },
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="perKBCost">Cost per KB</Label>
                <Input
                  id="perKBCost"
                  type="number"
                  step="0.001"
                  value={config.creditCostPerAnalysis.perKB}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    creditCostPerAnalysis: {
                      ...prev.creditCostPerAnalysis,
                      perKB: parseFloat(e.target.value) || 0,
                    },
                  }))}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Usage Limits */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Usage Limits</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dailyLimit">Daily Analysis Limit (Free Users)</Label>
                <Input
                  id="dailyLimit"
                  type="number"
                  value={config.usageLimits.freeUserDailyLimit}
                  onChange={(e) => {
                    setConfig(prev => ({
                      ...prev,
                      usageLimits: {
                        ...prev.usageLimits,
                        freeUserDailyLimit: parseInt(e.target.value) || 0,
                      },
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  className={validationErrors.dailyLimit ? 'border-red-500' : ''}
                />
                {validationErrors.dailyLimit && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.dailyLimit}</p>
                )}
              </div>
              <div>
                <Label htmlFor="monthlyLimit">Monthly Analysis Limit (Free Users)</Label>
                <Input
                  id="monthlyLimit"
                  type="number"
                  value={config.usageLimits.freeUserMonthlyLimit}
                  onChange={(e) => {
                    setConfig(prev => ({
                      ...prev,
                      usageLimits: {
                        ...prev.usageLimits,
                        freeUserMonthlyLimit: parseInt(e.target.value) || 0,
                      },
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  className={validationErrors.monthlyLimit ? 'border-red-500' : ''}
                />
                {validationErrors.monthlyLimit && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.monthlyLimit}</p>
                )}
              </div>
              <div>
                <Label htmlFor="maxRepoSize">Max Repository Size (MB)</Label>
                <Input
                  id="maxRepoSize"
                  type="number"
                  value={config.usageLimits.maxRepositorySize}
                  onChange={(e) => {
                    setConfig(prev => ({
                      ...prev,
                      usageLimits: {
                        ...prev.usageLimits,
                        maxRepositorySize: parseInt(e.target.value) || 0,
                      },
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  className={validationErrors.maxRepoSize ? 'border-red-500' : ''}
                />
                {validationErrors.maxRepoSize && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.maxRepoSize}</p>
                )}
              </div>
              <div>
                <Label htmlFor="maxFiles">Max Files per Repository</Label>
                <Input
                  id="maxFiles"
                  type="number"
                  value={config.usageLimits.maxFilesPerRepository}
                  onChange={(e) => {
                    setConfig(prev => ({
                      ...prev,
                      usageLimits: {
                        ...prev.usageLimits,
                        maxFilesPerRepository: parseInt(e.target.value) || 0,
                      },
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  className={validationErrors.maxFiles ? 'border-red-500' : ''}
                />
                {validationErrors.maxFiles && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.maxFiles}</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Free Tier Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Free Tier Configuration</h3>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="freeTierEnabled"
                  checked={config.freeTierConfig.enabled}
                  onCheckedChange={(checked) => {
                    setConfig(prev => ({
                      ...prev,
                      freeTierConfig: {
                        ...prev.freeTierConfig,
                        enabled: checked,
                      },
                    }));
                    setHasUnsavedChanges(true);
                  }}
                />
                <Label htmlFor="freeTierEnabled">Enable Free Tier</Label>
              </div>

              {config.freeTierConfig.enabled && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div>
                    <Label htmlFor="trialPeriod">Trial Period (Days)</Label>
                    <Input
                      id="trialPeriod"
                      type="number"
                      value={config.freeTierConfig.trialPeriodDays}
                      onChange={(e) => {
                        setConfig(prev => ({
                          ...prev,
                          freeTierConfig: {
                            ...prev.freeTierConfig,
                            trialPeriodDays: parseInt(e.target.value) || 0,
                          },
                        }));
                        setHasUnsavedChanges(true);
                      }}
                      className={validationErrors.trialPeriod ? 'border-red-500' : ''}
                    />
                    {validationErrors.trialPeriod && (
                      <p className="text-sm text-red-600 mt-1">{validationErrors.trialPeriod}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="maxTrialAnalyses">Max Analyses per Trial</Label>
                    <Input
                      id="maxTrialAnalyses"
                      type="number"
                      value={config.freeTierConfig.maxAnalysesPerTrial}
                      onChange={(e) => {
                        setConfig(prev => ({
                          ...prev,
                          freeTierConfig: {
                            ...prev.freeTierConfig,
                            maxAnalysesPerTrial: parseInt(e.target.value) || 0,
                          },
                        }));
                        setHasUnsavedChanges(true);
                      }}
                      className={validationErrors.maxTrialAnalyses ? 'border-red-500' : ''}
                    />
                    {validationErrors.maxTrialAnalyses && (
                      <p className="text-sm text-red-600 mt-1">{validationErrors.maxTrialAnalyses}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2 ml-6">
                <Switch
                  id="requireCreditCard"
                  checked={config.freeTierConfig.requireCreditCard}
                  onCheckedChange={(checked) => {
                    setConfig(prev => ({
                      ...prev,
                      freeTierConfig: {
                        ...prev.freeTierConfig,
                        requireCreditCard: checked,
                      },
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  disabled={!config.freeTierConfig.enabled}
                />
                <Label htmlFor="requireCreditCard">Require Credit Card for Trial</Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Real-time Updates Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Real-time Updates</h3>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="realTimeEnabled"
                  checked={config.realTimeUpdates.enabled}
                  onCheckedChange={(checked) => {
                    setConfig(prev => ({
                      ...prev,
                      realTimeUpdates: {
                        ...prev.realTimeUpdates,
                        enabled: checked,
                      },
                    }));
                    setHasUnsavedChanges(true);
                  }}
                />
                <Label htmlFor="realTimeEnabled">Enable Real-time Price Updates</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="notifyUsers"
                  checked={config.realTimeUpdates.notifyUsers}
                  onCheckedChange={(checked) => {
                    setConfig(prev => ({
                      ...prev,
                      realTimeUpdates: {
                        ...prev.realTimeUpdates,
                        notifyUsers: checked,
                      },
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  disabled={!config.realTimeUpdates.enabled}
                />
                <Label htmlFor="notifyUsers">Notify Users of Price Changes</Label>
              </div>

              {config.realTimeUpdates.enabled && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Real-time updates will immediately affect all users. Existing user credits will not be affected.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <Separator />

          {/* Credit Packages */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Credit Packages</h3>
              <Button onClick={addPackage} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Package
              </Button>
            </div>

            <div className="space-y-4">
              {config.packages.map((pkg, index) => (
                <Card key={pkg.id} className="p-4">
                  <div className="grid grid-cols-12 gap-4 items-start">
                    <div className="col-span-3">
                      <Label htmlFor={`pkg-name-${index}`}>Package Name</Label>
                      <Input
                        id={`pkg-name-${index}`}
                        value={pkg.name}
                        onChange={(e) => updatePackage(index, 'name', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor={`pkg-credits-${index}`}>Credits</Label>
                      <Input
                        id={`pkg-credits-${index}`}
                        type="number"
                        value={pkg.credits}
                        onChange={(e) => updatePackage(index, 'credits', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor={`pkg-price-${index}`}>Price (cents)</Label>
                      <Input
                        id={`pkg-price-${index}`}
                        type="number"
                        value={pkg.price}
                        onChange={(e) => updatePackage(index, 'price', parseInt(e.target.value) || 0)}
                      />
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatPrice(pkg.price)}
                      </div>
                    </div>
                    <div className="col-span-4">
                      <Label htmlFor={`pkg-desc-${index}`}>Description</Label>
                      <Textarea
                        id={`pkg-desc-${index}`}
                        value={pkg.description || ''}
                        onChange={(e) => updatePackage(index, 'description', e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="col-span-1 flex items-end">
                      <Button
                        onClick={() => removePackage(index)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Badge variant="outline">
                      {pkg.credits} credits
                    </Badge>
                    <Badge variant="outline">
                      {formatPrice(pkg.price)}
                    </Badge>
                    <Badge variant="outline">
                      ${(pkg.price / 100 / pkg.credits).toFixed(3)}/credit
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Validation Summary */}
          {Object.keys(validationErrors).length > 0 && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Please fix the validation errors above before saving.
              </AlertDescription>
            </Alert>
          )}

          {/* Unsaved Changes Warning */}
          {hasUnsavedChanges && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                You have unsaved changes. Don't forget to save your configuration.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">
                Configuration will take effect immediately for new purchases
              </span>
            </div>
            <Button 
              onClick={saveConfig} 
              disabled={saving || Object.keys(validationErrors).length > 0}
              className={hasUnsavedChanges ? 'bg-orange-600 hover:bg-orange-700' : ''}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {hasUnsavedChanges ? 'Save Changes' : 'Save Configuration'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
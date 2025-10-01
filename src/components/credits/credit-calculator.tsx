'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Calculator, AlertTriangle, CheckCircle } from 'lucide-react';

interface CreditCalculatorProps {
  repositorySize?: number;
  fileCount?: number;
  onCalculate?: (cost: number, hasSufficientCredits: boolean) => void;
}

interface CalculationResult {
  creditCost: number;
  userBalance: number;
  hasSufficientCredits: boolean;
  calculation: {
    repositorySize: number;
    fileCount: number;
    complexity: number;
  };
}

export function CreditCalculator({ 
  repositorySize = 0, 
  fileCount = 0, 
  onCalculate 
}: CreditCalculatorProps) {
  const [size, setSize] = useState(repositorySize);
  const [files, setFiles] = useState(fileCount);
  const [complexity, setComplexity] = useState([5]);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSize(repositorySize);
    setFiles(fileCount);
  }, [repositorySize, fileCount]);

  useEffect(() => {
    if (size > 0 || files > 0) {
      calculateCost();
    }
  }, [size, files, complexity]);

  const calculateCost = async () => {
    if (size < 0 || files < 0) {
      setError('Size and file count must be non-negative');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/credits/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repositorySize: size,
          fileCount: files,
          complexity: complexity[0],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Calculation failed');
      }

      const data = await response.json();
      setResult(data);
      
      if (onCalculate) {
        onCalculate(data.creditCost, data.hasSufficientCredits);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getComplexityLabel = (value: number) => {
    if (value <= 2) return 'Very Simple';
    if (value <= 4) return 'Simple';
    if (value <= 6) return 'Moderate';
    if (value <= 8) return 'Complex';
    return 'Very Complex';
  };

  const getComplexityDescription = (value: number) => {
    if (value <= 2) return 'Basic HTML/CSS, minimal JavaScript';
    if (value <= 4) return 'Simple web app, few dependencies';
    if (value <= 6) return 'Standard web app with frameworks';
    if (value <= 8) return 'Complex app with many dependencies';
    return 'Enterprise app with advanced features';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Credit Cost Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="size">Repository Size (KB)</Label>
            <Input
              id="size"
              type="number"
              value={size}
              onChange={(e) => setSize(parseInt(e.target.value) || 0)}
              placeholder="Enter size in KB"
            />
          </div>
          <div>
            <Label htmlFor="files">File Count</Label>
            <Input
              id="files"
              type="number"
              value={files}
              onChange={(e) => setFiles(parseInt(e.target.value) || 0)}
              placeholder="Number of files"
            />
          </div>
        </div>

        <div>
          <Label>Project Complexity: {getComplexityLabel(complexity[0])}</Label>
          <div className="mt-2">
            <Slider
              value={complexity}
              onValueChange={setComplexity}
              max={10}
              min={1}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Simple</span>
              <span>Complex</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {getComplexityDescription(complexity[0])}
          </div>
        </div>

        {error && (
          <div className="text-red-600 text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        {result && !loading && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-medium">Estimated Cost:</span>
              <Badge variant="outline" className="text-lg px-3 py-1">
                {result.creditCost} credits
              </Badge>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span>Your Balance:</span>
              <span className="font-medium">{result.userBalance} credits</span>
            </div>

            <div className="flex items-center gap-2">
              {result.hasSufficientCredits ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-600 text-sm">Sufficient credits available</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-red-600 text-sm">
                    Insufficient credits (need {result.creditCost - result.userBalance} more)
                  </span>
                </>
              )}
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <div>Calculation breakdown:</div>
              <div>• Repository size: {result.calculation.repositorySize} KB</div>
              <div>• File count: {result.calculation.fileCount}</div>
              <div>• Complexity: {result.calculation.complexity}/10</div>
            </div>
          </div>
        )}

        {(size > 0 || files > 0) && (
          <Button 
            onClick={calculateCost} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Calculating...' : 'Calculate Cost'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
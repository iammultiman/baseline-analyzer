'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CreditCard, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  description?: string;
}

interface CreditPurchaseProps {
  onPurchaseComplete?: (newBalance: number) => void;
}

interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
}

export function CreditPurchase({ onPurchaseComplete }: CreditPurchaseProps) {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [open, setOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'demo' | 'stripe'>('demo');
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [stripeConfigured, setStripeConfigured] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPackages();
      checkStripeConfiguration();
    }
  }, [open]);

  const checkStripeConfiguration = async () => {
    try {
      // Check if Stripe is configured by trying to create a payment intent
      const response = await fetch('/api/credits/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: 'starter' }), // Use a test package
      });
      
      setStripeConfigured(response.status !== 503);
    } catch (error) {
      setStripeConfigured(false);
    }
  };

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/credits/packages');
      
      if (!response.ok) {
        throw new Error('Failed to fetch credit packages');
      }

      const data = await response.json();
      setPackages(data.packages);
      
      // Select the first package by default
      if (data.packages.length > 0) {
        setSelectedPackage(data.packages[0].id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  const createPaymentIntent = async () => {
    if (!selectedPackage) {
      toast.error('Please select a package');
      return;
    }

    try {
      setPurchasing(true);
      
      const response = await fetch('/api/credits/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: selectedPackage }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create payment intent');
      }

      const result = await response.json();
      setPaymentIntent(result.paymentIntent);
      
      // In a real implementation, you would now show the Stripe payment form
      // For this demo, we'll simulate a successful payment
      setTimeout(() => {
        handleStripePaymentSuccess(result.paymentIntent.id);
      }, 2000);
      
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create payment intent');
      setPurchasing(false);
    }
  };

  const handleStripePaymentSuccess = async (paymentIntentId: string) => {
    try {
      const response = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: selectedPackage,
          paymentIntentId: paymentIntentId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Purchase failed');
      }

      const result = await response.json();
      
      toast.success(`Successfully purchased ${result.package.credits} credits!`);
      
      if (onPurchaseComplete) {
        onPurchaseComplete(result.newBalance);
      }
      
      setOpen(false);
      setPaymentIntent(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  const handleDemoPurchase = async () => {
    if (!selectedPackage) {
      toast.error('Please select a package');
      return;
    }

    try {
      setPurchasing(true);
      
      const response = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: selectedPackage,
          useDemo: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Purchase failed');
      }

      const result = await response.json();
      
      toast.success(`Successfully purchased ${result.package.credits} credits!`);
      
      if (onPurchaseComplete) {
        onPurchaseComplete(result.newBalance);
      }
      
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  const handlePurchase = () => {
    if (paymentMode === 'demo') {
      handleDemoPurchase();
    } else {
      createPaymentIntent();
    }
  };

  const formatPrice = (priceInCents: number) => {
    return `$${(priceInCents / 100).toFixed(2)}`;
  };

  const getValuePerCredit = (credits: number, price: number) => {
    return (price / 100 / credits).toFixed(3);
  };

  const selectedPkg = packages.find(p => p.id === selectedPackage);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CreditCard className="h-4 w-4 mr-2" />
          Buy Credits
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Purchase Credits</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <RadioGroup value={selectedPackage} onValueChange={setSelectedPackage}>
              {packages.map((pkg) => (
                <div key={pkg.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={pkg.id} id={pkg.id} />
                  <Label htmlFor={pkg.id} className="flex-1 cursor-pointer">
                    <Card className="p-4 hover:bg-accent transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{pkg.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {pkg.credits} credits
                          </div>
                          {pkg.description && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {pkg.description}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatPrice(pkg.price)}</div>
                          <div className="text-xs text-muted-foreground">
                            ${getValuePerCredit(pkg.credits, pkg.price)}/credit
                          </div>
                        </div>
                      </div>
                      {pkg.id === 'professional' && (
                        <Badge variant="secondary" className="mt-2">
                          Most Popular
                        </Badge>
                      )}
                    </Card>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {/* Payment Mode Selection */}
            <Tabs value={paymentMode} onValueChange={(value) => setPaymentMode(value as 'demo' | 'stripe')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="demo">Demo Mode</TabsTrigger>
                <TabsTrigger value="stripe" disabled={!stripeConfigured}>
                  Production Payment
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="demo" className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Demo mode - No actual payment will be processed. Credits will be added to your account for testing.
                  </AlertDescription>
                </Alert>
              </TabsContent>
              
              <TabsContent value="stripe" className="space-y-4">
                {stripeConfigured ? (
                  <Alert>
                    <CreditCard className="h-4 w-4" />
                    <AlertDescription>
                      Production payment processing via Stripe. Your card will be charged.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Payment processing is not configured. Please contact support or use demo mode.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </Tabs>

            {selectedPkg && (
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm font-medium mb-2">Purchase Summary</div>
                <div className="flex justify-between text-sm">
                  <span>{selectedPkg.credits} credits</span>
                  <span>${formatPrice(selectedPkg.price)}</span>
                </div>
                {paymentIntent && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Payment Intent: {paymentIntent.id}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                className="flex-1"
                disabled={purchasing}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePurchase}
                disabled={!selectedPackage || purchasing || (paymentMode === 'stripe' && !stripeConfigured)}
                className="flex-1"
              >
                {purchasing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {paymentIntent ? 'Processing Payment...' : 'Creating Payment...'}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {paymentMode === 'demo' ? 'Purchase (Demo)' : 'Purchase'}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
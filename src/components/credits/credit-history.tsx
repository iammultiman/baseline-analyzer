'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowUpCircle, ArrowDownCircle, Gift, RefreshCw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface CreditTransaction {
  id: string;
  type: 'PURCHASE' | 'DEDUCTION' | 'REFUND' | 'BONUS';
  amount: number;
  description: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface CreditHistoryProps {
  limit?: number;
}

export function CreditHistory({ limit = 20 }: CreditHistoryProps) {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchTransactions(0);
  }, []);

  const fetchTransactions = async (currentOffset: number) => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/credits?includeHistory=true&limit=${limit}&offset=${currentOffset}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch transaction history');
      }

      const data = await response.json();
      
      if (currentOffset === 0) {
        setTransactions(data.history || []);
      } else {
        setTransactions(prev => [...prev, ...(data.history || [])]);
      }
      
      setHasMore((data.history || []).length === limit);
      setOffset(currentOffset + limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchTransactions(offset);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'PURCHASE':
        return <ArrowUpCircle className="h-4 w-4 text-green-600" />;
      case 'DEDUCTION':
        return <ArrowDownCircle className="h-4 w-4 text-red-600" />;
      case 'BONUS':
        return <Gift className="h-4 w-4 text-blue-600" />;
      case 'REFUND':
        return <RefreshCw className="h-4 w-4 text-orange-600" />;
      default:
        return <ArrowUpCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'PURCHASE':
        return 'text-green-600';
      case 'DEDUCTION':
        return 'text-red-600';
      case 'BONUS':
        return 'text-blue-600';
      case 'REFUND':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatAmount = (amount: number, type: string) => {
    const sign = type === 'DEDUCTION' ? '' : '+';
    return `${sign}${amount}`;
  };

  if (loading && transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600">Error: {error}</div>
          <Button 
            onClick={() => fetchTransactions(0)} 
            variant="outline" 
            size="sm" 
            className="mt-2"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No transactions yet
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getTransactionIcon(transaction.type)}
                    <div>
                      <div className="font-medium text-sm">
                        {transaction.description}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(transaction.createdAt), 'MMM d, yyyy h:mm a')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-medium ${getTransactionColor(transaction.type)}`}>
                      {formatAmount(transaction.amount, transaction.type)}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {transaction.type.toLowerCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            
            {hasMore && (
              <div className="mt-4 text-center">
                <Button
                  onClick={loadMore}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
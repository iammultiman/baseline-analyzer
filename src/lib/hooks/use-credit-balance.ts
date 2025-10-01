import { useState, useCallback, useEffect } from 'react';

export interface CreditBalance {
  balance: number;
  lastUpdated: Date;
}

export interface CreditTransaction {
  id: string;
  amount: number;
  type: 'deduction' | 'purchase' | 'refund';
  description: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface CreditBalanceState {
  balance: number;
  isLoading: boolean;
  error: string | null;
  transactions: CreditTransaction[];
}

export function useCreditBalance() {
  const [state, setState] = useState<CreditBalanceState>({
    balance: 0,
    isLoading: false,
    error: null,
    transactions: []
  });

  const refreshBalance = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/credits');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch credit balance');
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        balance: data.balance,
        error: null
      }));

      return data.balance;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      throw error;
    }
  }, []);

  const getTransactionHistory = useCallback(async (
    page: number = 1,
    limit: number = 20
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      const response = await fetch(`/api/credits/history?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transaction history');
      }

      const transactions = data.transactions.map((tx: any) => ({
        ...tx,
        createdAt: new Date(tx.createdAt as string)
      }));

      setState(prev => ({
        ...prev,
        isLoading: false,
        transactions,
        error: null
      }));

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      throw error;
    }
  }, []);

  const purchaseCredits = useCallback(async (
    packageId: string,
    paymentMethod?: string
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ packageId, paymentMethod }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to purchase credits');
      }

      // Refresh balance after successful purchase
      await refreshBalance();

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: null
      }));

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      throw error;
    }
  }, [refreshBalance]);

  const calculateAnalysisCost = useCallback(async (
    repositorySize: number,
    fileCount: number,
    complexity?: number
  ) => {
    try {
      const response = await fetch('/api/credits/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repositorySize, fileCount, complexity }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate analysis cost');
      }

      return data.cost;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Auto-refresh balance on mount
  useEffect(() => {
    refreshBalance().catch(console.error);
  }, [refreshBalance]);

  return {
    ...state,
    refreshBalance,
    getTransactionHistory,
    purchaseCredits,
    calculateAnalysisCost,
    clearError
  };
}
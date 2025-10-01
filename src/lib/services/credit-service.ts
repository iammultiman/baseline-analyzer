import { prisma } from '@/lib/database';
import { TransactionType } from '@prisma/client';

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number; // in cents
  description?: string;
}

export interface PricingConfig {
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
  };
}

export interface CreditCalculationParams {
  repositorySize: number; // in KB
  fileCount: number;
  complexity: number; // 1-10 scale
}

export class CreditService {
  private static defaultPricingConfig: PricingConfig = {
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
    },
  };

  /**
   * Get user's current credit balance
   */
  static async getBalance(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });

    return user?.creditBalance ?? 0;
  }

  /**
   * Check if user has sufficient credits for an operation
   */
  static async hasSufficientCredits(userId: string, requiredCredits: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance >= requiredCredits;
  }

  /**
   * Deduct credits from user's account
   */
  static async deductCredits(
    userId: string,
    amount: number,
    description: string,
    metadata?: any
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Check current balance
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { creditBalance: true },
        });

        if (!user) {
          throw new Error('User not found');
        }

        if (user.creditBalance < amount) {
          throw new Error('Insufficient credits');
        }

        // Deduct credits
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { creditBalance: { decrement: amount } },
          select: { creditBalance: true },
        });

        // Log transaction
        await tx.creditTransaction.create({
          data: {
            userId,
            type: TransactionType.DEDUCTION,
            amount: -amount,
            description,
            metadata,
          },
        });

        return { success: true, newBalance: updatedUser.creditBalance };
      });

      return result;
    } catch (error) {
      return {
        success: false,
        newBalance: await this.getBalance(userId),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Add credits to user's account
   */
  static async addCredits(
    userId: string,
    amount: number,
    type: TransactionType,
    description: string,
    metadata?: any
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Add credits
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { creditBalance: { increment: amount } },
          select: { creditBalance: true },
        });

        // Log transaction
        await tx.creditTransaction.create({
          data: {
            userId,
            type,
            amount,
            description,
            metadata,
          },
        });

        return { success: true, newBalance: updatedUser.creditBalance };
      });

      return result;
    } catch (error) {
      return {
        success: false,
        newBalance: await this.getBalance(userId),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Calculate credit cost for repository analysis
   */
  static calculateAnalysisCost(params: CreditCalculationParams, pricingConfig?: PricingConfig): number {
    const config = pricingConfig || this.defaultPricingConfig;
    const { repositorySize, fileCount, complexity } = params;

    let cost = config.creditCostPerAnalysis.base;
    cost += fileCount * config.creditCostPerAnalysis.perFile;
    cost += repositorySize * config.creditCostPerAnalysis.perKB;
    
    // Apply complexity multiplier
    const complexityMultiplier = 1 + (complexity - 1) * 0.1;
    cost *= complexityMultiplier;

    return Math.ceil(cost);
  }

  /**
   * Get user's credit transaction history
   */
  static async getTransactionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ) {
    return await prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        type: true,
        amount: true,
        description: true,
        createdAt: true,
        metadata: true,
      },
    });
  }

  /**
   * Get usage statistics for a user
   */
  static async getUsageStats(userId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await prisma.creditTransaction.findMany({
      where: {
        userId,
        type: TransactionType.DEDUCTION,
        createdAt: { gte: startDate },
      },
      select: {
        amount: true,
        createdAt: true,
      },
    });

    const totalCreditsUsed = transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const analysisCount = transactions.length;

    return {
      totalCreditsUsed,
      analysisCount,
      averageCreditsPerAnalysis: analysisCount > 0 ? totalCreditsUsed / analysisCount : 0,
      period: `${days} days`,
    };
  }

  /**
   * Check if user has reached daily/monthly limits
   */
  static async checkUsageLimits(userId: string, pricingConfig?: PricingConfig) {
    const config = pricingConfig || this.defaultPricingConfig;
    
    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dailyUsage = await prisma.creditTransaction.count({
      where: {
        userId,
        type: TransactionType.DEDUCTION,
        createdAt: { gte: today },
      },
    });

    // Check monthly limit
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    
    const monthlyUsage = await prisma.creditTransaction.count({
      where: {
        userId,
        type: TransactionType.DEDUCTION,
        createdAt: { gte: monthStart },
      },
    });

    return {
      dailyUsage,
      monthlyUsage,
      dailyLimitReached: dailyUsage >= config.usageLimits.freeUserDailyLimit,
      monthlyLimitReached: monthlyUsage >= config.usageLimits.freeUserMonthlyLimit,
      limits: config.usageLimits,
    };
  }

  /**
   * Grant initial free credits to new user
   */
  static async grantInitialCredits(userId: string, pricingConfig?: PricingConfig) {
    const config = pricingConfig || this.defaultPricingConfig;
    
    return await this.addCredits(
      userId,
      config.freeCredits,
      TransactionType.BONUS,
      'Welcome bonus - initial free credits',
      { type: 'welcome_bonus' }
    );
  }

  /**
   * Get available credit packages
   */
  static getCreditPackages(pricingConfig?: PricingConfig): CreditPackage[] {
    const config = pricingConfig || this.defaultPricingConfig;
    return config.packages;
  }

  /**
   * Process credit purchase
   */
  static async processCreditPurchase(
    userId: string,
    packageId: string,
    paymentMetadata: any,
    pricingConfig?: PricingConfig
  ) {
    const config = pricingConfig || this.defaultPricingConfig;
    const package_ = config.packages.find(p => p.id === packageId);
    
    if (!package_) {
      throw new Error('Invalid package ID');
    }

    return await this.addCredits(
      userId,
      package_.credits,
      TransactionType.PURCHASE,
      `Credit purchase: ${package_.name}`,
      {
        packageId,
        packageName: package_.name,
        price: package_.price,
        ...paymentMetadata,
      }
    );
  }
}
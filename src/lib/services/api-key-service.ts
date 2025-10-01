import { prisma } from '@/lib/database';
import { ApiKey, CreateApiKeyRequest, CreateApiKeyResponse, API_PERMISSIONS } from '@/lib/types/cicd';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export class ApiKeyService {
  private static generateApiKey(): { key: string; hash: string; prefix: string } {
    // Generate a secure random key
    const key = `bla_${crypto.randomBytes(32).toString('hex')}`;
    const hash = bcrypt.hashSync(key, 10);
    const prefix = key.substring(0, 12) + '...';
    
    return { key, hash, prefix };
  }

  static async createApiKey(
    organizationId: string,
    userId: string,
    request: CreateApiKeyRequest
  ): Promise<CreateApiKeyResponse> {
    const { key, hash, prefix } = this.generateApiKey();
    
    const permissions = request.permissions || [
      API_PERMISSIONS.ANALYSIS_READ,
      API_PERMISSIONS.ANALYSIS_WRITE
    ];

    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId,
        createdBy: userId,
        name: request.name,
        keyHash: hash,
        keyPrefix: prefix,
        permissions,
        expiresAt: request.expiresAt,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      key, // Return the full key only once
      keyPrefix: prefix,
      permissions: apiKey.permissions,
      expiresAt: apiKey.expiresAt || undefined,
    };
  }

  static async validateApiKey(key: string): Promise<ApiKey | null> {
    try {
      // Find all active API keys and check against the provided key
      const apiKeys = await prisma.apiKey.findMany({
        where: {
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        },
      });

      for (const apiKey of apiKeys) {
        if (bcrypt.compareSync(key, apiKey.keyHash)) {
          // Update last used timestamp
          await prisma.apiKey.update({
            where: { id: apiKey.id },
            data: { lastUsedAt: new Date() },
          });

          return {
            id: apiKey.id,
            organizationId: apiKey.organizationId,
            name: apiKey.name,
            keyHash: apiKey.keyHash,
            keyPrefix: apiKey.keyPrefix,
            permissions: apiKey.permissions,
            isActive: apiKey.isActive,
            lastUsedAt: apiKey.lastUsedAt || undefined,
            expiresAt: apiKey.expiresAt || undefined,
            createdAt: apiKey.createdAt,
            createdBy: apiKey.createdBy,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error validating API key:', error);
      return null;
    }
  }

  static async listApiKeys(organizationId: string): Promise<Omit<ApiKey, 'keyHash'>[]> {
    const apiKeys = await prisma.apiKey.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    });

    return apiKeys.map(apiKey => ({
      id: apiKey.id,
      organizationId: apiKey.organizationId,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      permissions: apiKey.permissions,
      isActive: apiKey.isActive,
      lastUsedAt: apiKey.lastUsedAt || undefined,
      expiresAt: apiKey.expiresAt || undefined,
      createdAt: apiKey.createdAt,
      createdBy: apiKey.createdBy,
    }));
  }

  static async revokeApiKey(organizationId: string, apiKeyId: string): Promise<void> {
    await prisma.apiKey.update({
      where: {
        id: apiKeyId,
        organizationId,
      },
      data: {
        isActive: false,
      },
    });
  }

  static async updateApiKey(
    organizationId: string,
    apiKeyId: string,
    updates: Partial<Pick<ApiKey, 'name' | 'permissions' | 'expiresAt'>>
  ): Promise<void> {
    await prisma.apiKey.update({
      where: {
        id: apiKeyId,
        organizationId,
      },
      data: updates,
    });
  }

  static hasPermission(apiKey: ApiKey, permission: string): boolean {
    return apiKey.permissions.includes(permission);
  }

  static async getApiKeyUsageStats(organizationId: string, days: number = 30): Promise<{
    totalKeys: number;
    activeKeys: number;
    expiredKeys: number;
    recentUsage: Array<{ date: string; requests: number }>;
  }> {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const [totalKeys, activeKeys, expiredKeys] = await Promise.all([
      prisma.apiKey.count({ where: { organizationId } }),
      prisma.apiKey.count({
        where: {
          organizationId,
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } }
          ]
        }
      }),
      prisma.apiKey.count({
        where: {
          organizationId,
          expiresAt: { lte: now }
        }
      }),
    ]);

    // For now, return empty usage data - this would need to be tracked separately
    const recentUsage: Array<{ date: string; requests: number }> = [];

    return {
      totalKeys,
      activeKeys,
      expiredKeys,
      recentUsage,
    };
  }
}
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET, POST } from '../api-keys/route';
import { ApiKeyService } from '@/lib/services/api-key-service';
import { API_PERMISSIONS } from '@/lib/types/cicd';

// Mock Next.js globals
global.Request = global.Request || class Request {};
global.Response = global.Response || class Response {};

// Mock the services
jest.mock('@/lib/services/api-key-service');
jest.mock('@/lib/auth-middleware');

const mockApiKeyService = ApiKeyService as jest.Mocked<typeof ApiKeyService>;

describe('/api/cicd/api-keys', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    organizationId: 'org-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock authenticateUser
    const { authenticateUser } = require('@/lib/auth-middleware');
    authenticateUser.mockResolvedValue({
      user: mockUser,
      organizationId: 'org-1',
    });
  });

  describe('GET /api/cicd/api-keys', () => {
    it('should list API keys for organization', async () => {
      const mockApiKeys = [
        {
          id: 'key-1',
          name: 'CI/CD Key',
          keyPrefix: 'bla_abc123...',
          permissions: [API_PERMISSIONS.ANALYSIS_READ, API_PERMISSIONS.ANALYSIS_WRITE],
          isActive: true,
          createdAt: new Date(),
        },
      ];

      const mockUsage = {
        totalKeys: 1,
        activeKeys: 1,
        expiredKeys: 0,
        recentUsage: [],
      };

      mockApiKeyService.listApiKeys.mockResolvedValue(mockApiKeys);
      mockApiKeyService.getApiKeyUsageStats.mockResolvedValue(mockUsage);

      const request = new NextRequest('http://localhost/api/cicd/api-keys');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.apiKeys).toEqual(mockApiKeys);
      expect(data.usage).toEqual(mockUsage);
      expect(mockApiKeyService.listApiKeys).toHaveBeenCalledWith('org-1');
    });

    it('should return 400 if no organization context', async () => {
      const { authenticateUser } = require('@/lib/auth-middleware');
      authenticateUser.mockResolvedValue({
        user: mockUser,
        organizationId: null,
      });

      const request = new NextRequest('http://localhost/api/cicd/api-keys');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Organization context required');
    });
  });

  describe('POST /api/cicd/api-keys', () => {
    it('should create new API key', async () => {
      const mockCreatedKey = {
        id: 'key-1',
        name: 'Test Key',
        key: 'bla_abc123def456...',
        keyPrefix: 'bla_abc123...',
        permissions: [API_PERMISSIONS.ANALYSIS_READ, API_PERMISSIONS.ANALYSIS_WRITE],
      };

      mockApiKeyService.createApiKey.mockResolvedValue(mockCreatedKey);

      const requestBody = {
        name: 'Test Key',
        permissions: [API_PERMISSIONS.ANALYSIS_READ, API_PERMISSIONS.ANALYSIS_WRITE],
      };

      const request = new NextRequest('http://localhost/api/cicd/api-keys', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual(mockCreatedKey);
      expect(mockApiKeyService.createApiKey).toHaveBeenCalledWith(
        'org-1',
        'user-1',
        requestBody
      );
    });

    it('should validate API key name', async () => {
      const request = new NextRequest('http://localhost/api/cicd/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: '' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('API key name is required');
    });

    it('should validate permissions', async () => {
      const request = new NextRequest('http://localhost/api/cicd/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Key',
          permissions: ['invalid:permission'],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid permissions');
    });

    it('should validate expiration date', async () => {
      const pastDate = new Date(Date.now() - 86400000); // Yesterday

      const request = new NextRequest('http://localhost/api/cicd/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Key',
          expiresAt: pastDate.toISOString(),
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Expiration date must be in the future');
    });
  });
});
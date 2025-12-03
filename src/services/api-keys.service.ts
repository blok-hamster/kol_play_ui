import apiClient from '@/lib/api';

export interface ApiKey {
  id: string;
  name: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyResponse {
  message: string;
  apiKey: string;
  keyInfo: {
    id: string;
    name: string;
    permissions: string[];
    createdAt: string;
  };
  warning: string;
}

export interface ListApiKeysResponse {
  apiKeys: ApiKey[];
  count: number;
}

export class ApiKeysService {
  private static readonly BASE_URL = '/api/keys';

  /**
   * Create a new API key
   */
  static async createApiKey(
    name: string,
    permissions: string[] = ['read', 'write']
  ): Promise<CreateApiKeyResponse> {
    try {
      const response = await apiClient.postRaw<CreateApiKeyResponse>(
        this.BASE_URL,
        { name, permissions }
      );
      return response;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error || 'Failed to create API key'
      );
    }
  }

  /**
   * Get all API keys for the authenticated user
   */
  static async getUserApiKeys(): Promise<ListApiKeysResponse> {
    try {
      const response = await apiClient.get<ListApiKeysResponse>(this.BASE_URL);
      return response.data || response;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error || 'Failed to fetch API keys'
      );
    }
  }

  /**
   * Revoke an API key
   */
  static async revokeApiKey(keyId: string): Promise<{ message: string; keyId: string }> {
    try {
      const response = await apiClient.delete<{ message: string; keyId: string }>(
        `${this.BASE_URL}/${keyId}`
      );
      return response.data || response;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error || 'Failed to revoke API key'
      );
    }
  }
}

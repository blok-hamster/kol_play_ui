'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Clock,
  Shield,
} from 'lucide-react';
import { ApiKeysService, ApiKey } from '@/services/api-keys.service';
import { useNotifications } from '@/stores/use-ui-store';

const ApiKeysSettingsComponent: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create new key state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['read', 'write']);
  const [isCreating, setIsCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showCreatedKey, setShowCreatedKey] = useState(false);

  const { showSuccess, showError } = useNotifications();

  const fetchApiKeys = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await ApiKeysService.getUserApiKeys();
      setApiKeys(response.apiKeys || []);
    } catch (err: any) {
      console.error('Failed to fetch API keys:', err);
      setError(err.message || 'Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      showError('Validation Error', 'Please enter a name for the API key');
      return;
    }

    try {
      setIsCreating(true);
      const response = await ApiKeysService.createApiKey(
        newKeyName.trim(),
        newKeyPermissions
      );
      
      setCreatedKey(response.apiKey);
      setShowCreatedKey(true);
      setNewKeyName('');
      setNewKeyPermissions(['read', 'write']);
      setShowCreateForm(false);
      
      // Refresh the list
      await fetchApiKeys();
      
      showSuccess(
        'API Key Created',
        'Your API key has been created successfully. Make sure to copy it now!'
      );
    } catch (err: any) {
      console.error('Failed to create API key:', err);
      showError('Creation Failed', err.message || 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Are you sure you want to revoke the API key "${keyName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await ApiKeysService.revokeApiKey(keyId);
      showSuccess('API Key Revoked', `The API key "${keyName}" has been revoked successfully`);
      
      // Refresh the list
      await fetchApiKeys();
    } catch (err: any) {
      console.error('Failed to revoke API key:', err);
      showError('Revocation Failed', err.message || 'Failed to revoke API key');
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    showSuccess('Copied!', 'API key copied to clipboard');
  };

  const togglePermission = (permission: string) => {
    setNewKeyPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Key className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold text-foreground">API Keys</h2>
            <p className="text-sm text-muted-foreground">
              Manage API keys for programmatic access
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchApiKeys}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button
            variant="gradient"
            size="sm"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Key
          </Button>
        </div>
      </div>

      {/* Created Key Display */}
      {createdKey && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-6">
          <div className="flex items-start space-x-3 mb-4">
            <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-1">
                API Key Created Successfully!
              </h3>
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-3">
                Make sure to copy your API key now. You won't be able to see it again!
              </p>
              
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 rounded-lg p-3 font-mono text-sm">
                  {showCreatedKey ? createdKey : '••••••••••••••••••••••••••••••••'}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreatedKey(!showCreatedKey)}
                >
                  {showCreatedKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="gradient"
                  size="sm"
                  onClick={() => handleCopyKey(createdKey)}
                  className="text-white"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </div>
            <button
              onClick={() => {
                setCreatedKey(null);
                setShowCreatedKey(false);
              }}
              className="text-emerald-600 hover:text-emerald-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-muted/50 rounded-lg p-6 border-2 border-primary/20">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Create New API Key
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Key Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="e.g., Production API, Mobile App, Trading Bot"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Choose a descriptive name to identify this key
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Permissions
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newKeyPermissions.includes('read')}
                    onChange={() => togglePermission('read')}
                    className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">Read Access</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newKeyPermissions.includes('write')}
                    onChange={() => togglePermission('write')}
                    className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">Write Access</span>
                </label>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <Button
                variant="gradient"
                onClick={handleCreateKey}
                disabled={isCreating || !newKeyName.trim()}
                className="text-white"
              >
                {isCreating ? 'Creating...' : 'Create API Key'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewKeyName('');
                  setNewKeyPermissions(['read', 'write']);
                }}
                disabled={isCreating}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800 dark:text-red-200">{error}</span>
          </div>
        </div>
      )}

      {/* API Keys List */}
      <div className="bg-muted/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Your API Keys ({apiKeys.length})
        </h3>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-background rounded-lg p-4 border border-border">
                <div className="animate-pulse space-y-3">
                  <div className="h-5 bg-muted rounded w-1/3"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="text-center py-12">
            <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No API keys yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first API key to get started with programmatic access
            </p>
            <Button
              variant="gradient"
              onClick={() => setShowCreateForm(true)}
              className="text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Key
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {apiKeys.map(key => (
              <div
                key={key.id}
                className="bg-background rounded-lg p-4 border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-semibold text-foreground">{key.name}</h4>
                      {key.isActive ? (
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded-full">
                          Revoked
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-2">
                        <Shield className="h-3.5 w-3.5" />
                        <span>Permissions: {key.permissions.join(', ')}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Created: {formatDate(key.createdAt)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Last used: {formatDate(key.lastUsedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {key.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevokeKey(key.id, key.name)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">
              Security Best Practices
            </h4>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Never share your API keys publicly or commit them to version control</li>
              <li>• Rotate your API keys regularly for enhanced security</li>
              <li>• Use separate keys for different applications or environments</li>
              <li>• Revoke keys immediately if you suspect they've been compromised</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeysSettingsComponent;

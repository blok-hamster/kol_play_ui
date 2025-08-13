'use client';

import React, { useState } from 'react';
import { SolanaService } from '@/services';
import type { SolanaWalletBalance, SolanaTokenInfo } from '@/types';

export function SolanaServiceDemo() {
  const [address, setAddress] = useState('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'); // Phantom Team wallet
  const [loading, setLoading] = useState(false);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [tokens, setTokens] = useState<SolanaTokenInfo[]>([]);
  const [walletBalance, setWalletBalance] = useState<SolanaWalletBalance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<boolean | null>(null);
  const [includeMetadata, setIncludeMetadata] = useState(true);

  const handleGetSolBalance = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const balance = await SolanaService.getSolBalance(address);
      setSolBalance(balance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get SOL balance');
    } finally {
      setLoading(false);
    }
  };

  const handleGetTokens = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      void 0 && (`🚀 Starting ${includeMetadata ? 'enhanced' : 'basic'} token fetch...`);
      const startTime = performance.now();
      
      const tokenList = await SolanaService.getTokens(address, includeMetadata);
      
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);
      
      if (includeMetadata) {
        const tokensWithMetadata = tokenList.filter(t => t.name || t.symbol).length;
        void 0 && (`✅ Fetched ${tokenList.length} tokens (${tokensWithMetadata} with metadata) in ${duration}ms`);
        void 0 && (`📊 Efficiency: ~${((tokensWithMetadata / tokenList.length) * 100).toFixed(0)}% metadata coverage with minimal requests`);
      } else {
        void 0 && (`✅ Fetched ${tokenList.length} tokens in ${duration}ms (basic mode - no metadata)`);
      }
      setTokens(tokenList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get tokens');
    } finally {
      setLoading(false);
    }
  };

  const handleGetCompleteBalance = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      void 0 && ('🚀 Starting complete balance fetch with parallel requests...');
      const startTime = performance.now();
      
      const balance = await SolanaService.getWalletBalance(address);
      
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);
      
      void 0 && (`✅ Fetched complete wallet balance (SOL + ${balance.totalTokens} tokens) in ${duration}ms`);
      setWalletBalance(balance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get wallet balance');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const isConnected = await SolanaService.testConnection();
      setConnectionStatus(isConnected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test connection');
      setConnectionStatus(false);
    } finally {
      setLoading(false);
    }
  };

  const isValidAddress = address ? SolanaService.isValidAddress(address) : false;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          Solana Service Demo - Now with Token Metadata! 🎉
        </h1>
        
        {/* Address Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Wallet Address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="Enter Solana wallet address"
          />
          <div className="mt-2 text-sm">
            Address validation: 
            <span className={`ml-2 font-medium ${isValidAddress ? 'text-green-600' : 'text-red-600'}`}>
              {isValidAddress ? '✅ Valid' : '❌ Invalid'}
            </span>
          </div>
        </div>

        {/* Metadata Toggle */}
        <div className="mb-6">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={includeMetadata}
              onChange={(e) => setIncludeMetadata(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Include Token Metadata (names, symbols, logos from Jupiter Token List)
            </span>
          </label>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            ⚡ Smart token database - prioritizes verified tokens, expands to all tokens for maximum coverage
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <button
            onClick={handleTestConnection}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Test Connection
          </button>
          
          <button
            onClick={handleGetSolBalance}
            disabled={loading || !isValidAddress}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Get SOL Balance
          </button>
          
          <button
            onClick={handleGetTokens}
            disabled={loading || !isValidAddress}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {includeMetadata ? 'Get Tokens + Metadata' : 'Get Tokens (Basic)'}
          </button>
          
          <button
            onClick={handleGetCompleteBalance}
            disabled={loading || !isValidAddress}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Get Complete Balance
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-4">
            <div className="inline-flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Loading...
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-4 mb-4">
            <div className="text-red-800 dark:text-red-200">
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}

        {/* Connection Status */}
        {connectionStatus !== null && (
          <div className={`p-4 rounded-md mb-4 ${
            connectionStatus 
              ? 'bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700' 
              : 'bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700'
          }`}>
            <div className={connectionStatus ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}>
              RPC Connection: {connectionStatus ? '✅ Connected' : '❌ Failed'}
            </div>
            <div className="text-sm mt-1 opacity-75">
              Current RPC: {SolanaService.getRpcEndpoint()}
            </div>
          </div>
        )}

        {/* SOL Balance */}
        {solBalance !== null && (
          <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md p-4 mb-4">
            <h3 className="text-lg font-medium text-blue-800 dark:text-blue-200 mb-2">SOL Balance</h3>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {solBalance.toFixed(6)} SOL
            </div>
          </div>
        )}

        {/* Tokens List */}
        {tokens.length > 0 && (
          <div className="bg-purple-50 dark:bg-purple-900 border border-purple-200 dark:border-purple-700 rounded-md p-4 mb-4">
            <h3 className="text-lg font-medium text-purple-800 dark:text-purple-200 mb-2">
              SPL Tokens ({tokens.length}) - {includeMetadata ? 'With Metadata ✨' : 'Basic Info Only'}
            </h3>
            <div className="text-sm text-purple-700 dark:text-purple-300 mb-4">
              {includeMetadata ? (
                <span>🎯 Smart token database - verified tokens first, then comprehensive coverage!</span>
              ) : (
                <span>⚡ Basic fetch - toggle metadata above for token names and symbols</span>
              )}
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {tokens.map((token, index) => (
                <div key={token.mintAddress} className="bg-white dark:bg-gray-800 rounded-md p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start space-x-3">
                      {/* Token Logo */}
                      {token.logoURI && (
                        <img
                          src={token.logoURI}
                          alt={token.symbol || 'Token'}
                          className="w-8 h-8 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {token.symbol || `Token #${index + 1}`}
                          {token.symbol && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              Known
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {token.name || 'Unknown Token'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500 font-mono">
                          {token.mintAddress}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900 dark:text-white">
                        {token.uiAmount?.toLocaleString() || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        Decimals: {token.decimals}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Complete Wallet Balance */}
        {walletBalance && (
          <div className="bg-orange-50 dark:bg-orange-900 border border-orange-200 dark:border-orange-700 rounded-md p-4">
            <h3 className="text-lg font-medium text-orange-800 dark:text-orange-200 mb-4">
              Complete Wallet Balance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white dark:bg-gray-800 rounded-md p-3">
                <div className="text-sm text-gray-600 dark:text-gray-400">SOL Balance</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {walletBalance.solBalance.toFixed(6)}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-md p-3">
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Tokens</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {walletBalance.totalTokens}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-md p-3">
                <div className="text-sm text-gray-600 dark:text-gray-400">Address</div>
                <div className="text-xs font-mono text-gray-900 dark:text-white truncate">
                  {walletBalance.address}
                </div>
              </div>
            </div>
            
            {walletBalance.tokens.length > 0 && (
              <div>
                <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-2">Token Holdings:</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {walletBalance.tokens.map((token, index) => (
                    <div key={token.mintAddress} className="bg-white dark:bg-gray-800 rounded-md p-2 flex justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {token.symbol || 'Unknown'}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {token.uiAmount?.toLocaleString() || 'N/A'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchTokenResult } from '@/types';
import { formatNumber, formatRelativeTime, copyToClipboard } from '@/lib/utils';
import { ExternalLink, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/stores';
import { executeInstantBuy, checkTradeConfig } from '@/lib/trade-utils';
import TradeConfigPrompt from '@/components/ui/trade-config-prompt';

interface TokenDetailProps {
  token: SearchTokenResult;
}

const TokenDetail: React.FC<TokenDetailProps> = ({ token }) => {
  const router = useRouter();
  const { showSuccess, showError } = useNotifications();

  // Trade config prompt state
  const [showTradeConfigPrompt, setShowTradeConfigPrompt] = useState(false);
  const [isBuying, setIsBuying] = useState(false);

  const handleCopyAddress = async () => {
    const success = await copyToClipboard(token.mint);
    if (success) {
      showSuccess('Copied!', 'Token address copied to clipboard');
    } else {
      showError('Copy Failed', 'Failed to copy token address');
    }
  };

  const handleQuickBuy = async () => {
    if (isBuying) return;

    try {
      // First check if user has trade config
      const configCheck = await checkTradeConfig();
      
      if (!configCheck.hasConfig) {
        // Show trade config prompt
        setShowTradeConfigPrompt(true);
        return;
      }

      setIsBuying(true);

      // Execute instant buy
      const result = await executeInstantBuy(token.mint, token.symbol);

      if (result.success) {
        showSuccess(
          'Buy Order Executed',
          `Successfully bought ${token.symbol || 'token'} for ${configCheck.config?.tradeConfig?.minSpend || 'N/A'} SOL`
        );

        // Optional: Show transaction details
        if (result.result?.transactionId) {
          console.log('Transaction ID:', result.result.transactionId);
        }
      } else {
        showError(
          'Buy Order Failed',
          result.error || 'Failed to execute buy order'
        );
      }
    } catch (error: any) {
      console.error('Buy order error:', error);
      showError(
        'Buy Order Error',
        error.message || 'An unexpected error occurred'
      );
    } finally {
      setIsBuying(false);
    }
  };

  const handleTradeConfigPromptClose = () => {
    setShowTradeConfigPrompt(false);
  };

  return (
    <>
      <div className="space-y-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {token.name || 'Unknown Token'}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-6">
            {token.symbol || 'N/A'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Price
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${token.priceUsd ? token.priceUsd.toFixed(8) : '0.00000000'}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Market Cap
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${formatNumber(token.marketCapUsd || 0)}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Liquidity
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${formatNumber(token.liquidityUsd || 0)}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                24h Volume
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${formatNumber(token.volume_24h || 0)}
              </p>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              onClick={handleQuickBuy}
              disabled={isBuying}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white flex items-center space-x-2"
            >
              {isBuying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Buying...</span>
                </>
              ) : (
                <>
                  <span className="text-sm">⚡</span>
                  <span>Buy Token</span>
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleCopyAddress}>
              Copy Address
            </Button>
          </div>

          {/* Creation Time */}
          {token.createdOn && typeof token.createdOn === 'number' && (
            <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
              <Clock className="w-4 h-4" />
              <span>Created {formatRelativeTime(token.createdOn)}</span>
            </div>
          )}

          {/* Creation Platform */}
          {token.createdOn && typeof token.createdOn === 'string' && (
            <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
              <ExternalLink className="w-4 h-4" />
              <span>
                Created on{' '}
                <a
                  href={token.createdOn}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {new URL(token.createdOn).hostname.replace('www.', '')}
                </a>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Trade Config Prompt */}
      <TradeConfigPrompt
        isOpen={showTradeConfigPrompt}
        onClose={handleTradeConfigPromptClose}
        tokenSymbol={token.symbol || token.name}
      />
    </>
  );
};

export default TokenDetail;

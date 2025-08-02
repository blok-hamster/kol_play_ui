'use client';

import { useState, useCallback, useMemo } from 'react';
import { KOLTrade, KOLWallet } from '@/types';
import { useNotifications } from '@/stores';

interface MindShareWidgetProps {
  trade: KOLTrade;
  kolData?: KOLWallet;
  className?: string;
  variant?: 'button' | 'card' | 'inline';
  size?: 'sm' | 'md' | 'lg';
  showPrivacyControls?: boolean;
  defaultShareMode?: 'public' | 'anonymous';
}

interface ShareTemplate {
  platform: 'twitter' | 'telegram' | 'discord' | 'generic';
  template: string;
  hashtags?: string[];
  maxLength?: number;
}

interface ShareSettings {
  shareMode: 'public' | 'anonymous';
  includeAmount: boolean;
  includePerformance: boolean;
  includeSignature: boolean;
  customMessage?: string;
}

export default function MindShareWidget({
  trade,
  kolData,
  className = '',
  variant = 'button',
  size = 'md',
  showPrivacyControls = true,
  defaultShareMode = 'public',
}: MindShareWidgetProps) {
  const { showSuccess, showError, showInfo } = useNotifications();

  // State
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    shareMode: defaultShareMode,
    includeAmount: true,
    includePerformance: true,
    includeSignature: false,
    customMessage: '',
  });
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);

  // Format currency
  const formatCurrency = useCallback((amount: number, decimals = 4) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(amount);
  }, []);

  // Format timestamp
  const formatTimestamp = useCallback(
    (timestamp: Date | number, format: 'short' | 'long' = 'short') => {
      const date = new Date(timestamp);

      if (format === 'short') {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }

      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    },
    []
  );

  // Get KOL display info
  const kolDisplayInfo = useMemo(() => {
    if (shareSettings.shareMode === 'anonymous') {
      return {
        name: 'Anonymous Trader',
        wallet: 'Hidden',
        avatar: null,
      };
    }

    return {
      name: kolData?.name || trade.kolName || 'Unknown Trader',
      wallet: trade.kolWallet,
      avatar: kolData?.avatar,
    };
  }, [shareSettings.shareMode, kolData, trade]);

  // Generate share templates
  const generateShareTemplates = useCallback((): ShareTemplate[] => {
    const isBuy = trade.tradeType === 'buy';
    const action = isBuy ? 'bought' : 'sold';
    const token = trade.tokenOut || trade.tokenIn || 'Token';
    const amount = shareSettings.includeAmount
      ? formatCurrency(trade.amountOut || trade.amountIn || 0)
      : 'some';
    const value = shareSettings.includeAmount
      ? ` for ${formatCurrency(trade.amountIn || 0, 4)} SOL`
      : '';
    const kolName = kolDisplayInfo.name;
    const timestamp = formatTimestamp(trade.timestamp);

    let performanceText = '';
    if (shareSettings.includePerformance && kolData) {
      const winRate = kolData.winRate
        ? `${kolData.winRate.toFixed(1)}% win rate`
        : '';
      const totalPnL = kolData.totalPnL
        ? `${kolData.totalPnL >= 0 ? '+' : ''}${kolData.totalPnL.toFixed(2)} SOL PnL`
        : '';
      if (winRate && totalPnL) {
        performanceText = ` (${winRate}, ${totalPnL})`;
      } else if (winRate || totalPnL) {
        performanceText = ` (${winRate || totalPnL})`;
      }
    }

    const baseMessage =
      shareSettings.customMessage ||
      `${kolName} just ${action} ${amount} ${token}${value}${performanceText} at ${timestamp}`;

    return [
      {
        platform: 'twitter',
        template: `🚀 ${baseMessage}\n\n#SolanaTrading #KOLTrading #DeFi #Solana`,
        hashtags: ['SolanaTrading', 'KOLTrading', 'DeFi', 'Solana'],
        maxLength: 280,
      },
      {
        platform: 'telegram',
        template: `🔥 KOL Trade Alert!\n\n${baseMessage}\n\n💎 Follow top traders and copy their moves!\n\n#SolanaTrading #KOLTrading`,
        maxLength: 4096,
      },
      {
        platform: 'discord',
        template: `🎯 **KOL Trade Update**\n\n${baseMessage}\n\n📊 Want to copy trade with the best? Check out our KOL trading platform!`,
        maxLength: 2000,
      },
      {
        platform: 'generic',
        template: baseMessage,
        maxLength: 500,
      },
    ];
  }, [
    trade,
    kolDisplayInfo,
    shareSettings,
    kolData,
    formatCurrency,
    formatTimestamp,
  ]);

  // Copy to clipboard
  const copyToClipboard = useCallback(
    async (text: string, type: string = 'text') => {
      try {
        await navigator.clipboard.writeText(text);
        showSuccess('Copied!', `${type} copied to clipboard`);
      } catch (error) {
        showError('Copy Failed', 'Failed to copy to clipboard');
        console.error('Copy to clipboard failed:', error);
      }
    },
    [showSuccess, showError]
  );

  // Generate share URLs
  const generateShareURL = useCallback(
    (platform: 'twitter' | 'telegram' | 'discord', message: string) => {
      switch (platform) {
        case 'twitter':
          return `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
        case 'telegram':
          return `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(message)}`;
        case 'discord':
          // Discord doesn't have a direct share URL, so we'll copy to clipboard
          return null;
        default:
          return null;
      }
    },
    []
  );

  // Handle social share
  const handleSocialShare = useCallback(
    async (platform: 'twitter' | 'telegram' | 'discord') => {
      const templates = generateShareTemplates();
      const template = templates.find(t => t.platform === platform);

      if (!template) return;

      if (platform === 'discord') {
        // For Discord, copy to clipboard since there's no direct share URL
        await copyToClipboard(template.template, 'Discord message');
        showInfo(
          'Discord Share',
          'Message copied to clipboard. Paste it in your Discord channel!'
        );
        return;
      }

      const shareURL = generateShareURL(platform, template.template);
      if (shareURL) {
        window.open(shareURL, '_blank', 'width=600,height=400');
      }
    },
    [generateShareTemplates, generateShareURL, copyToClipboard, showInfo]
  );

  // Generate trade card (for future implementation with canvas/image generation)
  const generateTradeCard = useCallback(async () => {
    setIsGeneratingCard(true);

    try {
      // This would integrate with a service to generate beautiful trade card images
      // For now, we'll create a text-based card
      const templates = generateShareTemplates();
      const cardText =
        templates.find(t => t.platform === 'generic')?.template || '';

      await copyToClipboard(cardText, 'Trade card');

      // In a real implementation, this would generate an actual image
      showInfo('Trade Card', 'Trade card generated and copied to clipboard!');
    } catch (error) {
      showError('Card Generation Failed', 'Failed to generate trade card');
      console.error('Trade card generation failed:', error);
    } finally {
      setIsGeneratingCard(false);
    }
  }, [generateShareTemplates, copyToClipboard, showError, showInfo]);

  // Handle settings change
  const handleSettingsChange = useCallback(
    (updates: Partial<ShareSettings>) => {
      setShareSettings(prev => ({ ...prev, ...updates }));
    },
    []
  );

  // Size variants
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  // Render share modal
  const renderShareModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full max-h-screen overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Share Trade
            </h3>
            <button
              onClick={() => setShowShareModal(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Trade Preview */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-3 mb-3">
              {kolDisplayInfo.avatar ? (
                <img
                  src={kolDisplayInfo.avatar}
                  alt={kolDisplayInfo.name}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {kolDisplayInfo.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {kolDisplayInfo.name}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatTimestamp(trade.timestamp, 'long')}
                </p>
              </div>

              <div className="ml-auto">
                <span
                  className={`
                  inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${
                    trade.tradeType === 'buy'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }
                `}
                >
                  {trade.tradeType.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Token</p>
                <p className="font-medium text-gray-900 dark:text-white font-mono">
                  {trade.tokenOut || trade.tokenIn || 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Amount</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {shareSettings.includeAmount
                    ? formatCurrency(trade.amountOut || trade.amountIn || 0)
                    : 'Hidden'}
                </p>
              </div>
            </div>
          </div>

          {/* Privacy Controls */}
          {showPrivacyControls && (
            <div className="space-y-4 mb-6">
              <h4 className="font-medium text-gray-900 dark:text-white">
                Privacy Settings
              </h4>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-700 dark:text-gray-300">
                    Share Mode
                  </label>
                  <select
                    value={shareSettings.shareMode}
                    onChange={e =>
                      handleSettingsChange({ shareMode: e.target.value as any })
                    }
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="public">Public (with KOL name)</option>
                    <option value="anonymous">Anonymous</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-700 dark:text-gray-300">
                    Include Trade Amount
                  </label>
                  <button
                    onClick={() =>
                      handleSettingsChange({
                        includeAmount: !shareSettings.includeAmount,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      shareSettings.includeAmount
                        ? 'bg-blue-600'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        shareSettings.includeAmount
                          ? 'translate-x-6'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-700 dark:text-gray-300">
                    Include Performance Stats
                  </label>
                  <button
                    onClick={() =>
                      handleSettingsChange({
                        includePerformance: !shareSettings.includePerformance,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      shareSettings.includePerformance
                        ? 'bg-blue-600'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        shareSettings.includePerformance
                          ? 'translate-x-6'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-700 dark:text-gray-300">
                    Include Transaction Signature
                  </label>
                  <button
                    onClick={() =>
                      handleSettingsChange({
                        includeSignature: !shareSettings.includeSignature,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      shareSettings.includeSignature
                        ? 'bg-blue-600'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        shareSettings.includeSignature
                          ? 'translate-x-6'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Custom Message */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Custom Message (Optional)
            </label>
            <textarea
              value={shareSettings.customMessage}
              onChange={e =>
                handleSettingsChange({ customMessage: e.target.value })
              }
              placeholder="Add your own message to the share..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* Preview */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Preview
            </h4>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300">
              {
                generateShareTemplates().find(t => t.platform === 'generic')
                  ?.template
              }
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Social Share Buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleSocialShare('twitter')}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                </svg>
                <span>Twitter</span>
              </button>

              <button
                onClick={() => handleSocialShare('telegram')}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
                <span>Telegram</span>
              </button>

              <button
                onClick={() => handleSocialShare('discord')}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0002 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9554 2.4189-2.1568 2.4189Z" />
                </svg>
                <span>Discord</span>
              </button>
            </div>

            {/* Additional Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={generateTradeCard}
                disabled={isGeneratingCard}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-purple-400 disabled:to-blue-400 text-white rounded-lg font-medium transition-colors"
              >
                {isGeneratingCard && (
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                )}
                <span>Generate Card</span>
              </button>

              <button
                onClick={() => {
                  const templates = generateShareTemplates();
                  const genericTemplate = templates.find(
                    t => t.platform === 'generic'
                  );
                  if (genericTemplate) {
                    copyToClipboard(genericTemplate.template, 'Share text');
                  }
                }}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <span>Copy Text</span>
              </button>
            </div>
          </div>

          {/* Quick Copy Actions */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Quick Copy
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <button
                onClick={() =>
                  copyToClipboard(trade.kolWallet, 'KOL wallet address')
                }
                className="text-left p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  KOL Wallet
                </div>
                <div className="text-gray-500 dark:text-gray-400 font-mono truncate">
                  {trade.kolWallet.slice(0, 12)}...
                </div>
              </button>

              {trade.signature && (
                <button
                  onClick={() =>
                    copyToClipboard(trade.signature!, 'Transaction signature')
                  }
                  className="text-left p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    Transaction
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 font-mono truncate">
                    {trade.signature.slice(0, 12)}...
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Button variant
  if (variant === 'button') {
    return (
      <>
        <button
          onClick={() => setShowShareModal(true)}
          className={`bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2 ${sizeClasses[size]} ${className}`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
            />
          </svg>
          <span>Share</span>
        </button>

        {showShareModal && renderShareModal()}
      </>
    );
  }

  // Card variant
  if (variant === 'card') {
    return (
      <>
        <div
          className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900 dark:text-white">
              Share This Trade
            </h3>
            <button
              onClick={() => setShowShareModal(true)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                />
              </svg>
            </button>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Share this {trade.tradeType} trade with your network and help others
            discover great KOL traders.
          </p>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleSocialShare('twitter')}
              className="flex items-center space-x-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
              </svg>
              <span>Twitter</span>
            </button>

            <button
              onClick={() => setShowShareModal(true)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
            >
              More Options
            </button>
          </div>
        </div>

        {showShareModal && renderShareModal()}
      </>
    );
  }

  // Inline variant
  return (
    <>
      <button
        onClick={() => setShowShareModal(true)}
        className={`text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center space-x-1 ${className}`}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
          />
        </svg>
        <span className="text-sm font-medium">Share</span>
      </button>

      {showShareModal && renderShareModal()}
    </>
  );
}

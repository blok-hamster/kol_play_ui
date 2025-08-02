'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useUserStore } from '@/stores/use-user-store';
import { UserWalletToken } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Wallet,
  Copy,
  ExternalLink,
  LogOut,
  RefreshCw,
  TrendingUp,
  Eye,
  EyeOff,
} from 'lucide-react';
import { WalletInfo } from '@/types';
import { useNotifications } from '@/stores/use-ui-store';
import {
  formatBalance,
  formatWalletAddress,
  formatCurrency,
  copyToClipboard,
  cn,
} from '@/lib/utils';

interface TokenBalance {
  symbol: string;
  name: string;
  balance: number;
  value: number;
  change24h: number;
}

export function WalletDropdown() {
  const { user } = useUserStore();
  const { showNotification } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get trading wallet data from user account details or fallback to empty data
  const tradingWallet = user?.accountDetails
    ? {
        address: user.accountDetails.address,
        solBalance: user.accountDetails.balance || 0,
        totalValue:
          (user.accountDetails.tokens || []).reduce(
            (sum, token) => sum + (token.value || 0),
            0
          ) + (user.accountDetails.balance || 0),
        tokens: (user.accountDetails.tokens || []).map(token => ({
          symbol: token.symbol || 'UNKNOWN',
          name: token.name || 'Unknown Token',
          balance: token.balance || 0,
          value: token.value || 0,
          change24h: 0, // This would need to come from price data
        })) as TokenBalance[],
      }
    : null;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }

    return undefined;
  }, [isOpen]);

  const handleCopyAddress = async (
    address: string,
    type: 'trading' | 'phantom'
  ) => {
    try {
      await copyToClipboard(address);
      showNotification(
        'Address Copied',
        `${type === 'trading' ? 'Trading' : 'Phantom'} wallet address copied to clipboard`
      );
    } catch (error) {
      showNotification('Copy Failed', 'Failed to copy address to clipboard');
    }
  };

  const handleRefresh = async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    showNotification('Balances Updated', 'Wallet balances have been refreshed');
  };

  const toggleBalanceVisibility = () => {
    setIsBalanceVisible(!isBalanceVisible);
  };

  const formatBalance = (amount: number) => {
    return isBalanceVisible ? formatCurrency(amount) : '••••••';
  };

  const formatTokenAmount = (amount: number, symbol: string) => {
    if (!isBalanceVisible) return '••••••';

    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)}M ${symbol}`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(2)}K ${symbol}`;
    } else {
      return `${amount.toFixed(4)} ${symbol}`;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Wallet Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label="Open wallet dropdown"
        aria-expanded={isOpen}
      >
        <Wallet className="h-4 w-4" />
        <span className="hidden sm:inline-block text-sm font-medium">
          {formatBalance(tradingWallet?.totalValue || 0)}
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-popover border border-border rounded-lg shadow-lg z-[60]">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Your Wallets
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleBalanceVisibility}
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={
                    isBalanceVisible ? 'Hide balances' : 'Show balances'
                  }
                >
                  {isBalanceVisible ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={handleRefresh}
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  aria-label="Refresh balances"
                >
                  <RefreshCw
                    className={cn('h-4 w-4', false && 'animate-spin')}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Trading Wallet */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-accent-gradient rounded-full flex items-center justify-center">
                  <Wallet className="h-3 w-3 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Trading Wallet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Backend-generated
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-foreground">
                  {formatBalance(tradingWallet?.totalValue || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBalance(tradingWallet?.solBalance || 0)} SOL
                </p>
              </div>
            </div>

            {/* Address */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-mono">
                {formatWalletAddress(tradingWallet?.address || '')}
              </span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() =>
                    handleCopyAddress(tradingWallet?.address || '', 'trading')
                  }
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Copy trading wallet address"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <button
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="View on explorer"
                >
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Token Holdings */}
          {tradingWallet?.tokens.length > 0 && (
            <div className="px-4 py-3 border-b border-border">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Token Holdings
              </h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {tradingWallet.tokens.map(token => (
                  <div
                    key={token.symbol}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 bg-muted rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-muted-foreground">
                          {token.symbol.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          {token.symbol}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {token.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-foreground">
                        {formatBalance(token.value)}
                      </p>
                      <div className="flex items-center space-x-1">
                        <p className="text-xs text-muted-foreground">
                          {formatTokenAmount(token.balance, token.symbol)}
                        </p>
                        <span
                          className={cn(
                            'text-xs',
                            token.change24h >= 0
                              ? 'text-green-500'
                              : 'text-red-500'
                          )}
                        >
                          {token.change24h >= 0 ? '+' : ''}
                          {token.change24h.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Phantom Wallet Status (Auth Only) */}
          {user?.accountDetails && (
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">P</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Phantom Wallet
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Connected for auth
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-green-600">Connected</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs mt-2">
                <span className="text-muted-foreground font-mono">
                  {formatWalletAddress(user.accountDetails.address)}
                </span>
                <button
                  onClick={() =>
                    handleCopyAddress(user.accountDetails.address, 'phantom')
                  }
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Copy phantom wallet address"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="px-4 py-3">
            <div className="flex space-x-2">
              <Button size="sm" variant="outline" className="flex-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                Portfolio
              </Button>
              <Button size="sm" variant="outline" className="flex-1">
                <ExternalLink className="h-3 w-3 mr-1" />
                History
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WalletDropdown;

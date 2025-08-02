'use client';

import React, { useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/stores/use-user-store';
import { useNotifications } from '@/stores/use-ui-store';

interface WalletConnectorProps {
  onSuccess?: () => void;
  showDisconnect?: boolean;
  variant?: 'default' | 'outline' | 'gradient';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

const WalletConnector: React.FC<WalletConnectorProps> = ({
  onSuccess,
  showDisconnect = false,
  size = 'lg',
  className,
}) => {
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { updateWalletInfo, walletInfo } = useUserStore();
  const { showSuccess, showError, showInfo } = useNotifications();

  // Handle wallet connection for authentication
  const handleWalletAuth = useCallback(async () => {
    if (!publicKey || !connected) return;

    // Prevent duplicate updates if wallet info is already set for this address
    if (walletInfo && walletInfo.address === publicKey.toString() && walletInfo.isConnected) {
      return;
    }

    try {
      // Update wallet info in user store
      updateWalletInfo({
        address: publicKey.toString(),
        balance: 0, // Will be fetched separately if needed
        isConnected: true,
      });

      // For now, we'll just show success. In a real implementation,
      // you might want to:
      // 1. Send the wallet address to your backend for verification
      // 2. Create or link a user account based on the wallet address
      // 3. Set up the user session

      showSuccess(
        'Wallet Connected!',
        'Your Phantom wallet has been connected for authentication.'
      );

      showInfo(
        'Authentication Only',
        'This wallet connection is for authentication. Trading uses a secure backend-generated wallet.'
      );

      onSuccess?.();
    } catch (error: any) {
      showError('Wallet Authentication Failed', error.message);
    }
  }, [
    publicKey,
    connected,
    walletInfo,
    updateWalletInfo,
    showSuccess,
    showError,
    showInfo,
    onSuccess,
  ]);

  // Handle wallet disconnection
  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect();
      updateWalletInfo(null);
      showSuccess('Wallet Disconnected', 'Your wallet has been disconnected.');
    } catch (error: any) {
      showError('Disconnect Failed', error.message);
    }
  }, [disconnect, updateWalletInfo, showSuccess, showError]);

  // Effect to handle wallet connection changes
  useEffect(() => {
    if (connected && publicKey) {
      handleWalletAuth();
    }
  }, [connected, publicKey, handleWalletAuth]);

  // Effect to handle disconnection
  useEffect(() => {
    if (!connected && !connecting) {
      updateWalletInfo(null);
    }
  }, [connected, connecting, updateWalletInfo]);

  if (connected && showDisconnect) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground text-center">
          Connected: {publicKey?.toString().slice(0, 4)}...
          {publicKey?.toString().slice(-4)}
        </div>
        <Button
          onClick={handleDisconnect}
          variant="outline"
          size={size}
          className={className}
        >
          Disconnect Wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <WalletMultiButton
        className={`wallet-adapter-button-trigger ${className || ''}`}
      />
      {connecting && (
        <div className="text-sm text-muted-foreground text-center">
          Connecting to wallet...
        </div>
      )}
    </div>
  );
};

// Custom styled wallet button for better integration
export const CustomWalletButton: React.FC<WalletConnectorProps> = ({
  variant = 'outline',
  size = 'lg',
  className,
}) => {
  const { publicKey, connected, connecting, select, wallets } = useWallet();

  const handleConnect = async () => {
    if (connected) return;

    try {
      // Find Phantom wallet
      const phantomWallet = wallets.find(
        wallet => wallet.adapter.name === 'Phantom'
      );

      if (!phantomWallet) {
        window.open('https://phantom.app/', '_blank');
        return;
      }

      select(phantomWallet.adapter.name);
    } catch (error: any) {
      console.error('Wallet connection error:', error);
    }
  };

  if (connected && publicKey) {
    return (
      <Button variant="outline" size={size} className={className} disabled>
        <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleConnect}
      loading={connecting}
      disabled={connecting}
    >
      <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
      {connecting ? 'Connecting...' : 'Connect Phantom Wallet'}
    </Button>
  );
};

export default WalletConnector;

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useUserStore } from '@/stores/use-user-store';
import { useNotifications } from '@/stores/use-ui-store';

/**
 * Custom hook that integrates Solana Wallet Adapter with authentication state
 * This hook manages the wallet connection for authentication purposes only
 * Trading uses backend-generated wallets, not the connected wallet
 */
export const useWalletAuth = () => {
  const {
    publicKey,
    connected,
    connecting,
    disconnect: walletDisconnect,
    select,
    wallets,
    wallet,
    signIn,
  } = useWallet();

  const { walletInfo, isWalletConnected, updateWalletInfo } = useUserStore();
  const { showSuccess, showError, showInfo } = useNotifications();
  
  // Track previous connection state to prevent unnecessary updates
  const prevConnectionRef = useRef<{
    connected: boolean;
    address: string | null;
  }>({
    connected: false,
    address: null,
  });

  // Update wallet info when connection changes
  useEffect(() => {
    const currentAddress = publicKey?.toString() || null;
    const prevConnection = prevConnectionRef.current;
    
    // Only update if there's an actual change in connection state
    if (connected && publicKey) {
      if (!prevConnection.connected || prevConnection.address !== currentAddress) {
        const newWalletInfo = {
          address: currentAddress,
          balance: 0, // Balance fetching can be implemented if needed
          isConnected: true,
        };

        updateWalletInfo(newWalletInfo);

        // Show authentication success notification only on new connections
        if (!prevConnection.connected) {
          showSuccess(
            'Wallet Connected!',
            'Your Phantom wallet has been connected for authentication.'
          );

          showInfo(
            'Authentication Mode',
            'This wallet is for authentication only. Trading uses secure backend wallets.'
          );
        }
        
        // Update the ref
        prevConnectionRef.current = {
          connected: true,
          address: currentAddress,
        };
      }
    } else if (!connected && prevConnection.connected) {
      // Clear wallet info when disconnected
      updateWalletInfo(null);
      
      // Update the ref
      prevConnectionRef.current = {
        connected: false,
        address: null,
      };
    }
  }, [
    connected,
    publicKey,
    updateWalletInfo,
    showSuccess,
    showInfo,
  ]);

  // Connect to Phantom wallet specifically
  const connectPhantom = useCallback(async () => {
    try {
      const phantomWallet = wallets.find(
        wallet => wallet.adapter.name === 'Phantom'
      );

      if (!phantomWallet) {
        showError(
          'Phantom Not Found',
          'Please install Phantom wallet extension to continue.'
        );
        // Open Phantom installation page
        window.open('https://phantom.app/', '_blank');
        return;
      }

      // Select and connect to Phantom
      select(phantomWallet.adapter.name);
    } catch (error: any) {
      showError('Connection Failed', error.message);
    }
  }, [wallets, select, showError]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      await walletDisconnect();
      updateWalletInfo(null);
      showSuccess('Disconnected', 'Your wallet has been disconnected.');
    } catch (error: any) {
      showError('Disconnect Failed', error.message);
    }
  }, [walletDisconnect, updateWalletInfo, showSuccess, showError]);

  // Get connection status
  const getConnectionStatus = useCallback(() => {
    return {
      isConnected: connected && !!publicKey,
      isConnecting: connecting,
      address: publicKey?.toString() || null,
      shortAddress: publicKey
        ? `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}`
        : null,
    };
  }, [connected, publicKey, connecting]);

  // Check if Phantom is available
  const isPhantomAvailable = useCallback(() => {
    return wallets.some(wallet => wallet.adapter.name === 'Phantom');
  }, [wallets]);

  return {
    // Connection state
    isConnected: connected && !!publicKey,
    isConnecting: connecting,
    address: publicKey?.toString() || null,
    shortAddress: publicKey
      ? `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}`
      : null,

    // Wallet info from store
    walletInfo,
    isWalletConnected,

    // Actions
    connectPhantom,
    disconnect,
    getConnectionStatus,
    isPhantomAvailable,

    // Raw wallet adapter values (if needed)
    publicKey,
    wallets,
    wallet,
    signIn,
  };
};

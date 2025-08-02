'use client';

import React, { useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { WALLET_CONFIG } from '@/lib/constants';
import { clusterApiUrl } from '@solana/web3.js';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletAdapterProviderProps {
  children: React.ReactNode;
}

const WalletAdapterProvider: React.FC<WalletAdapterProviderProps> = ({
  children,
}) => {
  // Network configuration - use environment variable or default to mainnet-beta
  const network = useMemo(() => {
    const networkFromConfig = WALLET_CONFIG.NETWORK;
    if (networkFromConfig === 'devnet') return WalletAdapterNetwork.Devnet;
    if (networkFromConfig === 'testnet') return WalletAdapterNetwork.Testnet;
    return WalletAdapterNetwork.Mainnet;
  }, []);

  // RPC endpoint - use custom or fallback to cluster API
  const endpoint = useMemo(() => {
    // If we have a custom RPC endpoint, use it
    if (
      WALLET_CONFIG.RPC_ENDPOINT &&
      !WALLET_CONFIG.RPC_ENDPOINT.includes('api.mainnet-beta.solana.com')
    ) {
      return WALLET_CONFIG.RPC_ENDPOINT;
    }
    // Otherwise use the cluster API URL
    return clusterApiUrl(network);
  }, [network]);

  // Wallet adapters with SIWS support
  const wallets = useMemo(() => {
    const adapters = [];

    // Always include Phantom - it will show as 'NotDetected' if not installed
    try {
      adapters.push(new PhantomWalletAdapter());
    } catch (error) {
      console.warn('Failed to initialize Phantom wallet adapter:', error);
    }

    // Always include Solflare
    try {
      adapters.push(new SolflareWalletAdapter());
    } catch (error) {
      console.warn('Failed to initialize Solflare wallet adapter:', error);
    }

    return adapters;
  }, [network]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider
        wallets={wallets}
        autoConnect={false}
        onError={error => {
          console.error('Wallet error:', error);
        }}
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default WalletAdapterProvider;

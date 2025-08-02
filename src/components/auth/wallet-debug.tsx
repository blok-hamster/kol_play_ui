'use client';

import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const WalletDebug: React.FC = () => {
  const { wallets, wallet, connected, connecting, publicKey } = useWallet();

  return (
    <Card className="w-full max-w-md mx-auto mt-4">
      <CardHeader>
        <CardTitle className="text-sm">Wallet Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Connection Status:
          </p>
          <div className="flex gap-2">
            <Badge variant={connected ? 'success' : 'secondary'}>
              {connected ? 'Connected' : 'Disconnected'}
            </Badge>
            {connecting && <Badge variant="warning">Connecting...</Badge>}
          </div>
        </div>

        {publicKey && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Public Key:
            </p>
            <p className="text-xs font-mono bg-muted p-2 rounded break-all">
              {publicKey.toString()}
            </p>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Selected Wallet:
          </p>
          <p className="text-xs">
            {wallet ? `${wallet.adapter.name} (${wallet.readyState})` : 'None'}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Available Wallets:
          </p>
          <div className="space-y-1">
            {wallets.map(wallet => (
              <div
                key={wallet.adapter.name}
                className="flex justify-between items-center text-xs"
              >
                <span>{wallet.adapter.name}</span>
                <Badge
                  variant={
                    wallet.readyState === 'Installed' ? 'success' : 'secondary'
                  }
                >
                  {wallet.readyState}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Phantom Detection:
          </p>
          <p className="text-xs">
            {typeof window !== 'undefined' && window.phantom?.solana?.isPhantom
              ? '✅ Phantom detected'
              : '❌ Phantom not detected'}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">
            SIWS Support:
          </p>
          <p className="text-xs">
            {wallet && 'signIn' in wallet.adapter
              ? '✅ Sign-in supported'
              : '❌ Sign-in not supported'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/app-layout';
import { useTokenStore } from '@/stores';
import { SearchTokenResult } from '@/types';
import TokenDetail from '@/components/tokens/token-detail';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TokenDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { getTokenByMint } = useTokenStore();
  const [token, setToken] = useState<SearchTokenResult | null>(null);
  const mint = params.mint as string;

  useEffect(() => {
    if (mint) {
      // Try to get token from cache first
      const cachedToken = getTokenByMint(mint);
      if (cachedToken) {
        setToken(cachedToken);
      } else {
        // If not in cache, redirect back to tokens page
        // In a real app, you might want to fetch from API here
        console.warn(`Token with mint ${mint} not found in cache`);
        router.push('/tokens');
      }
    }
  }, [mint, getTokenByMint, router]);

  const handleBack = () => {
    router.back();
  };

  if (!token) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading token details...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6">
        {/* Back Button */}
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={handleBack}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Tokens</span>
          </Button>
        </div>

        {/* Token Detail Component */}
        <TokenDetail token={token} />
      </div>
    </AppLayout>
  );
}

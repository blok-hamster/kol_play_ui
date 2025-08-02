'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import AppLayout from '@/components/layout/app-layout';
import KOLDetail from '@/components/trading/kol-detail';

interface KOLDetailPageProps {}

const KOLDetailPage: React.FC<KOLDetailPageProps> = () => {
  const params = useParams();
  const address = params.address as string;

  if (!address) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              KOL Not Found
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              The KOL address you're looking for doesn't exist.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6">
        <KOLDetail walletAddress={address} className="w-full" />
      </div>
    </AppLayout>
  );
};

export default KOLDetailPage;

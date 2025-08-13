'use client';

import React from 'react';
import AppLayout from '@/components/layout/app-layout';
import TradingStats from '@/components/portfolio/trading-stats';
import RequireAuth from '@/components/auth/require-auth';

const TradingStatsPage: React.FC = () => {
  return (
    <RequireAuth title="Portfolio Access Required" message="Please sign in to view your portfolio statistics.">
      <AppLayout>
        <div className="p-4 sm:p-6">
          <TradingStats />
        </div>
      </AppLayout>
    </RequireAuth>
  );
};

export default TradingStatsPage;

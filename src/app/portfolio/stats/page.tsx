'use client';

import React from 'react';
import AppLayout from '@/components/layout/app-layout';
import TradingStats from '@/components/portfolio/trading-stats';

const TradingStatsPage: React.FC = () => {
  return (
    <AppLayout>
      <div className="p-6">
        <TradingStats />
      </div>
    </AppLayout>
  );
};

export default TradingStatsPage;

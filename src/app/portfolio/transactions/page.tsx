'use client';

import React from 'react';
import AppLayout from '@/components/layout/app-layout';
import TransactionHistory from '@/components/portfolio/transaction-history';

const TransactionsPage: React.FC = () => {
  return (
    <AppLayout>
      <div className="p-6">
        <TransactionHistory />
      </div>
    </AppLayout>
  );
};

export default TransactionsPage;

'use client';

import React from 'react';
import AppLayout from '@/components/layout/app-layout';
import TransactionHistory from '@/components/portfolio/transaction-history';
import RequireAuth from '@/components/auth/require-auth';

const TransactionsPage: React.FC = () => {
  return (
    <RequireAuth title="Portfolio Access Required" message="Please sign in to view your transaction history.">
      <AppLayout>
        <div className="p-4 sm:p-6">
          <TransactionHistory />
        </div>
      </AppLayout>
    </RequireAuth>
  );
};

export default TransactionsPage;

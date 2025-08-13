'use client';

import React from 'react';
import AppLayout from '@/components/layout/app-layout';
import { useUserStore } from '@/stores/use-user-store';
import SignInPrompt from '@/components/auth/signin-prompt';

interface RequireAuthProps {
  children: React.ReactNode;
  title?: string;
  message?: string;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children, title, message }) => {
  const { isAuthenticated } = useUserStore();

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <SignInPrompt title={title} message={message} />
      </AppLayout>
    );
  }

  return <>{children}</>;
};

export default RequireAuth; 
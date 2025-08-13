'use client';

import React from 'react';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useModal } from '@/stores/use-ui-store';

interface SignInPromptProps {
  title?: string;
  message?: string;
  className?: string;
}

const SignInPrompt: React.FC<SignInPromptProps> = ({
  title = 'Sign In Required',
  message = 'Please sign in to access this page.',
  className,
}) => {
  const { openModal } = useModal();

  return (
    <div className={`min-h-[60vh] flex items-center justify-center ${className || ''}`}>
      <div className="text-center py-16">
        <Wallet className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
        <p className="text-muted-foreground mb-6">{message}</p>
        <Button onClick={() => openModal('auth')} className="text-white" variant="gradient">
          Sign In to Continue
        </Button>
      </div>
    </div>
  );
};

export default SignInPrompt; 
'use client';

import React from 'react';
import AuthModal from '@/components/auth/auth-modal';

/**
 * Wrapper component for AuthModal to manage global state
 * This ensures the modal is always available but only renders when needed
 */
const AuthModalWrapper: React.FC = () => {
  return <AuthModal />;
};

export default AuthModalWrapper;

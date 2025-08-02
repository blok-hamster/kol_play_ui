'use client';

import { useEffect, useCallback } from 'react';
import { useUserStore } from '@/stores/use-user-store';
import { useModal } from '@/stores/use-ui-store';
import { STORAGE_KEYS } from '@/lib/constants';

/**
 * Custom hook to manage the onboarding flow
 * Automatically triggers onboarding for new users after successful authentication
 */
export const useOnboarding = () => {
  const { user, isAuthenticated } = useUserStore();
  const { openModal, isModalOpen } = useModal();

  /**
   * Check if onboarding has been completed
   */
  const isOnboardingCompleted = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED) === 'true';
  }, []);

  /**
   * Mark onboarding as completed
   */
  const completeOnboarding = useCallback((): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
    }
  }, []);

  /**
   * Reset onboarding status (for testing purposes)
   */
  const resetOnboarding = useCallback((): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETED);
    }
  }, []);

  /**
   * Start the onboarding process
   */
  const startOnboarding = useCallback((): void => {
    openModal('onboarding');
  }, [openModal]);

  /**
   * Check if we should show onboarding
   * - User must be authenticated
   * - Onboarding must not be completed
   * - Onboarding modal must not already be open
   */
  const shouldShowOnboarding = useCallback((): boolean => {
    return (
      isAuthenticated &&
      !!user &&
      !isOnboardingCompleted() &&
      !isModalOpen('onboarding') &&
      !isModalOpen('auth') // Don't show onboarding if auth modal is open
    );
  }, [isAuthenticated, user, isOnboardingCompleted, isModalOpen]);

  /**
   * Auto-trigger onboarding for new users
   */
  useEffect(() => {
    // Small delay to ensure all modals are closed and authentication is settled
    const timer = setTimeout(() => {
      if (shouldShowOnboarding()) {
        startOnboarding();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [shouldShowOnboarding, startOnboarding]);

  return {
    // State
    isOnboardingCompleted: isOnboardingCompleted(),
    shouldShowOnboarding: shouldShowOnboarding(),

    // Actions
    startOnboarding,
    completeOnboarding,
    resetOnboarding,
  };
};

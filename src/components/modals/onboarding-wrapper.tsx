'use client';

import React from 'react';
import OnboardingTour from '@/components/onboarding/onboarding-tour';
import { useOnboarding } from '@/hooks/use-onboarding';

/**
 * Wrapper component for OnboardingTour to manage global state and auto-trigger
 * This ensures the onboarding is always available and triggers for new users
 */
const OnboardingWrapper: React.FC = () => {
  // The useOnboarding hook handles auto-triggering the tour
  useOnboarding();

  return <OnboardingTour />;
};

export default OnboardingWrapper;

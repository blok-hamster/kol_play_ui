'use client';

import React from 'react';
import CountdownGate from './countdown-gate';

interface CountdownGateWrapperProps {
  children: React.ReactNode;
}

const CountdownGateWrapper: React.FC<CountdownGateWrapperProps> = ({ children }) => {
  // Check if we should show the countdown gate
  const shouldShowCountdown = React.useMemo(() => {
    const env = process.env.NEXT_PUBLIC_ENV;
    const launchDate = process.env.NEXT_PUBLIC_LAUNCH_DATE;
    
    // Only show countdown if:
    // 1. Environment is production
    // 2. Launch date is set
    // 3. Launch date hasn't elapsed yet
    if (env !== 'production' || !launchDate) {
      return false;
    }
    
    try {
      const launchTime = new Date(launchDate).getTime();
      const currentTime = new Date().getTime();
      return currentTime < launchTime;
    } catch {
      // If date parsing fails, don't show countdown
      return false;
    }
  }, []);

  if (shouldShowCountdown) {
    return <CountdownGate />;
  }

  return <>{children}</>;
};

export default CountdownGateWrapper;
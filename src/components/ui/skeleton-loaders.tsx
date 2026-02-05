'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div
    className={cn(
      'animate-pulse rounded-md bg-muted/50',
      className
    )}
  />
);

export const TradeCardSkeleton: React.FC = () => (
  <div className="group relative overflow-hidden rounded-xl border border-white/5 bg-card/40 p-4 shadow-sm backdrop-blur-md">
    {/* Header: Avatar & Info */}
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center space-x-3 w-full">
        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
        <div className="flex flex-col space-y-2 w-full">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="flex flex-col items-end space-y-2 flex-shrink-0">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>

    {/* Amount Block */}
    <div className="bg-muted/10 rounded-xl p-3 border border-white/5 mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-dashed border-white/5">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-2 w-24" />
          </div>
        </div>
      </div>
    </div>

    {/* Actions */}
    <div className="grid grid-cols-2 gap-2 mt-2">
      <Skeleton className="h-8 rounded-md" />
      <Skeleton className="h-8 rounded-md" />
    </div>
  </div>
);

export const TradeListSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: count }).map((_, index) => (
      <TradeCardSkeleton key={index} />
    ))}
  </div>
);

export const StatsSkeleton: React.FC = () => (
  <div className="flex flex-wrap items-center gap-3 text-xs">
    <div className="flex items-center space-x-1">
      <Skeleton className="h-3 w-3 rounded-full" />
      <Skeleton className="h-3 w-8" />
      <Skeleton className="h-3 w-12" />
    </div>
    <div className="flex items-center space-x-1">
      <Skeleton className="h-3 w-3 rounded-full" />
      <Skeleton className="h-3 w-8" />
      <Skeleton className="h-3 w-16" />
    </div>
    <div className="flex items-center space-x-1">
      <Skeleton className="h-3 w-3 rounded-full" />
      <Skeleton className="h-3 w-8" />
      <Skeleton className="h-3 w-20" />
    </div>
  </div>
);

export const MindmapSkeleton: React.FC = () => (
  <div className="w-full h-[600px] relative overflow-hidden rounded-xl border border-white/5 bg-card/20 backdrop-blur-sm">
    <div className="absolute inset-0 flex items-center justify-center">
      {/* Animated Pulse Ring */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-primary/5 to-transparent animate-pulse delay-700" />

      <div className="relative z-10 flex flex-col items-center justify-center space-y-8">
        {/* Central Hub */}
        <div className="relative">
          <Skeleton className="h-24 w-24 rounded-full border-4 border-card/50" />
          {/* Orbital Nodes */}
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2"
              style={{
                transform: `rotate(${i * 72}deg) translate(120px) rotate(-${i * 72}deg)`
              }}
            >
              <Skeleton className="h-12 w-12 rounded-full border-2 border-card/30" />
            </div>
          ))}
          {/* Connecting Lines (Simulated) */}
          <div className="absolute inset-0 -z-10 animate-spin-slow opacity-20">
            <div className="h-full w-full rounded-full border border-dashed border-primary/30 scale-150" />
          </div>
        </div>

        <div className="space-y-3 text-center">
          <Skeleton className="h-6 w-48 mx-auto rounded-full" />
          <Skeleton className="h-4 w-64 mx-auto rounded-full opacity-60" />
        </div>
      </div>
    </div>
  </div>
);

export const HeaderSkeleton: React.FC = () => (
  <div className="rounded-xl border border-white/5 bg-card/40 p-6 backdrop-blur-md">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="w-2 h-2 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      <StatsSkeleton />

      <div className="flex items-center space-x-3">
        <div className="flex items-center bg-muted/20 rounded-lg p-1">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md ml-1" />
        </div>
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  </div>
);

export const ProgressiveLoadingIndicator: React.FC<{
  phase: 'essential' | 'enhanced' | 'background';
  isComplete: boolean;
  hasError: boolean;
}> = ({ phase, isComplete, hasError }) => {
  const getPhaseLabel = () => {
    switch (phase) {
      case 'essential':
        return 'Loading essential data...';
      case 'enhanced':
        return 'Loading network data...';
      case 'background':
        return 'Loading additional data...';
    }
  };

  const getPhaseColor = () => {
    if (hasError) return 'text-red-500';
    if (isComplete) return 'text-green-500';
    return 'text-blue-500';
  };

  return (
    <div className="flex items-center space-x-2 text-sm">
      <div className={cn(
        'w-2 h-2 rounded-full',
        hasError ? 'bg-red-500' : isComplete ? 'bg-green-500' : 'bg-blue-500 animate-pulse'
      )} />
      <span className={getPhaseColor()}>
        {getPhaseLabel()}
      </span>
    </div>
  );
};
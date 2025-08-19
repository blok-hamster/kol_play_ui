'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  <Card className="w-full">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="text-right space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex justify-between items-center">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex justify-between items-center">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </CardContent>
  </Card>
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
  <div className="w-full h-96 relative">
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="space-y-4 text-center">
        <div className="relative">
          {/* Central node */}
          <Skeleton className="h-16 w-16 rounded-full mx-auto" />
          
          {/* Surrounding nodes */}
          <div className="absolute -top-8 -left-8">
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="absolute -top-8 -right-8">
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="absolute -bottom-8 -left-8">
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="absolute -bottom-8 -right-8">
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          
          {/* Connection lines */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <Skeleton className="h-0.5 w-16 absolute -rotate-45 -translate-x-8 -translate-y-8" />
            <Skeleton className="h-0.5 w-16 absolute rotate-45 translate-x-8 -translate-y-8" />
            <Skeleton className="h-0.5 w-16 absolute -rotate-45 translate-x-8 translate-y-8" />
            <Skeleton className="h-0.5 w-16 absolute rotate-45 -translate-x-8 translate-y-8" />
          </div>
        </div>
        
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-3 w-48 mx-auto" />
        </div>
      </div>
    </div>
  </div>
);

export const HeaderSkeleton: React.FC = () => (
  <Card>
    <CardHeader className="pb-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton className="w-2 h-2 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        <StatsSkeleton />

        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-muted rounded-lg p-1">
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md ml-1" />
          </div>
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
    </CardHeader>
  </Card>
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
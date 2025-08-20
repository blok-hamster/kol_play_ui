'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton-loaders';

export const TokenModalHeaderSkeleton = () => (
  <div className="flex items-start justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
    <div className="flex items-start space-x-3 sm:space-x-4 flex-1 min-w-0">
      {/* Token Logo Skeleton */}
      <Skeleton className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex-shrink-0" />
      
      <div className="min-w-0 flex-1">
        <div className="flex items-start space-x-2 sm:space-x-3">
          <Skeleton className="h-6 sm:h-8 w-32 sm:w-48" />
          <Skeleton className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex-shrink-0" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-2">
          <Skeleton className="h-4 sm:h-5 w-16 sm:w-24" />
          <Skeleton className="h-3 sm:h-4 w-24 sm:w-32" />
          <Skeleton className="w-4 h-4 rounded" />
        </div>
      </div>
    </div>
    <Skeleton className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex-shrink-0 ml-2" />
  </div>
);

export const TokenModalChartSkeleton = () => (
  <div className="bg-muted/30 border border-border rounded-xl overflow-hidden">
    <div className="p-4 sm:p-6 pb-0">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-6 sm:h-7 w-24 sm:w-32" />
        <div className="flex items-center space-x-2">
          <Skeleton className="w-2 h-2 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
    <div className="w-full" style={{ minHeight: 420 }}>
      <div className="h-[420px] flex flex-col items-center justify-center p-6 space-y-4">
        <Skeleton className="h-64 w-full rounded-lg" />
        <div className="flex justify-between w-full">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  </div>
);

export const TokenModalStatsSkeleton = () => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
    {Array.from({ length: 4 }).map((_, index) => (
      <div key={index} className="bg-muted/30 border border-border rounded-xl p-4">
        <div className="text-center space-y-2">
          <Skeleton className="h-6 w-6 sm:h-8 sm:w-8 mx-auto rounded" />
          <Skeleton className="h-5 sm:h-6 w-16 sm:w-20 mx-auto" />
          <Skeleton className="h-3 w-12 sm:w-16 mx-auto" />
        </div>
      </div>
    ))}
  </div>
);

export const TokenModalPerformanceSkeleton = () => (
  <div className="bg-muted/30 border border-border rounded-xl p-4 sm:p-6">
    <div className="flex items-center mb-4">
      <Skeleton className="w-4 h-4 sm:w-5 sm:h-5 mr-2 rounded" />
      <Skeleton className="h-6 sm:h-7 w-32 sm:w-40" />
    </div>
    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="text-center space-y-2">
          <Skeleton className="h-3 w-8 mx-auto" />
          <Skeleton className="h-4 sm:h-5 w-12 sm:w-16 mx-auto" />
        </div>
      ))}
    </div>
  </div>
);

export const TokenModalTradingActivitySkeleton = () => (
  <div className="bg-muted/30 border border-border rounded-xl p-4 sm:p-6">
    <Skeleton className="h-6 sm:h-7 w-32 sm:w-40 mb-4" />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="text-center space-y-2">
          <Skeleton className="h-6 sm:h-8 w-16 sm:w-20 mx-auto" />
          <Skeleton className="h-3 w-12 sm:w-16 mx-auto" />
        </div>
      ))}
    </div>
  </div>
);

export const TokenModalSecuritySkeleton = () => (
  <div className="bg-muted/30 border border-border rounded-xl p-4 sm:p-6">
    <div className="flex items-center mb-4">
      <Skeleton className="w-4 h-4 sm:w-5 sm:h-5 mr-2 rounded" />
      <Skeleton className="h-6 sm:h-7 w-40 sm:w-48" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between">
            <Skeleton className="h-4 w-24 sm:w-32" />
            <Skeleton className="h-6 w-12 sm:w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  </div>
);

export const TokenModalFullSkeleton = () => (
  <div className="fixed inset-2 sm:inset-4 md:inset-8 lg:inset-16 xl:inset-24 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-[100] overflow-hidden flex flex-col max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)]">
    {/* Header Skeleton */}
    <TokenModalHeaderSkeleton />
    
    {/* Content Skeleton */}
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Chart Skeleton */}
      <TokenModalChartSkeleton />
      
      {/* Stats Skeleton */}
      <TokenModalStatsSkeleton />
      
      {/* Performance Skeleton */}
      <TokenModalPerformanceSkeleton />
      
      {/* Trading Activity Skeleton */}
      <TokenModalTradingActivitySkeleton />
      
      {/* Security Skeleton */}
      <TokenModalSecuritySkeleton />
    </div>
  </div>
);
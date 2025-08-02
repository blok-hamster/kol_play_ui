'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  tabListClassName?: string;
  tabClassName?: string;
  activeTabClassName?: string;
  contentClassName?: string;
}

const Tabs: React.FC<TabsProps> = ({
  items,
  activeTab,
  onTabChange,
  className,
  tabListClassName,
  tabClassName,
  activeTabClassName,
  contentClassName,
}) => {
  const activeItem = items.find(item => item.id === activeTab);

  return (
    <div className={cn('w-full', className)}>
      {/* Tab List */}
      <div
        className={cn(
          'flex space-x-1 rounded-lg bg-muted p-1',
          tabListClassName
        )}
        role="tablist"
      >
        {items.map(item => (
          <button
            key={item.id}
            className={cn(
              'w-full rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              activeTab === item.id
                ? cn(
                    'bg-background text-foreground shadow-sm',
                    activeTabClassName
                  )
                : cn(
                    'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                    tabClassName
                  )
            )}
            onClick={() => onTabChange(item.id)}
            role="tab"
            aria-selected={activeTab === item.id}
            aria-controls={`tabpanel-${item.id}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div
        className={cn('mt-4', contentClassName)}
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeItem?.content}
      </div>
    </div>
  );
};

export { Tabs };

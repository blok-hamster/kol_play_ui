'use client';

import React from 'react';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import Header from './header';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { theme } = useTheme();

  return (
    <div
      className={cn(
        'min-h-screen bg-background text-foreground transition-colors duration-200 relative',
        theme
      )}
    >
      {/* Grid Background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.35] dark:opacity-[0.2]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(156, 163, 175, 0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(156, 163, 175, 0.6) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* App Content */}
      <div className="relative z-10">
        {/* Skip to main content for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
        >
          Skip to main content
        </a>

        <div className="flex flex-col min-h-screen">
          {/* Header with Navigation */}
          <Header />

          {/* Main content */}
          <main
            id="main-content"
            className="flex-1 focus:outline-none pt-20 lg:pt-32"
          >
            <div className="h-full">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;

'use client';

import React from 'react';
import AppLayout from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { useModal } from '@/stores/use-ui-store';
import { useUserStore } from '@/stores/use-user-store';
import PredictTradeInput from '@/components/features/predict-trade-input';
import KOLList from '@/components/trading/kol-list';
import LiveTradesFeed from '@/components/trading/live-trades-feed';
import RotatingSubheader from '../components/features/rotating-subheader';
import { LayoutGrid, List as ListIcon } from 'lucide-react';
import { CompactLiveTrades } from '@/components/trading/compact-live-trades';
import { useNotifications } from '@/stores/use-ui-store';
import { useSearchParams } from 'next/navigation';
import { AuthQueueStatus } from '@/components/auth/auth-queue-status';

const HomePage: React.FC = () => {
  const { openModal } = useModal();
  const { isAuthenticated, user } = useUserStore();
  const { showInfo } = useNotifications();
  const searchParams = useSearchParams();
  const [isKOLsExpanded, setIsKOLsExpanded] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [kolViewMode, setKolViewMode] = React.useState<'grid' | 'list'>('grid');

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    // Prefer list on mobile for denser info
    if (mql.matches) setKolViewMode('list');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // If redirected here for sign-in, open modal and show message
  React.useEffect(() => {
    const shouldPromptSignin = searchParams?.get('signin') === '1';
    if (shouldPromptSignin) {
      openModal('auth');
      showInfo('Please sign in', 'Sign in to access this page.');
    }
  }, [searchParams, openModal, showInfo]);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      // Navigate to portfolio or main app
      void 0 && ('Navigate to portfolio');
    } else {
      openModal('auth');
    }
  };

  // Removed tour handler and tour button from hero

  return (
    <AppLayout>
      <div className="min-h-full">
        {/* Hero Section */}
        <div className="relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-14">
            <div className="text-center">
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
                <span className="block bg-accent-gradient bg-clip-text text-transparent">Machine Learning Powered</span>
                <span className="block">Solana Copy Trading</span>
              </h1>
              {/* Rotating subheader */}
              <RotatingSubheader className="mb-6 md:mb-8" />

              {/* Removed hero CTA button as requested */}
              {/* Removed authenticated status hint */}
            </div>
          </div>
        </div>

        {/* Prediction Section */}
        <section className="py-6 md:py-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="mb-2 md:mb-3 text-sm md:text-base text-muted-foreground/90">
              Experimental feature: ML predictions are a work in progress and may be inaccurate.
            </p>
            <PredictTradeInput />
            <CompactLiveTrades className="mt-3" limit={24} defaultExpanded={false} />
          </div>
        </section>

        {/* Featured KOLs with Live Trades */}
        <section className="py-10 md:py-16 bg-muted/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3 mb-4 md:mb-6">
              <h2 className="text-2xl md:text-4xl font-bold text-foreground">Featured KOLs</h2>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center rounded-lg border border-border p-1 bg-background">
                  <Button
                    size="sm"
                    variant={kolViewMode === 'grid' ? 'default' : 'ghost'}
                    onClick={() => setKolViewMode('grid')}
                    aria-pressed={kolViewMode === 'grid'}
                    className="h-8 px-2"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={kolViewMode === 'list' ? 'default' : 'ghost'}
                    onClick={() => setKolViewMode('list')}
                    aria-pressed={kolViewMode === 'list'}
                    className="h-8 px-2"
                  >
                    <ListIcon className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsKOLsExpanded(prev => !prev)}
                  aria-expanded={isKOLsExpanded}
                >
                  {isKOLsExpanded ? 'Collapse' : 'Expand'}
                </Button>
              </div>
            </div>
            <div className={`${isKOLsExpanded ? 'max-h-none' : 'max-h-[55vh] md:max-h-[60vh]'} overflow-y-auto pr-1 bg-background border border-border rounded-xl p-3 md:p-4 shadow-sm`}>
              <KOLList showHeader={false} compactMode={isMobile} viewMode={kolViewMode} />
            </div>

            <div className="mt-10 md:mt-12">
              <LiveTradesFeed showHeader={false} limit={isMobile ? 15 : 30} hideEmptyState hideStatus compactMode={isMobile} />
            </div>
          </div>
        </section>
        {/* Removed Features and Stats sections as requested */}

        {/* CTA Section */}
        <div className="py-16 md:py-20 bg-gradient-to-br from-accent-from/10 to-accent-to/10">
          <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3 md:mb-4">
              Ready to Start Copy Trading?
            </h2>
            <p className="text-base md:text-lg text-muted-foreground mb-6 md:mb-8">
              Join thousands of traders already using KOL Play to maximize their
              Solana DeFi profits.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
              <Button
                size="lg"
                variant="gradient"
                onClick={handleGetStarted}
                className="text-base md:text-lg px-7 md:px-8 py-4 text-white"
              >
                Start Trading Now
              </Button>

              <Button
                size="lg"
                variant="outline"
                onClick={() => window.open('/kol-trades', '_self')}
                className="text-base md:text-lg px-7 md:px-8 py-4"
              >
                View Live Trades
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Auth Queue Status - shows during authentication */}
      <AuthQueueStatus />
    </AppLayout>
  );
};

export default HomePage;

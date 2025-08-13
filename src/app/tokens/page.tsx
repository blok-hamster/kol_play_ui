'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/app-layout';
import TokenList from '@/components/tokens/token-list';
import { TrendingUp, DollarSign, Clock } from 'lucide-react';

interface CategoryTab {
  id: 'trending' | 'volume' | 'latest';
  label: string;
  icon: React.ReactNode;
  description: string;
}

export default function TokensPage() {
  const [activeCategory, setActiveCategory] = useState<
    'trending' | 'volume' | 'latest'
  >('trending');

  // Treat controls as regular buttons on mobile (no tab semantics)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const categories: CategoryTab[] = [
    {
      id: 'trending',
      label: 'Trending',
      icon: <TrendingUp className="w-5 h-5" />,
      description:
        'Most popular tokens with growing interest and trading activity',
    },
    {
      id: 'volume',
      label: 'High Volume',
      icon: <DollarSign className="w-5 h-5" />,
      description:
        'Tokens with the highest trading volume and liquidity in the market',
    },
    {
      id: 'latest',
      label: 'Latest',
      icon: <Clock className="w-5 h-5" />,
      description:
        'Newly launched tokens and latest additions to the Solana ecosystem',
    },
  ];

  const handleCategoryClick = (
    categoryId: 'trending' | 'volume' | 'latest'
  ) => {
    setActiveCategory(categoryId);
  };

  const activeTab = categories.find(cat => cat.id === activeCategory)!;

  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <h1 className="sr-only">Tokens</h1>

        {/* Category Selection */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8"
          role={isMobile ? undefined : 'tablist'}
          aria-label={isMobile ? undefined : 'Token categories'}
        >
          {categories.map(category => (
            <button
              key={category.id}
              id={`tab-${category.id}`}
              className={`
                w-full text-left p-3 sm:p-4 md:min-h-[56px] rounded-lg border md:border-2 transition-all duration-200
                ${
                  activeCategory === category.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground bg-background'
                }
                focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background
              `}
              onClick={() => handleCategoryClick(category.id)}
              role={isMobile ? undefined : 'tab'}
              aria-selected={isMobile ? undefined : activeCategory === category.id}
              tabIndex={0}
              title={`${category.label} tokens`}
              type="button"
              aria-controls={isMobile ? undefined : 'category-panel'}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`
                  p-2 rounded-lg
                  ${
                    activeCategory === category.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }
                `}
                >
                  {category.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-base md:text-lg">
                    {category.label}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {category.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Active Category Display */}
        <div className="bg-background rounded-lg border border-border">
          {/* Category Header */}
          <div className="px-4 py-3 md:px-6 md:py-4 border-b border-border">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                {activeTab.icon}
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-foreground">
                  {activeTab.label} Tokens
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {activeTab.description}
                </p>
              </div>
            </div>
          </div>

          {/* Token List Content */}
          <div
            className="p-4 md:p-6"
            role={isMobile ? undefined : 'tabpanel'}
            id={isMobile ? undefined : 'category-panel'}
            aria-labelledby={isMobile ? undefined : `tab-${activeCategory}`}
          >
            <TokenList
              category={activeCategory}
              title=""
              limit={50}
              showFilters={true}
              timeframe={activeCategory === 'latest' ? '7d' : '24h'}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

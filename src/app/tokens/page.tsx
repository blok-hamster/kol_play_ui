'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/app-layout';
import TokenList from '@/components/tokens/token-list';
import { TrendingUp, DollarSign, Clock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CategoryTab {
  id: 'trending' | 'volume' | 'latest';
  label: string;
  icon: React.ReactNode;
  description: string;
}

export default function TokensPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<
    'trending' | 'volume' | 'latest'
  >('trending');

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
      <div className="p-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Token Discovery
            </h1>
            <p className="text-muted-foreground mt-2">
              Explore trending tokens, high volume movers, and the latest
              launches on Solana
            </p>
          </div>

          <Button
            onClick={() => router.push('/tokens/search')}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <Search className="w-4 h-4" />
            <span>Advanced Search</span>
          </Button>
        </div>

        {/* Category Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {categories.map(category => (
            <button
              key={category.id}
              className={`
                text-left p-4 rounded-lg border-2 transition-all duration-200
                ${
                  activeCategory === category.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground bg-background'
                }
              `}
              onClick={() => handleCategoryClick(category.id)}
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
                  <h3 className="font-semibold text-foreground">
                    {category.label}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
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
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                {activeTab.icon}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {activeTab.label} Tokens
                </h2>
                <p className="text-sm text-muted-foreground">
                  {activeTab.description}
                </p>
              </div>
            </div>
          </div>

          {/* Token List Content */}
          <div className="p-6">
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

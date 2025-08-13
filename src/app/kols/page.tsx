'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/layout/app-layout';
import KOLList from '@/components/trading/kol-list';
import TopTraders from '@/components/trading/top-traders';
import AddCustomKOLModal from '@/components/trading/add-custom-kol-modal';
import { Award, Users, Plus, LayoutGrid, List as ListIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RequireAuth from '@/components/auth/require-auth';

console.log('🧪 KOLs page loaded - testing console logging');

interface CategoryTab {
  id: 'featured' | 'top-traders';
  label: string;
  icon: React.ReactNode;
  description: string;
}

const KOLsPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<
    'featured' | 'top-traders'
  >('featured');
  const [isAddCustomKOLModalOpen, setIsAddCustomKOLModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const categories: CategoryTab[] = [
    {
      id: 'featured',
      label: 'Featured KOLs',
      icon: <Users className="w-5 h-5" />,
      description:
        'Copy trades from verified Key Opinion Leaders with proven track records',
    },
    {
      id: 'top-traders',
      label: 'Top Traders',
      icon: <Award className="w-5 h-5" />,
      description:
        'Highest performing traders ranked by total PnL and win rate',
    },
  ];

  const handleCategoryClick = (categoryId: 'featured' | 'top-traders') => {
    setActiveCategory(categoryId);
  };

  const activeTab = categories.find(cat => cat.id === activeCategory)!;

  return (
    <RequireAuth title="Sign In Required" message="Please sign in to view KOLs and start copying trades.">
      <AppLayout>
      <div className="p-6">
        {/* Category Tabs + Action (mobile-optimized) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="w-full sm:w-auto">
            <div className="flex flex-wrap gap-2 bg-muted/30 p-1 rounded-lg">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    activeCategory === category.id
                      ? 'bg-background text-foreground shadow-sm border border-border'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {category.icon}
                  <span>{category.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center bg-muted rounded-lg p-1 w-full sm:w-auto">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-1 ${
                  viewMode === 'grid'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-1 ${
                  viewMode === 'list'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label="List view"
              >
                <ListIcon className="w-4 h-4" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
            <Button
              className="w-full sm:w-auto justify-center flex items-center space-x-2"
              onClick={() => setIsAddCustomKOLModalOpen(true)}
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom KOL</span>
            </Button>
          </div>
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
                  {activeTab.label}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {activeTab.description}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {activeCategory === 'featured' ? (
              <KOLList
                showHeader={false}
                compactMode={false}
                viewMode={viewMode}
                className="space-y-4"
              />
            ) : (
              <TopTraders limit={50} title="" />
            )}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-8">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              KOL marketplace is live! Start following top traders.
            </span>
          </div>
        </div>
      </div>
      <AddCustomKOLModal
        isOpen={isAddCustomKOLModalOpen}
        onClose={() => setIsAddCustomKOLModalOpen(false)}
      />
      </AppLayout>
    </RequireAuth>
  );
};

export default KOLsPage;

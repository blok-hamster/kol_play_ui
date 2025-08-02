'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/layout/app-layout';
import KOLList from '@/components/trading/kol-list';
import TopTraders from '@/components/trading/top-traders';
import AddCustomKOLModal from '@/components/trading/add-custom-kol-modal';
import { TrendingUp, Award, Users, Plus } from 'lucide-react';
import { useModal } from '@/stores/use-ui-store';
import { Button } from '@/components/ui/button';

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
    <AppLayout>
      <div className="p-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <TrendingUp className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">
                KOL Marketplace
              </h1>
            </div>
            <p className="text-muted-foreground">
              Discover and copy trade from top-performing traders and verified
              KOLs
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              className="flex items-center space-x-2"
              onClick={() => setIsAddCustomKOLModalOpen(true)}
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom KOL</span>
            </Button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center space-x-1 mb-6 bg-muted/30 p-1 rounded-lg">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
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
  );
};

export default KOLsPage;

'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/layout/app-layout';
import KOLList from '@/components/trading/kol-list';
import TopTraders from '@/components/trading/top-traders';
import FeaturedKols from '@/components/trading/featured-kols';
import AddCustomKOLModal from '@/components/trading/add-custom-kol-modal';
import { Award, Users, Plus, LayoutGrid, List as ListIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RequireAuth from '@/components/auth/require-auth';

void 0 && ('🧪 KOLs page loaded - testing console logging');

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const KOLsPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'featured' | 'top-traders'>('featured');
  const [isAddCustomKOLModalOpen, setIsAddCustomKOLModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  return (
    <RequireAuth title="Sign In Required" message="Please sign in to view KOLs and start copying trades.">
      <AppLayout>
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <FeaturedKols />

          {/* Main Tabs + Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Tabs
              value={activeCategory}
              onValueChange={(v) => setActiveCategory(v as any)}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid w-full grid-cols-2 sm:flex sm:w-auto bg-muted/30 p-1 rounded-xl h-auto border border-border/50">
                <TabsTrigger
                  value="featured"
                  className="py-2.5 px-4 sm:px-8 text-[9px] sm:text-xs font-bold uppercase tracking-widest gap-2"
                >
                  <Users className="w-3.5 h-3.5" /> Featured
                </TabsTrigger>
                <TabsTrigger
                  value="top-traders"
                  className="py-2.5 px-4 sm:px-8 text-[9px] sm:text-xs font-bold uppercase tracking-widest gap-2"
                >
                  <Award className="w-3.5 h-3.5" /> Top Traders
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-muted/30 border border-border/50 rounded-xl p-1 shrink-0">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                    }`}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                    }`}
                  aria-label="List view"
                >
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>

              <Button
                className="flex-1 sm:flex-none justify-center flex items-center space-x-2 rounded-xl h-10 px-4"
                onClick={() => setIsAddCustomKOLModalOpen(true)}
              >
                <Plus className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Add KOL</span>
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className="min-h-[400px]">
            {activeCategory === 'featured' ? (
              <KOLList
                showHeader={false}
                compactMode={false}
                viewMode={viewMode}
                className="space-y-4"
              />
            ) : (
              <TopTraders limit={50} compactMode={true} />
            )}
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

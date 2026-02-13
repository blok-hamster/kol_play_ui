'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/app-layout';
import TokenList from '@/components/tokens/token-list';
import RequireAuth from '@/components/auth/require-auth';
import { Rocket, BarChart3, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TokensPage() {
  const [category, setCategory] = useState<'trending' | 'volume' | 'latest'>(
    'trending'
  );

  return (
    <RequireAuth title="Sign In Required" message="Please sign in to explore tokens and trade.">
      <AppLayout>
        <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
          {/* Categories Navigation */}
          <Tabs defaultValue="trending" value={category} onValueChange={(v) => setCategory(v as any)} className="w-full">
            {/* Mobile Tabs (Same design as AFK page) */}
            <div className="sm:hidden -mx-2">
              <TabsList className="grid w-full grid-cols-3 bg-muted/30 p-1 rounded-xl h-auto border border-border/50 mb-6">
                <TabsTrigger value="trending" className="py-2.5 text-[9px] font-bold uppercase tracking-widest gap-2">
                  <Rocket className="w-3.5 h-3.5" /> Trending
                </TabsTrigger>
                <TabsTrigger value="volume" className="py-2.5 text-[9px] font-bold uppercase tracking-widest gap-2">
                  <BarChart3 className="w-3.5 h-3.5" /> Volume
                </TabsTrigger>
                <TabsTrigger value="latest" className="py-2.5 text-[9px] font-bold uppercase tracking-widest gap-2">
                  <Clock className="w-3.5 h-3.5" /> Latest
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Desktop Grid (Hidden on smallest screens) */}
            <div
              className="hidden sm:grid grid-cols-2 md:grid-cols-3 gap-4 mb-8"
              role="tablist"
            >
              {[
                { id: 'trending', label: 'Trending', icon: Rocket, color: 'text-orange-500', desc: 'Fastest growing' },
                { id: 'volume', label: 'High Volume', icon: BarChart3, color: 'text-blue-500', desc: 'Most traded' },
                { id: 'latest', label: 'Latest', icon: Clock, color: 'text-green-500', desc: 'Newly listed' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  role="tab"
                  aria-selected={category === cat.id}
                  onClick={() => setCategory(cat.id as any)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-300 text-left group
                    ${category === cat.id
                      ? 'border-primary bg-primary/5 shadow-lg shadow-primary/5'
                      : 'border-border/50 bg-card hover:border-border hover:bg-muted/30'
                    }`}
                >
                  <div className={`p-2 rounded-lg ${category === cat.id ? 'bg-primary/10' : 'bg-muted'} group-hover:scale-110 transition-transform`}>
                    <cat.icon className={`w-5 h-5 ${cat.color}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base uppercase tracking-tight">{cat.label}</h3>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground opacity-60 tracking-widest">{cat.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Token List Content */}
            <TabsContent value={category} className="focus-visible:outline-none focus:outline-none ring-0 border-none m-0 p-0">
              <TokenList category={category} />
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    </RequireAuth>
  );
}

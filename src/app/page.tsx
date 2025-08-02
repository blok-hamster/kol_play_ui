'use client';

import React from 'react';
import AppLayout from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { useModal } from '@/stores/use-ui-store';
import { useUserStore } from '@/stores/use-user-store';
import {
  TrendingUp,
  Search,
  ArrowRightLeft,
  PieChart,
  MessageCircle,
  Shield,
} from 'lucide-react';

const HomePage: React.FC = () => {
  const { openModal } = useModal();
  const { isAuthenticated, user } = useUserStore();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      // Navigate to portfolio or main app
      console.log('Navigate to portfolio');
    } else {
      openModal('auth');
    }
  };

  const handleTakeTour = () => {
    openModal('onboarding');
  };

  return (
    <AppLayout>
      <div className="min-h-full">
        {/* Hero Section */}
        <div className="relative bg-gradient-to-br from-background via-background to-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="text-center">
              <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
                The Ultimate{' '}
                <span className="bg-accent-gradient bg-clip-text text-transparent">
                  Solana
                </span>{' '}
                Copy Trading Platform
              </h1>

              <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
                Follow top KOLs, copy their trades automatically, and maximize
                your DeFi profits on Solana. Advanced trading tools, real-time
                analytics, and AI-powered insights.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  variant="gradient"
                  onClick={handleGetStarted}
                  className="text-lg px-8 py-4 text-white"
                >
                  {isAuthenticated
                    ? `Welcome Back, ${user?.firstName}`
                    : 'Get Started Free'}
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleTakeTour}
                  className="text-lg px-8 py-4"
                >
                  Take Platform Tour
                </Button>
              </div>

              {isAuthenticated && (
                <p className="text-sm text-muted-foreground mt-4">
                  Your trading wallet and AI assistant are ready!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="py-20 bg-muted/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Powerful Trading Features
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need to succeed in Solana DeFi trading, powered
                by cutting-edge technology.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* KOL Copy Trading */}
              <div className="bg-background rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-accent-gradient rounded-lg flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  KOL Copy Trading
                </h3>
                <p className="text-muted-foreground">
                  Follow successful traders and automatically copy their
                  positions with customizable risk settings.
                </p>
              </div>

              {/* Token Discovery */}
              <div className="bg-background rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-4">
                  <Search className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Token Discovery
                </h3>
                <p className="text-muted-foreground">
                  Find trending tokens, volume leaders, and new launches with
                  advanced filtering and analytics.
                </p>
              </div>

              {/* Advanced Swap */}
              <div className="bg-background rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mb-4">
                  <ArrowRightLeft className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Advanced Swap
                </h3>
                <p className="text-muted-foreground">
                  Swap SOL for tokens with take-profit, stop-loss, and real-time
                  price charts.
                </p>
              </div>

              {/* Portfolio Analytics */}
              <div className="bg-background rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-4">
                  <PieChart className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Portfolio Analytics
                </h3>
                <p className="text-muted-foreground">
                  Track your P&L, transaction history, and performance metrics
                  with detailed insights.
                </p>
              </div>

              {/* AI Assistant */}
              <div className="bg-background rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mb-4">
                  <MessageCircle className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  AI Trading Assistant
                </h3>
                <p className="text-muted-foreground">
                  Get personalized trading insights and portfolio analysis from
                  your AI assistant.
                </p>
              </div>

              {/* Security */}
              <div className="bg-background rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Bank-Grade Security
                </h3>
                <p className="text-muted-foreground">
                  Your funds are protected with enterprise-level security and
                  non-custodial architecture.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                  $50M+
                </div>
                <div className="text-muted-foreground">Total Volume Traded</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                  25K+
                </div>
                <div className="text-muted-foreground">Active Traders</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                  150+
                </div>
                <div className="text-muted-foreground">Top KOLs</div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-20 bg-gradient-to-br from-accent-from/10 to-accent-to/10">
          <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ready to Start Copy Trading?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of traders already using KOL Play to maximize their
              Solana DeFi profits.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                variant="gradient"
                onClick={handleGetStarted}
                className="text-lg px-8 py-4 text-white"
              >
                Start Trading Now
              </Button>

              <Button
                size="lg"
                variant="outline"
                onClick={() => window.open('/demo', '_blank')}
                className="text-lg px-8 py-4"
              >
                View Demo
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default HomePage;

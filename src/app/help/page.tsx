'use client';

import React from 'react';
import AppLayout from '@/components/layout/app-layout';
import {
  HelpCircle,
  MessageCircle,
  Mail,
  ExternalLink,
  BookOpen,
  Video,
  Users,
  Zap,
  Search,
  PieChart,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useModal } from '@/stores/use-ui-store';

const HelpPage: React.FC = () => {
  const { openModal } = useModal();

  const handleTakeTour = () => {
    openModal('onboarding');
  };

  const faqItems = [
    {
      question: 'How does copy trading work?',
      answer: 'Copy trading allows you to automatically replicate the trades of successful KOLs (Key Opinion Leaders). When a KOL you follow makes a trade, our system can automatically execute the same trade in your account based on your configured settings.',
    },
    {
      question: 'What fees do you charge?',
      answer: 'We charge a 0.25% platform fee on each trade, plus standard Solana network fees. There are no subscription fees or hidden charges.',
    },
    {
      question: 'How do I choose which KOLs to follow?',
      answer: 'You can browse KOLs on our platform, view their performance history, win rates, and trading strategies. Look for consistent performers with good risk management.',
    },
    {
      question: 'Can I set limits on my copy trades?',
      answer: 'Yes! You can set minimum and maximum trade amounts, stop-loss percentages, take-profit targets, and even pause copying at any time.',
    },
    {
      question: 'Is my wallet secure?',
      answer: 'We use industry-standard security practices. Your private keys never leave your device, and we support hardware wallets for maximum security.',
    },
    {
      question: 'How do I withdraw my funds?',
      answer: 'Your funds remain in your Solana wallet at all times. You can withdraw or transfer them using any standard Solana wallet interface.',
    },
  ];

  const quickActions = [
    {
      title: 'Take Platform Tour',
      description: 'Get a guided walkthrough of all features',
      icon: Zap,
      action: handleTakeTour,
      color: 'bg-blue-500',
    },
    {
      title: 'Browse KOLs',
      description: 'Find traders to copy',
      icon: Users,
      action: () => window.open('/kols', '_self'),
      color: 'bg-green-500',
    },
    {
      title: 'Live Trades',
      description: 'Watch real-time KOL trades & network maps',
      icon: TrendingUp,
      action: () => window.open('/kol-trades-demo', '_self'),
      color: 'bg-red-500',
    },
    {
      title: 'Discover Tokens',
      description: 'Search and analyze tokens',
      icon: Search,
      action: () => window.open('/tokens', '_self'),
      color: 'bg-purple-500',
    },
    {
      title: 'View Portfolio',
      description: 'Track your performance',
      icon: PieChart,
      action: () => window.open('/portfolio', '_self'),
      color: 'bg-orange-500',
    },
  ];

  const resources = [
    {
      title: 'Getting Started Guide',
      description: 'Complete beginner\'s guide to copy trading',
      icon: BookOpen,
      href: '#',
    },
    {
      title: 'Video Tutorials',
      description: 'Watch step-by-step tutorials',
      icon: Video,
      href: '#',
    },
    {
      title: 'Trading Strategies',
      description: 'Learn advanced trading concepts',
      icon: Search,
      href: '#',
    },
    {
      title: 'Security Best Practices',
      description: 'Keep your funds safe',
      icon: Shield,
      href: '#',
    },
  ];

  return (
    <AppLayout>
      <div className="p-6">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <HelpCircle className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Help & Support</h1>
          </div>
          <p className="text-muted-foreground">
            Get help, learn how to use the platform, and find answers to common questions
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Actions */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quickActions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={index}
                      onClick={action.action}
                      className="flex items-start space-x-4 p-4 bg-muted/30 border border-border rounded-lg hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className={`p-2 rounded-lg ${action.color} text-white`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{action.title}</h3>
                        <p className="text-sm text-muted-foreground">{action.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* FAQ Section */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4">Frequently Asked Questions</h2>
              <div className="space-y-4">
                {faqItems.map((item, index) => (
                  <div
                    key={index}
                    className="bg-muted/30 border border-border rounded-lg p-4"
                  >
                    <h3 className="font-medium text-foreground mb-2">{item.question}</h3>
                    <p className="text-sm text-muted-foreground">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Resources */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4">Learning Resources</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resources.map((resource, index) => {
                  const Icon = resource.icon;
                  return (
                    <a
                      key={index}
                      href={resource.href}
                      className="flex items-start space-x-4 p-4 bg-muted/30 border border-border rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-foreground group-hover:text-primary">
                            {resource.title}
                          </h3>
                          <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <p className="text-sm text-muted-foreground">{resource.description}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Support */}
            <div className="bg-muted/30 border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Need More Help?</h3>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.open('mailto:support@kolplay.com', '_blank')}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email Support
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.open('https://discord.gg/kolplay', '_blank')}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Discord Community
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.open('https://t.me/kolplay', '_blank')}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Telegram Support
                </Button>
              </div>
            </div>

            {/* Status */}
            <div className="bg-muted/30 border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Platform Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Trading Engine</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-green-600">Operational</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Copy Trading</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-green-600">Operational</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">API Services</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-green-600">Operational</span>
                  </div>
                </div>
              </div>
              <Button
                variant="link"
                className="w-full mt-4 p-0 h-auto text-sm"
                onClick={() => window.open('https://status.kolplay.com', '_blank')}
              >
                View Full Status Page
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </div>

            {/* Version Info */}
            <div className="bg-muted/30 border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Platform Info</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Version</span>
                  <span className="font-mono">v1.2.0</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Updated</span>
                  <span>Dec 2024</span>
                </div>
                <div className="flex justify-between">
                  <span>Network</span>
                  <span>Solana Mainnet</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default HelpPage; 
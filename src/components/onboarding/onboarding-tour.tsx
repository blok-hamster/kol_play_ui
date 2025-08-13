'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/stores/use-user-store';
import { useModal } from '@/stores/use-ui-store';
import { useNotifications } from '@/stores/use-ui-store';
import { STORAGE_KEYS } from '@/lib/constants';
import {
  UserCircle,
  TrendingUp,
  Search,
  PieChart,
  MessageCircle,
  CheckCircle,
  Loader,
  ArrowRight,
  ArrowLeft,
  X,
} from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

interface OnboardingTourProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({
  onComplete,
  onSkip,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  const { user } = useUserStore();
  const { isModalOpen, closeModal } = useModal();
  const { showSuccess } = useNotifications();

  const isOpen = isModalOpen('onboarding');

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to KOL Play!',
      description: 'Your ultimate Solana copy trading platform',
      icon: <UserCircle className="h-8 w-8 text-accent-from" />,
      content: (
        <div className="space-y-4">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-accent-gradient rounded-full flex items-center justify-center mb-4">
              <UserCircle className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Welcome {user?.firstName}!
            </h3>
            <p className="text-muted-foreground">
              Let's take a quick tour of everything you can do on KOL Play to
              start copy trading on Solana.
            </p>
          </div>

          {/* Removed setup copy trader UI */}
        </div>
      ),
    },
    {
      id: 'kol-trading',
      title: 'Follow Top KOLs',
      description: 'Copy trades from successful Key Opinion Leaders',
      icon: <TrendingUp className="h-8 w-8 text-accent-from" />,
      content: (
        <div className="space-y-4">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-accent-gradient rounded-full flex items-center justify-center mb-4">
              <TrendingUp className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Copy Trade with KOLs
            </h3>
            <p className="text-muted-foreground mb-4">
              Follow and automatically copy trades from successful traders in
              the Solana ecosystem.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
              <div className="w-2 h-2 bg-accent-from rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Browse KOL Profiles
                </p>
                <p className="text-xs text-muted-foreground">
                  View trading history and performance metrics
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
              <div className="w-2 h-2 bg-accent-from rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Subscribe to Copy
                </p>
                <p className="text-xs text-muted-foreground">
                  Set your copy amount and risk preferences
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
              <div className="w-2 h-2 bg-accent-from rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Automatic Execution
                </p>
                <p className="text-xs text-muted-foreground">
                  Trades are copied instantly with your settings
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'token-discovery',
      title: 'Discover Tokens',
      description: 'Search and analyze tokens with instant buying',
      icon: <Search className="h-8 w-8 text-accent-from" />,
      content: (
        <div className="space-y-4">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-accent-gradient rounded-full flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Token Discovery & Analysis
            </h3>
            <p className="text-muted-foreground mb-4">
              Search for tokens, analyze their metrics, and buy instantly with one click.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium text-foreground">
                🔍 Smart Search
              </p>
              <p className="text-xs text-muted-foreground">
                Find tokens by name, symbol, or contract address
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium text-foreground">
                ⚡ Instant Buy
              </p>
              <p className="text-xs text-muted-foreground">
                Buy tokens instantly with your pre-configured settings
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium text-foreground">
                📊 Real-time Data
              </p>
              <p className="text-xs text-muted-foreground">
                View market cap, liquidity, and trading volume
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'portfolio',
      title: 'Track Performance',
      description: 'Monitor your trading results and analytics',
      icon: <PieChart className="h-8 w-8 text-accent-from" />,
      content: (
        <div className="space-y-4">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-accent-gradient rounded-full flex items-center justify-center mb-4">
              <PieChart className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Portfolio Analytics
            </h3>
            <p className="text-muted-foreground mb-4">
              Comprehensive tracking of your trading performance and portfolio.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium text-foreground">
                💰 PnL Tracking
              </p>
              <p className="text-xs text-muted-foreground">
                Real-time profit and loss calculations
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium text-foreground">
                📋 Transaction History
              </p>
              <p className="text-xs text-muted-foreground">
                Detailed record of all your trades
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium text-foreground">
                📈 Performance Metrics
              </p>
              <p className="text-xs text-muted-foreground">
                Win rate, volume, and more insights
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'ai-chat',
      title: 'AI Assistant',
      description: 'Get help and insights from your trading assistant',
      icon: <MessageCircle className="h-8 w-8 text-accent-from" />,
      content: (
        <div className="space-y-4">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-accent-gradient rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              AI Trading Assistant
            </h3>
            <p className="text-muted-foreground mb-4">
              Your personal AI assistant is ready to help with trading decisions
              and analysis.
            </p>
          </div>

          {/* Removed setupData and related UI */}

          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium text-foreground">
                💬 Natural Language Queries
              </p>
              <p className="text-xs text-muted-foreground">
                Ask questions about your portfolio
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium text-foreground">
                🎯 Trading Insights
              </p>
              <p className="text-xs text-muted-foreground">
                Get market analysis and recommendations
              </p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    // Mark onboarding as completed
    localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');

    showSuccess(
      'Welcome aboard!',
      "You're all set to start copy trading on KOL Play."
    );

    closeModal();
    onComplete?.();
  };

  const handleSkip = () => {
    // Mark onboarding as completed even if skipped
    localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');

    closeModal();
    onSkip?.();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleSkip}
      title="Getting Started"
      description={`Step ${currentStep + 1} of ${steps.length}`}
      size="lg"
      className="max-w-lg"
      closeOnOverlayClick={false}
    >
      <div className="space-y-6">
        {/* Progress Bar */}
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-accent-gradient h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">{currentStepData.content}</div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center space-x-2">
            {!isFirstStep && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={false} // Removed setupStatus dependency
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              disabled={false} // Removed setupStatus dependency
            >
              <X className="h-4 w-4 mr-1" />
              Skip Tour
            </Button>
          </div>

          <Button
            variant="gradient"
            size="sm"
            onClick={handleNext}
            disabled={
              false // Removed setupStatus dependency
            }
            className="text-white"
          >
            {isLastStep ? 'Get Started' : 'Next'}
            {!isLastStep && <ArrowRight className="h-4 w-4 ml-1" />}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default OnboardingTour;

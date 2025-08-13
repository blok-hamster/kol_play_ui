'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Settings, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

interface TradeConfigPromptProps {
  isOpen: boolean;
  onClose: () => void;
  tokenSymbol?: string | undefined;
}

const TradeConfigPrompt: React.FC<TradeConfigPromptProps> = ({
  isOpen,
  onClose,
  tokenSymbol,
}) => {
  const router = useRouter();

  const handleGoToSettings = () => {
    onClose();
    router.push('/settings?tab=trading');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Trade Settings Required"
      size="md"
    >
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Configure Trading Preferences
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Set up your trading preferences to enable instant buying
            </p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <TrendingUp className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium text-foreground mb-1">
                Instant Buy Feature
              </h4>
              <p className="text-sm text-muted-foreground">
                {tokenSymbol
                  ? `To instantly buy ${tokenSymbol}, you need to configure your trade settings first.`
                  : 'To use instant buying, you need to configure your trade settings first.'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-primary rounded-full" />
            <span className="text-muted-foreground">
              Set your preferred buy amounts (min/max)
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-primary rounded-full" />
            <span className="text-muted-foreground">
              Configure slippage tolerance
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-primary rounded-full" />
            <span className="text-muted-foreground">
              Optional: Set up automatic profit/loss targets
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Maybe Later
          </Button>
          <Button onClick={handleGoToSettings} className="flex-1">
            <Settings className="w-4 h-4 mr-2" />
            Configure Settings
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default TradeConfigPrompt; 
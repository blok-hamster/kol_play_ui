'use client';

import React from 'react';
import { Settings, X } from 'lucide-react';
import { useSwapStore } from '@/stores/use-swap-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

const SwapSettings: React.FC = () => {
  const {
    showSettings,
    slippage,
    priority,
    updateSlippage,
    updatePriority,
    toggleSettings,
  } = useSwapStore();

  const handleSlippageChange = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 10) {
      updateSlippage(numValue);
    }
  };

  const predefinedSlippages = [0.1, 0.5, 1.0, 2.0];

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleSettings}
        className="p-2"
      >
        <Settings className="h-4 w-4" />
      </Button>

      <Modal
        isOpen={showSettings}
        onClose={toggleSettings}
        title="Swap Settings"
        className="max-w-md"
      >
        <div className="space-y-6">
          {/* Slippage Tolerance */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">
              Slippage Tolerance
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Maximum price change you're willing to accept during the swap.
            </p>

            <div className="space-y-3">
              {/* Predefined Slippage Options */}
              <div className="grid grid-cols-4 gap-2">
                {predefinedSlippages.map(value => (
                  <Button
                    key={value}
                    variant={slippage === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateSlippage(value)}
                    className="text-xs"
                  >
                    {value}%
                  </Button>
                ))}
              </div>

              {/* Custom Slippage Input */}
              <div className="relative">
                <Input
                  type="number"
                  value={slippage}
                  onChange={e => handleSlippageChange(e.target.value)}
                  placeholder="Custom"
                  min="0"
                  max="10"
                  step="0.1"
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>

              {/* Slippage Warning */}
              {slippage > 5 && (
                <div className="text-xs text-orange-600 dark:text-orange-400">
                  ⚠️ High slippage tolerance may result in unfavorable trades
                </div>
              )}
              {slippage < 0.1 && (
                <div className="text-xs text-orange-600 dark:text-orange-400">
                  ⚠️ Very low slippage may cause transaction failures
                </div>
              )}
            </div>
          </div>

          {/* Transaction Priority */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">
              Transaction Priority
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Higher priority fees result in faster transaction confirmation.
            </p>

            <div className="space-y-2">
              {[
                {
                  value: 'low',
                  label: 'Low',
                  desc: 'Slow confirmation, lower fees',
                },
                {
                  value: 'medium',
                  label: 'Medium',
                  desc: 'Balanced speed and fees',
                },
                {
                  value: 'high',
                  label: 'High',
                  desc: 'Fast confirmation, higher fees',
                },
              ].map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() =>
                    updatePriority(value as 'low' | 'medium' | 'high')
                  }
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    priority === value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{label}</div>
                      <div className="text-xs text-muted-foreground">
                        {desc}
                      </div>
                    </div>
                    {priority === value && (
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Settings Info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-foreground mb-2">
              💡 Pro Tips
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Use 0.5-1% slippage for most tokens</li>
              <li>• Higher slippage for volatile or low-liquidity tokens</li>
              <li>• Medium priority is recommended for most trades</li>
              <li>• High priority during network congestion</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                updateSlippage(0.5);
                updatePriority('medium');
              }}
              className="flex-1"
            >
              Reset to Default
            </Button>
            <Button onClick={toggleSettings} className="flex-1">
              Save Settings
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default SwapSettings;

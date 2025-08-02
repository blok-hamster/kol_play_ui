'use client';

import React from 'react';
import { Target, Shield, TrendingUp, Clock, X } from 'lucide-react';
import { useSwapStore } from '@/stores/use-swap-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

const WatchConfigForm: React.FC = () => {
  const {
    showWatchConfig,
    useWatchConfig,
    watchConfig,
    updateWatchConfig,
    toggleWatchConfig,
    toggleWatchConfigModal,
  } = useSwapStore();

  const handleInputChange = (field: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      updateWatchConfig({ [field]: numValue });
    }
  };

  const handleToggleChange = (field: string, value: boolean) => {
    updateWatchConfig({ [field]: value });
  };

  return (
    <>
      {/* Watch Config Toggle Button */}
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center space-x-2">
          <Target className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            Auto-Trading (Take Profit/Stop Loss)
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleWatchConfig}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              useWatchConfig ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                useWatchConfig ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleWatchConfigModal}
            className="text-xs p-1"
          >
            Configure
          </Button>
        </div>
      </div>

      {/* Watch Config Modal */}
      <Modal
        isOpen={showWatchConfig}
        onClose={toggleWatchConfigModal}
        title="Auto-Trading Configuration"
        className="max-w-lg"
      >
        <div className="space-y-6">
          {/* Description */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Target className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                  What is Auto-Trading?
                </h4>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Automatically sell your tokens when they reach your target
                  profit or loss thresholds. This helps protect your investment
                  and lock in gains without constant monitoring.
                </p>
              </div>
            </div>
          </div>

          {/* Take Profit Settings */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-medium text-foreground">
                Take Profit
              </h3>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Sell when token price increases by:
              </label>
              <div className="relative">
                <Input
                  type="number"
                  value={watchConfig.takeProfitPercentage}
                  onChange={e =>
                    handleInputChange('takeProfitPercentage', e.target.value)
                  }
                  placeholder="50"
                  min="1"
                  max="1000"
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                Example: If you buy at $1 and set 50%, it will sell at $1.50
              </div>
            </div>
          </div>

          {/* Stop Loss Settings */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-red-600" />
              <h3 className="text-sm font-medium text-foreground">Stop Loss</h3>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Sell when token price decreases by:
              </label>
              <div className="relative">
                <Input
                  type="number"
                  value={watchConfig.stopLossPercentage}
                  onChange={e =>
                    handleInputChange('stopLossPercentage', e.target.value)
                  }
                  placeholder="20"
                  min="1"
                  max="100"
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
              <div className="text-xs text-red-600 dark:text-red-400">
                Example: If you buy at $1 and set 20%, it will sell at $0.80
              </div>
            </div>
          </div>

          {/* Trailing Stop */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-medium text-foreground">
                  Trailing Stop
                </h3>
              </div>
              <button
                onClick={() =>
                  handleToggleChange(
                    'enableTrailingStop',
                    !watchConfig.enableTrailingStop
                  )
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  watchConfig.enableTrailingStop
                    ? 'bg-primary'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    watchConfig.enableTrailingStop
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {watchConfig.enableTrailingStop && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  Trail by percentage:
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    value={watchConfig.trailingPercentage}
                    onChange={e =>
                      handleInputChange('trailingPercentage', e.target.value)
                    }
                    placeholder="10"
                    min="1"
                    max="50"
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  Automatically adjusts stop loss as price rises to lock in more
                  profit
                </div>
              </div>
            )}
          </div>

          {/* Max Hold Time */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <h3 className="text-sm font-medium text-foreground">
                Maximum Hold Time
              </h3>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Automatically sell after (minutes):
              </label>
              <Input
                type="number"
                value={watchConfig.maxHoldTimeMinutes}
                onChange={e =>
                  handleInputChange('maxHoldTimeMinutes', e.target.value)
                }
                placeholder="1440"
                min="1"
                max="10080"
              />
              <div className="text-xs text-orange-600 dark:text-orange-400">
                Set to 1440 for 24 hours, 10080 for 1 week
              </div>
            </div>
          </div>

          {/* Warnings */}
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
            <h4 className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-2">
              ⚠️ Important Notes
            </h4>
            <ul className="text-xs text-orange-700 dark:text-orange-300 space-y-1">
              <li>
                • Auto-trading executes automatically based on your settings
              </li>
              <li>
                • Market volatility may cause trades to execute at different
                prices
              </li>
              <li>
                • Consider gas fees when setting small profit/loss thresholds
              </li>
              <li>
                • You can disable auto-trading anytime from your portfolio
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                updateWatchConfig({
                  takeProfitPercentage: 50,
                  stopLossPercentage: 20,
                  enableTrailingStop: false,
                  trailingPercentage: 10,
                  maxHoldTimeMinutes: 1440,
                });
              }}
              className="flex-1"
            >
              Reset to Default
            </Button>
            <Button onClick={toggleWatchConfigModal} className="flex-1">
              Save Configuration
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default WatchConfigForm;

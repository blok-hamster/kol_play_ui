'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
  TrendingUp,
  AlertCircle,
  DollarSign,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BuyAmountPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  tokenSymbol?: string;
  tokenName?: string;
  hasTradeConfig?: boolean;
  defaultAmount?: number;
  minAmount?: number;
  maxAmount?: number;
}

const BuyAmountPrompt: React.FC<BuyAmountPromptProps> = ({
  isOpen,
  onClose,
  onConfirm,
  tokenSymbol,
  tokenName,
  hasTradeConfig = false,
  defaultAmount,
  minAmount = 0.01,
  maxAmount = 100,
}) => {
  const router = useRouter();
  const [amount, setAmount] = useState<string>(defaultAmount?.toString() || '');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount(defaultAmount?.toString() || '');
      setError('');
    }
  }, [isOpen, defaultAmount]);

  const validateAmount = (value: string): string | null => {
    const numValue = parseFloat(value);

    if (isNaN(numValue) || numValue <= 0) {
      return 'Please enter a valid amount';
    }

    if (numValue < minAmount) {
      return `Minimum amount is ${minAmount} SOL`;
    }

    if (numValue > maxAmount) {
      return `Maximum amount is ${maxAmount} SOL`;
    }

    return null;
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    const validationError = validateAmount(value);
    setError(validationError || '');
  };

  const handleConfirm = async () => {
    const validationError = validateAmount(amount);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    try {
      await onConfirm(parseFloat(amount));
      onClose();
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToSettings = () => {
    router.push('/settings?tab=trading');
    onClose();
  };

  const quickAmounts = [0.1, 0.5, 1.0, 2.0, 5.0];
  const filteredQuickAmounts = quickAmounts.filter(
    amt => amt >= minAmount && amt <= maxAmount
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Buy ${tokenSymbol || tokenName || 'Token'}`}
      size="md"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Specify Buy Amount
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              How much SOL do you want to spend on{' '}
              {tokenSymbol || tokenName || 'this token'}?
            </p>
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buy-amount" className="text-sm font-medium">
              Amount in SOL
            </Label>
            <div className="relative">
              <Input
                id="buy-amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={e => handleAmountChange(e.target.value)}
                min={minAmount}
                max={maxAmount}
                step="0.01"
                className={`pr-12 ${error ? 'border-red-500 focus:border-red-500' : ''}`}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <span className="text-sm text-muted-foreground">SOL</span>
              </div>
            </div>
            {error && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>

          {/* Quick Amount Buttons */}
          {filteredQuickAmounts.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Quick Select
              </Label>
              <div className="flex flex-wrap gap-2">
                {filteredQuickAmounts.map(quickAmount => (
                  <Button
                    key={quickAmount}
                    variant="outline"
                    size="sm"
                    onClick={() => handleAmountChange(quickAmount.toString())}
                    className="text-xs"
                  >
                    {quickAmount} SOL
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <TrendingUp className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-muted-foreground">
                  <span className="font-medium">Range:</span> {minAmount} -{' '}
                  {maxAmount} SOL
                </p>
                {!hasTradeConfig && (
                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                    <p className="text-blue-700 dark:text-blue-300 text-xs font-medium flex items-center gap-1">
                      💡 Set default amounts in settings to skip this step next
                      time
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>

          {!hasTradeConfig && (
            <Button
              variant="outline"
              onClick={handleGoToSettings}
              className="flex-1"
            >
              <Settings className="w-4 h-4 mr-2" />
              Configure Settings
            </Button>
          )}

          <Button
            onClick={handleConfirm}
            disabled={!!error || !amount || isLoading}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Buying...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Buy Now
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default BuyAmountPrompt;

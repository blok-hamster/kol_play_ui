'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, Plus, AlertCircle } from 'lucide-react';
import { useNotifications } from '@/stores/use-ui-store';
import SubscriptionControls from './subscription-controls';

interface AddCustomKOLModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddCustomKOLModal: React.FC<AddCustomKOLModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [walletAddress, setWalletAddress] = useState('');
  const [customName, setCustomName] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [showSubscription, setShowSubscription] = useState(false);

  const { showSuccess, showError } = useNotifications();

  // Basic Solana wallet address validation
  const validateWalletAddress = (address: string): boolean => {
    // Solana addresses are typically 32-44 characters, base58 encoded
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address.trim());
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const address = e.target.value;
    setWalletAddress(address);

    if (address.trim()) {
      const valid = validateWalletAddress(address);
      setIsValid(valid);
      if (valid) {
        setShowSubscription(true);
      } else {
        setShowSubscription(false);
      }
    } else {
      setIsValid(null);
      setShowSubscription(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomName(e.target.value);
  };

  const handleReset = () => {
    setWalletAddress('');
    setCustomName('');
    setIsValid(null);
    setShowSubscription(false);
  };

  const handleViewOnExplorer = () => {
    if (walletAddress && isValid) {
      window.open(`https://solscan.io/account/${walletAddress}`, '_blank');
    }
  };

  const displayName =
    customName.trim() ||
    `Custom KOL ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Custom KOL"
      description="Add your own wallet address to copy trade from"
      size="md"
    >
      <div className="space-y-6">
        {/* Wallet Address Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Wallet Address *
          </label>
          <div className="relative">
            <input
              type="text"
              value={walletAddress}
              onChange={handleAddressChange}
              placeholder="Enter Solana wallet address (e.g., 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM)"
              className={`w-full px-4 py-3 border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent ${
                isValid === null
                  ? 'border-border'
                  : isValid
                    ? 'border-green-500 focus:ring-green-500'
                    : 'border-red-500 focus:ring-red-500'
              }`}
            />
            {walletAddress && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                {isValid && (
                  <button
                    onClick={handleViewOnExplorer}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="View on Solscan"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
                <div
                  className={`w-2 h-2 rounded-full ${
                    isValid === null
                      ? 'bg-muted'
                      : isValid
                        ? 'bg-green-500'
                        : 'bg-red-500'
                  }`}
                />
              </div>
            )}
          </div>
          {isValid === false && (
            <div className="flex items-center space-x-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>Please enter a valid Solana wallet address</span>
            </div>
          )}
          {isValid && (
            <div className="text-green-600 text-sm">✓ Valid wallet address</div>
          )}
        </div>

        {/* Custom Name Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Custom Name (Optional)
          </label>
          <input
            type="text"
            value={customName}
            onChange={handleNameChange}
            placeholder="Give this KOL a custom name"
            className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <p className="text-xs text-muted-foreground">
            If not provided, will use:{' '}
            {walletAddress ? displayName : 'Custom KOL'}
          </p>
        </div>

        {/* Preview Section */}
        {isValid && walletAddress && (
          <div className="bg-muted/30 rounded-lg p-4 space-y-4">
            <h4 className="font-medium text-foreground">Preview</h4>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">
                    {displayName.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{displayName}</h3>
                  <p className="text-sm text-muted-foreground font-mono">
                    {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
                  </p>
                </div>
              </div>
            </div>

            {/* Subscription Controls */}
            {showSubscription && (
              <div className="pt-4 border-t border-border">
                <SubscriptionControls
                  kolWallet={walletAddress}
                  kolName={displayName}
                  size="sm"
                  variant="button"
                  showSettings={true}
                  className="w-full"
                />
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!walletAddress && !customName}
          >
            Reset
          </Button>

          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={onClose}
              disabled={!isValid}
              className="flex items-center space-x-2"
            >
              <span>Done</span>
            </Button>
          </div>
        </div>

        {/* Help Text */}
        <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-3">
          <p className="font-medium mb-1">💡 How it works:</p>
          <ul className="space-y-1 ml-4">
            <li>• Enter any valid Solana wallet address</li>
            <li>• Set up copy trading parameters</li>
            <li>• Start copying their trades automatically</li>
            <li>• Monitor performance in your dashboard</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};

export default AddCustomKOLModal;

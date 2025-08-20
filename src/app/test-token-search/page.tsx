'use client';

import React from 'react';
import TokenSearch from '@/components/tokens/token-search';

export default function TestTokenSearchPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Token Search Modal Test
        </h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Test Token Search Modal Functionality
          </h2>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Search for a token below and click on the result to test if the modal opens correctly.
            Try searching for common tokens like "SOL", "USDC", or "BONK".
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Token Search (Should open modal on click)
              </label>
              <TokenSearch 
                placeholder="Search for tokens to test modal..."
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Token Search with Custom Handler (Should not open modal)
              </label>
              <TokenSearch 
                placeholder="Search for tokens with custom handler..."
                className="w-full"
                onTokenSelect={(token) => {
                  alert(`Custom handler called for: ${token.symbol || token.name}`);
                }}
              />
            </div>
          </div>
          
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-2">
              Testing Instructions:
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>1. Type in a token symbol or name in the first search box</li>
              <li>2. Click on a search result - it should open the token detail modal</li>
              <li>3. Try the second search box - it should show an alert instead of opening modal</li>
              <li>4. Test keyboard navigation with arrow keys and Enter</li>
              <li>5. Test the instant buy button (should not open modal)</li>
            </ul>
            
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                <strong>Debug Mode:</strong> Check browser console for debug logs when clicking tokens.
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                Look for logs starting with 🔍, 📊, 🎯, ✅, 🎭, 🧪 emojis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
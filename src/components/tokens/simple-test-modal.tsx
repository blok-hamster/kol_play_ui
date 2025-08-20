'use client';

import React from 'react';
import { createPortal } from 'react-dom';

interface SimpleTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenName?: string;
}

const SimpleTestModal: React.FC<SimpleTestModalProps> = ({ isOpen, onClose, tokenName }) => {
  console.log('🧪 SimpleTestModal render:', { isOpen, tokenName });
  
  if (!isOpen) {
    console.log('🚫 SimpleTestModal not open, returning null');
    return null;
  }
  
  console.log('✅ SimpleTestModal rendering content');

  const modalContent = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Test Modal Working!
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Token: {tokenName || 'Unknown'}
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Close
        </button>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};

export default SimpleTestModal;
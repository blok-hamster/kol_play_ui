"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import PredictionModal from '@/components/modals/prediction-modal';
import { FeaturesService } from '@/services/features.service';
import { useNotifications } from '@/stores/use-ui-store';
import type { PredictionResult } from '@/types';
import { Info } from 'lucide-react';

const isValidMint = (value: string) => /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(value.trim());

const normalizeMints = (input: string): string[] => {
  const parts = input
    .split(/[\s,\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(parts));
  return unique.filter(isValidMint);
};

export default function PredictTradeInput({ className = '' }: { className?: string }) {
  const { showError, showSuccess } = useNotifications();
  const [rawInput, setRawInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [results, setResults] = useState<PredictionResult[] | null>(null);
  const [requestedMints, setRequestedMints] = useState<string[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handlePredict = async () => {
    const mints = normalizeMints(rawInput);
    if (mints.length === 0) {
      showError('Invalid input', 'Please enter at least one valid token mint address.');
      return;
    }

    try {
      setLoading(true);
      setRequestedMints(mints);
      const response = await FeaturesService.predictTrade({ mints });
      const data = (response as any)?.data ?? null;
      setResults(data);
      setModalOpen(true);
      showSuccess('Prediction complete', 'Model results are ready.');
    } catch (e: any) {
      showError('Prediction failed', e.message ?? 'Unable to get predictions');
    } finally {
      setLoading(false);
    }
  };

  // Auto-grow the input as more text is added, up to a max height
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 240) + 'px';
  };

  useEffect(() => {
    autoResize();
  }, [rawInput]);

  return (
    <div className={`backdrop-blur-sm bg-[#7c3aed1a] border border-[#7c3aed33] rounded-2xl p-6 shadow-sm ${className} text-[#ffffff]`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-base md:text-lg text-[#ffffff]">
          <span>ML Prediction</span>
          <button
            type="button"
            onClick={() => setShowInfo(v => !v)}
            aria-expanded={showInfo}
            aria-label="About ML prediction"
            className="inline-flex items-center justify-center rounded-md px-1.5 py-1 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            <Info className="w-4 h-4 opacity-80" />
          </button>
        </div>
      </div>

      {showInfo && (
        <div className="mb-3 text-sm md:text-base leading-relaxed text-white/90 bg-white/10 border border-white/30 rounded-lg p-3">
          Paste one or more Solana token mint addresses. Separate multiple mints with commas or new lines. This experimental ML feature estimates short-term trading signals based on recent activity; results may be inaccurate.
        </div>
      )}

      <div className="flex items-start gap-3">
        <textarea
          ref={textareaRef}
          rows={1}
          className="flex-1 min-h-[44px] max-h-60 px-3 py-2 border-2 border-[#ffffff] focus:border-[#ffffff] rounded-xl bg-transparent text-[#ffffff] text-base md:text-lg placeholder:text-white/60 outline-none resize-none overflow-hidden"
          placeholder="Paste token mint address(es)"
          value={rawInput}
          onChange={e => {
            setRawInput(e.target.value);
          }}
        />
        <div className="flex flex-col gap-2">
          <Button variant="gradient" className="text-white text-base md:text-lg" onClick={handlePredict} loading={loading}>
            Predict
          </Button>
        </div>
      </div>

      <PredictionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        results={results}
        requestedMints={requestedMints}
      />
    </div>
  );
} 
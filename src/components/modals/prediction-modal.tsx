'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import type { PredictionResult } from '@/types';

interface PredictionModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: PredictionResult[] | null;
  requestedMints: string[];
}

type ClassLabel = 'bad' | 'good' | 'neutral';

interface ResolvedTokenMeta {
  name?: string;
  symbol?: string;
  imageUrl?: string;
  uri?: string;
}

const CLASS_ORDER: ClassLabel[] = ['bad', 'good', 'neutral'];

function formatPercent(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function getLabelColor(label?: string) {
  const l = (label || '').toLowerCase();
  if (l === 'good') return 'bg-green-500/15 text-green-400 border-green-500/30';
  if (l === 'bad') return 'bg-red-500/15 text-red-400 border-red-500/30';
  return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
}

export default function PredictionModal({ isOpen, onClose, results, requestedMints }: PredictionModalProps) {
  const [tokenMeta, setTokenMeta] = useState<Record<number, ResolvedTokenMeta>>({});
  const hasResults = Array.isArray(results) && results.length > 0;

  // Pair requested mint to each result by index
  const items = useMemo(() => {
    if (!hasResults) return [] as Array<{
      prediction: any;
      mint?: string;
      index: number;
    }>;
    return results!.map((prediction: any, index: number) => ({
      prediction,
      mint: requestedMints[index],
      index,
    }));
  }, [hasResults, results, requestedMints]);

  // Fetch token image/logo metadata if missing
  useEffect(() => {
    if (!hasResults) return;

    let isCancelled = false;

    const loadMeta = async () => {
      const updates: Record<number, ResolvedTokenMeta> = {};

      await Promise.all(
        items.map(async ({ prediction, index }) => {
          try {
            const info = prediction?.tokenInfo || {};
            const existingImage = info.image || info.logo || info.logoUrl || info.logoURI || info.icon || info.iconUrl;
            const base: ResolvedTokenMeta = {
              name: info.name,
              symbol: info.symbol,
              imageUrl: existingImage,
              uri: info.uri,
            };

            // If image already present, store and move on
            if (existingImage) {
              updates[index] = base;
              return;
            }

            const uri: string | undefined = info.uri || info.raw?.uri;
            if (!uri) {
              updates[index] = base;
              return;
            }

            const res = await fetch(uri).catch(() => null);
            if (!res || !res.ok) {
              updates[index] = base;
              return;
            }

            const json: any = await res.json().catch(() => null);
            const img = json?.image || json?.logo || json?.logoUrl || json?.logoURI || json?.icon || json?.iconUrl;
            updates[index] = {
              ...base,
              name: base.name || json?.name,
              symbol: base.symbol || json?.symbol,
              imageUrl: img || base.imageUrl,
            };
          } catch {
            // ignore per-item failures
          }
        })
      );

      if (!isCancelled && Object.keys(updates).length > 0) {
        setTokenMeta(prev => ({ ...prev, ...updates }));
      }
    };

    loadMeta();
    return () => {
      isCancelled = true;
    };
  }, [hasResults, items]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Prediction Results"
      description="Model insights for the provided token address(es)"
      size="lg"
    >
      {!hasResults && (
        <div className="text-center py-10 text-muted-foreground">No predictions available.</div>
      )}

      {hasResults && (
        <div className="space-y-4">
          {items.map(({ prediction, mint, index }) => {
            const probs: number[] = Array.isArray(prediction?.probabilities)
              ? prediction.probabilities
              : [];
            const inferredLabel: string | undefined = typeof prediction?.classIndex === 'number' && CLASS_ORDER[prediction.classIndex]
              ? CLASS_ORDER[prediction.classIndex]
              : undefined;
            const label: string | undefined = prediction?.classLabel || inferredLabel;
            const probability: number | undefined = prediction?.probability;
            const token = tokenMeta[index] || {};

            // Build probabilities mapped to labels in known order
            const mappedProbs = CLASS_ORDER.map((cl, i) => ({
              label: cl,
              value: typeof probs[i] === 'number' ? probs[i] : undefined,
            }));

            return (
              <div
                key={index}
                className="border border-border rounded-xl p-4 bg-background/80 backdrop-blur-sm"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 border border-white/20 flex items-center justify-center text-sm">
                    {token.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={token.imageUrl} alt={token.name || 'token'} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white/80">
                        {(token.symbol || token.name || (mint ? mint.slice(0, 2) : 'T')).slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Header content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-lg font-semibold text-foreground truncate">
                        {token.name || prediction?.tokenInfo?.name || 'Unknown Token'}
                  </div>
                      {token.symbol || prediction?.tokenInfo?.symbol ? (
                        <div className="text-sm text-muted-foreground uppercase">
                          {token.symbol || prediction?.tokenInfo?.symbol}
                  </div>
                      ) : null}
                      {mint && (
                        <div className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground border border-border">
                          {mint.slice(0, 4)}...{mint.slice(-4)}
                </div>
              )}
                    </div>

                    <div className="mt-1 flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-sm ${getLabelColor(label)}`}>
                        {label ? label.charAt(0).toUpperCase() + label.slice(1) : '—'}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Confidence: {formatPercent(probability)}
                      </span>
                    </div>

                    {/* Probabilities */}
                    {mappedProbs.some(p => typeof p.value === 'number') && (
                      <div className="mt-3 space-y-2">
                        {mappedProbs.map(({ label: l, value }, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-20 text-xs text-muted-foreground capitalize">{l}</div>
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`${
                                  l === 'good'
                                    ? 'bg-green-500'
                                    : l === 'bad'
                                    ? 'bg-red-500'
                                    : 'bg-amber-500'
                                } h-2`}
                                style={{ width: `${Math.min(100, Math.max(0, (value || 0) * 100))}%` }}
                              />
                            </div>
                            <div className="w-14 text-right text-xs text-foreground">
                              {formatPercent(value)}
                            </div>
                          </div>
                        ))}
                </div>
              )}

                    {/* Token source */}
                    {prediction?.tokenInfo?.source && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        Source: {prediction.tokenInfo.source}
                  </div>
                    )}
                  </div>
                </div>
            </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
} 
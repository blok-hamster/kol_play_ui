'use client';

import React, { useState } from 'react';
import { Brain, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeaturesService } from '@/services/features.service';
import { useNotifications } from '@/stores';
import PredictionModal from '@/components/modals/prediction-modal';
import { cn } from '@/lib/utils';
import type { PredictionResult } from '@/types';

interface PredictButtonProps {
    mint: string;
    className?: string;
    variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'premium';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    showIcon?: boolean;
    label?: string;
}

export const PredictButton: React.FC<PredictButtonProps> = ({
    mint,
    className,
    variant = 'outline',
    size = 'sm',
    showIcon = true,
    label = 'Predict'
}) => {
    const [isPredicting, setIsPredicting] = useState(false);
    const [predictionResult, setPredictionResult] = useState<PredictionResult[] | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { showError } = useNotifications();

    // Reset result if mint changes
    React.useEffect(() => {
        setPredictionResult(null);
    }, [mint]);

    const handlePredict = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!mint || isPredicting) return;

        try {
            setIsPredicting(true);
            const response = await FeaturesService.predictTrade({ mints: [mint] });

            if ((response.success || response.data) && response.data) {
                const results = Array.isArray(response.data) ? response.data : null;
                setPredictionResult(results);
                setIsModalOpen(true);
            } else {
                showError('Prediction Failed', response.message || 'Failed to get prediction for this token.');
            }
        } catch (error: any) {
            showError('Prediction Error', error.message || 'An unexpected error occurred during prediction.');
        } finally {
            setIsPredicting(false);
        }
    };

    return (
        <>
            <Button
                variant={variant === 'premium' ? 'default' : variant}
                size={size}
                onClick={handlePredict}
                disabled={isPredicting}
                className={cn(
                    variant === 'premium' && !predictionResult && 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-none shadow-lg shadow-purple-500/20',
                    className
                )}
            >
                {isPredicting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                ) : showIcon ? (
                    <Brain className="w-3.5 h-3.5 mr-2" />
                ) : null}
                {isPredicting ? 'Analyzing...' : label}
            </Button>

            {predictionResult && (
                <PredictionModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    results={predictionResult}
                    requestedMints={[mint]}
                />
            )}
        </>
    );
};

export default PredictButton;

import { useState, useRef, useCallback } from 'react';
import { AnalyticsService, SentimentAnalysisResult } from '@/services/analytics.service';

export function useAnalyticsQuery() {
    // Shared State for current token
    const [activeToken, setActiveToken] = useState<string>('');
    const isAnalyzingRef = useRef<boolean>(false);

    // Sentiment Swarm State
    const [sentiment, setSentiment] = useState<SentimentAnalysisResult | null>(null);
    const [loadingSentiment, setLoadingSentiment] = useState<boolean>(false);
    const [sentimentError, setSentimentError] = useState<string | null>(null);

    // ML Prediction State
    const [prediction, setPrediction] = useState<{ label: "GOOD" | "BAD" | "NEUTRAL", confidence: number } | null>(null);
    const [loadingPrediction, setLoadingPrediction] = useState<boolean>(false);
    const [predictionError, setPredictionError] = useState<string | null>(null);

    const analyze = useCallback((tokenInput: string) => {
        if (isAnalyzingRef.current) return;
        if (!tokenInput) return;

        // Validate Solana address format (base58, typically 32-44 characters)
        if (tokenInput.length < 32 || tokenInput.length > 44) {
            setSentimentError("Please enter a valid Solana token address (32-44 characters), not a symbol.");
            setPredictionError("Invalid Solana address wrapper.");
            return;
        }

        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
        if (!base58Regex.test(tokenInput)) {
            setSentimentError("Invalid Solana address format. Please enter a valid base58 address.");
            setPredictionError("Invalid Solana address wrapper.");
            return;
        }

        setActiveToken(tokenInput);

        // Reset States
        setSentiment(null);
        setPrediction(null);
        setSentimentError(null);
        setPredictionError(null);
        
        setLoadingSentiment(true);
        setLoadingPrediction(true);
        
        isAnalyzingRef.current = true;

        // --- 1. Trigger ML Prediction (XGBoost) ---
        // Doesn't await the Sentiment Swarm
        AnalyticsService.getPrediction(tokenInput)
            .then(predictionResult => {
                if (predictionResult) {
                    const { probability: prob, label: serverLabel } = predictionResult;
                    let label: "GOOD" | "BAD" | "NEUTRAL" = "NEUTRAL";
                    let confidence = prob * 100;

                    if (serverLabel) {
                        const normalized = serverLabel.toUpperCase();
                        if (normalized === 'GOOD') label = 'GOOD';
                        else if (normalized === 'BAD') label = 'BAD';
                        else label = 'NEUTRAL';
                    } else {
                        if (prob >= 0.6) { label = "GOOD"; }
                        else if (prob <= 0.4) { label = "BAD"; confidence = (1 - prob) * 100; }
                        else { label = "NEUTRAL"; confidence = (1 - Math.abs(prob - 0.5) * 2) * 100; }
                    }
                    setPrediction({ label, confidence });
                } else {
                    setPredictionError("No ML prediction returned.");
                }
            })
            .catch(err => {
                console.error("ML Prediction failed", err);
                setPredictionError(err.message || "Failed to fetch prediction.");
            })
            .finally(() => {
                setLoadingPrediction(false);
            });

        // --- 2. Trigger Sentiment Swarm (Agents) ---
        // Doesn't block the ML Prediction
        AnalyticsService.analyzeSentiment(tokenInput)
            .then(sentimentResult => {
                console.log('[useAnalyticsQuery] ✅ Sentiment Analysis Result:', sentimentResult);
                setSentiment(sentimentResult);
                
                // Fallback capability: if ML failed, use Swarm decision
                setPrediction(prev => {
                    if (!prev) {
                        setPredictionError(null); // Clear error since we have a fallback
                        return { label: sentimentResult.decision, confidence: sentimentResult.confidence };
                    }
                    return prev;
                });
            })
            .catch(err => {
                console.error("Sentiment failed", err);
                setSentimentError(err.message || "Analysis swarm failed");
            })
            .finally(() => {
                setLoadingSentiment(false);
                // The master lock should ideally clear when BOTH finish, but since Swarm is longer, this is safe.
                isAnalyzingRef.current = false;
            });

    }, []);

    return {
        activeToken,
        analyze,
        
        // Sentiment
        sentiment,
        loadingSentiment,
        sentimentError,
        
        // ML Prediction
        prediction,
        loadingPrediction,
        predictionError,
    };
}

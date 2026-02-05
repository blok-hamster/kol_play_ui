'use client';

import React, { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';

interface TradingViewChartProps {
    mint?: string; // Solana mint address
    symbol?: string; // e.g. "SOLUSDT"
    theme?: 'light' | 'dark';
    height?: number | string;
}

declare global {
    interface Window {
        TradingView: any;
    }
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
    mint,
    symbol = 'SOLUSD',
    theme = 'dark',
    height = 500
}) => {
    const containerId = React.useId().replace(/:/g, '');
    const widgetLoaded = useRef(false);

    // native SOL mint
    const WSOL_MINT = 'So11111111111111111111111111111111111111112';

    // Decide if we should use DexScreener (for specific Solana memecoins)
    // or standard TradingView (for SOL or generic symbols)
    const isMemecoin = mint && mint !== WSOL_MINT;

    useEffect(() => {
        if (isMemecoin) return; // Don't load TV script if we're using DexScreener

        // If we have a script already, don't re-add it
        const existingScript = document.getElementById('tradingview-widget-script');

        const createWidget = () => {
            if (window.TradingView) {
                new window.TradingView.widget({
                    "container_id": containerId,
                    "width": "100%",
                    "height": height,
                    "symbol": symbol,
                    "interval": "15", // 15m is better for trading
                    "timezone": "Etc/UTC",
                    "theme": theme,
                    "style": "1",
                    "locale": "en",
                    "toolbar_bg": "#f1f3f6",
                    "enable_publishing": false,
                    "allow_symbol_change": true,
                });
            }
        };

        if (!existingScript) {
            const script = document.createElement('script');
            script.id = 'tradingview-widget-script';
            script.src = 'https://s3.tradingview.com/tv.js';
            script.async = true;
            script.onload = createWidget;
            document.head.appendChild(script);
        } else {
            createWidget();
        }
    }, [symbol, theme, height, containerId, isMemecoin]);

    if (isMemecoin) {
        return (
            <Card className="bg-background border-border overflow-hidden h-full">
                <iframe
                    src={`https://dexscreener.com/solana/${mint}?embed=1&theme=dark&trades=0&info=0`}
                    style={{ width: '100%', height: height, border: 'none' }}
                    title="DexScreener Chart"
                />
            </Card>
        );
    }

    return (
        <Card className="bg-background border-border overflow-hidden">
            <div id={containerId} style={{ height }} className="tradingview-widget-container" />
        </Card>
    );
};

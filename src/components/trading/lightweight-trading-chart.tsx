'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    createChart,
    IChartApi,
    ISeriesApi,
    ColorType,
    CandlestickSeries,
    LineSeries,
} from 'lightweight-charts';
import { useTheme } from 'next-themes';
import { OHLCVService, OHLCVData } from '@/services/ohlcv.service';
import {
    calculateSMA,
    calculateEMA,
    calculateBollingerBands,
    calculateMACD
} from '@/lib/charts/indicator-utils';
import {
    TrendingUp,
    Crosshair,
    BarChart3,
    LineChart,
    Layers,
    GripHorizontal,
    Spline,
    Activity,
    Eraser,
    Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePumpPortalStream } from '@/hooks/use-pumpportal-stream';

import { VerticalLine } from '@/lib/charts/plugins/vertical-line';
import { TrendLine } from '@/lib/charts/plugins/trend-line';
import { HorizontalLine } from '@/lib/charts/plugins/horizontal-line';
import { Ray } from '@/lib/charts/plugins/ray';
import { FibonacciRetracement } from '@/lib/charts/plugins/fibonacci';

interface LightweightTradingChartProps {
    mint?: string;
    symbol?: string;
    height?: number;
    onPriceUpdate?: (priceInSol: number) => void;
}

type ChartTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';


export const LightweightTradingChart: React.FC<LightweightTradingChartProps> = ({
    mint,
    symbol = 'Token',
    height = 550,
    onPriceUpdate
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    // Indicator Series Refs
    const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const emaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
    const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null);
    const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
    const macdLineRef = useRef<ISeriesApi<'Line'> | null>(null);
    const macdSignalRef = useRef<ISeriesApi<'Line'> | null>(null);

    // Drawing State
    const [drawingMode, setDrawingMode] = useState<'none' | 'trend' | 'vertical' | 'horizontal' | 'ray' | 'fib'>('none');
    const drawingsRef = useRef<any[]>([]);

    const { resolvedTheme } = useTheme();

    const [isLoading, setIsLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [historyData, setHistoryData] = useState<OHLCVData[]>([]);
    const solPriceRef = useRef<number>(200);

    // Settings State (Persisted)
    const [timeframe, setTimeframe] = useState<ChartTimeframe>('15m');
    const [indicators, setIndicators] = useState({
        sma: false,
        ema: false,
        bb: false,
        macd: false,
        rsi: false
    });

    useEffect(() => {
        setMounted(true);
    }, []);

    // Persistence: Load settings on mount
    useEffect(() => {
        const saved = localStorage.getItem(`chart-settings-${mint}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.timeframe) setTimeframe(parsed.timeframe);
                if (parsed.indicators) setIndicators(parsed.indicators);
            } catch (e) {
                console.error('Failed to load chart settings', e);
            }
        }
    }, [mint]);

    // Persistence: Save settings on change
    useEffect(() => {
        if (mounted) {
            localStorage.setItem(`chart-settings-${mint}`, JSON.stringify({ timeframe, indicators }));
        }
    }, [timeframe, indicators, mint, mounted]);

    // 1. Initialize Main Chart
    useEffect(() => {
        if (!chartContainerRef.current || !mounted) return;

        const isDark = resolvedTheme === 'dark' || !resolvedTheme;
        const colors = {
            background: isDark ? '#09090b' : '#ffffff',
            text: isDark ? '#a1a1aa' : '#3f3f46',
            grid: isDark ? '#1a1a1d' : '#f4f4f5',
            upColor: '#22c55e',
            downColor: '#ef4444',
        };

        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: height,
            layout: {
                background: { type: ColorType.Solid, color: colors.background },
                textColor: colors.text,
            },
            grid: {
                vertLines: { color: colors.grid },
                horzLines: { color: colors.grid },
            },
            timeScale: {
                borderColor: colors.grid,
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 5,
            },
            rightPriceScale: {
                borderColor: colors.grid,
                autoScale: true,
            },
            crosshair: {
                mode: 0,
                vertLine: { labelVisible: true },
                horzLine: { labelVisible: true },
            },
            localization: {
                priceFormatter: (price: number) => {
                    if (price === 0) return '0';
                    if (price < 0.0001) return price.toFixed(8);
                    if (price < 1) return price.toFixed(6);
                    return price.toFixed(2);
                },
            },
        });

        // Helper to determine precision
        const getPrecision = (data: OHLCVData[]) => {
            if (data.length === 0) return { precision: 2, minMove: 0.01 };
            const avgPrice = data.reduce((sum, d) => sum + d.close, 0) / data.length;
            if (avgPrice < 0.0001) return { precision: 8, minMove: 0.00000001 };
            if (avgPrice < 0.001) return { precision: 6, minMove: 0.000001 };
            if (avgPrice < 1) return { precision: 4, minMove: 0.0001 };
            return { precision: 2, minMove: 0.01 };
        };

        const { precision, minMove } = getPrecision(historyData);

        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: colors.upColor,
            downColor: colors.downColor,
            borderVisible: false,
            wickUpColor: colors.upColor,
            wickDownColor: colors.downColor,
            priceFormat: {
                type: 'price',
                precision: precision,
                minMove: minMove,
            },
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [height, resolvedTheme, mounted]);

    // Drawing state refs to avoid re-renders/effect cleanup during drawing
    const activeDrawingRef = useRef<{
        startPoint: { time: number, price: number } | null,
        tool: any | null
    }>({ startPoint: null, tool: null });

    // 1.1 Drawing Subscriptions (Stable)
    useEffect(() => {
        if (!chartRef.current || !candleSeriesRef.current || drawingMode === 'none') {
            // Reset drawing state if mode changes to none
            activeDrawingRef.current = { startPoint: null, tool: null };
            return;
        }

        const chart = chartRef.current;
        const candleSeries = candleSeriesRef.current;

        const clickHandler = (param: any) => {
            console.log('[Chart] Click detected', { time: param.time, point: param.point, mode: drawingMode });
            if (!param.time || !param.point) return;

            const price = candleSeries.coordinateToPrice(param.point.y);
            const time = param.time as number;

            if (price === null) return;

            if (drawingMode === 'vertical') {
                const vLine = new VerticalLine(chart, candleSeries, time);
                candleSeries.attachPrimitive(vLine as any);
                drawingsRef.current.push(vLine);
                setDrawingMode('none');
            } else if (drawingMode === 'horizontal') {
                const hLine = new HorizontalLine(chart, candleSeries, price);
                candleSeries.attachPrimitive(hLine as any);
                drawingsRef.current.push(hLine);
                setDrawingMode('none');
            } else if (['trend', 'ray', 'fib'].includes(drawingMode)) {
                if (!activeDrawingRef.current.startPoint) {
                    // Start Drawing
                    const p1 = { time, price };
                    console.log('[Chart] Start Drawing: 1st point', p1);
                    activeDrawingRef.current.startPoint = p1;

                    let tool: any;
                    if (drawingMode === 'trend') tool = new TrendLine(chart, candleSeries, p1, p1);
                    else if (drawingMode === 'ray') tool = new Ray(chart, candleSeries, p1, p1);
                    else if (drawingMode === 'fib') tool = new FibonacciRetracement(chart, candleSeries, p1, p1);

                    if (tool) {
                        console.log('[Chart] Attaching tool', tool);
                        candleSeries.attachPrimitive(tool as any);
                        drawingsRef.current.push(tool);
                        activeDrawingRef.current.tool = tool;
                    }
                } else {
                    // Finish Drawing
                    console.log('[Chart] Finish Drawing: 2nd point', { time, price });
                    const tool = activeDrawingRef.current.tool;
                    if (tool && tool.updatePoints && activeDrawingRef.current.startPoint) {
                        tool.updatePoints(activeDrawingRef.current.startPoint, { time, price });
                    }

                    activeDrawingRef.current = { startPoint: null, tool: null };
                    setDrawingMode('none');
                }
            }
        };

        const moveHandler = (param: any) => {
            const { tool, startPoint } = activeDrawingRef.current;
            if (!tool || !startPoint || !param.time || !param.point) return;

            const price = candleSeries.coordinateToPrice(param.point.y);
            const time = param.time as number;

            if (price === null) return;

            if (tool.updatePoints) {
                // console.log('[Chart] Update ghost point', { time, price });
                tool.updatePoints(startPoint, { time, price });
            }
        };

        chart.subscribeClick(clickHandler);
        chart.subscribeCrosshairMove(moveHandler);

        return () => {
            chart.unsubscribeClick(clickHandler);
            chart.unsubscribeCrosshairMove(moveHandler);
        };
    }, [drawingMode]); // Only re-run if Mode changes


    // 2. Fetch Data & Periodic Sync
    const fetchHistory = useCallback(async (isInitial = false) => {
        if (!mint || !candleSeriesRef.current || !mounted) return;

        if (isInitial) setIsLoading(true);
        try {
            // Update SOL price ref during sync
            const solPrice = await OHLCVService.getSolPrice();
            solPriceRef.current = solPrice;

            const data = await OHLCVService.getOHLCV(mint, timeframe, 200);

            if (data && data.length > 0) {
                // Determine precision based on price
                const { precision, minMove } = (() => {
                    const avgPrice = data.reduce((sum, d) => sum + d.close, 0) / data.length;
                    if (avgPrice < 0.0001) return { precision: 8, minMove: 0.00000001 };
                    if (avgPrice < 0.001) return { precision: 6, minMove: 0.000001 };
                    if (avgPrice < 1) return { precision: 4, minMove: 0.0001 };
                    return { precision: 2, minMove: 0.01 };
                })();

                const priceFormat = {
                    type: 'price' as const,
                    precision,
                    minMove,
                };

                candleSeriesRef.current.applyOptions({ priceFormat });

                // Indicators precision sync
                const indicators = [smaSeriesRef.current, emaSeriesRef.current, bbUpperRef.current, bbMiddleRef.current, bbLowerRef.current, macdLineRef.current, macdSignalRef.current];
                indicators.forEach(s => s?.applyOptions({ priceFormat }));

                candleSeriesRef.current.setData(data as any);
                setHistoryData(data);

                if (isInitial && data.length > 0) {
                    chartRef.current?.timeScale().fitContent();
                }
            } else if (isInitial) {
                console.warn(`⚠️ [Chart] No history data found for ${mint}. Check if pool exists.`);
            }
        } catch (err) {
            console.error('❌ Chart history fetch error:', err);
        } finally {
            if (isInitial) setIsLoading(false);
        }
    }, [mint, mounted, timeframe]);

    useEffect(() => {
        fetchHistory(true);
    }, [fetchHistory]);

    // Regular full sync to avoid drift (every 60s)
    useEffect(() => {
        if (!mint || !mounted) return;
        const interval = setInterval(() => fetchHistory(false), 60000);
        return () => clearInterval(interval);
    }, [mint, mounted, fetchHistory]);

    // 3. Indicators Management
    useEffect(() => {
        if (!chartRef.current || historyData.length === 0) return;

        // Indicators update logic with precision
        const { precision, minMove } = (() => {
            if (historyData.length === 0) return { precision: 2, minMove: 0.01 };
            const avgPrice = historyData.reduce((sum, d) => sum + d.close, 0) / historyData.length;
            if (avgPrice < 0.0001) return { precision: 8, minMove: 0.00000001 };
            if (avgPrice < 0.001) return { precision: 6, minMove: 0.000001 };
            if (avgPrice < 1) return { precision: 4, minMove: 0.0001 };
            return { precision: 2, minMove: 0.01 };
        })();

        // SMA
        if (indicators.sma) {
            const data = calculateSMA(historyData, 20);
            if (!smaSeriesRef.current) {
                smaSeriesRef.current = (chartRef.current as any)?.addSeries(LineSeries, {
                    color: '#3b82f6',
                    lineWidth: 2,
                    title: 'SMA 20',
                    priceFormat: { type: 'price', precision, minMove }
                });
            }
            smaSeriesRef.current?.setData(data as any);
        } else if (smaSeriesRef.current) {
            chartRef.current?.removeSeries(smaSeriesRef.current);
            smaSeriesRef.current = null;
        }

        // EMA
        if (indicators.ema) {
            const data = calculateEMA(historyData, 9);
            if (!emaSeriesRef.current) {
                emaSeriesRef.current = (chartRef.current as any)?.addSeries(LineSeries, {
                    color: '#f59e0b',
                    lineWidth: 2,
                    title: 'EMA 9',
                    priceFormat: { type: 'price', precision, minMove }
                });
            }
            emaSeriesRef.current?.setData(data as any);
        } else if (emaSeriesRef.current) {
            chartRef.current?.removeSeries(emaSeriesRef.current);
            emaSeriesRef.current = null;
        }

        // BB
        if (indicators.bb) {
            const data = calculateBollingerBands(historyData);
            if (!bbUpperRef.current) {
                bbUpperRef.current = (chartRef.current as any)?.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 1, title: 'BB Upper', priceFormat: { type: 'price', precision, minMove } });
                bbMiddleRef.current = (chartRef.current as any)?.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 1, title: 'BB Middle', lineStyle: 2, priceFormat: { type: 'price', precision, minMove } });
                bbLowerRef.current = (chartRef.current as any)?.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 1, title: 'BB Lower', priceFormat: { type: 'price', precision, minMove } });
            }
            bbUpperRef.current?.setData(data.map(p => ({ time: p.time, value: p.upper })) as any);
            bbMiddleRef.current?.setData(data.map(p => ({ time: p.time, value: p.middle })) as any);
            bbLowerRef.current?.setData(data.map(p => ({ time: p.time, value: p.lower })) as any);
        } else {
            if (bbUpperRef.current) chartRef.current?.removeSeries(bbUpperRef.current);
            if (bbMiddleRef.current) chartRef.current?.removeSeries(bbMiddleRef.current);
            if (bbLowerRef.current) chartRef.current?.removeSeries(bbLowerRef.current);
            bbUpperRef.current = bbMiddleRef.current = bbLowerRef.current = null;
        }

        // MACD
        if (indicators.macd) {
            const data = calculateMACD(historyData);
            if (!macdLineRef.current) {
                macdLineRef.current = (chartRef.current as any)?.addSeries(LineSeries, { color: '#10b981', lineWidth: 1, title: 'MACD', priceFormat: { type: 'price', precision, minMove } });
                macdSignalRef.current = (chartRef.current as any)?.addSeries(LineSeries, { color: '#ef4444', lineWidth: 1, title: 'Signal', priceFormat: { type: 'price', precision, minMove } });
            }
            macdLineRef.current?.setData(data.map(p => ({ time: p.time, value: p.macd })) as any);
            macdSignalRef.current?.setData(data.map(p => ({ time: p.time, value: p.signal })) as any);
        } else {
            if (macdLineRef.current) chartRef.current?.removeSeries(macdLineRef.current);
            if (macdSignalRef.current) chartRef.current?.removeSeries(macdSignalRef.current);
            macdLineRef.current = macdSignalRef.current = null;
        }
    }, [indicators, historyData]);

    // 4. Real-time updates handler
    const handleTrade = useCallback((trade: any) => {
        if (!mint || !candleSeriesRef.current || !trade || trade.mint !== mint) return;

        // Spike protection: ignore prices that are more than 50% different from the last candle
        // unless it's the first candle. This prevents "unit mismatch" red spikes.
        if (historyData.length > 0) {
            const lastPrice = historyData[historyData.length - 1].close;
            const ratio = trade.price / lastPrice;
            if (ratio < 0.1 || ratio > 10) {
                console.warn(`🚨 [Chart] Ignored extreme price spike: ${trade.price} (Last: ${lastPrice}). Likely unit mismatch.`);
                return;
            }
        }

        // Timeframe in ms
        const tfMsMap: Record<string, number> = {
            '1m': 60000, '5m': 300000, '15m': 900000,
            '1h': 3600000, '4h': 14400000, '1d': 86400000
        };
        const tfMs = tfMsMap[timeframe] || 900000;

        setHistoryData(prev => {
            const newHistory = OHLCVService.updateCandles(prev, trade, tfMs);
            if (newHistory === prev) return prev;

            const lastCandle = newHistory[newHistory.length - 1];
            candleSeriesRef.current?.update(lastCandle as any);
            return newHistory;
        });
    }, [mint, timeframe]);

    // 4.1 Global Real-time Strategy: PumpPortal (for Pump fun tokens)
    const { subscribeTokenTrades: subscribePumpTrades, isConnected: isPumpConnected } = usePumpPortalStream({
        autoConnect: !!mint && mint.endsWith('pump')
    });

    useEffect(() => {
        if (!mint || !mint.endsWith('pump') || !isPumpConnected) return;

        console.log(`📡 [Chart] Subscribing to global PumpPortal trades for ${mint}`);
        const unsubscribe = subscribePumpTrades(mint, (pumpTrade) => {
            // Map PumpPortal trade to common format (USD)
            // PumpPortal provides sol_amount and token_amount. 
            // Standard Pump tokens have 6 decimals. SOL has 9.
            // If raw: (SOL * 10^9) / (Tokens * 10^6) = Price * 10^3
            // If they are already decimated (0.1, 100), we don't divide.

            let priceInSol = pumpTrade.sol_amount / pumpTrade.token_amount;

            // Heuristic detection: if price in SOL > 1, it's likely raw units (Price * 10^3)
            // A typical pump token price is 0.00001 - 0.001 SOL.
            if (priceInSol > 1) {
                priceInSol = priceInSol / 1000;
            }

            if (onPriceUpdate) {
                onPriceUpdate(priceInSol);
            }

            const priceInUsd = priceInSol * solPriceRef.current;

            handleTrade({
                mint: pumpTrade.mint,
                price: priceInUsd,
                timestamp: pumpTrade.timestamp,
                tradeType: pumpTrade.is_buy ? 'buy' : 'sell'
            });
        });

        return unsubscribe;
    }, [mint, isPumpConnected, subscribePumpTrades, handleTrade]);

    // 4.2 Global Real-time Strategy: Polling (Unified Heartbeat)
    useEffect(() => {
        if (!mint || !mounted) return;

        console.log(`📡 [Chart] Starting Heartbeat Polling for ${mint} (5s interval)`);
        const pollInterval = setInterval(async () => {
            // Update SOL price reference for real-time conversion
            const solPrice = await OHLCVService.getSolPrice();
            solPriceRef.current = solPrice;

            const latest = await OHLCVService.getLatestPrice(mint);
            if (latest) {
                // handleTrade logic handles duplicate timestamps correctly

                // Estimate SOL price from USD price
                if (onPriceUpdate && solPriceRef.current > 0) {
                    onPriceUpdate(latest.price / solPriceRef.current);
                }

                handleTrade({
                    mint,
                    price: latest.price,
                    timestamp: latest.timestamp,
                    tradeType: 'buy'
                });
            }
        }, 5000);

        return () => clearInterval(pollInterval);
    }, [mint, mounted, handleTrade]);

    // 4.3 Removed useRealTimeUpdates (Backend dependency)
    // We now rely on PumpPortal (4.1) and DexScreener Polling (4.2)

    const clearDrawings = () => {
        if (!candleSeriesRef.current) return;
        drawingsRef.current.forEach(d => candleSeriesRef.current?.detachPrimitive(d));
        drawingsRef.current = [];
        setDrawingMode('none');
    };

    return (
        <div className="relative group w-full h-full bg-card rounded-xl overflow-hidden border border-border">
            {/* Toolbar */}
            <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 p-1 bg-background/80 backdrop-blur-md rounded-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity duration-300 max-w-[90%]">
                {/* Timeframes */}
                <div className="flex items-center bg-background/40 p-0.5 rounded-md border border-border/50">
                    {(['1m', '5m', '15m', '1h', '4h', '1d'] as ChartTimeframe[]).map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${timeframe === tf
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                                }`}
                        >
                            {tf.toUpperCase()}
                        </button>
                    ))}
                </div>

                <div className="w-[1px] h-4 bg-border mx-1" />

                {/* Indicators Toggle */}
                <Button
                    variant={indicators.sma ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIndicators(prev => ({ ...prev, sma: !prev.sma }))}
                    title="SMA 20"
                >
                    <TrendingUp className="h-4 w-4" />
                </Button>

                <Button
                    variant={indicators.ema ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIndicators(prev => ({ ...prev, ema: !prev.ema }))}
                    title="EMA 9"
                >
                    <Spline className="h-4 w-4" />
                </Button>

                <Button
                    variant={indicators.bb ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIndicators(prev => ({ ...prev, bb: !prev.bb }))}
                    title="Bollinger Bands"
                >
                    <Layers className="h-4 w-4" />
                </Button>

                <Button
                    variant={indicators.macd ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIndicators(prev => ({ ...prev, macd: !prev.macd }))}
                    title="MACD"
                >
                    <Activity className="h-4 w-4" />
                </Button>

                <div className="w-[1px] h-4 bg-border mx-1" />

                {/* Drawing Tools */}
                <Button
                    variant={drawingMode === 'trend' ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setDrawingMode(drawingMode === 'trend' ? 'none' : 'trend')}
                    title="Trend Line"
                >
                    <Crosshair className="h-4 w-4" />
                </Button>

                <Button
                    variant={drawingMode === 'ray' ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setDrawingMode(drawingMode === 'ray' ? 'none' : 'ray')}
                    title="Ray Tool"
                >
                    <GripHorizontal className="h-4 w-4 rotate-45" />
                </Button>

                <Button
                    variant={drawingMode === 'fib' ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setDrawingMode(drawingMode === 'fib' ? 'none' : 'fib')}
                    title="Fibonacci Retracement"
                >
                    <LineChart className="h-4 w-4" />
                </Button>

                <Button
                    variant={drawingMode === 'horizontal' ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setDrawingMode(drawingMode === 'horizontal' ? 'none' : 'horizontal')}
                    title="Horizontal Line"
                >
                    <BarChart3 className="h-4 w-4" />
                </Button>

                <Button
                    variant={drawingMode === 'vertical' ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setDrawingMode(drawingMode === 'vertical' ? 'none' : 'vertical')}
                    title="Vertical Line"
                >
                    <BarChart3 className="h-4 w-4 rotate-90" />
                </Button>

                <div className="w-[1px] h-4 bg-border mx-1" />

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-400"
                    onClick={clearDrawings}
                    title="Clear All Drawings"
                >
                    <Eraser className="h-4 w-4" />
                </Button>
            </div>

            {/* Price Info Header */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-4 text-[10px] font-mono">
                <div className="flex items-center gap-2 px-2 py-1 bg-background/50 rounded border border-border backdrop-blur-sm">
                    <div className="flex items-center gap-1.5 mr-2 pr-2 border-r border-border">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-green-500 uppercase tracking-tighter">Live</span>
                    </div>

                    <span className="text-muted-foreground">O</span>
                    <span className={historyData.length > 0 ? "text-foreground" : "text-muted-foreground/30 font-bold"}>
                        {historyData.length > 0 ? historyData[historyData.length - 1].open.toFixed(10).replace(/\.?0+$/, "") : "---"}
                    </span>
                    <span className="text-muted-foreground ml-1">H</span>
                    <span className="text-green-500">
                        {historyData.length > 0 ? historyData[historyData.length - 1].high.toFixed(10).replace(/\.?0+$/, "") : "---"}
                    </span>
                    <span className="text-muted-foreground ml-1">L</span>
                    <span className="text-red-500">
                        {historyData.length > 0 ? historyData[historyData.length - 1].low.toFixed(10).replace(/\.?0+$/, "") : "---"}
                    </span>
                    <span className="text-muted-foreground ml-1">C</span>
                    <span className="text-foreground font-bold">
                        {historyData.length > 0 ? historyData[historyData.length - 1].close.toFixed(10).replace(/\.?0+$/, "") : "---"}
                    </span>
                    <span className="text-muted-foreground ml-1">V</span>
                    <span className="text-foreground font-bold">
                        {historyData.length > 0 ? (historyData[historyData.length - 1].volume ? (historyData[historyData.length - 1].volume! >= 1000000 ? (historyData[historyData.length - 1].volume! / 1000000).toFixed(2) + 'M' : historyData[historyData.length - 1].volume! >= 1000 ? (historyData[historyData.length - 1].volume! / 1000).toFixed(2) + 'K' : historyData[historyData.length - 1].volume!.toFixed(2)) : "0") : "---"}
                    </span>
                </div>
            </div>

            {/* Main Chart Container */}
            <div
                ref={chartContainerRef}
                className="w-full h-full"
                style={{ cursor: drawingMode !== 'none' ? 'crosshair' : 'default' }}
            />

            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-20">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <div className="flex flex-col items-center">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading {symbol} Data...</span>
                            <span className="text-[10px] text-muted-foreground/60">Fetching market depth & history</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

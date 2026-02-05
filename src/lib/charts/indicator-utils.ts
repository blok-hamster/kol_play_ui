import { OHLCVData } from '@/services/ohlcv.service';

/**
 * Technical Indicator Utilities for Lightweight Charts
 */

export interface IndicatorPoint {
    time: number;
    value: number;
}

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(data: OHLCVData[], period: number): IndicatorPoint[] {
    const sma: IndicatorPoint[] = [];
    if (data.length < period) return sma;

    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].close;
        }
        sma.push({
            time: data[i].time,
            value: sum / period,
        });
    }

    return sma;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(data: OHLCVData[], period: number): IndicatorPoint[] {
    const ema: IndicatorPoint[] = [];
    if (data.length === 0) return ema;

    const k = 2 / (period + 1);
    let prevEma = data[0].close;

    ema.push({ time: data[0].time, value: prevEma });

    for (let i = 1; i < data.length; i++) {
        const value = (data[i].close - prevEma) * k + prevEma;
        ema.push({ time: data[i].time, value });
        prevEma = value;
    }

    return ema;
}

/**
 * Calculate Relative Strength Index (RSI)
 */
export function calculateRSI(data: OHLCVData[], period: number = 14): IndicatorPoint[] {
    const rsi: IndicatorPoint[] = [];
    if (data.length <= period) return rsi;

    let gains = 0;
    let losses = 0;

    // Initial RSI calculation
    for (let i = 1; i <= period; i++) {
        const difference = data[i].close - data[i - 1].close;
        if (difference >= 0) {
            gains += difference;
        } else {
            losses -= difference;
        }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    const firstRsi = 100 - 100 / (1 + avgGain / avgLoss);
    rsi.push({ time: data[period].time, value: firstRsi });

    // Smoothed RSI calculation
    for (let i = period + 1; i < data.length; i++) {
        const difference = data[i].close - data[i - 1].close;
        const gain = difference >= 0 ? difference : 0;
        const loss = difference < 0 ? -difference : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        const rs = avgGain / avgLoss;
        rsi.push({ time: data[i].time, value: 100 - 100 / (1 + rs) });
    }

    return rsi;
}
/**
 * Calculate Bollinger Bands (BB)
 */
export function calculateBollingerBands(data: OHLCVData[], period: number = 20, multiplier: number = 2): { time: number, upper: number, middle: number, lower: number }[] {
    const bb: { time: number, upper: number, middle: number, lower: number }[] = [];
    if (data.length < period) return bb;

    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].close;
        }
        const middle = sum / period;

        let squareSum = 0;
        for (let j = 0; j < period; j++) {
            squareSum += Math.pow(data[i - j].close - middle, 2);
        }
        const stdDev = Math.sqrt(squareSum / period);

        bb.push({
            time: data[i].time,
            upper: middle + multiplier * stdDev,
            middle: middle,
            lower: middle - multiplier * stdDev,
        });
    }

    return bb;
}

/**
 * Calculate Moving Average Convergence Divergence (MACD)
 */
export function calculateMACD(data: OHLCVData[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): { time: number, macd: number, signal: number, histogram: number }[] {
    const results: { time: number, macd: number, signal: number, histogram: number }[] = [];
    if (data.length < slowPeriod + signalPeriod) return results;

    const fastEma = calculateEMA(data, fastPeriod);
    const slowEma = calculateEMA(data, slowPeriod);

    // Get overlapping times
    const macdLine: IndicatorPoint[] = [];
    const slowMap = new Map(slowEma.map(p => [p.time, p.value]));

    fastEma.forEach(f => {
        const sValue = slowMap.get(f.time);
        if (sValue !== undefined) {
            macdLine.push({ time: f.time, value: f.value - sValue });
        }
    });

    // Calculate Signal line (EMA of MACD line)
    const signalEma: IndicatorPoint[] = [];
    const k = 2 / (signalPeriod + 1);
    let prevSignal = macdLine[0].value;
    signalEma.push({ time: macdLine[0].time, value: prevSignal });

    for (let i = 1; i < macdLine.length; i++) {
        const val = (macdLine[i].value - prevSignal) * k + prevSignal;
        signalEma.push({ time: macdLine[i].time, value: val });
        prevSignal = val;
    }

    const signalMap = new Map(signalEma.map(p => [p.time, p.value]));

    macdLine.forEach(m => {
        const sValue = signalMap.get(m.time);
        if (sValue !== undefined) {
            results.push({
                time: m.time,
                macd: m.value,
                signal: sValue,
                histogram: m.value - sValue,
            });
        }
    });

    return results;
}

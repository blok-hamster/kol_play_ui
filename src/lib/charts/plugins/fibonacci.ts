import {
    IChartApi,
    ISeriesApi,
    ISeriesPrimitive,
    SeriesType,
    IPrimitivePaneView,
    IPrimitivePaneRenderer,
    Coordinate,
} from 'lightweight-charts';

class FibonacciRenderer implements IPrimitivePaneRenderer {
    private _p1: { x: Coordinate; y: Coordinate } | null;
    private _p2: { x: Coordinate; y: Coordinate } | null;
    private _levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

    constructor(p1: { x: Coordinate; y: Coordinate } | null, p2: { x: Coordinate; y: Coordinate } | null) {
        this._p1 = p1;
        this._p2 = p2;
    }

    draw(target: any) {
        if (!this._p1 || !this._p2) return;

        target.useMediaCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            
            const pixelRatioX = scope.horizontalPixelRatio || 1;
            const pixelRatioY = scope.verticalPixelRatio || 1;

            const x1 = this._p1!.x * pixelRatioX;
            const y1 = this._p1!.y * pixelRatioY;
            const x2 = this._p2!.x * pixelRatioX;
            const y2 = this._p2!.y * pixelRatioY;

            const minX = Math.min(x1, x2);
            const maxX = Math.max(x1, x2);
            const minY = y1;
            const maxY = y2;
            const height = maxY - minY;

            this._levels.forEach((level) => {
                const y = minY + height * level;
                
                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = `rgba(161, 161, 170, ${1 - level * 0.5})`; // zinc-400
                ctx.lineWidth = 1 * pixelRatioX;
                ctx.setLineDash([5 * pixelRatioX, 5 * pixelRatioX]);
                ctx.moveTo(minX, y);
                ctx.lineTo(maxX, y);
                ctx.stroke();
                ctx.restore();

                ctx.fillStyle = '#a1a1aa';
                ctx.font = `${10 * pixelRatioX}px Arial`;
                ctx.fillText(`${(level * 100).toFixed(1)}%`, maxX + 5 * pixelRatioX, y + 3 * pixelRatioY);
            });

            // Trend line
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 1 * pixelRatioX;
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.restore();
        });
    }
}

class FibonacciView implements IPrimitivePaneView {
    private _p1: { x: Coordinate; y: Coordinate } | null = null;
    private _p2: { x: Coordinate; y: Coordinate } | null = null;

    update(p1: { x: Coordinate; y: Coordinate } | null, p2: { x: Coordinate; y: Coordinate } | null) {
        this._p1 = p1;
        this._p2 = p2;
    }

    renderer() {
        return new FibonacciRenderer(this._p1, this._p2);
    }

    zOrder() {
        return 'top' as const;
    }
}

export class FibonacciRetracement implements ISeriesPrimitive<SeriesType> {
    public requestUpdate?: () => void;
    private _chart: IChartApi;
    private _series: ISeriesApi<SeriesType>;
    private _p1: { time: number; price: number };
    private _p2: { time: number; price: number };
    private _view: FibonacciView | null = null;

    constructor(chart: IChartApi, series: ISeriesApi<SeriesType>, p1: { time: number; price: number }, p2: { time: number; price: number }) {
        this._chart = chart;
        this._series = series;
        this._p1 = p1;
        this._p2 = p2;
    }

    updatePoints(p1: { time: number; price: number }, p2: { time: number; price: number }) {
        this._p1 = p1;
        this._p2 = p2;
        this.requestUpdate?.();
    }

    updateAllViews() {
        const timeScale = this._chart.timeScale();
        const x1 = timeScale.timeToCoordinate(this._p1.time as any);
        const x2 = timeScale.timeToCoordinate(this._p2.time as any);
        const y1 = this._series.priceToCoordinate(this._p1.price);
        const y2 = this._series.priceToCoordinate(this._p2.price);

        if (x1 === null || y1 === null || x2 === null || y2 === null) return;

        if (!this._view) {
            this._view = new FibonacciView();
        }
        
        this._view.update({ x: x1, y: y1 }, { x: x2, y: y2 });
    }

    paneViews() {
        return this._view ? [this._view] : [];
    }
}

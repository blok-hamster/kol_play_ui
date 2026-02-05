import {
    IChartApi,
    ISeriesApi,
    ISeriesPrimitive,
    IPrimitivePaneView,
    IPrimitivePaneRenderer,
    Coordinate,
    SeriesType,
} from 'lightweight-charts';

/**
 * Trend Line Plugin for Lightweight Charts (v5 compatible)
 */

interface Point {
    time: number;
    price: number;
}

class TrendLineRenderer implements IPrimitivePaneRenderer {
    private _p1: { x: Coordinate, y: Coordinate } | null = null;
    private _p2: { x: Coordinate, y: Coordinate } | null = null;
    private _color: string;

    constructor(p1: any, p2: any, color: string) {
        this._p1 = p1;
        this._p2 = p2;
        this._color = color;
    }

    draw(target: any) {
        target.useMediaCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            if (!this._p1 || !this._p2) return;
            
            // Check if pixel ratios exist in scope, usually they are provided for HiDPI
            // If not, we might be in a different context or media coordinate space behaves differently.
            const pixelRatioX = scope.horizontalPixelRatio || 1;
            const pixelRatioY = scope.verticalPixelRatio || 1;

            const x1 = (this._p1.x || 0) * pixelRatioX;
            const y1 = (this._p1.y || 0) * pixelRatioY;
            const x2 = (this._p2.x || 0) * pixelRatioX;
            const y2 = (this._p2.y || 0) * pixelRatioY;
            
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = this._color;
            ctx.lineWidth = 2 * pixelRatioX;
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.restore();
        });
    }
}

class TrendLineView implements IPrimitivePaneView {
    private _p1: { x: Coordinate, y: Coordinate } | null = null;
    private _p2: { x: Coordinate, y: Coordinate } | null = null;
    private _color: string;

    constructor(p1: any, p2: any, color: string) {
        this._p1 = p1;
        this._p2 = p2;
        this._color = color;
    }

    update(p1: any, p2: any) {
        this._p1 = p1;
        this._p2 = p2;
    }

    renderer() {
        return new TrendLineRenderer(this._p1, this._p2, this._color);
    }

    zOrder() {
        return 'top' as const;
    }
}


export class TrendLine implements ISeriesPrimitive<SeriesType> {
    public requestUpdate?: () => void;
    private _chart: IChartApi;
    private _series: ISeriesApi<SeriesType>;
    private _p1: Point;
    private _p2: Point;
    private _color: string;
    private _view: TrendLineView | null = null;

    constructor(chart: IChartApi, series: ISeriesApi<SeriesType>, p1: Point, p2: Point, color: string = '#22c55e') {
        this._chart = chart;
        this._series = series;
        this._p1 = p1;
        this._p2 = p2;
        this._color = color;
    }


    updatePoints(p1: Point, p2: Point) {
        this._p1 = p1;
        this._p2 = p2;
        this.requestUpdate?.();
    }


    updateAllViews() {
        const timeScale = this._chart.timeScale();
        
        const x1 = timeScale.timeToCoordinate(this._p1.time as any);
        const y1 = this._series.priceToCoordinate(this._p1.price);
        
        const x2 = timeScale.timeToCoordinate(this._p2.time as any);
        const y2 = this._series.priceToCoordinate(this._p2.price);

        if (x1 === null || y1 === null || x2 === null || y2 === null) {
            return;
        }

        if (!this._view) {
            this._view = new TrendLineView({ x: x1, y: y1 }, { x: x2, y: y2 }, this._color);
        } else {
            this._view.update({ x: x1, y: y1 }, { x: x2, y: y2 });
        }
    }

    paneViews() {
        return this._view ? [this._view] : [];
    }
}

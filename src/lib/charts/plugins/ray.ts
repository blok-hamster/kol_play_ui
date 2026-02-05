import {
    IChartApi,
    ISeriesApi,
    ISeriesPrimitive,
    SeriesType,
    IPrimitivePaneView,
    IPrimitivePaneRenderer,
    Coordinate,
} from 'lightweight-charts';

class RayRenderer implements IPrimitivePaneRenderer {
    private _p1: { x: Coordinate; y: Coordinate } | null;
    private _p2: { x: Coordinate; y: Coordinate } | null;
    private _color: string;

    constructor(p1: { x: Coordinate; y: Coordinate } | null, p2: { x: Coordinate; y: Coordinate } | null, color: string) {
        this._p1 = p1;
        this._p2 = p2;
        this._color = color;
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

            const dx = x2 - x1;
            const dy = y2 - y1;
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length === 0) return;

            const extendX = x1 + (dx / length) * 10000 * pixelRatioX;
            const extendY = y1 + (dy / length) * 10000 * pixelRatioY;

            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = this._color;
            ctx.lineWidth = 2 * pixelRatioX;
            ctx.moveTo(x1, y1);
            ctx.lineTo(extendX, extendY);
            ctx.stroke();
            ctx.restore();
        });
    }
}

class RayView implements IPrimitivePaneView {
    private _p1: { x: Coordinate; y: Coordinate } | null = null;
    private _p2: { x: Coordinate; y: Coordinate } | null = null;
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
        return new RayRenderer(this._p1, this._p2, this._color);
    }

    zOrder() {
        return 'top' as const;
    }
}

export class Ray implements ISeriesPrimitive<SeriesType> {
    public requestUpdate?: () => void;
    private _chart: IChartApi;
    private _series: ISeriesApi<SeriesType>;
    private _p1: { time: number; price: number };
    private _p2: { time: number; price: number };
    private _color: string;
    private _view: RayView | null = null;

    constructor(chart: IChartApi, series: ISeriesApi<SeriesType>, p1: { time: number; price: number }, p2: { time: number; price: number }, color: string = '#3b82f6') {
        this._chart = chart;
        this._series = series;
        this._p1 = p1;
        this._p2 = p2;
        this._color = color;
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

        if (x1 !== null && x2 !== null && y1 !== null && y2 !== null) {
            if (!this._view) {
                this._view = new RayView({ x: x1, y: y1 }, { x: x2, y: y2 }, this._color);
            } else {
                this._view.update({ x: x1, y: y1 }, { x: x2, y: y2 });
            }
        }
    }

    paneViews() {
        return this._view ? [this._view] : [];
    }
}

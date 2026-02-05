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
 * Vertical Line Plugin for Lightweight Charts (v5 compatible)
 */

class VerticalLineRenderer implements IPrimitivePaneRenderer {
    private _x: Coordinate | null = null;
    private _color: string;

    constructor(x: Coordinate | null, color: string) {
        this._x = x;
        this._color = color;
    }

    draw(target: any) {
        target.useMediaCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            if (this._x === null) return;
            
            const pixelRatioX = scope.horizontalPixelRatio || 1;
            const pixelRatioY = scope.verticalPixelRatio || 1;

            const x = this._x * pixelRatioX;
            
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = this._color;
            ctx.lineWidth = 1 * pixelRatioX;
            ctx.setLineDash([5 * pixelRatioX, 5 * pixelRatioX]);
            ctx.moveTo(x, 0);
            ctx.lineTo(x, scope.mediaSize.height * pixelRatioY);
            ctx.stroke();
            ctx.restore();
        });
    }
}

class VerticalLineView implements IPrimitivePaneView {
    private _x: Coordinate | null = null;
    private _color: string;

    constructor(x: Coordinate | null, color: string) {
        this._x = x;
        this._color = color;
    }

    update(x: Coordinate | null) {
        this._x = x;
    }

    renderer() {
        return new VerticalLineRenderer(this._x, this._color);
    }

    zOrder() {
        return 'top' as const;
    }
}


export class VerticalLine implements ISeriesPrimitive<SeriesType> {
    public requestUpdate?: () => void;
    private _chart: IChartApi;
    private _series: ISeriesApi<SeriesType>;
    private _time: number;
    private _color: string;
    private _view: VerticalLineView | null = null;

    constructor(chart: IChartApi, series: ISeriesApi<SeriesType>, time: number, color: string = '#3b82f6') {
        this._chart = chart;
        this._series = series;
        this._time = time;
        this._color = color;
    }

    updateAllViews() {
        const timeScale = this._chart.timeScale();
        const x = timeScale.timeToCoordinate(this._time as any);
        if (!this._view) {
            this._view = new VerticalLineView(x, this._color);
        } else {
            this._view.update(x);
        }
    }

    paneViews() {
        return this._view ? [this._view] : [];
    }
}

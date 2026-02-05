import {
    IChartApi,
    ISeriesApi,
    ISeriesPrimitive,
    SeriesType,
    IPrimitivePaneView,
    IPrimitivePaneRenderer,
    Coordinate,
} from 'lightweight-charts';

class HorizontalLineRenderer implements IPrimitivePaneRenderer {
    private _y: Coordinate | null;
    private _color: string;

    constructor(y: Coordinate | null, color: string) {
        this._y = y;
        this._color = color;
    }

    draw(target: any) {
        if (this._y === null) return;

        target.useMediaCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            
            const pixelRatioX = scope.horizontalPixelRatio || 1;
            const pixelRatioY = scope.verticalPixelRatio || 1;

            const y = this._y! * pixelRatioY;

            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = this._color;
            ctx.lineWidth = 2 * pixelRatioX;
            ctx.setLineDash([5 * pixelRatioX, 5 * pixelRatioX]);

            ctx.moveTo(0, y);
            ctx.lineTo(scope.mediaSize.width * pixelRatioX, y);
            ctx.stroke();
            ctx.restore();
        });
    }
}

class HorizontalLineView implements IPrimitivePaneView {
    private _y: Coordinate | null = null;
    private _color: string = '#3b82f6';

    update(y: Coordinate | null, color: string) {
        this._y = y;
        this._color = color;
    }

    renderer() {
        return new HorizontalLineRenderer(this._y, this._color);
    }

    zOrder() {
        return 'top' as const;
    }
}

export class HorizontalLine implements ISeriesPrimitive<SeriesType> {
    public requestUpdate?: () => void;
    private _chart: IChartApi;
    private _series: ISeriesApi<SeriesType>;
    private _price: number;
    private _color: string;
    private _view: HorizontalLineView;

    constructor(chart: IChartApi, series: ISeriesApi<SeriesType>, price: number, color: string = '#3b82f6') {
        this._chart = chart;
        this._series = series;
        this._price = price;
        this._color = color;
        this._view = new HorizontalLineView();
    }

    updateAllViews() {
        const y = this._series.priceToCoordinate(this._price);
        this._view.update(y, this._color);
    }

    paneViews() {
        return [this._view];
    }
}

import { ResolvedCoreOptions, TimeChartSeriesOptions } from '../options';
import { domainSearch, EventDispatcher } from '../utils';
import { CanvasLayer } from './canvasLayer';
import { ContentBoxDetector } from "./contentBoxDetector";
import { DataPoint, RenderModel } from './renderModel';

type DataItem = {
    pxPoint: {
        x: number;
        y: number;
    };
    s: TimeChartSeriesOptions;
    ent: DataPoint;
    width: number;
    height: number;
};
export class NearestPointModel {
    dataPoints = new Map<TimeChartSeriesOptions, DataPoint>();
    lastPointerPos: null | { x: number, y: number } = null;
    updated = new EventDispatcher();

    constructor(
        private canvas: CanvasLayer,
        private model: RenderModel,
        private options: ResolvedCoreOptions,
        detector: ContentBoxDetector
    ) {
        detector.node.addEventListener('mousemove', ev => {
            const rect = canvas.canvas.getBoundingClientRect();
            this.lastPointerPos = {
                x: ev.clientX - rect.left,
                y: ev.clientY - rect.top,
            };
            this.adjustPoints();
        });
        detector.node.addEventListener('mouseleave', ev => {
            this.lastPointerPos = null;
            this.adjustPoints();
        });

        model.updated.on(() => this.adjustPoints());
    }

    adjustPoints() {
        if (this.lastPointerPos !== null) {
            this.dataPoints.clear();
            const domain = this.model.xScale.invert(this.lastPointerPos.x);
            let points = new Map<string, DataItem>();
            for (const s of this.options.series) {
                if (s.data.length == 0 || !s.visible) {
                    this.dataPoints.delete(s);
                    continue;
                }
                const pos = domainSearch(s.data, 0, s.data.length, domain, d => d.x);
                const near: DataPoint[] = [];
                if (pos > 0) {
                    near.push(s.data[pos - 1]);
                }
                if (pos < s.data.length) {
                    near.push(s.data[pos]);
                }
                const sortKey = (a: typeof near[0]) => Math.abs(a.x - domain);
                near.sort((a, b) => sortKey(a) - sortKey(b));
                const pxPoint = this.model.pxPoint(near[0]);
                const width = this.canvas.canvas.clientWidth;
                const height = this.canvas.canvas.clientHeight;
                //set nearest point of the same type series.
                let ent = near[0];
                let item: any = points.get(s.type)
                //Filter out the pxPoints that are out of range.
                if (pxPoint.x > 0 && pxPoint.x < width) {
                    //if it`s first time.
                    if (!item) {
                        points.set(s.type, { pxPoint, s, ent, width, height })
                        continue
                    }
                    //set the nearest point.
                    if (Math.abs(pxPoint.x - this.lastPointerPos.x) < Math.abs(item.pxPoint.x - this.lastPointerPos.x)) {
                        points.set(s.type, { pxPoint, s, ent, width, height })
                    }
                }
            }
            points.forEach(element => {
                this.dataPoints.set(element.s, element.ent);
            });
        }
        this.updated.dispatch();
    }
}

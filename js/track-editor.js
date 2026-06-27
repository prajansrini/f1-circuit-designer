/* ============================================================
   track-editor.js — Spline Math & Track Geometry
   ============================================================ */
window.F1 = window.F1 || {};

F1.TrackEditor = class TrackEditor {
    constructor(circuitData) {
        this.data = circuitData;
        this.resolution = 24;
    }

    _cr(p0, p1, p2, p3, t) {
        const t2 = t * t, t3 = t2 * t;
        return {
            x: .5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
            y: .5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        };
    }
    _crDeriv(p0, p1, p2, p3, t) {
        const t2 = t * t;
        return {
            x: .5 * ((-p0.x + p2.x) + (4 * p0.x - 10 * p1.x + 8 * p2.x - 2 * p3.x) * t + (-3 * p0.x + 9 * p1.x - 9 * p2.x + 3 * p3.x) * t2),
            y: .5 * ((-p0.y + p2.y) + (4 * p0.y - 10 * p1.y + 8 * p2.y - 2 * p3.y) * t + (-3 * p0.y + 9 * p1.y - 9 * p2.y + 3 * p3.y) * t2)
        };
    }
    _mirror(a, b) { return { x: 2 * a.x - b.x, y: 2 * a.y - b.y, widthLeft: a.widthLeft, widthRight: a.widthRight }; }

    getInterpolatedTrack() {
        const pts = this.data.controlPoints, n = pts.length;
        if (n < 2) return [];
        const result = [], segs = this.data.isClosed ? n : n - 1;
        for (let i = 0; i < segs; i++) {
            let p0, p1 = pts[i], p2 = pts[(i + 1) % n], p3;
            if (this.data.isClosed) {
                p0 = pts[(i - 1 + n) % n]; p3 = pts[(i + 2) % n];
            } else {
                p0 = i > 0 ? pts[i - 1] : this._mirror(pts[0], pts[1]);
                p3 = i < n - 2 ? pts[i + 2] : this._mirror(pts[n - 1], pts[n - 2]);
            }
            for (let j = 0; j < this.resolution; j++) {
                const t = j / this.resolution;
                const pos = this._cr(p0, p1, p2, p3, t);
                const tang = this._crDeriv(p0, p1, p2, p3, t);
                const len = Math.hypot(tang.x, tang.y) || 1;
                result.push({
                    x: pos.x, y: pos.y, nx: -tang.y / len, ny: tang.x / len,
                    widthLeft: p1.widthLeft + (p2.widthLeft - p1.widthLeft) * t,
                    widthRight: p1.widthRight + (p2.widthRight - p1.widthRight) * t,
                    surfaceWidthLeft: p1.surfaceWidthLeft + (p2.surfaceWidthLeft - p1.surfaceWidthLeft) * t,
                    surfaceWidthRight: p1.surfaceWidthRight + (p2.surfaceWidthRight - p1.surfaceWidthRight) * t,
                    surfaceLeft: p1.surfaceLeft, surfaceRight: p1.surfaceRight,
                    barrierLeft: p1.barrierLeft, barrierRight: p1.barrierRight,
                    sector: p1.sector, segIndex: i, t
                });
            }
        }
        if (this.data.isClosed && result.length > 0) result.push({ ...result[0] });
        return result;
    }

    getInterpolatedPitLane() {
        const pts = this.data.pitLane.points, n = pts.length;
<<<<<<< HEAD
        if (n < 2) return pts.map(p => ({ ...p, nx: 0, ny: -1 }));
=======
        if (n < 2) return pts.map(p => ({ ...p, nx: 0, ny: -1, segIndex: 0 }));
>>>>>>> 5c86d62 (v6.0_ml-powered circuit analysis)
        const result = [];
        for (let i = 0; i < n - 1; i++) {
            const p0 = i > 0 ? pts[i - 1] : this._mirror(pts[0], pts[1]);
            const p1 = pts[i], p2 = pts[i + 1];
            const p3 = i < n - 2 ? pts[i + 2] : this._mirror(pts[n - 1], pts[n - 2]);
            for (let j = 0; j < this.resolution; j++) {
                const t = j / this.resolution;
                const pos = this._cr(p0, p1, p2, p3, t);
                const tang = this._crDeriv(p0, p1, p2, p3, t);
                const len = Math.hypot(tang.x, tang.y) || 1;
<<<<<<< HEAD
                result.push({ x: pos.x, y: pos.y, nx: -tang.y / len, ny: tang.x / len });
            }
        }
        const last = result[result.length - 1];
        result.push({ ...pts[n - 1], nx: last?.nx || 0, ny: last?.ny || -1 });
=======
                result.push({ x: pos.x, y: pos.y, nx: -tang.y / len, ny: tang.x / len, segIndex: i });
            }
        }
        const last = result[result.length - 1];
        result.push({ ...pts[n - 1], nx: last?.nx || 0, ny: last?.ny || -1, segIndex: n - 2 });
>>>>>>> 5c86d62 (v6.0_ml-powered circuit analysis)
        return result;
    }

    /* Get world position for a zone (segIndex + t along that segment) */
    getZoneWorldPos(zone) {
        const pts = this.data.controlPoints, n = pts.length;
        if (n < 2) return null;
        const segs = this.data.isClosed ? n : n - 1;
        const i = Math.max(0, Math.min(zone.segIndex || 0, segs - 1));
        let p0, p1 = pts[i], p2 = pts[(i + 1) % n], p3;
        if (this.data.isClosed) {
            p0 = pts[(i - 1 + n) % n]; p3 = pts[(i + 2) % n];
        } else {
            p0 = i > 0 ? pts[i - 1] : this._mirror(pts[0], pts[1]);
            p3 = i < n - 2 ? pts[i + 2] : this._mirror(pts[n - 1], pts[n - 2]);
        }
        const pos = this._cr(p0, p1, p2, p3, zone.t);
        const tang = this._crDeriv(p0, p1, p2, p3, zone.t);
        const len = Math.hypot(tang.x, tang.y) || 1;
        return { x: pos.x, y: pos.y, nx: -tang.y / len, ny: tang.x / len };
    }

    findNearestControlPoint(wx, wy, maxDist) {
        let best = null, bestD = maxDist;
        for (const p of this.data.controlPoints) { const d = Math.hypot(p.x - wx, p.y - wy); if (d < bestD) { bestD = d; best = p; } }
        return best;
    }

    findNearestPitPoint(wx, wy, maxDist) {
        let best = null, bestD = maxDist;
        for (const p of this.data.pitLane.points) { const d = Math.hypot(p.x - wx, p.y - wy); if (d < bestD) { bestD = d; best = p; } }
        return best;
    }
    findNearestZone(wx, wy, maxDist) {
        let best = null, bestD = maxDist;
        const tp = this.findNearestTrackPoint(wx, wy);
        for (const z of this.data.zones) {
            if (z.type === 'straight_mode') {
                if (tp && tp.index >= 0) {
                    const res = this.resolution;
                    let startIdx = z.segIndex * res + Math.floor(z.t * res);
                    let endIdx = (z.endSegIndex !== undefined ? z.endSegIndex : z.segIndex) * res + Math.floor((z.endT !== undefined ? z.endT : z.t) * res);
                    
                    let inside = false;
                    if (startIdx <= endIdx) {
                        inside = (tp.index >= startIdx && tp.index <= endIdx);
                    } else if (this.data.isClosed) {
                        inside = (tp.index >= startIdx || tp.index <= endIdx);
                    } else {
                        inside = (tp.index >= endIdx && tp.index <= startIdx);
                    }
                    
                    if (inside) {
                        const p = tp.point;
                        const dx = wx - p.x, dy = wy - p.y;
                        const dot = dx * p.nx + dy * p.ny; 
                        const isRightSide = dot > 0;
                        if ((z.side === 'left' && !isRightSide) || ((z.side === 'right' || !z.side) && isRightSide)) {
                            const absDist = Math.abs(dot);
                            const w = (z.side === 'left') ? p.widthLeft : p.widthRight;
                            
                            // Strips hit bounds (strips are centered at w + sw and are sw * 0.6 thick)
                            const sw = z.stripWidth || 5;
                            let isHit = (absDist >= w + sw - 2 && absDist <= w + sw + 2);
                            
                            // Text hit bounds (roughly middle 30% of the zone, distance w+10 to w+25)
                            if (!isHit && absDist >= w + 10 && absDist <= w + 25) {
                                // Calculate total indices in zone
                                let totalIndices = endIdx - startIdx;
                                if (totalIndices < 0 && this.data.isClosed) {
                                    totalIndices = (this.getInterpolatedTrack().length - startIdx) + endIdx;
                                }
                                
                                // Calculate how far tp.index is into the zone
                                let cur = tp.index - startIdx;
                                if (cur < 0 && this.data.isClosed) {
                                    cur = (this.getInterpolatedTrack().length - startIdx) + tp.index;
                                }
                                
                                const ratio = cur / (totalIndices || 1);
                                if (ratio >= 0.3 && ratio <= 0.7) {
                                    isHit = true;
                                }
                            }
                            
                            if (isHit) {
                                // Set pseudoDist to 0 so it guarantees a hit regardless of zoom-dependent maxDist
                                const pseudoDist = 0; 
                                if (pseudoDist < bestD) {
                                    bestD = pseudoDist;
                                    best = z;
                                }
                            }
                        }
                    }
                }
                continue;
            }
            const pos = this.getZoneWorldPos(z);
            if (!pos) continue;
            const d = Math.hypot(pos.x - wx, pos.y - wy);
            if (d < bestD) { bestD = d; best = z; }
        }
        return best;
    }
    findNearestTrackPoint(wx, wy) {
        const track = this.getInterpolatedTrack();
        let best = null, bestD = Infinity, bestIdx = -1;
        for (let i = 0; i < track.length; i++) {
            const d = Math.hypot(track[i].x - wx, track[i].y - wy);
            if (d < bestD) { bestD = d; best = track[i]; bestIdx = i; }
        }
        return { point: best, dist: bestD, index: bestIdx };
    }
<<<<<<< HEAD
=======
    findNearestPitLanePoint(wx, wy) {
        const pit = this.getInterpolatedPitLane();
        let best = null, bestD = Infinity, bestIdx = -1;
        for (let i = 0; i < pit.length; i++) {
            const d = Math.hypot(pit[i].x - wx, pit[i].y - wy);
            if (d < bestD) { bestD = d; best = pit[i]; bestIdx = i; }
        }
        return { point: best, dist: bestD, index: bestIdx };
    }
>>>>>>> 5c86d62 (v6.0_ml-powered circuit analysis)
    isNearFirstPoint(wx, wy, threshold) {
        if (this.data.controlPoints.length < 3) return false;
        const f = this.data.controlPoints[0];
        return Math.hypot(f.x - wx, f.y - wy) < threshold;
    }
    getPointAtDistance(targetDist) {
        const t = this.getInterpolatedTrack();
        let totalLen = this.getTrackLength();
        if (totalLen <= 0) return t[0];

        if (this.data.isClosed) {
            targetDist = ((targetDist % totalLen) + totalLen) % totalLen;
        } else {
            if (targetDist <= 0) return t[0];
            if (targetDist >= totalLen) return t[t.length - 1];
        }

        let len = 0;
        for (let i = 1; i < t.length; i++) {
            const d = Math.hypot(t[i].x - t[i - 1].x, t[i].y - t[i - 1].y);
            if (len + d >= targetDist) return t[i];
            len += d;
        }
        return t[t.length - 1];
    }
    getTrackLength() {
        const t = this.getInterpolatedTrack();
        let len = 0;
        for (let i = 1; i < t.length; i++) len += Math.hypot(t[i].x - t[i - 1].x, t[i].y - t[i - 1].y);
        return len;
    }
};

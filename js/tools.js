/* ============================================================
   tools.js — Tool System
   ============================================================ */
window.F1 = window.F1 || {};

class BaseTool {
    constructor(app) { this.app = app; }
    get data() { return this.app.data; }
    get editor() { return this.app.editor; }
    get renderer() { return this.app.renderer; }
    activate() { } deactivate() { }
    onMouseDown(wx, wy, e) { } onMouseMove(wx, wy, e) { } onMouseUp(wx, wy, e) { } onKeyDown(e) { }
    getCursor() { return 'default'; }

    _hitRotatedRect(wx, wy, cx, cy, rot, hw, hh) {
        const dx = wx - cx, dy = wy - cy, angle = -(rot || 0) * Math.PI / 180;
        const rwx = dx * Math.cos(angle) - dy * Math.sin(angle);
        const rwy = dx * Math.sin(angle) + dy * Math.cos(angle);
        return Math.abs(rwx) < hw && Math.abs(rwy) < hh;
    }
}

/* ---- Select / Move ---- */
class SelectTool extends BaseTool {
    constructor(app) { super(app); this.dragging = null; this.rotatingObj = null; }
    getCursor() { return this.dragging || this.rotatingObj ? 'grabbing' : 'default'; }

    _getOutsideSgn(p) {
        if (this.data.controlPoints.length === 0) return 1;
        const cx = this.data.controlPoints.reduce((sum, cp) => sum + cp.x, 0) / this.data.controlPoints.length;
        const cy = this.data.controlPoints.reduce((sum, cp) => sum + cp.y, 0) / this.data.controlPoints.length;
        const distLeft = Math.hypot(p.x + p.nx - cx, p.y + p.ny - cy);
        const distRight = Math.hypot(p.x - p.nx - cx, p.y - p.ny - cy);
        return distLeft > distRight ? 1 : -1;
    }

    _hitRotationHandle(wx, wy) {
        const sel = this.app.selection; if (!sel) return null;
        const thr = 15 / this.renderer.scale;
        // Grandstand / Garage
        if (sel.type === 'grandstand' || sel.type === 'garage') {
            const obj = sel.type === 'grandstand' ? this.data.getGrandstandById(sel.id) : this.data.getGarageById(sel.id);
            if (!obj) return null;
            const rad = (obj.rotation || 0) * Math.PI / 180;
            const hd = ((obj.height || 16) / 2) + 20 / this.renderer.scale;
            const hx = obj.x, hy = obj.y - Math.cos(rad) * hd / this.renderer.scale;
            // Use screen space for handle hit
            const sObj = this.renderer.w2s(obj.x, obj.y);
            const dist = ((obj.height || 16) * this.renderer.scale / 2) + 20;
            const sHx = sObj.x + Math.sin(rad) * dist, sHy = sObj.y - Math.cos(rad) * dist;
            const sWx = this.renderer.w2s(wx, wy);
            if (Math.hypot(sWx.x - sHx, sWx.y - sHy) < 20) return obj;
            return null;
        }
        // Zone label
        if (sel.type === 'zone') {
            const zone = this.data.getZoneById(sel.id);
            if (!zone) return null;
            const zt = F1.ZONE_TYPES.find(z => z.key === zone.type);
            let anchorX, anchorY;
            if (zt && zt.range) {
                if (zone !== this.data.zones.find(z => z.type === 'straight_mode')) return null;
                const track = this.editor.getInterpolatedTrack();
                const si = zone.segIndex * this.editor.resolution + Math.floor(zone.t * this.editor.resolution);
                const ei = zone.endSegIndex * this.editor.resolution + Math.floor(zone.endT * this.editor.resolution);
                const midIdx = Math.floor((Math.min(si, ei) + Math.max(si, ei)) / 2);
                const pMid = track[midIdx]; if (!pMid) return null;
                anchorX = pMid.x; anchorY = pMid.y;
            } else {
                const pos = this.editor.getZoneWorldPos(zone); if (!pos) return null;
                anchorX = pos.x; anchorY = pos.y;
            }
            const sA = this.renderer.w2s(anchorX, anchorY);
            const lx = sA.x + (zone.labelOffsetX || 0) * this.renderer.scale;
            const ly = sA.y + (zone.labelOffsetY || 0) * this.renderer.scale;
            const rad = (zone.rotation || 0) * Math.PI / 180;
            const sf = Math.max(0.9, this.renderer.scale);
            const text = zone.label ? zone.label.toUpperCase() : '';
            const lines = text.split('\n');
            const th = lines.length * 16 * sf + 6 * sf;
            const hd = th / 2 + 20;
            const hx = lx + Math.sin(rad) * hd, hy = ly - Math.cos(rad) * hd;
            const sW = this.renderer.w2s(wx, wy);
            if (Math.hypot(sW.x - hx, sW.y - hy) < 20) return zone;
            return null;
        }
        // Sector label
        if (sel.type === 'sector_label') {
            const sl = this.data.sectorLabels.find(s => s.sector === sel.sector); if (!sl) return null;
            const track = this.editor.getInterpolatedTrack();
            const pts = track.filter(pt => pt.sector === sl.sector); if (!pts.length) return null;
            const mid = pts[Math.floor(pts.length / 2)];
            const sMid = this.renderer.w2s(mid.x, mid.y);
            const lx = sMid.x + sl.labelOffsetX * this.renderer.scale;
            const ly = sMid.y + sl.labelOffsetY * this.renderer.scale;
            const rad = (sl.rotation || 0) * Math.PI / 180;
            const sf = Math.max(0.9, this.renderer.scale);
            const th = 22 * sf;
            const hd = th / 2 + 20;
            const hx = lx + Math.sin(rad) * hd, hy = ly - Math.cos(rad) * hd;
            const sW = this.renderer.w2s(wx, wy);
            if (Math.hypot(sW.x - hx, sW.y - hy) < 20) return sl;
            return null;
        }
        // Turn marker
        if (sel.type === 'turn') {
            const tm = this.data.getTurnMarkerById(sel.id); if (!tm) return null;
            const track = this.editor.getInterpolatedTrack();
            const idx = tm.segIndex * this.editor.resolution + Math.floor(tm.t * this.editor.resolution);
            const p = track[Math.min(idx, track.length - 1)]; if (!p) return null;
            const actualSgn = tm.side === 'left' ? -1 : 1;
            const w = actualSgn < 0 ? p.widthLeft : p.widthRight;
            const offset = w + 17 / this.renderer.scale;
            const tmx = p.x + p.nx * offset * actualSgn;
            const tmy = p.y + p.ny * offset * actualSgn;
            const s = this.renderer.w2s(tmx, tmy);
            const rad = (tm.rotation || 0) * Math.PI / 180;
            const hx = s.x + Math.sin(rad) * 22, hy = s.y - Math.cos(rad) * 22;
            const sW = this.renderer.w2s(wx, wy);
            if (Math.hypot(sW.x - hx, sW.y - hy) < 20) return tm;
            return null;
        }
        return null;
    }

    onMouseDown(wx, wy) {
        const track = this.editor.getInterpolatedTrack();

        // 1. Rotation handles
        const rotObj = this._hitRotationHandle(wx, wy);
        if (rotObj) { this.data.snapshot(); this.rotatingObj = rotObj; return; }

        // 2. Control points (nodes)
        const cp = this.editor.findNearestControlPoint(wx, wy, 30 / this.renderer.scale);
        if (cp) { this.data.snapshot(); this.app.setSelection({ type: 'cp', id: cp.id }); this.dragging = { type: 'cp', obj: cp }; return; }

        // 3. Straight Mode Range Handles (if a zone is selected and it is straight mode)
        const sel = this.app.selection;
        if (sel && sel.type === 'zone') {
            const zone = this.data.getZoneById(sel.id);
            if (zone && zone.type === 'straight_mode') {
                const sIdx = zone.segIndex * this.editor.resolution + Math.floor(zone.t * this.editor.resolution);
                const eIdx = zone.endSegIndex * this.editor.resolution + Math.floor(zone.endT * this.editor.resolution);
                const pStart = track[Math.min(sIdx, track.length - 1)];
                const pEnd = track[Math.min(eIdx, track.length - 1)];
                if (pStart && Math.hypot(wx - pStart.x, wy - pStart.y) < 15 / this.renderer.scale) {
                    this.data.snapshot();
                    this.dragging = { type: 'zone_start_handle', obj: zone };
                    return;
                }
                if (pEnd && Math.hypot(wx - pEnd.x, wy - pEnd.y) < 15 / this.renderer.scale) {
                    this.data.snapshot();
                    this.dragging = { type: 'zone_end_handle', obj: zone };
                    return;
                }
            }
        }

        // 4a. Straight mode zone label (first one, draggable)
        const firstSMZ = this.data.zones.find(z => z.type === 'straight_mode');
        if (firstSMZ) {
            const si = firstSMZ.segIndex * this.editor.resolution + Math.floor(firstSMZ.t * this.editor.resolution);
            const ei = firstSMZ.endSegIndex * this.editor.resolution + Math.floor(firstSMZ.endT * this.editor.resolution);
            const midIdx = Math.floor((Math.min(si, ei) + Math.max(si, ei)) / 2);
            const pMid = track[midIdx];
            if (pMid) {
                const lx = pMid.x + (firstSMZ.labelOffsetX || 0);
                const ly = pMid.y + (firstSMZ.labelOffsetY || 0);
                if (Math.hypot(wx - lx, wy - ly) < 30 / this.renderer.scale) {
                    this.data.snapshot();
                    this.app.setSelection({ type: 'zone', id: firstSMZ.id });
                    this.dragging = { 
                        type: 'zone_label', obj: firstSMZ, anchor: pMid,
                        dragOffsetX: wx - lx, dragOffsetY: wy - ly 
                    };
                    return;
                }
            }
        }

        // 4b. Telemetry Zone Circles (Overtake Detection, Overtake Activation, Speed Trap)
        for (const zone of this.data.zones) {
            const pos = this.editor.getZoneWorldPos(zone);
            if (!pos) continue;
            // Drag the circle along track
            if (Math.hypot(wx - pos.x, wy - pos.y) < 15 / this.renderer.scale) {
                this.data.snapshot();
                this.app.setSelection({ type: 'zone', id: zone.id });
                this.dragging = { type: 'zone_circle', obj: zone };
                return;
            }
            // Drag the label container offset
            const lx = pos.x + zone.labelOffsetX;
            const ly = pos.y + zone.labelOffsetY;
            if (this._hitRotatedRect(wx, wy, lx, ly, zone.rotation, 45 / this.renderer.scale, 15 / this.renderer.scale)) {
                this.data.snapshot();
                this.app.setSelection({ type: 'zone', id: zone.id });
                this.dragging = { 
                    type: 'zone_label', obj: zone, anchor: pos,
                    dragOffsetX: wx - lx, dragOffsetY: wy - ly
                };
                return;
            }
        }

        // 5. Turn Markers
        for (const tm of this.data.turnMarkers) {
            const idx = tm.segIndex * this.editor.resolution + Math.floor(tm.t * this.editor.resolution);
            const p = track[Math.min(idx, track.length - 1)];
            if (!p) continue;
            const actualSgn = tm.side === 'left' ? -1 : 1;
            const w = actualSgn < 0 ? p.widthLeft : p.widthRight;
            const sw = actualSgn < 0 ? ((p.surfaceLeft || p.barrierLeft) ? (p.surfaceWidthLeft || 10) : 0) : ((p.surfaceRight || p.barrierRight) ? (p.surfaceWidthRight || 10) : 0);
            const offset = w + sw + 13;
            const tmx = p.x + p.nx * offset * actualSgn;
            const tmy = p.y + p.ny * offset * actualSgn;
            if (Math.hypot(wx - tmx, wy - tmy) < 20 / this.renderer.scale) {
                this.data.snapshot();
                this.app.setSelection({ type: 'turn', id: tm.id });
                this.dragging = { type: 'turn', obj: tm };
                return;
            }
        }

        // 6. Sector Labels
        for (const sl of this.data.sectorLabels) {
            const pts = track.filter(pt => pt.sector === sl.sector);
            if (pts.length) {
                const mid = pts[Math.floor(pts.length / 2)];
                const slx = mid.x + (sl.labelOffsetX || 0);
                const sly = mid.y + (sl.labelOffsetY || 0);
                if (this._hitRotatedRect(wx, wy, slx, sly, sl.rotation, 45 / this.renderer.scale, 15 / this.renderer.scale)) {
                    this.data.snapshot();
                    this.app.setSelection({ type: 'sector_label', sector: sl.sector });
                    this.dragging = { 
                        type: 'sector_label', obj: sl, anchor: mid,
                        dragOffsetX: wx - slx, dragOffsetY: wy - sly
                    };
                    return;
                }
            }
        }

        // 7. Grandstands
        const gs = this.editor.findNearestGrandstand(wx, wy, 50 / this.renderer.scale);
        if (gs) { this.data.snapshot(); this.app.setSelection({ type: 'grandstand', id: gs.id }); this.dragging = { type: 'grandstand', obj: gs }; return; }

        // 8. Garages
        let bestG = null, bestGD = 30 / this.renderer.scale;
        for (const g of this.data.garages) { const d = Math.hypot(g.x - wx, g.y - wy); if (d < bestGD) { bestGD = d; bestG = g; } }
        if (bestG) { this.data.snapshot(); this.app.setSelection({ type: 'garage', id: bestG.id }); this.dragging = { type: 'garage', obj: bestG }; return; }

        // 9. Pit lane points
        const pp = this.editor.findNearestPitPoint(wx, wy, 15 / this.renderer.scale);
        if (pp) { this.data.snapshot(); this.app.setSelection({ type: 'pit', id: pp.id }); this.dragging = { type: 'pit', obj: pp }; return; }

        // 10. Click near track to select zones generally
        const zone = this.editor.findNearestZone(wx, wy, 20 / this.renderer.scale);
        if (zone) { this.app.setSelection({ type: 'zone', id: zone.id }); return; }

        this.app.setSelection(null);
    }

    onMouseMove(wx, wy) {
        if (this.rotatingObj) {
            // For objects with direct x/y
            if (this.rotatingObj.x !== undefined && this.rotatingObj.y !== undefined) {
                const a = Math.atan2(wx - this.rotatingObj.x, this.rotatingObj.y - wy) * 180 / Math.PI;
                this.rotatingObj.rotation = ((a % 360) + 360) % 360;
            } else if (this.rotatingObj.labelOffsetX !== undefined || this.rotatingObj.side !== undefined) {
                // For labels and turn markers, use screen center
                const s = this.renderer.w2s(wx, wy);
                const rc = this._getRotatingCenter();
                if (rc) {
                    const a = Math.atan2(s.x - rc.x, rc.y - s.y) * 180 / Math.PI;
                    this.rotatingObj.rotation = ((a % 360) + 360) % 360;
                }
            }
            this.app.uiManager.updateProperties(); this.app.requestRender(); return;
        }

        if (this.dragging) {
            const type = this.dragging.type;
            const obj = this.dragging.obj;

            if (type === 'cp' || type === 'grandstand' || type === 'garage' || type === 'pit') {
                obj.x = wx; obj.y = wy;
            }
            else if (type === 'turn') {
                const n = this.editor.findNearestTrackPoint(wx, wy);
                if (n.point) { obj.segIndex = n.point.segIndex; obj.t = n.point.t; }
            }
            else if (type === 'zone_circle') {
                const n = this.editor.findNearestTrackPoint(wx, wy);
                if (n.point) { obj.segIndex = n.point.segIndex; obj.t = n.point.t; }
            }
            else if (type === 'zone_label') {
                const anchor = this.dragging.anchor;
                obj.labelOffsetX = (wx - this.dragging.dragOffsetX) - anchor.x;
                obj.labelOffsetY = (wy - this.dragging.dragOffsetY) - anchor.y;
            }
            else if (type === 'sector_label') {
                const anchor = this.dragging.anchor;
                obj.labelOffsetX = (wx - this.dragging.dragOffsetX) - anchor.x;
                obj.labelOffsetY = (wy - this.dragging.dragOffsetY) - anchor.y;
            }
            else if (type === 'zone_start_handle') {
                const n = this.editor.findNearestTrackPoint(wx, wy);
                if (n.point) { obj.segIndex = n.point.segIndex; obj.t = n.point.t; }
            }
            else if (type === 'zone_end_handle') {
                const n = this.editor.findNearestTrackPoint(wx, wy);
                if (n.point) { obj.endSegIndex = n.point.segIndex; obj.endT = n.point.t; }
            }

            this.app.requestRender();
            return;
        }

        const cp = this.editor.findNearestControlPoint(wx, wy, 30 / this.renderer.scale);
        this.app.hoverPoint = cp;
        const rotObj = this._hitRotationHandle(wx, wy);
        if (rotObj) {
            this.app.canvas.style.cursor = 'grab';
        } else if (cp) {
            this.app.canvas.style.cursor = 'pointer';
        } else {
            // Check if hovering over any selectable element for move cursor
            let overElement = false;
            const track = this.editor.getInterpolatedTrack();
            for (const zone of this.data.zones) {
                const zt = F1.ZONE_TYPES.find(t => t.key === zone.type);
                if (zt && zt.range) continue;
                const pos = this.editor.getZoneWorldPos(zone);
                const lx = pos.x + zone.labelOffsetX, ly = pos.y + zone.labelOffsetY;
                if (pos && this._hitRotatedRect(wx, wy, lx, ly, zone.rotation, 45 / this.renderer.scale, 15 / this.renderer.scale)) { overElement = true; break; }
            }
            if (!overElement) {
                for (const sl of this.data.sectorLabels) {
                    const pts = track.filter(pt => pt.sector === sl.sector);
                    if (pts.length) {
                        const mid = pts[Math.floor(pts.length / 2)];
                        const lx = mid.x + (sl.labelOffsetX || 0), ly = mid.y + (sl.labelOffsetY || 0);
                        if (this._hitRotatedRect(wx, wy, lx, ly, sl.rotation, 45 / this.renderer.scale, 15 / this.renderer.scale)) { overElement = true; break; }
                    }
                }
            }
            if (!overElement) {
                for (const tm of this.data.turnMarkers) {
                    const idx = tm.segIndex * this.editor.resolution + Math.floor(tm.t * this.editor.resolution);
                    const p = track[Math.min(idx, track.length - 1)]; if (!p) continue;
                    const sgn = this._getOutsideSgn(p);
                    const w = sgn > 0 ? p.widthLeft : p.widthRight;
                    const sw = sgn > 0 ? ((p.surfaceLeft || p.barrierLeft) ? (p.surfaceWidthLeft || 10) : 0) : ((p.surfaceRight || p.barrierRight) ? (p.surfaceWidthRight || 10) : 0);
                    const offset = w + sw + 13;
                    const tmx = p.x + p.nx * offset * sgn, tmy = p.y + p.ny * offset * sgn;
                    if (Math.hypot(wx - tmx, wy - tmy) < 15 / this.renderer.scale) { overElement = true; break; }
                }
            }
            if (!overElement) {
                for (const g of this.data.garages) { if (Math.hypot(g.x - wx, g.y - wy) < 30 / this.renderer.scale) { overElement = true; break; } }
            }
            if (!overElement) {
                const gs = this.editor.findNearestGrandstand(wx, wy, 50 / this.renderer.scale);
                if (gs) overElement = true;
            }
            this.app.canvas.style.cursor = overElement ? 'move' : 'default';
        }
        this.app.requestRender();
    }

    _getRotatingCenter() {
        const sel = this.app.selection; if (!sel) return null;
        if (sel.type === 'sector_label') {
            const sl = this.data.sectorLabels.find(s => s.sector === sel.sector); if (!sl) return null;
            const track = this.editor.getInterpolatedTrack();
            const pts = track.filter(pt => pt.sector === sl.sector); if (!pts.length) return null;
            const mid = pts[Math.floor(pts.length / 2)]; const sMid = this.renderer.w2s(mid.x, mid.y);
            return { x: sMid.x + sl.labelOffsetX * this.renderer.scale, y: sMid.y + sl.labelOffsetY * this.renderer.scale };
        }
        if (sel.type === 'zone') {
            const zone = this.data.getZoneById(sel.id); if (!zone) return null;
            const zt = F1.ZONE_TYPES.find(z => z.key === zone.type);
            if (zt && zt.range) {
                const track = this.editor.getInterpolatedTrack();
                const si = zone.segIndex * this.editor.resolution + Math.floor(zone.t * this.editor.resolution);
                const ei = zone.endSegIndex * this.editor.resolution + Math.floor(zone.endT * this.editor.resolution);
                const midIdx = Math.floor((Math.min(si, ei) + Math.max(si, ei)) / 2);
                const pMid = track[midIdx]; if (!pMid) return null;
                const sMid = this.renderer.w2s(pMid.x, pMid.y);
                return { x: sMid.x + (zone.labelOffsetX || 0) * this.renderer.scale, y: sMid.y + (zone.labelOffsetY || 0) * this.renderer.scale };
            }
            const pos = this.editor.getZoneWorldPos(zone); if (!pos) return null;
            const s = this.renderer.w2s(pos.x, pos.y);
            return { x: s.x + zone.labelOffsetX * this.renderer.scale, y: s.y + zone.labelOffsetY * this.renderer.scale };
        }
        if (sel.type === 'turn') {
            const tm = this.data.getTurnMarkerById(sel.id); if (!tm) return null;
            const track = this.editor.getInterpolatedTrack();
            const idx = tm.segIndex * this.editor.resolution + Math.floor(tm.t * this.editor.resolution);
            const p = track[Math.min(idx, track.length - 1)]; if (!p) return null;
            const actualSgn = tm.side === 'left' ? -1 : 1;
            const w = actualSgn < 0 ? p.widthLeft : p.widthRight;
            const sw = actualSgn < 0 ? ((p.surfaceLeft || p.barrierLeft) ? (p.surfaceWidthLeft || 10) : 0) : ((p.surfaceRight || p.barrierRight) ? (p.surfaceWidthRight || 10) : 0);
            const offset = w + sw + 13;
            return this.renderer.w2s(p.x + p.nx * offset * actualSgn, p.y + p.ny * offset * actualSgn);
        }
        return null;
    }

    onMouseUp() { this.dragging = null; this.rotatingObj = null; }

    onKeyDown(e) {
        if ((e.key === 'Delete' || e.key === 'Backspace') && this.app.selection) {
            this.data.snapshot(); const s = this.app.selection;
            if (s.type === 'cp') this.data.removeControlPoint(s.id);
            else if (s.type === 'grandstand') this.data.removeGrandstand(s.id);
            else if (s.type === 'zone') this.data.removeZone(s.id);
            else if (s.type === 'garage') this.data.removeGarage(s.id);
            else if (s.type === 'turn') this.data.removeTurnMarker(s.id);
            else if (s.type === 'pit') { this.data.pitLane.points = this.data.pitLane.points.filter(p => p.id !== s.id); }
            this.app.setSelection(null); this.app.requestRender();
        }
    }
}

/* ---- Turn Placement Tool ---- */
class TurnTool extends BaseTool {
    constructor(app) { super(app); this.dragging = null; this.rotatingObj = null; }
    getCursor() { return this.rotatingObj ? 'grabbing' : 'crosshair'; }

    _hitRotationHandle(wx, wy) {
        const sel = this.app.selection;
        if (sel && sel.type === 'turn') {
            const tm = this.data.getTurnMarkerById(sel.id); if (!tm) return null;
            const track = this.editor.getInterpolatedTrack();
            const idx = tm.segIndex * this.editor.resolution + Math.floor(tm.t * this.editor.resolution);
            const p = track[Math.min(idx, track.length - 1)]; if (!p) return null;
            const actualSgn = tm.side === 'left' ? -1 : 1;
            const w = actualSgn < 0 ? p.widthLeft : p.widthRight;
            const sw = actualSgn < 0 ? ((p.surfaceLeft || p.barrierLeft) ? (p.surfaceWidthLeft || 10) : 0) : ((p.surfaceRight || p.barrierRight) ? (p.surfaceWidthRight || 10) : 0);
            const offset = w + sw + 13;
            const tmx = p.x + p.nx * offset * actualSgn, tmy = p.y + p.ny * offset * actualSgn;
            const s = this.renderer.w2s(tmx, tmy);
            const rad = (tm.rotation || 0) * Math.PI / 180;
            const hx = s.x + Math.sin(rad) * 22, hy = s.y - Math.cos(rad) * 22;
            const sW = this.renderer.w2s(wx, wy);
            if (Math.hypot(sW.x - hx, sW.y - hy) < 20) return tm;
        }
        return null;
    }

    _getRotatingCenter() {
        const sel = this.app.selection; if (!sel || sel.type !== 'turn') return null;
        const tm = this.data.getTurnMarkerById(sel.id); if (!tm) return null;
        const track = this.editor.getInterpolatedTrack();
        const idx = tm.segIndex * this.editor.resolution + Math.floor(tm.t * this.editor.resolution);
        const p = track[Math.min(idx, track.length - 1)]; if (!p) return null;
        const actualSgn = tm.side === 'left' ? -1 : 1;
        const w = actualSgn < 0 ? p.widthLeft : p.widthRight;
        const sw = actualSgn < 0 ? ((p.surfaceLeft || p.barrierLeft) ? (p.surfaceWidthLeft || 10) : 0) : ((p.surfaceRight || p.barrierRight) ? (p.surfaceWidthRight || 10) : 0);
        const offset = w + sw + 13;
        const tmx = p.x + p.nx * offset * actualSgn, tmy = p.y + p.ny * offset * actualSgn;
        return this.renderer.w2s(tmx, tmy);
    }

    _hitExisting(wx, wy) {
        const track = this.editor.getInterpolatedTrack();
        for (const tm of this.data.turnMarkers) {
            const idx = tm.segIndex * this.editor.resolution + Math.floor(tm.t * this.editor.resolution);
            const p = track[Math.min(idx, track.length - 1)]; if (!p) continue;
            const actualSgn = tm.side === 'left' ? -1 : 1;
            const w = actualSgn < 0 ? p.widthLeft : p.widthRight;
            const sw = actualSgn < 0 ? ((p.surfaceLeft || p.barrierLeft) ? (p.surfaceWidthLeft || 10) : 0) : ((p.surfaceRight || p.barrierRight) ? (p.surfaceWidthRight || 10) : 0);
            const offset = w + sw + 13;
            const tmx = p.x + p.nx * offset * actualSgn, tmy = p.y + p.ny * offset * actualSgn;
            if (Math.hypot(wx - tmx, wy - tmy) < 15 / this.renderer.scale) return tm;
        }
        return null;
    }

    onMouseDown(wx, wy) {
        const rotObj = this._hitRotationHandle(wx, wy);
        if (rotObj) { this.data.snapshot(); this.rotatingObj = rotObj; return; }

        const ex = this._hitExisting(wx, wy);
        if (ex) { this.data.snapshot(); this.app.setSelection({ type: 'turn', id: ex.id }); this.dragging = ex; return; }
        const n = this.editor.findNearestTrackPoint(wx, wy);
        if (!n.point || n.dist > 60 / this.renderer.scale) return;
        this.data.snapshot();
        const label = (this.data.turnMarkers.length + 1).toString();
        const tm = this.data.addTurnMarker(n.point.segIndex, n.point.t, label);
        this.app.setSelection({ type: 'turn', id: tm.id });
        this.app.requestRender();
    }

    onMouseMove(wx, wy) {
        if (this.rotatingObj) {
            const s = this.renderer.w2s(wx, wy);
            const rc = this._getRotatingCenter();
            if (rc) {
                const a = Math.atan2(s.x - rc.x, rc.y - s.y) * 180 / Math.PI;
                this.rotatingObj.rotation = ((a % 360) + 360) % 360;
            }
            this.app.uiManager.updateProperties(); this.app.requestRender(); return;
        }
        if (this.dragging) {
            const n = this.editor.findNearestTrackPoint(wx, wy);
            if (n.point) { this.dragging.segIndex = n.point.segIndex; this.dragging.t = n.point.t; }
            this.app.requestRender(); return;
        }
        const rotObj = this._hitRotationHandle(wx, wy);
        const ex = this._hitExisting(wx, wy);
        this.app.canvas.style.cursor = rotObj ? 'grab' : (ex ? 'move' : 'crosshair');
    }
    onMouseUp() { this.dragging = null; this.rotatingObj = null; }
}

/* ---- Draw Track ---- */
class DrawTrackTool extends BaseTool {
    getCursor() { return 'crosshair'; }
    onMouseDown(wx, wy) {
        if (this.data.isClosed) return;
        if (this.editor.isNearFirstPoint(wx, wy, 20 / this.renderer.scale)) {
            this.data.snapshot(); this.data.closeTrack();
            this.app.setStatus('Circuit closed! First turn=S1, last=S3. Assign remaining sectors.');
            this.app.requestRender(); return;
        }
        this.data.snapshot();
        const pt = this.data.addControlPoint(wx, wy);
        this.app.setSelection({ type: 'cp', id: pt.id }); this.app.requestRender();
    }
    onMouseMove(wx, wy) {
        this.app.hoverPoint = !this.data.isClosed && this.editor.isNearFirstPoint(wx, wy, 20 / this.renderer.scale) ? this.data.controlPoints[0] : null;
        this.app.requestRender();
    }
}

/* ---- Insert Node ---- */
class NodeTool extends BaseTool {
    constructor(app) {
        super(app);
        this.hoverNode = null;
        this.draggingNode = null;
    }
    getCursor() { return (this.hoverNode || this.draggingNode) ? 'move' : 'crosshair'; }
    onMouseMove(wx, wy) {
        if (this.draggingNode) {
            this.draggingNode.x = wx;
            this.draggingNode.y = wy;
            const px = document.getElementById('prop-x-val');
            if (px) px.value = wx.toFixed(2);
            const py = document.getElementById('prop-y-val');
            if (py) py.value = wy.toFixed(2);
            this.app.requestRender();
            return;
        }
        this.hoverNode = null;
        for (const pt of this.data.controlPoints) {
            const sPt = this.renderer.w2s(pt.x, pt.y);
            const sW = this.renderer.w2s(wx, wy);
            if (Math.hypot(sW.x - sPt.x, sW.y - sPt.y) < 12) {
                this.hoverNode = pt;
                break;
            }
        }
        this.app.canvas.style.cursor = this.getCursor();
        this.app.hoverPoint = this.hoverNode;
        this.app.requestRender();
    }
    onMouseDown(wx, wy) {
        if (this.hoverNode) {
            this.app.setSelection({ type: 'cp', id: this.hoverNode.id });
            this.data.snapshot();
            this.draggingNode = this.hoverNode;
            return;
        }
        this.app.setSelection(null);
        const n = this.editor.findNearestTrackPoint(wx, wy);
        if (n.point && n.dist < 30 / this.renderer.scale) {
            this.data.snapshot();
            const pt = this.data.insertControlPoint(wx, wy, n.point.segIndex + 1);
            this.app.setSelection({ type: 'cp', id: pt.id });
            this.app.requestRender();
        }
    }
    onMouseUp(wx, wy) {
        if (this.draggingNode) {
            this.draggingNode = null;
            this.app.uiManager.updateProperties();
        }
    }
}

/* ---- Width (track + surface) ---- */
class WidthTool extends BaseTool {
    constructor(app) { super(app); this.dragging = null; this.startY = 0; this.startW = 0; this.side = 'both'; this.mode = 'track'; }
    getCursor() { return 'ns-resize'; }
    setSide(s) { this.side = s; }
    setMode(m) { this.mode = m; }
    onMouseDown(wx, wy) {
        const cp = this.editor.findNearestControlPoint(wx, wy, 25 / this.renderer.scale);
        if (cp) {
            this.data.snapshot(); this.dragging = cp; this.startY = wy;
            this.startW = this.mode === 'surface' ? cp.surfaceWidthLeft : cp.widthLeft;
            this.app.setSelection({ type: 'cp', id: cp.id });
        }
    }
    onMouseMove(wx, wy) {
        if (this.dragging) {
            const d = (this.startY - wy) * 0.3;
            const isSurf = this.mode === 'surface';
            const nw = Math.max(isSurf ? 2 : 5, Math.min(isSurf ? 50 : 40, this.startW + d));
            if (isSurf) {
                if (this.side === 'left' || this.side === 'both') this.dragging.surfaceWidthLeft = nw;
                if (this.side === 'right' || this.side === 'both') this.dragging.surfaceWidthRight = nw;
            } else {
                if (this.side === 'left' || this.side === 'both') this.dragging.widthLeft = nw;
                if (this.side === 'right' || this.side === 'both') this.dragging.widthRight = nw;
            }
            this.app.uiManager.updateProperties(); this.app.requestRender();
        } else { this.app.hoverPoint = this.editor.findNearestControlPoint(wx, wy, 25 / this.renderer.scale); this.app.requestRender(); }
    }
    onMouseUp() { this.dragging = null; }
}

/* ---- Surface Painter ---- */
class SurfacePainterTool extends BaseTool {
    constructor(app) { super(app); this.surfaceType = 'gravel'; this.painting = false; }
    getCursor() { return 'cell'; }
    _apply(wx, wy) {
        const n = this.editor.findNearestTrackPoint(wx, wy);
        if (!n.point || n.dist > 60 / this.renderer.scale) return;
        const pt = this.data.controlPoints[n.point.segIndex]; if (!pt) return;
        const p = n.point;
        const dL = Math.hypot(wx - (p.x - p.nx * p.widthLeft), wy - (p.y - p.ny * p.widthLeft));
        const dR = Math.hypot(wx - (p.x + p.nx * p.widthRight), wy - (p.y + p.ny * p.widthRight));
        if (dL < dR) pt.surfaceLeft = this.surfaceType; else pt.surfaceRight = this.surfaceType;
        this.app.requestRender();
    }
    onMouseDown(wx, wy) { this.data.snapshot(); this.painting = true; this._apply(wx, wy); }
    onMouseMove(wx, wy) { if (this.painting) this._apply(wx, wy); }
    onMouseUp() { this.painting = false; }
}

/* ---- Barrier ---- */
class BarrierPainterTool extends BaseTool {
    constructor(app) { super(app); this.painting = false; this.barrierOn = true; }
    getCursor() { return 'cell'; }
    _apply(wx, wy) {
        const n = this.editor.findNearestTrackPoint(wx, wy);
        if (!n.point || n.dist > 80 / this.renderer.scale) return;
        const pt = this.data.controlPoints[n.point.segIndex]; if (!pt) return;
        const p = n.point;
        const dL = Math.hypot(wx - (p.x - p.nx * (p.widthLeft + (p.surfaceWidthLeft ?? 10))), wy - (p.y - p.ny * (p.widthLeft + (p.surfaceWidthLeft ?? 10))));
        const dR = Math.hypot(wx - (p.x + p.nx * (p.widthRight + (p.surfaceWidthRight ?? 10))), wy - (p.y + p.ny * (p.widthRight + (p.surfaceWidthRight ?? 10))));
        if (dL < dR) pt.barrierLeft = this.barrierOn; else pt.barrierRight = this.barrierOn;
        this.app.requestRender();
    }
    onMouseDown(wx, wy) { this.data.snapshot(); this.painting = true; this._apply(wx, wy); }
    onMouseMove(wx, wy) { if (this.painting) this._apply(wx, wy); }
    onMouseUp() { this.painting = false; }
}

/* ---- Sector ---- */
class SectorTool extends BaseTool {
    constructor(app) { super(app); this.currentSector = 1; this.painting = false; this.dragging = null; this.rotatingObj = null; }
    getCursor() { return this.rotatingObj ? 'grabbing' : 'pointer'; }

    _hitRotationHandle(wx, wy) {
        const sel = this.app.selection;
        if (sel && sel.type === 'sector_label') {
            const sl = this.data.sectorLabels.find(s => s.sector === sel.sector); if (!sl) return null;
            const track = this.editor.getInterpolatedTrack();
            const pts = track.filter(pt => pt.sector === sl.sector); if (!pts.length) return null;
            const mid = pts[Math.floor(pts.length / 2)];
            const s = this.renderer.w2s(mid.x + (sl.labelOffsetX || 0), mid.y + (sl.labelOffsetY || 0));
            const rad = (sl.rotation || 0) * Math.PI / 180;
            const hx = s.x + Math.sin(rad) * 22, hy = s.y - Math.cos(rad) * 22;
            const sW = this.renderer.w2s(wx, wy);
            if (Math.hypot(sW.x - hx, sW.y - hy) < 20) return sl;
        }
        return null;
    }

    _getRotatingCenter() {
        const sel = this.app.selection; if (!sel || sel.type !== 'sector_label') return null;
        const sl = this.data.sectorLabels.find(s => s.sector === sel.sector); if (!sl) return null;
        const track = this.editor.getInterpolatedTrack();
        const pts = track.filter(pt => pt.sector === sl.sector); if (!pts.length) return null;
        const mid = pts[Math.floor(pts.length / 2)];
        return this.renderer.w2s(mid.x + (sl.labelOffsetX || 0), mid.y + (sl.labelOffsetY || 0));
    }

    _hitExisting(wx, wy) {
        const track = this.editor.getInterpolatedTrack();
        for (const sl of this.data.sectorLabels) {
            const pts = track.filter(pt => pt.sector === sl.sector);
            if (pts.length) {
                const mid = pts[Math.floor(pts.length / 2)];
                if (this._hitRotatedRect(wx, wy, mid.x + (sl.labelOffsetX || 0), mid.y + (sl.labelOffsetY || 0), sl.rotation, 45 / this.renderer.scale, 15 / this.renderer.scale)) {
                    return { sl, anchor: mid };
                }
            }
        }
        return null;
    }

    _apply(wx, wy) {
        const cp = this.editor.findNearestControlPoint(wx, wy, 30 / this.renderer.scale);
        if (cp && cp.sector !== this.currentSector) { 
            cp.sector = this.currentSector; 
            this.editor._needsUpdate = true;
            this.app.requestRender(); 
            this.app.uiManager.updateProperties(); 
        }
    }
    
    onMouseDown(wx, wy) {
        const rotObj = this._hitRotationHandle(wx, wy);
        if (rotObj) { this.data.snapshot(); this.rotatingObj = rotObj; return; }

        // 1. TIGHT check for painting exactly on a node
        const cpTight = this.editor.findNearestControlPoint(wx, wy, 8 / this.renderer.scale);
        if (cpTight) {
            this.data.snapshot(); this.painting = true; this._apply(wx, wy); return;
        }

        // 2. Otherwise, allow selecting/dragging the label
        const hit = this._hitExisting(wx, wy);
        if (hit) {
            this.data.snapshot();
            this.app.setSelection({ type: 'sector_label', sector: hit.sl.sector });
            this.dragging = hit; 
            this.dragging.dragOffsetX = wx - (hit.anchor.x + (hit.sl.labelOffsetX || 0));
            this.dragging.dragOffsetY = wy - (hit.anchor.y + (hit.sl.labelOffsetY || 0));
            return;
        }

        // 3. Fallback: if we missed the exact node but still want to paint (e.g. clicking near a node)
        const cpLoose = this.editor.findNearestControlPoint(wx, wy, 25 / this.renderer.scale);
        if (cpLoose) {
            this.data.snapshot(); this.painting = true; this._apply(wx, wy); return;
        }

        this.data.snapshot(); this.painting = true; this._apply(wx, wy);
    }
    
    onMouseMove(wx, wy) {
        if (this.rotatingObj) {
            const s = this.renderer.w2s(wx, wy);
            const rc = this._getRotatingCenter();
            if (rc) {
                const a = Math.atan2(s.x - rc.x, rc.y - s.y) * 180 / Math.PI;
                this.rotatingObj.rotation = ((a % 360) + 360) % 360;
            }
            this.app.uiManager.updateProperties(); this.app.requestRender(); return;
        }
        if (this.dragging) {
            this.dragging.sl.labelOffsetX = (wx - this.dragging.dragOffsetX) - this.dragging.anchor.x;
            this.dragging.sl.labelOffsetY = (wy - this.dragging.dragOffsetY) - this.dragging.anchor.y;
            this.app.requestRender(); return;
        }
        if (this.painting) this._apply(wx, wy);
        else {
            const rotObj = this._hitRotationHandle(wx, wy);
            const ex = this._hitExisting(wx, wy);
            this.app.canvas.style.cursor = rotObj ? 'grab' : (ex ? 'move' : 'pointer');
        }
    }
    onMouseUp() { this.painting = false; this.dragging = null; this.rotatingObj = null; }
}

/* ---- Pit Lane ---- */
class PitLaneTool extends BaseTool {
    getCursor() { return 'crosshair'; }
    onMouseDown(wx, wy) {
        // Check if clicking near existing pit point to select it
        const pp = this.editor.findNearestPitPoint(wx, wy, 12 / this.renderer.scale);
        if (pp) { this.app.setSelection({ type: 'pit', id: pp.id }); this.app.requestRender(); return; }
        this.data.snapshot(); this.data.addPitLanePoint(wx, wy); this.app.requestRender();
    }
    onMouseMove(wx, wy) { this.app.hoverPoint = this.editor.findNearestPitPoint(wx, wy, 15 / this.renderer.scale); this.app.requestRender(); }
}

/* ---- Grandstand ---- */
class GrandstandTool extends BaseTool {
    constructor(app) { super(app); this.dragging = null; this.rotatingGS = null; }
    getCursor() { return this.rotatingGS ? 'grabbing' : 'crosshair'; }

    _hitExistingGS(wx, wy) {
        return this.editor.findNearestGrandstand(wx, wy, 40 / this.renderer.scale);
    }
    _hitRotHandle(wx, wy) {
        for (const gs of this.data.grandstands) {
            const rad = (gs.rotation || 0) * Math.PI / 180;
            const hd = (gs.height / 2) + 20 / this.renderer.scale;
            const hx = gs.x + Math.sin(rad) * -hd, hy = gs.y + Math.cos(rad) * hd;
            if (Math.hypot(wx - hx, wy - hy) < 15 / this.renderer.scale) return gs;
        }
        return null;
    }

    onMouseDown(wx, wy) {
        // Check rotation handle first
        const rot = this._hitRotHandle(wx, wy);
        if (rot) { this.data.snapshot(); this.rotatingGS = rot; this.app.setSelection({ type: 'grandstand', id: rot.id }); return; }
        // Check if clicking on existing grandstand to select/move
        const gs = this._hitExistingGS(wx, wy);
        if (gs) { this.data.snapshot(); this.app.setSelection({ type: 'grandstand', id: gs.id }); this.dragging = gs; return; }
        // Otherwise place new
        this.data.snapshot(); const ngs = this.data.addGrandstand(wx, wy);
        this.app.setSelection({ type: 'grandstand', id: ngs.id }); this.app.requestRender();
    }
    onMouseMove(wx, wy) {
        if (this.rotatingGS) {
            const a = Math.atan2(wx - this.rotatingGS.x, this.rotatingGS.y - wy) * 180 / Math.PI;
            this.rotatingGS.rotation = ((a % 360) + 360) % 360;
            this.app.uiManager.updateProperties(); this.app.requestRender(); return;
        }
        if (this.dragging) { this.dragging.x = wx; this.dragging.y = wy; this.app.requestRender(); return; }
        // Cursor: if near rotation handle -> grab, near existing -> move, else crosshair
        const rot = this._hitRotHandle(wx, wy);
        const gs = this._hitExistingGS(wx, wy);
        this.app.canvas.style.cursor = rot ? 'grab' : (gs ? 'move' : 'crosshair');
        this.app.requestRender();
    }
    onMouseUp() { this.dragging = null; this.rotatingGS = null; }
}

/* ---- Zone Placement ---- */
class ZoneTool extends BaseTool {
    constructor(app) { super(app); this.zoneType = null; this._placingRange = null; this.dragging = null; this.rotatingZ = null; }
    activate() { this.zoneType = null; this._placingRange = null; }
    getCursor() { return this.rotatingZ ? 'grabbing' : 'crosshair'; }

    _hitRotationHandle(wx, wy) {
        const sel = this.app.selection;
        if (!sel || sel.type !== 'zone') return null;
        const zone = this.data.getZoneById(sel.id);
        if (!zone) return null;
        const zt = F1.ZONE_TYPES.find(z => z.key === zone.type);
        let anchorX, anchorY;
        if (zt && zt.range) {
            const track = this.editor.getInterpolatedTrack();
            const si = zone.segIndex * this.editor.resolution + Math.floor(zone.t * this.editor.resolution);
            const ei = zone.endSegIndex * this.editor.resolution + Math.floor(zone.endT * this.editor.resolution);
            const midIdx = Math.floor((Math.min(si, ei) + Math.max(si, ei)) / 2);
            const pMid = track[midIdx]; if (!pMid) return null;
            anchorX = pMid.x; anchorY = pMid.y;
        } else {
            const pos = this.editor.getZoneWorldPos(zone); if (!pos) return null;
            anchorX = pos.x; anchorY = pos.y;
        }
        const sA = this.renderer.w2s(anchorX, anchorY);
        const lx = sA.x + (zone.labelOffsetX || 0) * this.renderer.scale;
        const ly = sA.y + (zone.labelOffsetY || 0) * this.renderer.scale;
        const rad = (zone.rotation || 0) * Math.PI / 180;
        
        const sf = Math.max(0.9, this.renderer.scale);
        const text = zone.label ? zone.label.toUpperCase() : '';
        const lines = text.split('\n');
        const th = lines.length * 16 * sf + 6 * sf;
        const hd = th / 2 + 20;

        const hx = lx + Math.sin(rad) * hd, hy = ly - Math.cos(rad) * hd;
        const sW = this.renderer.w2s(wx, wy);
        if (Math.hypot(sW.x - hx, sW.y - hy) < 20) return zone;
        return null;
    }

    _hitExisting(wx, wy) {
        const rotObj = this._hitRotationHandle(wx, wy);
        if (rotObj && rotObj.type && (F1.ZONE_TYPES.find(z => z.key === rotObj.type))) return { type: 'zone_rotation', obj: rotObj };
        const track = this.editor.getInterpolatedTrack();
        const isSMZ = this.zoneType === 'straight_mode';
        
        if (isSMZ) {
            // SMZ Range Handles (if selected)
            const sel = this.app.selection;
            if (sel && sel.type === 'zone') {
                const zone = this.data.getZoneById(sel.id);
                if (zone && zone.type === 'straight_mode') {
                    const sIdx = zone.segIndex * this.editor.resolution + Math.floor(zone.t * this.editor.resolution);
                    const eIdx = zone.endSegIndex * this.editor.resolution + Math.floor(zone.endT * this.editor.resolution);
                    const pStart = track[Math.min(sIdx, track.length - 1)];
                    const pEnd = track[Math.min(eIdx, track.length - 1)];
                    if (pStart && Math.hypot(wx - pStart.x, wy - pStart.y) < 15 / this.renderer.scale) return { type: 'zone_start_handle', obj: zone };
                    if (pEnd && Math.hypot(wx - pEnd.x, wy - pEnd.y) < 15 / this.renderer.scale) return { type: 'zone_end_handle', obj: zone };
                }
            }

            // SMZ Labels
            for (const zone of this.data.zones) {
                if (zone.type !== 'straight_mode') continue;
                const si = zone.segIndex * this.editor.resolution + Math.floor(zone.t * this.editor.resolution);
                const ei = zone.endSegIndex * this.editor.resolution + Math.floor(zone.endT * this.editor.resolution);
                const midIdx = Math.floor((Math.min(si, ei) + Math.max(si, ei)) / 2);
                const pMid = track[midIdx];
                if (pMid) {
                    const lx = pMid.x + (zone.labelOffsetX || 0), ly = pMid.y + (zone.labelOffsetY || 0);
                    if (Math.hypot(wx - lx, wy - ly) < 30 / this.renderer.scale) return { type: 'zone_label', obj: zone, anchor: pMid };
                }
            }
        } else {
            // Telemetry zones
            for (const zone of this.data.zones) {
                if (zone.type === 'straight_mode') continue;
                const pos = this.editor.getZoneWorldPos(zone);
                if (!pos) continue;
                if (Math.hypot(wx - pos.x, wy - pos.y) < 15 / this.renderer.scale) return { type: 'zone_circle', obj: zone };
                const lx = pos.x + zone.labelOffsetX, ly = pos.y + zone.labelOffsetY;
                if (this._hitRotatedRect(wx, wy, lx, ly, zone.rotation, 45 / this.renderer.scale, 15 / this.renderer.scale)) return { type: 'zone_label', obj: zone, anchor: pos };
            }
        }
        return null;
    }

    onMouseDown(wx, wy) {
        // 1. Always prioritize rotation handles
        const rotObj = this._hitRotationHandle(wx, wy);
        if (rotObj && rotObj.type && (F1.ZONE_TYPES.find(z => z.key === rotObj.type))) {
            this.data.snapshot();
            this.app.setSelection({ type: 'zone', id: rotObj.id });
            this.rotatingZ = rotObj;
            return;
        }


        if (this._placingRange) {
            const n = this.editor.findNearestTrackPoint(wx, wy);
            if (n.point && n.dist <= Math.max(100, 60 / this.renderer.scale)) {
                this._placingRange.endSegIndex = n.point.segIndex;
                this._placingRange.endT = n.point.t;
                this._placingRange = null; this.app.setStatus('Zone placed');
                this.app.requestRender();
                return;
            }
        }

        // 4. Place new zone (prioritize track placement over large labels)
        if (this.zoneType) {
            const n = this.editor.findNearestTrackPoint(wx, wy);
            if (n.point) {
                const trackRadius = (n.point.widthLeft + n.point.widthRight) / 2;
                const placeThreshold = Math.max(trackRadius, 20 / this.renderer.scale);
                if (n.dist <= placeThreshold) {
                    const zt = F1.ZONE_TYPES.find(z => z.key === this.zoneType);
                    if (zt && zt.range) {
                        this.data.snapshot(); const p = n.point;
                        const zone = this.data.addZone(this.zoneType, p.segIndex, p.t, p.nx * 60, p.ny * 60 - 40);
                        this._placingRange = zone; this.app.setSelection({ type: 'zone', id: zone.id });
                        this.app.setStatus('Click again to set zone end');
                    } else {
                        this.data.snapshot(); const p = n.point;
                        const zone = this.data.addZone(this.zoneType, p.segIndex, p.t, p.nx * 60, p.ny * 60 - 40);
                        this.app.setSelection({ type: 'zone', id: zone.id });
                        this.app.setStatus('Zone placed');
                    }
                    this.app.requestRender();
                    return;
                }
            }
        }

        const hit = this._hitExisting(wx, wy);
        if (hit) {
            this.data.snapshot();
            this.app.setSelection({ type: 'zone', id: hit.obj.id });
            if (hit.type === 'zone_rotation') {
                this.rotatingZ = hit.obj;
                this.dragging = null;
            } else {
                this.dragging = hit;
                if (hit.type === 'zone_label') {
                    const lx = hit.anchor.x + (hit.obj.labelOffsetX || 0);
                    const ly = hit.anchor.y + (hit.obj.labelOffsetY || 0);
                    this.dragging.dragOffsetX = wx - lx;
                    this.dragging.dragOffsetY = wy - ly;
                }
            }
            return;
        }
        this.app.setSelection(null);
    }

    onMouseMove(wx, wy) {
        if (this.rotatingZ) {
            const z = this.rotatingZ;
            const zt = F1.ZONE_TYPES.find(t => t.key === z.type);
            let cx, cy;
            if (zt && zt.range) {
                const track = this.editor.getInterpolatedTrack();
                const si = z.segIndex * this.editor.resolution + Math.floor(z.t * this.editor.resolution);
                const ei = z.endSegIndex * this.editor.resolution + Math.floor(z.endT * this.editor.resolution);
                const midIdx = Math.floor((Math.min(si, ei) + Math.max(si, ei)) / 2);
                const pMid = track[midIdx];
                if (!pMid) return;
                cx = pMid.x + (z.labelOffsetX || 0); cy = pMid.y + (z.labelOffsetY || 0);
            } else {
                const pos = this.editor.getZoneWorldPos(z);
                if (!pos) return;
                cx = pos.x + (z.labelOffsetX || 0); cy = pos.y + (z.labelOffsetY || 0);
            }
            let angle = Math.atan2(wy - cy, wx - cx) * 180 / Math.PI;
            if (angle < 0) angle += 360;
            z.rotation = angle;
            this.app.uiManager.updateProperties();
            this.app.requestRender();
            return;
        }
        if (this.dragging) {
            const type = this.dragging.type;
            const obj = this.dragging.obj;
            if (type === 'zone_circle') {
                const n = this.editor.findNearestTrackPoint(wx, wy);
                if (n.point) { obj.segIndex = n.point.segIndex; obj.t = n.point.t; }
            } else if (type === 'zone_label') {
                const anchor = this.dragging.anchor;
                obj.labelOffsetX = (wx - this.dragging.dragOffsetX) - anchor.x;
                obj.labelOffsetY = (wy - this.dragging.dragOffsetY) - anchor.y;
            }
            this.app.requestRender(); return;
        }

        const rotObj = this._hitRotationHandle(wx, wy);
        if (rotObj && rotObj.type && (F1.ZONE_TYPES.find(z => z.key === rotObj.type))) {
            this.app.canvas.style.cursor = 'grab';
            return;
        }

        const hit = this._hitExisting(wx, wy);
        if (hit && (hit.type === 'zone_label' || hit.type === 'zone_circle')) {
            this.app.canvas.style.cursor = 'move';
            return;
        }

        this.app.canvas.style.cursor = 'crosshair';
    }

    onMouseUp() { this.dragging = null; this.rotatingZ = null; }
    deactivate() { this._placingRange = null; this.dragging = null; this.rotatingZ = null; }
}

/* ---- Garage ---- */
class GarageTool extends BaseTool {
    constructor(app) { super(app); this.dragging = null; this.rotatingG = null; }
    getCursor() { return this.rotatingG ? 'grabbing' : 'crosshair'; }

    _hitExisting(wx, wy) {
        let best = null, bd = 30 / this.renderer.scale;
        for (const g of this.data.garages) { const d = Math.hypot(g.x - wx, g.y - wy); if (d < bd) { bd = d; best = g; } }
        return best;
    }
    _hitRotHandle(wx, wy) {
        for (const g of this.data.garages) {
            const rad = (g.rotation || 0) * Math.PI / 180;
            const hd = (g.height / 2) + 20 / this.renderer.scale;
            const hx = g.x + Math.sin(rad) * -hd, hy = g.y + Math.cos(rad) * hd;
            if (Math.hypot(wx - hx, wy - hy) < 15 / this.renderer.scale) return g;
        }
        return null;
    }

    onMouseDown(wx, wy) {
        const rot = this._hitRotHandle(wx, wy);
        if (rot) { this.data.snapshot(); this.rotatingG = rot; this.app.setSelection({ type: 'garage', id: rot.id }); return; }
        const g = this._hitExisting(wx, wy);
        if (g) { this.data.snapshot(); this.app.setSelection({ type: 'garage', id: g.id }); this.dragging = g; return; }
        this.data.snapshot(); const ng = this.data.addGarage(wx, wy);
        this.app.setSelection({ type: 'garage', id: ng.id }); this.app.requestRender();
    }
    onMouseMove(wx, wy) {
        if (this.rotatingG) {
            const a = Math.atan2(wx - this.rotatingG.x, this.rotatingG.y - wy) * 180 / Math.PI;
            this.rotatingG.rotation = ((a % 360) + 360) % 360;
            this.app.uiManager.updateProperties(); this.app.requestRender(); return;
        }
        if (this.dragging) { this.dragging.x = wx; this.dragging.y = wy; this.app.requestRender(); return; }
        const rot = this._hitRotHandle(wx, wy);
        const g = this._hitExisting(wx, wy);
        this.app.canvas.style.cursor = rot ? 'grab' : (g ? 'move' : 'crosshair');
        this.app.requestRender();
    }
    onMouseUp() { this.dragging = null; this.rotatingG = null; }
}

/* ---- Eraser ---- */
class EraserTool extends BaseTool {
    getCursor() { return 'not-allowed'; }
    onMouseDown(wx, wy) {
        const cp = this.editor.findNearestControlPoint(wx, wy, 15 / this.renderer.scale);
        if (cp) { this.data.snapshot(); this.data.removeControlPoint(cp.id); this.app.requestRender(); return; }
        const gs = this.editor.findNearestGrandstand(wx, wy, 50 / this.renderer.scale);
        if (gs) { this.data.snapshot(); this.data.removeGrandstand(gs.id); this.app.requestRender(); return; }
        const zone = this.editor.findNearestZone(wx, wy, 20 / this.renderer.scale);
        if (zone) { this.data.snapshot(); this.data.removeZone(zone.id); this.app.requestRender(); return; }
        let bestG = null, bestGD = 30 / this.renderer.scale;
        for (const g of this.data.garages) { const d = Math.hypot(g.x - wx, g.y - wy); if (d < bestGD) { bestGD = d; bestG = g; } }
        if (bestG) { this.data.snapshot(); this.data.removeGarage(bestG.id); this.app.requestRender(); return; }
        const pp = this.editor.findNearestPitPoint(wx, wy, 15 / this.renderer.scale);
        if (pp) { this.data.snapshot(); this.data.pitLane.points = this.data.pitLane.points.filter(p => p.id !== pp.id); this.app.requestRender(); }
    }
}

class StraightModeTool extends ZoneTool {
    constructor(app) { super(app); this.zoneType = 'straight_mode'; }
}

F1.Tools = { BaseTool, SelectTool, DrawTrackTool, NodeTool, WidthTool, SurfacePainterTool, BarrierPainterTool, SectorTool, PitLaneTool, GrandstandTool, ZoneTool, StraightModeTool, GarageTool, EraserTool, TurnTool };

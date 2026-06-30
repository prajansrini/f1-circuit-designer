/* ============================================================
   circuit-data.js — F1 Circuit Data Model
   Node points = track shaping. Turns = user-placed markers.
   ============================================================ */
window.F1 = window.F1 || {};

F1.ZONE_TYPES = [
    { key: 'straight_mode', label: 'Straight Mode\nZone', color: '#e10600', bg: '#440200', range: true, multi: true },
    { key: 'overtake_detection', label: 'Overtake\nDetection', color: '#6be097', textColor: '#110b42', bg: '#2d4a10', range: false, multi: false },
    { key: 'overtake_activation', label: 'Overtake\nActivation', color: '#6be097', textColor: '#110b42', bg: '#004d56', range: false, multi: false },
    { key: 'speed_trap', label: 'Speed Trap', color: '#e6ff40', textColor: '#111111', bg: '#3e4410', range: false, multi: false },
];

F1.PREVIEW_LAYERS = [
    { key: 'track', label: 'Track', default: true },
    { key: 'sectorEdges', label: 'Sectors', default: true },
    { key: 'sectors', label: 'Sector Label', default: true },
    { key: 'turnNumbers', label: 'Turn Numbers', default: true },
    { key: 'zones', label: 'Zones', default: true },
    { key: 'straightMode', label: 'Straight Mode Zones', default: true },
    { key: 'pitLane', label: 'Pit Lane', default: true },
    { key: 'garages', label: 'Team Garages', default: true },
    { key: 'grandstands', label: 'Grandstands', default: true },
    { key: 'direction', label: 'Direction Arrow', default: true },
    { key: 'chequeredFlag', label: 'Chequered Flag', default: true },
    { key: 'name', label: 'Circuit Name', default: true },
    { key: 'info', label: 'Circuit Info', default: true },
    { key: 'sectorLegend', label: 'Sector Legend', default: true },
];

F1.CircuitData = class CircuitData {
    constructor() {
        this.name = 'Untitled Circuit';
        this.controlPoints = []; // Node points for track shaping
        this.isClosed = false;
        this.startNodeId = null;
        this.gridSize = 50;
        this.pitLane = { points: [], width: 8 };
        this.garage = null;
        this.zones = [];
        this.turnMarkers = []; // User-placed turn numbers
        this.sectorLabels = [
            { sector: 1, labelOffsetX: 40, labelOffsetY: -30 },
            { sector: 2, labelOffsetX: 40, labelOffsetY: -30 },
            { sector: 3, labelOffsetX: 40, labelOffsetY: -30 }
        ];
        this.overlapInversions = [];
        this.showPitlaneNodes = true;
        this._nextId = 1;
        this._undoStack = [];
        this._redoStack = [];
    }
    _genId() { return this._nextId++; }
    snapshot() { this._undoStack.push(JSON.stringify(this._serialize())); if (this._undoStack.length > 80) this._undoStack.shift(); this._redoStack = []; if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('circuit-changed')); }
    undo() { if (!this._undoStack.length) return; this._redoStack.push(JSON.stringify(this._serialize())); this._deserialize(JSON.parse(this._undoStack.pop())); }
    redo() { if (!this._redoStack.length) return; this._undoStack.push(JSON.stringify(this._serialize())); this._deserialize(JSON.parse(this._redoStack.pop())); }

    getLogicalNodeIndex(ptId) {
        const rawIdx = this.controlPoints.findIndex(p => p.id === ptId);
        if (rawIdx === -1) return -1;
        if (!this.startNodeId || !this.isClosed) return rawIdx + 1;
        const startIdx = this.controlPoints.findIndex(p => p.id === this.startNodeId);
        if (startIdx === -1) return rawIdx + 1;
        let logicalIdx = rawIdx - startIdx;
        if (logicalIdx < 0) logicalIdx += this.controlPoints.length;
        return logicalIdx + 1;
    }


    _getWorldPos(pts, segIdx, t) {
        const n = pts.length;
        if (n < 2) return { x: 0, y: 0 };
        const segs = this.isClosed ? n : n - 1;
        const i = Math.max(0, Math.min(segIdx, segs - 1));
        const p1 = pts[i], p2 = pts[(i + 1) % n];
        let p0, p3;
        if (this.isClosed) {
            p0 = pts[(i - 1 + n) % n]; p3 = pts[(i + 2) % n];
        } else {
            p0 = i > 0 ? pts[i - 1] : { x: 2 * pts[0].x - pts[1].x, y: 2 * pts[0].y - pts[1].y };
            p3 = i < n - 2 ? pts[i + 2] : { x: 2 * pts[n - 1].x - pts[n - 2].x, y: 2 * pts[n - 1].y - pts[n - 2].y };
        }
        const z0 = p0.z || 0, z1 = p1.z || 0, z2 = p2.z || 0, z3 = p3.z || 0;
        const t2 = t * t, t3 = t2 * t;
        return {
            x: .5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
            y: .5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
            z: .5 * ((2 * z1) + (-z0 + z2) * t + (2 * z0 - 5 * z1 + 4 * z2 - z3) * t2 + (-z0 + 3 * z1 - 3 * z2 + z3) * t3)
        };
    }

    _projectOntoTrack(wx, wy) {
        const pts = this.controlPoints;
        const n = pts.length;
        if (n < 2) return { segIndex: 0, t: 0 };
        const segs = this.isClosed ? n : n - 1;
        let bestDist = Infinity, bestSeg = 0, bestT = 0;
        const steps = 20; 
        for (let seg = 0; seg < segs; seg++) {
            for (let j = 0; j <= steps; j++) {
                const t = j / steps;
                const pos = this._getWorldPos(pts, seg, t);
                const d = Math.hypot(pos.x - wx, pos.y - wy);
                if (d < bestDist) { bestDist = d; bestSeg = seg; bestT = t; }
            }
        }
        let lo = Math.max(0, bestT - 1 / steps), hi = Math.min(1, bestT + 1 / steps);
        for (let iter = 0; iter < 10; iter++) {
            const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
            const p1 = this._getWorldPos(pts, bestSeg, m1), p2 = this._getWorldPos(pts, bestSeg, m2);
            const d1 = Math.hypot(p1.x - wx, p1.y - wy), d2 = Math.hypot(p2.x - wx, p2.y - wy);
            if (d1 < d2) hi = m2; else lo = m1;
        }
        bestT = (lo + hi) / 2;
        return { segIndex: bestSeg, t: bestT };
    }

    _saveZoneWorldPositions() {
        return {
            zones: this.zones.map(z => ({
                startPos: this._getWorldPos(this.controlPoints, z.segIndex, z.t),
                endPos: z.endSegIndex !== undefined ? this._getWorldPos(this.controlPoints, z.endSegIndex, z.endT) : null
            })),
            turnMarkers: this.turnMarkers.map(tm => this._getWorldPos(this.controlPoints, tm.segIndex, tm.t))
        };
    }

    _restoreZoneWorldPositions(saved) {
        this.zones.forEach((z, idx) => {
            const s = saved.zones[idx];
            if (!s) return;
            const newStart = this._projectOntoTrack(s.startPos.x, s.startPos.y);
            z.segIndex = newStart.segIndex;
            z.t = newStart.t;
            if (s.endPos) {
                const newEnd = this._projectOntoTrack(s.endPos.x, s.endPos.y);
                z.endSegIndex = newEnd.segIndex;
                z.endT = newEnd.t;
            }
        });
        this.turnMarkers.forEach((tm, idx) => {
            const s = saved.turnMarkers[idx];
            if (!s) return;
            const newPos = this._projectOntoTrack(s.x, s.y);
            tm.segIndex = newPos.segIndex;
            tm.t = newPos.t;
        });
    }

    insertControlPoint(x, y, index) {
        const saved = this._saveZoneWorldPositions();
        const pt = {
            id: this._genId(), x, y, z: 0, widthLeft: 12, widthRight: 12,
            surfaceLeft: 'grass', surfaceRight: 'grass',
            surfaceWidthLeft: 10, surfaceWidthRight: 10,
            barrierLeft: false, barrierRight: false, sector: 0
        };
        let prev = null;
        if (index > 0 && index <= this.controlPoints.length) {
            prev = this.controlPoints[index - 1];
        } else if (index === 0 && this.controlPoints.length > 0 && this.isClosed) {
            prev = this.controlPoints[this.controlPoints.length - 1];
        }

        if (prev) {
            pt.widthLeft = prev.widthLeft; pt.widthRight = prev.widthRight;
            pt.surfaceLeft = prev.surfaceLeft; pt.surfaceRight = prev.surfaceRight;
            pt.surfaceWidthLeft = prev.surfaceWidthLeft; pt.surfaceWidthRight = prev.surfaceWidthRight;
            pt.barrierLeft = prev.barrierLeft; pt.barrierRight = prev.barrierRight;
            pt.sector = prev.sector;
        }
        this.controlPoints.splice(index, 0, pt);
        if (this.startNodeId === null) this.startNodeId = pt.id;
        
        this._restoreZoneWorldPositions(saved);
        return pt;
    }

    addControlPoint(x, y) { return this.insertControlPoint(x, y, this.controlPoints.length); }
    
    removeControlPoint(id) {
        const index = this.controlPoints.findIndex(p => p.id === id);
        if (index === -1) return;
        const saved = this._saveZoneWorldPositions();
        this.controlPoints.splice(index, 1);
        if (this.controlPoints.length < 3) this.isClosed = false;
        this._restoreZoneWorldPositions(saved);
    }

    getPointById(id) { return this.controlPoints.find(p => p.id === id) || null; }

    closeTrack() {
        if (this.controlPoints.length < 3) return;
        this.isClosed = true;
    }

    // Turn markers - user manually places these
    addTurnMarker(segIndex, t, label) {
        const tm = { id: this._genId(), segIndex, t, label: label || (this.turnMarkers.length + 1).toString(), name: '', side: 'right' };
        this.turnMarkers.push(tm);
        return tm;
    }
    removeTurnMarker(id) { this.turnMarkers = this.turnMarkers.filter(t => t.id !== id); }
    getTurnMarkerById(id) { return this.turnMarkers.find(t => t.id === id) || null; }

    addPitLanePoint(x, y) { const pt = { id: this._genId(), x, y }; this.pitLane.points.push(pt); return pt; }
    clearPitLane() { this.pitLane.points = []; }

    getTurnMarkerById(id) { return this.turnMarkers.find(t => t.id === id) || null; }
    addPitLanePoint(x, y) { const pt = { id: this._genId(), x, y }; this.pitLane.points.push(pt); return pt; }
    insertPitLanePoint(x, y, index) { const pt = { id: this._genId(), x, y }; this.pitLane.points.splice(index, 0, pt); return pt; }
    clearPitLane() { this.pitLane.points = []; }
    addZone(type, segIndex, t, labelOffsetX, labelOffsetY) {
        const zt = F1.ZONE_TYPES.find(z => z.key === type);
        if (zt && !zt.multi) { this.zones = this.zones.filter(z => z.type !== type); }
        let endSegIndex = segIndex;
        let endT = Math.min(1, t + 0.4);
        if (type === 'straight_mode') {
            endSegIndex = (segIndex + 1) % this.controlPoints.length;
            endT = t;
        }
        const hasExistingLabel = type === 'straight_mode' && this.zones.some(z => z.type === 'straight_mode' && z.showLabel !== false);
        const zone = {
            id: this._genId(), type, segIndex, t,
            endSegIndex: endSegIndex, endT: endT,
            labelOffsetX: labelOffsetX || 0, labelOffsetY: labelOffsetY || -50,
            label: zt ? zt.label : (type === 'straight_mode' ? 'Straight Mode Zone' : type),
            side: 'right',
            showLabel: type === 'straight_mode' ? !hasExistingLabel : true
        };
        this.zones.push(zone);
        return zone;
    }
    removeZone(id) { this.zones = this.zones.filter(z => z.id !== id); }
    getZoneById(id) { return this.zones.find(z => z.id === id) || null; }


    reverseTrack() {
        if (!this.controlPoints || this.controlPoints.length < 2) return;
        this.snapshot();
        
        const N = this.controlPoints.length;

        // 0. Pre-calculate mapping for overlap inversions
        const oldOverlaps = [...(this.overlapInversions || [])];
        const oldSegToCpId = {};
        for (let i = 0; i < N; i++) {
            oldSegToCpId[i] = this.controlPoints[i].id;
        }

        // 1. Shift edge properties (Surfaces, Barriers, Sectors) and swap point properties (Widths)
        const newEdgeProps = new Array(N);
        for (let i = 0; i < N; i++) {
            let nextIdx = (i + 1) % N;
            
            const cp = this.controlPoints[i];
            let s = cp.sector;
            if (s === 1) s = 3;
            else if (s === 3) s = 1;
            
            newEdgeProps[nextIdx] = {
                surfaceLeft: cp.surfaceRight,
                surfaceRight: cp.surfaceLeft,
                barrierLeft: cp.barrierRight,
                barrierRight: cp.barrierLeft,
                sector: s
            };
        }
        
        for (let i = 0; i < N; i++) {
            const cp = this.controlPoints[i];
            // Point properties: Swap L/R in place (they stay at the same physical node)
            const tmpWidth = cp.widthLeft; cp.widthLeft = cp.widthRight; cp.widthRight = tmpWidth;
            const tmpSWidth = cp.surfaceWidthLeft; cp.surfaceWidthLeft = cp.surfaceWidthRight; cp.surfaceWidthRight = tmpSWidth;
            
            // Edge properties: Apply the shifted properties
            Object.assign(cp, newEdgeProps[i]);
        }

        // 2. Reverse the control points array
        this.controlPoints.reverse();

        // 3. Cyclically shift to preserve the Start Node's position (if closed)
        let shiftOffset = 0;
        if (this.isClosed && this.startNodeId) {
            const currentStartIdx = this.controlPoints.findIndex(p => p.id === this.startNodeId);
            if (currentStartIdx !== -1 && currentStartIdx !== 0) {
                this.controlPoints = this.controlPoints.slice(currentStartIdx).concat(this.controlPoints.slice(0, currentStartIdx));
                shiftOffset = currentStartIdx;
            }
        }

        // Exact mathematical mapping for zones and turn markers
        const mapSegAndT = (segIndex, t) => {
            let newSeg = (this.isClosed && segIndex === N - 1) ? N - 1 : N - 2 - segIndex;
            let newT = 1 - t;
            if (this.isClosed && shiftOffset > 0) {
                newSeg = (newSeg - shiftOffset + N) % N;
            }
            return { segIndex: newSeg, t: newT };
        };

        // 4. Re-map zones onto the reversed track
        this.zones.forEach((z) => {
            const zt = F1.ZONE_TYPES.find(t => t.key === z.type);
            const newStart = mapSegAndT(z.segIndex, z.t);
            
            if (zt && zt.range && z.endSegIndex !== undefined) {
                const newEnd = mapSegAndT(z.endSegIndex, z.endT);
                z.segIndex = newEnd.segIndex;
                z.t = newEnd.t;
                z.endSegIndex = newStart.segIndex;
                z.endT = newStart.t;
            } else {
                z.segIndex = newStart.segIndex;
                z.t = newStart.t;
                if (z.endSegIndex !== undefined) {
                    const newEnd = mapSegAndT(z.endSegIndex, z.endT);
                    // Just remap end, don't swap them since the primary anchor must stay at the start
                    z.endSegIndex = newEnd.segIndex;
                    z.endT = newEnd.t;
                }
            }
            z.side = z.side === 'left' ? 'right' : 'left';
        });

        // 5. Re-map turn markers onto the reversed track
        this.turnMarkers.forEach((tm) => {
            const newPos = mapSegAndT(tm.segIndex, tm.t);
            tm.segIndex = newPos.segIndex;
            tm.t = newPos.t;
            tm.side = tm.side === 'left' ? 'right' : 'left';
        });

        // 6. Re-map overlap inversions
        if (oldOverlaps.length > 0) {
            this.overlapInversions = oldOverlaps.map(key => {
                const parts = key.split('-');
                const oldA = parseInt(parts[0]);
                const oldB = parseInt(parts[1]);
                const ixIndex = parts.length > 2 ? parts[2] : '0';
                const idA = oldSegToCpId[oldA];
                const idB = oldSegToCpId[oldB];
                const newA = this.controlPoints.findIndex(p => p.id === idA);
                const newB = this.controlPoints.findIndex(p => p.id === idB);
                if (newA === -1 || newB === -1) return null;
                return `${Math.min(newA, newB)}-${Math.max(newA, newB)}-${ixIndex}`;
            }).filter(Boolean);
        }
    }

    _serialize() { return { name: this.name, namePos: this.namePos, gridSize: this.gridSize, controlPoints: JSON.parse(JSON.stringify(this.controlPoints)), isClosed: this.isClosed, startNodeId: this.startNodeId, pitLane: JSON.parse(JSON.stringify(this.pitLane)), garage: JSON.parse(JSON.stringify(this.garage)), zones: JSON.parse(JSON.stringify(this.zones)), turnMarkers: JSON.parse(JSON.stringify(this.turnMarkers)), sectorLabels: JSON.parse(JSON.stringify(this.sectorLabels)), overlapInversions: JSON.parse(JSON.stringify(this.overlapInversions)), showPitlaneNodes: this.showPitlaneNodes, _nextId: this._nextId }; }
    _deserialize(d) {
        this.name = d.name; this.namePos = d.namePos || { x: 20, y: 16 }; this.gridSize = d.gridSize || 50; this.controlPoints = d.controlPoints; this.isClosed = d.isClosed; this.startNodeId = d.startNodeId || null; this.pitLane = d.pitLane; this.garage = d.garage || null; this.zones = d.zones || []; this.turnMarkers = d.turnMarkers || []; this.sectorLabels = d.sectorLabels || [
            { sector: 1, labelOffsetX: 40, labelOffsetY: -30 },
            { sector: 2, labelOffsetX: 40, labelOffsetY: -30 },
            { sector: 3, labelOffsetX: 40, labelOffsetY: -30 }
        ]; this.overlapInversions = d.overlapInversions || []; this.showPitlaneNodes = d.showPitlaneNodes !== false; this._nextId = d._nextId;
    }
    toJSON() { return JSON.stringify(this._serialize()); }
    fromJSON(json) { this._deserialize(JSON.parse(json)); this._undoStack = []; this._redoStack = []; }
    clear() {
        this.controlPoints = []; this.isClosed = false; this.startNodeId = null; this.gridSize = 50; this.namePos = { x: 20, y: 16 }; this.pitLane = { points: [], width: 8 }; this.garage = null; this.zones = []; this.turnMarkers = []; this.sectorLabels = [
            { sector: 1, labelOffsetX: 40, labelOffsetY: -30 },
            { sector: 2, labelOffsetX: 40, labelOffsetY: -30 },
            { sector: 3, labelOffsetX: 40, labelOffsetY: -30 }
        ]; this.overlapInversions = []; this.showPitlaneNodes = true;
    }
};

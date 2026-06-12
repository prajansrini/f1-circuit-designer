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
    { key: 'sectors', label: 'Sectors', default: true },
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
];

F1.CircuitData = class CircuitData {
    constructor() {
        this.name = 'Untitled Circuit';
        this.controlPoints = []; // Node points for track shaping
        this.isClosed = false;
        this.startNodeId = null;
        this.gridSize = 50;
        this.pitLane = { points: [], width: 8 };
        this.grandstands = [];
        this.zones = [];
        this.garages = [];
        this.turnMarkers = []; // User-placed turn numbers
        this.sectorLabels = [
            { sector: 1, labelOffsetX: 40, labelOffsetY: -30 },
            { sector: 2, labelOffsetX: 40, labelOffsetY: -30 },
            { sector: 3, labelOffsetX: 40, labelOffsetY: -30 }
        ];
        this._nextId = 1;
        this._undoStack = [];
        this._redoStack = [];
    }
    _genId() { return this._nextId++; }
    snapshot() { this._undoStack.push(JSON.stringify(this._serialize())); if (this._undoStack.length > 80) this._undoStack.shift(); this._redoStack = []; }
    undo() { if (!this._undoStack.length) return; this._redoStack.push(JSON.stringify(this._serialize())); this._deserialize(JSON.parse(this._undoStack.pop())); }
    redo() { if (!this._redoStack.length) return; this._undoStack.push(JSON.stringify(this._serialize())); this._deserialize(JSON.parse(this._redoStack.pop())); }

    insertControlPoint(x, y, index) {
        const pt = {
            id: this._genId(), x, y, widthLeft: 12, widthRight: 12,
            surfaceLeft: 'grass', surfaceRight: 'grass', surfaceWidthLeft: 10, surfaceWidthRight: 10,
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
        this._shiftIndices(index, 1);
        return pt;
    }
    addControlPoint(x, y) { return this.insertControlPoint(x, y, this.controlPoints.length); }
    removeControlPoint(id) {
        const index = this.controlPoints.findIndex(p => p.id === id);
        if (index === -1) return;
        this.controlPoints.splice(index, 1);
        if (this.controlPoints.length < 3) this.isClosed = false;
        this._shiftIndices(index, -1);
    }
    _shiftIndices(index, amount) {
        this.turnMarkers.forEach(tm => { if (tm.segIndex >= index) tm.segIndex = Math.max(0, tm.segIndex + amount); });
        this.zones.forEach(z => {
            if (z.segIndex >= index) z.segIndex = Math.max(0, z.segIndex + amount);
            if (z.range && z.endSegIndex >= index) z.endSegIndex = Math.max(0, z.endSegIndex + amount);
        });
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

    addGrandstand(x, y) { const gs = { id: this._genId(), x, y, width: 90, height: 22, rotation: 0 }; this.grandstands.push(gs); return gs; }
    removeGrandstand(id) { this.grandstands = this.grandstands.filter(g => g.id !== id); }
    getGrandstandById(id) { return this.grandstands.find(g => g.id === id) || null; }

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

    addGarage(x, y) {
        const colors = ['#e10600', '#00d2be', '#0600ef', '#ff8700', '#006f62', '#2b4562', '#b6babd', '#52e252', '#4682b4', '#900020'];
        const g = { id: this._genId(), x, y, width: 30, height: 16, rotation: 0, teamName: `Team ${this.garages.length + 1}`, color: colors[this.garages.length % 10] };
        this.garages.push(g); return g;
    }
    removeGarage(id) { this.garages = this.garages.filter(g => g.id !== id); }
    getGarageById(id) { return this.garages.find(g => g.id === id) || null; }

    reverseTrack() {
        if (this.controlPoints.length < 2) return;
        const N = this.controlPoints.length;

        // --- Helper: Catmull-Rom interpolation for world-position computation ---
        const crInterp = (p0, p1, p2, p3, t) => {
            const t2 = t * t, t3 = t2 * t;
            return {
                x: .5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
                y: .5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
            };
        };
        const getWorldPos = (pts, segIdx, t) => {
            const n = pts.length;
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
            return crInterp(p0, p1, p2, p3, t);
        };

        // --- Save world positions of all zones and turn markers BEFORE reversal ---
        const zoneWorldPositions = this.zones.map(z => {
            const startPos = getWorldPos(this.controlPoints, z.segIndex, z.t);
            let endPos = null;
            if (z.endSegIndex !== undefined) {
                endPos = getWorldPos(this.controlPoints, z.endSegIndex, z.endT);
            }
            return { startPos, endPos };
        });
        const tmWorldPositions = this.turnMarkers.map(tm => {
            return getWorldPos(this.controlPoints, tm.segIndex, tm.t);
        });

        // Store old sectors before reversing
        const oldSectors = this.controlPoints.map(cp => cp.sector);

        // 1. Reverse the control points array
        this.controlPoints.reverse();

        // 2. Swap L/R attributes and Sectors
        for (let i = 0; i < N; i++) {
            const cp = this.controlPoints[i];
            const tmpWidth = cp.widthLeft; cp.widthLeft = cp.widthRight; cp.widthRight = tmpWidth;
            const tmpSurf = cp.surfaceLeft; cp.surfaceLeft = cp.surfaceRight; cp.surfaceRight = tmpSurf;
            const tmpSWidth = cp.surfaceWidthLeft; cp.surfaceWidthLeft = cp.surfaceWidthRight; cp.surfaceWidthRight = tmpSWidth;
            const tmpBarr = cp.barrierLeft; cp.barrierLeft = cp.barrierRight; cp.barrierRight = tmpBarr;

            const oldIdx = N - 1 - i;
            let prevOldIdx = oldIdx - 1;
            if (prevOldIdx < 0) {
                if (this.isClosed) prevOldIdx += N;
                else prevOldIdx = 0;
            }

            let s = oldSectors[prevOldIdx];
            if (s === 1) s = 3;
            else if (s === 3) s = 1;
            cp.sector = s;
        }

        // 3. Cyclically shift to preserve the Start Node's position (if closed) — do this BEFORE zone re-projection
        if (this.isClosed && this.startNodeId) {
            const currentStartIdx = this.controlPoints.findIndex(p => p.id === this.startNodeId);
            if (currentStartIdx !== -1 && currentStartIdx !== 0) {
                this.controlPoints = this.controlPoints.slice(currentStartIdx).concat(this.controlPoints.slice(0, currentStartIdx));
            }
        }

        // --- Helper: project a world position onto the (now-reversed) track to find new segIndex + t ---
        const projectOntoTrack = (wx, wy) => {
            const pts = this.controlPoints;
            const n = pts.length;
            const segs = this.isClosed ? n : n - 1;
            let bestDist = Infinity, bestSeg = 0, bestT = 0;
            const steps = 20; // sub-steps per segment for accuracy
            for (let seg = 0; seg < segs; seg++) {
                for (let j = 0; j <= steps; j++) {
                    const t = j / steps;
                    const pos = getWorldPos(pts, seg, t);
                    const d = Math.hypot(pos.x - wx, pos.y - wy);
                    if (d < bestDist) { bestDist = d; bestSeg = seg; bestT = t; }
                }
            }
            // Refine with binary search around bestT
            let lo = Math.max(0, bestT - 1 / steps), hi = Math.min(1, bestT + 1 / steps);
            for (let iter = 0; iter < 10; iter++) {
                const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
                const p1 = getWorldPos(pts, bestSeg, m1), p2 = getWorldPos(pts, bestSeg, m2);
                const d1 = Math.hypot(p1.x - wx, p1.y - wy), d2 = Math.hypot(p2.x - wx, p2.y - wy);
                if (d1 < d2) hi = m2; else lo = m1;
            }
            bestT = (lo + hi) / 2;
            return { segIndex: bestSeg, t: bestT };
        };

        // 4. Re-project zones onto the reversed track
        this.zones.forEach((z, idx) => {
            const saved = zoneWorldPositions[idx];
            const newStart = projectOntoTrack(saved.startPos.x, saved.startPos.y);
            if (saved.endPos) {
                // For range-based zones (like Straight Mode Zone), the old end becomes the new start,
                // and the old start becomes the new end in the reversed winding order.
                const newEnd = projectOntoTrack(saved.endPos.x, saved.endPos.y);
                z.segIndex = newEnd.segIndex;
                z.t = newEnd.t;
                z.endSegIndex = newStart.segIndex;
                z.endT = newStart.t;
            } else {
                z.segIndex = newStart.segIndex;
                z.t = newStart.t;
            }
            z.side = z.side === 'left' ? 'right' : 'left';
        });

        // 5. Re-project turn markers onto the reversed track
        this.turnMarkers.forEach((tm, idx) => {
            const saved = tmWorldPositions[idx];
            const newPos = projectOntoTrack(saved.x, saved.y);
            tm.segIndex = newPos.segIndex;
            tm.t = newPos.t;
            tm.side = tm.side === 'left' ? 'right' : 'left';
        });
    }

    _serialize() { return { name: this.name, gridSize: this.gridSize, controlPoints: JSON.parse(JSON.stringify(this.controlPoints)), isClosed: this.isClosed, startNodeId: this.startNodeId, pitLane: JSON.parse(JSON.stringify(this.pitLane)), grandstands: JSON.parse(JSON.stringify(this.grandstands)), zones: JSON.parse(JSON.stringify(this.zones)), garages: JSON.parse(JSON.stringify(this.garages)), turnMarkers: JSON.parse(JSON.stringify(this.turnMarkers)), sectorLabels: JSON.parse(JSON.stringify(this.sectorLabels)), _nextId: this._nextId }; }
    _deserialize(d) {
        this.name = d.name; this.gridSize = d.gridSize || 50; this.controlPoints = d.controlPoints; this.isClosed = d.isClosed; this.startNodeId = d.startNodeId || null; this.pitLane = d.pitLane; this.grandstands = d.grandstands; this.zones = d.zones || []; this.garages = d.garages || []; this.turnMarkers = d.turnMarkers || []; this.sectorLabels = d.sectorLabels || [
            { sector: 1, labelOffsetX: 40, labelOffsetY: -30 },
            { sector: 2, labelOffsetX: 40, labelOffsetY: -30 },
            { sector: 3, labelOffsetX: 40, labelOffsetY: -30 }
        ]; this._nextId = d._nextId;
    }
    toJSON() { return JSON.stringify(this._serialize()); }
    fromJSON(json) { this._deserialize(JSON.parse(json)); this._undoStack = []; this._redoStack = []; }
    clear() {
        this.controlPoints = []; this.isClosed = false; this.startNodeId = null; this.gridSize = 50; this.pitLane = { points: [], width: 8 }; this.grandstands = []; this.zones = []; this.garages = []; this.turnMarkers = []; this.sectorLabels = [
            { sector: 1, labelOffsetX: 40, labelOffsetY: -30 },
            { sector: 2, labelOffsetX: 40, labelOffsetY: -30 },
            { sector: 3, labelOffsetX: 40, labelOffsetY: -30 }
        ];
    }
};

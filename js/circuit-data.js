/* ============================================================
   circuit-data.js — F1 Circuit Data Model
   Node points = track shaping. Turns = user-placed markers.
   ============================================================ */
window.F1 = window.F1 || {};

F1.ZONE_TYPES = [
    { key: 'straight_mode', label: 'Straight Mode\nZone', color: '#e10600', bg: '#440200', range: true, multi: true },
    { key: 'overtake_detection', label: 'Overtake\nDetection', color: '#8bc34a', bg: '#2d4a10', range: false, multi: false },
    { key: 'overtake_activation', label: 'Overtake\nActivation', color: '#00bcd4', bg: '#004d56', range: false, multi: false },
    { key: 'speed_trap', label: 'Speed Trap', color: '#cddc39', bg: '#3e4410', range: false, multi: false },
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
    { key: 'info', label: 'Circuit Info', default: true },
];

F1.CircuitData = class CircuitData {
    constructor() {
        this.name = 'Untitled Circuit';
        this.controlPoints = []; // Node points for track shaping
        this.isClosed = false;
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
        if (index > 0 && index <= this.controlPoints.length) {
            const prev = this.controlPoints[index - 1];
            pt.widthLeft = prev.widthLeft; pt.widthRight = prev.widthRight;
            pt.surfaceLeft = prev.surfaceLeft; pt.surfaceRight = prev.surfaceRight;
            pt.surfaceWidthLeft = prev.surfaceWidthLeft; pt.surfaceWidthRight = prev.surfaceWidthRight;
            pt.barrierLeft = prev.barrierLeft; pt.barrierRight = prev.barrierRight;
        }
        this.controlPoints.splice(index, 0, pt);
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
        this.turnMarkers.forEach(tm => { if (tm.segIndex >= index) tm.segIndex += amount; });
        this.zones.forEach(z => { 
            if (z.segIndex >= index) z.segIndex += amount; 
            if (z.range && z.endSegIndex >= index) z.endSegIndex += amount;
        });
    }
    getPointById(id) { return this.controlPoints.find(p => p.id === id) || null; }

    closeTrack() {
        if (this.controlPoints.length < 3) return;
        this.isClosed = true;
        // Auto: first = S1, last = S3
        this.controlPoints[0].sector = 1;
        this.controlPoints[this.controlPoints.length - 1].sector = 3;
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
    clearPitLane() { this.pitLane.points = []; this.garages = []; }

    addGrandstand(x, y) { const gs = { id: this._genId(), x, y, width: 90, height: 22, rotation: 0 }; this.grandstands.push(gs); return gs; }
    removeGrandstand(id) { this.grandstands = this.grandstands.filter(g => g.id !== id); }
    getGrandstandById(id) { return this.grandstands.find(g => g.id === id) || null; }

    addZone(type, segIndex, t, labelOffsetX, labelOffsetY) {
        const zt = F1.ZONE_TYPES.find(z => z.key === type);
        if (zt && !zt.multi) { this.zones = this.zones.filter(z => z.type !== type); }
        const zone = {
            id: this._genId(), type, segIndex, t,
            endSegIndex: segIndex, endT: Math.min(1, t + 0.4),
            labelOffsetX: labelOffsetX || 0, labelOffsetY: labelOffsetY || -50,
            label: zt ? zt.label : type,
            side: 'right'
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

    _serialize() { return { name: this.name, controlPoints: JSON.parse(JSON.stringify(this.controlPoints)), isClosed: this.isClosed, pitLane: JSON.parse(JSON.stringify(this.pitLane)), grandstands: JSON.parse(JSON.stringify(this.grandstands)), zones: JSON.parse(JSON.stringify(this.zones)), garages: JSON.parse(JSON.stringify(this.garages)), turnMarkers: JSON.parse(JSON.stringify(this.turnMarkers)), sectorLabels: JSON.parse(JSON.stringify(this.sectorLabels)), _nextId: this._nextId }; }
    _deserialize(d) {
        this.name = d.name; this.controlPoints = d.controlPoints; this.isClosed = d.isClosed; this.pitLane = d.pitLane; this.grandstands = d.grandstands; this.zones = d.zones || []; this.garages = d.garages || []; this.turnMarkers = d.turnMarkers || []; this.sectorLabels = d.sectorLabels || [
            { sector: 1, labelOffsetX: 40, labelOffsetY: -30 },
            { sector: 2, labelOffsetX: 40, labelOffsetY: -30 },
            { sector: 3, labelOffsetX: 40, labelOffsetY: -30 }
        ]; this._nextId = d._nextId;
    }
    toJSON() { return JSON.stringify(this._serialize()); }
    fromJSON(json) { this._deserialize(JSON.parse(json)); this._undoStack = []; this._redoStack = []; }
    clear() {
        this.controlPoints = []; this.isClosed = false; this.pitLane = { points: [], width: 8 }; this.grandstands = []; this.zones = []; this.garages = []; this.turnMarkers = []; this.sectorLabels = [
            { sector: 1, labelOffsetX: 40, labelOffsetY: -30 },
            { sector: 2, labelOffsetX: 40, labelOffsetY: -30 },
            { sector: 3, labelOffsetX: 40, labelOffsetY: -30 }
        ];
    }
};

/* ============================================================
   ui-manager.js — Properties Panel & UI Controls
   ============================================================ */
window.F1 = window.F1 || {};

F1.UIManager = class UIManager {
    constructor(app) {
        this.app = app;
        this.panelContent = document.getElementById('panel-content');
    }

    updateProperties() {
        const tool = this.app.activeToolName, sel = this.app.selection;
        const map = {
            select: () => this._selectProps(sel), draw: () => this._drawProps(),
            node: () => this._nodeProps(sel), width: () => this._widthProps(sel), surface: () => this._surfaceProps(sel),
            barrier: () => this._barrierProps(), sector: () => this._sectorProps(),
            turn: () => this._turnProps(sel),
            pitlane: () => this._pitLaneProps(),
            garage: () => this._pitLaneProps(),
            analysis: () => this._analysisProps(),
            zone: () => this._zoneProps(sel),
            straightMode: () => this._straightModeProps(sel),
            hotlap: () => this._hotlapProps(),
            eraser: () => this._eraserProps(), scale: () => this._scaleProps(),
            help: () => this._helpProps()
        };
        this.panelContent.innerHTML = (map[tool] || (() => '<p class="prop-hint">Select a tool</p>'))();
        this._bindEvents();
    }

    _cpProps(pt) {
        let h = `<div class="prop-group" style="margin-top:15px; border-top:1px solid #333; padding-top:15px;"><label>Position</label>
            <div class="prop-row" style="gap:10px;">
                <span class="prop-label" style="width:10px">X</span><input type="number" id="prop-x-val" value="${pt.x.toFixed(3)}" step="0.001" class="prop-input" style="flex:1;padding:2px 4px;font-size:11px;">
                <span class="prop-label" style="width:10px">Y</span><input type="number" id="prop-y-val" value="${pt.y.toFixed(3)}" step="0.001" class="prop-input" style="flex:1;padding:2px 4px;font-size:11px;">
            </div></div>`;
        const sm = (this.app.data.gridSize || 50) / 50.0;
        h += `<div class="prop-group"><label>Track Width <span style="text-transform:none">(m)</span></label>
            <div class="prop-row"><span class="prop-label" style="width:30px">L</span><input type="range" min="${5 * sm}" max="${40 * sm}" step="${0.5 * sm}" value="${(pt.widthLeft * sm).toFixed(1)}" id="prop-wl" class="prop-slider"><input type="number" id="prop-wl-val" value="${(pt.widthLeft * sm).toFixed(1)}" step="${0.5 * sm}" min="${5 * sm}" class="prop-input" style="width:60px;padding:2px 4px;font-size:11px;"></div>
            <div class="prop-row"><span class="prop-label" style="width:30px">R</span><input type="range" min="${5 * sm}" max="${40 * sm}" step="${0.5 * sm}" value="${(pt.widthRight * sm).toFixed(1)}" id="prop-wr" class="prop-slider"><input type="number" id="prop-wr-val" value="${(pt.widthRight * sm).toFixed(1)}" step="${0.5 * sm}" min="${5 * sm}" class="prop-input" style="width:60px;padding:2px 4px;font-size:11px;"></div>
            <div class="prop-row"><span class="prop-label" style="width:30px">B</span><input type="range" min="${-20 * sm}" max="${20 * sm}" step="${0.5 * sm}" value="0" id="prop-wb" class="prop-slider"><input type="number" id="prop-wb-val" value="0" step="${0.5 * sm}" class="prop-input" style="width:60px;padding:2px 4px;font-size:11px;"></div>
            <button class="prop-btn" style="width:100%; margin-top: 6px;" id="btn-reset-tw">Reset Track Width</button></div>`;
        h += `<div class="prop-group"><label>Elevation & Banking (Beta)</label>
            <div class="prop-row" style="margin-bottom: 6px;"><span class="prop-label" style="width:30px" title="Elevation (m)">E</span><input type="range" min="-100" max="100" step="0.5" value="${(pt.z || 0).toFixed(1)}" id="prop-z" class="prop-slider"><input type="number" id="prop-z-val" value="${(pt.z || 0).toFixed(1)}" step="0.5" class="prop-input" style="width:60px;padding:2px 4px;font-size:11px;"></div>
            <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                <button class="side-btn ${(pt.banking || 0) >= 0 ? 'active' : ''}" style="flex:1; margin-right:4px;" id="btn-bank-left">Left</button>
                <button class="side-btn ${(pt.banking || 0) < 0 ? 'active' : ''}" style="flex:1; margin-left:4px;" id="btn-bank-right">Right</button>
            </div>
            <div class="prop-row">
                <span class="prop-label" style="width:30px" title="Banking Degree">D</span>
                <input type="range" min="0" max="90" step="1" value="${Math.abs(pt.banking || 0)}" id="prop-banking" class="prop-slider">
                <input type="number" id="prop-banking-val" value="${Math.abs(pt.banking || 0)}" step="1" min="0" max="90" class="prop-input" style="width:60px;padding:2px 4px;font-size:11px;">
            </div>
            <button class="prop-btn" style="width:100%; margin-top: 6px;" id="btn-reset-elev-bank">Reset Elevation & Banking</button>
        </div>`;
        h += `<div class="prop-group"><label>Run-off Width <span style="text-transform:none">(m)</span></label>
            <div class="prop-row"><span class="prop-label" style="width:30px">L</span><input type="range" min="0" max="${50 * sm}" step="${0.5 * sm}" value="${((pt.surfaceWidthLeft ?? 10) * sm).toFixed(1)}" id="prop-swl" class="prop-slider"><input type="number" id="prop-swl-val" value="${((pt.surfaceWidthLeft ?? 10) * sm).toFixed(1)}" step="${0.5 * sm}" min="0" class="prop-input" style="width:60px;padding:2px 4px;font-size:11px;"></div>
            <div class="prop-row"><span class="prop-label" style="width:30px">R</span><input type="range" min="0" max="${50 * sm}" step="${0.5 * sm}" value="${((pt.surfaceWidthRight ?? 10) * sm).toFixed(1)}" id="prop-swr" class="prop-slider"><input type="number" id="prop-swr-val" value="${((pt.surfaceWidthRight ?? 10) * sm).toFixed(1)}" step="${0.5 * sm}" min="0" class="prop-input" style="width:60px;padding:2px 4px;font-size:11px;"></div>
            <div class="prop-row"><span class="prop-label" style="width:30px">B</span><input type="range" min="${-20 * sm}" max="${20 * sm}" step="${0.5 * sm}" value="0" id="prop-swb" class="prop-slider"><input type="number" id="prop-swb-val" value="0" step="${0.5 * sm}" class="prop-input" style="width:60px;padding:2px 4px;font-size:11px;"></div>
            <button class="prop-btn" style="width:100%; margin-top: 6px;" id="btn-reset-sw">Reset Run-off Width</button></div>`;
        h += `<div class="prop-group"><label>Sector</label><div class="sector-btns" style="display:flex; flex-wrap:nowrap;">
            <button class="sector-btn s1 ${pt.sector === 1 ? 'active' : ''}" data-sec="1">S1</button>
            <button class="sector-btn s2 ${pt.sector === 2 ? 'active' : ''}" data-sec="2">S2</button>
            <button class="sector-btn s3 ${pt.sector === 3 ? 'active' : ''}" data-sec="3">S3</button></div></div>`;
        return h;
    }



    _nodeProps(sel) {
        let h = `<h3 class="prop-title">Insert Nodes</h3>
                <p class="prop-hint">Click on the track to insert a new control point.</p>
                <div class="prop-group" style="margin-top: 15px;">
                    <label class="chk-label prop-hint" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                        <input type="checkbox" id="cb-show-nodes" ${this.app.renderer.showCtrlPts ? 'checked' : ''} style="accent-color:#e10600;">
                        <span style="margin-top: 2px; color: #aaa; font-size: 12px; font-weight: normal; letter-spacing: normal; text-transform: none;">Show Nodes</span>
                    </label>
                </div>
                <div class="prop-group" style="margin-top:15px; border-top:1px solid #333; padding-top:15px;"><label>Select a Node</label>
                    <select id="prop-node-selector" class="prop-input" style="width:100%; padding: 4px; background: #222; color: #eee; border: 1px solid #444; border-radius: 4px; font-size: 12px; cursor: pointer;">
                        <option value="">-- Choose a node --</option>
                        ${[...this.app.data.controlPoints].sort((a, b) => this.app.data.getLogicalNodeIndex(a.id) - this.app.data.getLogicalNodeIndex(b.id)).map(p => `<option value="${p.id}" ${sel && sel.id === p.id ? 'selected' : ''}>Node ${this.app.data.getLogicalNodeIndex(p.id)}</option>`).join('')}
                    </select>
                </div>`;
        if (sel && sel.type === 'cp') {
            const pt = this.app.data.getPointById(sel.id);
            if (pt) h += this._cpProps(pt);
        }
        return h;
    }

    _getTurnUI(tm) {
        return `<div class="prop-group"><label>Turn Marker</label>
            <div class="prop-group" style="margin-top:10px;"><label>Side</label><div class="side-btns">
                <button class="side-btn ${tm.side === 'left' ? 'active' : ''}" id="btn-tm-left">Left</button>
                <button class="side-btn ${tm.side !== 'left' ? 'active' : ''}" id="btn-tm-right">Right</button></div></div>
            <div class="prop-row"><span class="prop-label" style="width:50px;text-align:left">Label</span><input type="text" class="prop-input" id="prop-tmlabel" value="${tm.label}" style="width:60px;flex:none"></div>
            <div class="prop-row"><span class="prop-label" style="width:50px;text-align:left">Name</span><input type="text" class="prop-input" id="prop-tmname" value="${tm.name || ''}" placeholder="e.g. Eau Rouge" style="flex:1"></div>
            <div class="prop-row"><span class="prop-label" style="width:40px;text-align:left">Rotate</span>
                <input type="range" min="0" max="360" value="${Math.round(tm.rotation || 0)}" id="prop-tmr" class="prop-slider" style="width:100px; flex:none;">
                <div style="flex:1"></div>
                <input type="number" id="prop-tmr-val" value="${Math.round(tm.rotation || 0)}" min="0" max="360" class="prop-input" style="width:45px;padding:2px 4px;font-size:11px;"></div>
            <button class="prop-btn danger" id="btn-del-turn" style="margin-top:10px">Delete Turn</button></div>`;
    }


    _getSectorLabelUI(sl) {
        return `<div class="prop-group"><label>Sector Label Settings</label>
            <p class="prop-hint" style="color: #eee; font-weight: bold;">Sector ${sl.sector}</p>
            <div class="prop-row"><span class="prop-label" style="width:40px;text-align:left">Rotate</span>
                <input type="range" min="0" max="360" value="${Math.round(sl.rotation || 0)}" id="prop-slr" class="prop-slider" style="width:100px; flex:none;">
                <div style="flex:1"></div>
                <input type="number" id="prop-slr-val" value="${Math.round(sl.rotation || 0)}" min="0" max="360" class="prop-input" style="width:45px;padding:2px 4px;font-size:11px;"></div></div>`;
    }

    _getZoneUI(z) {
        let h = '';
        const zt = F1.ZONE_TYPES.find(t => t.key === z.type);
        h += `<div class="prop-group" style="margin-top: 15px; border-top: 1px solid #333; padding-top: 15px;">`;

        if (z.type === 'straight_mode') {
            const track = this.app.editor.getInterpolatedTrack();
            const si = z.segIndex * this.app.editor.resolution + Math.floor(z.t * this.app.editor.resolution);
            const ei = z.endSegIndex * this.app.editor.resolution + Math.floor(z.endT * this.app.editor.resolution);

            let startDist = 0, endDist = 0, dist = 0, trackLength = 0;
            for (let i = 1; i < track.length; i++) {
                const d = Math.hypot(track[i].x - track[i - 1].x, track[i].y - track[i - 1].y);
                dist += d; trackLength += d;
                if (i === si) startDist = dist;
                if (i === ei) endDist = dist;
            }
            if (si === 0) startDist = 0;
            if (ei === 0) endDist = 0;

            let zoneDist = 0;
            if (si <= ei) zoneDist = endDist - startDist;
            else if (this.app.data.isClosed) zoneDist = (trackLength - startDist) + endDist;
            else zoneDist = startDist - endDist;

            h += `<div class="prop-group"><label>Distance Info</label>
                <div style="font-size:11px; color:#aaa; margin-bottom:10px; padding:0 5px;">
                    <div style="display:flex; align-items:center; margin-bottom: 4px;">
                        <span style="flex: 0 0 75px;">Start Point:</span> 
                        <div style="display:flex; align-items:center; flex:1; justify-content:flex-end;"><input type="number" id="prop-smz-start" value="${(startDist).toFixed(3)}" step="0.001" class="prop-input" style="width:85px; text-align:right; padding:2px; font-size:11px;"> <span style="margin-left:4px; width:12px;">m</span></div>
                    </div>
                    <div style="display:flex; align-items:center; margin-bottom: 4px;">
                        <span style="flex: 0 0 75px;">End Point:</span> 
                        <div style="display:flex; align-items:center; flex:1; justify-content:flex-end;"><input type="number" id="prop-smz-end" value="${(endDist).toFixed(3)}" step="0.001" class="prop-input" style="width:85px; text-align:right; padding:2px; font-size:11px;"> <span style="margin-left:4px; width:12px;">m</span></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-top:4px; padding-top:4px; border-top:1px solid #444;"><span>Zone Length:</span> <strong style="color:#eee">${(zoneDist * ((this.app.data.gridSize || 50) / 50.0)).toFixed(3)}m</strong></div>
                </div></div>`;
            h += `<div class="prop-group"><label>Side</label><div class="side-btns">
                <button class="side-btn ${z.side === 'left' ? 'active' : ''}" id="btn-side-left">Left</button>
                <button class="side-btn ${z.side === 'right' ? 'active' : ''}" id="btn-side-right">Right</button></div></div>`;

            const labelOn = z.showLabel !== false;
            h += `<div class="prop-group"><label>Label Settings</label>
                <div style="font-size:11px; color:#aaa; padding:0 5px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                        <span>Show Label</span><input type="checkbox" id="prop-show-label" ${labelOn ? 'checked' : ''} style="accent-color:#e10600;">
                    </div>
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; ${!labelOn ? 'opacity:0.35; pointer-events:none;' : ''}">
                        <span>Flip Direction</span><button id="btn-flip-label" class="side-btn ${z.labelFlipped ? 'active' : ''}" style="font-size:10px; padding:2px 10px; ${!labelOn ? 'opacity:0.5;' : ''}">${z.labelFlipped ? 'Flipped' : 'Normal'}</button>
                    </div>
                    <div style="display:flex; align-items:center; margin-bottom:4px; ${!labelOn ? 'opacity:0.35; pointer-events:none;' : ''}">
                        <span style="flex: 0 0 60px;">Font Size:</span>
                        <input type="range" min="6" max="20" step="1" value="${z.labelFontSize || 10}" id="prop-label-fs" class="prop-slider" style="flex:1; margin-right:6px; min-width:0;">
                        <input type="number" class="prop-input" style="flex: 0 0 36px; padding:2px; font-size:11px; text-align:right; min-width:0;" id="prop-label-fs-val" value="${z.labelFontSize || 10}" min="6" max="20" step="1">
                    </div>
                </div></div>`;
            h += `<div class="prop-group"><label>Strip Settings</label>
                <div style="font-size:11px; color:#aaa; padding:0 5px;">
                    <div style="display:flex; align-items:center; margin-bottom: 8px;">
                        <span style="flex: 0 0 50px;">Width:</span> 
                        <input type="range" min="1" max="15" step="0.5" value="${z.stripWidth || 5}" id="prop-str-w" class="prop-slider" style="flex:1; margin-right:6px; min-width:0;">
                        <input type="number" class="prop-input" style="flex: 0 0 40px; padding:2px; font-size:11px; text-align:right; min-width:0;" id="prop-str-w-val" value="${z.stripWidth || 5}" min="1" max="15" step="0.5">
                    </div>
                    <div style="display:flex; align-items:center; margin-bottom: 4px;">
                        <span style="flex: 0 0 50px;">Gap:</span> 
                        <input type="range" min="1" max="15" step="1" value="${z.stripSpacing || 2}" id="prop-str-s" class="prop-slider" style="flex:1; margin-right:6px; min-width:0;">
                        <input type="number" class="prop-input" style="flex: 0 0 40px; padding:2px; font-size:11px; text-align:right; min-width:0;" id="prop-str-s-val" value="${z.stripSpacing || 2}" min="1" max="15" step="1">
                    </div>
                </div></div>`;
        } else {
            h += `<div class="prop-row" style="gap:10px; margin-bottom: 10px;">
                    <span class="prop-label" style="width:10px">X</span><input type="number" id="prop-zx" value="${Math.round(z.labelOffsetX || 0)}" class="prop-input" style="flex:1;padding:2px 4px;font-size:11px;">
                    <span class="prop-label" style="width:10px">Y</span><input type="number" id="prop-zy" value="${Math.round(z.labelOffsetY || 0)}" class="prop-input" style="flex:1;padding:2px 4px;font-size:11px;">
                </div>`;
            h += `<div class="prop-row"><span class="prop-label" style="width:50px;text-align:left">Rotate</span>
                    <input type="range" min="0" max="360" value="${Math.round(z.rotation || 0)}" id="prop-zr" class="prop-slider" style="width:100px; flex:none;">
                    <div style="flex:1"></div>
                    <input type="number" id="prop-zr-val" value="${Math.round(z.rotation || 0)}" min="0" max="360" class="prop-input" style="width:45px;padding:2px 4px;font-size:11px;"></div>`;
        }
        h += `</div><button class="prop-btn danger" id="btn-del-zone" style="margin-top: 10px;">Delete Zone</button>`;
        return h;
    }

    _selectProps(sel) {
        let h = '<h3 class="prop-title">Select & Move</h3>';
        if (!sel) {
            h += '<p class="prop-hint">Click on any component (nodes, track sections, zones, etc.) to modify it.</p>';
            return h;
        }

        const typeLabels = {
            'cp': 'Node',
            'turn': 'Turn Marker',
            'garage': 'Garage',
            'pit': 'Pitlane'
        };
        let label = typeLabels[sel.type] || sel.type;
        if (sel.type === 'zone') {
            const z = this.app.data.getZoneById(sel.id);
            if (z && z.type === 'straight_mode') {
                const idx = this.app.data.zones.filter(x => x.type === 'straight_mode').findIndex(x => x.id === z.id) + 1;
                label = `Straight Mode ${idx}`;
            }
        } else if (sel.type === 'turn') {
            const idx = this.app.data.turnMarkers.findIndex(t => t.id === sel.id) + 1;
            label = `Turn ${idx}`;
        } else if (sel.type === 'sector_label') {
            label = `Sector ${sel.sector}`;
        } else if (sel.type === 'cp' || sel.type === 'runoff' || sel.type === 'barrier') {
            const idx = this.app.data.getLogicalNodeIndex(sel.id);
            let nextIdx = idx + 1;
            if (nextIdx > this.app.data.controlPoints.length) nextIdx = 1;
            const sideStr = sel.side === 'left' ? 'L' : 'R';
            if (sel.type === 'runoff' || sel.type === 'barrier') label = `Run-off (Node ${idx}-${nextIdx}, ${sideStr})`;
            else label = `Node ${idx}`;
        }

        h += `<p class="prop-hint" style="margin-bottom: 15px;">Selected: <strong>${label}</strong></p>`;
        h += '<p class="prop-hint dim" style="margin-top:-5px; margin-bottom:15px;">Click on any component (nodes, track sections, zones, etc.) to modify it.</p>';

        if (sel.type === 'cp') {
            const pt = this.app.data.getPointById(sel.id);
            if (pt) h += this._cpProps(pt);
        } else if (sel.type === 'runoff' || sel.type === 'barrier') {
            h += this._runoffBarrierProps(sel);
        } else if (sel.type === 'turn') {
            const tm = this.app.data.getTurnMarkerById(sel.id);
            if (tm) h += this._getTurnUI(tm);

        } else if (sel.type === 'zone') {
            const z = this.app.data.getZoneById(sel.id);
            if (z) h += this._getZoneUI(z);
        } else if (sel.type === 'sector_label') {
            const sl = this.app.data.sectorLabels.find(s => s.sector === sel.sector);
            if (sl) h += this._getSectorLabelUI(sl);
        }
        return h;
    }

    _runoffBarrierProps(sel) {
        const pt = this.app.data.getPointById(sel.id);
        if (!pt) return '';

        const isL = sel.side === 'left';
        const surfType = isL ? pt.surfaceLeft : pt.surfaceRight;
        const hasBarrier = isL ? pt.barrierLeft : pt.barrierRight;
        const surfW = isL ? pt.surfaceWidthLeft : pt.surfaceWidthRight;

        let h = `<div class="prop-group" style="margin-top: 15px; border-top: 1px solid #333; padding-top: 15px;"><label>Surface Type</label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                <button class="surface-btn sel-surf-btn ${surfType === 'grass' ? 'active' : ''}" data-surf="grass" style="padding: 10px 5px;"><div style="display:inline-block; width:12px; height:12px; border-radius:50%; background:#0f0; margin-bottom:4px;"></div><br>Grass</button>
                <button class="surface-btn sel-surf-btn ${surfType === 'gravel' ? 'active' : ''}" data-surf="gravel" style="padding: 10px 5px;"><div style="display:inline-block; width:12px; height:12px; border-radius:50%; background:#a0522d; margin-bottom:4px;"></div><br>Gravel</button>
                <button class="surface-btn sel-surf-btn ${surfType === 'asphalt' ? 'active' : ''}" data-surf="asphalt" style="padding: 10px 5px;"><div style="display:inline-block; width:12px; height:12px; background:#444; margin-bottom:4px;"></div><br>Asphalt</button>
                <button class="surface-btn sel-surf-btn ${surfType === 'none' || !surfType ? 'active' : ''}" data-surf="none" style="padding: 10px 5px;"><div style="display:inline-block; margin-bottom:4px; font-size:12px; color:#aaa;">✕</div><br>None</button>
              </div></div>`;

        h += `<div class="prop-group"><label>Barrier</label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                <button class="surface-btn sel-bar-btn ${hasBarrier ? 'active' : ''}" data-bar="true">On</button>
                <button class="surface-btn sel-bar-btn ${!hasBarrier ? 'active' : ''}" data-bar="false">Off</button>
              </div></div>`;

        const pts = this.app.data.controlPoints;
        const ptIdx = pts.findIndex(p => p.id === pt.id);
        const nextPt = pts[(ptIdx + 1) % pts.length];

        const swStart = isL ? (pt.surfaceWidthLeft ?? 10) : (pt.surfaceWidthRight ?? 10);
        const swEnd = isL ? (nextPt.surfaceWidthLeft ?? 10) : (nextPt.surfaceWidthRight ?? 10);
        const sm = (this.app.data.gridSize || 50) / 50.0;

        h += `<div class="prop-group"><label>Run-off Width <span style="text-transform:none">(m)</span></label>
              <div class="prop-row" style="margin-bottom:6px;">
                  <span class="prop-label" style="width:30px;">S</span>
                  <input type="range" min="0" max="${50 * sm}" step="${0.5 * sm}" value="${(swStart * sm).toFixed(1)}" id="prop-sel-sw-start" class="prop-slider">
                  <input type="number" id="prop-sel-sw-start-val" value="${(swStart * sm).toFixed(1)}" step="${0.5 * sm}" min="0" class="prop-input" style="width:50px;padding:2px 4px;font-size:11px;">
              </div>
              <div class="prop-row" style="margin-bottom:6px;">
                  <span class="prop-label" style="width:30px;">E</span>
                  <input type="range" min="0" max="${50 * sm}" step="${0.5 * sm}" value="${(swEnd * sm).toFixed(1)}" id="prop-sel-sw-end" class="prop-slider">
                  <input type="number" id="prop-sel-sw-end-val" value="${(swEnd * sm).toFixed(1)}" step="${0.5 * sm}" min="0" class="prop-input" style="width:50px;padding:2px 4px;font-size:11px;">
              </div>
              <div class="prop-row">
                  <span class="prop-label" style="width:30px;">B</span>
                  <input type="range" min="-20" max="20" step="${0.5 * sm}" value="0" id="prop-sel-sw-both" class="prop-slider">
                  <input type="number" id="prop-sel-sw-both-val" value="0" step="${0.5 * sm}" class="prop-input" style="width:50px;padding:2px 4px;font-size:11px;">
              </div>
              <button class="prop-btn" style="width:100%; margin-top: 6px;" id="btn-reset-runoff-sw">Reset Run-off Width</button>
              </div>`;

        return h;
    }

    _straightModeProps(sel) {
        let h = '<h3 class="prop-title">Straight Mode Zone</h3><p class="prop-hint">Click on track to create a zone.</p>';
        const smZones = this.app.data.zones.filter(z => z.type === 'straight_mode');
        if (smZones.length > 0) {
            h += `<div class="prop-group" style="margin-top: 15px; border-top: 1px solid #333; padding-top: 15px;"><label class="chk-label prop-hint">Select a Straight Mode Zone</label>
                <select class="prop-input" id="prop-smz-selector" style="width:100%; padding: 4px; background: #222; color: #eee; border: 1px solid #444; border-radius: 4px; font-size: 12px; cursor: pointer; margin-bottom: 15px;">
                    <option value="">-- Choose a zone --</option>`;
            smZones.forEach((z, i) => {
                h += `<option value="${z.id}" ${sel && sel.id === z.id ? 'selected' : ''}>Straight Mode Zone ${i + 1}</option>`;
            });
            h += `</select></div>`;
        }
        if (sel && sel.type === 'zone') {
            const z = this.app.data.getZoneById(sel.id);
            if (z && z.type === 'straight_mode') {
                h += this._getZoneUI(z);
            }
        }
        return h;
    }

    _getNodeDisplayNum(index) {
        let startIdx = this.app.data.controlPoints.findIndex(p => p.id === this.app.data.startNodeId);
        if (startIdx === -1) startIdx = 0;
        const n = this.app.data.controlPoints.length;
        if (n === 0) return index + 1;
        let diff = index - startIdx;
        if (diff < 0) diff += n;
        return diff + 1;
    }

    _drawProps() {
        let h = '<h3 class="prop-title">Draw Track</h3>';
        const n = this.app.data.controlPoints.length;
        if (this.app.data.isClosed) {
            h += `<p class="prop-hint success" style="display: flex; align-items: center; gap: 4px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg> Circuit closed
                  </p>`;
        }
        else {
            h += `<p class="prop-hint">Click to place points.</p>`;
            if (n >= 3) h += '<p class="prop-hint dim">Click near first point to close.</p>';
            else h += `<p class="prop-hint dim">Need ${3 - n} more to close.</p>`;
        }

        const scaleFact = (this.app.data.gridSize || 50) / 50.0;
        const len = this.app.editor.getTrackLength() * scaleFact;
        const turns = this.app.data.turnMarkers.length;

        h += `<div class="prop-group" style="margin-top: 15px;">
                <label>Circuit Stats</label>
                <div class="prop-row" style="margin-top:5px;"><span class="prop-label" style="width:90px">Total Length</span><span class="prop-val">${(len / 1000).toFixed(3)} km</span></div>
                <div class="prop-row"><span class="prop-label" style="width:90px">Nodes</span><span class="prop-val">${n}</span></div>
                <div class="prop-row"><span class="prop-label" style="width:90px">Turns</span><span class="prop-val">${turns}</span></div>`;

        if (len > 0) {
            const track = this.app.editor.getInterpolatedTrack();
            let sLen = {};
            for (let i = 1; i < track.length; i++) {
                const s = track[i - 1].sector;
                if (!sLen[s]) sLen[s] = 0;
                sLen[s] += Math.hypot(track[i].x - track[i - 1].x, track[i].y - track[i - 1].y) * scaleFact;
            }
            const sectors = Object.keys(sLen).sort();
            h += `<div class="prop-row"><span class="prop-label" style="width:90px">Sectors</span><span class="prop-val">${sectors.length}</span></div>`;
            sectors.forEach(s => {
                const sName = s == 0 ? "Unassigned" : `Sector ${s}`;
                h += `<div class="prop-row"><span class="prop-label dim" style="width:90px; margin-left:10px;">${sName}</span><span class="prop-val dim">${(sLen[s] / 1000).toFixed(3)} km</span></div>`;
            });
        }
        if (n > 0) {
            h += `<div class="prop-group" style="margin-top: 15px;">
                    <label>Start / Finish Line</label>
                    <select class="prop-input" id="prop-start-node" style="width:100%; padding: 4px; background: #222; color: #eee; border: 1px solid #444; border-radius: 4px; font-size: 12px; cursor: pointer;">
                        <option value="">-- Auto (First Node) --</option>`;
            this.app.data.controlPoints.forEach((pt, idx) => {
                const isSelected = pt.id === this.app.data.startNodeId;
                h += `<option value="${pt.id}" ${isSelected ? 'selected' : ''}>Node ${this._getNodeDisplayNum(idx)}</option>`;
            });
            h += `  </select>
                    <button class="prop-btn" id="btn-reverse-track" style="margin-top: 10px; width: 100%; border-color: #555;">Reverse Track Direction ⮂</button>
                  </div>`;
        }

        // Ensure intersections are up-to-date before rendering UI
        this.app._updateIntersections();

        // Track Intersections
        if (this.app.intersections && this.app.intersections.length > 0) {
            h += `<div class="prop-group" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #333;">
                    <label>Track Intersections <span style="font-size:10px;">${this.app.intersections.length}</span></label>
                    <p class="prop-hint" style="margin-bottom:8px;">Manage overlapping track segments (e.g., bridges).</p>
                    <select class="prop-input" id="prop-intersection-selector" style="width:100%; padding: 4px; background: #222; color: #eee; border: 1px solid #444; border-radius: 4px; font-size: 12px; cursor: pointer;">`;
            this.app.intersections.forEach((ix, index) => {
                const isSelected = this.app.uiState && this.app.uiState.selectedIntersection === ix.id;
                const dA1 = this._getNodeDisplayNum(ix.cpA);
                const dA2 = this._getNodeDisplayNum((ix.cpA + 1) % n);
                const dB1 = this._getNodeDisplayNum(ix.cpB);
                const dB2 = this._getNodeDisplayNum((ix.cpB + 1) % n);
                h += `<option value="${ix.id}" ${isSelected ? 'selected' : ''}>Intersection ${index + 1} (Nodes ${dA1}-${dA2} & ${dB1}-${dB2})</option>`;
            });
            h += `  </select>
                    <button class="prop-btn" id="btn-invert-overlap" style="margin-top: 10px; width: 100%;">Invert Overlap</button>
                  </div>`;
        } else {
            h += `<div class="prop-group" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #333;">
                    <label>Track Intersections</label>
                    <p class="prop-hint dim">No intersections detected.</p>
                  </div>`;
        }

        h += `</div>`;
        return h;
    }

    _widthProps(sel) {
        let h = '<h3 class="prop-title">Width Brush</h3><p class="prop-hint">Drag up/down on the nodes.</p>';
        if (sel && sel.type === 'cp') {
            const pt = this.app.data.getPointById(sel.id);
            if (pt) h += this._cpProps(pt);
        }
        return h;
    }

    _surfaceProps(sel) {
        const t = this.app.tools.surface;
        let h = '<h3 class="prop-title">Run-off & Barriers</h3>';

        const runoffs = [];
        this.app.data.controlPoints.forEach((pt) => {
            runoffs.push({ pt, side: 'left' });
            runoffs.push({ pt, side: 'right' });
        });

        runoffs.sort((a, b) => this.app.data.getLogicalNodeIndex(a.pt.id) - this.app.data.getLogicalNodeIndex(b.pt.id));

        h += `<div class="prop-group" style="margin-top: 5px;"><label class="chk-label prop-hint">Select a Run-off to edit</label>
            <select class="prop-input" id="prop-runoff-selector" style="width:100%; padding: 4px; background: #222; color: #eee; border: 1px solid #444; border-radius: 4px; font-size: 12px; cursor: pointer; margin-bottom: 5px;">`;

        const isNoneSelected = !sel || (sel.type !== 'runoff' && sel.type !== 'barrier');
        if (isNoneSelected) {
            h += `<option value="" disabled selected>-- Select Run-off --</option>`;
        } else {
            h += `<option value="" disabled>-- Select Run-off --</option>`;
        }

        runoffs.forEach(r => {
            const isSelected = sel && (sel.type === 'runoff' || sel.type === 'barrier') && sel.id === r.pt.id && sel.side === r.side;
            const idx = this.app.data.getLogicalNodeIndex(r.pt.id);
            let nextIdx = idx + 1;
            if (nextIdx > this.app.data.controlPoints.length) nextIdx = 1;
            h += `<option value="${r.pt.id}|${r.side}" ${isSelected ? 'selected' : ''}>Run-off (Node ${idx}-${nextIdx}, ${r.side === 'left' ? 'L' : 'R'})</option>`;
        });
        h += `</select></div>`;

        if (!isNoneSelected) {
            h += this._runoffBarrierProps(sel);
        } else {
            h += `<p class="prop-hint" style="margin-top: 10px;">Select a run-off from the dropdown or click on the map to edit its properties.</p>`;
        }

        return h;
    }

    _sectorProps(sel) {
        const t = this.app.tools.sector;
        let h = '<h3 class="prop-title">Sectors</h3><p class="prop-hint">Click control points. Flow: S1→S2→S3</p>';

        let details = [{ nodes: 0, turns: 0, length: 0 }, { nodes: 0, turns: 0, length: 0 }, { nodes: 0, turns: 0, length: 0 }];
        let unassigned = 0;
        let secs = [];

        if (this.app.data.controlPoints.length >= 3) {
            secs = this.app.data.controlPoints.map(p => p.sector);
            unassigned = secs.filter(s => s === 0).length;

            const track = this.app.editor.getInterpolatedTrack();
            details = [1, 2, 3].map(s => {
                const nodes = this.app.data.controlPoints.filter(p => p.sector === s).length;
                let turns = 0, length = 0;
                for (let i = 1; i < track.length; i++) {
                    if (track[i - 1].sector === s) {
                        length += Math.hypot(track[i].x - track[i - 1].x, track[i].y - track[i - 1].y);
                    }
                }
                this.app.data.turnMarkers.forEach(tm => {
                    const idx = tm.segIndex * this.app.editor.resolution + Math.floor(tm.t * this.app.editor.resolution);
                    if (track[Math.min(idx, track.length - 1)]?.sector === s) turns++;
                });
                return { nodes, turns, length };
            });
        }

        h += `<div class="prop-group" style="margin-top:15px;">`;
        [1, 2, 3].map(sec => {
            const d = details[sec - 1];
            h += `<button class="sector-btn s${sec} ${t.currentSector === sec ? 'active' : ''}" data-sec="${sec}" style="width:100%; margin-bottom:5px;">Sector ${sec}</button>`;
            h += `<div style="display:flex; justify-content:space-between; font-size:11px; color:#aaa; margin-bottom:15px; padding:0 5px;">
                <span>Nodes: <strong style="color:#eee">${d.nodes}</strong></span>
                <span>Turns: <strong style="color:#eee">${d.turns}</strong></span>
                <span>Length: <strong style="color:#eee">${(d.length * ((this.app.data.gridSize || 50) / 50.0) / 1000).toFixed(3)} km</strong></span>
            </div>`;
        });
        h += `</div>`;

        if (sel && sel.type === 'sector_label') {
            const sl = this.app.data.sectorLabels.find(s => s.sector === sel.sector);
            if (sl) {
                h += `<div class="prop-group" style="margin-top: 15px; border-top: 1px solid #333; padding-top: 15px;"><label>Sector ${sel.sector} Label</label>
                    <div class="prop-row"><span class="prop-label" style="width:50px;text-align:left">Rotate</span>
                        <div style="flex:1"></div>
                        <input type="number" id="prop-slr-val" value="${Math.round(sl.rotation || 0)}" min="0" max="360" class="prop-input" style="width:45px;padding:2px 4px;font-size:11px;"></div></div>`;
            }
        }

        if (this.app.data.controlPoints.length >= 3) {
            let orderedSectors = [];
            let startIdx = this.app.data.controlPoints.findIndex(p => p.id === this.app.data.startNodeId);
            if (startIdx === -1) startIdx = 0;

            for (let i = 0; i < this.app.data.controlPoints.length; i++) {
                orderedSectors.push(this.app.data.controlPoints[(startIdx + i) % this.app.data.controlPoints.length].sector);
            }

            const c1 = [1, 2, 3].every(s => orderedSectors.includes(s));
            const c2 = !orderedSectors.includes(0);
            const c3 = orderedSectors[0] === 1;
            const c4 = orderedSectors[orderedSectors.length - 1] === 3;

            let simplified = [];
            for (let i = 0; i < orderedSectors.length; i++) {
                if (simplified.length === 0 || simplified[simplified.length - 1] !== orderedSectors[i]) {
                    simplified.push(orderedSectors[i]);
                }
            }
            const validFlows = ['1,2,3', '1,2,3,1', '2,3,1', '2,3,1,2', '3,1,2', '3,1,2,3'];
            const c5 = validFlows.includes(simplified.join(','));

            const iconCheck = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            const iconX = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

            const mkChk = (cond, text) => `<div style="color: ${cond ? '#00e676' : '#ff5252'}; padding: 3px 0; display: flex; align-items: center;"><span style="display:inline-flex; align-items: center; justify-content: center; width:20px; font-weight:bold;">${cond ? iconCheck : iconX}</span> <span style="color:#ddd; margin-left: 4px;">${text}</span></div>`;

            h += `<div class="prop-group" style="margin-top:15px; background: #1a1a1a; padding: 10px; border-radius: 6px; border: 1px solid #333;">
                <label style="margin-bottom: 8px; display: block; color: #fff;">Flow Validation</label>
                <div style="font-size:11px; line-height:1.4;">
                    ${mkChk(c1, 'All 3 sectors used')}
                    ${mkChk(c2, 'No unassigned nodes')}
                    ${mkChk(c3, 'Sector 1 starts at S/F line')}
                    ${mkChk(c4, 'Sector 3 ends at S/F line')}
                    ${mkChk(c5, 'Continuous flow (S1 → S2 → S3)')}
                </div>
            </div>`;
            h += `<button class="prop-btn" id="btn-reverse-track-sector" style="margin-top: 15px; width: 100%; border-color: #555;">Reverse Track Direction ⮂</button>`;
        }
        return h;
    }

    _pitLaneProps() {
        const n = this.app.data.pitLane.points.length;
        let h = '<h3 class="prop-title">Pit Lane</h3>';
        h += `<p class="prop-hint dim">Pitlane Nodes: <strong>${n}</strong></p>`;
        h += `<div class="prop-group"><label>Width</label>
            <div style="display:flex; align-items:center; margin-bottom: 4px;">
                <input type="range" min="4" max="20" step="0.5" value="${this.app.data.pitLane.width}" id="prop-pitw" class="prop-slider" style="flex:1; margin-right:6px; min-width:0;">
                <input type="number" class="prop-input" style="flex: 0 0 45px; padding:2px; font-size:11px; text-align:right; min-width:0;" id="prop-pitw-val-input" value="${this.app.data.pitLane.width}" min="4" max="20" step="0.5">
                <span style="margin-left:4px; font-size:11px; color:#aaa; width:12px;">m</span>
            </div></div>`;
        h += `<div class="prop-group" style="margin-top: 15px;">
                <label class="chk-label prop-hint" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="checkbox" id="prop-show-pit-nodes" ${this.app.data.showPitlaneNodes ? 'checked' : ''} style="accent-color:#e10600;">
                    <span style="margin-top: 2px; color: #aaa; font-size: 12px; font-weight: normal; letter-spacing: normal; text-transform: none;">Show Pitlane Nodes</span>
                </label>
              </div>`;
        h += `<div class="prop-group" style="margin-top:15px; border-top:1px solid #333; padding-top:15px;">
                <label>Garage Building</label>
                ${!this.app.data.garage ? 
                    `<button class="prop-btn" id="btn-add-garage">Place Garage</button>` :
                    `
                    <div style="display:flex; gap:10px; margin-bottom:10px; margin-top: 8px;">
                        <div style="flex:1;">
                            <span style="font-size:11px;color:#aaa;">Length</span>
                            <input type="number" id="prop-garage-len" value="${this.app.data.garage.length}" class="prop-input" style="width:100%;" min="10" step="1">
                        </div>
                        <div style="flex:1;">
                            <span style="font-size:11px;color:#aaa;">Width</span>
                            <input type="number" id="prop-garage-wid" value="${this.app.data.garage.width}" class="prop-input" style="width:100%;" min="5" step="1">
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; margin-top:8px;">
                        <span style="font-size:11px;color:#aaa;width:42px;">Rotation</span>
                        <input type="range" id="prop-garage-rot-range" class="prop-slider" min="0" max="360" step="1" value="${Math.round(this.app.data.garage.rotation || 0)}" style="flex:1; min-width:10px;">
                        <input type="number" id="prop-garage-rot-num" value="${Math.round(this.app.data.garage.rotation || 0)}" class="prop-input" style="width:48px; padding-left:4px; padding-right:4px;" min="0" max="360" step="1">
                    </div>
                    <button class="prop-btn danger" id="btn-remove-garage" style="margin-top:12px;">Remove Garage</button>
                    `
                }
              </div>`;
        h += '<button class="prop-btn danger" id="btn-clear-pit" style="margin-top: 15px;">Clear Pit Lane</button>';
        return h;
    }

    _hotlapProps() {
        let h = '<h3 class="prop-title">Hot Lap Preview</h3>';
        if (!this.app.data.isClosed) {
            h += '<p class="prop-hint">Circuit must be closed to simulate a lap.</p>';
            return h;
        }

        h += `<div class="prop-group" style="margin-top:15px; border-top:1px solid #333; padding-top:15px;">
                <p class="prop-hint">Open the Hot Lap Simulator modal to configure multiple cars, select camera views, and start the simulation.</p>
                <button class="generate-btn" id="btn-open-hotlap-modal" style="width: 100%; margin-top: 10px; font-weight: bold; padding:10px;">
                    Open Simulator
                </button>
              </div>`;
              
        return h;
    }

    _analysisProps() {
        let h = '<h3 class="prop-title">F1 Circuit Analyzer v2.0</h3>';
        if (!this.app.data.isClosed) {
            h += '<p class="prop-hint">Circuit must be closed to perform geometric analysis.</p>';
            return h;
        }

        const track = this.app.editor.getInterpolatedTrack();
        const sf = (this.app.data.gridSize || 50) / 50.0;

        let totalLength = 0;
        let points = [];
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        for (let i = 0; i < track.length; i++) {
            let prev = i === 0 ? track[track.length - 2] : track[i - 1];
            let dx = track[i].x - prev.x, dy = track[i].y - prev.y;
            let dist = Math.hypot(dx, dy) * sf;
            let angle = Math.atan2(dy, dx);
            points.push({ x: track[i].x * sf, y: track[i].y * sf, dist, angle, sector: track[i].sector || 0 });
            totalLength += dist;
            
            let px = track[i].x * sf, py = track[i].y * sf;
            if (px < minX) minX = px; if (px > maxX) maxX = px;
            if (py < minY) minY = py; if (py > maxY) maxY = py;
        }

        // Bounding Box & Compactness
        let bbArea = (maxX - minX) * (maxY - minY);
        let compactness = bbArea > 0 ? totalLength / Math.sqrt(bbArea) : 0;

        // Section 1.3 - Curvature (Sliding Window ±5)
        for (let i = 0; i < points.length; i++) {
            let win = 5;
            let ahead = points[(i + win) % points.length];
            let behind = points[(i - win + points.length) % points.length];

            let dTheta = ahead.angle - behind.angle;
            while (dTheta > Math.PI) dTheta -= 2 * Math.PI;
            while (dTheta < -Math.PI) dTheta += 2 * Math.PI;

            let ds = 0;
            for (let j = 1; j <= win; j++) {
                ds += points[(i + j) % points.length].dist + points[(i - j + points.length) % points.length].dist;
            }

            points[i].curvature = Math.abs(dTheta) / (ds / 2);
            points[i].rawDirection = Math.sign(dTheta);
            points[i].radius = Math.min(1000, 1 / (points[i].curvature || 0.001));
        }

        // Section 2 - Segment Parsing
        let sections = [];
        let currentType = points[0].radius < 250 ? 'corner' : 'straight';
        let startIdx = 0;
        for (let i = 1; i <= points.length; i++) {
            let type = i === points.length ? currentType : (points[i].radius < 250 ? 'corner' : 'straight');
            if (type !== currentType || i === points.length) {
                let len = 0, dAngle = 0, minR = 1000, sumDir = 0;
                let secCounts = [0, 0, 0, 0];
                for (let j = startIdx; j < i; j++) {
                    len += points[j].dist;
                    if (points[j].radius < minR) minR = points[j].radius;
                    dAngle += points[j].curvature * points[j].rawDirection * points[j].dist;
                    sumDir += points[j].rawDirection;
                    secCounts[points[j].sector]++;
                }
                let angleDeg = Math.abs(dAngle * 180 / Math.PI);
                let dir = Math.sign(sumDir);
                let sector = secCounts[1] >= secCounts[2] && secCounts[1] >= secCounts[3] ? 1 :
                    secCounts[2] >= secCounts[1] && secCounts[2] >= secCounts[3] ? 2 : 3;

                sections.push({ type: currentType, start: startIdx, end: i - 1, len, angleDeg, minR, dir, sector, dAngle });
                if (i < points.length) {
                    currentType = type;
                    startIdx = i;
                }
            }
        }

        if (this.app.data.isClosed && sections.length > 1 && sections[0].type === sections[sections.length - 1].type) {
            let last = sections.pop();
            sections[0].len += last.len;
            sections[0].dAngle += last.dAngle;
            sections[0].angleDeg = Math.abs(sections[0].dAngle * 180 / Math.PI);
            sections[0].minR = Math.min(sections[0].minR, last.minR);
        }

        let merged = true;
        while (merged) {
            merged = false;
            for (let i = 0; i < sections.length; i++) {
                let sec = sections[i];
                if (sec.type === 'straight' && sec.len < 40 && sections.length > 1) {
                    sec.type = 'corner';
                    merged = true;
                } else if (sec.type === 'corner' && sec.len < 20 && sec.angleDeg < 15 && sections.length > 1) {
                    sec.type = 'straight';
                    merged = true;
                }
            }
            if (merged) {
                let newSections = [];
                let current = sections[0];
                for (let i = 1; i < sections.length; i++) {
                    if (sections[i].type === current.type) {
                        current.len += sections[i].len;
                        current.dAngle += sections[i].dAngle;
                        current.angleDeg = Math.abs(current.dAngle * 180 / Math.PI);
                        current.minR = Math.min(current.minR, sections[i].minR);
                        current.end = sections[i].end;
                    } else {
                        newSections.push(current);
                        current = sections[i];
                    }
                }
                newSections.push(current);
                if (this.app.data.isClosed && newSections.length > 1 && newSections[0].type === newSections[newSections.length - 1].type) {
                    let last = newSections.pop();
                    newSections[0].len += last.len;
                    newSections[0].dAngle += last.dAngle;
                    newSections[0].angleDeg = Math.abs(newSections[0].dAngle * 180 / Math.PI);
                    newSections[0].minR = Math.min(newSections[0].minR, last.minR);
                }
                sections = newSections;
            }
        }

        let corners = [], straights = [];
        let currentStraightLen = 0;
        let longestCornerLen = 0;

        sections.forEach(sec => {
            if (sec.type === 'straight') {
                currentStraightLen += sec.len;
            } else {
                let type = 'Medium';
                if (sec.minR < 30) type = 'Ultra-Slow';
                else if (sec.minR < 70) type = 'Slow';
                else if (sec.minR < 130) type = 'Medium-Slow';
                else if (sec.minR < 200) type = 'Medium';
                else if (sec.minR < 350) type = 'Medium-Fast';
                else type = 'Fast';

                if (sec.angleDeg > 150 && sec.minR < 45) type = 'Hairpin';
                else if (sec.angleDeg > 45 && sec.minR >= 300) type = 'Sweeper';
                else if (sec.angleDeg < 25 && sec.minR > 200) type = 'Kink';

                if (type !== 'Kink') {
                    if (sec.len > longestCornerLen) longestCornerLen = sec.len;
                    corners.push({
                        len: sec.len, angleDeg: sec.angleDeg, minR: sec.minR,
                        type: type, dir: sec.dir, precStraight: currentStraightLen,
                        sector: sec.sector, isComplex: false
                    });
                    straights.push(currentStraightLen);
                    currentStraightLen = 0;
                } else {
                    currentStraightLen += sec.len;
                }
            }
        });
        straights.push(currentStraightLen);

        let numComplexSeq = 0, numChicanes = 0, numDirChanges = 0;

        for (let i = 0; i < corners.length; i++) {
            let prevIdx = (i === 0) ? (this.app.data.isClosed ? corners.length - 1 : -1) : i - 1;
            if (prevIdx === -1) continue;

            let prev = corners[prevIdx];
            let curr = corners[i];
            let sepStraight = curr.precStraight;
            if (i === 0 && this.app.data.isClosed) sepStraight += straights[straights.length - 1];

            if (i === 0 && this.app.data.isClosed) curr.precStraight = sepStraight;

            let dirFlipped = (prev.dir !== 0 && curr.dir !== 0 && prev.dir !== curr.dir);
            if (dirFlipped) {
                if (sepStraight < 30 && prev.minR >= 80 && curr.minR >= 80) {
                    prev.isComplex = true;
                    curr.isComplex = true;
                    numComplexSeq++;
                    numDirChanges++;
                } else if (sepStraight < 100 && prev.minR < 80 && curr.minR < 80 && !prev.isComplex && !curr.isComplex) {
                    numChicanes++;
                    numDirChanges++;
                } else {
                    numDirChanges++;
                }
            }
        }

        // Section 6 - Lap Time Estimation & Corner Speeds
        let baseTime = totalLength / (300 / 3.6);
        let totalCornerTimeLost = 0;

        corners.forEach(corner => {
            let cs = Math.sqrt(corner.minR * 4.5 * 9.81) * 3.6;
            let es = Math.min(310, 50 + corner.precStraight * 0.35);
            if (cs > es) cs = es;

            let brakingDist = Math.max(0, (es * es - cs * cs)) / (2 * 50 * 12.96);
            let accelDist = Math.max(0, (es * es - cs * cs)) / (2 * 15 * 12.96);
            let transitDist = brakingDist + accelDist;
            let avgTransitSpeedMS = ((es + cs) / 2) / 3.6;

            let actualTime = avgTransitSpeedMS > 0 ? transitDist / avgTransitSpeedMS : 0;
            let idealTime = (es / 3.6) > 0 ? transitDist / (es / 3.6) : 0;
            let timeLost = Math.max(0, actualTime - idealTime);

            let cornerTraversalTime = (cs / 3.6) > 0 ? corner.len / (cs / 3.6) : 0;
            let idealTraversalTime = (es / 3.6) > 0 ? corner.len / (es / 3.6) : 0;
            timeLost += Math.max(0, cornerTraversalTime - idealTraversalTime);

            totalCornerTimeLost += timeLost;
            corner.cs = cs;
            corner.es = es;
        });
        let lapTimeSeconds = baseTime + totalCornerTimeLost;

        // V2.0 NEW PARAMETERS
        let leftCorners = corners.filter(c => c.dir < 0).length;
        let rightCorners = corners.filter(c => c.dir > 0).length;
        let numCorners = corners.length;
        let symmetryIndex = numCorners > 0 ? Math.abs(leftCorners - rightCorners) / numCorners : 0;

        let brakingZones = 0;
        let overtakingZones = 0;
        let goodExits = 0;
        
        corners.forEach((c, i) => {
            let brakingDelta = c.es - c.cs;
            if (brakingDelta > 100) brakingZones++;
            
            let exitStraight = straights[i + 1] || 0;
            if (i === corners.length - 1 && this.app.data.isClosed) exitStraight += straights[0];
            
            if (exitStraight >= 300) goodExits++;
            
            if (c.precStraight >= 400 && brakingDelta > 100) overtakingZones++;
            else if (c.es > 250 && brakingDelta > 100) overtakingZones++;
        });
        let exitQualityPct = numCorners > 0 ? (goodExits / numCorners) * 100 : 0;

        let sequences = 0;
        let currentChain = 0;
        for (let i = 0; i < corners.length; i++) {
            let sep = corners[i].precStraight;
            if (i === 0 && this.app.data.isClosed) sep += straights[straights.length - 1];
            if (sep <= 150) {
                currentChain++;
            } else {
                if (currentChain >= 3) sequences++;
                currentChain = 1;
            }
        }
        if (currentChain >= 3) sequences++;

        let pitLen = 350;
        if (this.app.data.pitLane.points.length > 1) {
            pitLen = 0;
            for(let i=1; i<this.app.data.pitLane.points.length; i++) {
                let dx = this.app.data.pitLane.points[i].x - this.app.data.pitLane.points[i-1].x;
                let dy = this.app.data.pitLane.points[i].y - this.app.data.pitLane.points[i-1].y;
                pitLen += Math.hypot(dx, dy) * sf;
            }
        }
        let avgSpeed = lapTimeSeconds > 0 ? totalLength / lapTimeSeconds : (200 / 3.6);
        let pitDelta = (pitLen / (80 / 3.6)) - (pitLen / avgSpeed) + 15;

        let secSpeeds = { 1: [], 2: [], 3: [] };
        corners.forEach(c => { if (c.sector && secSpeeds[c.sector]) secSpeeds[c.sector].push(c.cs); });
        let secAvg = { 1: 0, 2: 0, 3: 0 };
        for (let s = 1; s <= 3; s++) {
            if (secSpeeds[s].length > 0) secAvg[s] = secSpeeds[s].reduce((a,b)=>a+b,0) / secSpeeds[s].length;
            else secAvg[s] = 150;
        }
        let meanAvg = (secAvg[1] + secAvg[2] + secAvg[3]) / 3;
        let variance = ((Math.pow(secAvg[1]-meanAvg,2) + Math.pow(secAvg[2]-meanAvg,2) + Math.pow(secAvg[3]-meanAvg,2)) / 3);
        let stdDev = Math.sqrt(variance);
        let sectorBalanceScore = Math.min(100, 20 + stdDev * 3);

        let aspect = bbArea > 0 ? (maxX - minX) / (maxY - minY) : 1;
        if (aspect < 1) aspect = 1 / aspect;
        let originality = 50 + (sectorBalanceScore * 0.3) + (Math.abs(aspect - 2.0) * 10) + (sequences * 5) - (symmetryIndex * 50);
        originality = Math.min(100, Math.max(0, originality));

        // Aggregate Basic Metrics
        const numHairpins = corners.filter(c => c.type === 'Hairpin').length;
        const numSweepers = corners.filter(c => c.type === 'Sweeper').length;
        const numFastCorners = corners.filter(c => c.type === 'Fast').length;
        const numMedFastCorners = corners.filter(c => c.type === 'Medium-Fast').length;
        const numMedCorners = corners.filter(c => c.type === 'Medium').length;
        const numMedSlowCorners = corners.filter(c => c.type === 'Medium-Slow').length;
        const numSlowCorners = corners.filter(c => c.type === 'Slow').length;
        const numUltraSlowCorners = corners.filter(c => c.type === 'Ultra-Slow').length;

        const totalStraightLength = straights.reduce((a, b) => a + b, 0);
        const numStraightsCount = straights.filter(s => s > 0).length;
        const maxStraight = straights.length > 0 ? Math.max(...straights) : 0;
        const straightsOver400m = straights.filter(s => s > 400).length;
        const avgStraightLength = numStraightsCount > 0 ? totalStraightLength / numStraightsCount : 0;

        const cornerDensity = numCorners / (totalLength / 1000);
        let totalTechLength = corners.filter(c => ['Ultra-Slow', 'Slow', 'Medium-Slow', 'Hairpin'].includes(c.type)).reduce((sum, c) => sum + c.len, 0) + (numChicanes * 50);
        let totalHighSpeedLength = totalStraightLength + corners.filter(c => ['Fast', 'Sweeper', 'Medium-Fast'].includes(c.type) || c.isComplex).reduce((sum, c) => sum + c.len, 0);

        // Normalized Scoring (V2.0 weights)
        const norm = (val, max) => Math.min(100, Math.max(0, (val / max) * 100));

        // Use Machine Learning Models for the final scores
        let avgRadius = numCorners > 0 ? corners.reduce((sum, c) => sum + c.minR, 0) / numCorners : 1000;
        let minRadius = numCorners > 0 ? Math.min(...corners.map(c => c.minR)) : 1000;
        let maxRadius = numCorners > 0 ? Math.max(...corners.map(c => c.minR)) : 1000;
        let curvatureVariance = numCorners > 0 ? corners.reduce((sum, c) => sum + Math.pow(c.minR - avgRadius, 2), 0) / numCorners : 0;
        let avgCornerAngle = numCorners > 0 ? corners.reduce((sum, c) => sum + c.angleDeg, 0) / numCorners : 0;
        let techSectionLength = totalTechLength;
        let fastSectionLength = totalHighSpeedLength;
        let numMedCombined = numMedCorners + numMedFastCorners;
        let numSlowCombined = numSlowCorners + numUltraSlowCorners + numMedSlowCorners;

        let features = [
            totalLength, numCorners, numStraightsCount, maxStraight, avgStraightLength,
            avgRadius, minRadius, maxRadius, cornerDensity, numDirChanges,
            numHairpins, numChicanes, numFastCorners, numMedCombined, numSlowCombined,
            techSectionLength, fastSectionLength, curvatureVariance, avgCornerAngle, sequences
        ];
        
        let difficulty = typeof predict_DifficultyScore === 'function' ? predict_DifficultyScore(features) : 0;
        let overtaking = typeof predict_OvertakingScore === 'function' ? predict_OvertakingScore(features) : 0;
        let flow = typeof predict_FlowScore === 'function' ? predict_FlowScore(features) : 0;
        let technicality = typeof predict_TechnicalityScore === 'function' ? predict_TechnicalityScore(features) : 0;
        let highSpeed = typeof predict_HighSpeedScore === 'function' ? predict_HighSpeedScore(features) : 0;
        let braking = typeof predict_BrakingDemandScore === 'function' ? predict_BrakingDemandScore(features) : 0;
        let tireStress = typeof predict_TyreStressScore === 'function' ? predict_TyreStressScore(features) : 0;
        let aeroDemand = typeof predict_AerodynamicDemandScore === 'function' ? predict_AerodynamicDemandScore(features) : 0;
        let cqs = typeof predict_CircuitQualityScore === 'function' ? predict_CircuitQualityScore(features) : 0;

        // Strategic Diversity is still calculated via rule-based logic since it depends heavily on pit delta
        let stratRaw = (Math.abs(pitDelta - 22) < 5 ? 30 : 10) + (sectorBalanceScore * 0.4) + (overtakingZones * 8) + (totalLength / 200);
        let stratDiv = norm(stratRaw, 100);

        // Tier Classification
        let tier = "F Tier";
        if (cqs >= 95) tier = "Legendary";
        else if (cqs >= 90) tier = "S Tier";
        else if (cqs >= 80) tier = "A Tier";
        else if (cqs >= 65) tier = "B Tier";
        else if (cqs >= 50) tier = "C Tier";
        else if (cqs >= 35) tier = "D Tier";

        // Track Classification
        let clScores = {
            "High-Speed Circuit": (highSpeed * 0.5) + ((100 - technicality) * 0.3) + (flow * 0.2),
            "Technical Circuit": (technicality * 0.5) + ((100 - flow) * 0.2) + (difficulty * 0.3),
            "Stop-Start Circuit": (braking * 0.4) + ((100 - flow) * 0.4) + (technicality * 0.2),
            "Overtaking Circuit": (overtaking * 0.6) + (flow * 0.2) + (highSpeed * 0.2),
            "Driver's Circuit": (difficulty * 0.4) + (technicality * 0.3) + (sectorBalanceScore * 0.3),
            "Street-Circuit Style": (technicality * 0.3) + (braking * 0.3) + ((100 - overtaking) * 0.2) + (cornerDensity * 2),
            "Balanced Circuit": (sectorBalanceScore * 0.5) + (flow * 0.2),
            "Modern F1 Style": (braking * 0.4) + (technicality * 0.3) + (overtaking * 0.3)
        };
        let classification = Object.keys(clScores).reduce((a, b) => clScores[a] > clScores[b] ? a : b);

        // UI Formatting
        const pBar = (val, color) => `<div style="width:100%; background:#222; height:8px; border-radius:4px; margin-top:2px; overflow:hidden;"><div style="width:${val}%; background:${color}; height:100%;"></div></div>`;

        h += `<div class="prop-group" style="margin-top: 10px;">
                <div style="font-size:12px; margin-top:5px; background:#1a1a1a; padding:10px; border-radius:6px; border:1px solid #333;">
                    <div style="text-align:center; margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:10px;">
                        <div style="font-size:10px; color:#aaa; text-transform:uppercase;">Circuit Quality Score</div>
                        <div style="font-size:28px; font-weight:bold; color:${cqs > 80 ? '#00e676' : cqs > 60 ? '#ffb300' : '#ff5252'};">${cqs.toFixed(1)} <span style="font-size:14px">/ 100</span></div>
                        <div style="font-size:14px; font-weight:bold; color:#fff; margin-top:4px;">${tier}</div>
                        <div style="font-size:11px; color:#ddd; margin-top:2px;">${classification}</div>
                    </div>
                    
                    <label style="font-size:11px; margin-bottom:5px; color:#888;">Geometric Parameters</label>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 10px; margin-bottom:10px; color:#ccc; font-size:11px;">
                        <div><span style="color:#888">Length</span> <div style="float:right; color:#fff">${(totalLength / 1000).toFixed(3)} km</div></div>
                        <div><span style="color:#888">Corners</span> <div style="float:right; color:#fff">${numCorners}</div></div>
                        <div><span style="color:#888">Hairpins</span> <div style="float:right; color:#fff">${numHairpins}</div></div>
                        <div><span style="color:#888">Chicanes</span> <div style="float:right; color:#fff">${numChicanes}</div></div>
                        <div><span style="color:#888">Longest Straight</span> <div style="float:right; color:#fff">${maxStraight.toFixed(0)} m</div></div>
                        <div><span style="color:#888">Corner Density</span> <div style="float:right; color:#fff">${cornerDensity.toFixed(1)} /km</div></div>
                        <div><span style="color:#888">Tech Section</span> <div style="float:right; color:#fff">${(totalTechLength/1000).toFixed(2)} km</div></div>
                        <div><span style="color:#888">Fast Section</span> <div style="float:right; color:#fff">${(totalHighSpeedLength/1000).toFixed(2)} km</div></div>
                        <div><span style="color:#888">Dir. Changes</span> <div style="float:right; color:#fff">${numDirChanges}</div></div>
                    </div>

                    <label style="font-size:11px; margin-bottom:5px; color:#888; border-top:1px solid #333; padding-top:6px;">V2.0 Parameters</label>
                    <div style="display:grid; grid-template-columns:1fr; gap:6px; margin-bottom:15px; color:#ccc; font-size:11px;">
                        <div><span style="color:#888">Overtaking Zones</span> <div style="float:right; color:#fff">${overtakingZones}</div></div>
                        <div><span style="color:#888">Braking Zones</span> <div style="float:right; color:#fff">${brakingZones}</div></div>
                        <div><span style="color:#888">Corner Chains</span> <div style="float:right; color:#fff">${sequences}</div></div>
                        <div><span style="color:#888">L/R Balance</span> <div style="float:right; color:#fff">${leftCorners} L / ${rightCorners} R (Idx: ${symmetryIndex.toFixed(2)})</div></div>
                        <div><span style="color:#888">Compactness Ratio</span> <div style="float:right; color:#fff">${compactness.toFixed(2)}</div></div>
                        <div><span style="color:#888">Corner Exit Quality</span> <div style="float:right; color:#fff">${exitQualityPct.toFixed(0)}%</div></div>
                        <div><span style="color:#888">Pit Delta (est.)</span> <div style="float:right; color:#fff">${pitDelta.toFixed(1)} s</div></div>
                        <div><span style="color:#888">Sector Balance</span> <div style="float:right; color:#fff">${sectorBalanceScore.toFixed(0)}/100</div></div>
                        <div><span style="color:#888">Layout Originality</span> <div style="float:right; color:#fff">${originality.toFixed(0)}/100</div></div>
                    </div>

                    <label style="font-size:11px; margin-bottom:5px; color:#888; border-top:1px solid #333; padding-top:6px;">Performance Scores</label>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <div style="font-size:11px; color:#aaa">Driver Difficulty <span style="float:right; color:#fff">${difficulty.toFixed(0)}</span>${pBar(difficulty, '#ff1801')}</div>
                        <div style="font-size:11px; color:#aaa">Overtaking <span style="float:right; color:#fff">${overtaking.toFixed(0)}</span>${pBar(overtaking, '#00e676')}</div>
                        <div style="font-size:11px; color:#aaa">Flow <span style="float:right; color:#fff">${flow.toFixed(0)}</span>${pBar(flow, '#29b6f6')}</div>
                        <div style="font-size:11px; color:#aaa">Technicality <span style="float:right; color:#fff">${technicality.toFixed(0)}</span>${pBar(technicality, '#ab47bc')}</div>
                        <div style="font-size:11px; color:#aaa">High-Speed <span style="float:right; color:#fff">${highSpeed.toFixed(0)}</span>${pBar(highSpeed, '#ffa726')}</div>
                        <div style="font-size:11px; color:#aaa">Braking Demand <span style="float:right; color:#fff">${braking.toFixed(0)}</span>${pBar(braking, '#ef5350')}</div>
                        <div style="font-size:11px; color:#aaa">Tyre Stress <span style="float:right; color:#fff">${tireStress.toFixed(0)}</span>${pBar(tireStress, '#ffca28')}</div>
                        <div style="font-size:11px; color:#aaa">Aero Demand <span style="float:right; color:#fff">${aeroDemand.toFixed(0)}</span>${pBar(aeroDemand, '#26c6da')}</div>
                        <div style="font-size:11px; color:#aaa">Strategic Diversity <span style="float:right; color:#fff">${stratDiv.toFixed(0)}</span>${pBar(stratDiv, '#ec407a')}</div>
                    </div>
                </div>
              </div>`;

        return h;
    }

    _zoneProps(sel) {
        const t = this.app.tools.zone;
        let h = '<h3 class="prop-title">F1 Zones</h3><p class="prop-hint">Click near track to place.</p>';
        h += `<div class="prop-group"><label>Type</label><div class="zone-btns">`;
        F1.ZONE_TYPES.forEach(zt => {
            if (zt.key === 'straight_mode') return;
            h += `<button class="zone-btn ${t.zoneType === zt.key ? 'active' : ''}" data-zone="${zt.key}" style="--zone-c:${zt.color};--zone-bg:${zt.bg}">${zt.label.replace('\\n', ' ')}${zt.range ? ' ↔' : ''}</button>`;
        });
        h += '</div></div>';



        if (sel && sel.type === 'zone') {
            const z = this.app.data.getZoneById(sel.id);
            if (z && z.type !== 'straight_mode') {
                h += this._getZoneUI(z);
            }
        }
        return h;
    }

    _turnProps(sel) {
        let h = '<h3 class="prop-title">Turn Placer</h3><p class="prop-hint">Click on the track to manually place Turn Markers (e.g. Turn 1, Turn 2). Select a turn marker in Select mode to rename it or drag it along the track.</p>';
        h += `<div class="prop-group" style="margin-top: 15px; border-top: 1px solid #333; padding-top: 15px;"><label class="chk-label prop-hint">Select a Turn</label>
            <select class="prop-input" id="prop-turn-selector" style="width:100%; padding: 4px; background: #222; color: #eee; border: 1px solid #444; border-radius: 4px; font-size: 12px; cursor: pointer; margin-bottom: 15px;">
                <option value="">-- Choose a turn --</option>`;
        this.app.data.turnMarkers.forEach(t => {
            h += `<option value="${t.id}" ${sel && sel.id === t.id ? 'selected' : ''}>Turn ${t.label} ${t.name ? `(${t.name})` : ''}</option>`;
        });
        h += `</select></div>`;

        if (sel && sel.type === 'turn') {
            const tm = this.app.data.getTurnMarkerById(sel.id);
            if (tm) h += this._getTurnUI(tm);
        }
        return h;
    }

    _eraserProps() {
        let h = '<h3 class="prop-title">Eraser</h3><p class="prop-hint">Click on any component (nodes, track sections, zones, etc.) to erase it.</p>';
        h += '<div class="prop-group" style="margin-top:15px; border-top:1px solid #333; padding-top:15px;">';
        h += '<label>Bulk Actions</label>';
        h += '<button class="prop-btn danger" id="btn-clear-turns" style="width:100%; margin-bottom:4px; transition: background-color 0.2s;">Clear Turns</button>';
        h += '<button class="prop-btn danger" id="btn-clear-sectors" style="width:100%; margin-bottom:4px; transition: background-color 0.2s;">Clear Sectors</button>';
        h += '<button class="prop-btn danger" id="btn-clear-barriers" style="width:100%; margin-bottom:4px; transition: background-color 0.2s;">Clear Barriers</button>';
        h += '<button class="prop-btn danger" id="btn-clear-zones" style="width:100%; margin-bottom:4px; transition: background-color 0.2s;">Clear Zones</button>';
        h += '<button class="prop-btn danger" id="btn-clear-smz" style="width:100%; margin-bottom:4px; transition: background-color 0.2s;">Clear Straight Modes</button>';
        h += '<button class="prop-btn danger" id="btn-clear-pitlane" style="width:100%; margin-bottom:4px; transition: background-color 0.2s;">Clear Pit Lane</button>';


        h += '<button class="prop-btn danger" id="btn-clear-map" style="width:100%; transition: background-color 0.2s;">Clear Map</button>';
        h += '</div>';
        return h;
    }

    _scaleProps() {
        return `<h3 class="prop-title">Scale & Grid</h3>
                <p class="prop-hint">Configure the background grid scale and appearance.</p>
                <div class="prop-group" style="margin-top: 15px;">
                    <label class="chk-label prop-hint" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                        <input type="checkbox" id="cb-grid-on" ${this.app.renderer.showGrid ? 'checked' : ''} style="accent-color:#e10600;">
                        <span style="margin-top: 2px; color: #aaa; font-size: 12px; font-weight: normal; letter-spacing: normal; text-transform: none;">Show Grid</span>
                    </label>
                </div>
                <div class="prop-group"><label>Grid Scale</label>
                    <div class="prop-row">
                        <input type="range" min="10" max="200" step="10" value="${this.app.data.gridSize || 50}" id="prop-grid-size" class="prop-slider">
                        <input type="number" id="prop-grid-size-val" value="${this.app.data.gridSize || 50}" step="10" class="prop-input" style="width:50px;padding:2px 4px;font-size:11px;">
                    </div>
                </div>
                <div class="prop-group"><label>Grid Color</label>
                    <div class="prop-row"><input type="color" id="prop-grid-color" value="${this.app.renderer.gridColor}" style="width:40px;height:24px;cursor:pointer;border:1px solid #333;border-radius:4px;padding:0;background:transparent;"></div>
                </div>
                <div class="prop-group"><label>Grid Opacity</label>
                    <div class="prop-row">
                        <input type="range" min="1" max="100" value="${Math.round(this.app.renderer.gridOpacity * 100)}" id="prop-grid-opacity" class="prop-slider">
                        <input type="number" id="prop-grid-opacity-val" value="${Math.round(this.app.renderer.gridOpacity * 100)}" class="prop-input" style="width:50px;padding:2px 4px;font-size:11px;">
                    </div>
                <div class="prop-group" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #333;">
                    <label>Ruler Tool</label>
                    <p class="prop-hint" style="margin-bottom: 10px;">Enable Ruler to place multiple measurements on the track.</p>
                    <button class="prop-btn ${this.app.rulerMode ? 'danger' : ''}" id="btn-toggle-ruler" style="width:100%; margin-bottom:10px;">${this.app.rulerMode ? 'Clear Rulers' : 'Ruler'}</button>
                </div>`;
    }

    _bindEvents() {
        // Show Nodes
        const cbNodes = document.getElementById('cb-show-nodes');
        if (cbNodes) {
            cbNodes.onchange = () => {
                this.app.renderer.showCtrlPts = cbNodes.checked;
                this.app.requestRender();
            };
        }

        // Node Selector
        const ns = document.getElementById('prop-node-selector');
        if (ns) {
            ns.onchange = () => {
                if (ns.value) {
                    this.app.setSelection({ type: 'cp', id: parseInt(ns.value) });
                } else {
                    this.app.setSelection(null);
                }
            };
        }

        // Start/Finish Selector
        const sfn = document.getElementById('prop-start-node');
        if (sfn) {
            sfn.onchange = () => {
                if (sfn.value) {
                    this.app.data.snapshot();
                    this.app.data.startNodeId = parseInt(sfn.value);
                    this.app._updateIntersections();
                    this.updateProperties();
                    this.app.requestRender();
                }
            };
        }

        document.querySelectorAll('.sel-surf-btn').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                const sel = this.app.selection;
                if (!sel || (sel.type !== 'runoff' && sel.type !== 'barrier')) return;
                const pt = this.app.data.getPointById(sel.id);
                if (!pt) return;

                const pts = this.app.data.controlPoints;
                const ptIdx = pts.findIndex(p => p.id === pt.id);
                const nextPt = pts[(ptIdx + 1) % pts.length];

                this.app.data.snapshot();
                const v = b.dataset.surf;
                if (sel.side === 'left') pt.surfaceLeft = v; else pt.surfaceRight = v;

                if (v === 'none') {
                    if (sel.side === 'left') {
                        pt.surfaceWidthLeft = 0;
                        nextPt.surfaceWidthLeft = 0;
                    } else {
                        pt.surfaceWidthRight = 0;
                        nextPt.surfaceWidthRight = 0;
                    }
                } else {
                    if (sel.side === 'left') {
                        if (!pt.surfaceWidthLeft || pt.surfaceWidthLeft === 0) pt.surfaceWidthLeft = 10;
                        if (!nextPt.surfaceWidthLeft || nextPt.surfaceWidthLeft === 0) nextPt.surfaceWidthLeft = 10;
                    } else {
                        if (!pt.surfaceWidthRight || pt.surfaceWidthRight === 0) pt.surfaceWidthRight = 10;
                        if (!nextPt.surfaceWidthRight || nextPt.surfaceWidthRight === 0) nextPt.surfaceWidthRight = 10;
                    }
                }

                this.updateProperties();
                this.app.requestRender();
            });
        });
        document.querySelectorAll('.sel-bar-btn').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                const sel = this.app.selection;
                if (!sel || (sel.type !== 'runoff' && sel.type !== 'barrier')) return;
                const pt = this.app.data.getPointById(sel.id);
                if (!pt) return;
                this.app.data.snapshot();
                const v = b.dataset.bar === 'true';
                if (sel.side === 'left') pt.barrierLeft = v; else pt.barrierRight = v;
                this.updateProperties();
                this.app.requestRender();
            });
        });

        const pswS = document.getElementById('prop-sel-sw-start');
        const pswSVal = document.getElementById('prop-sel-sw-start-val');
        const pswE = document.getElementById('prop-sel-sw-end');
        const pswEVal = document.getElementById('prop-sel-sw-end-val');
        const pswB = document.getElementById('prop-sel-sw-both');
        const pswBVal = document.getElementById('prop-sel-sw-both-val');

        if (pswS && pswSVal && pswE && pswEVal && pswB && pswBVal) {
            const sm = (this.app.data.gridSize || 50) / 50.0;
            const updateSelSW = (type, val, save) => {
                if (save) this.app.data.snapshot();
                let v = parseFloat(val) / sm;
                if (isNaN(v)) return;
                v = Math.max(0, v);

                const sel = this.app.selection;
                if (!sel || (sel.type !== 'runoff' && sel.type !== 'barrier')) return;
                const pt = this.app.data.getPointById(sel.id);
                if (!pt) return;
                const pts = this.app.data.controlPoints;
                const nextPt = pts[(pts.findIndex(p => p.id === pt.id) + 1) % pts.length];

                if (type === 'start') {
                    if (sel.side === 'left') pt.surfaceWidthLeft = v; else pt.surfaceWidthRight = v;
                    pswS.value = (v * sm).toFixed(1);
                    pswSVal.value = (v * sm).toFixed(1);
                } else if (type === 'end') {
                    if (sel.side === 'left') nextPt.surfaceWidthLeft = v; else nextPt.surfaceWidthRight = v;
                    pswE.value = (v * sm).toFixed(1);
                    pswEVal.value = (v * sm).toFixed(1);
                }
                this.app.requestRender();
            };

            pswS.oninput = () => updateSelSW('start', pswS.value, false);
            pswS.onchange = () => updateSelSW('start', pswS.value, true);
            pswSVal.onchange = () => updateSelSW('start', pswSVal.value, true);

            pswE.oninput = () => updateSelSW('end', pswE.value, false);
            pswE.onchange = () => updateSelSW('end', pswE.value, true);
            pswEVal.onchange = () => updateSelSW('end', pswEVal.value, true);

            let lastBothVal = 0;
            pswB.onmousedown = () => { lastBothVal = parseFloat(pswB.value); };
            const applyBothDelta = (cur, save) => {
                if (save) this.app.data.snapshot();
                const delta = (cur - lastBothVal) / sm;
                lastBothVal = cur;

                const sel = this.app.selection;
                if (!sel || (sel.type !== 'runoff' && sel.type !== 'barrier')) return;
                const pt = this.app.data.getPointById(sel.id);
                if (!pt) return;
                const pts = this.app.data.controlPoints;
                const nextPt = pts[(pts.findIndex(p => p.id === pt.id) + 1) % pts.length];

                if (sel.side === 'left') {
                    pt.surfaceWidthLeft = Math.max(0, (pt.surfaceWidthLeft ?? 10) + delta);
                    nextPt.surfaceWidthLeft = Math.max(0, (nextPt.surfaceWidthLeft ?? 10) + delta);
                    pswS.value = (pt.surfaceWidthLeft * sm).toFixed(1);
                    pswSVal.value = (pt.surfaceWidthLeft * sm).toFixed(1);
                    pswE.value = (nextPt.surfaceWidthLeft * sm).toFixed(1);
                    pswEVal.value = (nextPt.surfaceWidthLeft * sm).toFixed(1);
                } else {
                    pt.surfaceWidthRight = Math.max(0, (pt.surfaceWidthRight ?? 10) + delta);
                    nextPt.surfaceWidthRight = Math.max(0, (nextPt.surfaceWidthRight ?? 10) + delta);
                    pswS.value = (pt.surfaceWidthRight * sm).toFixed(1);
                    pswSVal.value = (pt.surfaceWidthRight * sm).toFixed(1);
                    pswE.value = (nextPt.surfaceWidthRight * sm).toFixed(1);
                    pswEVal.value = (nextPt.surfaceWidthRight * sm).toFixed(1);
                }
                pswB.value = 0;
                pswBVal.value = 0;
                lastBothVal = 0;
                this.app.requestRender();
            };

            pswB.oninput = () => {
                // For live sliding we apply delta but don't reset to 0 yet
                const cur = parseFloat(pswB.value);
                const delta = (cur - lastBothVal) / sm;
                lastBothVal = cur;

                const sel = this.app.selection;
                if (!sel || (sel.type !== 'runoff' && sel.type !== 'barrier')) return;
                const pt = this.app.data.getPointById(sel.id);
                if (!pt) return;
                const pts = this.app.data.controlPoints;
                const nextPt = pts[(pts.findIndex(p => p.id === pt.id) + 1) % pts.length];

                if (sel.side === 'left') {
                    pt.surfaceWidthLeft = Math.max(0, (pt.surfaceWidthLeft ?? 10) + delta);
                    nextPt.surfaceWidthLeft = Math.max(0, (nextPt.surfaceWidthLeft ?? 10) + delta);
                    pswS.value = (pt.surfaceWidthLeft * sm).toFixed(1);
                    pswSVal.value = (pt.surfaceWidthLeft * sm).toFixed(1);
                    pswE.value = (nextPt.surfaceWidthLeft * sm).toFixed(1);
                    pswEVal.value = (nextPt.surfaceWidthLeft * sm).toFixed(1);
                } else {
                    pt.surfaceWidthRight = Math.max(0, (pt.surfaceWidthRight ?? 10) + delta);
                    nextPt.surfaceWidthRight = Math.max(0, (nextPt.surfaceWidthRight ?? 10) + delta);
                    pswS.value = (pt.surfaceWidthRight * sm).toFixed(1);
                    pswSVal.value = (pt.surfaceWidthRight * sm).toFixed(1);
                    pswE.value = (nextPt.surfaceWidthRight * sm).toFixed(1);
                    pswEVal.value = (nextPt.surfaceWidthRight * sm).toFixed(1);
                }
                pswBVal.value = cur;
                this.app.requestRender();
            };
            pswB.onchange = () => {
                // Apply final change and save
                applyBothDelta(parseFloat(pswB.value), true);
            };
            pswBVal.onchange = () => {
                // They typed a number in Both offset. Apply it as a delta from 0.
                lastBothVal = 0;
                applyBothDelta(parseFloat(pswBVal.value), true);
            };
        }

        if (document.getElementById('btn-reset-runoff-sw')) {
            document.getElementById('btn-reset-runoff-sw').onclick = () => {
                this.app.data.snapshot();
                const sel = this.app.selection;
                if (!sel || (sel.type !== 'runoff' && sel.type !== 'barrier')) return;
                const pt = this.app.data.getPointById(sel.id);
                if (!pt) return;
                const pts = this.app.data.controlPoints;
                const nextPt = pts[(pts.findIndex(p => p.id === pt.id) + 1) % pts.length];

                if (sel.side === 'left') {
                    pt.surfaceWidthLeft = 10.0;
                    nextPt.surfaceWidthLeft = 10.0;
                } else {
                    pt.surfaceWidthRight = 10.0;
                    nextPt.surfaceWidthRight = 10.0;
                }
                this.updateProperties();
                this.app.requestRender();
            };
        }

        if (document.getElementById('btn-reset-tw')) {
            document.getElementById('btn-reset-tw').onclick = () => {
                this.app.data.snapshot();
                const sel = this.app.selection;
                if (sel && sel.type === 'cp') {
                    const pt = this.app.data.getPointById(sel.id);
                    if (pt) {
                        pt.widthLeft = 12.0;
                        pt.widthRight = 12.0;
                        this.updateProperties();
                        this.app.requestRender();
                    }
                }
            };
        }
        if (document.getElementById('btn-reset-sw')) {
            document.getElementById('btn-reset-sw').onclick = () => {
                this.app.data.snapshot();
                const sel = this.app.selection;
                if (sel && sel.type === 'cp') {
                    const pt = this.app.data.getPointById(sel.id);
                    if (pt) {
                        pt.surfaceWidthLeft = 10.0;
                        pt.surfaceWidthRight = 10.0;
                        this.updateProperties();
                        this.app.requestRender();
                    }
                }
            };
        }

        // Reverse Track
        const handleReverse = () => {
            if (this.app.data.controlPoints.length >= 2) {
                this.app.data.snapshot();
                this.app.data.reverseTrack();
                this.updateProperties();
                this.app.requestRender();
            }
        };
        const btnRevDraw = document.getElementById('btn-reverse-track');
        if (btnRevDraw) btnRevDraw.onclick = handleReverse;
        const btnRevSec = document.getElementById('btn-reverse-track-sector');
        if (btnRevSec) btnRevSec.onclick = handleReverse;

        const ixSel = document.getElementById('prop-intersection-selector');
        if (ixSel) {
            ixSel.onchange = () => {
                if (!this.app.uiState) this.app.uiState = {};
                this.app.uiState.selectedIntersection = parseInt(ixSel.value);
                this.app.requestRender();
            };
        }

        const roSel = document.getElementById('prop-runoff-selector');
        if (roSel) {
            roSel.onchange = () => {
                if (roSel.value) {
                    const parts = roSel.value.split('|');
                    this.app.selection = { type: 'runoff', id: parseInt(parts[0]), side: parts[1] };
                } else {
                    this.app.selection = null;
                }
                this.updateProperties();
                this.app.requestRender();
            };
        }

        const btnInvertOverlap = document.getElementById('btn-invert-overlap');
        if (btnInvertOverlap) {
            btnInvertOverlap.onclick = () => {
                if (!ixSel || !ixSel.value) return;
                const ixId = parseInt(ixSel.value);
                const ix = this.app.intersections.find(i => i.id === ixId);
                if (!ix) return;

                this.app.data.snapshot();
                const key = ix.key;
                const legacyKey = `${ix.cpA}-${ix.cpB}`;
                const idx = this.app.data.overlapInversions.indexOf(key);
                const legacyIdx = this.app.data.overlapInversions.indexOf(legacyKey);

                if (idx > -1) {
                    this.app.data.overlapInversions.splice(idx, 1);
                } else if (legacyIdx > -1) {
                    this.app.data.overlapInversions.splice(legacyIdx, 1);
                } else {
                    this.app.data.overlapInversions.push(key);
                }
                this.app.requestRender();
            };
        }

        // Sector btns
        document.querySelectorAll('.sector-btn[data-sec]').forEach(b => {
            b.onclick = () => {
                const s = parseInt(b.dataset.sec);
                if (this.app.activeToolName === 'sector') this.app.tools.sector.currentSector = s;
                else if (this.app.selection && this.app.selection.type === 'cp') { 
                    const pt = this.app.data.getPointById(this.app.selection.id); 
                    if (pt) { 
                        this.app.data.snapshot(); 
                        pt.sector = s; 
                        this.app.editor._needsUpdate = true;
                        if (this.app.preview3D) this.app.preview3D.app.editor._needsUpdate = true;
                    } 
                }
                this.updateProperties(); this.app.requestRender();
            };
        });

        // Turn Marker inputs
        const tmlabel = document.getElementById('prop-tmlabel');
        if (tmlabel && this.app.selection && this.app.selection.type === 'turn') {
            const tm = this.app.data.getTurnMarkerById(this.app.selection.id);
            if (tm) tmlabel.oninput = () => { tm.label = tmlabel.value; this.app.requestRender(); };
        }
        const tmname = document.getElementById('prop-tmname');
        if (tmname && this.app.selection && this.app.selection.type === 'turn') {
            const tm = this.app.data.getTurnMarkerById(this.app.selection.id);
            if (tm) tmname.oninput = () => { tm.name = tmname.value; this.app.requestRender(); };
        }
        const dt = document.getElementById('btn-del-turn');
        if (dt && this.app.selection && this.app.selection.type === 'turn') {
            dt.onclick = () => {
                this.app.data.snapshot();
                this.app.data.removeTurnMarker(this.app.selection.id);
                this.app.setSelection(null);
                this.app.requestRender();
            };
        }
        const btnTmLeft = document.getElementById('btn-tm-left');
        const btnTmRight = document.getElementById('btn-tm-right');
        if (btnTmLeft && btnTmRight && this.app.selection && this.app.selection.type === 'turn') {
            const tm = this.app.data.getTurnMarkerById(this.app.selection.id);
            if (tm) {
                btnTmLeft.onclick = () => { this.app.data.snapshot(); tm.side = 'left'; this.updateProperties(); this.app.requestRender(); };
                btnTmRight.onclick = () => { this.app.data.snapshot(); tm.side = 'right'; this.updateProperties(); this.app.requestRender(); };
            }
        }

        // Straight mode side buttons & new controls
        const btnLeft = document.getElementById('btn-side-left');
        const btnRight = document.getElementById('btn-side-right');
        if (this.app.selection && this.app.selection.type === 'zone') {
            const z = this.app.data.getZoneById(this.app.selection.id);
            if (z) {
                if (btnLeft) btnLeft.onclick = () => { this.app.data.snapshot(); z.side = 'left'; this.updateProperties(); this.app.requestRender(); };
                if (btnRight) btnRight.onclick = () => { this.app.data.snapshot(); z.side = 'right'; this.updateProperties(); this.app.requestRender(); };
                const strW = document.getElementById('prop-str-w');
                const strWVal = document.getElementById('prop-str-w-val');
                if (strW && strWVal) {
                    strW.oninput = () => { z.stripWidth = parseFloat(strW.value); strWVal.value = z.stripWidth; this.app.requestRender(); };
                    strWVal.onchange = () => {
                        let v = parseFloat(strWVal.value) || 5;
                        if (v < 1) v = 1; if (v > 15) v = 15;
                        z.stripWidth = v; strW.value = v; strWVal.value = v; this.app.requestRender();
                    };
                }
                const strS = document.getElementById('prop-str-s');
                const strSVal = document.getElementById('prop-str-s-val');
                if (strS && strSVal) {
                    strS.oninput = () => { z.stripSpacing = parseInt(strS.value); strSVal.value = z.stripSpacing; this.app.requestRender(); };
                    strSVal.onchange = () => {
                        let v = parseInt(strSVal.value) || 2;
                        if (v < 1) v = 1; if (v > 15) v = 15;
                        z.stripSpacing = v; strS.value = v; strSVal.value = v; this.app.requestRender();
                    };
                }

                const smzStart = document.getElementById('prop-smz-start');
                if (smzStart) smzStart.oninput = () => {
                    this.app.data.snapshot();
                    const pt = this.app.editor.getPointAtDistance(parseFloat(smzStart.value) || 0);
                    if (pt) { z.segIndex = pt.segIndex; z.t = pt.t; this.app.requestRender(); }
                };
                if (smzStart) smzStart.onchange = () => { this.updateProperties(); };

                const smzEnd = document.getElementById('prop-smz-end');
                if (smzEnd) smzEnd.oninput = () => {
                    this.app.data.snapshot();
                    const pt = this.app.editor.getPointAtDistance(parseFloat(smzEnd.value) || 0);
                    if (pt) { z.endSegIndex = pt.segIndex; z.endT = pt.t; this.app.requestRender(); }
                };
                if (smzEnd) smzEnd.onchange = () => { this.updateProperties(); };
                const zr = document.getElementById('prop-zr');
                const zrVal = document.getElementById('prop-zr-val');
                if (zr && zrVal) {
                    zr.oninput = () => { z.rotation = parseInt(zr.value); zrVal.value = z.rotation; this.app.requestRender(); };
                    zrVal.onchange = () => {
                        let v = parseInt(zrVal.value) || 0;
                        if (v < 0) v = 0; if (v > 360) v = 360;
                        zrVal.value = v; zr.value = v; z.rotation = v;
                        this.app.requestRender();
                    };
                }
                const bL = document.getElementById('btn-side-left');
                const bR = document.getElementById('btn-side-right');
                if (bL) bL.onclick = () => { z.side = 'left'; this.app.requestRender(); this.updateProperties(); };
                if (bR) bR.onclick = () => { z.side = 'right'; this.app.requestRender(); this.updateProperties(); };
                const slCb = document.getElementById('prop-show-label');
                if (slCb) slCb.onchange = () => {
                    if (slCb.checked) {
                        // Exclusive: turn off label on all other straight_mode zones
                        this.app.data.zones.filter(oz => oz.type === 'straight_mode' && oz.id !== z.id).forEach(oz => oz.showLabel = false);
                    }
                    z.showLabel = slCb.checked;
                    this.app.requestRender();
                    this.updateProperties();
                };
                const flipBtn = document.getElementById('btn-flip-label');
                if (flipBtn) flipBtn.onclick = () => {
                    z.labelFlipped = !z.labelFlipped;
                    this.app.requestRender();
                    this.updateProperties();
                };
                const lfs = document.getElementById('prop-label-fs'), lfsVal = document.getElementById('prop-label-fs-val');
                if (lfs && lfsVal) {
                    lfs.oninput = () => { z.labelFontSize = parseInt(lfs.value); lfsVal.value = z.labelFontSize; this.app.requestRender(); };
                    lfsVal.onchange = () => { let v = parseInt(lfsVal.value) || 10; if (v < 6) v = 6; if (v > 20) v = 20; lfsVal.value = v; lfs.value = v; z.labelFontSize = v; this.app.requestRender(); };
                }
                const zx = document.getElementById('prop-zx'), zy = document.getElementById('prop-zy');
                if (zx) zx.onchange = () => { z.labelOffsetX = parseInt(zx.value) || 0; this.app.requestRender(); };
                if (zy) zy.onchange = () => { z.labelOffsetY = parseInt(zy.value) || 0; this.app.requestRender(); };
            }
        }
        const ts = document.getElementById('prop-turn-selector');
        if (ts) {
            ts.onchange = () => {
                if (ts.value) {
                    this.app.setSelection({ type: 'turn', id: parseInt(ts.value) });
                } else {
                    this.app.setSelection(null);
                }
            };
        }
        const smzs = document.getElementById('prop-smz-selector');
        if (smzs) {
            smzs.onchange = () => {
                if (smzs.value) {
                    this.app.setSelection({ type: 'zone', id: parseInt(smzs.value) });
                    this.app.tools.straightMode.zoneType = 'straight_mode';
                } else {
                    this.app.setSelection(null);
                }
            };
        }

        // Turn marker rotation
        const tmr = document.getElementById('prop-tmr'), tmrv = document.getElementById('prop-tmr-val');
        if (tmr && tmrv && this.app.selection && this.app.selection.type === 'turn') {
            const tm = this.app.data.getTurnMarkerById(this.app.selection.id);
            if (tm) {
                tmr.oninput = () => { tm.rotation = parseInt(tmr.value); tmrv.value = tm.rotation; this.app.requestRender(); };
                tmrv.onchange = () => {
                    let v = parseInt(tmrv.value);
                    if (isNaN(v)) v = 0;
                    v = Math.max(0, Math.min(360, v));
                    tm.rotation = v; tmr.value = v; tmrv.value = v;
                    this.app.requestRender();
                };
            }
        }
        // Sector label rotation
        const slr = document.getElementById('prop-slr');
        const slrv = document.getElementById('prop-slr-val');
        if (this.app.selection && this.app.selection.type === 'sector_label') {
            const sl = this.app.data.sectorLabels.find(s => s.sector === this.app.selection.sector);
            if (sl) {
                if (slr) {
                    slr.oninput = () => { sl.rotation = parseInt(slr.value); if (slrv) slrv.value = sl.rotation; this.app.requestRender(); };
                }
                if (slrv) {
                    slrv.onchange = () => {
                        let v = parseInt(slrv.value);
                        if (isNaN(v)) v = 0;
                        v = Math.max(0, Math.min(360, v));
                        sl.rotation = v;
                        slrv.value = v;
                        if (slr) slr.value = v;
                        this.app.requestRender();
                    };
                }
            }
        }

        // Side/mode btns
        const wl = document.getElementById('prop-wl'), wlv = document.getElementById('prop-wl-val');
        const wr = document.getElementById('prop-wr'), wrv = document.getElementById('prop-wr-val');
        const swl = document.getElementById('prop-swl'), swlv = document.getElementById('prop-swl-val');
        const swr = document.getElementById('prop-swr'), swrv = document.getElementById('prop-swr-val');

        if (this.app.selection && this.app.selection.type === 'cp') {
            const pt = this.app.data.getPointById(this.app.selection.id);
            if (pt) {
                const px = document.getElementById('prop-x-val');
                if (px) px.onchange = () => { pt.x = parseFloat(px.value); this.app.requestRender(); };
                const py = document.getElementById('prop-y-val');
                if (py) py.onchange = () => { pt.y = parseFloat(py.value); this.app.requestRender(); };
                
                const pz = document.getElementById('prop-z');
                const pzv = document.getElementById('prop-z-val');
                if (pz && pzv) {
                    pz.oninput = () => { pt.z = parseFloat(pz.value); pzv.value = pz.value; this.app.requestRender(); if (this.app.preview3D) this.app.preview3D.app.requestRender(); };
                    pzv.onchange = () => { let v = parseFloat(pzv.value); if(isNaN(v)) v=0; pt.z = v; pz.value = v; this.app.requestRender(); if (this.app.preview3D) this.app.preview3D.app.requestRender(); };
                }
                const btnResElevBank = document.getElementById('btn-reset-elev-bank');
                if (btnResElevBank) {
                    btnResElevBank.onclick = () => { 
                        pt.z = 0; if(pz) pz.value = 0; if(pzv) pzv.value = 0; 
                        pt.banking = 0;
                        this.app.requestRender(); if (this.app.preview3D) this.app.preview3D.app.requestRender();
                        const pBank = document.getElementById('prop-banking');
                        const pBankVal = document.getElementById('prop-banking-val');
                        if (pBank) pBank.value = 0;
                        if (pBankVal) pBankVal.value = 0;
                        const bl = document.getElementById('btn-bank-left');
                        const br = document.getElementById('btn-bank-right');
                        if (bl) bl.classList.add('active');
                        if (br) br.classList.remove('active');
                    };
                }
                
                const pBank = document.getElementById('prop-banking');
                const pBankVal = document.getElementById('prop-banking-val');
                const btnBankLeft = document.getElementById('btn-bank-left');
                const btnBankRight = document.getElementById('btn-bank-right');
                if (pBank && pBankVal && btnBankLeft && btnBankRight) {
                    const updateBankingUI = () => {
                        const val = Math.abs(pt.banking || 0);
                        const isLeft = (pt.banking || 0) >= 0;
                        pBank.value = val;
                        pBankVal.value = val;
                        btnBankLeft.classList.toggle('active', isLeft);
                        btnBankRight.classList.toggle('active', !isLeft);
                    };
                    const setBanking = (val, isLeft) => {
                        pt.banking = isLeft ? Math.abs(val) : -Math.abs(val);
                        this.app.requestRender();
                        if (this.app.preview3D) this.app.preview3D.app.requestRender();
                        updateBankingUI();
                    };
                    pBank.oninput = () => setBanking(parseFloat(pBank.value), btnBankLeft.classList.contains('active'));
                    pBankVal.onchange = () => {
                        let v = parseFloat(pBankVal.value);
                        if (isNaN(v)) v = 0;
                        setBanking(v, btnBankLeft.classList.contains('active'));
                    };
                    btnBankLeft.onclick = () => setBanking(Math.abs(pt.banking || 0), true);
                    btnBankRight.onclick = () => setBanking(Math.abs(pt.banking || 0), false);
                }

                const sm = (this.app.data.gridSize || 50) / 50.0;
                const b = (sl, inp, key) => {
                    if (sl && inp) {
                        sl.oninput = () => { pt[key] = parseFloat(sl.value) / sm; inp.value = sl.value; this.app.requestRender(); };
                        inp.onchange = () => {
                            let v = parseFloat(inp.value) / sm;
                            v = Math.max(key.startsWith('width') ? 5 : 0, v);
                            pt[key] = v;
                            inp.value = (v * sm).toFixed(1);
                            sl.value = inp.value;
                            this.app.requestRender();
                        };
                    }
                };
                b(wl, wlv, 'widthLeft'); b(wr, wrv, 'widthRight'); b(swl, swlv, 'surfaceWidthLeft'); b(swr, swrv, 'surfaceWidthRight');

                const wb = document.getElementById('prop-wb'), wbv = document.getElementById('prop-wb-val');
                if (wb && wbv) {
                    let lastV = 0;
                    const applyDelta = (v) => {
                        const d = (v - lastV) / sm; lastV = v;
                        pt.widthLeft = Math.max(1, pt.widthLeft + d); pt.widthRight = Math.max(1, pt.widthRight + d);
                        if (wl) wl.value = (pt.widthLeft * sm).toFixed(1); if (wlv) wlv.value = (pt.widthLeft * sm).toFixed(1);
                        if (wr) wr.value = (pt.widthRight * sm).toFixed(1); if (wrv) wrv.value = (pt.widthRight * sm).toFixed(1);
                        this.app.requestRender();
                    };
                    wb.oninput = () => { wbv.value = wb.value; applyDelta(parseFloat(wb.value)); };
                    wb.onchange = () => { wb.value = 0; wbv.value = 0; lastV = 0; };
                    wbv.onchange = () => { wb.value = wbv.value; applyDelta(parseFloat(wbv.value)); wb.value = 0; wbv.value = 0; lastV = 0; };
                }
                const swb = document.getElementById('prop-swb'), swbv = document.getElementById('prop-swb-val');
                if (swb && swbv) {
                    let lastV = 0;
                    const applyDelta = (v) => {
                        const d = (v - lastV) / sm; lastV = v;
                        pt.surfaceWidthLeft = Math.max(0, pt.surfaceWidthLeft + d); pt.surfaceWidthRight = Math.max(0, pt.surfaceWidthRight + d);
                        if (swl) swl.value = (pt.surfaceWidthLeft * sm).toFixed(1); if (swlv) swlv.value = (pt.surfaceWidthLeft * sm).toFixed(1);
                        if (swr) swr.value = (pt.surfaceWidthRight * sm).toFixed(1); if (swrv) swrv.value = (pt.surfaceWidthRight * sm).toFixed(1);
                        this.app.requestRender();
                    };
                    swb.oninput = () => { swbv.value = swb.value; applyDelta(parseFloat(swb.value)); };
                    swb.onchange = () => { swb.value = 0; swbv.value = 0; lastV = 0; };
                    swbv.onchange = () => { swb.value = swbv.value; applyDelta(parseFloat(swbv.value)); swb.value = 0; swbv.value = 0; lastV = 0; };
                }
            }
        }

        document.querySelectorAll('.side-btn[data-side]').forEach(b => { b.onclick = () => { this.app.tools.width.setSide(b.dataset.side); this.updateProperties(); } });
        document.querySelectorAll('.side-btn[data-wmode]').forEach(b => { b.onclick = () => { this.app.tools.width.setMode(b.dataset.wmode); this.updateProperties(); } });
        // Surface btns
        document.querySelectorAll('.surface-btn[data-surf]').forEach(b => { b.onclick = () => { this.app.tools.surface.surfaceType = b.dataset.surf; this.updateProperties(); } });
        document.querySelectorAll('.surface-btn[data-bar]').forEach(b => { b.onclick = () => { this.app.tools.surface.barrierOn = b.dataset.bar === 'on'; this.updateProperties(); } });
        document.querySelectorAll('.surface-btn[data-pmode]').forEach(b => { b.onclick = () => { this.app.tools.surface.paintMode = b.dataset.pmode; this.updateProperties(); } });
        // Zone btns
        document.querySelectorAll('.zone-btn[data-zone]').forEach(b => {
            b.onclick = () => {
                const existing = this.app.data.zones.find(z => z.type === b.dataset.zone);
                if (existing) {
                    this.app.setSelection({ type: 'zone', id: existing.id });
                } else {
                    this.app.setSelection(null);
                }
                this.app.tools.zone.zoneType = b.dataset.zone;
                this.updateProperties();
            }
        });

        // Pit width
        const pitw = document.getElementById('prop-pitw');
        const pitwVal = document.getElementById('prop-pitw-val-input');
        if (pitw && pitwVal) {
            const updatePitWidth = (val) => {
                const w = Math.max(4, Math.min(20, parseFloat(val) || 12));
                this.app.data.pitLane.width = w;
                pitw.value = w;
                pitwVal.value = w;
                this.app.requestRender();
            };
            pitw.oninput = () => updatePitWidth(pitw.value);
            pitwVal.onchange = () => updatePitWidth(pitwVal.value);
        }
        const cp = document.getElementById('btn-clear-pit');
        if (cp) cp.onclick = () => { this.app.data.snapshot(); this.app.data.clearPitLane(); this.updateProperties(); this.app.requestRender(); };
        
        const showPitNodes = document.getElementById('prop-show-pit-nodes');
        if (showPitNodes) {
            showPitNodes.onchange = () => {
                this.app.data.showPitlaneNodes = showPitNodes.checked;
                this.app.requestRender();
            };
        }

        const btnAddG = document.getElementById('btn-add-garage');
        if (btnAddG) btnAddG.onclick = () => { this.app.setTool('garage'); };


        const btnRemG = document.getElementById('btn-remove-garage');
        if (btnRemG) btnRemG.onclick = () => { this.app.data.snapshot(); this.app.data.garage = null; this.app.setTool('pitlane'); this.app.requestRender(); this.updateProperties(); };

        const glen = document.getElementById('prop-garage-len');
        if (glen) glen.oninput = () => { if(this.app.data.garage) { this.app.data.garage.length = parseFloat(glen.value) || 250; this.app.requestRender(); }};
        const gwid = document.getElementById('prop-garage-wid');
        if (gwid) gwid.oninput = () => { if(this.app.data.garage) { this.app.data.garage.width = parseFloat(gwid.value) || 20; this.app.requestRender(); }};
        const grotRange = document.getElementById('prop-garage-rot-range');
        const grotNum = document.getElementById('prop-garage-rot-num');
        if (grotRange && grotNum) {
            const updateRot = (val) => {
                if(this.app.data.garage) {
                    let r = parseFloat(val) || 0;
                    this.app.data.garage.rotation = r;
                    grotRange.value = r;
                    grotNum.value = r;
                    this.app.requestRender();
                }
            };
            grotRange.oninput = () => updateRot(grotRange.value);
            grotNum.onchange = () => updateRot(grotNum.value);
        }

        const dz = document.getElementById('btn-del-zone');
        if (dz) dz.onclick = () => { if (this.app.selection && this.app.selection.type === 'zone') { this.app.data.snapshot(); this.app.data.removeZone(this.app.selection.id); this.app.setSelection(null); this.app.requestRender(); } };
        
        // Hot Lap Preview Controls
        const btnOpenHotlap = document.getElementById('btn-open-hotlap-modal');
        if (btnOpenHotlap) {
            btnOpenHotlap.onclick = () => {
                if (this.app && this.app.hotlapSimulator) {
                    this.app.hotlapSimulator.openModal();
                }
            };
        }

        // Layer checkboxes
        document.querySelectorAll('.layer-cb').forEach(cb => { cb.onchange = () => { this.app.preview.layers[cb.dataset.layer] = cb.checked; } });

        // Scale controls
        const cg = document.getElementById('cb-grid-on');
        if (cg) cg.onchange = () => { this.app.renderer.showGrid = cg.checked; this.app.requestRender(); };
        const gsz = document.getElementById('prop-grid-size'), gszv = document.getElementById('prop-grid-size-val');
        if (gsz && gszv) {
            gsz.onmousedown = () => { this.app.data.snapshot(); };
            gsz.oninput = () => { this.app.data.gridSize = parseInt(gsz.value); gszv.value = gsz.value; this.app.requestRender(); this.app._renderPreview(); this.updateStatusBar(); };
            gszv.onchange = () => { this.app.data.snapshot(); this.app.data.gridSize = parseInt(gszv.value); gsz.value = gszv.value; this.app.requestRender(); this.app._renderPreview(); this.updateStatusBar(); };
        }
        const gcol = document.getElementById('prop-grid-color');
        if (gcol) gcol.oninput = () => { this.app.renderer.gridColor = gcol.value; this.app.requestRender(); };
        const gop = document.getElementById('prop-grid-opacity'), gopv = document.getElementById('prop-grid-opacity-val');
        if (gop && gopv) {
            gop.oninput = () => { this.app.renderer.gridOpacity = parseInt(gop.value) / 100; gopv.value = gop.value; this.app.requestRender(); };
            gopv.onchange = () => {
                let v = parseInt(gopv.value);
                if (isNaN(v)) v = 0;
                v = Math.max(0, Math.min(100, v));
                this.app.renderer.gridOpacity = v / 100;
                gop.value = v; gopv.value = v;
                this.app.requestRender();
            };
        }

        // Ruler tool
        const btnToggleRuler = document.getElementById('btn-toggle-ruler');
        if (btnToggleRuler) {
            btnToggleRuler.onclick = () => {
                if (this.app.rulerMode) {
                    this.app.rulerMode = false;
                    this.app.rulers = [];
                    this.app.activeRuler = null;
                } else {
                    this.app.rulerMode = true;
                }
                this.updateProperties(); // Re-render button state
                this.app.requestRender();
            };
        }

        // Bulk erase actions
        const setupConfirmBtn = (id, defaultText, action) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            let confirming = false;
            let timeout = null;
            btn.onclick = () => {
                if (!confirming) {
                    confirming = true;
                    btn.textContent = 'Click again to confirm';
                    btn.style.backgroundColor = '#900000'; // Darker red
                    timeout = setTimeout(() => {
                        confirming = false;
                        btn.textContent = defaultText;
                        btn.style.backgroundColor = '';
                    }, 3000); // Reset after 3 seconds
                } else {
                    clearTimeout(timeout);
                    confirming = false;
                    btn.textContent = defaultText;
                    btn.style.backgroundColor = '';
                    this.app.data.snapshot();
                    action();
                    this.app.requestRender();
                    if (id === 'btn-clear-map') this.app._renderPreview();
                    this.updateProperties();
                }
            };
        };

        setupConfirmBtn('btn-clear-turns', 'Clear Turns', () => this.app.data.turnMarkers = []);
        setupConfirmBtn('btn-clear-sectors', 'Clear Sectors', () => this.app.data.controlPoints.forEach(p => p.sector = 0));
        setupConfirmBtn('btn-clear-barriers', 'Clear Barriers', () => this.app.data.controlPoints.forEach(p => { p.barrierLeft = false; p.barrierRight = false; }));
        setupConfirmBtn('btn-clear-zones', 'Clear Zones', () => this.app.data.zones = this.app.data.zones.filter(z => z.type === 'straight_mode'));
        setupConfirmBtn('btn-clear-smz', 'Clear Straight Modes', () => this.app.data.zones = this.app.data.zones.filter(z => z.type !== 'straight_mode'));
        setupConfirmBtn('btn-clear-pitlane', 'Clear Pit Lane', () => this.app.data.clearPitLane());

        setupConfirmBtn('btn-clear-map', 'Clear Map', () => {
            this.app.data.clear();
            document.getElementById('circuit-name').value = 'Untitled Circuit';
            this.app.data.name = 'Untitled Circuit';
            this.app.renderer.fitToScreen(this.app.data, this.app.editor);
        });
    }

    _helpProps() {
        return `
            <h3 class="prop-title">Help Guide</h3>
            <p class="prop-hint">Learn how to design the perfect circuit.</p>
            
            <div class="prop-group" style="margin-top:15px; border-top:1px solid #333; padding-top:15px;">
                <label>Example Circuits</label>
                <div style="font-size: 11px; color: #aaa; margin-bottom: 8px;">Load an example circuit to explore the app:</div>
                <button class="prop-btn example-map-btn" id="example-map-oval" style="width:100%; margin-bottom:4px; font-size:11px;">Example 1</button>
                <button class="prop-btn example-map-btn" id="example-map-technical" style="width:100%; margin-bottom:4px; font-size:11px;">Example 2</button>
            </div>

            <div class="prop-group help-guide" style="margin-top:15px; border-top:1px solid #333; padding-top:15px; max-height: 50vh; overflow-y: auto; padding-right: 5px;">
                <h4 style="color:#ddd; margin:0 0 10px 0; font-size:13px;">Circuit Design Guide</h4>
                
                <div style="font-size:11px; color:#aaa; line-height:1.6;">
                    <p style="color:#ddd; font-weight:600; margin:0 0 4px; font-size:12px;">Getting Started</p>
                    <p style="margin:0 0 4px;"><b>1. Draw Your Track</b><br>Select the Draw Tool (D) and click to place nodes.</p>
                    <p style="margin:0 0 4px;"><b>2. Complete the Circuit</b><br>Place at least 3 nodes, then click the first node again to close the track loop.</p>
                    <p style="margin:0 0 12px;"><b>3. Adjust Track Width</b><br>Use the Width Tool (W) to change the width of each section of track.</p>
                    
                    <p style="color:#ddd; font-weight:600; margin:0 0 4px; font-size:12px;">Design Tips:</p>
                    <ul style="padding-left:15px; margin:0 0 12px;">
                        <li>Keep sectors reasonably balanced.</li>
                        <li>Give each sector a unique character (Fast, Technical, Mixed).<br><i>Example: S1 → High Speed, S2 → Technical Corners, S3 → Overtaking Opportunities</i></li>
                    </ul>

                    <p style="color:#ddd; font-weight:600; margin:0 0 4px; font-size:12px;">F1 Zones</p>
                    <p style="margin:0 0 8px;">These zones simulate systems commonly used during a Formula 1 race.</p>
                    
                    <p style="color:#ddd; font-weight:bold; margin:0 0 4px;">Straight Mode Zone</p>
                    <p style="margin:0 0 8px;">Used on long straights.<br><b>Purpose:</b> Indicates where cars reach max speed. Ideal for DRS-like systems and overtaking.<br><b>Place On:</b> Long straights, sections after slow corners.</p>
                    
                    <p style="color:#ddd; font-weight:bold; margin:0 0 4px;">Overtake Detection Zone</p>
                    <p style="margin:0 0 8px;">The first part of a DRS system.<br><b>Purpose:</b> Measures the time gap between two cars to determine overtaking assistance eligibility. <i>Real F1 Example: If the following car is within 1 second, it becomes eligible for DRS.</i><br><b>Place Before:</b> Long straights, major overtaking zones.</p>

                    <p style="color:#ddd; font-weight:bold; margin:0 0 4px;">Overtake Activation Zone</p>
                    <p style="margin:0 0 8px;">Equivalent to a DRS activation line.<br><b>Purpose:</b> Allows the overtaking system to activate.<br><b>Place:</b> At the beginning of long straights, shortly after a corner exit.</p>

                    <p style="color:#ddd; font-weight:bold; margin:0 0 4px;">Speed Trap</p>
                    <p style="margin:0 0 12px;">A speed measurement point.<br><b>Purpose:</b> Records highest speed reached.<br><b>Place:</b> Just before a heavy braking zone at the end of a long straight.</p>

                    <p style="color:#ddd; font-weight:600; margin:0 0 4px; font-size:12px;">Good Circuit Design Practices</p>
                    <p style="margin:0 0 4px;"><b>Create Flow</b><br>Corners should connect naturally. (e.g. Fast Corner → Medium Corner → Heavy Braking Zone)</p>
                    <p style="margin:0 0 4px;"><b>Include Overtaking Opportunities</b><br>A good zone: Slow Corner → Long Straight → Heavy Braking Corner.</p>
                    <p style="margin:0 0 4px;"><b>Mix Corner Types</b><br>Use hairpins, sweepers, esses, chicanes, double apexes, high-speed bends.</p>
                    <p style="margin:0 0 4px;"><b>Vary the Track</b><br>Avoid all high speed or all low speed.</p>
                    <p style="margin:0 0 12px;"><b>Safety Considerations</b><br>Add run-off areas at high-speed corners and heavy braking zones. Use barriers on narrow sections.</p>

                    <p style="color:#ddd; font-weight:600; margin:0 0 4px; font-size:12px;">Recommended F1-Style Layout</p>
                    <ul style="padding-left:15px; margin:0 0 12px;">
                        <li><b>Length:</b> 4–7 km</li>
                        <li><b>Corners:</b> 10–20</li>
                        <li><b>Sectors:</b> 3</li>
                        <li><b>Straights:</b> 1–3</li>
                        <li><b>Overtaking:</b> 2–4</li>
                        <li><b>Speed Traps:</b> 1–2</li>
                        <li><b>Width:</b> 10–15 m</li>
                    </ul>

                    <p style="color:#fff; font-weight:bold; margin:0 0 12px;">Final Tip:</p>
                    <p style="margin:0;">Track design is part engineering and part creativity. Use the guidelines in this editor, but don't be afraid to try crazy ideas. Some of the most exciting circuits come from experimentation. Have fun and build the track of your dreams!</p>
                </div>
            </div>
        `;
    }

    updateStatusBar(wx, wy) {
        if (wx !== undefined) this.lastWx = wx;
        if (wy !== undefined) this.lastWy = wy;
        const lx = this.lastWx || 0, ly = this.lastWy || 0;
        document.getElementById('status-coords').textContent = `X: ${Math.round(lx)}  Y: ${Math.round(ly)}`;
        document.getElementById('status-zoom').textContent = `${Math.round(this.app.renderer.scale * 100)}%`;
        document.getElementById('status-tool').textContent = this._tn(this.app.activeToolName);
        const len = this.app.editor.getTrackLength() * ((this.app.data.gridSize || 50) / 50.0);
        const nodes = this.app.data.controlPoints.length;
        const turns = this.app.data.turnMarkers.length;
        const scaleStr = `Scale: 1 Grid = ${this.app.data.gridSize || 50}m`;
        document.getElementById('status-info').textContent = len > 0 ? `Track: ${(len / 1000).toFixed(3)} km · ${nodes} nodes · ${turns} turns · ${scaleStr}` : scaleStr;
    }

    _tn(n) { return { select: 'Select', draw: 'Draw Track', node: 'Node', width: 'Width', surface: 'Surface', barrier: 'Barrier', sector: 'Sectors', turn: 'Turns', pitlane: 'Pit Lane', zone: 'Zones', straightMode: 'Straight Mode', eraser: 'Eraser', scale: 'Scale', help: 'Help' }[n] || n; }
};

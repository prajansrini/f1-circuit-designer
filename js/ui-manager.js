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
            node: () => this._nodeProps(sel), width: () => this._widthProps(sel), surface: () => this._surfaceProps(),
            barrier: () => this._barrierProps(), sector: () => this._sectorProps(),
            turn: () => this._turnProps(sel),
            pitlane: () => this._pitLaneProps(), grandstand: () => this._grandstandProps(),
            zone: () => this._zoneProps(sel), garage: () => this._garageProps(sel),
            straightMode: () => this._straightModeProps(sel),
            eraser: () => this._eraserProps(), scale: () => this._scaleProps()
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
        h += `<div class="prop-group"><label>Track Width</label>
            <div class="prop-row"><span class="prop-label" style="width:30px">L</span><input type="range" min="5" max="40" step="0.5" value="${pt.widthLeft}" id="prop-wl" class="prop-slider"><input type="number" id="prop-wl-val" value="${pt.widthLeft}" step="0.5" class="prop-input" style="width:60px;padding:2px 4px;font-size:11px;"></div>
            <div class="prop-row"><span class="prop-label" style="width:30px">R</span><input type="range" min="5" max="40" step="0.5" value="${pt.widthRight}" id="prop-wr" class="prop-slider"><input type="number" id="prop-wr-val" value="${pt.widthRight}" step="0.5" class="prop-input" style="width:60px;padding:2px 4px;font-size:11px;"></div>
            <div class="prop-row"><span class="prop-label" style="width:30px">B</span><input type="range" min="-20" max="20" step="0.5" value="0" id="prop-wb" class="prop-slider"><input type="number" id="prop-wb-val" value="0" step="0.5" class="prop-input" style="width:60px;padding:2px 4px;font-size:11px;"></div></div>`;
        h += `<div class="prop-group"><label>Surface Width (Run-off)</label>
            <div class="prop-row"><span class="prop-label" style="width:30px">L</span><input type="range" min="0" max="50" step="0.5" value="${pt.surfaceWidthLeft}" id="prop-swl" class="prop-slider"><input type="number" id="prop-swl-val" value="${pt.surfaceWidthLeft}" step="0.5" class="prop-input" style="width:60px;padding:2px 4px;font-size:11px;"></div>
            <div class="prop-row"><span class="prop-label" style="width:30px">R</span><input type="range" min="0" max="50" step="0.5" value="${pt.surfaceWidthRight}" id="prop-swr" class="prop-slider"><input type="number" id="prop-swr-val" value="${pt.surfaceWidthRight}" step="0.5" class="prop-input" style="width:60px;padding:2px 4px;font-size:11px;"></div>
            <div class="prop-row"><span class="prop-label" style="width:30px">B</span><input type="range" min="-20" max="20" step="0.5" value="0" id="prop-swb" class="prop-slider"><input type="number" id="prop-swb-val" value="0" step="0.5" class="prop-input" style="width:60px;padding:2px 4px;font-size:11px;"></div></div>`;
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
                        <input type="checkbox" id="cb-show-nodes" ${this.app.renderer.showCtrlPts ? 'checked' : ''}>
                        <span style="margin-top: 2px; color: #aaa; font-size: 12px; font-weight: normal; letter-spacing: normal; text-transform: none;">Show Nodes</span>
                    </label>
                </div>
                <div class="prop-group" style="margin-top:15px; border-top:1px solid #333; padding-top:15px;"><label>Select a Node</label>
                    <select id="prop-node-selector" class="prop-input" style="width:100%; padding: 4px; background: #222; color: #eee; border: 1px solid #444; border-radius: 4px; font-size: 12px; cursor: pointer;">
                        <option value="">-- Choose a node --</option>
                        ${this.app.data.controlPoints.map((p, i) => `<option value="${p.id}" ${sel && sel.id === p.id ? 'selected' : ''}>Node ${i + 1}</option>`).join('')}
                    </select>
                </div>`;
        if (sel && sel.type === 'cp') {
            const pt = this.app.data.getPointById(sel.id);
            if (pt) h += this._cpProps(pt);
        }
        return h;
    }

    _selectProps(sel) {
        let h = '<h3 class="prop-title">Select & Move</h3><p class="prop-hint">Click & drag to move. <kbd>Del</kbd> to remove.</p>';
        if (sel && sel.type === 'cp') {
            const pt = this.app.data.getPointById(sel.id);
            if (pt) h += this._cpProps(pt);
        } else if (sel && sel.type === 'turn') {
            const tm = this.app.data.getTurnMarkerById(sel.id);
            if (tm) {
                h += `<div class="prop-group"><label>Turn Marker</label>
                    <div class="prop-group" style="margin-top:10px;"><label>Side</label><div class="side-btns">
                        <button class="side-btn ${tm.side === 'left' ? 'active' : ''}" id="btn-tm-left">Left</button>
                        <button class="side-btn ${tm.side !== 'left' ? 'active' : ''}" id="btn-tm-right">Right</button></div></div>
                    <div class="prop-row"><span class="prop-label" style="width:50px;text-align:left">Label</span><input type="text" class="prop-input" id="prop-tmlabel" value="${tm.label}" style="width:60px;flex:none"></div>
                    <div class="prop-row"><span class="prop-label" style="width:50px;text-align:left">Name</span><input type="text" class="prop-input" id="prop-tmname" value="${tm.name || ''}" placeholder="e.g. Eau Rouge" style="flex:1"></div>
                    <div class="prop-row"><span class="prop-label" style="width:50px;text-align:left">Rotate</span>
                        <input type="range" min="0" max="360" value="${Math.round(tm.rotation || 0)}" id="prop-tmr" class="prop-slider">
                        <span class="prop-val" id="prop-tmr-val">${Math.round(tm.rotation || 0)}°</span></div>
                    <button class="prop-btn danger" id="btn-del-turn" style="margin-top:10px">Delete Turn</button></div>`;
            }
        } else if (sel && sel.type === 'grandstand') {
            const gs = this.app.data.getGrandstandById(sel.id);
            if (gs) {
                h += `<div class="prop-group"><label>Grandstand</label>
                    <div class="prop-row"><span class="prop-label">W</span><input type="range" min="40" max="200" value="${gs.width}" id="prop-gsw" class="prop-slider"><span class="prop-val" id="prop-gsw-val">${gs.width}</span></div>
                    <div class="prop-row"><span class="prop-label">H</span><input type="range" min="10" max="60" value="${gs.height}" id="prop-gsh" class="prop-slider"><span class="prop-val" id="prop-gsh-val">${gs.height}</span></div>
                    <div class="prop-row"><span class="prop-label">°</span><input type="range" min="0" max="360" value="${Math.round(gs.rotation)}" id="prop-gsr" class="prop-slider"><span class="prop-val" id="prop-gsr-val">${Math.round(gs.rotation)}°</span></div></div>`;
            }
        } else if (sel && sel.type === 'garage') {
            const g = this.app.data.getGarageById(sel.id);
            if (g) {
                h += `<div class="prop-group"><label>Team Garage</label>
                    <div class="prop-row"><span class="prop-label" style="width:50px;text-align:left">Name</span><input type="text" class="prop-input" id="prop-gname" value="${g.teamName}" style="flex:1"></div>
                    <div class="prop-row"><span class="prop-label">W</span><input type="range" min="15" max="60" value="${g.width}" id="prop-gw" class="prop-slider"><span class="prop-val" id="prop-gw-val">${g.width}</span></div>
                    <div class="prop-row"><span class="prop-label">H</span><input type="range" min="8" max="40" value="${g.height}" id="prop-gh" class="prop-slider"><span class="prop-val" id="prop-gh-val">${g.height}</span></div>
                    <div class="prop-row"><span class="prop-label">°</span><input type="range" min="0" max="360" value="${Math.round(g.rotation || 0)}" id="prop-gr" class="prop-slider"><span class="prop-val" id="prop-gr-val">${Math.round(g.rotation || 0)}°</span></div>
                    <div class="prop-row"><span class="prop-label" style="width:50px;text-align:left">Color</span><input type="color" id="prop-gc" value="${g.color || '#e10600'}" style="width:40px;height:24px;border:none;cursor:pointer"></div></div>`;
            }
        } else if (sel && sel.type === 'zone') {
            const z = this.app.data.getZoneById(sel.id);
            if (z) {
                const zt = F1.ZONE_TYPES.find(t => t.key === z.type);
                h += `<p class="prop-hint" style="color:${zt ? zt.color : '#fff'}">${zt ? zt.label.replace('\\n', ' ') : 'Zone'}</p>`;
                if (zt && zt.range) {
                    if (z.type === 'straight_mode') {
                        h += `<div class="prop-group"><label>Side</label><div class="side-btns">
                            <button class="side-btn ${z.side === 'left' ? 'active' : ''}" id="btn-side-left">Left</button>
                            <button class="side-btn ${z.side !== 'left' ? 'active' : ''}" id="btn-side-right">Right</button></div></div>`;
                        h += `<div class="prop-group"><label>Strips</label>
                            <div class="prop-row"><span class="prop-label" style="width:50px;text-align:left">Size</span>
                                <input type="range" min="2" max="15" step="0.5" value="${z.stripWidth || 5}" id="prop-str-w" class="prop-slider">
                                <span class="prop-val" id="prop-str-w-val">${z.stripWidth || 5}</span></div>
                            <div class="prop-row"><span class="prop-label" style="width:50px;text-align:left">Gap</span>
                                <input type="range" min="1" max="8" value="${z.stripSpacing || 2}" id="prop-str-s" class="prop-slider">
                                <span class="prop-val" id="prop-str-s-val">${z.stripSpacing || 2}</span></div></div>`;
                    }
                }
                h += `<div class="prop-group"><label>Label Rotation</label>
                    <div class="prop-row"><span class="prop-label" style="width:50px;text-align:left">Rotate</span>
                        <input type="range" min="0" max="360" value="${Math.round(z.rotation || 0)}" id="prop-zr" class="prop-slider">
                        <span class="prop-val" id="prop-zr-val">${Math.round(z.rotation || 0)}°</span></div></div>`;
                h += `<button class="prop-btn danger" id="btn-del-zone">Delete Zone</button>`;
            }
        } else if (sel && sel.type === 'sector_label') {
            const sl = this.app.data.sectorLabels.find(s => s.sector === sel.sector);
            if (sl) {
                h += `<div class="prop-group"><label>Sector Label</label>
                    <p class="prop-hint success">Sector ${sel.sector}</p>
                    <div class="prop-row"><span class="prop-label" style="width:40px;text-align:left">Rotate</span>
                        <input type="range" min="0" max="360" value="${Math.round(sl.rotation || 0)}" id="prop-slr" class="prop-slider" style="width:100px; flex:none;">
                        <div style="flex:1"></div>
                        <input type="number" id="prop-slr-val" value="${Math.round(sl.rotation || 0)}" min="0" max="360" class="prop-input" style="width:45px;padding:2px 4px;font-size:11px;"></div></div>`;
            }
        }
        return h;
    }

    _straightModeProps(sel) {
        let h = '<h3 class="prop-title">Straight Mode Zone</h3><p class="prop-hint">Click near track to place start, then click again for end.</p>';
        if (sel && sel.type === 'zone') {
            const z = this.app.data.getZoneById(sel.id);
            if (z && z.type === 'straight_mode') {
                h += `<div class="prop-group"><label>Side</label><div class="side-btns">
                    <button class="side-btn ${z.side === 'left' ? 'active' : ''}" id="btn-side-left">Left</button>
                    <button class="side-btn ${z.side === 'right' ? 'active' : ''}" id="btn-side-right">Right</button></div></div>`;
                h += `<div class="prop-group"><label>Strip Settings</label>
                    <div class="prop-row"><span class="prop-label" style="width:30px">Width</span><input type="range" min="1" max="15" step="0.5" value="${z.stripWidth || 5}" id="prop-str-w" class="prop-slider"><span class="prop-val" id="prop-str-w-val">${z.stripWidth || 5}</span></div>
                    <div class="prop-row"><span class="prop-label" style="width:30px">Gap</span><input type="range" min="1" max="10" step="1" value="${z.stripSpacing || 2}" id="prop-str-s" class="prop-slider"><span class="prop-val" id="prop-str-s-val">${z.stripSpacing || 2}</span></div></div>`;
                h += `<div class="prop-group"><label>Label Rotation</label>
                    <div class="prop-row"><span class="prop-label" style="width:50px;text-align:left">Rotate</span>
                        <input type="range" min="0" max="360" value="${Math.round(z.rotation || 0)}" id="prop-zr" class="prop-slider" style="width:100px; flex:none;">
                        <div style="flex:1"></div>
                        <input type="number" id="prop-zr-val" value="${Math.round(z.rotation || 0)}" min="0" max="360" class="prop-input" style="width:45px;padding:2px 4px;font-size:11px;"></div></div>`;
                h += `<button class="prop-btn danger" id="btn-del-zone" style="margin-top:10px">Delete Zone</button>`;
            }
        }
        return h;
    }

    _drawProps() {
        let h = '<h3 class="prop-title">Draw Track</h3>';
        const n = this.app.data.controlPoints.length;
        if (this.app.data.isClosed) h += '<p class="prop-hint success">✓ Circuit closed</p>';
        else {
            h += `<p class="prop-hint">Click to place points. Count: <strong>${n}</strong></p>`;
            if (n >= 3) h += '<p class="prop-hint dim">Click near first point to close.</p>';
            else h += `<p class="prop-hint dim">Need ${3 - n} more to close.</p>`;
        }
        const len = this.app.editor.getTrackLength();
        if (len > 0) h += `<div class="prop-group"><label>Track Length</label><p class="prop-hint">${len.toFixed(0)}m · ${(len / 1000).toFixed(3)} km</p></div>`;
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

    _surfaceProps() {
        const t = this.app.tools.surface;
        let h = '<h3 class="prop-title">Run-off Painter</h3><p class="prop-hint">Click near track edges.</p>';
        h += `<div class="prop-group"><label>Type</label><div class="surface-btns">
            <button class="surface-btn ${t.surfaceType === 'grass' ? 'active' : ''}" data-surf="grass">🟢 Grass</button>
            <button class="surface-btn ${t.surfaceType === 'gravel' ? 'active' : ''}" data-surf="gravel">🟤 Gravel</button>
            <button class="surface-btn ${t.surfaceType === 'asphalt' ? 'active' : ''}" data-surf="asphalt">⬛ Asphalt</button>
            <button class="surface-btn ${t.surfaceType === 'none' ? 'active' : ''}" data-surf="none">✕ None</button></div></div>`;
        return h;
    }

    _barrierProps() {
        const t = this.app.tools.barrier;
        let h = '<h3 class="prop-title">Barriers</h3><p class="prop-hint">Click at surface edges. Barriers auto-adjust to surface width.</p>';
        h += `<div class="prop-group"><div class="surface-btns">
            <button class="surface-btn barrier ${t.barrierOn ? 'active' : ''}" data-bar="on">🔴 Place</button>
            <button class="surface-btn ${!t.barrierOn ? 'active' : ''}" data-bar="off">✕ Remove</button></div></div>`;
        return h;
    }

    _sectorProps(sel) {
        const t = this.app.tools.sector;
        let h = '<h3 class="prop-title">Sectors</h3><p class="prop-hint">Click control points. Flow: S1→S2→S3</p>';
        
        let details = [{nodes:0,turns:0,length:0}, {nodes:0,turns:0,length:0}, {nodes:0,turns:0,length:0}];
        let unassigned = 0;
        let secs = [];
        
        if (this.app.data.controlPoints.length >= 3) {
            secs = this.app.data.controlPoints.map(p => p.sector);
            unassigned = secs.filter(s => s === 0).length;
            
            const track = this.app.editor.getInterpolatedTrack();
            details = [1, 2, 3].map(s => {
                const nodes = this.app.data.controlPoints.filter(p => p.sector === s).length;
                let turns = 0, length = 0;
                for (let i = 0; i < track.length; i++) {
                    const p = track[i];
                    if (p.sector === s) {
                        const next = track[(i + 1) % track.length];
                        if (next && next.sector === s) length += Math.hypot(next.x - p.x, next.y - p.y);
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
            const d = details[sec-1];
            h += `<button class="sector-btn s${sec} ${t.currentSector === sec ? 'active' : ''}" data-sec="${sec}" style="width:100%; margin-bottom:5px;">Sector ${sec}</button>`;
            h += `<div style="display:flex; justify-content:space-between; font-size:11px; color:#aaa; margin-bottom:15px; padding:0 5px;">
                <span>Nodes: <strong style="color:#eee">${d.nodes}</strong></span>
                <span>Turns: <strong style="color:#eee">${d.turns}</strong></span>
                <span>Length: <strong style="color:#eee">${(d.length / 1000).toFixed(3)} km</strong></span>
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
            if (unassigned > 0) h += `<p class="prop-hint" style="color:#ff6600; margin-top:10px;">⚠ ${unassigned} nodes unassigned</p>`;
            else {
                let valid = true, last = secs[0];
                for (let i = 1; i < secs.length; i++) { if (secs[i] !== last) { if (secs[i] !== (last % 3) + 1) { valid = false; break; } last = secs[i]; } }
                h += valid ? '<p class="prop-hint success" style="margin-top:10px;">✓ Valid flow</p>' : '<p class="prop-hint" style="color:#ff6600; margin-top:10px;">⚠ Should flow S1→S2→S3</p>';
            }
        }
        return h;
    }

    _pitLaneProps() {
        const n = this.app.data.pitLane.points.length;
        let h = '<h3 class="prop-title">Pit Lane</h3><p class="prop-hint">Click to place path. FIA: min 12m width, with fast lane (outer) and slow lane (inner, crew side).</p>';
        h += `<p class="prop-hint dim">Points: <strong>${n}</strong></p>`;
        h += `<div class="prop-group"><label>Width</label>
            <div class="prop-row"><input type="range" min="4" max="20" step="0.5" value="${this.app.data.pitLane.width}" id="prop-pitw" class="prop-slider">
            <span class="prop-val" id="prop-pitw-val">${this.app.data.pitLane.width}m</span></div></div>`;
        h += '<p class="prop-hint dim">Pit entry/exit should not cross racing line. Speed limit: 80 km/h.</p>';
        h += '<button class="prop-btn danger" id="btn-clear-pit">Clear Pit Lane</button>';
        return h;
    }

    _grandstandProps() {
        let h = '<h3 class="prop-title">Grandstand</h3><p class="prop-hint">Click to place. Select tool to move/rotate.</p>';
        h += `<p class="prop-hint dim">Placed: <strong>${this.app.data.grandstands.length}</strong></p>`;
        return h;
    }

    _garageProps(sel) {
        let h = '<h3 class="prop-title">Team Garages</h3><p class="prop-hint">Click to place garages along pit lane. Each team gets one garage box.</p>';
        h += `<p class="prop-hint dim">Placed: <strong>${this.app.data.garages.length}</strong>/10</p>`;
        h += '<p class="prop-hint dim">Position based on constructor standings. Place along the slow lane side of the pit.</p>';
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
        if (t.zoneType === 'straight_mode') h += '<p class="prop-hint dim">Click start point, then click end point to define the zone.</p>';
        const zt = F1.ZONE_TYPES.find(z => z.key === t.zoneType);

        if (sel && sel.type === 'zone') {
            const z = this.app.data.getZoneById(sel.id);
            if (z) {
                const sZt = F1.ZONE_TYPES.find(t => t.key === z.type);
                h += `<div class="prop-group" style="margin-top: 15px; border-top: 1px solid #333; padding-top: 15px;"><label>Selected Zone</label>
                      <p class="prop-hint" style="color:${sZt ? sZt.color : '#fff'}">${sZt ? sZt.label.replace('\\n', ' ') : 'Zone'}</p>`;
                if (sZt && sZt.range) {
                    if (z.type === 'straight_mode') {
                        h += `<div class="prop-group"><label>Side</label><div class="side-btns">
                            <button class="side-btn ${z.side === 'left' ? 'active' : ''}" id="btn-side-left">Left</button>
                            <button class="side-btn ${z.side !== 'left' ? 'active' : ''}" id="btn-side-right">Right</button></div></div>`;
                        h += `<div class="prop-group"><label>Strips</label>
                            <div class="prop-row"><span class="prop-label" style="width:50px;text-align:left">Size</span>
                                <input type="range" min="2" max="15" step="0.5" value="${z.stripWidth || 5}" id="prop-str-w" class="prop-slider">
                                <span class="prop-val" id="prop-str-w-val">${z.stripWidth || 5}</span></div>
                            <div class="prop-row"><span class="prop-label" style="width:50px;text-align:left">Gap</span>
                                <input type="range" min="1" max="8" value="${z.stripSpacing || 2}" id="prop-str-s" class="prop-slider">
                                <span class="prop-val" id="prop-str-s-val">${z.stripSpacing || 2}</span></div></div>`;
                    }
                }
                h += `<div class="prop-group"><label>Label Offset</label>
                    <div class="prop-row" style="gap:10px;">
                        <span class="prop-label" style="width:10px">X</span><input type="number" id="prop-zx" value="${Math.round(z.labelOffsetX || 0)}" class="prop-input" style="flex:1;padding:2px 4px;font-size:11px;">
                        <span class="prop-label" style="width:10px">Y</span><input type="number" id="prop-zy" value="${Math.round(z.labelOffsetY || 0)}" class="prop-input" style="flex:1;padding:2px 4px;font-size:11px;">
                    </div></div>`;
                h += `<div class="prop-group"><label>Label Rotation</label>
                    <div class="prop-row"><span class="prop-label" style="width:50px;text-align:left">Rotate</span>
                        <input type="range" min="0" max="360" value="${Math.round(z.rotation || 0)}" id="prop-zr" class="prop-slider" style="width:100px; flex:none;">
                        <div style="flex:1"></div>
                        <input type="number" id="prop-zr-val" value="${Math.round(z.rotation || 0)}" min="0" max="360" class="prop-input" style="width:45px;padding:2px 4px;font-size:11px;"></div></div>`;
                h += `<button class="prop-btn danger" id="btn-del-zone">Delete Zone</button></div>`;
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
            if (tm) {
                h += `<div class="prop-group"><label>Turn Marker</label>
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
        }
        return h;
    }

    _eraserProps() { return '<h3 class="prop-title">Eraser</h3><p class="prop-hint">Click elements to remove.</p>'; }

    _scaleProps() {
        return `<h3 class="prop-title">Scale & Grid</h3>
                <p class="prop-hint">Configure the background grid scale and appearance.</p>
                <div class="prop-group" style="margin-top: 15px;">
                    <label class="chk-label prop-hint" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                        <input type="checkbox" id="cb-grid-on" ${this.app.renderer.showGrid ? 'checked' : ''}>
                        <span style="margin-top: 2px;">Show Grid</span>
                    </label>
                </div>
                <div class="prop-group"><label>Grid Scale</label>
                    <div class="prop-row">
                        <input type="range" min="10" max="200" step="10" value="${this.app.renderer.gridSize}" id="prop-grid-size" class="prop-slider">
                        <input type="number" id="prop-grid-size-val" value="${this.app.renderer.gridSize}" step="10" class="prop-input" style="width:50px;padding:2px 4px;font-size:11px;">
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


        // Sector btns
        document.querySelectorAll('.sector-btn[data-sec]').forEach(b => {
            b.onclick = () => {
                const s = parseInt(b.dataset.sec);
                if (this.app.activeToolName === 'sector') this.app.tools.sector.currentSector = s;
                else if (this.app.selection && this.app.selection.type === 'cp') { const pt = this.app.data.getPointById(this.app.selection.id); if (pt) { this.app.data.snapshot(); pt.sector = s; } }
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
                if (strW) strW.oninput = () => { z.stripWidth = parseFloat(strW.value); document.getElementById('prop-str-w-val').textContent = z.stripWidth; this.app.requestRender(); };
                const strS = document.getElementById('prop-str-s');
                if (strS) strS.oninput = () => { z.stripSpacing = parseInt(strS.value); document.getElementById('prop-str-s-val').textContent = z.stripSpacing; this.app.requestRender(); };
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
                
                const b = (sl, inp, key) => {
                    if (sl && inp) {
                        sl.oninput = () => { pt[key] = parseFloat(sl.value); inp.value = sl.value; this.app.requestRender(); };
                        inp.onchange = () => { pt[key] = parseFloat(inp.value); sl.value = inp.value; this.app.requestRender(); };
                    }
                };
                b(wl, wlv, 'widthLeft'); b(wr, wrv, 'widthRight'); b(swl, swlv, 'surfaceWidthLeft'); b(swr, swrv, 'surfaceWidthRight');
                
                const wb = document.getElementById('prop-wb'), wbv = document.getElementById('prop-wb-val');
                if (wb && wbv) {
                    let lastV = 0;
                    const applyDelta = (v) => {
                        const d = v - lastV; lastV = v;
                        pt.widthLeft = Math.max(1, pt.widthLeft + d); pt.widthRight = Math.max(1, pt.widthRight + d);
                        if (wl) wl.value = pt.widthLeft; if (wlv) wlv.value = pt.widthLeft;
                        if (wr) wr.value = pt.widthRight; if (wrv) wrv.value = pt.widthRight;
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
                        const d = v - lastV; lastV = v;
                        pt.surfaceWidthLeft = Math.max(0, pt.surfaceWidthLeft + d); pt.surfaceWidthRight = Math.max(0, pt.surfaceWidthRight + d);
                        if (swl) swl.value = pt.surfaceWidthLeft; if (swlv) swlv.value = pt.surfaceWidthLeft;
                        if (swr) swr.value = pt.surfaceWidthRight; if (swrv) swrv.value = pt.surfaceWidthRight;
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
        document.querySelectorAll('.surface-btn[data-bar]').forEach(b => { b.onclick = () => { this.app.tools.barrier.barrierOn = b.dataset.bar === 'on'; this.updateProperties(); } });
        // Zone btns
        document.querySelectorAll('.zone-btn[data-zone]').forEach(b => { b.onclick = () => { this.app.setSelection(null); this.app.tools.zone.zoneType = b.dataset.zone; this.updateProperties(); } });
        // Grandstand sliders
        const gsw = document.getElementById('prop-gsw'), gsh = document.getElementById('prop-gsh'), gsr = document.getElementById('prop-gsr');
        if (gsw && this.app.selection) {
            const gs = this.app.data.getGrandstandById(this.app.selection.id); if (gs) {
                gsw.oninput = () => { gs.width = parseInt(gsw.value); document.getElementById('prop-gsw-val').textContent = gs.width; this.app.requestRender(); };
                if (gsh) gsh.oninput = () => { gs.height = parseInt(gsh.value); document.getElementById('prop-gsh-val').textContent = gs.height; this.app.requestRender(); };
                if (gsr) gsr.oninput = () => { gs.rotation = parseInt(gsr.value); document.getElementById('prop-gsr-val').textContent = gs.rotation + '°'; this.app.requestRender(); };
            }
        }
        // Garage controls
        const gw = document.getElementById('prop-gw'), gh = document.getElementById('prop-gh'), gr = document.getElementById('prop-gr'), gc = document.getElementById('prop-gc'), gn = document.getElementById('prop-gname');
        if (gw && this.app.selection && this.app.selection.type === 'garage') {
            const g = this.app.data.getGarageById(this.app.selection.id); if (g) {
                gw.oninput = () => { g.width = parseInt(gw.value); document.getElementById('prop-gw-val').textContent = g.width; this.app.requestRender(); };
                gh.oninput = () => { g.height = parseInt(gh.value); document.getElementById('prop-gh-val').textContent = g.height; this.app.requestRender(); };
                gr.oninput = () => { g.rotation = parseInt(gr.value); document.getElementById('prop-gr-val').textContent = g.rotation + '°'; this.app.requestRender(); };
                if (gc) gc.oninput = () => { g.color = gc.value; this.app.requestRender(); };
                if (gn) gn.onchange = () => { g.teamName = gn.value; this.app.requestRender(); };
            }
        }
        // Pit width
        const pitw = document.getElementById('prop-pitw');
        if (pitw) pitw.oninput = () => { this.app.data.pitLane.width = parseFloat(pitw.value); document.getElementById('prop-pitw-val').textContent = pitw.value + 'm'; this.app.requestRender(); };
        const cp = document.getElementById('btn-clear-pit');
        if (cp) cp.onclick = () => { this.app.data.snapshot(); this.app.data.clearPitLane(); this.updateProperties(); this.app.requestRender(); };
        const dz = document.getElementById('btn-del-zone');
        if (dz) dz.onclick = () => { if (this.app.selection && this.app.selection.type === 'zone') { this.app.data.snapshot(); this.app.data.removeZone(this.app.selection.id); this.app.setSelection(null); this.app.requestRender(); } };
        // Layer checkboxes
        document.querySelectorAll('.layer-cb').forEach(cb => { cb.onchange = () => { this.app.preview.layers[cb.dataset.layer] = cb.checked; } });

        // Scale controls
        const cg = document.getElementById('cb-grid-on');
        if (cg) cg.onchange = () => { this.app.renderer.showGrid = cg.checked; this.app.requestRender(); };
        const gsz = document.getElementById('prop-grid-size'), gszv = document.getElementById('prop-grid-size-val');
        if (gsz && gszv) {
            gsz.oninput = () => { this.app.renderer.gridSize = parseInt(gsz.value); gszv.value = gsz.value; this.app.requestRender(); this.updateStatusBar(); };
            gszv.onchange = () => { this.app.renderer.gridSize = parseInt(gszv.value); gsz.value = gszv.value; this.app.requestRender(); this.updateStatusBar(); };
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
    }

    updateStatusBar(wx, wy) {
        if (wx !== undefined) this.lastWx = wx;
        if (wy !== undefined) this.lastWy = wy;
        const lx = this.lastWx || 0, ly = this.lastWy || 0;
        document.getElementById('status-coords').textContent = `X: ${Math.round(lx)}  Y: ${Math.round(ly)}`;
        document.getElementById('status-zoom').textContent = `${Math.round(this.app.renderer.scale * 100)}%`;
        document.getElementById('status-tool').textContent = this._tn(this.app.activeToolName);
        const len = this.app.editor.getTrackLength();
        const nodes = this.app.data.controlPoints.length;
        const turns = this.app.data.turnMarkers.length;
        const scaleStr = `Scale: 1 Grid = ${this.app.renderer.gridSize}m`;
        document.getElementById('status-info').textContent = len > 0 ? `Track: ${(len / 1000).toFixed(3)} km · ${nodes} nodes · ${turns} turns · ${scaleStr}` : scaleStr;
    }

    _tn(n) { return { select: 'Select', draw: 'Draw Track', node: 'Node', width: 'Width', surface: 'Surface', barrier: 'Barrier', sector: 'Sectors', turn: 'Turns', pitlane: 'Pit Lane', grandstand: 'Grandstand', zone: 'Zones', straightMode: 'Straight Mode', garage: 'Garages', eraser: 'Eraser', scale: 'Scale' }[n] || n; }
};

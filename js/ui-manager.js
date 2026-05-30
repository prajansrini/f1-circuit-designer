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
            width: () => this._widthProps(sel), surface: () => this._surfaceProps(),
            barrier: () => this._barrierProps(), sector: () => this._sectorProps(),
            turn: () => this._turnProps(),
            pitlane: () => this._pitLaneProps(), grandstand: () => this._grandstandProps(),
            zone: () => this._zoneProps(sel), garage: () => this._garageProps(sel),
            eraser: () => this._eraserProps()
        };
        this.panelContent.innerHTML = (map[tool] || (() => '<p class="prop-hint">Select a tool</p>'))();
        this._bindEvents();
    }

    _selectProps(sel) {
        let h = '<h3 class="prop-title">Select & Move</h3><p class="prop-hint">Click & drag to move. <kbd>Del</kbd> to remove.</p>';
        if (sel && sel.type === 'cp') {
            const pt = this.app.data.getPointById(sel.id);
            if (pt) {
                h += `<div class="prop-group"><label>Track Width</label>
                    <div class="prop-row"><span class="prop-label">L</span><input type="range" min="5" max="40" step="0.5" value="${pt.widthLeft}" id="prop-wl" class="prop-slider"><span class="prop-val" id="prop-wl-val">${pt.widthLeft.toFixed(1)}m</span></div>
                    <div class="prop-row"><span class="prop-label">R</span><input type="range" min="5" max="40" step="0.5" value="${pt.widthRight}" id="prop-wr" class="prop-slider"><span class="prop-val" id="prop-wr-val">${pt.widthRight.toFixed(1)}m</span></div></div>`;
                h += `<div class="prop-group"><label>Surface Width (Run-off)</label>
                    <div class="prop-row"><span class="prop-label">L</span><input type="range" min="0" max="50" step="1" value="${pt.surfaceWidthLeft}" id="prop-swl" class="prop-slider"><span class="prop-val" id="prop-swl-val">${pt.surfaceWidthLeft}m</span></div>
                    <div class="prop-row"><span class="prop-label">R</span><input type="range" min="0" max="50" step="1" value="${pt.surfaceWidthRight}" id="prop-swr" class="prop-slider"><span class="prop-val" id="prop-swr-val">${pt.surfaceWidthRight}m</span></div></div>`;
                h += `<div class="prop-group"><label>Sector</label><div class="sector-btns">
                    <button class="sector-btn s1 ${pt.sector === 1 ? 'active' : ''}" data-sec="1">S1</button>
                    <button class="sector-btn s2 ${pt.sector === 2 ? 'active' : ''}" data-sec="2">S2</button>
                    <button class="sector-btn s3 ${pt.sector === 3 ? 'active' : ''}" data-sec="3">S3</button></div></div>`;
            }
        } else if (sel && sel.type === 'turn') {
            const tm = this.app.data.getTurnMarkerById(sel.id);
            if (tm) {
                h += `<div class="prop-group"><label>Turn Marker</label>
                    <div class="prop-group" style="margin-top:10px;"><label>Side</label><div class="side-btns">
                        <button class="side-btn ${tm.side === 'left' ? 'active' : ''}" id="btn-tm-left">Left</button>
                        <button class="side-btn ${tm.side !== 'left' ? 'active' : ''}" id="btn-tm-right">Right</button></div></div>
                    <p class="prop-hint dim">Drag <span style="color:#00ff88">green handle</span> to rotate</p>
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
                    <p class="prop-hint dim">Drag <span style="color:#00ff88">green handle</span> to rotate</p>
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
                h += `<p class="prop-hint dim">Drag <span style="color:#00ff88">green handle</span> to rotate label</p>`;
                if (zt && zt.range) {
                    h += `<p class="prop-hint dim">Drag handles on track to adjust range.</p>`;
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
                    <p class="prop-hint dim">Drag <span style="color:#00ff88">green handle</span> to rotate</p>
                    <div class="prop-row"><span class="prop-label" style="width:50px;text-align:left">Rotate</span>
                        <input type="range" min="0" max="360" value="${Math.round(sl.rotation || 0)}" id="prop-slr" class="prop-slider">
                        <span class="prop-val" id="prop-slr-val">${Math.round(sl.rotation || 0)}°</span></div></div>`;
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
            if (n >= 3) h += '<p class="prop-hint accent">Click near first point to close.</p>';
            else h += `<p class="prop-hint dim">Need ${3 - n} more to close.</p>`;
        }
        const len = this.app.editor.getTrackLength();
        if (len > 0) h += `<div class="prop-group"><label>Track Length</label><p class="prop-hint">${len.toFixed(0)}m · ${(len / 1000).toFixed(2)} km</p></div>`;
        return h;
    }

    _widthProps(sel) {
        const t = this.app.tools.width;
        let h = '<h3 class="prop-title">Width Brush</h3><p class="prop-hint">Drag up/down on control points.</p>';
        h += `<div class="prop-group"><label>Adjust</label><div class="side-btns">
            <button class="side-btn ${t.mode === 'track' ? 'active' : ''}" data-wmode="track">Track</button>
            <button class="side-btn ${t.mode === 'surface' ? 'active' : ''}" data-wmode="surface">Surface</button></div></div>`;
        h += `<div class="prop-group"><label>Side</label><div class="side-btns">
            <button class="side-btn ${t.side === 'both' ? 'active' : ''}" data-side="both">Both</button>
            <button class="side-btn ${t.side === 'left' ? 'active' : ''}" data-side="left">Left</button>
            <button class="side-btn ${t.side === 'right' ? 'active' : ''}" data-side="right">Right</button></div></div>`;
        if (sel && sel.type === 'cp') {
            const pt = this.app.data.getPointById(sel.id);
            if (pt) h += `<div class="prop-group"><label>Current</label><p class="prop-hint">Track: L ${pt.widthLeft.toFixed(1)}m · R ${pt.widthRight.toFixed(1)}m</p><p class="prop-hint">Surface: L ${pt.surfaceWidthLeft}m · R ${pt.surfaceWidthRight}m</p></div>`;
        }
        return h;
    }

    _surfaceProps() {
        const t = this.app.tools.surface;
        let h = '<h3 class="prop-title">Surface Painter</h3><p class="prop-hint">Click near track edges.</p>';
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

    _sectorProps() {
        const t = this.app.tools.sector;
        let h = '<h3 class="prop-title">Sectors</h3><p class="prop-hint">Click control points. Flow: S1→S2→S3</p>';
        h += `<div class="prop-group"><label>Active</label><div class="sector-btns">
            <button class="sector-btn s1 ${t.currentSector === 1 ? 'active' : ''}" data-sec="1">S1</button>
            <button class="sector-btn s2 ${t.currentSector === 2 ? 'active' : ''}" data-sec="2">S2</button>
            <button class="sector-btn s3 ${t.currentSector === 3 ? 'active' : ''}" data-sec="3">S3</button></div></div>`;
        if (this.app.data.controlPoints.length >= 3) {
            const secs = this.app.data.controlPoints.map(p => p.sector);
            const unassigned = secs.filter(s => s === 0).length;
            if (unassigned > 0) h += `<p class="prop-hint" style="color:#ff6600">⚠ ${unassigned} turns unassigned</p>`;
            else {
                let valid = true, last = secs[0];
                for (let i = 1; i < secs.length; i++) { if (secs[i] !== last) { if (secs[i] !== (last % 3) + 1) { valid = false; break; } last = secs[i]; } }
                h += valid ? '<p class="prop-hint success">✓ Valid flow</p>' : '<p class="prop-hint" style="color:#ff6600">⚠ Should flow S1→S2→S3</p>';
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
            h += `<button class="zone-btn ${t.zoneType === zt.key ? 'active' : ''}" data-zone="${zt.key}" style="--zone-c:${zt.color};--zone-bg:${zt.bg}">${zt.label.replace('\\n', ' ')}${zt.range ? ' ↔' : ''}</button>`;
        });
        h += '</div></div>';
        if (t.zoneType === 'straight_mode') h += '<p class="prop-hint dim">Click start point, then click end point to define the zone.</p>';
        const zt = F1.ZONE_TYPES.find(z => z.key === t.zoneType);
        if (zt && !zt.multi) h += '<p class="prop-hint dim">Only one allowed — placing a new one replaces the old.</p>';
        return h;
    }

    _turnProps() {
        return '<h3 class="prop-title">Turn Placer</h3><p class="prop-hint">Click on the track to manually place Turn Markers (e.g. Turn 1, Turn 2). Select a turn marker in Select mode to rename it or drag it along the track.</p>';
    }

    _eraserProps() { return '<h3 class="prop-title">Eraser</h3><p class="prop-hint">Click elements to remove.</p>'; }

    _bindEvents() {
        // Show Nodes
        const cbNodes = document.getElementById('cb-show-nodes');
        if (cbNodes) {
            cbNodes.onchange = () => {
                this.app.renderer.showCtrlPts = cbNodes.checked;
                this.app.requestRender();
            };
        }

        // Track width sliders
        const wl = document.getElementById('prop-wl'), wr = document.getElementById('prop-wr');
        if (wl) { wl.oninput = () => { const pt = this.app.data.getPointById(this.app.selection.id); if (pt) { pt.widthLeft = parseFloat(wl.value); document.getElementById('prop-wl-val').textContent = pt.widthLeft.toFixed(1) + 'm'; this.app.requestRender(); } } }
        if (wr) { wr.oninput = () => { const pt = this.app.data.getPointById(this.app.selection.id); if (pt) { pt.widthRight = parseFloat(wr.value); document.getElementById('prop-wr-val').textContent = pt.widthRight.toFixed(1) + 'm'; this.app.requestRender(); } } }
        // Surface width sliders
        const swl = document.getElementById('prop-swl'), swr = document.getElementById('prop-swr');
        if (swl) { swl.oninput = () => { const pt = this.app.data.getPointById(this.app.selection.id); if (pt) { pt.surfaceWidthLeft = parseInt(swl.value); document.getElementById('prop-swl-val').textContent = pt.surfaceWidthLeft + 'm'; this.app.requestRender(); } } }
        if (swr) { swr.oninput = () => { const pt = this.app.data.getPointById(this.app.selection.id); if (pt) { pt.surfaceWidthRight = parseInt(swr.value); document.getElementById('prop-swr-val').textContent = pt.surfaceWidthRight + 'm'; this.app.requestRender(); } } }
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
                if (zr) zr.oninput = () => { z.rotation = parseInt(zr.value); document.getElementById('prop-zr-val').textContent = z.rotation + '°'; this.app.requestRender(); };
            }
        }
        // Turn marker rotation
        const tmr = document.getElementById('prop-tmr');
        if (tmr && this.app.selection && this.app.selection.type === 'turn') {
            const tm = this.app.data.getTurnMarkerById(this.app.selection.id);
            if (tm) tmr.oninput = () => { tm.rotation = parseInt(tmr.value); document.getElementById('prop-tmr-val').textContent = tm.rotation + '°'; this.app.requestRender(); };
        }
        // Sector label rotation
        const slr = document.getElementById('prop-slr');
        if (slr && this.app.selection && this.app.selection.type === 'sector_label') {
            const sl = this.app.data.sectorLabels.find(s => s.sector === this.app.selection.sector);
            if (sl) slr.oninput = () => { sl.rotation = parseInt(slr.value); document.getElementById('prop-slr-val').textContent = sl.rotation + '°'; this.app.requestRender(); };
        }

        // Side/mode btns
        document.querySelectorAll('.side-btn[data-side]').forEach(b => { b.onclick = () => { this.app.tools.width.setSide(b.dataset.side); this.updateProperties(); } });
        document.querySelectorAll('.side-btn[data-wmode]').forEach(b => { b.onclick = () => { this.app.tools.width.setMode(b.dataset.wmode); this.updateProperties(); } });
        // Surface btns
        document.querySelectorAll('.surface-btn[data-surf]').forEach(b => { b.onclick = () => { this.app.tools.surface.surfaceType = b.dataset.surf; this.updateProperties(); } });
        document.querySelectorAll('.surface-btn[data-bar]').forEach(b => { b.onclick = () => { this.app.tools.barrier.barrierOn = b.dataset.bar === 'on'; this.updateProperties(); } });
        // Zone btns
        document.querySelectorAll('.zone-btn[data-zone]').forEach(b => { b.onclick = () => { this.app.tools.zone.zoneType = b.dataset.zone; this.updateProperties(); } });
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
    }

    updateStatusBar(wx, wy) {
        document.getElementById('status-coords').textContent = `X: ${Math.round(wx)}  Y: ${Math.round(wy)}`;
        document.getElementById('status-zoom').textContent = `${Math.round(this.app.renderer.scale * 100)}%`;
        document.getElementById('status-tool').textContent = this._tn(this.app.activeToolName);
        const len = this.app.editor.getTrackLength();
        document.getElementById('status-info').textContent = len > 0 ? `Track: ${(len / 1000).toFixed(2)} km · ${this.app.data.controlPoints.length} turns` : 'Ready';
    }

    _tn(n) { return { select: 'Select', draw: 'Draw Track', width: 'Width', surface: 'Surface', barrier: 'Barrier', sector: 'Sectors', turn: 'Turns', pitlane: 'Pit Lane', grandstand: 'Grandstand', zone: 'Zones', garage: 'Garages', eraser: 'Eraser' }[n] || n; }
};

/* ============================================================
   app.js — Main Application (Split View: Editor + Preview)
   ============================================================ */
window.F1 = window.F1 || {};

F1.App = class App {
    constructor() {
        this.data = new F1.CircuitData();
        this.editor = new F1.TrackEditor(this.data);
        this.canvas = document.getElementById('main-canvas');
        this.renderer = new F1.Renderer(this.canvas);
        this.previewCanvas = document.getElementById('preview-canvas');
        this.preview = new F1.PreviewRenderer(this.previewCanvas);
        this.uiManager = new F1.UIManager(this);

        this.tools = {
            select: new F1.Tools.SelectTool(this),
            draw: new F1.Tools.DrawTrackTool(this),
            node: new F1.Tools.NodeTool(this),
            width: new F1.Tools.WidthTool(this),
            surface: new F1.Tools.SurfacePainterTool(this),
            sector: new F1.Tools.SectorTool(this),
            turn: new F1.Tools.TurnTool(this),
            pitlane: new F1.Tools.PitLaneTool(this),
            grandstand: new F1.Tools.GrandstandTool(this),
            zone: new F1.Tools.ZoneTool(this),
            straightMode: new F1.Tools.StraightModeTool(this),
            garage: new F1.Tools.GarageTool(this),
            eraser: new F1.Tools.EraserTool(this),
            scale: new F1.Tools.ScaleTool(this),
            help: new F1.Tools.BaseTool(this)
        };

        this.activeToolName = 'draw';
        this.activeTool = this.tools.draw;
        this.selection = null;
        this.hoverPoint = null;
        this._needsRender = true;
        this._isPanning = false;
        this._panStart = null;
        this.rulerMode = false;
        this.rulers = [];
        this.activeRuler = null;
        this.intersections = [];

        this._initEvents();
        this._initToolbar();
        this._initTopBar();
        this._initGenerateBtn();
        this._initHelp();
        this.setTool('draw');
        this._renderLoop();
        setTimeout(() => this._renderPreview(), 100);
    }

    setTool(name) {
        if (this.activeTool) this.activeTool.deactivate();
        this.activeToolName = name;
        this.activeTool = this.tools[name];
        this.activeTool.activate();
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === name));
        
        if (name !== 'scale' && this.rulerMode) {
            this.rulerMode = false;
            this.activeRuler = null;
            this.rulers = [];
        }
        
        this.canvas.style.cursor = this.activeTool.getCursor();
        this.uiManager.updateProperties();
        this.requestRender();
    }

    setSelection(sel) { this.selection = sel; this.uiManager.updateProperties(); this.requestRender(); }
    setStatus(msg) { document.getElementById('status-info').textContent = msg; }
    requestRender() { this._needsRender = true; }

    _updateIntersections() {
        const track = this.editor.getInterpolatedTrack();
        const intersections = [];
        
        function intersect(p1, p2, p3, p4) {
            if (Math.min(p1.x, p2.x) > Math.max(p3.x, p4.x) || Math.max(p1.x, p2.x) < Math.min(p3.x, p4.x) ||
                Math.min(p1.y, p2.y) > Math.max(p3.y, p4.y) || Math.max(p1.y, p2.y) < Math.min(p3.y, p4.y)) return false;
            const ccw = (A, B, C) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
            return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
        }

        const skip = 10;
        
        for (let i = 0; i < track.length - 1; i++) {
            for (let j = i + skip; j < track.length - 1; j++) {
                if (this.data.isClosed) {
                    const dist = Math.min(j - i, track.length - (j - i));
                    if (dist < skip) continue;
                }
                
                if (intersect(track[i], track[i+1], track[j], track[j+1])) {
                    const cx = (track[i].x + track[i+1].x + track[j].x + track[j+1].x) / 4;
                    const cy = (track[i].y + track[i+1].y + track[j].y + track[j+1].y) / 4;
                    const isDuplicate = intersections.some(ix => Math.hypot(ix.x - cx, ix.y - cy) < 50);
                    if (!isDuplicate) {
                        intersections.push({
                            id: intersections.length + 1,
                            cpA: Math.min(track[i].segIndex, track[j].segIndex),
                            cpB: Math.max(track[i].segIndex, track[j].segIndex),
                            trackIdxA: i, trackIdxB: j,
                            x: cx, y: cy
                        });
                    }
                }
            }
        }
        const counts = {};
        intersections.forEach(ix => {
            const baseKey = `${ix.cpA}-${ix.cpB}`;
            counts[baseKey] = (counts[baseKey] || 0) + 1;
            ix.key = `${baseKey}-${counts[baseKey] - 1}`;
        });
        
        this.intersections = intersections;
    }

    _renderLoop() {
        if (this._needsRender) { 
            if (['draw', 'node'].includes(this.activeToolName)) this._updateIntersections();
            this.renderer.render(this.data, this.editor, this.selection, this.hoverPoint, this.activeToolName); 
            this._needsRender = false; 
        }
        requestAnimationFrame(() => this._renderLoop());
    }

    _renderPreview() { this.preview.resize(); this.preview.render(this.data, this.editor); }

    _initEvents() {
        const canvas = this.canvas;
        let isSpaceDown = false;
        let hoveredCanvas = 'editor';
        canvas.addEventListener('mouseenter', () => hoveredCanvas = 'editor');
        this.previewCanvas.addEventListener('mouseenter', () => hoveredCanvas = 'preview');

        document.addEventListener('keydown', e => {
            if (e.code === 'Space' && (!document.activeElement || (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA'))) { isSpaceDown = true; e.preventDefault(); }
        });
        document.addEventListener('keyup', e => { if (e.code === 'Space') isSpaceDown = false; });

        canvas.addEventListener('mousedown', e => {
            if (e.button === 1 || (e.button === 0 && (e.detail === 2 || isSpaceDown))) { this._isPanning = true; this._panStart = { x: e.clientX, y: e.clientY }; canvas.style.cursor = 'grabbing'; e.preventDefault(); return; }
            if (e.button === 0) {
                const r = canvas.getBoundingClientRect(); const w = this.renderer.s2w(e.clientX - r.left, e.clientY - r.top);
                this.activeTool.onMouseDown(w.x, w.y, e);
                if (this.activeTool.constructor.name === 'SelectTool' && !this.activeTool.dragging && !this.activeTool.rotatingObj && !this.selection) {
                    this._isPanning = true; this._panStart = { x: e.clientX, y: e.clientY }; canvas.style.cursor = 'grabbing';
                }
            }
        });
        canvas.addEventListener('mousemove', e => {
            const r = canvas.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top;
            if (this._isPanning) { this.renderer.pan(e.clientX - this._panStart.x, e.clientY - this._panStart.y); this._panStart = { x: e.clientX, y: e.clientY }; this.requestRender(); return; }
            const w = this.renderer.s2w(sx, sy); this.activeTool.onMouseMove(w.x, w.y, e); this.uiManager.updateStatusBar(w.x, w.y);
        });
        canvas.addEventListener('mouseup', e => {
            if (this._isPanning) { this._isPanning = false; canvas.style.cursor = this.activeTool.getCursor(); return; }
            const r = canvas.getBoundingClientRect(); const w = this.renderer.s2w(e.clientX - r.left, e.clientY - r.top); this.activeTool.onMouseUp(w.x, w.y, e);
        });
        canvas.addEventListener('wheel', e => { e.preventDefault(); const r = canvas.getBoundingClientRect(); this.renderer.zoom(e.deltaY, e.clientX - r.left, e.clientY - r.top); this.requestRender(); this.uiManager.updateStatusBar(); }, { passive: false });
        canvas.addEventListener('contextmenu', e => e.preventDefault());

        const pCanvas = this.previewCanvas;
        let isPreviewPanning = false, previewPanStart = null;
        pCanvas.addEventListener('mousedown', e => {
            if (e.button === 0 || e.button === 1 || isSpaceDown) { isPreviewPanning = true; previewPanStart = { x: e.clientX, y: e.clientY }; pCanvas.style.cursor = 'grabbing'; e.preventDefault(); return; }
        });
        pCanvas.addEventListener('mousemove', e => {
            if (isPreviewPanning) { this.preview.pan(e.clientX - previewPanStart.x, e.clientY - previewPanStart.y); previewPanStart = { x: e.clientX, y: e.clientY }; this._renderPreview(); return; }
        });
        pCanvas.addEventListener('mouseup', () => { isPreviewPanning = false; pCanvas.style.cursor = 'default'; });
        pCanvas.addEventListener('mouseleave', () => { isPreviewPanning = false; pCanvas.style.cursor = 'default'; });
        pCanvas.addEventListener('wheel', e => { e.preventDefault(); const r = pCanvas.getBoundingClientRect(); this.preview.zoom(e.deltaY, e.clientX - r.left, e.clientY - r.top); this._renderPreview(); }, { passive: false });
        pCanvas.addEventListener('contextmenu', e => e.preventDefault());

        window.addEventListener('beforeunload', (e) => {
            if (this.data.controlPoints && this.data.controlPoints.length > 0) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        window.addEventListener('resize', () => { this.renderer.resize(); this.preview.resize(); this.requestRender(); this._renderPreview(); });
        document.addEventListener('keydown', e => {
            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
            if (e.key === 'Escape') { this.setTool('select'); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); this._renderPreview(); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                const cn = document.getElementById('circuit-name');
                if (cn) { cn.focus(); cn.select(); }
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.data.undo(); this.requestRender(); this.uiManager.updateProperties(); return; }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); this.data.redo(); this.requestRender(); this.uiManager.updateProperties(); return; }
            const sc = { s: 'select', p: 'pitlane', d: 'draw', r: 'surface', g: 'garage', l: 'grandstand', n: 'node', w: 'width', b: 'barrier', '1': 'sector', z: 'zone', m: 'straightMode', e: 'eraser', t: 'turn', '#': 'scale', '3': 'scale' };
            if (!e.ctrlKey && !e.metaKey && sc[e.key.toLowerCase()]) { this.setTool(sc[e.key.toLowerCase()]); return; }
            if (e.key.toLowerCase() === 'f') {
                if (hoveredCanvas === 'editor') {
                    this.renderer.fitToScreen(this.data, this.editor);
                    this.requestRender();
                } else {
                    this.preview.fitToScreen(this.data, this.editor);
                    this._renderPreview();
                }
                return;
            }
            this.activeTool.onKeyDown(e);
        });
    }

    _initToolbar() {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => { btn.addEventListener('click', () => this.setTool(btn.dataset.tool)); });

        // Color picker wiring: circle opens native picker, hex input allows direct entry, native picker syncs back
        const wireColor = (id, applyFn) => {
            const picker = document.getElementById(id);
            const hex = document.getElementById(id + '-hex');
            const circle = document.querySelector(`.color-circle[data-for="${id}"]`);
            if (!picker) return;
            // Circle click opens native color picker
            if (circle) circle.addEventListener('click', () => picker.click());
            // Native picker change syncs to hex + circle + applies
            const sync = (color) => {
                if (hex) hex.value = color.toUpperCase();
                if (circle) circle.style.background = color;
                picker.value = color;
                applyFn(color);
            };
            picker.addEventListener('input', (e) => sync(e.target.value));
            picker.addEventListener('change', (e) => sync(e.target.value));
            // Hex text input
            if (hex) {
                hex.addEventListener('change', (e) => {
                    let v = e.target.value.trim();
                    if (!v.startsWith('#')) v = '#' + v;
                    if (/^#[0-9a-fA-F]{6}$/.test(v)) sync(v);
                    else e.target.value = picker.value.toUpperCase();
                });
                hex.addEventListener('input', (e) => {
                    let v = e.target.value.trim();
                    if (!v.startsWith('#')) v = '#' + v;
                    if (/^#[0-9a-fA-F]{6}$/.test(v)) sync(v);
                });
            }
        };

        wireColor('editor-bg-color', (c) => { this.renderer.C.bg = c; this.requestRender(); });
        wireColor('preview-bg-color', (c) => { this.preview.bgColor = c; this._renderPreview(); });
        wireColor('info-text-color', (c) => { this.preview.infoColor = c; this._renderPreview(); });
        wireColor('name-text-color', (c) => { this.preview.nameColor = c; this._renderPreview(); });

        // Swatch clicks
        document.querySelectorAll('.swatch').forEach(sw => {
            sw.addEventListener('click', (e) => {
                const targetId = sw.parentElement.dataset.target;
                const color = sw.dataset.color;
                const picker = document.getElementById(targetId);
                const hex = document.getElementById(targetId + '-hex');
                const circle = document.querySelector(`.color-circle[data-for="${targetId}"]`);
                if (picker) {
                    picker.value = color;
                    if (hex) hex.value = color.toUpperCase();
                    if (circle) circle.style.background = color;
                    if (targetId === 'editor-bg-color') { this.renderer.C.bg = color; this.requestRender(); }
                    else if (targetId === 'preview-bg-color') { this.preview.bgColor = color; this._renderPreview(); }
                    else if (targetId === 'info-text-color') { this.preview.infoColor = color; this._renderPreview(); }
                    else if (targetId === 'name-text-color') { this.preview.nameColor = color; this._renderPreview(); }
                }
            });
        });
    }

    _initTopBar() {
        document.getElementById('btn-undo').addEventListener('click', () => { this.data.undo(); this.requestRender(); this.uiManager.updateProperties(); });
        document.getElementById('btn-redo').addEventListener('click', () => { this.data.redo(); this.requestRender(); this.uiManager.updateProperties(); });
        document.getElementById('btn-save').addEventListener('click', () => {
            const name = document.getElementById('circuit-name').value || 'Untitled Circuit'; 
            this.data.name = name;
            const jsonStr = this.data.toJSON();
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.json';
            a.click();
            URL.revokeObjectURL(url);
            this.setStatus(`Downloaded "${name}.json"`);
        });
        document.getElementById('btn-load').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const json = event.target.result;
                        this.data.fromJSON(json);
                        document.getElementById('circuit-name').value = this.data.name || 'Untitled Circuit';
                        this.setSelection(null);
                        this.renderer.fitToScreen(this.data, this.editor);
                        this.requestRender();
                        this._renderPreview();
                        this.uiManager.updateProperties();
                        this.setStatus(`Loaded "${file.name}"`);
                    } catch (err) {
                        alert("Invalid or corrupted circuit file.");
                        this.setStatus("Error loading file.");
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        });
        document.getElementById('btn-export').addEventListener('click', () => {
            this._openExportModal();
        });
        document.getElementById('btn-clear').addEventListener('click', () => {
            if (confirm('Clear entire circuit?')) { this.data.snapshot(); this.data.clear(); this.setSelection(null); this.requestRender(); this._renderPreview(); this.uiManager.updateProperties(); }
        });
        document.getElementById('circuit-name').addEventListener('change', e => { this.data.name = e.target.value; });
    }

    _initGenerateBtn() {
        document.getElementById('btn-generate').addEventListener('click', () => {
            this.data.name = document.getElementById('circuit-name').value || 'Untitled Circuit';
            this._renderPreview(); this.setStatus('Preview generated!');
            document.getElementById('preview-container').classList.add('pulse');
            setTimeout(() => document.getElementById('preview-container').classList.remove('pulse'), 600);
        });
        document.getElementById('btn-download-map').addEventListener('click', () => {
            this._openExportModal();
        });
    }
    _initHelp() {
        const loadExample = (name, pts, zones = [], turns = []) => {
            this.data.snapshot();
            this.data.clear();
            this.data.name = name;
            document.getElementById('circuit-name').value = name;
            pts.forEach((p, i) => {
                const cp = this.data.addControlPoint(p.x, p.y);
                if (p.sector !== undefined) cp.sector = p.sector;
                cp.widthLeft = p.widthLeft !== undefined ? p.widthLeft : 12;
                cp.widthRight = p.widthRight !== undefined ? p.widthRight : 12;
            });
            if (pts.length >= 3) this.data.closeTrack();

            zones.forEach(z => {
                this.data.zones.push({
                    id: this.data._genId(),
                    type: z.type,
                    segIndex: z.segIndex,
                    t: z.t,
                    endSegIndex: z.endSegIndex !== undefined ? z.endSegIndex : z.segIndex,
                    endT: z.endT !== undefined ? z.endT : z.t,
                    side: z.side || 'left',
                    labelOffsetX: z.labelOffsetX !== undefined ? z.labelOffsetX : (z.type === 'straight_mode' ? 0 : (z.side === 'left' ? -40 : 40)),
                    labelOffsetY: z.labelOffsetY !== undefined ? z.labelOffsetY : -30
                });
            });

            turns.forEach(t => {
                this.data.turnMarkers.push({
                    id: this.data._genId(),
                    segIndex: t.segIndex,
                    t: t.t,
                    label: t.num.toString(),
                    side: t.side || 'right'
                });
            });
            this.renderer.fitToScreen(this.data, this.editor);
            this.setSelection(null);
            this.requestRender();
            this._renderPreview();
            this.uiManager.updateProperties();
            this.setStatus(`Loaded example: ${name}`);
        };

        document.addEventListener('click', (e) => {
            const ovalBtn = e.target.closest('#example-map-oval');
            const techBtn = e.target.closest('#example-map-technical');
            const streetBtn = e.target.closest('#example-map-street');

            if (ovalBtn) {
                loadExample('Example 1', [
                    { x: -200, y: -100, sector: 1, widthLeft: 15, widthRight: 15 },
                    { x: 200, y: -100, sector: 1, widthLeft: 15, widthRight: 15 },
                    { x: 250, y: -50, sector: 2, widthLeft: 15, widthRight: 15 },
                    { x: 250, y: 50, sector: 2, widthLeft: 15, widthRight: 15 },
                    { x: 200, y: 100, sector: 2, widthLeft: 15, widthRight: 15 },
                    { x: -200, y: 100, sector: 3, widthLeft: 15, widthRight: 15 },
                    { x: -250, y: 50, sector: 3, widthLeft: 15, widthRight: 15 },
                    { x: -250, y: -50, sector: 3, widthLeft: 15, widthRight: 15 },
                ], [], [
                    { segIndex: 2, t: 0.1, num: 1, side: 'right' },
                    { segIndex: 3, t: 0.8, num: 2, side: 'right' },
                    { segIndex: 6, t: 0.1, num: 3, side: 'right' },
                    { segIndex: 7, t: 0.8, num: 4, side: 'right' }
                ]);
            } else if (techBtn) {
                loadExample('Example 2', [
                    { x: 0, y: -180, sector: 1 },
                    { x: 200, y: -180, sector: 1 },
                    { x: 280, y: -120, sector: 1 },
                    { x: 300, y: -30, sector: 2 },
                    { x: 250, y: 50, sector: 2 },
                    { x: 150, y: 80, sector: 2 },
                    { x: 100, y: 150, sector: 2 },
                    { x: 0, y: 180, sector: 3 },
                    { x: -150, y: 140, sector: 3 },
                    { x: -200, y: 60, sector: 3 },
                    { x: -280, y: -20, sector: 3 },
                    { x: -200, y: -120, sector: 3 },
                    { x: -100, y: -180, sector: 3 },
                ], [
                    { type: 'straight_mode', segIndex: 11, t: 0.5, endSegIndex: 1, endT: 0.5, side: 'left' },
                    { type: 'overtake_detection', segIndex: 10, t: 0.5, side: 'right' },
                    { type: 'overtake_activation', segIndex: 12, t: 0.5, side: 'right' },
                    { type: 'speed_trap', segIndex: 1, t: 0.5, side: 'left' }
                ], [
                    { segIndex: 2, t: 0.1, num: 1, side: 'left' },
                    { segIndex: 3, t: 0.1, num: 2, side: 'left' },
                    { segIndex: 4, t: 0.1, num: 3, side: 'right' },
                    { segIndex: 5, t: 0.1, num: 4, side: 'left' },
                    { segIndex: 6, t: 0.1, num: 5, side: 'left' },
                    { segIndex: 8, t: 0.1, num: 6, side: 'right' },
                    { segIndex: 9, t: 0.1, num: 7, side: 'left' },
                    { segIndex: 10, t: 0.1, num: 8, side: 'left' },
                    { segIndex: 11, t: 0.1, num: 9, side: 'right' }
                ]);
            } else if (streetBtn) {
                loadExample('Example 3', [
                    { x: -50, y: -200, sector: 1, widthLeft: 10, widthRight: 10 },
                    { x: 150, y: -200, sector: 1, widthLeft: 10, widthRight: 10 },
                    { x: 200, y: -150, sector: 1, widthLeft: 10, widthRight: 10 },
                    { x: 200, y: -50, sector: 1, widthLeft: 10, widthRight: 10 },
                    { x: 250, y: 0, sector: 2, widthLeft: 10, widthRight: 10 },
                    { x: 200, y: 60, sector: 2, widthLeft: 10, widthRight: 10 },
                    { x: 100, y: 40, sector: 2, widthLeft: 10, widthRight: 10 },
                    { x: 50, y: 100, sector: 2, widthLeft: 10, widthRight: 10 },
                    { x: -50, y: 120, sector: 3, widthLeft: 10, widthRight: 10 },
                    { x: -150, y: 80, sector: 3, widthLeft: 10, widthRight: 10 },
                    { x: -200, y: 0, sector: 3, widthLeft: 10, widthRight: 10 },
                    { x: -200, y: -100, sector: 3, widthLeft: 10, widthRight: 10 },
                    { x: -150, y: -180, sector: 3, widthLeft: 10, widthRight: 10 },
                ], [
                    { type: 'straight_mode', segIndex: 11, t: 0.5, endSegIndex: 1, endT: 0.5, side: 'left' },
                    { type: 'overtake_detection', segIndex: 10, t: 0.8, side: 'right' },
                    { type: 'overtake_activation', segIndex: 12, t: 0.5, side: 'right' },
                    { type: 'speed_trap', segIndex: 1, t: 0.5, side: 'left' },

                    { type: 'straight_mode', segIndex: 2, t: 0.8, endSegIndex: 4, endT: 0.2, side: 'left' },
                    { type: 'overtake_detection', segIndex: 1, t: 0.8, side: 'right' },
                    { type: 'overtake_activation', segIndex: 3, t: 0.2, side: 'right' }
                ], [
                    { segIndex: 2, t: 0.1, num: 1, side: 'left' },
                    { segIndex: 3, t: 0.1, num: 2, side: 'left' },
                    { segIndex: 4, t: 0.1, num: 3, side: 'left' },
                    { segIndex: 5, t: 0.1, num: 4, side: 'right' },
                    { segIndex: 6, t: 0.1, num: 5, side: 'left' },
                    { segIndex: 7, t: 0.1, num: 6, side: 'left' },
                    { segIndex: 8, t: 0.1, num: 7, side: 'right' },
                    { segIndex: 9, t: 0.1, num: 8, side: 'left' },
                    { segIndex: 10, t: 0.1, num: 9, side: 'right' },
                    { segIndex: 11, t: 0.1, num: 10, side: 'left' },
                    { segIndex: 12, t: 0.1, num: 11, side: 'left' }
                ]);
            }
        });
        
        this._initExportModal();
    }

    _initExportModal() {
        const c = document.getElementById('export-preview-canvas');
        if (!c) return;
        this.exportPreview = new F1.PreviewRenderer(c);
        
        let isDragging = false, lastX, lastY, draggingText = false;
        c.addEventListener('wheel', e => {
            e.preventDefault();
            const rect = c.getBoundingClientRect();
            const ratioX = c.width / c.clientWidth;
            const ratioY = c.height / c.clientHeight;
            this.exportPreview.zoom(e.deltaY, (e.clientX - rect.left) * ratioX, (e.clientY - rect.top) * ratioY);
            this._renderExportPreview();
        });
        c.addEventListener('mousedown', e => {
            const rect = c.getBoundingClientRect();
            const ratioX = c.width / c.clientWidth;
            const ratioY = c.height / c.clientHeight;
            const cx = (e.clientX - rect.left) * ratioX;
            const cy = (e.clientY - rect.top) * ratioY;
            
            // Hit test for text (approximate bounding box)
            const px = this.exportPreview.customNamePos ? this.exportPreview.customNamePos.x : (this.data.namePos ? this.data.namePos.x : 20);
            const py = this.exportPreview.customNamePos ? this.exportPreview.customNamePos.y : (this.data.namePos ? this.data.namePos.y : 16);
            if (cx >= px - 10 && cx <= px + 300 && cy >= py - 10 && cy <= py + 100) {
                draggingText = true;
            } else {
                isDragging = true;
            }
            lastX = e.clientX; lastY = e.clientY;
        });
        window.addEventListener('mousemove', e => {
            if (!isDragging && !draggingText) return;
            const rect = c.getBoundingClientRect();
            const ratioX = c.width / c.clientWidth;
            const ratioY = c.height / c.clientHeight;
            const dx = (e.clientX - lastX) * ratioX;
            const dy = (e.clientY - lastY) * ratioY;
            lastX = e.clientX; lastY = e.clientY;
            
            if (draggingText) {
                if (!this.exportPreview.customNamePos) {
                    this.exportPreview.customNamePos = { 
                        x: this.data.namePos ? this.data.namePos.x : 20, 
                        y: this.data.namePos ? this.data.namePos.y : 16 
                    };
                }
                this.exportPreview.customNamePos.x += dx;
                this.exportPreview.customNamePos.y += dy;
            } else {
                this.exportPreview.pan(dx, dy);
            }
            this._renderExportPreview();
        });
        window.addEventListener('mouseup', () => { isDragging = false; draggingText = false; });

        document.getElementById('btn-close-export').onclick = () => document.getElementById('export-modal').style.display = 'none';
        document.getElementById('btn-export-fit').onclick = () => { this.exportPreview.fitToScreen(); this._renderExportPreview(); };
        
        document.getElementById('btn-do-export').onclick = () => this._doExport();
        
        const resync = () => this._renderExportPreview();
        document.getElementById('export-w').addEventListener('change', resync);
        document.getElementById('export-h').addEventListener('change', resync);
        document.getElementById('export-transparent').addEventListener('change', resync);
        
        // Handle window resize for export modal
        window.addEventListener('resize', () => {
            if (document.getElementById('export-modal').style.display === 'flex') {
                this._renderExportPreview();
            }
        });
    }

    _openExportModal() {
        document.getElementById('export-modal').style.display = 'flex';
        this.data.name = document.getElementById('circuit-name').value || 'Untitled Circuit';
        
        // Sync layers and styles
        Object.assign(this.exportPreview.layers, this.preview.layers);
        this.exportPreview.bgColor = this.preview.bgColor;
        this.exportPreview.infoColor = this.preview.infoColor;
        this.exportPreview.nameColor = this.preview.nameColor;
        this.exportPreview.customNamePos = null; // Reset text position for export
        
        this.exportPreview.fitToScreen();
        this._renderExportPreview();
    }

    _renderExportPreview() {
        const wrap = document.getElementById('export-preview-wrapper');
        const W = document.getElementById('export-w').value || 1920;
        const H = document.getElementById('export-h').value || 1080;
        const transparent = document.getElementById('export-transparent').checked;
        
        // Fit canvas aspect ratio inside wrapper
        const wrapRatio = wrap.clientWidth / wrap.clientHeight;
        const expRatio = W / H;
        
        let cw, ch;
        if (wrapRatio > expRatio) {
            ch = wrap.clientHeight - 40;
            cw = ch * expRatio;
        } else {
            cw = wrap.clientWidth - 40;
            ch = cw / expRatio;
        }
        
        const c = this.exportPreview.canvas;
        c.style.width = cw + 'px';
        c.style.height = ch + 'px';
        c.width = W;
        c.height = H;
        
        // Force background override if transparent
        const oldBg = this.exportPreview.bgColor;
        if (transparent) this.exportPreview.bgColor = 'rgba(0,0,0,0)';
        
        this.exportPreview.render(this.data, this.editor);
        
        // Restore
        this.exportPreview.bgColor = oldBg;
    }

    _doExport() {
        const fmt = document.getElementById('export-format').value;
        const W = parseInt(document.getElementById('export-w').value) || 1920;
        const H = parseInt(document.getElementById('export-h').value) || 1080;
        const transparent = document.getElementById('export-transparent').checked;
        const name = (this.data.name || 'circuit').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        if (fmt === 'svg') {
            const exporter = new F1.SVGExporter(this.preview.bgColor, this.preview.infoColor, this.preview.nameColor);
            const svgStr = exporter.export(this.data, this.editor, W, H, transparent, this.exportPreview.customNamePos);
            const blob = new Blob([svgStr], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${name}.svg`; a.click();
            URL.revokeObjectURL(url);
            this.setStatus(`Exported ${name}.svg`);
        } else {
            // Render full res to canvas
            const c = document.createElement('canvas'); c.width = W; c.height = H;
            const pr = new F1.PreviewRenderer(c);
            Object.assign(pr.layers, this.preview.layers);
            pr.bgColor = transparent && fmt !== 'jpg' ? 'rgba(0,0,0,0)' : this.preview.bgColor;
            pr.infoColor = this.preview.infoColor;
            pr.nameColor = this.preview.nameColor;
            pr.userScale = this.exportPreview.userScale;
            pr.userOx = this.exportPreview.userOx;
            pr.userOy = this.exportPreview.userOy;
            
            pr.render(this.data, this.editor);
            
            const mime = fmt === 'jpg' ? 'image/jpeg' : 'image/png';
            const url = c.toDataURL(mime, 0.95);
            const a = document.createElement('a'); a.href = url; a.download = `${name}.${fmt}`; a.click();
            this.setStatus(`Exported ${name}.${fmt}`);
        }
        
        document.getElementById('export-modal').style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => { window.app = new F1.App(); });

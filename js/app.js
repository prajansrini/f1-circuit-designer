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
            barrier: new F1.Tools.BarrierPainterTool(this),
            sector: new F1.Tools.SectorTool(this),
            turn: new F1.Tools.TurnTool(this),
            pitlane: new F1.Tools.PitLaneTool(this),
            grandstand: new F1.Tools.GrandstandTool(this),
            zone: new F1.Tools.ZoneTool(this),
            straightMode: new F1.Tools.StraightModeTool(this),
            garage: new F1.Tools.GarageTool(this),
            eraser: new F1.Tools.EraserTool(this)
        };

        this.activeToolName = 'draw';
        this.activeTool = this.tools.draw;
        this.selection = null;
        this.hoverPoint = null;
        this._needsRender = true;
        this._isPanning = false;
        this._panStart = null;

        this._initEvents();
        this._initToolbar();
        this._initTopBar();
        this._initGenerateBtn();
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
        this.canvas.style.cursor = this.activeTool.getCursor();
        this.uiManager.updateProperties();
        this.requestRender();
    }

    setSelection(sel) { this.selection = sel; this.uiManager.updateProperties(); this.requestRender(); }
    setStatus(msg) { document.getElementById('status-info').textContent = msg; }
    requestRender() { this._needsRender = true; }

    _renderLoop() {
        if (this._needsRender) { this.renderer.render(this.data, this.editor, this.selection, this.hoverPoint, this.activeToolName); this._needsRender = false; }
        requestAnimationFrame(() => this._renderLoop());
    }

    _renderPreview() { this.preview.resize(); this.preview.render(this.data, this.editor); }

    _initEvents() {
        const canvas = this.canvas;
        canvas.addEventListener('mousedown', e => {
            if (e.button === 1 || (e.button === 0 && e.altKey)) { this._isPanning = true; this._panStart = { x: e.clientX, y: e.clientY }; canvas.style.cursor = 'grabbing'; e.preventDefault(); return; }
            if (e.button === 0) { const r = canvas.getBoundingClientRect(); const w = this.renderer.s2w(e.clientX - r.left, e.clientY - r.top); this.activeTool.onMouseDown(w.x, w.y, e); }
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
        canvas.addEventListener('wheel', e => { e.preventDefault(); const r = canvas.getBoundingClientRect(); this.renderer.zoom(e.deltaY, e.clientX - r.left, e.clientY - r.top); this.requestRender(); }, { passive: false });
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        window.addEventListener('resize', () => { this.renderer.resize(); this.preview.resize(); this.requestRender(); this._renderPreview(); });
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.data.undo(); this.requestRender(); this.uiManager.updateProperties(); return; }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); this.data.redo(); this.requestRender(); this.uiManager.updateProperties(); return; }
            const sc = { v: 'select', p: 'draw', n: 'node', w: 'width', s: 'surface', b: 'barrier', '1': 'sector', l: 'pitlane', g: 'grandstand', z: 'zone', m: 'straightMode', r: 'garage', e: 'eraser', t: 'turn' };
            if (!e.ctrlKey && !e.metaKey && sc[e.key]) { this.setTool(sc[e.key]); return; }
            if (e.key === '#' || (e.key === '3' && e.shiftKey)) { this.renderer.showGrid = !this.renderer.showGrid; this.requestRender(); return; }
            if (e.key.toLowerCase() === 'f') { this.renderer.fitToScreen(this.data, this.editor); this.preview.fitToScreen(this.data, this.editor); this.requestRender(); this._renderPreview(); return; }
            this.activeTool.onKeyDown(e);
        });
    }

    _initToolbar() {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => { btn.addEventListener('click', () => this.setTool(btn.dataset.tool)); });
        document.getElementById('btn-grid')?.addEventListener('click', () => { this.renderer.showGrid = !this.renderer.showGrid; this.requestRender(); });
    }

    _initTopBar() {
        document.getElementById('btn-undo').addEventListener('click', () => { this.data.undo(); this.requestRender(); this.uiManager.updateProperties(); });
        document.getElementById('btn-redo').addEventListener('click', () => { this.data.redo(); this.requestRender(); this.uiManager.updateProperties(); });
        document.getElementById('btn-save').addEventListener('click', () => {
            const name = document.getElementById('circuit-name').value || 'Untitled'; this.data.name = name;
            localStorage.setItem('f1circuit_' + name, this.data.toJSON()); this.setStatus(`Saved "${name}"`);
        });
        document.getElementById('btn-load').addEventListener('click', () => {
            const keys = Object.keys(localStorage).filter(k => k.startsWith('f1circuit_'));
            if (!keys.length) { this.setStatus('No saved circuits'); return; }
            const name = prompt('Load circuit:\n\n' + keys.map(k => '• ' + k.replace('f1circuit_', '')).join('\n'));
            if (!name) return; const json = localStorage.getItem('f1circuit_' + name);
            if (json) { this.data.fromJSON(json); document.getElementById('circuit-name').value = this.data.name; this.setSelection(null); this.requestRender(); this._renderPreview(); this.setStatus(`Loaded "${name}"`); }
            else this.setStatus(`"${name}" not found`);
        });
        document.getElementById('btn-export').addEventListener('click', () => {
            this.renderer.showCtrlPts = false; this.renderer.showGrid = false;
            this.renderer.render(this.data, this.editor, null, null, '');
            const url = this.renderer.canvas.toDataURL('image/png');
            this.renderer.showCtrlPts = true; this.renderer.showGrid = true; this.requestRender();
            const a = document.createElement('a'); a.href = url; a.download = (this.data.name || 'circuit') + '_editor.png'; a.click();
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
            this.data.name = document.getElementById('circuit-name').value || 'Untitled Circuit';
            const c = document.createElement('canvas'); c.width = 1920; c.height = 1080;
            const pr = new F1.PreviewRenderer(c);
            Object.assign(pr.layers, this.preview.layers);
            pr.resize = () => { pr.canvas.width = 1920; pr.canvas.height = 1080; };
            // Wait for images to load then render
            const imgs = [pr.chequeredImg, pr.arrowImg, pr.stripsImg];
            const loaded = imgs.filter(i => i.complete);
            if (loaded.length === imgs.length) {
                pr.resize(); pr.render(this.data, this.editor);
                const url = c.toDataURL('image/png');
                const a = document.createElement('a'); a.href = url; a.download = (this.data.name || 'circuit') + '_map.png'; a.click();
                this.setStatus('Circuit map downloaded (1920×1080)');
            } else {
                this.setStatus('Loading assets...');
                setTimeout(() => {
                    pr.resize(); pr.render(this.data, this.editor);
                    const url = c.toDataURL('image/png');
                    const a = document.createElement('a'); a.href = url; a.download = (this.data.name || 'circuit') + '_map.png'; a.click();
                    this.setStatus('Circuit map downloaded (1920×1080)');
                }, 500);
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => { window.app = new F1.App(); });

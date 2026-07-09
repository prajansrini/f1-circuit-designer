/* ============================================================
   app.js — Main Application (Split View: Editor + Preview)
   ============================================================ */
window.F1 = window.F1 || {};

F1.App = class App {
    constructor() {
        this.projects = [];
        this.currentProjectIndex = 0;

        try {
            const saved = localStorage.getItem('f1_circuit_projects');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.projects && Array.isArray(parsed.projects) && parsed.projects.length > 0) {
                    this.projects = parsed.projects.map(pData => {
                        const pd = new F1.CircuitData();
                        pd.fromJSON(JSON.stringify(pData));
                        return pd;
                    });
                    this.currentProjectIndex = parsed.currentIndex || 0;
                    if (this.currentProjectIndex >= this.projects.length) this.currentProjectIndex = 0;
                }
            }
        } catch (e) {
            console.error('Failed to load projects from storage', e);
        }

        if (this.projects.length === 0) {
            this.projects.push(new F1.CircuitData());
        }

        this.data = this.projects[this.currentProjectIndex];
        this.editor = new F1.TrackEditor(this.data);
        this.canvas = document.getElementById('main-canvas');
        this.renderer = new F1.Renderer(this.canvas);
        this.previewCanvas = document.getElementById('preview-canvas');
        this.preview = new F1.PreviewRenderer(this.previewCanvas);
        this.preview3DCanvas = document.getElementById('preview-3d-canvas');
        if (this.preview3DCanvas && window.F1.Editor3D) {
            this.preview3D = new F1.Editor3D(this.preview3DCanvas, this, 'preview');
        }
        this.editor3DCanvas = document.getElementById('editor-3d-canvas');
        if (this.editor3DCanvas && window.F1.Editor3D) {
            this.editor3D = new F1.Editor3D(this.editor3DCanvas, this, 'editor');
        }
        this.is3DPreview = false;
        this.isEditor3D = false;
        this.uiManager = new F1.UIManager(this);
        this.hotlapSimulator = new F1.HotlapSimulator(this);

        window.addEventListener('circuit-changed', () => this._saveProjectsToStorage());

        this.tools = {
            select: new F1.Tools.SelectTool(this),
            draw: new F1.Tools.DrawTrackTool(this),
            node: new F1.Tools.NodeTool(this),
            width: new F1.Tools.WidthTool(this),
            surface: new F1.Tools.SurfacePainterTool(this),
            sector: new F1.Tools.SectorTool(this),
            turn: new F1.Tools.TurnTool(this),
            pitlane: new F1.Tools.PitLaneTool(this),
            zone: new F1.Tools.ZoneTool(this),
            straightMode: new F1.Tools.StraightModeTool(this),

            hotlap: new F1.Tools.BaseTool(this),
            analysis: new F1.Tools.BaseTool(this),
            eraser: new F1.Tools.EraserTool(this),
            scale: new F1.Tools.ScaleTool(this),
            garage: new F1.Tools.GarageTool(this),
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

        this._renderProjectTabs();
        const nameInput = document.getElementById('circuit-name');
        if (nameInput) nameInput.value = this.data.name || '';

        this.setTool(this.data.isClosed ? 'select' : 'draw');
        this._renderLoop();
        setTimeout(() => this._renderPreview(), 100);
    }

    setTool(name) {
        if (this.activeTool) this.activeTool.deactivate();
        this.activeToolName = name;
        this.activeTool = this.tools[name];
        this.activeTool.activate();
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === name));

        // Auto-switch back to 2D view if tool is not supported in 3D
        if (this.isEditor3D && !['node', 'width', 'select'].includes(name)) {
            this.isEditor3D = false;
            const btn = document.getElementById('btn-toggle-editor-3d');
            if (btn) btn.classList.remove('active');
        }

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

        const minCrossDist = 40;
        const duplicateThreshold = 10;

        for (let i = 0; i < track.length - 1; i++) {
            for (let j = i + minCrossDist; j < track.length - 1; j++) {
                if (this.data.isClosed) {
                    const dist = Math.min(j - i, track.length - (j - i));
                    if (dist < minCrossDist) continue;
                }

                if (intersect(track[i], track[i + 1], track[j], track[j + 1])) {
                    // Angle filter: reject near-parallel scrapes (< 10 degrees)
                    const dx1 = track[i + 1].x - track[i].x, dy1 = track[i + 1].y - track[i].y;
                    const dx2 = track[j + 1].x - track[j].x, dy2 = track[j + 1].y - track[j].y;
                    const len1 = Math.hypot(dx1, dy1) || 1, len2 = Math.hypot(dx2, dy2) || 1;
                    const dot = Math.abs((dx1 * dx2 + dy1 * dy2) / (len1 * len2));
                    const angleDeg = Math.acos(Math.min(1, dot)) * 180 / Math.PI;
                    if (angleDeg < 10) continue; // not a real crossing, just parallel scrape

                    const cx = (track[i].x + track[i + 1].x + track[j].x + track[j + 1].x) / 4;
                    const cy = (track[i].y + track[i + 1].y + track[j].y + track[j + 1].y) / 4;
                    // Two intersections are duplicates only if both their A and B crossing indices
                    // are extremely close to an existing one (within `skip` steps). Pure world-space
                    // distance is unreliable for dense circuits where two distinct crossings happen
                    // to be physically close together.
                    const isDuplicate = intersections.some(ix => {
                        const closeA = Math.abs(ix.trackIdxA - i) < duplicateThreshold && Math.abs(ix.trackIdxB - j) < duplicateThreshold;
                        const closeB = Math.abs(ix.trackIdxA - j) < duplicateThreshold && Math.abs(ix.trackIdxB - i) < duplicateThreshold;
                        return closeA || closeB;
                    });
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
            const idA = this.data.controlPoints[ix.cpA].id;
            const idB = this.data.controlPoints[ix.cpB].id;
            const minId = Math.min(idA, idB);
            const maxId = Math.max(idA, idB);
            const baseKey = `${minId}-${maxId}`;
            counts[baseKey] = (counts[baseKey] || 0) + 1;
            ix.key = `${baseKey}-${counts[baseKey] - 1}`;
        });

        this.intersections = intersections;
    }

    _renderLoop() {
        if (this._needsRender) {
            // Always recalculate intersections so bridges dynamically follow node movement
            // regardless of which tool (select, draw, node, width…) is active.
            this._updateIntersections();
            const view3DControlsEditor = document.getElementById('view-3d-controls-editor');
            if (this.isEditor3D && this.editor3D) {
                this.editor3DCanvas.style.display = 'block';
                if (view3DControlsEditor) view3DControlsEditor.style.display = 'flex';
                this.canvas.style.display = 'none';
                this.editor3D.resize();
                this.editor3D.render(this.data, this.editor, this.selection, this.hoverPoint, this.activeToolName);
            } else {
                if (this.editor3DCanvas) this.editor3DCanvas.style.display = 'none';
                if (view3DControlsEditor) view3DControlsEditor.style.display = 'none';
                this.canvas.style.display = 'block';
                this.renderer.render(this.data, this.editor, this.selection, this.hoverPoint, this.activeToolName);
            }
            this._needsRender = false;
        }
        requestAnimationFrame(() => this._renderLoop());
    }

    _renderPreview() {
        this._updateIntersections(); 
        const view3DControls = document.getElementById('view-3d-controls');
        if (this.is3DPreview && this.preview3D) {
            this.preview3DCanvas.style.display = 'block';
            if (view3DControls) view3DControls.style.display = 'flex';
            this.previewCanvas.style.display = 'none';
            this.preview3D.resize();
            this.preview3D.render(this.data, this.editor, this.selection, this.hoverPoint, this.activeToolName);
        } else {
            if (this.preview3DCanvas) this.preview3DCanvas.style.display = 'none';
            if (view3DControls) view3DControls.style.display = 'none';
            this.previewCanvas.style.display = 'block';
            this.preview.resize(); 
            this.preview.render(this.data, this.editor); 
        }
    }

    _saveProjectsToStorage() {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            const data = {
                currentIndex: this.currentProjectIndex,
                projects: this.projects.map(p => p._serialize())
            };
            try { localStorage.setItem('f1_circuit_projects', JSON.stringify(data)); }
            catch (e) { console.error('Failed to save to localStorage', e); }
        }, 500);
    }

    newProject() {
        const p = new F1.CircuitData();
        this.projects.push(p);
        this.switchProject(this.projects.length - 1);
    }

    duplicateProject() {
        const newProj = new F1.CircuitData();
        newProj.fromJSON(this.data.toJSON());
        newProj.name = (this.data.name || 'Untitled Circuit') + ' Copy';
        this.projects.push(newProj);
        this.switchProject(this.projects.length - 1);
    }

    switchProject(index) {
        if (index < 0 || index >= this.projects.length) return;
        this.currentProjectIndex = index;
        this.data = this.projects[index];
        this.editor = new F1.TrackEditor(this.data);
        this.setSelection(null);
        const nameInput = document.getElementById('circuit-name');
        if (nameInput) nameInput.value = this.data.name || '';
        this._renderProjectTabs();
        if (this.activeTool && this.activeTool.activate) this.activeTool.activate();
        this.requestRender();
        this._renderPreview();
        this.uiManager.updateProperties();
        this._saveProjectsToStorage();
    }

    closeProject(index) {
        if (!confirm("Are you sure you want to close this circuit? Make sure you have saved your work!")) return;
        this.projects.splice(index, 1);
        if (this.projects.length === 0) {
            this.projects.push(new F1.CircuitData());
            this.switchProject(0);
        } else {
            let nextIndex = this.currentProjectIndex;
            if (index < nextIndex) nextIndex--;
            else if (index === nextIndex && nextIndex >= this.projects.length) nextIndex = this.projects.length - 1;
            this.switchProject(nextIndex);
        }
    }

    _renderProjectTabs() {
        const container = document.getElementById('project-tabs');
        if (!container) return;
        container.innerHTML = '';
        this.projects.forEach((p, i) => {
            const t = document.createElement('div');
            t.className = 'project-tab' + (i === this.currentProjectIndex ? ' active' : '');
            t.title = p.name || 'Untitled Circuit';
            t.onclick = () => this.switchProject(i);

            const n = document.createElement('span');
            n.className = 'project-tab-name';
            n.textContent = p.name || 'Untitled Circuit';
            t.appendChild(n);

            const c = document.createElement('div');
            c.className = 'project-tab-close';
            c.textContent = '×';
            c.onclick = (e) => { e.stopPropagation(); this.closeProject(i); };
            t.appendChild(c);

            container.appendChild(t);
        });
    }

    _initEvents() {
        const canvas = this.canvas;
        let isSpaceDown = false;
        this.hoveredCanvas = 'editor';
        document.getElementById('editor-container').addEventListener('mouseenter', () => this.hoveredCanvas = 'editor');
        document.getElementById('preview-container').addEventListener('mouseenter', () => this.hoveredCanvas = 'preview');

        document.addEventListener('keydown', e => {
            const isTextInput = e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && ['text', 'number', 'password', 'search'].includes(e.target.type));
            if (e.code === 'Space' && !isTextInput) { isSpaceDown = true; e.preventDefault(); }
        });
        document.addEventListener('keyup', e => { if (e.code === 'Space') isSpaceDown = false; });

        canvas.addEventListener('mousedown', e => {
            if (e.button === 1 || (e.button === 0 && (e.detail === 2 || isSpaceDown))) { this._isPanning = true; this._panStart = { x: e.clientX, y: e.clientY }; canvas.style.cursor = 'grabbing'; e.preventDefault(); return; }
            if (e.button === 0) {
                const r = canvas.getBoundingClientRect(); const w = this.renderer.s2w(e.clientX - r.left, e.clientY - r.top);
                this.activeTool.onMouseDown(w.x, w.y, e);
                const isPannableTool = ['SelectTool', 'SectorTool'].includes(this.activeTool.constructor.name) || 
                                       (this.activeTool.constructor.name === 'DrawTrackTool' && this.data.isClosed);
                if (isPannableTool && !this.activeTool.dragging && !this.activeTool.rotatingObj && !this.selection && !this.activeTool.painting) {
                    this._isPanning = true; this._panStart = { x: e.clientX, y: e.clientY }; canvas.style.cursor = 'grabbing';
                }
            }
        });
        canvas.addEventListener('mousemove', e => {
            const r = canvas.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top;
            if (this._isPanning) { this.renderer.pan(e.clientX - this._panStart.x, e.clientY - this._panStart.y); this._panStart = { x: e.clientX, y: e.clientY }; this.requestRender(); return; }
            const w = this.renderer.s2w(sx, sy); this.activeTool.onMouseMove(w.x, w.y, e);
            // Always keep intersections fresh so bridges follow geometry changes from any tool
            this._updateIntersections();
            this.uiManager.updateStatusBar(w.x, w.y);
        });
        window.addEventListener('mouseup', e => {
            if (this._isPanning) { this._isPanning = false; canvas.style.cursor = this.activeTool.getCursor(); return; }
            const r = canvas.getBoundingClientRect();
            const w = this.renderer.s2w(e.clientX - r.left, e.clientY - r.top);
            this.activeTool.onMouseUp(w.x, w.y, e);
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
        window.addEventListener('mouseup', e => {
            if (isPreviewPanning) { isPreviewPanning = false; pCanvas.style.cursor = 'default'; }
        }); pCanvas.addEventListener('mouseleave', () => { isPreviewPanning = false; pCanvas.style.cursor = 'default'; });
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
            if (e.key === 'Escape') {
                if (document.getElementById('hotlap-modal').style.display === 'flex') {
                    this.hotlapSimulator.closeModal();
                    return;
                }
                this.setTool('select');
                return;
            }
            if (e.ctrlKey || e.metaKey) {
                const key = e.key.toLowerCase();
                if (key === 'm') { e.preventDefault(); this._renderPreview(); return; }
                if (key === 's') { e.preventDefault(); document.getElementById('btn-save').click(); return; }
                if (key === 'o') { e.preventDefault(); document.getElementById('btn-load').click(); return; }
                if (key === 'i') { e.preventDefault(); this._openExportModal(); return; }
                if (key === 'd') { e.preventDefault(); document.getElementById('btn-duplicate-project').click(); return; }
                if (key === '/') {
                    e.preventDefault();
                    const cn = document.getElementById('circuit-name');
                    if (cn) { cn.focus(); cn.select(); }
                    return;
                }
                if (key === 'z') { e.preventDefault(); this.data.undo(); this.requestRender(); this.uiManager.updateProperties(); return; }
                if (key === 'y' || (e.shiftKey && key === 'z')) { e.preventDefault(); this.data.redo(); this.requestRender(); this.uiManager.updateProperties(); return; }
            }
            if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n') { e.preventDefault(); document.getElementById('btn-new-project').click(); return; }
            const sc = { s: 'select', p: 'pitlane', d: 'draw', r: 'surface', n: 'node', w: 'width', b: 'barrier', o: 'sector', z: 'zone', m: 'straightMode', e: 'eraser', x: 'scale', c: 'analysis', t: 'turn', g: 'hotlap' };
            if (!e.ctrlKey && !e.metaKey && sc[e.key.toLowerCase()]) { this.setTool(sc[e.key.toLowerCase()]); return; }
            if (e.key.toLowerCase() === 'a') {
                if (document.getElementById('hotlap-modal').style.display === 'flex') {
                    if (this.hotlapSimulator.viewType.value === 'map') {
                        this.preview.fitToScreen(this.data, this.editor);
                    } else {
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        for (const p of this.data.controlPoints) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
                        const scaleX = (this.hotlapSimulator.canvas.width - 100) / (maxX - minX || 1);
                        const scaleY = (this.hotlapSimulator.canvas.height - 100) / (maxY - minY || 1);
                        this.hotlapSimulator.scale = Math.min(scaleX, scaleY);
                        this.hotlapSimulator.ox = -(minX + maxX) / 2;
                        this.hotlapSimulator.oy = -(minY + maxY) / 2;
                    }
                    if (!this.hotlapSimulator.playing || this.hotlapSimulator.paused) this.hotlapSimulator.render();
                    return;
                }
                if (document.getElementById('export-modal').style.display === 'flex') {
                    document.getElementById('btn-export-fit').click();
                } else if (this.hoveredCanvas === 'editor') {
                    this.renderer.fitToScreen(this.data, this.editor);
                    if (this.isEditor3D && this.editor3D) this.editor3D.fitToScreen(this.data);
                    this.requestRender();
                } else {
                    this.preview.fitToScreen(this.data, this.editor);
                    if (this.is3DPreview && this.preview3D) this.preview3D.fitToScreen(this.data);
                    this._renderPreview();
                }
                return;
            }
            if (e.key.toLowerCase() === 'f') {
                if (document.getElementById('export-modal').style.display === 'flex') return;
                if (document.getElementById('hotlap-modal').style.display === 'flex') return;
                if (this.hoveredCanvas === 'editor') {
                    document.getElementById('btn-full-editor').click();
                } else {
                    document.getElementById('btn-full-preview').click();
                }
                return;
            }
            if (e.key.toLowerCase() === 'v') {
                if (document.getElementById('export-modal').style.display === 'flex') return;
                if (document.getElementById('hotlap-modal').style.display === 'flex') return;
                if (this.hoveredCanvas === 'editor') {
                    const btn = document.getElementById('btn-toggle-editor-3d');
                    if (btn) btn.click();
                } else {
                    const btn = document.getElementById('btn-toggle-3d');
                    if (btn) btn.click();
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
            const sync = (color, fromHex = false) => {
                if (hex && !fromHex) hex.value = color.toUpperCase();
                if (circle) circle.style.background = color;
                if (picker.value !== color.toLowerCase()) picker.value = color;
                applyFn(color);
            };
            picker.addEventListener('input', (e) => sync(e.target.value));
            picker.addEventListener('change', (e) => sync(e.target.value));

            const parseHex = (val) => {
                let v = val.trim();
                if (!v.startsWith('#')) v = '#' + v;
                if (/^#[0-9a-fA-F]{3}$/.test(v)) {
                    return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
                }
                if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
                return null;
            };

            // Hex text input
            if (hex) {
                hex.addEventListener('change', (e) => {
                    let c = parseHex(e.target.value);
                    if (c) {
                        e.target.value = c.toUpperCase();
                        sync(c, true);
                    } else {
                        e.target.value = picker.value.toUpperCase();
                    }
                });
                hex.addEventListener('input', (e) => {
                    let c = parseHex(e.target.value);
                    if (c) sync(c, true);
                });
            }
        };

        wireColor('editor-bg-color', (c) => { this.renderer.C.bg = c; this.requestRender(); });
        wireColor('preview-bg-color', (c) => { this.preview.bgColor = c; this.exportPreview.bgColor = c; this._renderPreview(); });
        wireColor('preview-road-color', (c) => { this.preview.roadColor = c; this.exportPreview.roadColor = c; this._renderPreview(); });
        wireColor('info-text-color', (c) => { this.preview.infoColor = c; this.exportPreview.infoColor = c; this._renderPreview(); });
        wireColor('name-text-color', (c) => { this.preview.nameColor = c; this.exportPreview.nameColor = c; this._renderPreview(); });

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
                    else if (targetId === 'preview-bg-color') { this.preview.bgColor = color; this.exportPreview.bgColor = color; this._renderPreview(); }
                    else if (targetId === 'preview-road-color') { this.preview.roadColor = color; this.exportPreview.roadColor = color; this._renderPreview(); }
                    else if (targetId === 'info-text-color') { this.preview.infoColor = color; this.exportPreview.infoColor = color; this._renderPreview(); }
                    else if (targetId === 'name-text-color') { this.preview.nameColor = color; this.exportPreview.nameColor = color; this._renderPreview(); }
                }
            });
        });
    }

    _initTopBar() {
        document.getElementById('btn-new-project').addEventListener('click', () => { this.newProject(); });
        document.getElementById('btn-duplicate-project').addEventListener('click', () => { this.duplicateProject(); });

        document.getElementById('circuit-name').addEventListener('input', (e) => {
            this.data.name = e.target.value;
            this._renderProjectTabs();
            this.requestRender();
            this._saveProjectsToStorage();
        });

        document.getElementById('btn-undo').addEventListener('click', () => { this.data.undo(); this.requestRender(); this.uiManager.updateProperties(); this._saveProjectsToStorage(); });
        document.getElementById('btn-redo').addEventListener('click', () => { this.data.redo(); this.requestRender(); this.uiManager.updateProperties(); this._saveProjectsToStorage(); });
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

                        // If the current tab has a circuit, open a new tab for the loaded file
                        if (this.data.controlPoints && this.data.controlPoints.length > 0) {
                            this.newProject();
                        }

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

        const workspace = document.getElementById('workspace');

        document.getElementById('btn-full-editor').addEventListener('click', () => {
            if (workspace.classList.contains('full-editor')) {
                workspace.classList.remove('full-editor');
                document.getElementById('btn-full-editor').querySelector('span').innerText = 'Full View';
            } else {
                workspace.classList.add('full-editor');
                workspace.classList.remove('full-preview');
                document.getElementById('btn-full-editor').querySelector('span').innerText = 'Split View';
                document.getElementById('btn-full-preview').querySelector('span').innerText = 'Full View';
            }
            this.renderer.resize(); this.requestRender();
            this.preview.resize(); this._renderPreview();
        });

        document.getElementById('btn-full-preview').addEventListener('click', () => {
            if (workspace.classList.contains('full-preview')) {
                workspace.classList.remove('full-preview');
                document.getElementById('btn-full-preview').querySelector('span').innerText = 'Full View';
            } else {
                workspace.classList.add('full-preview');
                workspace.classList.remove('full-editor');
                document.getElementById('btn-full-preview').querySelector('span').innerText = 'Split View';
                document.getElementById('btn-full-editor').querySelector('span').innerText = 'Full View';
            }
            this.renderer.resize(); this.requestRender();
            if (this.preview3D) this.preview3D.resize();
            this.preview.resize(); this._renderPreview();
        });

        const btnToggle3D = document.getElementById('btn-toggle-3d');
        if (btnToggle3D) {
            btnToggle3D.onclick = () => {
                this.is3DPreview = !this.is3DPreview;
                btnToggle3D.classList.toggle('active', this.is3DPreview);
                const span = btnToggle3D.querySelector('span');
                if (span) span.textContent = this.is3DPreview ? '2D View' : '3D View (Beta)';
                this._renderPreview();
            };
        }

        const btnToggleEditor3D = document.getElementById('btn-toggle-editor-3d');
        if (btnToggleEditor3D) {
            btnToggleEditor3D.onclick = () => {
                this.isEditor3D = !this.isEditor3D;
                btnToggleEditor3D.classList.toggle('active', this.isEditor3D);
                const span = btnToggleEditor3D.querySelector('span');
                if (span) span.textContent = this.isEditor3D ? '2D View' : '3D View (Beta)';
                
                // If entering 3D view and current tool is not supported, switch to 'select'
                if (this.isEditor3D && !['node', 'width', 'select'].includes(this.activeToolName)) {
                    this.setTool('select');
                }
                
                this.requestRender();
            };
        }
    }
    _initHelp() {
        const loadExample = async (name, url) => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const jsonStr = await response.text();

                // If the current tab has a circuit, open a new tab for the loaded example
                if (this.data.controlPoints && this.data.controlPoints.length > 0) {
                    this.newProject();
                }

                this.data.snapshot();
                this.data.fromJSON(jsonStr);
                this.data.name = name;
                document.getElementById('circuit-name').value = name;

                this.renderer.fitToScreen(this.data, this.editor);
                this.setSelection(null);
                this.requestRender();
                this._renderPreview();
                this.uiManager.updateProperties();
                this.setStatus(`Loaded example: ${name}`);
            } catch (err) {
                console.error("Failed to load example:", err);
                this.setStatus("Error loading example.");
            }
        };

        document.addEventListener('click', (e) => {
            const ovalBtn = e.target.closest('#example-map-oval');
            const techBtn = e.target.closest('#example-map-technical');

            if (ovalBtn) {
                loadExample('Example 1', 'resources/example_1.json');
            } else if (techBtn) {
                loadExample('Example 2', 'resources/example_2.json');
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
            const sx = (e.clientX - rect.left) * ratioX;
            const sy = (e.clientY - rect.top) * ratioY;
            if (document.querySelector('input[name="export-source"]:checked').value === 'editor') {
                if (this.exportCanvasRenderer) this.exportCanvasRenderer.zoom(e.deltaY, sx, sy);
            } else {
                this.exportPreview.zoom(e.deltaY, sx, sy);
            }
            this._renderExportPreview();
        });
        let draggingLegend = false;
        c.addEventListener('mousedown', e => {
            const rect = c.getBoundingClientRect();
            const ratioX = c.width / c.clientWidth;
            const ratioY = c.height / c.clientHeight;
            const cx = (e.clientX - rect.left) * ratioX;
            const cy = (e.clientY - rect.top) * ratioY;

            const txtSet = this.exportPreview.textSettings || { x: 0, y: 0, scale: 1 };
            const legSet = this.exportPreview.legendSettings || { x: 0, y: 0, scale: 1 };

            // Text bounding box approx
            const px = (this.data.namePos ? this.data.namePos.x : 20) + txtSet.x;
            const py = (this.data.namePos ? this.data.namePos.y : 16) + txtSet.y;

            // Legend bounding box approx (starts bottom left by default usually, but we'll say top left of the drawn box)
            // It will be drawn at x: 20 + legSet.x, y: H - 150 + legSet.y
            const lx = 20 + legSet.x;
            const ly = c.height - 150 + legSet.y;

            if (cx >= px - 10 && cx <= px + 300 && cy >= py - 10 && cy <= py + 100) {
                draggingText = true;
            } else if (legSet.scale > 0 && cx >= lx - 10 && cx <= lx + 150 && cy >= ly - 10 && cy <= ly + 150) {
                draggingLegend = true;
            } else {
                isDragging = true;
            }
            lastX = e.clientX; lastY = e.clientY;
        });
        window.addEventListener('mousemove', e => {
            if (!isDragging && !draggingText && !draggingLegend) return;
            const rect = c.getBoundingClientRect();
            const ratioX = c.width / c.clientWidth;
            const ratioY = c.height / c.clientHeight;
            const dx = (e.clientX - lastX) * ratioX;
            const dy = (e.clientY - lastY) * ratioY;
            lastX = e.clientX; lastY = e.clientY;

            if (draggingText) {
                let elX = document.getElementById('export-text-x');
                let elY = document.getElementById('export-text-y');
                elX.value = parseInt(elX.value) + dx;
                elY.value = parseInt(elY.value) + dy;
                elX.dispatchEvent(new Event('input'));
            } else if (draggingLegend) {
                let elX = document.getElementById('export-legend-x');
                let elY = document.getElementById('export-legend-y');
                elX.value = parseInt(elX.value) + dx;
                elY.value = parseInt(elY.value) + dy;
                elX.dispatchEvent(new Event('input'));
            } else {
                if (document.querySelector('input[name="export-source"]:checked').value === 'editor') {
                    this.exportCanvasRenderer.pan(dx, dy);
                } else {
                    this.exportPreview.pan(dx, dy);
                }
                this._renderExportPreview();
            }
        });
        window.addEventListener('mouseup', () => { isDragging = false; draggingText = false; draggingLegend = false; });

        document.getElementById('btn-close-export').onclick = () => document.getElementById('export-modal').style.display = 'none';
        document.getElementById('export-modal').addEventListener('mousedown', (e) => {
            if (e.target.id === 'export-modal') document.getElementById('export-modal').style.display = 'none';
        });
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('export-modal').style.display === 'flex') {
                document.getElementById('export-modal').style.display = 'none';
            }
        });

        document.getElementById('btn-export-fit').onclick = () => {
            if (document.querySelector('input[name="export-source"]:checked').value === 'editor') {
                this.exportCanvasRenderer.fitToScreen(this.data);
            } else {
                this.exportPreview.fitToScreen();
            }
            this._renderExportPreview();
        };

        const doZoom = (delta) => {
            if (document.querySelector('input[name="export-source"]:checked').value === 'editor') {
                this.exportCanvasRenderer.zoom(delta, c.width / 2, c.height / 2);
            } else {
                this.exportPreview.zoom(delta, c.width / 2, c.height / 2);
            }
            this._renderExportPreview();
        };

        document.getElementById('btn-export-zoom-in').onclick = () => doZoom(-100);
        document.getElementById('btn-export-zoom-out').onclick = () => doZoom(100);

        document.getElementById('btn-do-export').onclick = () => this._doExport();

        const resync = () => this._renderExportPreview();
        document.getElementById('export-aspect-w').addEventListener('change', resync);
        document.getElementById('export-aspect-h').addEventListener('change', resync);
        document.getElementById('export-res').addEventListener('change', resync);
        document.getElementById('export-transparent').addEventListener('change', resync);
        document.getElementById('export-bg-color').addEventListener('input', resync);
        document.getElementById('export-road-color').addEventListener('input', resync);

        document.getElementById('export-format').addEventListener('change', (e) => {
            const transCb = document.getElementById('export-transparent');
            if (e.target.value === 'svg') {
                transCb.checked = true;
                transCb.disabled = true;
            } else {
                transCb.disabled = false;
            }
            resync();
        });

        this.exportStates = { preview: null, editor: null };
        this.exportActiveMode = 'preview';

        const getUI = () => ({
            aspectW: document.getElementById('export-aspect-w').value,
            aspectH: document.getElementById('export-aspect-h').value,
            res: document.getElementById('export-res').value,
            transparent: document.getElementById('export-transparent').checked,
            bgColor: document.getElementById('export-bg-color').value,
            roadColor: document.getElementById('export-road-color').value,
            nameColor: document.getElementById('export-name-color').value,
            infoColor: document.getElementById('export-info-color').value,
            textScale: document.getElementById('export-text-scale').value,
            textX: document.getElementById('export-text-x').value,
            textY: document.getElementById('export-text-y').value,
            legScale: document.getElementById('export-legend-scale').value,
            legX: document.getElementById('export-legend-x').value,
            legY: document.getElementById('export-legend-y').value,
            showGrid: document.getElementById('export-show-grid').checked,
            gridOpacity: document.getElementById('export-grid-opacity').value,
            layers: Array.from(document.querySelectorAll('.export-layer-cb')).map(cb => ({ id: cb.dataset.layer, checked: cb.checked })),
            previewState: { scale: this.exportPreview.userScale, ox: this.exportPreview.userOx, oy: this.exportPreview.userOy },
            editorState: this.exportCanvasRenderer ? { scale: this.exportCanvasRenderer.scale, ox: this.exportCanvasRenderer.ox, oy: this.exportCanvasRenderer.oy } : null
        });

        const setUI = (s) => {
            if (!s) return;
            if (s.aspectW) document.getElementById('export-aspect-w').value = s.aspectW;
            if (s.aspectH) document.getElementById('export-aspect-h').value = s.aspectH;
            if (s.res) document.getElementById('export-res').value = s.res;
            document.getElementById('export-transparent').checked = s.transparent;
            document.getElementById('export-bg-color').value = s.bgColor;
            document.getElementById('export-road-color').value = s.roadColor || '#000000';
            document.getElementById('export-name-color').value = s.nameColor;
            document.getElementById('export-info-color').value = s.infoColor;
            document.getElementById('export-text-scale').value = s.textScale;
            document.getElementById('export-text-x').value = s.textX;
            document.getElementById('export-text-y').value = s.textY;
            document.getElementById('export-legend-scale').value = s.legScale;
            document.getElementById('export-legend-x').value = s.legX;
            document.getElementById('export-legend-y').value = s.legY;
            document.getElementById('export-show-grid').checked = s.showGrid;
            if (s.gridOpacity !== undefined) document.getElementById('export-grid-opacity').value = s.gridOpacity;
            s.layers.forEach(l => {
                const cb = document.querySelector(`.export-layer-cb[data-layer="${l.id}"]`);
                if (cb) cb.checked = l.checked;
                this.exportPreview.layers[l.id] = l.checked;
            });
            if (s.previewState) {
                this.exportPreview.userScale = s.previewState.scale;
                this.exportPreview.userOx = s.previewState.ox;
                this.exportPreview.userOy = s.previewState.oy;
            }
            if (s.editorState) {
                this.exportCanvasRenderer.scale = s.editorState.scale;
                this.exportCanvasRenderer.ox = s.editorState.ox;
                this.exportCanvasRenderer.oy = s.editorState.oy;
            }
            syncSettings();
        };

        // Export Source Toggling
        document.querySelectorAll('input[name="export-source"]').forEach(r => {
            r.addEventListener('change', (e) => {
                if (this.exportStates && this.exportActiveMode) this.exportStates[this.exportActiveMode] = getUI();
                this.exportActiveMode = e.target.value;
                const isEditor = this.exportActiveMode === 'editor';

                document.getElementById('export-editor-controls').style.display = isEditor ? 'block' : 'none';

                if (this.exportStates[this.exportActiveMode]) {
                    setUI(this.exportStates[this.exportActiveMode]);
                } else {
                    if (isEditor) {
                        const s = getUI();
                        s.bgColor = this.renderer.C.bg;
                        setUI(s);
                    }
                }

                if (isEditor) {
                    if (!this.exportCanvasRenderer) {
                        this.exportCanvasRenderer = new F1.Renderer(c);
                        this.exportCanvasRenderer.fitToScreen(this.data);
                    }
                } else {
                    // Preview fits on change if needed, but keeping current zoom is usually better
                }
                this._renderExportPreview();
            });
        });

        // Map Layers Toggling
        document.querySelectorAll('.export-layer-cb').forEach(cb => {
            cb.addEventListener('change', e => {
                this.exportPreview.layers[e.target.dataset.layer] = e.target.checked;
                this._renderExportPreview();
            });
        });
        document.getElementById('export-show-grid').addEventListener('change', resync);

        // Text & Legend Sliders Sync
        const syncSettings = () => {
            this.exportPreview.nameColor = document.getElementById('export-name-color').value;
            this.exportPreview.infoColor = document.getElementById('export-info-color').value;
            let ts = parseFloat(document.getElementById('export-text-scale').value);
            if (isNaN(ts) || ts < 0) { ts = 0; document.getElementById('export-text-scale').value = 0; }
            let ls = parseFloat(document.getElementById('export-legend-scale').value);
            if (isNaN(ls) || ls < 0) { ls = 0; document.getElementById('export-legend-scale').value = 0; }

            this.exportPreview.textSettings = {
                scale: ts,
                x: parseInt(document.getElementById('export-text-x').value) || 0,
                y: parseInt(document.getElementById('export-text-y').value) || 0
            };
            this.exportPreview.legendSettings = {
                scale: ls,
                x: parseInt(document.getElementById('export-legend-x').value) || 0,
                y: parseInt(document.getElementById('export-legend-y').value) || 0
            };
            document.getElementById('export-grid-opacity-val').innerText = document.getElementById('export-grid-opacity').value;
            this._renderExportPreview();
        };

        document.getElementById('export-text-scale-range').addEventListener('input', e => { document.getElementById('export-text-scale').value = e.target.value; syncSettings(); });
        document.getElementById('export-text-scale').addEventListener('input', e => { document.getElementById('export-text-scale-range').value = e.target.value; syncSettings(); });
        document.getElementById('export-legend-scale-range').addEventListener('input', e => { document.getElementById('export-legend-scale').value = e.target.value; syncSettings(); });
        document.getElementById('export-legend-scale').addEventListener('input', e => { document.getElementById('export-legend-scale-range').value = e.target.value; syncSettings(); });

        ['export-text-x', 'export-text-y', 'export-legend-x', 'export-legend-y', 'export-name-color', 'export-info-color', 'export-grid-opacity'].forEach(id => {
            document.getElementById(id).addEventListener('input', syncSettings);
        });

        document.getElementById('btn-export-text-reset').onclick = () => {
            document.getElementById('export-text-scale').value = 1;
            document.getElementById('export-text-scale-range').value = 1;
            document.getElementById('export-text-x').value = 0;
            document.getElementById('export-text-y').value = 0;
            syncSettings();
        };

        document.getElementById('btn-export-legend-reset').onclick = () => {
            document.getElementById('export-legend-scale').value = 1;
            document.getElementById('export-legend-scale-range').value = 1;
            document.getElementById('export-legend-x').value = 0;
            document.getElementById('export-legend-y').value = 0;
            syncSettings();
        };

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
        document.querySelector('input[name="export-source"][value="preview"]').checked = true;
        document.getElementById('export-editor-controls').style.display = 'none';

        this.exportStates = { preview: null, editor: null };
        this.exportActiveMode = 'preview';

        // Sync layers and styles
        Object.assign(this.exportPreview.layers, this.preview.layers);
        this.exportPreview.bgColor = this.preview.bgColor;
        this.exportPreview.roadColor = this.preview.roadColor || '#000000';
        document.getElementById('export-bg-color').value = this.preview.bgColor;
        document.getElementById('export-road-color').value = this.exportPreview.roadColor;
        this.exportPreview.infoColor = this.preview.infoColor;
        this.exportPreview.nameColor = this.preview.nameColor;
        document.getElementById('export-info-color').value = this.preview.infoColor;
        document.getElementById('export-name-color').value = this.preview.nameColor;
        this.exportPreview.customNamePos = null; // Reset text position for export

        // Force checkboxes to match preview.layers
        document.querySelectorAll('.export-layer-cb').forEach(cb => {
            cb.checked = this.preview.layers[cb.dataset.layer] !== false;
        });

        this.exportPreview.fitToScreen();
        if (!this.exportCanvasRenderer) {
            this.exportCanvasRenderer = new F1.Renderer(document.getElementById('export-preview-canvas'));
        }
        this.exportCanvasRenderer.fitToScreen(this.data);

        this.exportStates = { preview: null, editor: null };

        document.getElementById('export-format').dispatchEvent(new Event('change'));
        this._renderExportPreview();
    }

    _renderExportPreview() {
        const wrap = document.getElementById('export-preview-wrapper');
        const aspectW = parseFloat(document.getElementById('export-aspect-w').value) || 16;
        const aspectH = parseFloat(document.getElementById('export-aspect-h').value) || 9;
        const aspectRatio = aspectW / aspectH;
        const W = Math.max(1, parseInt(document.getElementById('export-res').value) || 3840);
        const H = Math.max(1, Math.round(W / aspectRatio));
        const transparent = document.getElementById('export-transparent').checked;
        const bgColor = document.getElementById('export-bg-color').value;
        const isEditor = document.querySelector('input[name="export-source"]:checked').value === 'editor';

        // Fit canvas aspect ratio inside wrapper
        const wrapRatio = wrap.clientWidth / wrap.clientHeight;
        const expRatio = (W > 0 && H > 0) ? (W / H) : 1;

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

        if (isEditor) {
            if (!this.exportCanvasRenderer) this.exportCanvasRenderer = new F1.Renderer(c);
            this.exportCanvasRenderer.C.bg = transparent ? 'rgba(0,0,0,0)' : bgColor;
            this.exportCanvasRenderer.showGrid = document.getElementById('export-show-grid').checked;
            this.exportCanvasRenderer.gridOpacity = parseFloat(document.getElementById('export-grid-opacity').value);
            this.exportCanvasRenderer.layers = this.exportPreview.layers; // pass layers filter
            this.exportCanvasRenderer.render(this.data, this.editor);

            // Draw Map Texts on top of Editor View!
            if (this.exportPreview.layers.name !== false) this.exportPreview._name(c.getContext('2d'), this.data, W, H);
            if (this.exportPreview.layers.info !== false) this.exportPreview._info(c.getContext('2d'), this.data, this.editor, W, H);
            if (this.exportPreview.layers.sectorLegend !== false) this.exportPreview._sectorLegend(c.getContext('2d'), W, H);
        } else {
            // Force background override if transparent
            const oldBg = this.exportPreview.bgColor;
            this.exportPreview.bgColor = transparent ? 'rgba(0,0,0,0)' : bgColor;
            
            const oldRoad = this.exportPreview.roadColor;
            this.exportPreview.roadColor = document.getElementById('export-road-color').value;

            this.exportPreview.render(this.data, this.editor);

            // Restore
            this.exportPreview.bgColor = oldBg;
            this.exportPreview.roadColor = oldRoad;
        }
    }

    async _doExport() {
        const fmt = document.getElementById('export-format').value;
        const aspectW = parseFloat(document.getElementById('export-aspect-w').value) || 16;
        const aspectH = parseFloat(document.getElementById('export-aspect-h').value) || 9;
        const aspectRatio = aspectW / aspectH;
        const W = parseInt(document.getElementById('export-res').value) || 3840;
        const H = Math.round(W / aspectRatio);
        const transparent = document.getElementById('export-transparent').checked;
        const isEditor = document.querySelector('input[name="export-source"]:checked').value === 'editor';
        const name = (this.data.name || 'circuit').replace(/[^a-z0-9]/gi, '_').toLowerCase();

        if (fmt === 'svg') {
            if (isEditor) {
                alert('SVG format is only supported for Map View. Please select PNG or JPEG from the format dropdown for the Editor View.');
                return;
            }
            try {
                const uiBg = transparent ? 'rgba(0,0,0,0)' : document.getElementById('export-bg-color').value;
                const uiRoad = document.getElementById('export-road-color').value;
                const exporter = new F1.SVGExporter(uiBg, this.exportPreview.infoColor, this.exportPreview.nameColor, uiRoad);
                Object.assign(exporter.layers, this.exportPreview.layers);
                const svgStr = await exporter.export(this.data, this.editor, W, H, transparent, this.exportPreview.textSettings, this.exportPreview.legendSettings);
                const blob = new Blob([svgStr], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `${name}.svg`; a.click();
                URL.revokeObjectURL(url);
                this.setStatus(`Exported ${name}.svg`);
            } catch (e) {
                console.error(e);
                alert('SVG Export Failed: ' + e.message);
            }
        } else {
            try {
                // Render full res to canvas
                const c = document.createElement('canvas'); c.width = W; c.height = H;

                if (isEditor) {
                    const cr = new F1.Renderer(c);
                    const bgColor = document.getElementById('export-bg-color').value;
                    cr.C.bg = transparent && fmt !== 'jpg' ? 'rgba(0,0,0,0)' : bgColor;
                    cr.showGrid = document.getElementById('export-show-grid').checked;
                    cr.gridOpacity = parseFloat(document.getElementById('export-grid-opacity').value);
                    const ratio = W / this.exportCanvasRenderer.canvas.width;
                    cr.scale = this.exportCanvasRenderer.scale * ratio;
                    cr.ox = this.exportCanvasRenderer.ox;
                    cr.oy = this.exportCanvasRenderer.oy;
                    cr.layers = this.exportPreview.layers;
                    cr.render(this.data, this.editor);

                    // Draw Map Texts on top of Editor View!
                    if (this.exportPreview.layers.name !== false) {
                        const ctx2d = c.getContext('2d');
                        ctx2d.save();
                        ctx2d.scale(ratio, ratio);
                        this.exportPreview._name(ctx2d, this.data, W / ratio, H / ratio);
                        ctx2d.restore();
                    }
                    if (this.exportPreview.layers.info !== false) {
                        const ctx2d = c.getContext('2d');
                        ctx2d.save();
                        ctx2d.scale(ratio, ratio);
                        this.exportPreview._info(ctx2d, this.data, this.editor, W / ratio, H / ratio);
                        ctx2d.restore();
                    }
                } else {
                    const pr = new F1.PreviewRenderer(c);
                    Object.assign(pr.layers, this.exportPreview.layers);
                    const bgColor = document.getElementById('export-bg-color').value;
                    pr.bgColor = transparent && fmt !== 'jpg' ? 'rgba(0,0,0,0)' : bgColor;
                    pr.infoColor = this.exportPreview.infoColor;
                    pr.nameColor = this.exportPreview.nameColor;
                    pr.roadColor = document.getElementById('export-road-color').value;

                    const ratio = W / this.exportPreview.canvas.width;
                    pr.userScale = this.exportPreview.userScale * ratio;
                    pr.userOx = this.exportPreview.userOx;
                    pr.userOy = this.exportPreview.userOy;

                    pr.textSettings = this.exportPreview.textSettings;
                    pr.legendSettings = this.exportPreview.legendSettings;
                    pr.exportRatio = ratio;

                    pr.render(this.data, this.editor);
                }

                const mime = fmt === 'jpg' ? 'image/jpeg' : 'image/png';
                const url = c.toDataURL(mime, 0.95);
                const a = document.createElement('a'); a.href = url; a.download = `${name}.${fmt}`; a.click();
                this.setStatus(`Exported ${name}.${fmt}`);
            } catch (e) {
                console.error(e);
                alert('Export Failed: ' + e.message);
            }
        }

        document.getElementById('export-modal').style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => { window.app = new F1.App(); });

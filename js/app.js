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
        this.uiManager = new F1.UIManager(this);
        
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
        
        this._renderProjectTabs();
        const nameInput = document.getElementById('circuit-name');
        if (nameInput) nameInput.value = this.data.name || '';
        
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
        });pCanvas.addEventListener('mouseleave', () => { isPreviewPanning = false; pCanvas.style.cursor = 'default'; });
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
            if (e.ctrlKey || e.metaKey) {
                const key = e.key.toLowerCase();
                if (key === 'm') { e.preventDefault(); this._renderPreview(); return; }
                if (key === 's') { e.preventDefault(); document.getElementById('btn-save').click(); return; }
                if (key === 'o') { e.preventDefault(); document.getElementById('btn-load').click(); return; }
                if (key === 'i') { e.preventDefault(); document.getElementById('btn-download-map').click(); return; }
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
            const sc = { s: 'select', p: 'pitlane', d: 'draw', r: 'surface', n: 'node', w: 'width', b: 'barrier', '1': 'sector', z: 'zone', m: 'straightMode', e: 'eraser', t: 'turn', '#': 'scale', '3': 'scale' };
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
                    return '#' + v[1]+v[1] + v[2]+v[2] + v[3]+v[3];
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
        document.getElementById('btn-download-map').addEventListener('click', () => {
            this._openExportModal();
        });
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

    async _doExport() {
        const fmt = document.getElementById('export-format').value;
        const W = parseInt(document.getElementById('export-w').value) || 1920;
        const H = parseInt(document.getElementById('export-h').value) || 1080;
        const transparent = document.getElementById('export-transparent').checked;
        const name = (this.data.name || 'circuit').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        if (fmt === 'svg') {
            const exporter = new F1.SVGExporter(this.preview.bgColor, this.preview.infoColor, this.preview.nameColor);
            const svgStr = await exporter.export(this.data, this.editor, W, H, transparent, this.exportPreview.customNamePos);
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

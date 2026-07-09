/* ============================================================
   3d-editor.js — WebGL 3D Viewport
   ============================================================ */
window.F1 = window.F1 || {};

F1.Editor3D = class Editor3D {
    constructor(canvas, app, textureType) {
        this.canvas = canvas;
        this.app = app;
        this.textureType = textureType || 'preview';

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#0a0d0a');

        this.camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 10000);
        this.camera.position.set(0, 100, 200);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Lighting
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        hemiLight.position.set(0, 200, 0);
        this.scene.add(hemiLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(0, 200, 100);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        // Ground plane (massive to appear infinite)
        const gridHelper = new THREE.GridHelper(100000, 2000, 0x444444, 0x222222);
        gridHelper.position.y = -0.5; // Slightly below 0 to avoid z-fighting with the track
        this.scene.add(gridHelper);

        // Controls (SolidWorks style via TrackballControls)
        this.controls = new THREE.TrackballControls(this.camera, this.renderer.domElement);
        this.controls.rotateSpeed = 2.0;
        this.controls.zoomSpeed = 1.5;
        this.controls.panSpeed = 1.0;
        this.controls.noZoom = true; // Disabled default to use custom cursor zoom
        this.controls.noPan = false;
        this.controls.staticMoving = true;
        this.controls.dynamicDampingFactor = 0.3;
        this.controls.keys = [65, 83, 68]; // a:rotate, s:zoom, d:pan

        // SolidWorks mappings (user requested Left=Pan, Middle=Zoom, Right=Rotate)
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.ZOOM,
            RIGHT: THREE.MOUSE.ROTATE
        };

        // Custom Zoom to Cursor (replaces TrackballControls default zoom)
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (this.textureType === 'preview' && !this.app.is3DPreview) return;
            if (this.textureType === 'editor' && !this.app.isEditor3D) return;
            if (this.canvas.parentElement && !this.canvas.parentElement.matches(':hover')) return;

            const rect = this.canvas.getBoundingClientRect();
            const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
            const targetVec = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.plane, targetVec)) {
                // Match 2D canvas zoom speeds exactly
                const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;

                // Prevent zooming too far out or too close
                const dist = this.camera.position.distanceTo(targetVec);
                if ((zoomFactor < 1 && dist < 10) || (zoomFactor > 1 && dist > 20000)) return;

                const dirCam = new THREE.Vector3().subVectors(this.camera.position, targetVec);
                this.camera.position.copy(targetVec).add(dirCam.multiplyScalar(zoomFactor));

                const dirTarget = new THREE.Vector3().subVectors(this.controls.target, targetVec);
                this.controls.target.copy(targetVec).add(dirTarget.multiplyScalar(zoomFactor));

                this.camera.updateProjectionMatrix();
                this.controls.update();
            }
        }, { passive: false });

        // Prevent context menu on right click
        this.renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

        // No longer tied to app.requestRender for change, we'll run our own loop

        this.raycaster = new THREE.Raycaster();
        this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        this.trackGroup = new THREE.Group();
        this.scene.add(this.trackGroup);
        this.nodeMeshes = [];
        this._lastData = null;
        this._lastHover = null;
        this._lastSel = null;

        this.nodeMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x004422, polygonOffset: true, polygonOffsetFactor: -20, polygonOffsetUnits: -20 });
        this.selNodeMat = new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xff4400, polygonOffset: true, polygonOffsetFactor: -20, polygonOffsetUnits: -20 });
        this.hoverNodeMat = new THREE.MeshStandardMaterial({ color: 0x66ffbb, emissive: 0x338855, polygonOffset: true, polygonOffsetFactor: -20, polygonOffsetUnits: -20 });

        this.resize();

        // Raycasting for hover
        this.canvas.addEventListener('pointermove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);

            const intersects = this.raycaster.intersectObjects(this.nodeMeshes);
            if (intersects.length > 0) {
                const nodeMesh = intersects[0].object;
                if (this.app.hoverPoint !== nodeMesh.userData.node) {
                    this.app.hoverPoint = nodeMesh.userData.node;
                    this.hoverType = nodeMesh.userData.type;
                    this.canvas.style.cursor = 'pointer';
                    this.updateNodeMaterials();
                }
            } else {
                if (this.app.hoverPoint !== null) {
                    this.app.hoverPoint = null;
                    this.hoverType = null;
                    this.canvas.style.cursor = 'default';
                    this.updateNodeMaterials();
                }
            }
        });

        // Raycasting for selection
        this.canvas.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return; // Only left click
            if (this.app.hoverPoint) {
                this.app.setSelection({ type: this.hoverType || 'cp', id: this.app.hoverPoint.id });
                this.updateNodeMaterials();
            }
        }, { capture: true });

        // Setup Keyboard shortcuts and UI buttons for camera presets
        const setView = (view) => this.setCameraView(view);

        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'TEXTAREA') return;
            if (e.target.tagName === 'INPUT' && ['text', 'number', 'password', 'search'].includes(e.target.type)) return;

            if (this.textureType === 'preview' && !this.app.is3DPreview) return;
            if (this.textureType === 'editor' && !this.app.isEditor3D) return;

            // Only respond if the mouse is hovering over this specific canvas's container OR if it was the last hovered container
            if (this.app.hoveredCanvas !== this.textureType) return;

            if (e.key === '1') { e.preventDefault(); setView('top'); }
            if (e.key === '2') { e.preventDefault(); setView('side'); }
            if (e.key === '3') { e.preventDefault(); setView('front'); }
            if (e.key === '4') { e.preventDefault(); setView('iso'); }
        });

        const controlsId = this.textureType === 'preview' ? 'view-3d-controls' : 'view-3d-controls-editor';
        document.querySelectorAll(`#${controlsId} .prop-btn`).forEach(btn => {
            btn.addEventListener('click', () => {
                setView(btn.dataset.view);
            });
        });

        // Self-contained animation loop for TrackballControls damping
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    animate() {
        requestAnimationFrame(this.animate);
        if ((this.textureType === 'preview' && this.app.is3DPreview) ||
            (this.textureType === 'editor' && this.app.isEditor3D)) {
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        }
    }

    setCameraView(view) {
        const dist = this.controls.target.distanceTo(this.camera.position);
        if (view === 'top') {
            this.camera.position.set(this.controls.target.x, dist, this.controls.target.z);
            this.camera.up.set(0, 0, -1);
            this.camera.lookAt(this.controls.target);
        } else if (view === 'side') {
            this.camera.position.set(this.controls.target.x + dist, 20, this.controls.target.z);
            this.camera.up.set(0, 1, 0);
            this.camera.lookAt(this.controls.target);
        } else if (view === 'front') {
            this.camera.position.set(this.controls.target.x, 20, this.controls.target.z + dist);
            this.camera.up.set(0, 1, 0);
            this.camera.lookAt(this.controls.target);
        } else if (view === 'iso') {
            this.camera.position.set(this.controls.target.x + dist * 0.7, dist * 0.7, this.controls.target.z + dist * 0.7);
            this.camera.up.set(0, 1, 0);
            this.camera.lookAt(this.controls.target);
        }

        // TrackballControls needs to update its internal state
        this.camera.updateProjectionMatrix();
        this.controls.update();
    }

    resize() {
        if (!this.canvas.parentElement) return;
        const w = this.canvas.parentElement.clientWidth;
        const h = this.canvas.parentElement.clientHeight;
        if (w === 0 || h === 0) return;
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.controls.handleResize();
        this.controls.update();
    }

    w2s(wx, wy) {
        const pt = new THREE.Vector3(wx, 0, wy);
        pt.project(this.camera);
        return {
            x: (pt.x * .5 + .5) * this.canvas.width,
            y: (pt.y * -.5 + .5) * this.canvas.height
        };
    }

    s2w(sx, sy) {
        const ndcX = (sx / this.canvas.width) * 2 - 1;
        const ndcY = -(sy / this.canvas.height) * 2 + 1;
        this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
        const target = new THREE.Vector3();
        const intersect = this.raycaster.ray.intersectPlane(this.plane, target);
        if (intersect) {
            return { x: target.x, y: target.z };
        }
        return { x: 0, y: 0 };
    }

    zoom(d, sx, sy) {
        const zoomFactor = d > 0 ? 1.1 : 0.9;
        const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
        this.camera.position.copy(this.controls.target).add(dir.multiplyScalar(zoomFactor));
        this.controls.update();
    }

    pan(dx, dy) {
        // Handled by TrackballControls internally
    }

    fitToScreen(data) {
        if (!data || data.controlPoints.length === 0) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of data.controlPoints) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const w = Math.max(100, maxX - minX);

        this.controls.target.set(cx, 0, cy);
        this.camera.position.set(cx, w * 1.5, cy + w * 0.5);
        this.camera.up.set(0, 1, 0);
        this.controls.update();
    }

    render(data, editor, sel, hoverPt, activeTool) {
        this._lastData = data;
        this._lastSel = sel;
        this._lastHover = hoverPt;
        this.rebuildTrack(editor, sel, hoverPt);
        this.renderer.render(this.scene, this.camera);
    }

    rebuildTrack(editor, sel, hoverPt) {
        const track = editor.getInterpolatedTrack();

        // Remove old track elements
        while (this.trackGroup.children.length > 0) {
            const child = this.trackGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
            this.trackGroup.remove(child);
        }

        if (track.length < 2) return;

        // Generate 2D Texture from offscreen canvas to get colors, runoffs, and flags
        const TEX_SIZE = Math.min(4096, this.renderer.capabilities.maxTextureSize);
        const texCanvas = document.createElement('canvas');
        texCanvas.width = TEX_SIZE; texCanvas.height = TEX_SIZE;
        const texCanvasBot = document.createElement('canvas');
        texCanvasBot.width = TEX_SIZE; texCanvasBot.height = TEX_SIZE;
        const data = this.app.data;
        let s2wFn = null;

        const scaleFact = (data.gridSize || 50) / 50.0;

        const oldZones = data.zones;
        const oldLabels = data.sectorLabels;
        const oldTurns = data.turnMarkers;
        data.zones = []; data.sectorLabels = []; data.turnMarkers = [];

        if (this.textureType === 'preview') {
            const renderer2d = new F1.PreviewRenderer(texCanvas);
            renderer2d.layers.sectors = false;
            renderer2d.layers.turnNumbers = false;
            renderer2d.layers.zones = false;
            renderer2d.layers.straightMode = false;
            renderer2d.layers.name = false;
            renderer2d.layers.info = false;
            renderer2d.layers.sectorLegend = false;
            renderer2d.layers.garages = false;
            renderer2d.isFor3DTexture = true;
            renderer2d.fitToScreen();
            renderer2d.render(data, editor);

            const renderer2dBot = new F1.PreviewRenderer(texCanvasBot);
            renderer2dBot.layers.sectors = false;
            renderer2dBot.layers.turnNumbers = false;
            renderer2dBot.layers.zones = false;
            renderer2dBot.layers.straightMode = false;
            renderer2dBot.layers.name = false;
            renderer2dBot.layers.info = false;
            renderer2dBot.layers.sectorLegend = false;
            renderer2dBot.layers.garages = false;
            renderer2dBot.isFor3DTexture = true;
            renderer2dBot.isFor3DTextureBottom = true;
            renderer2dBot.fitToScreen();
            renderer2dBot.render(data, editor);

            s2wFn = (wx, wy) => {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const p of track) { const ex = Math.max(p.widthLeft, p.widthRight) + 35; minX = Math.min(minX, p.x - ex); maxX = Math.max(maxX, p.x + ex); minY = Math.min(minY, p.y - ex); maxY = Math.max(maxY, p.y + ex); }
                for (const p of data.pitLane.points) { minX = Math.min(minX, p.x - 25); maxX = Math.max(maxX, p.x + 25); minY = Math.min(minY, p.y - 25); maxY = Math.max(maxY, p.y + 25); }
                const margin = Math.min(80, TEX_SIZE / 3, TEX_SIZE / 3);
                const scaleX = Math.max(0.001, (TEX_SIZE - margin * 2) / (maxX - minX || 1));
                const scaleY = Math.max(0.001, (TEX_SIZE - margin * 2) / (maxY - minY || 1));
                const scale = Math.min(scaleX, scaleY);
                const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
                return {
                    x: wx * scale + TEX_SIZE / 2 - cx * scale,
                    y: wy * scale + TEX_SIZE / 2 - cy * scale
                };
            };
        } else {
            const renderer2d = new F1.Renderer(texCanvas);
            renderer2d.showGrid = false;
            renderer2d.showCtrlPts = false;
            renderer2d.hideBarriers = true;
            renderer2d.fitToScreen(data);
            renderer2d.render(data, editor, null, null, null);

            const renderer2dBot = new F1.Renderer(texCanvasBot);
            renderer2dBot.showGrid = false;
            renderer2dBot.showCtrlPts = false;
            renderer2dBot.hideBarriers = true;
            renderer2dBot.isFor3DTextureBottom = true;
            renderer2dBot.fitToScreen(data);
            renderer2dBot.render(data, editor, null, null, null);

            s2wFn = (x, z) => renderer2d.w2s(x, z);
        }

        data.zones = oldZones; data.sectorLabels = oldLabels; data.turnMarkers = oldTurns;

        const texture = new THREE.CanvasTexture(texCanvas);
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        texture.generateMipmaps = true;

        const textureBot = new THREE.CanvasTexture(texCanvasBot);
        textureBot.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        textureBot.generateMipmaps = true;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of track) {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
        const width = Math.max(1500, (maxX - minX) + 1200);
        const height = Math.max(1500, (maxY - minY) + 1200);

        // Generate a simple procedural grass texture using canvas
        const grassTexCanvas = document.createElement('canvas');
        grassTexCanvas.width = 512; grassTexCanvas.height = 512;
        const gctx = grassTexCanvas.getContext('2d');
        gctx.fillStyle = '#1e3d1e'; gctx.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 5000; i++) {
            gctx.fillStyle = Math.random() > 0.5 ? '#1a331a' : '#234723';
            gctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
        }
        const grassTex = new THREE.CanvasTexture(grassTexCanvas);
        grassTex.wrapS = THREE.RepeatWrapping;
        grassTex.wrapT = THREE.RepeatWrapping;
        grassTex.repeat.set(width / 50, height / 50);

        // Draw track mesh covering road + runoffs
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const uvs = [];
        const getBanked = (p, w, isLeft) => {
            const B = (p.banking || 0) * Math.PI / 180;
            const w_h = w * Math.cos(B);
            const w_v = w * Math.sin(B);
            const sgn = isLeft ? -1 : 1;
            return { x: p.x + p.nx * w_h * sgn, z: p.y + p.ny * w_h * sgn, y: ((p.z || 0) / scaleFact) + w_v * -sgn };
        };

        for (let i = 0; i < track.length; i++) {
            const p = track[i];
            let wL = p.widthLeft;
            let wR = p.widthRight;
            if (this.textureType === 'editor') {
                wL += (p.surfaceWidthLeft ?? 15) + (p.barrierLeft ? 5 : 0);
                wR += (p.surfaceWidthRight ?? 15) + (p.barrierRight ? 5 : 0);
            } else {
                wL = 20; wR = 20;
            }

            const bL = getBanked(p, wL, true);
            const bR = getBanked(p, wR, false);

            const p1x = bL.x, p1y = bL.y, p1z = bL.z;
            const p2x = bR.x, p2y = bR.y, p2z = bR.z;

            vertices.push(p1x, p1y, p1z);
            vertices.push(p2x, p2y, p2z);

            const s1 = s2wFn(p1x, p1z);
            const s2 = s2wFn(p2x, p2z);

            uvs.push(s1.x / TEX_SIZE, 1.0 - (s1.y / TEX_SIZE));
            uvs.push(s2.x / TEX_SIZE, 1.0 - (s2.y / TEX_SIZE));
        }

        const topBridgeIndices = new Set();
        if (this.app.intersections) {
            this.app.intersections.forEach(ix => {
                let isBridged = false;
                const key = ix.key;
                const legacyKey = `${ix.cpA}-${ix.cpB}`;
                if (data.bridges) {
                    if (data.bridges[key] || data.bridges[legacyKey]) {
                        isBridged = true;
                    } else {
                        const idA = data.controlPoints[ix.cpA]?.id;
                        const idB = data.controlPoints[ix.cpB]?.id;
                        for (const bKey in data.bridges) {
                            const bNodes = data.bridges[bKey];
                            if (bNodes && (bNodes.includes(idA) || bNodes.includes(idB))) {
                                isBridged = true;
                                break;
                            }
                        }
                    }
                }
                if (!isBridged) return; // Only ignore terrain and use bridge material if actually bridged

                const inverted = data.overlapInversions && (data.overlapInversions.includes(key) || data.overlapInversions.includes(legacyKey));
                let topIdx = inverted ? Math.min(ix.trackIdxA, ix.trackIdxB) : Math.max(ix.trackIdxA, ix.trackIdxB);

                // Override with physical elevation if present
                const zA = track[ix.trackIdxA].z || 0;
                const zB = track[ix.trackIdxB].z || 0;
                if (Math.abs(zA - zB) > 2) {
                    topIdx = zA > zB ? ix.trackIdxA : ix.trackIdxB;
                }

                const ptA = track[ix.trackIdxA];
                const ptA1 = track[Math.min(ix.trackIdxA + 1, track.length - 1)];
                const ptB = track[ix.trackIdxB];
                const ptB1 = track[Math.min(ix.trackIdxB + 1, track.length - 1)];
                if (!ptA || !ptA1 || !ptB || !ptB1) return;
                
                const dx1 = ptA1.x - ptA.x, dy1 = ptA1.y - ptA.y;
                const dx2 = ptB1.x - ptB.x, dy2 = ptB1.y - ptB.y;
                const len1 = Math.hypot(dx1, dy1) || 1, len2 = Math.hypot(dx2, dy2) || 1;
                const dot = (dx1 * dx2 + dy1 * dy2) / (len1 * len2);
                let angle = Math.acos(Math.max(-1, Math.min(1, Math.abs(dot))));
                if (angle < 0.1) angle = 0.1;

                const botPt = track[topIdx === ix.trackIdxA ? ix.trackIdxB : ix.trackIdxA];
                const botW = Math.max(
                    botPt.widthLeft + (botPt.surfaceWidthLeft || 10) + (botPt.barrierLeft ? 5 : 0),
                    botPt.widthRight + (botPt.surfaceWidthRight || 10) + (botPt.barrierRight ? 5 : 0)
                );
                // Expand clearance to guarantee bridge points fall inside topBridgeIndices
                let targetDist = (botW / Math.sin(angle)) + 30;

                let maxSteps = track.length;
                let start = topIdx, d1 = 0;
                for (let steps = 0; steps < maxSteps; steps++) {
                    let prev = start - 1;
                    if (prev < 0) { if (!data.isClosed) break; prev += track.length; }
                    d1 += Math.hypot(track[start].x - track[prev].x, track[start].y - track[prev].y);
                    start = prev;
                    if (d1 >= targetDist) break;
                }
                let end = topIdx, d2 = 0;
                for (let steps = 0; steps < maxSteps; steps++) {
                    let next = end + 1;
                    if (next >= track.length) { if (!data.isClosed) break; next -= track.length; }
                    d2 += Math.hypot(track[next].x - track[end].x, track[next].y - track[end].y);
                    end = next;
                    if (d2 >= targetDist) break;
                }
                
                if (data.isClosed && start > end) {
                    for (let i = start; i < track.length; i++) topBridgeIndices.add(i);
                    for (let i = 0; i <= end; i++) topBridgeIndices.add(i);
                } else {
                    for (let i = start; i <= end; i++) topBridgeIndices.add(i);
                }
            });
        }

        const baseIndices = [];
        const bridgeIndices = [];
        for (let i = 0; i < track.length - 1; i++) {
            const row1 = i * 2;
            const row2 = (i + 1) * 2;
            if (topBridgeIndices.has(i) && topBridgeIndices.has(i + 1)) {
                bridgeIndices.push(row1, row2, row1 + 1);
                bridgeIndices.push(row1 + 1, row2, row2 + 1);
            } else {
                baseIndices.push(row1, row2, row1 + 1);
                baseIndices.push(row1 + 1, row2, row2 + 1);
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex([...baseIndices, ...bridgeIndices]);
        geometry.addGroup(0, baseIndices.length, 0);
        if (bridgeIndices.length > 0) {
            geometry.addGroup(baseIndices.length, bridgeIndices.length, 1);
        }
        geometry.computeVertexNormals();

        const materials = [
            new THREE.MeshBasicMaterial({
                map: textureBot,
                side: THREE.DoubleSide,
                transparent: true,
                polygonOffset: true,
                polygonOffsetFactor: -10,
                polygonOffsetUnits: -10
            }),
            new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                polygonOffset: true,
                polygonOffsetFactor: -10,
                polygonOffsetUnits: -10
            })
        ];
        const mesh = new THREE.Mesh(geometry, materials);
        mesh.position.y = 0.1; // Place slightly above the grid to avoid clipping
        this.trackGroup.add(mesh);

        // 2b. Build Track Skirt (Sidewalls to hide empty space beneath banked track)
        const skirtGeo = new THREE.BufferGeometry();
        const skirtVerts = [];
        const skirtIndices = [];
        const skirtUvs = [];
        let sIdx = 0;
        const skirtDepth = 40.0; // Drop 40 units deep to thoroughly cover high banking

        // Bridge indices are already computed above

        for (let i = 0; i < track.length - 1; i++) {
            const isBridge = topBridgeIndices.has(i) && topBridgeIndices.has(i + 1);
            const p1 = track[i];
            const p2 = track[i + 1];

            let wL1 = p1.widthLeft; let wL2 = p2.widthLeft;
            let wR1 = p1.widthRight; let wR2 = p2.widthRight;
            if (this.textureType === 'editor') {
                wL1 += (p1.surfaceWidthLeft ?? 15) + (p1.barrierLeft ? 5 : 0);
                wL2 += (p2.surfaceWidthLeft ?? 15) + (p2.barrierLeft ? 5 : 0);
                wR1 += (p1.surfaceWidthRight ?? 15) + (p1.barrierRight ? 5 : 0);
                wR2 += (p2.surfaceWidthRight ?? 15) + (p2.barrierRight ? 5 : 0);
            } else {
                wL1 = 20; wL2 = 20; wR1 = 20; wR2 = 20;
            }

            const bL1 = getBanked(p1, wL1, true);
            const bL2 = getBanked(p2, wL2, true);

            const depth1 = topBridgeIndices.has(i) ? 1.5 : skirtDepth;
            const depth2 = topBridgeIndices.has(i + 1) ? 1.5 : skirtDepth;

            // Left skirt
            skirtVerts.push(bL1.x, bL1.y, bL1.z, bL1.x, bL1.y - depth1, bL1.z, bL2.x, bL2.y, bL2.z, bL2.x, bL2.y - depth2, bL2.z);
            skirtIndices.push(sIdx, sIdx + 1, sIdx + 2, sIdx + 1, sIdx + 3, sIdx + 2);
            skirtUvs.push(bL1.x / width, bL1.y / height, bL1.x / width, (bL1.y - depth1) / height, bL2.x / width, bL2.y / height, bL2.x / width, (bL2.y - depth2) / height);
            sIdx += 4;

            const bR1 = getBanked(p1, wR1, false);
            const bR2 = getBanked(p2, wR2, false);

            // Right skirt
            skirtVerts.push(bR1.x, bR1.y, bR1.z, bR1.x, bR1.y - depth1, bR1.z, bR2.x, bR2.y, bR2.z, bR2.x, bR2.y - depth2, bR2.z);
            skirtIndices.push(sIdx, sIdx + 2, sIdx + 1, sIdx + 1, sIdx + 2, sIdx + 3);
            skirtUvs.push(bR1.x / width, bR1.y / height, bR1.x / width, (bR1.y - depth1) / height, bR2.x / width, bR2.y / height, bR2.x / width, (bR2.y - depth2) / height);
            sIdx += 4;
        }

        skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(skirtVerts, 3));
        skirtGeo.setAttribute('uv', new THREE.Float32BufferAttribute(skirtUvs, 2));
        skirtGeo.setIndex(skirtIndices);
        skirtGeo.computeVertexNormals();
        const skirtMat = new THREE.MeshLambertMaterial({ map: grassTex, side: THREE.DoubleSide });
        const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
        skirtMesh.position.y = 0.1;
        this.trackGroup.add(skirtMesh);

        // 3D Barriers
        const barrierGeo = new THREE.BufferGeometry();
        const bVerts = [];
        const bIndices = [];
        let bIdx = 0;
        const bHeight = 8.0;

        for (let i = 0; i < track.length - 1; i++) {
            const p1 = track[i];
            const p2 = track[i + 1];

            // Left barrier
            if (p1.barrierLeft && p2.barrierLeft) {
                let w1 = p1.widthLeft + (p1.surfaceWidthLeft ?? 10) + 1.0;
                let w2 = p2.widthLeft + (p2.surfaceWidthLeft ?? 10) + 1.0;
                const b1 = getBanked(p1, w1, true);
                const b2 = getBanked(p2, w2, true);
                bVerts.push(b1.x, b1.y, b1.z, b1.x, b1.y + bHeight, b1.z, b2.x, b2.y, b2.z, b2.x, b2.y + bHeight, b2.z);
                bIndices.push(bIdx, bIdx + 2, bIdx + 1, bIdx + 1, bIdx + 2, bIdx + 3);
                bIdx += 4;
            }

            // Right barrier
            if (p1.barrierRight && p2.barrierRight) {
                let w1 = p1.widthRight + (p1.surfaceWidthRight ?? 10) + 1.0;
                let w2 = p2.widthRight + (p2.surfaceWidthRight ?? 10) + 1.0;
                const b1 = getBanked(p1, w1, false);
                const b2 = getBanked(p2, w2, false);
                bVerts.push(b1.x, b1.y, b1.z, b1.x, b1.y + bHeight, b1.z, b2.x, b2.y, b2.z, b2.x, b2.y + bHeight, b2.z);
                // Reverse winding order for right side so it faces track
                bIndices.push(bIdx, bIdx + 1, bIdx + 2, bIdx + 1, bIdx + 3, bIdx + 2);
                bIdx += 4;
            }
        }

        if (bVerts.length > 0) {
            barrierGeo.setAttribute('position', new THREE.Float32BufferAttribute(bVerts, 3));
            barrierGeo.setIndex(bIndices);
            barrierGeo.computeVertexNormals();
            const barrierMat = new THREE.MeshLambertMaterial({ color: 0xcc0000, side: THREE.DoubleSide });
            const barrierMesh = new THREE.Mesh(barrierGeo, barrierMat);
            barrierMesh.position.y = 0.1;
            this.trackGroup.add(barrierMesh);
        }

        // Procedural Terrain
        if (data.controlPoints.length > 0) {
            const segments = 250;
            const terrainGeo = new THREE.PlaneGeometry(width, height, segments, segments);
            terrainGeo.rotateX(-Math.PI / 2); // Lay flat

            const posAttr = terrainGeo.attributes.position;
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;
            terrainGeo.translate(cx, 0, cy);

            for (let i = 0; i < posAttr.count; i++) {
                const vx = posAttr.getX(i);
                const vz = posAttr.getZ(i);

                let minDist = Infinity;
                let nearestZ = 0;
                let nearestTrackPt = null;
                let totalWeight = 0;
                let weightedZ = 0;

                // Inverse Distance Weighting for smooth terrain bridging
                for (let j = 0; j < track.length; j++) {
                    if (topBridgeIndices.has(j)) continue; // Ignore bridge segments so terrain stays flat/follows lower track
                    const p = track[j];
                    const d = Math.hypot(vx - p.x, vz - p.y);
                    if (d < minDist) {
                        minDist = d;
                        nearestZ = (p.z || 0) / scaleFact;
                        nearestTrackPt = p;
                    }

                    if (d < 400) {
                        const w = 1 / Math.pow(d + 1, 3);
                        weightedZ += ((p.z || 0) / scaleFact) * w;
                        totalWeight += w;
                    }
                }

                let baseZ = 0;
                if (totalWeight > 0) baseZ = weightedZ / totalWeight;

                // Calculate the exact physical width of the track+runoff+barrier at this specific point
                let maxW = 25; // Safe default
                let lW = 12, rW = 12, lat_dist = 0;
                if (nearestTrackPt) {
                    lW = nearestTrackPt.widthLeft + (nearestTrackPt.surfaceWidthLeft ?? 15) + (nearestTrackPt.barrierLeft ? 5 : 0);
                    rW = nearestTrackPt.widthRight + (nearestTrackPt.surfaceWidthRight ?? 15) + (nearestTrackPt.barrierRight ? 5 : 0);
                    maxW = Math.max(lW, rW) + 5; // Add 5 units padding

                    // Calculate the exact banked height of the track surface at this terrain vertex
                    const dx = vx - nearestTrackPt.x;
                    const dz = vz - nearestTrackPt.y;
                    lat_dist = dx * nearestTrackPt.nx + dz * nearestTrackPt.ny;

                    // Clamp lateral distance so the banking elevation effect doesn't grow infinitely into the distance
                    const clamped_lat = Math.max(-lW - 5, Math.min(rW + 5, lat_dist));
                    const bankOffset = -clamped_lat * Math.tan((nearestTrackPt.banking || 0) * Math.PI / 180);

                    nearestZ = ((nearestTrackPt.z || 0) / scaleFact) + bankOffset;
                }

                // Force the terrain to perfectly match the local track height when underneath it
                if (minDist < maxW + 25) {
                    baseZ = nearestZ;
                } else if (minDist < maxW + 125) {
                    // Smoothly blend from exact local height to the smoothed IDW height
                    const t = (minDist - (maxW + 25)) / 100;
                    baseZ = nearestZ * (1 - t) + baseZ * t;
                }

                // Create a guaranteed flat plateau near the road
                let falloff = 1.0;
                if (minDist > maxW + 25) {
                    let t = 1.0 - Math.min(1.0, (minDist - (maxW + 25)) / 350);
                    falloff = t * t * (3 - 2 * t);
                }

                // Extreme internal trench to physically prevent clipping at high zoom levels
                let trenchOffset = 0;
                if (nearestTrackPt) {
                    const currentW = lat_dist < 0 ? lW : rW;
                    // Start digging down exactly 2 units inside the physical edge
                    if (Math.abs(lat_dist) < currentW - 2) {
                        trenchOffset = -15 * (1 - (Math.abs(lat_dist) / (currentW - 2)));
                    }
                }

                // Make it perfectly flush at the exact edge, but hollow underneath
                posAttr.setY(i, (baseZ * falloff) + trenchOffset);
            }
            terrainGeo.computeVertexNormals();

            const terrainMat = new THREE.MeshLambertMaterial({ map: grassTex, side: THREE.DoubleSide });
            const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
            this.trackGroup.add(terrainMesh);
        }

        // 3D Grandstands
        for (const zone of data.zones) {
            if (zone.type === 'grandstand') {
                const p = editor.getZoneWorldPos(zone);
                if (!p) continue;

                // Get nearest track Z
                let nearestZ = 0;
                let minDist = Infinity;
                for (let j = 0; j < track.length; j += 4) {
                    const pt = track[j];
                    const d = Math.hypot(p.x - pt.x, p.y - pt.y);
                    if (d < minDist) { minDist = d; nearestZ = (pt.z || 0) / scaleFact; }
                }

                const w = (zone.length || 50) / scaleFact;
                const h = (zone.height || 16) / scaleFact;
                const d = 20 / scaleFact; // depth

                const gsGroup = new THREE.Group();
                gsGroup.position.set(p.x, nearestZ, p.y);

                const rad = -(zone.rotation || 0) * Math.PI / 180;
                gsGroup.rotation.y = rad;

                const steps = 4;
                const stepH = h / steps;
                const stepD = d / steps;

                const seatGeo = new THREE.BoxGeometry(w, stepH, stepD);
                const seatMat = new THREE.MeshLambertMaterial({ color: 0x555555 });

                for (let i = 0; i < steps; i++) {
                    const seat = new THREE.Mesh(seatGeo, seatMat);
                    // Scale box height for steps
                    seat.scale.y = (i + 1);
                    seat.position.set(0, (stepH * (i + 1)) / 2, -i * stepD + d / 2);
                    gsGroup.add(seat);
                }

                const roofGeo = new THREE.PlaneGeometry(w, d + 5);
                roofGeo.rotateX(-Math.PI / 2);
                const roofMat = new THREE.MeshLambertMaterial({ color: 0xe10600, side: THREE.DoubleSide });
                const roof = new THREE.Mesh(roofGeo, roofMat);
                roof.position.set(0, h + 2, d / 2 - 2.5);
                roof.rotation.x = -0.15;
                gsGroup.add(roof);

                this.trackGroup.add(gsGroup);
            }
        }

        // Add 3D Garage
        if (data.garage) {
            const g = data.garage;
            const w = g.width / scaleFact;
            const l = g.length / scaleFact;
            const rot = (g.rotation || 0) * Math.PI / 180;

            // Get nearest track Z
            let nearestZ = 0;
            let minDist = Infinity;
            for (let j = 0; j < track.length; j += 4) {
                const pt = track[j];
                const d = Math.hypot(g.x - pt.x, g.y - pt.y);
                if (d < minDist) { minDist = d; nearestZ = (pt.z || 0) / scaleFact; }
            }

            const h = 10 / scaleFact; // height of garage
            const gGeo = new THREE.BoxGeometry(l, h, w);
            const gMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
            const gMesh = new THREE.Mesh(gGeo, gMat);
            gMesh.position.set(g.x, nearestZ + h / 2, g.y);
            gMesh.rotation.y = -rot;

            this.trackGroup.add(gMesh);
        }

        // Add Pit Lane Mesh
        const pitLane = editor.getInterpolatedPitLane();
        if (pitLane && pitLane.length >= 2) {
            const pitGeo = new THREE.BufferGeometry();
            const pVerts = [];
            const pUvs = [];
            for (let i = 0; i < pitLane.length; i++) {
                const p = pitLane[i];
                let pwL = (p.widthLeft || (editor.data.pitLane.width || 8) / 2) / scaleFact;
                let pwR = (p.widthRight || (editor.data.pitLane.width || 8) / 2) / scaleFact;
                if (this.textureType === 'preview') {
                    // Match the thicker outline in PreviewRenderer
                    pwL = 7 / scaleFact;
                    pwR = 7 / scaleFact;
                }
                const p1x = p.x + (p.nx || 0) * pwL, p1z = p.y + (p.ny || 0) * pwL;
                const p2x = p.x - (p.nx || 0) * pwR, p2z = p.y - (p.ny || 0) * pwR;
                pVerts.push(p1x, (p.z || 0) / scaleFact, p1z);
                pVerts.push(p2x, (p.z || 0) / scaleFact, p2z);

                const s1 = s2wFn(p1x, p1z);
                const s2 = s2wFn(p2x, p2z);
                pUvs.push(s1.x / TEX_SIZE, 1.0 - (s1.y / TEX_SIZE));
                pUvs.push(s2.x / TEX_SIZE, 1.0 - (s2.y / TEX_SIZE));
            }
            const pIndices = [];
            for (let i = 0; i < pitLane.length - 1; i++) {
                const base = i * 2;
                pIndices.push(base, base + 1, base + 2);
                pIndices.push(base + 1, base + 3, base + 2);
            }
            pitGeo.setAttribute('position', new THREE.Float32BufferAttribute(pVerts, 3));
            pitGeo.setAttribute('uv', new THREE.Float32BufferAttribute(pUvs, 2));
            pitGeo.setIndex(pIndices);
            pitGeo.computeVertexNormals();

            const pitMesh = new THREE.Mesh(pitGeo, material);
            pitMesh.position.y = 0.05; // Below the track mesh (0.1) but above the terrain (0.0)
            this.trackGroup.add(pitMesh);
        }

        // Add nodes
        this.nodeMeshes = [];
        if (this.textureType !== 'preview') {
            // Hemisphere (semi-circle over the road)
            const nodeGeo = new THREE.SphereGeometry(3, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);

            this.app.data.controlPoints.forEach(pt => {
                const isSel = sel && sel.type === 'cp' && sel.id === pt.id;
                const isHov = hoverPt && hoverPt.id === pt.id;
                const mat = isSel ? this.selNodeMat : isHov ? this.hoverNodeMat : this.nodeMat;
                const sphere = new THREE.Mesh(nodeGeo, mat);
                // Rest perfectly on top of the track
                sphere.position.set(pt.x, ((pt.z || 0) / scaleFact) + 0.1, pt.y);
                sphere.userData = { node: pt, type: 'cp' };
                this.trackGroup.add(sphere);
                this.nodeMeshes.push(sphere);
            });

            if (this.app.data.showPitlaneNodes) {
                this.app.data.pitLane.points.forEach(pt => {
                    const isSel = sel && sel.type === 'pit' && sel.id === pt.id;
                    const isHov = hoverPt && hoverPt.id === pt.id;
                    const mat = isSel ? this.selNodeMat : isHov ? this.hoverNodeMat : this.nodeMat;
                    const sphere = new THREE.Mesh(nodeGeo, mat);
                    sphere.position.set(pt.x, ((pt.z || 0) / scaleFact) + 0.1, pt.y);
                    sphere.userData = { node: pt, type: 'pit' };
                    this.trackGroup.add(sphere);
                    this.nodeMeshes.push(sphere);
                });
            }
        }
    }

    updateNodeMaterials() {
        const sel = this.app.selection;
        const hoverPt = this.app.hoverPoint;

        this.nodeMeshes.forEach(mesh => {
            const pt = mesh.userData.node;
            const type = mesh.userData.type || 'cp';
            const isSel = sel && sel.type === type && sel.id === pt.id;
            const isHov = hoverPt && hoverPt.id === pt.id;
            mesh.material = isSel ? this.selNodeMat : isHov ? this.hoverNodeMat : this.nodeMat;
        });
    }
}

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
        
        this.nodeMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x004422 });
        this.selNodeMat = new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xff4400 });
        this.hoverNodeMat = new THREE.MeshStandardMaterial({ color: 0x66ffbb, emissive: 0x338855 });
        
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
                    this.canvas.style.cursor = 'pointer';
                    this.updateNodeMaterials();
                }
            } else {
                if (this.app.hoverPoint !== null) {
                    this.app.hoverPoint = null;
                    this.canvas.style.cursor = 'default';
                    this.updateNodeMaterials();
                }
            }
        });

        // Raycasting for selection
        this.canvas.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return; // Only left click
            if (this.app.hoverPoint) {
                this.app.setSelection({ type: 'cp', id: this.app.hoverPoint.id });
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
        if(view === 'top') {
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
            this.camera.position.set(this.controls.target.x + dist*0.7, dist*0.7, this.controls.target.z + dist*0.7);
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
        if(intersect) {
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
        while(this.trackGroup.children.length > 0) {
            const child = this.trackGroup.children[0];
            if(child.geometry) child.geometry.dispose();
            if(child.material) child.material.dispose();
            this.trackGroup.remove(child);
        }
        
        if(track.length < 2) return;

        // Generate 2D Texture from offscreen canvas to get colors, runoffs, and flags
        const TEX_SIZE = Math.min(4096, this.renderer.capabilities.maxTextureSize);
        const texCanvas = document.createElement('canvas');
        texCanvas.width = TEX_SIZE;
        texCanvas.height = TEX_SIZE;
        const data = this.app.data;
        let s2wFn = null;
        
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
            renderer2d.fitToScreen();
            renderer2d.render(data, editor);
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
            s2wFn = (x, z) => renderer2d.w2s(x, z);
        }

        data.zones = oldZones; data.sectorLabels = oldLabels; data.turnMarkers = oldTurns;
        
        const texture = new THREE.CanvasTexture(texCanvas);
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        texture.generateMipmaps = true;

        // Draw track mesh covering road + runoffs
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const uvs = [];
        for (let i = 0; i < track.length; i++) {
            const p = track[i];
            let wL = p.widthLeft;
            let wR = p.widthRight;
            if (this.textureType === 'editor') {
                wL += (p.surfaceWidthLeft ?? 15) + (p.barrierLeft ? 5 : 0);
                wR += (p.surfaceWidthRight ?? 15) + (p.barrierRight ? 5 : 0);
            } else {
                // Match the fixed 40 width of the PreviewRenderer texture exactly
                wL = 20;
                wR = 20;
            }
            
            const p1x = p.x - p.nx * wL, p1z = p.y - p.ny * wL;
            const p2x = p.x + p.nx * wR, p2z = p.y + p.ny * wR;
            
            vertices.push(p1x, p.z || 0, p1z);
            vertices.push(p2x, p.z || 0, p2z);
            
            const s1 = s2wFn(p1x, p1z);
            const s2 = s2wFn(p2x, p2z);
            
            uvs.push(s1.x / TEX_SIZE, 1.0 - (s1.y / TEX_SIZE));
            uvs.push(s2.x / TEX_SIZE, 1.0 - (s2.y / TEX_SIZE));
        }
        
        const indices = [];
        for (let i = 0; i < track.length - 1; i++) {
            const row1 = i * 2;
            const row2 = (i + 1) * 2;
            indices.push(row1, row2, row1 + 1);
            indices.push(row1 + 1, row2, row2 + 1);
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = 0.1; // Place slightly above the grid to avoid clipping
        this.trackGroup.add(mesh);

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
                let w1 = p1.widthLeft + (p1.surfaceWidthLeft ?? 10);
                let w2 = p2.widthLeft + (p2.surfaceWidthLeft ?? 10);
                // Adjust width slightly outward for 3D barriers so it doesn't z-fight with edge
                w1 += 1.0; w2 += 1.0;
                const b1x = p1.x - p1.nx * w1, b1z = p1.y - p1.ny * w1;
                const b2x = p2.x - p2.nx * w2, b2z = p2.y - p2.ny * w2;
                bVerts.push(b1x, p1.z || 0, b1z, b1x, (p1.z || 0) + bHeight, b1z, b2x, p2.z || 0, b2z, b2x, (p2.z || 0) + bHeight, b2z);
                bIndices.push(bIdx, bIdx + 2, bIdx + 1, bIdx + 1, bIdx + 2, bIdx + 3);
                bIdx += 4;
            }

            // Right barrier
            if (p1.barrierRight && p2.barrierRight) {
                let w1 = p1.widthRight + (p1.surfaceWidthRight ?? 10);
                let w2 = p2.widthRight + (p2.surfaceWidthRight ?? 10);
                w1 += 1.0; w2 += 1.0;
                const b1x = p1.x + p1.nx * w1, b1z = p1.y + p1.ny * w1;
                const b2x = p2.x + p2.nx * w2, b2z = p2.y + p2.ny * w2;
                bVerts.push(b1x, p1.z || 0, b1z, b1x, (p1.z || 0) + bHeight, b1z, b2x, p2.z || 0, b2z, b2x, (p2.z || 0) + bHeight, b2z);
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
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of track) { 
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); 
                minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); 
            }
            const width = Math.max(1500, (maxX - minX) + 1200);
            const height = Math.max(1500, (maxY - minY) + 1200);
            const segments = 100;
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
                
                // Sample track points for distance mapping
                for (let j = 0; j < track.length; j += 4) {
                    const p = track[j];
                    const d = Math.hypot(vx - p.x, vz - p.y);
                    if (d < minDist) {
                        minDist = d;
                        nearestZ = p.z || 0;
                    }
                }
                
                const influence = Math.max(0, 1 - (minDist / 250));
                const smoothInfluence = influence * influence * (3 - 2 * influence);
                // Lower slightly so it sits beneath the track surface mesh
                posAttr.setY(i, (nearestZ * smoothInfluence) - 0.5);
            }
            terrainGeo.computeVertexNormals();
            
            // Generate a simple procedural grass texture using canvas
            const grassTexCanvas = document.createElement('canvas');
            grassTexCanvas.width = 512; grassTexCanvas.height = 512;
            const gctx = grassTexCanvas.getContext('2d');
            gctx.fillStyle = '#1e3d1e'; gctx.fillRect(0, 0, 512, 512);
            for(let i=0; i<5000; i++) {
                gctx.fillStyle = Math.random() > 0.5 ? '#1a331a' : '#234723';
                gctx.fillRect(Math.random()*512, Math.random()*512, 2, 2);
            }
            const grassTex = new THREE.CanvasTexture(grassTexCanvas);
            grassTex.wrapS = THREE.RepeatWrapping;
            grassTex.wrapT = THREE.RepeatWrapping;
            grassTex.repeat.set(width/50, height/50);
            
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
                    if (d < minDist) { minDist = d; nearestZ = pt.z || 0; }
                }

                const w = (zone.length || 50);
                const h = (zone.height || 16);
                const d = 20; // depth
                
                const gsGroup = new THREE.Group();
                gsGroup.position.set(p.x, nearestZ, p.y);
                
                const rad = -(zone.rotation || 0) * Math.PI / 180;
                gsGroup.rotation.y = rad;
                
                const steps = 4;
                const stepH = h / steps;
                const stepD = d / steps;
                
                const seatGeo = new THREE.BoxGeometry(w, stepH, stepD);
                const seatMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
                
                for(let i = 0; i < steps; i++) {
                    const seat = new THREE.Mesh(seatGeo, seatMat);
                    // Scale box height for steps
                    seat.scale.y = (i + 1);
                    seat.position.set(0, (stepH * (i + 1)) / 2, -i * stepD + d/2);
                    gsGroup.add(seat);
                }
                
                const roofGeo = new THREE.PlaneGeometry(w, d + 5);
                roofGeo.rotateX(-Math.PI / 2);
                const roofMat = new THREE.MeshLambertMaterial({ color: 0xe10600, side: THREE.DoubleSide });
                const roof = new THREE.Mesh(roofGeo, roofMat);
                roof.position.set(0, h + 2, d/2 - 2.5);
                roof.rotation.x = -0.15;
                gsGroup.add(roof);
                
                this.trackGroup.add(gsGroup);
            }
        }

        // Add Pit Lane Mesh
        const pitLane = editor.getInterpolatedPitLane();
        if (pitLane && pitLane.length >= 2) {
            const pitGeo = new THREE.BufferGeometry();
            const pVerts = [];
            const pUvs = [];
            for (let i = 0; i < pitLane.length; i++) {
                const p = pitLane[i];
                let pwL = p.widthLeft || 3;
                let pwR = p.widthRight || 3;
                if (this.textureType === 'editor') {
                    // Match exactly the road width to avoid catching grass
                    pwL = 3.5;
                    pwR = 3.5;
                } else {
                    // Match the thicker outline in PreviewRenderer
                    pwL = 7;
                    pwR = 7;
                }
                const p1x = p.x - p.nx * pwL, p1z = p.y - p.ny * pwL;
                const p2x = p.x + p.nx * pwR, p2z = p.y + p.ny * pwR;
                pVerts.push(p1x, p.z || 0, p1z);
                pVerts.push(p2x, p.z || 0, p2z);
                
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
            pitMesh.position.y = 0.15;
            this.trackGroup.add(pitMesh);
        }
        
        // Add nodes
        this.nodeMeshes = [];
        if (this.textureType !== 'preview') {
            const nodeGeo = new THREE.SphereGeometry(3, 16, 16);
            
            this.app.data.controlPoints.forEach(pt => {
                const isSel = sel && sel.type === 'cp' && sel.id === pt.id;
                const isHov = hoverPt && hoverPt.id === pt.id;
                const mat = isSel ? this.selNodeMat : isHov ? this.hoverNodeMat : this.nodeMat;
                const sphere = new THREE.Mesh(nodeGeo, mat);
                sphere.position.set(pt.x, pt.z || 0, pt.y);
                sphere.userData = { node: pt };
                this.trackGroup.add(sphere);
                this.nodeMeshes.push(sphere);
            });
        }
    }

    updateNodeMaterials() {
        const sel = this.app.selection;
        const hoverPt = this.app.hoverPoint;
        
        this.nodeMeshes.forEach(mesh => {
            const pt = mesh.userData.node;
            const isSel = sel && sel.type === 'cp' && sel.id === pt.id;
            const isHov = hoverPt && hoverPt.id === pt.id;
            mesh.material = isSel ? this.selNodeMat : isHov ? this.hoverNodeMat : this.nodeMat;
        });
    }
}

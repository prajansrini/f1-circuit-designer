window.F1 = window.F1 || {};

F1.HotlapSimulator = class HotlapSimulator {
    constructor(app) {
        this.app = app;
        this.modal = document.getElementById('hotlap-modal');
        this.canvas = document.getElementById('hotlap-preview-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.btnPlay = document.getElementById('btn-hotlap-play');
        this.btnPause = document.getElementById('btn-hotlap-pause');
        this.btnStop = document.getElementById('btn-hotlap-stop');

        this.viewType = document.getElementById('hotlap-view-type');
        this.followCam = document.getElementById('hotlap-follow-cam');
        this.followZoomContainer = document.getElementById('hotlap-follow-zoom-container');
        this.followZoom = document.getElementById('hotlap-follow-zoom');
        this.carTeam = document.getElementById('hotlap-car-team');
        this.simSpeed = document.getElementById('hotlap-sim-speed');
        this.simSpeedVal = document.getElementById('hotlap-sim-speed-val');

        this.telemetryDiv = document.getElementById('hotlap-telemetry');

        this.playing = false;
        this.paused = false;
        this.car = null;
        this.hotlapPoints = [];

        this.lapTimer = 0;
        this.fastestLap = Infinity;
        this.lapsCompleted = 0;

        this.sectorTimes = [0, 0, 0];
        this.currentSectorTimer = 0;
        this.lastSpeedTrapSpeed = 0;

        this.lapHistory = [];
        this.bestSectors = [Infinity, Infinity, Infinity];

        this.speedTraps = [];
        this.straightZones = [];
        this.sectorNodes = [];
        this.trackSectors = [];

        this.ox = 0;
        this.oy = 0;
        this.scale = 1;
        this.baseScaleMap = 1;
        this.baseScaleEditor = 1;

        this._bindEvents();
    }

    _bindEvents() {
        document.getElementById('btn-close-hotlap').onclick = () => this.closeModal();

        this.btnPlay.onclick = () => {
            if (this.paused) {
                this.paused = false;
                this.lastTime = performance.now();
                this._loop();
            } else if (!this.playing) {
                this.startPlayback();
            }
            this._updateButtons();
        };

        this.btnPause.onclick = () => {
            this.paused = true;
            this._updateButtons();
        };

        this.btnStop.onclick = () => {
            this.stopPlayback();
        };

        this.viewType.onchange = () => {
            if (!this.playing || this.paused) this.render();
        };

        this.simSpeed.oninput = () => {
            this.simSpeedVal.textContent = parseFloat(this.simSpeed.value).toFixed(1);
        };

        this.followCam.onchange = () => {
            this.followZoomContainer.style.display = this.followCam.checked ? 'flex' : 'none';
        };
        this.followZoomContainer.style.display = 'none';

        if (this.carTeam) {
            this.carTeam.onchange = () => {
                if (this.playing) {
                    this.startPlayback(); // Restart session on car change
                } else if (this.car) {
                    this.car.color = this.carTeam.value;
                    this.render();
                }
            };
        }

        let isDragging = false;
        let lastX = 0, lastY = 0;
        this.canvas.onmousedown = (e) => {
            if (this.followCam.checked && this.playing) return;
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
        };
        window.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                lastX = e.clientX;
                lastY = e.clientY;
                if (this.viewType.value === 'map') {
                    this.app.preview.pan(dx, dy);
                } else {
                    this.ox += dx / this.scale;
                    this.oy += dy / this.scale;
                }
                if (!this.playing || this.paused) this.render();
            }
        });
        window.addEventListener('mouseup', () => {
            isDragging = false;
            this.canvas.style.cursor = 'grab';
        });
        this.canvas.onwheel = (e) => {
            if (this.followCam.checked && this.playing) return;
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            if (this.viewType.value === 'map') {
                this.app.preview.zoom(e.deltaY, mouseX, mouseY);
            } else {
                const bx = (mouseX - this.canvas.width / 2) / this.scale - this.ox;
                const by = (mouseY - this.canvas.height / 2) / this.scale - this.oy;

                this.scale *= e.deltaY > 0 ? 0.9 : 1.1;
                this.scale = Math.max(0.05, Math.min(20, this.scale));

                const ax = (mouseX - this.canvas.width / 2) / this.scale - this.ox;
                const ay = (mouseY - this.canvas.height / 2) / this.scale - this.oy;

                this.ox += ax - bx;
                this.oy += ay - by;
            }
            if (!this.playing || this.paused) this.render();
        };
    }

    _updateButtons() {
        if (this.playing) {
            if (this.paused) {
                this.btnPlay.style.display = 'block';
                this.btnPlay.innerHTML = 'Resume';
                this.btnPlay.className = 'prop-btn accent';
                this.btnPause.style.display = 'none';
                this.btnStop.style.display = 'block';
            } else {
                this.btnPlay.style.display = 'none';
                this.btnPause.style.display = 'block';
                this.btnStop.style.display = 'block';
            }
        } else {
            this.btnPlay.style.display = 'block';
            this.btnPlay.innerHTML = 'Start';
            this.btnPlay.className = 'generate-btn';
            this.btnPause.style.display = 'none';
            this.btnStop.style.display = 'none';
        }
    }

    openModal() {
        if (!this.app.data.isClosed) {
            alert("Circuit must be closed to simulate a hot lap.");
            return;
        }

        this.modal.style.display = 'flex';
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of this.app.data.controlPoints) {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
        const scaleX = (this.canvas.width - 100) / (maxX - minX || 1);
        const scaleY = (this.canvas.height - 100) / (maxY - minY || 1);
        this.scale = Math.min(scaleX, scaleY);
        this.baseScaleEditor = this.scale;
        this.ox = -(minX + maxX) / 2;
        this.oy = -(minY + maxY) / 2;

        this.app.preview.fitToScreen();
        this.baseScaleMap = this.app.preview.userScale;

        let track = this.app.editor.getInterpolatedTrack();
        this._precalculateSpeeds(track);
        this._parseZones(track);
        this._initCar();

        this.telemetryDiv.style.display = 'none';
        this.render();
    }

    closeModal() {
        this.modal.style.display = 'none';
        this.stopPlayback();
    }

    _parseZones(track) {
        let editor = this.app.editor;
        let len = track.length;

        this.speedTraps = this.app.data.zones.filter(z => z.type === 'speed_trap').map(z => {
            return (z.segIndex * editor.resolution + Math.floor(z.t * editor.resolution)) % len;
        });

        this.straightZones = this.app.data.zones.filter(z => z.type === 'straight_mode').map(z => {
            let start = (z.segIndex * editor.resolution + Math.floor(z.t * editor.resolution)) % len;
            let end = (z.endSegIndex * editor.resolution + Math.floor(z.endT * editor.resolution)) % len;
            return { start, end };
        });

        this.sectorNodes = [];
        this.trackSectors = [];
        this.missingSectors = false;

        let has1 = false, has2 = false, has3 = false;
        for (let i = 0; i < len; i++) {
            let s = parseInt(track[i].sector, 10) || 0;
            this.trackSectors.push(s);
            if (s === 0) this.missingSectors = true;
            if (s === 1) has1 = true;
            if (s === 2) has2 = true;
            if (s === 3) has3 = true;

            if (i > 0) {
                let prevS = parseInt(track[i - 1].sector, 10) || 0;
                if (prevS !== s && prevS !== 0 && s !== 0) {
                    this.sectorNodes.push(i);
                }
            }
        }
        if (!has1 || !has2 || !has3) this.missingSectors = true;

        const secWarn = document.getElementById('hotlap-sector-warning');
        if (secWarn) {
            secWarn.style.display = this.missingSectors ? 'block' : 'none';
        }

        const s1 = document.getElementById('hotlap-sec1-time').parentElement;
        const s2 = document.getElementById('hotlap-sec2-time').parentElement;
        const s3 = document.getElementById('hotlap-sec3-time').parentElement;

        if (this.missingSectors) {
            s1.style.display = 'none';
            s2.style.display = 'none';
            s3.style.display = 'none';
        } else {
            s1.style.display = 'flex';
            s2.style.display = 'flex';
            s3.style.display = 'flex';
        }
    }

    _initCar() {
        this.car = {
            index: 0,
            dist: 0,
            speed: 0, // starts at 0
            color: this.carTeam ? this.carTeam.value : '#ff1801',
            icePower: 0,
            mgukPower: 0,
            aeroMode: 'corner',
            accelG: 0,
            targetV: 0
        };
        this.lapTimer = 0;
        this.fastestLap = Infinity;
        this.lapsCompleted = 1;
        this.sectorTimes = [0, 0, 0];
        this.currentSectorTimer = 0;
        this.lastSpeedTrapSpeed = 0;
        this.lapHistory = [];
        this.bestSectors = [Infinity, Infinity, Infinity];
        
        // 2026 Engine Parameters
        this.batteryPct = 100.0; // 0% to 100%
        this.deployTimer = 0;
        this.deployCooldown = false;
        this.isDeploying = false;
        this.turboLagTimer = 0;

        this._renderHistory();
    }

    startPlayback() {
        this.playing = true;
        this.paused = false;
        this._updateButtons();

        this._initCar();
        this.telemetryDiv.style.display = 'flex';

        this.lastTime = performance.now();
        this._loop = () => {
            if (!this.playing) return;
            const now = performance.now();
            let dt = (now - this.lastTime) / 1000.0;
            this.lastTime = now;
            if (dt > 0.1) dt = 0.1;

            if (!this.paused) {
                this.update(dt);
            } else {
                this.render();
            }

            requestAnimationFrame(this._loop);
        };
        requestAnimationFrame(this._loop);
    }

    stopPlayback() {
        this.playing = false;
        this.paused = false;
        this._updateButtons();
        this.telemetryDiv.style.display = 'none';
        this.render();
    }

    _precalculateSpeeds(track) {
        const sf = (this.app.data.gridSize || 50) / 50.0;
        this.hotlapPoints = [];

        for (let i = 0; i < track.length; i++) {
            let win = 5;
            let ahead = track[(i + win) % track.length];
            let behind = track[(i - win + track.length) % track.length];

            let dx1 = ahead.x - track[i].x; let dy1 = ahead.y - track[i].y;
            let dx2 = track[i].x - behind.x; let dy2 = track[i].y - behind.y;
            let angle1 = Math.atan2(dy1, dx1);
            let angle2 = Math.atan2(dy2, dx2);

            let dTheta = angle1 - angle2;
            while (dTheta > Math.PI) dTheta -= 2 * Math.PI;
            while (dTheta < -Math.PI) dTheta += 2 * Math.PI;

            let ds = 0;
            for (let j = 1; j <= win; j++) {
                let p1 = track[(i + j) % track.length];
                let p0 = track[(i + j - 1 + track.length) % track.length];
                ds += Math.hypot(p1.x - p0.x, p1.y - p0.y) * sf;
                let p3 = track[(i - j + track.length) % track.length];
                let p4 = track[(i - j + 1 + track.length) % track.length];
                ds += Math.hypot(p4.x - p3.x, p4.y - p3.y) * sf;
            }

            let curvature = Math.abs(dTheta) / (ds / 2);
            let radius = Math.min(2000, 1 / (curvature || 0.001));

            // Corner Speed Table (Simplified 2026)
            let v = 355;
            if (radius < 20) v = 60;
            else if (radius < 30) v = 80;
            else if (radius < 50) v = 105;
            else if (radius < 75) v = 140;
            else if (radius < 100) v = 170;
            else if (radius < 150) v = 200;
            else if (radius < 250) v = 235;
            else if (radius < 400) v = 270;
            else if (radius < 700) v = 305;
            else v = 355; // max allowed target
            
            v = v / 3.6; 

            this.hotlapPoints.push({
                x: track[i].x, y: track[i].y,
                nx: track[i].nx, ny: track[i].ny,
                radius: radius,
                cornerSpeed: v,
                safeSpeed: v,
                distToNext: Math.hypot(track[(i + 1) % track.length].x - track[i].x, track[(i + 1) % track.length].y - track[i].y) * sf
            });
        }

        // Backward Braking Pass (Max Decel 50 m/s^2)
        const decel = 50.0;
        for (let pass = 0; pass < 2; pass++) {
            for (let i = this.hotlapPoints.length - 1; i >= 0; i--) {
                let p = this.hotlapPoints[i];
                let nextP = this.hotlapPoints[(i + 1) % this.hotlapPoints.length];
                let reqSpeed = Math.sqrt(nextP.safeSpeed * nextP.safeSpeed + 2 * decel * p.distToNext);
                if (p.safeSpeed > reqSpeed) p.safeSpeed = reqSpeed;
            }
        }
        
        let len = this.hotlapPoints.length;
        for (let i = 0; i < len; i++) {
            let p = this.hotlapPoints[i];
            let lookDist = 0;
            let brakeDist = 9999;
            for (let j = 1; j < 400; j++) {
                let p2 = this.hotlapPoints[(i + j) % len];
                lookDist += p2.distToNext;
                if (p2.cornerSpeed < p.safeSpeed - 2) { 
                    brakeDist = lookDist;
                    break;
                }
            }
            p.distToBrake = brakeDist;
        }
    }

    getCarPos() {
        let p1 = this.hotlapPoints[this.car.index];
        let p2 = this.hotlapPoints[(this.car.index + 1) % this.hotlapPoints.length];
        let t = p1.distToNext > 0 ? (this.car.dist / p1.distToNext) : 0;
        return {
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t
        };
    }

    update(dt) {
        if (!this.hotlapPoints || this.hotlapPoints.length === 0 || !this.car) return;

        let simSpeedMultiplier = parseFloat(this.simSpeed.value) || 1.0;
        let effectiveDt = dt * simSpeedMultiplier;

        this.lapTimer += effectiveDt;
        if (!this.missingSectors) this.currentSectorTimer += effectiveDt;

        let p = this.hotlapPoints[this.car.index];
        
        let isDrs = false;
        if (this.lapsCompleted > 1) {
            for (let z of this.straightZones) {
                if (z.start <= z.end) {
                    if (this.car.index >= z.start && this.car.index <= z.end) isDrs = true;
                } else {
                    if (this.car.index >= z.start || this.car.index <= z.end) isDrs = true;
                }
            }
        }

        // Active Aerodynamics: Corner vs Straight Mode (Robust Hysteresis via Smoothed Speed)
        let safeSpeedKph = p.safeSpeed * 3.6;
        if (isDrs || safeSpeedKph > 310) {
            this.car.aeroMode = 'straight';
        } else if (safeSpeedKph < 280) {
            this.car.aeroMode = 'corner';
        }
        
        // Prevent artificial speed clipping jumps
        let targetV = p.safeSpeed;
        if (this.car.aeroMode === 'straight') targetV = Math.min(targetV, 355/3.6);
        else targetV = Math.min(targetV, 355/3.6); // Removed arbitrary 0.94 penalty to prevent stutter

        this.car.targetV = targetV;
        
        // 4. If current speed exceeds target speed, apply braking
        let isBraking = this.car.speed > targetV + 0.5;

        // Battery Deployment Logic
        if (isBraking) {
            this.deployCooldown = false; // Reset cooldown when braking
        }

        let wantDeploy = false;
        let isAccelerating = this.car.speed < targetV - 0.5; 
        let needsMgukToMaintainSpeed = this.car.speed >= 314 / 3.6;
        
        // Deploy on long straights or exits, never during braking or apex
        if (!isBraking && this.batteryPct > 0 && !this.deployCooldown && (isDrs || p.radius > 40)) {
            if (isAccelerating || needsMgukToMaintainSpeed) {
                wantDeploy = true;
            }
        }
        
        if (wantDeploy && !this.isDeploying) {
            this.isDeploying = true;
        }
        
        // Disable MGU-K if braking, or if cruising at a low target speed
        if (isBraking || (!isAccelerating && !needsMgukToMaintainSpeed)) {
            this.isDeploying = false; 
            this.deployTimer -= effectiveDt * 0.5; // Slow cool down
            if (this.deployTimer < 0) this.deployTimer = 0;
        }
        
        if (this.isDeploying) {
            this.deployTimer += effectiveDt;
            if (this.deployTimer >= 12.0 || this.batteryPct <= 0) {
                this.isDeploying = false;
                this.deployCooldown = true; // Force cooldown until next braking zone
            }
        }

        // Turbo Lag (0.15s after throttle application)
        if (isBraking) this.turboLagTimer = 0.15;
        else if (this.turboLagTimer > 0) this.turboLagTimer -= effectiveDt;

        this.car.icePower = 0;
        this.car.mgukPower = 0;
        
        let startSpeed = this.car.speed;
        let kph = this.car.speed * 3.6;
        
        if (isBraking) {
            this.car.speed -= 50.0 * effectiveDt; // 50 m/s^2 constant deceleration (approx 5.5g)
            if (this.car.speed < targetV) this.car.speed = targetV;
            
            // Battery Recovery during braking (Simplified continuous approximation of the user's event-based braking)
            // Heavy Braking = +2.5% per event. At 50 m/s^2, an average heavy braking zone takes ~1.0 second.
            // Using a flat +2.5% per second of braking elegantly satisfies all braking severity tiers.
            this.batteryPct += 2.5 * effectiveDt;
            if (this.batteryPct > 100.0) this.batteryPct = 100.0;
        } else {
            // Speed-Dependent Acceleration Curve
            let pct = 1.0;
            if (kph >= 330) pct = 0.15;
            else if (kph >= 300) pct = 0.30;
            else if (kph >= 250) pct = 0.50;
            else if (kph >= 200) pct = 0.70;
            else if (kph >= 100) pct = 0.85;
            
            // Base Acceleration reduced to stretch out the time spent reaching top speed
            let baseAccel = this.isDeploying ? 10.5 : 7.5;
            let accel = baseAccel * pct;
            
            this.car.icePower = 400; // ICE always providing power when accelerating
            
            if (this.isDeploying) {
                this.batteryPct -= 4.1 * effectiveDt; // -4.1% battery per second
                if (this.batteryPct < 0) this.batteryPct = 0;
                this.car.mgukPower = 350; // MGU-K active
            }
            
            if (this.turboLagTimer <= 0) {
                this.car.speed += accel * effectiveDt;
            }
            
            // Maximum absolute speeds
            let maxCurrentSpeed = this.isDeploying ? 355/3.6 : 315/3.6;
            if (this.car.speed > maxCurrentSpeed) this.car.speed = maxCurrentSpeed;
            if (this.car.speed > targetV) this.car.speed = targetV;
        }

        if (effectiveDt > 0) {
            this.car.accelG = (this.car.speed - startSpeed) / (effectiveDt * 9.81);
        }

        this.car.dist += this.car.speed * effectiveDt;

        let iter = 0;
        while (this.car.dist > 0 && iter++ < 100) {
            let pNext = this.hotlapPoints[this.car.index];
            if (this.car.dist >= pNext.distToNext) {
                this.car.dist -= pNext.distToNext;
                let prevIndex = this.car.index;
                this.car.index++;

                if (this.speedTraps.includes(this.car.index)) {
                    this.lastSpeedTrapSpeed = this.car.speed;
                }

                if (!this.missingSectors) {
                    let curSec = this.trackSectors[this.car.index];
                    if (this.activeSector === undefined && curSec >= 1 && curSec <= 3) {
                        this.activeSector = curSec;
                    }
                    if (this.activeSector !== undefined && curSec >= 1 && curSec <= 3 && curSec !== this.activeSector) {
                        this.sectorTimes[this.activeSector - 1] += this.currentSectorTimer;
                        if (this.sectorTimes[this.activeSector - 1] < this.bestSectors[this.activeSector - 1]) {
                            this.bestSectors[this.activeSector - 1] = this.sectorTimes[this.activeSector - 1];
                        }
                        this.currentSectorTimer = 0;
                        this.activeSector = curSec;
                    }
                }

                if (this.car.index >= this.hotlapPoints.length) {
                    this.car.index = 0;
                    this.recoveredEnergyLap = 0; // Reset recovery limit for new lap

                    if (!this.missingSectors && this.activeSector >= 1 && this.activeSector <= 3) {
                        this.sectorTimes[this.activeSector - 1] += this.currentSectorTimer;
                        if (this.sectorTimes[this.activeSector - 1] < this.bestSectors[this.activeSector - 1]) {
                            this.bestSectors[this.activeSector - 1] = this.sectorTimes[this.activeSector - 1];
                        }
                        this.currentSectorTimer = 0;
                    }

                    let lapRecord = {
                        lap: this.lapsCompleted,
                        time: this.lapTimer,
                        s1: this.sectorTimes[0],
                        s2: this.sectorTimes[1],
                        s3: this.sectorTimes[2]
                    };
                    this.lapHistory.unshift(lapRecord);

                    if (this.lapTimer < this.fastestLap) this.fastestLap = this.lapTimer;
                    this.lapTimer = 0;
                    this.lapsCompleted++;

                    this.sectorTimes = [0, 0, 0];
                    this.activeSector = undefined;
                    this._renderHistory();
                }
            } else {
                break;
            }
        }

        let pos = this.getCarPos();

        if (this.followCam.checked) {
            let zoomMult = parseFloat(this.followZoom.value) || 1.0;

            if (this.camX === undefined) this.camX = pos.x;
            if (this.camY === undefined) this.camY = pos.y;
            this.camX += (pos.x - this.camX) * 0.1;
            this.camY += (pos.y - this.camY) * 0.1;

            if (this.viewType.value === 'map') {
                const track = this.app.editor.getInterpolatedTrack();
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const pt of track) { const ex = Math.max(pt.widthLeft, pt.widthRight) + 35; minX = Math.min(minX, pt.x - ex); maxX = Math.max(maxX, pt.x + ex); minY = Math.min(minY, pt.y - ex); maxY = Math.max(maxY, pt.y + ex); }
                let cx = (minX + maxX) / 2;
                let cy = (minY + maxY) / 2;

                let targetScale = this.baseScaleMap * zoomMult;
                this.app.preview.userScale += (targetScale - this.app.preview.userScale) * 0.1;

                let tf = this.app.preview._tf(track, this.app.data, this.canvas.width, this.canvas.height);

                this.app.preview.userOx = (cx - this.camX) * tf.scale;
                this.app.preview.userOy = (cy - this.camY) * tf.scale;
                
                this.app.preview.draw();
            } else {
                let targetScale = this.baseScaleEditor * zoomMult;
                this.scale += (targetScale - this.scale) * 0.1;
                this.ox = -this.camX;
                this.oy = -this.camY;
            }
        }

        this.updateTelemetry();
        if (this.viewType.value === 'editor' || !this.followCam.checked) {
            this.render();
        }
    }

    updateTelemetry() {
        if (!this.car || !this.hotlapPoints || this.hotlapPoints.length === 0) return;
        let kph = Math.round(this.car.speed * 3.6);
        
        let gear = 1;
        if (kph >= 80 && kph < 120) gear = 2;
        else if (kph >= 120 && kph < 155) gear = 3;
        else if (kph >= 155 && kph < 190) gear = 4;
        else if (kph >= 190 && kph < 225) gear = 5;
        else if (kph >= 225 && kph < 265) gear = 6;
        else if (kph >= 265 && kph < 315) gear = 7;
        else if (kph >= 315) gear = 8;

        document.getElementById('hotlap-speed-readout').innerHTML = `${kph} <span style="font-size:14px;color:#aaa;">km/h</span>`;
        document.getElementById('hotlap-gear-readout').textContent = `Gear ${gear}`;
        document.getElementById('hotlap-time-readout').textContent = this.formatTime(this.lapTimer);
        document.getElementById('hotlap-lap-number').textContent = `Lap ${this.lapsCompleted}`;

        let isDrs = false;
        if (this.lapsCompleted > 1) {
            for (let z of this.straightZones) {
                if (z.start <= z.end) {
                    if (this.car.index >= z.start && this.car.index <= z.end) isDrs = true;
                } else {
                    if (this.car.index >= z.start || this.car.index <= z.end) isDrs = true;
                }
            }
        }

        let drsEl = document.getElementById('hotlap-drs-indicator');
        if (isDrs) {
            drsEl.style.background = '#e10600';
            drsEl.style.color = '#fff';
        } else {
            drsEl.style.background = '#333';
            drsEl.style.color = '#666';
        }

        let p = this.hotlapPoints[this.car.index];
        let boostEl = document.getElementById('hotlap-boost-indicator');
        let overtakeEl = document.getElementById('hotlap-overtake-indicator');
        
        if (this.isDeploying) {
            if (this.car.aeroMode === 'straight') {
                // On straights, BOTH Boost and Overtake are engaged
                boostEl.style.background = '#00a1e8';
                boostEl.style.color = '#fff';
                overtakeEl.style.background = '#b138ff'; // purple for overtake
                overtakeEl.style.color = '#fff';
            } else {
                // Partial deployment out of corners is just BOOST mode
                boostEl.style.background = '#00a1e8'; // blue for boost
                boostEl.style.color = '#fff';
                overtakeEl.style.background = '#333';
                overtakeEl.style.color = '#666';
            }
        } else {
            boostEl.style.background = '#333';
            boostEl.style.color = '#666';
            overtakeEl.style.background = '#333';
            overtakeEl.style.color = '#666';
        }

        let trapEl = document.getElementById('hotlap-trap-speed');
        if (this.lastSpeedTrapSpeed > 0) {
            trapEl.textContent = `${Math.round(this.lastSpeedTrapSpeed * 3.6)} km/h`;
            trapEl.style.color = '#00ff88';
        }

        try {
            // Simplified Animated Battery Telemetry
            let soc = this.batteryPct;
            if (soc < 0) soc = 0;
            if (soc > 100) soc = 100;

            document.getElementById('tele-soc-text').textContent = `${soc.toFixed(1)}%`;
            document.getElementById('tele-battery-bar').style.width = `${soc}%`;
            
            let barColor = '#00a1e8'; // Blue for idle/normal
            if (this.isDeploying) barColor = '#b138ff'; // Purple/Green for deploy
            else if (this.car.speed > this.car.targetV + 0.5) barColor = '#00ff88'; // Green for regen
            document.getElementById('tele-battery-bar').style.background = barColor;
            
            let currentMj = (soc / 100) * 8.5;
            document.getElementById('tele-mj-text').textContent = `${currentMj.toFixed(2)} MJ`;
            document.getElementById('tele-aero-text').textContent = this.car.aeroMode === 'straight' ? 'Straight Mode' : 'Corner Mode';
        } catch (e) {
            document.getElementById('hotlap-lap-number').textContent = "ERROR: " + e.message;
        }

        if (!this.missingSectors) {
            let curSec = this.trackSectors[this.car.index];
            
            document.getElementById('hotlap-sec1-time').textContent = curSec === 1 ? this.formatTime(this.currentSectorTimer) : this.formatTime(this.sectorTimes[0]);
            document.getElementById('hotlap-sec1-time').style.color = curSec === 1 ? '#fff' : this.getSectorColor(this.sectorTimes[0], this.bestSectors[0]);
            
            document.getElementById('hotlap-sec2-time').textContent = curSec === 2 ? this.formatTime(this.currentSectorTimer) : this.formatTime(this.sectorTimes[1]);
            document.getElementById('hotlap-sec2-time').style.color = curSec === 2 ? '#fff' : this.getSectorColor(this.sectorTimes[1], this.bestSectors[1]);
            
            document.getElementById('hotlap-sec3-time').textContent = curSec === 3 ? this.formatTime(this.currentSectorTimer) : this.formatTime(this.sectorTimes[2]);
            document.getElementById('hotlap-sec3-time').style.color = curSec === 3 ? '#fff' : this.getSectorColor(this.sectorTimes[2], this.bestSectors[2]);
            
            this._renderHistory();
        }

        document.getElementById('hotlap-fastest-readout').textContent = this.fastestLap !== Infinity ? this.formatTime(this.fastestLap) : '--';
    }

    w2s(wx, wy) {
        return { x: (wx + this.ox) * this.scale + this.canvas.width / 2, y: (wy + this.oy) * this.scale + this.canvas.height / 2 };
    }

    formatTime(seconds) {
        if (seconds === 0 || seconds === Infinity) return '--';
        let m = Math.floor(seconds / 60);
        let s = Math.floor(seconds % 60);
        let ms = Math.floor((seconds % 1) * 1000);
        if (m > 0) {
            return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
        } else {
            return `${s}.${ms.toString().padStart(3, '0')}`;
        }
    }

    getSectorColor(time, best) {
        if (time === 0 || time === Infinity || this.missingSectors) return '#fff';
        if (time <= best + 0.001) return '#b138ff';
        return '#f1c40f';
    }

    _renderHistory() {
        let container = document.getElementById('hotlap-history-table');
        if (!container) return;
        container.innerHTML = '';
        
        let allLaps = [];
        if (this.playing || this.paused) {
            let curSec = this.activeSector || 1;
            allLaps.push({
                lap: this.lapsCompleted,
                time: this.lapTimer,
                s1: curSec > 1 ? this.sectorTimes[0] : (curSec === 1 ? this.currentSectorTimer : 0),
                s2: curSec > 2 ? this.sectorTimes[1] : (curSec === 2 ? this.currentSectorTimer : 0),
                s3: curSec > 3 ? this.sectorTimes[2] : (curSec === 3 ? this.currentSectorTimer : 0),
                isCurrent: true,
                curSec: curSec
            });
        }
        allLaps = allLaps.concat(this.lapHistory);
        
        for (let lap of allLaps) {
            let tr = document.createElement('div');
            tr.style.padding = '6px';
            tr.style.borderBottom = '1px solid #222';
            tr.style.fontFamily = "'JetBrains Mono', monospace";

            let c1 = (lap.isCurrent && lap.curSec === 1) ? '#fff' : this.getSectorColor(lap.s1, this.bestSectors[0]);
            let c2 = (lap.isCurrent && lap.curSec === 2) ? '#fff' : this.getSectorColor(lap.s2, this.bestSectors[1]);
            let c3 = (lap.isCurrent && lap.curSec === 3) ? '#fff' : this.getSectorColor(lap.s3, this.bestSectors[2]);
            let c4 = lap.isCurrent ? '#fff' : (lap.time <= this.fastestLap + 0.001 ? '#b138ff' : '#f1c40f');

            if (this.missingSectors) {
                tr.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <span style="color:#888; font-size:11px;">Lap ${lap.lap}</span>
                        <span style="font-weight:bold; color:${c4}; font-size:13px;">${this.formatTime(lap.time)}</span>
                    </div>
                `;
            } else {
                tr.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <span style="color:#888; font-size:11px;">Lap ${lap.lap} ${lap.isCurrent ? '(Live)' : ''}</span>
                        <span style="font-weight:bold; color:${c4}; font-size:13px;">${this.formatTime(lap.time)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:10px;">
                        <span>S1 <span style="color:${c1};">${this.formatTime(lap.s1)}</span></span>
                        <span>S2 <span style="color:${c2};">${this.formatTime(lap.s2)}</span></span>
                        <span>S3 <span style="color:${c3};">${this.formatTime(lap.s3)}</span></span>
                    </div>
                `;
            }
            container.appendChild(tr);
        }
    }



    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const isMap = this.viewType.value === 'map';
        let tf = null;

        if (isMap) {
            const oldCtx = this.app.preview.ctx;
            const oldCanvas = this.app.preview.canvas;

            this.app.preview.ctx = ctx;
            this.app.preview.canvas = this.canvas;

            const oldLayers = { ...this.app.preview.layers };
            this.app.preview.layers = {
                track: true, sectors: true, sectorEdges: true, turnNumbers: true,
                zones: true, straightMode: true, pitLane: true, direction: true,
                chequeredFlag: true, name: false, info: false, sectorLegend: false
            };

            this.app.preview.render(this.app.data, this.app.editor);
            tf = this.app.preview._tf(this.app.editor.getInterpolatedTrack(), this.app.data, this.canvas.width, this.canvas.height);

            this.app.preview.ctx = oldCtx;
            this.app.preview.canvas = oldCanvas;
            this.app.preview.layers = oldLayers;
        } else {
            const oldCtx = this.app.renderer.ctx;
            const oldCanvas = this.app.renderer.canvas;
            const oldOx = this.app.renderer.ox;
            const oldOy = this.app.renderer.oy;
            const oldScale = this.app.renderer.scale;

            this.app.renderer.ctx = ctx;
            this.app.renderer.canvas = this.canvas;
            this.app.renderer.ox = this.ox;
            this.app.renderer.oy = this.oy;
            this.app.renderer.scale = this.scale;

            this.app.renderer.render(this.app.data, this.app.editor, null, null, null);

            this.app.renderer.ctx = oldCtx;
            this.app.renderer.canvas = oldCanvas;
            this.app.renderer.ox = oldOx;
            this.app.renderer.oy = oldOy;
            this.app.renderer.scale = oldScale;
        }

        if (this.hotlapPoints.length > 0 && this.car) {
            let pos = this.getCarPos();
            let s;
            if (isMap && tf) {
                s = tf.toScreen(pos.x, pos.y);
            } else {
                s = this.w2s(pos.x, pos.y);
            }

            ctx.resetTransform();
            ctx.beginPath();
            ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = this.car.color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
        }
    }
};

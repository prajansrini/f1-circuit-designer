/* ============================================================
   preview-renderer.js — F1 Circuit Map (matches official style)
   - Straight mode dashes on ONE side only using strips.png
   - Checkered pattern spanning track width using chequered.png
   - Arrow in circle next to checkered using arrow.png
   - Turn numbers on SIDE (user-placed markers) F1 telemetry style
   - "STRAIGHT MODE ZONE" label only ONCE, along the zone
   - Matches the editor's deep dark premium theme (#0f1a0f)
   ============================================================ */
window.F1 = window.F1 || {};

F1.PreviewRenderer = class PreviewRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.sectorColors = { 1: '#E70E6C', 2: '#FBCF02', 3: '#369BE5' };
        this.bgColor = '#0f1a0f';
        this.infoColor = '#2B44BF';
        this.nameColor = '#7081FF';
        this.layers = {};
        F1.PREVIEW_LAYERS.forEach(l => this.layers[l.key] = l.default);

        // Preload image assets
        this.chequeredImg = new Image();
        this.chequeredImg.src = 'resources/chequered.png';
        this.arrowImg = new Image();
        this.arrowImg.src = 'resources/arrow.png';
        this.stripsImg = new Image();
        this.stripsImg.src = 'resources/strips.png';
        this.userScale = 1; this.userOx = 0; this.userOy = 0;
    }
    zoom(d, sx, sy) {
        const oldScale = this.userScale;
        this.userScale *= (d > 0 ? 0.92 : 1.08);
        this.userScale = Math.max(0.1, Math.min(10, this.userScale));
        const ratio = this.userScale / oldScale;
        this.userOx = sx - this.canvas.width / 2 - (sx - this.canvas.width / 2 - this.userOx) * ratio;
        this.userOy = sy - this.canvas.height / 2 - (sy - this.canvas.height / 2 - this.userOy) * ratio;
    }
    pan(dx, dy) { this.userOx += dx; this.userOy += dy; }
    fitToScreen() { this.userScale = 1; this.userOx = 0; this.userOy = 0; }
    resize() { const c = this.canvas.parentElement; this.canvas.width = c.clientWidth; this.canvas.height = c.clientHeight; }

    _getOutsideSgn(p, data) {
        if (!data || data.controlPoints.length === 0) return 1;
        const cx = data.controlPoints.reduce((sum, cp) => sum + cp.x, 0) / data.controlPoints.length;
        const cy = data.controlPoints.reduce((sum, cp) => sum + cp.y, 0) / data.controlPoints.length;
        const distLeft = Math.hypot(p.x + p.nx - cx, p.y + p.ny - cy);
        const distRight = Math.hypot(p.x - p.nx - cx, p.y - p.ny - cy);
        return distLeft > distRight ? 1 : -1;
    }

    render(data, editor) {
        const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
        ctx.fillStyle = this.bgColor || '#0f1a0f'; ctx.fillRect(0, 0, W, H);
        const track = editor.getInterpolatedTrack();
        if (track.length < 2) { this._placeholder(W, H); return; }
        const tf = this._tf(track, data, W, H);
        if (this.layers.track) { 
            this._trackBase(ctx, track, tf); 
            this._sectorEdges(ctx, track, tf, data); 
            this._renderIntersections(ctx, track, data, tf);
        }
        this._startFinish(ctx, track, data, tf, editor);
        if (this.layers.straightMode) this._straightModeZones(ctx, data, editor, track, tf);
        if (this.layers.pitLane) this._pitLane(ctx, editor, tf);
        if (this.layers.garages) this._garages(ctx, data, tf);
        if (this.layers.grandstands) this._grandstands(ctx, data, tf);
        if (this.layers.turnNumbers) this._turnMarkers(ctx, data, editor, track, tf);
        if (this.layers.sectors) this._sectorLabels(ctx, track, data, tf);
        if (this.layers.zones) this._zones(ctx, data, editor, tf);
        if (this.layers.name !== false) this._name(ctx, data, W, H);
        if (this.layers.info) this._info(ctx, data, editor, W, H);
    }

    _placeholder(W, H) {
        const ctx = this.ctx;
        ctx.fillStyle = '#666'; ctx.font = '16px Outfit'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Draw a circuit and click Generate Map', W / 2, H / 2 - 12);
        ctx.fillStyle = '#888'; ctx.font = '12px Outfit'; ctx.fillText('At least 3 points, then close', W / 2, H / 2 + 12);
    }

    _tf(track, data, W, H) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of track) { const ex = Math.max(p.widthLeft, p.widthRight) + 35; minX = Math.min(minX, p.x - ex); maxX = Math.max(maxX, p.x + ex); minY = Math.min(minY, p.y - ex); maxY = Math.max(maxY, p.y + ex); }
        for (const p of data.pitLane.points) { minX = Math.min(minX, p.x - 25); maxX = Math.max(maxX, p.x + 25); minY = Math.min(minY, p.y - 25); maxY = Math.max(maxY, p.y + 25); }
        const margin = 80, scaleX = (W - margin * 2) / (maxX - minX || 1), scaleY = (H - margin * 2) / (maxY - minY || 1), scale = Math.min(scaleX, scaleY);
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        return { scale: scale * this.userScale, toScreen: (wx, wy) => ({ x: wx * scale * this.userScale + W / 2 - cx * scale * this.userScale + this.userOx, y: wy * scale * this.userScale + H / 2 - cy * scale * this.userScale + this.userOy }) };
    }

    _trackBase(ctx, track, tf) {
        ctx.strokeStyle = '#111111'; ctx.lineWidth = Math.max(16, 20 * tf.scale); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); for (let i = 0; i < track.length; i++) { const s = tf.toScreen(track[i].x, track[i].y); i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y); } ctx.stroke();
    }

    _sectorEdges(ctx, track, tf, data) {
        const lw = Math.max(4, 5 * tf.scale);
        let currentSec = -1;
        let pathStarted = false;
        ctx.lineWidth = lw; ctx.lineCap = 'round';
        
        for (let i = 1; i < track.length; i++) {
            const sec = track[i - 1].sector;
            if (sec === 0) {
                if (pathStarted) { ctx.stroke(); pathStarted = false; }
                continue;
            }
            if (sec !== currentSec || !pathStarted) {
                if (pathStarted) { ctx.stroke(); }
                currentSec = sec;
                ctx.strokeStyle = this.sectorColors[sec] || '#555';
                ctx.beginPath();
                const a = tf.toScreen(track[i - 1].x, track[i - 1].y);
                ctx.moveTo(a.x, a.y);
                pathStarted = true;
            }
            const b = tf.toScreen(track[i].x, track[i].y);
            ctx.lineTo(b.x, b.y);
        }
        if (pathStarted) ctx.stroke();
    }

    _renderIntersections(ctx, track, data, tf) {
        if (!window.app || !window.app.intersections) return;
        
        window.app.intersections.forEach(ix => {
            const key = `${ix.cpA}-${ix.cpB}`;
            const inverted = data.overlapInversions && data.overlapInversions.includes(key);
            let topIdx = Math.max(ix.trackIdxA, ix.trackIdxB);
            if (inverted) topIdx = Math.min(ix.trackIdxA, ix.trackIdxB);

            const span = 25;
            let start = topIdx - span;
            let end = topIdx + span;

            if (!data.isClosed) {
                start = Math.max(0, start);
                end = Math.min(track.length - 1, end);
            }

            const subTrack = [];
            for (let i = start; i <= end; i++) {
                let actualI = i;
                if (actualI < 0) actualI += track.length;
                if (actualI >= track.length) actualI -= track.length;
                if (track[actualI]) subTrack.push(track[actualI]);
            }

            if (subTrack.length > 1) {
                const lwBase = Math.max(16, 20 * tf.scale);
                const lwSectors = Math.max(4, 5 * tf.scale);
                
                ctx.lineCap = 'butt';
                ctx.lineJoin = 'round';
                
                // Draw base background color to mask out bottom track
                ctx.strokeStyle = this.bgColor || '#0f1a0f';
                ctx.lineWidth = lwBase + 2;
                ctx.beginPath();
                subTrack.forEach((p, i) => { const s = tf.toScreen(p.x, p.y); i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y); });
                ctx.stroke();

                // Draw Track Base
                ctx.strokeStyle = '#111111';
                ctx.lineWidth = lwBase;
                ctx.beginPath();
                subTrack.forEach((p, i) => { const s = tf.toScreen(p.x, p.y); i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y); });
                ctx.stroke();

                // Draw sectors
                ctx.lineWidth = lwSectors;
                let currentSec = -1;
                let pathStarted = false;
                for (let i = 1; i < subTrack.length; i++) {
                    const sec = subTrack[i - 1].sector;
                    if (sec === 0) {
                        if (pathStarted) { ctx.stroke(); pathStarted = false; }
                        continue;
                    }
                    if (sec !== currentSec || !pathStarted) {
                        if (pathStarted) { ctx.stroke(); }
                        currentSec = sec;
                        ctx.strokeStyle = this.sectorColors[sec] || '#555';
                        ctx.beginPath();
                        const a = tf.toScreen(subTrack[i - 1].x, subTrack[i - 1].y);
                        ctx.moveTo(a.x, a.y);
                        pathStarted = true;
                    }
                    const b = tf.toScreen(subTrack[i].x, subTrack[i].y);
                    ctx.lineTo(b.x, b.y);
                }
                if (pathStarted) ctx.stroke();
                
                ctx.lineCap = 'round';
            }
        });
    }

    /* Straight mode: red dashes close to track edge using strips.png — same equidistant algorithm as editor */
    _straightModeZones(ctx, data, editor, track, tf) {
        data.zones.filter(z => { const zt = F1.ZONE_TYPES.find(t => t.key === z.type); return zt && zt.range; }).forEach(zone => {
            const si = zone.segIndex * editor.resolution + Math.floor(zone.t * editor.resolution);
            const ei = zone.endSegIndex * editor.resolution + Math.floor(zone.endT * editor.resolution);
            const spacing = zone.stripSpacing || 2;
            const sw = zone.stripWidth || 5;
            const targetGap = spacing * 5;

            let stripPoints = [];
            let currentDist = 0;
            let prevP = null;

            const addStripPoints = (startIdx, endIdx, sideSign) => {
                for (let i = startIdx; i <= endIdx; i++) {
                    const p = track[i];
                    const offset = 16 + sw;
                    const ox = p.x + p.nx * offset * sideSign;
                    const oy = p.y + p.ny * offset * sideSign;

                    if (!prevP) {
                        stripPoints.push({ x: ox, y: oy, nx: p.nx, ny: p.ny });
                        prevP = { x: ox, y: oy, nx: p.nx, ny: p.ny };
                        currentDist = 0;
                        continue;
                    }

                    let dx = ox - prevP.x;
                    let dy = oy - prevP.y;
                    let d = Math.hypot(dx, dy);

                    if (d > 0.0001) {
                        while (currentDist + d >= targetGap) {
                            const needed = targetGap - currentDist;
                            const t = needed / d;

                            const exactX = prevP.x + dx * t;
                            const exactY = prevP.y + dy * t;
                            let exactNx = prevP.nx + (p.nx - prevP.nx) * t;
                            let exactNy = prevP.ny + (p.ny - prevP.ny) * t;
                            if (isNaN(exactNx) || isNaN(exactNy)) { exactNx = p.nx; exactNy = p.ny; }

                            stripPoints.push({ x: exactX, y: exactY, nx: exactNx, ny: exactNy });

                            currentDist = 0;
                            prevP = { x: exactX, y: exactY, nx: exactNx, ny: exactNy };
                            dx = ox - prevP.x;
                            dy = oy - prevP.y;
                            d = Math.hypot(dx, dy);
                            if (d < 0.0001) break;
                        }
                        currentDist += d;
                    }
                    prevP = { x: ox, y: oy, nx: p.nx, ny: p.ny };
                }
            };

            const generateStripsForSide = (sideSign) => {
                stripPoints = [];
                currentDist = 0;
                prevP = null;
                if (si <= ei) {
                    addStripPoints(si, ei, sideSign);
                } else if (data.isClosed) {
                    addStripPoints(si, track.length - 1, sideSign);
                    addStripPoints(0, ei, sideSign);
                } else {
                    addStripPoints(ei, si, sideSign);
                }

                const n = stripPoints.length;
                for (let idx = 0; idx < n; idx++) {
                    const sp = stripPoints[idx];
                    const taper = (idx === 0 || idx === n - 1) ? 1.0 : 0.35;
                    const L_half = sw * taper;

                    const s = tf.toScreen(sp.x, sp.y);
                    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(sp.ny, sp.nx));

                    const shiftX = -(sw - L_half) * tf.scale;
                    const len = L_half * 2 * tf.scale;
                    const thick = sw * 0.6 * tf.scale;

                    if (this.stripsImg.complete && this.stripsImg.naturalWidth > 0) {
                        ctx.drawImage(this.stripsImg, shiftX - len / 2, -thick / 2, len, thick);
                    } else {
                        ctx.fillStyle = '#ff1801';
                        ctx.fillRect(shiftX - len / 2, -thick / 2, len, thick);
                    }
                    ctx.restore();
                }
            };

            generateStripsForSide(zone.side === 'left' ? -1 : 1);

            // Text-on-path label: render only if this zone has showLabel
            if (zone.showLabel !== false) {
                const sgn = zone.side === 'left' ? -1 : 1;
                let pathPts = [];
                const buildPath = (startIdx, endIdx) => {
                    for (let i = startIdx; i <= endIdx; i++) {
                        const p = track[i];
                        const offset = 16 + sw + sw + 12;
                        pathPts.push({ x: p.x + p.nx * offset * sgn, y: p.y + p.ny * offset * sgn });
                    }
                };
                if (si <= ei) { buildPath(si, ei); }
                else if (data.isClosed) { buildPath(si, track.length - 1); buildPath(0, ei); }
                else { buildPath(ei, si); }

                // Flip: reverse the path so text reads the opposite direction
                if (zone.labelFlipped) { pathPts.reverse(); }

                if (pathPts.length > 1) {
                    let cumLen = [0];
                    for (let i = 1; i < pathPts.length; i++) {
                        cumLen.push(cumLen[i - 1] + Math.hypot(pathPts[i].x - pathPts[i - 1].x, pathPts[i].y - pathPts[i - 1].y));
                    }
                    const totalLen = cumLen[cumLen.length - 1];

                    const fontSizeScreen = (zone.labelFontSize || 10);
                    // Use the constant screen font size for measurement
                    ctx.font = `bold ${fontSizeScreen}px Outfit`;
                    const text = (zone.label || "STRAIGHT MODE ZONE").toUpperCase().replace(/\n/g, ' ');
                    
                    const charWidthsWorld = [];
                    let totalTextWWorld = 0;
                    for (let c = 0; c < text.length; c++) {
                        // Measure in screen pixels, then convert to world distance
                        const cwScreen = ctx.measureText(text[c]).width;
                        const cwWorld = cwScreen / tf.scale;
                        charWidthsWorld.push(cwWorld);
                        totalTextWWorld += cwWorld;
                    }
                    const charGapWorld = 1 / tf.scale;
                    totalTextWWorld += charGapWorld * (text.length - 1);

                    let startOffset = (totalLen - totalTextWWorld) / 2;
                    if (startOffset < 0) startOffset = 0;

                    const getPointAt = (dist) => {
                        if (dist <= 0) return { x: pathPts[0].x, y: pathPts[0].y, angle: Math.atan2(pathPts[1].y - pathPts[0].y, pathPts[1].x - pathPts[0].x) };
                        if (dist >= totalLen) {
                            const last = pathPts.length - 1;
                            return { x: pathPts[last].x, y: pathPts[last].y, angle: Math.atan2(pathPts[last].y - pathPts[last - 1].y, pathPts[last].x - pathPts[last - 1].x) };
                        }
                        for (let i = 1; i < cumLen.length; i++) {
                            if (cumLen[i] >= dist) {
                                const segLen = cumLen[i] - cumLen[i - 1];
                                const t = segLen > 0 ? (dist - cumLen[i - 1]) / segLen : 0;
                                return {
                                    x: pathPts[i - 1].x + (pathPts[i].x - pathPts[i - 1].x) * t,
                                    y: pathPts[i - 1].y + (pathPts[i].y - pathPts[i - 1].y) * t,
                                    angle: Math.atan2(pathPts[i].y - pathPts[i - 1].y, pathPts[i].x - pathPts[i - 1].x)
                                };
                            }
                        }
                        return { x: pathPts[0].x, y: pathPts[0].y, angle: 0 };
                    };

                    let curDist = startOffset;
                    ctx.fillStyle = '#ff1801';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    for (let c = 0; c < text.length; c++) {
                        const charMid = curDist + charWidthsWorld[c] / 2;
                        const pt = getPointAt(charMid);
                        const s = tf.toScreen(pt.x, pt.y);
                        ctx.save();
                        ctx.translate(s.x, s.y);
                        ctx.rotate(pt.angle);
                        // Draw with constant screen size
                        ctx.font = `bold ${fontSizeScreen}px Outfit`;
                        ctx.fillText(text[c], 0, 0);
                        ctx.restore();
                        curDist += charWidthsWorld[c] + charGapWorld;
                    }
                }
            }
        });
    }

    /* Checkered flag spanning track + arrow next to it using preloaded PNGs */
    _startFinish(ctx, track, data, tf, editor) {
        if (track.length < 4) return;
        let p = track[0], p2 = track[1];
        if (data.startNodeId && editor) {
            const cpIdx = data.controlPoints.findIndex(cp => cp.id === data.startNodeId);
            if (cpIdx >= 0) {
                const trkIdx = cpIdx * editor.resolution;
                p = track[trkIdx] || track[0];
                p2 = track[trkIdx + 1] || track[1];
            }
        }
        const angle = Math.atan2(p2.y - p.y, p2.x - p.x);

        // Checkered flag spanning track width, aligned with direction
        if (this.layers.chequeredFlag !== false) {
            const l = tf.toScreen(p.x - p.nx * p.widthLeft, p.y - p.ny * p.widthLeft);
            const r = tf.toScreen(p.x + p.nx * p.widthRight, p.y + p.ny * p.widthRight);

            if (this.chequeredImg.complete && this.chequeredImg.naturalWidth > 0) {
                ctx.save();
                const s = tf.toScreen(p.x, p.y);
                ctx.translate(s.x, s.y);
                ctx.rotate(angle + Math.PI / 2);
                const tw = (p.widthLeft + p.widthRight) * tf.scale;
                const th = 8 * tf.scale;
                ctx.drawImage(this.chequeredImg, -tw / 2, -th / 2, tw, th);
                ctx.restore();
            } else {
                // Procedural checkered fallback
                const dx = r.x - l.x, dy = r.y - l.y, len = Math.hypot(dx, dy);
                if (len > 2) {
                    const ux = dx / len, uy = dy / len, px = -uy, py = ux;
                    const checks = Math.max(6, Math.round(len / 4)), cw = len / checks;
                    const ch = Math.max(3, 5 * tf.scale);
                    for (let row = 0; row < 2; row++)for (let col = 0; col < checks; col++) {
                        ctx.fillStyle = (row + col) % 2 === 0 ? '#fff' : '#000';
                        ctx.fillRect(l.x + ux * col * cw + px * row * ch, l.y + uy * col * cw + py * row * ch, cw + .5, ch + .5);
                    }
                }
            }
        }

        // Direction arrow — using provided SVG
        if (this.layers.direction !== false) {
            ctx.save();
            const s2 = tf.toScreen(p.x, p.y);
            ctx.translate(s2.x, s2.y);
            ctx.rotate(angle);
            ctx.translate(13 * tf.scale, 0); // 4px flag half + 6px gap + 3px arrow base

            const svgScale = (16 * tf.scale) / 24;
            ctx.scale(svgScale, svgScale);
            ctx.rotate(Math.PI / 4); // point it forward
            ctx.translate(-12, -12); // center the 24x24 SVG

            ctx.fillStyle = '#fff';
            ctx.fill(new Path2D("M21.15,2.86a2.89,2.89,0,0,0-3-.71L4,6.88a2.9,2.9,0,0,0-.12,5.47l5.24,2h0a.93.93,0,0,1,.53.52l2,5.25A2.87,2.87,0,0,0,14.36,22h.07a2.88,2.88,0,0,0,2.69-2L21.85,5.83A2.89,2.89,0,0,0,21.15,2.86ZM20,5.2,15.22,19.38a.88.88,0,0,1-.84.62.92.92,0,0,1-.87-.58l-2-5.25a2.91,2.91,0,0,0-1.67-1.68l-5.25-2A.9.9,0,0,1,4,9.62a.88.88,0,0,1,.62-.84L18.8,4.05A.91.91,0,0,1,20,5.2Z"));
            ctx.restore();
        }
    }

    _pitLane(ctx, editor, tf) {
        const pit = editor.getInterpolatedPitLane(); if (pit.length < 2) return;
        ctx.strokeStyle = '#383838'; ctx.lineWidth = Math.max(8, 10 * tf.scale); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); for (let i = 0; i < pit.length; i++) { const s = tf.toScreen(pit[i].x, pit[i].y); i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y); } ctx.stroke();
        ctx.strokeStyle = '#888'; ctx.lineWidth = Math.max(1, 1.5 * tf.scale); ctx.setLineDash([4, 4]);
        ctx.beginPath(); for (let i = 0; i < pit.length; i++) { const s = tf.toScreen(pit[i].x, pit[i].y); i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y); } ctx.stroke(); ctx.setLineDash([]);
    }

    _garages(ctx, data, tf) {
        data.garages.forEach(g => {
            const s = tf.toScreen(g.x, g.y); ctx.save(); ctx.translate(s.x, s.y); ctx.rotate((g.rotation || 0) * Math.PI / 180);
            const w = g.width * tf.scale, h = g.height * tf.scale;
            ctx.fillStyle = g.color || '#555'; ctx.globalAlpha = 0.7; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.globalAlpha = 1;
            ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1; ctx.strokeRect(-w / 2, -h / 2, w, h);
            ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(5, 6 * tf.scale)}px Outfit`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(g.teamName || '', 0, 0); ctx.restore();
        });
    }

    _grandstands(ctx, data, tf) {
        data.grandstands.forEach(gs => {
            const s = tf.toScreen(gs.x, gs.y); ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(gs.rotation * Math.PI / 180);
            const w = gs.width * tf.scale, h = gs.height * tf.scale;
            ctx.fillStyle = 'rgba(85,85,85,0.7)'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeStyle = '#888'; ctx.lineWidth = 1; ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.restore();
        });
    }

    /* Turn markers on the SIDE of the track (user-placed, like reference image) */
    _turnMarkers(ctx, data, editor, track, tf) {
        data.turnMarkers.forEach(tm => {
            const idx = tm.segIndex * editor.resolution + Math.floor(tm.t * editor.resolution);
            const p = track[Math.min(idx, track.length - 1)];
            if (!p) return;
            const actualSgn = tm.side === 'left' ? -1 : 1;
            const w = actualSgn < 0 ? p.widthLeft : p.widthRight;
            const sf = Math.max(0.9, tf.scale);
            const circleRadiusPx = 11 * sf;
            const sCenter = tf.toScreen(p.x, p.y);
            // Constant 7 pixel gap from the visual road edge
            const distPx = w * tf.scale + circleRadiusPx + 7;
            const s = { x: sCenter.x + p.nx * distPx * actualSgn, y: sCenter.y + p.ny * distPx * actualSgn };

            ctx.save(); ctx.translate(s.x, s.y); ctx.rotate((tm.rotation || 0) * Math.PI / 180);
            ctx.beginPath(); ctx.arc(0, 0, circleRadiusPx, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.strokeStyle = '#000000'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.fillStyle = '#000'; ctx.font = `bold ${10 * sf}px Outfit`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(tm.label, 0, 0);
            if (tm.name) {
                ctx.fillStyle = '#333'; ctx.font = `normal ${8 * sf}px Outfit`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(tm.name.toUpperCase(), 0, -16 * sf);
            }
            ctx.restore();
        });
    }

    /* Movable Sector Labels */
    _sectorLabels(ctx, track, data, tf) {
        data.sectorLabels.forEach(sl => {
            const pts = track.filter(pt => pt.sector === sl.sector);
            if (!pts.length) return;
            const mid = pts[Math.floor(pts.length / 2)];
            const sMid = tf.toScreen(mid.x, mid.y);
            const lx = sMid.x + sl.labelOffsetX * tf.scale;
            const ly = sMid.y + sl.labelOffsetY * tf.scale;

            // Connected line removed as per user request

            // Label container
            const text = `SECTOR ${sl.sector}`;
            const sf = Math.max(0.9, tf.scale);
            ctx.font = `bold ${8 * sf}px Outfit`;
            const tw = ctx.measureText(text).width + 10 * sf, th = 13 * sf;

            ctx.save(); ctx.translate(lx, ly); ctx.rotate((sl.rotation || 0) * Math.PI / 180);
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(-tw / 2, -th / 2, tw, th, 4); ctx.fill();
            ctx.strokeStyle = sl.sector === 1 ? '#f20089' : sl.sector === 2 ? '#ffb700' : '#00aaff';
            ctx.lineWidth = 1.5; ctx.stroke();
            ctx.fillStyle = '#000000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, 0);
            ctx.restore();
        });
    }

    _zones(ctx, data, editor, tf) {
        data.zones.forEach(zone => {
            const zt = F1.ZONE_TYPES.find(z => z.key === zone.type);
            if (!zt || zt.range) return;
            const pos = editor.getZoneWorldPos(zone); if (!pos) return;
            const s = tf.toScreen(pos.x, pos.y);

            // Draw line connecting track to label container FIRST
            const lx = s.x + zone.labelOffsetX * tf.scale;
            const ly = s.y + zone.labelOffsetY * tf.scale;
            ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, ly); ctx.lineTo(lx, ly); ctx.stroke();

            // Draw anchor circle on track ON TOP of the line
            ctx.beginPath(); ctx.arc(s.x, s.y, 5 * tf.scale, 0, Math.PI * 2);
            ctx.fillStyle = zt.color; ctx.fill();
            if (zone.type === 'overtake_activation') {
                ctx.beginPath(); ctx.arc(s.x, s.y, 2 * tf.scale, 0, Math.PI * 2);
                ctx.fillStyle = '#181818'; ctx.fill();
            } else {
                ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.stroke();
            }

            // Label container
            const sf = Math.max(0.9, tf.scale);
            ctx.font = `bold ${10 * sf}px Outfit`;
            const text = (zone.label || zt.label || '').toUpperCase();
            const lines = text.split('\n');
            const tw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 16 * sf;
            const th = lines.length * 16 * sf + 6 * sf;

            ctx.save(); ctx.translate(lx, ly); ctx.rotate((zone.rotation || 0) * Math.PI / 180);
            ctx.fillStyle = zt.color; ctx.beginPath(); ctx.roundRect(-tw / 2, -th / 2, tw, th, 4); ctx.fill();
            ctx.fillStyle = zt.textColor || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            if (lines.length === 1) {
                ctx.fillText(text, 0, 0);
            } else {
                lines.forEach((l, i) => ctx.fillText(l, 0, (i - (lines.length - 1) / 2) * 14 * sf));
            }
            ctx.restore();
        });
    }

    _name(ctx, data, W, H) {
        ctx.fillStyle = this.nameColor || '#fff'; ctx.font = 'bold 24px Outfit'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        const px = data.namePos ? data.namePos.x : 20;
        const py = data.namePos ? data.namePos.y : 16;
        ctx.fillText(data.name || 'Circuit', px, py);
    }

    _info(ctx, data, editor, W, H) {
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        const len = editor.getTrackLength() * ((data.gridSize || 50) / 50.0);
        const px = data.namePos ? data.namePos.x : 20;
        const py = data.namePos ? data.namePos.y : 16;
        if (len > 0) { ctx.fillStyle = this.infoColor || '#ccc'; ctx.font = '14px Outfit'; ctx.fillText(`Track Length: ${len.toFixed(0)}m (${(len / 1000).toFixed(3)} km)`, px, py + 30); }
        ctx.fillStyle = this.infoColor || '#999'; ctx.font = '12px Outfit'; ctx.fillText(`${data.turnMarkers.length} Turns`, px, py + 52);
        const ly = H - 30; ctx.font = 'bold 10px Outfit'; let lx = 20;
        [{ l: 'SECTOR 1', c: this.sectorColors[1] }, { l: 'SECTOR 2', c: this.sectorColors[2] }, { l: 'SECTOR 3', c: this.sectorColors[3] }].forEach(item => {
            ctx.fillStyle = item.c; ctx.fillRect(lx, ly, 12, 12); ctx.fillStyle = this.infoColor || '#ccc'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(item.l, lx + 16, ly + 6); lx += ctx.measureText(item.l).width + 32;
        });
    }
};

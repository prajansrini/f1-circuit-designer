/* ============================================================
   canvas-renderer.js — Editor Canvas Rendering
   - Straight mode: red dashes on ONE side only (outside)
   - Checkered flag: 🏁 aligned with track direction
   - Arrow: ▶ in circle, right next to checkered
   - Node points hideable, no auto turn numbers
   - Turn markers placed separately by user
   ============================================================ */
window.F1 = window.F1 || {};

F1.Renderer = class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ox = 0; this.oy = 0; this.scale = 1;
        this.showGrid = true; this.showCtrlPts = true;
        this.gridSize = 50; this.gridColor = '#ffffff'; this.gridOpacity = 0.04;
        this.C = {
            bg: '#0f1a0f', grass: '#1e3d1e', track: '#2a2a2a', trackEdge: '#cccccc',
            gravel: '#b8a070', asphaltRun: '#444', barrier: '#e10600',
            pitLane: '#383838', pitLine: '#ffff00',
            s1: '#E70E6C', s2: '#FBCF02', s3: '#369BE5',
            cp: '#00ff88', cpSel: '#ff8800', cpHover: '#66ffbb',
            grid: 'rgba(255,255,255,0.04)', gsRoof: ['#e10600', '#0050b0', '#e8a700', '#888']
        };

        // Preload image assets
        this.chequeredImg = new Image();
        this.chequeredImg.src = 'resources/chequered.png';
        this.arrowImg = new Image();
        this.arrowImg.src = 'resources/arrow.png';
        this.stripsImg = new Image();
        this.stripsImg.src = 'resources/strips.png';

        this.resize();
    }
    resize() { const c = this.canvas.parentElement; this.canvas.width = c.clientWidth; this.canvas.height = c.clientHeight; }
    w2s(wx, wy) { return { x: (wx + this.ox) * this.scale + this.canvas.width / 2, y: (wy + this.oy) * this.scale + this.canvas.height / 2 }; }
    s2w(sx, sy) { return { x: (sx - this.canvas.width / 2) / this.scale - this.ox, y: (sy - this.canvas.height / 2) / this.scale - this.oy }; }
    zoom(d, sx, sy) { const b = this.s2w(sx, sy); this.scale *= d > 0 ? .92 : 1.08; this.scale = Math.max(.05, Math.min(20, this.scale)); const a = this.s2w(sx, sy); this.ox += a.x - b.x; this.oy += a.y - b.y; }
    pan(dx, dy) { this.ox += dx / this.scale; this.oy += dy / this.scale; }
    fitToScreen(data) {
        if (!data || data.controlPoints.length === 0) { this.ox = 0; this.oy = 0; this.scale = 1; return; }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of data.controlPoints) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
        const scaleX = (this.canvas.width - 200) / (maxX - minX || 1), scaleY = (this.canvas.height - 200) / (maxY - minY || 1);
        this.scale = Math.min(Math.min(scaleX, scaleY), 5);
        this.ox = -(minX + maxX) / 2; this.oy = -(minY + maxY) / 2;
    }

    _getOutsideSgn(p, data) {
        if (!data || data.controlPoints.length === 0) return 1;
        const cx = data.controlPoints.reduce((sum, cp) => sum + cp.x, 0) / data.controlPoints.length;
        const cy = data.controlPoints.reduce((sum, cp) => sum + cp.y, 0) / data.controlPoints.length;
        const distLeft = Math.hypot(p.x + p.nx - cx, p.y + p.ny - cy);
        const distRight = Math.hypot(p.x - p.nx - cx, p.y - p.ny - cy);
        return distLeft > distRight ? 1 : -1;
    }

    render(data, editor, sel, hoverPt, activeTool) {
        this._editor = editor;
        const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
        ctx.fillStyle = this.C.bg; ctx.fillRect(0, 0, W, H);
        if (this.showGrid) this._grid();
        const track = editor.getInterpolatedTrack();
        if (track.length > 1) {
            this._surfaces(track); this._trackSurface(track); this._sectorStripes(track);
            this._barriers(track); this._straightModeZones(data, editor, track, sel);
            this._startFinish(track, data);
        }
        this._pitLane(editor); this._garages(data, sel); this._grandstands(data, sel);
        this._zones(data, editor, sel); this._sectorLabels(data, editor, sel); this._turnMarkers(data, editor, sel);
        if (this.showCtrlPts) { this._controlPoints(data, sel, hoverPt); }
        this._pitPoints(data, sel, activeTool);
        this._rotationHandles(data, editor, sel);
    }

    _grid() {
        const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, step = this.gridSize;
        const tl = this.s2w(0, 0), br = this.s2w(W, H);
        ctx.strokeStyle = this.gridColor; ctx.globalAlpha = this.gridOpacity; ctx.lineWidth = 1; ctx.beginPath();
        for (let x = Math.floor(tl.x / step) * step; x <= br.x; x += step) { const s = this.w2s(x, 0); ctx.moveTo(s.x, 0); ctx.lineTo(s.x, H); }
        for (let y = Math.floor(tl.y / step) * step; y <= br.y; y += step) { const s = this.w2s(0, y); ctx.moveTo(0, s.y); ctx.lineTo(W, s.y); }
        ctx.stroke(); ctx.globalAlpha = 1;
    }

    _surfaces(track) { this._surfSide(track, 'left'); this._surfSide(track, 'right'); }
    _surfSide(track, side) {
        const ctx = this.ctx, isL = side === 'left'; let i = 0;
        while (i < track.length - 1) {
            const st = isL ? track[i].surfaceLeft : track[i].surfaceRight;
            if (st === 'none') { i++; continue; }
            let j = i; while (j < track.length - 1 && (isL ? track[j].surfaceLeft : track[j].surfaceRight) === st) j++;
            ctx.fillStyle = st === 'gravel' ? this.C.gravel : st === 'asphalt' ? this.C.asphaltRun : this.C.grass;
            ctx.beginPath();
            for (let k = i; k <= Math.min(j, track.length - 1); k++) {
                const p = track[k], sw = isL ? (p.surfaceWidthLeft ?? 10) : (p.surfaceWidthRight ?? 10), w = (isL ? p.widthLeft : p.widthRight) + sw, sgn = isL ? -1 : 1;
                const s = this.w2s(p.x + p.nx * w * sgn, p.y + p.ny * w * sgn); k === i ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y);
            }
            for (let k = Math.min(j, track.length - 1); k >= i; k--) {
                const p = track[k], w = isL ? p.widthLeft : p.widthRight, sgn = isL ? -1 : 1;
                const s = this.w2s(p.x + p.nx * w * sgn, p.y + p.ny * w * sgn); ctx.lineTo(s.x, s.y);
            }
            ctx.closePath(); ctx.fill(); i = j;
        }
    }

    _trackSurface(track) {
        const ctx = this.ctx;
        ctx.fillStyle = this.C.track; ctx.beginPath();
        for (let i = 0; i < track.length; i++) { const p = track[i], s = this.w2s(p.x - p.nx * p.widthLeft, p.y - p.ny * p.widthLeft); i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y); }
        for (let i = track.length - 1; i >= 0; i--) { const p = track[i], s = this.w2s(p.x + p.nx * p.widthRight, p.y + p.ny * p.widthRight); ctx.lineTo(s.x, s.y); }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = this.C.trackEdge; ctx.lineWidth = Math.max(1, 1.5 * this.scale);
        ctx.beginPath(); for (let i = 0; i < track.length; i++) { const p = track[i], s = this.w2s(p.x - p.nx * p.widthLeft, p.y - p.ny * p.widthLeft); i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y); } ctx.stroke();
        ctx.beginPath(); for (let i = 0; i < track.length; i++) { const p = track[i], s = this.w2s(p.x + p.nx * p.widthRight, p.y + p.ny * p.widthRight); i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y); } ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = Math.max(.5, .8 * this.scale); ctx.setLineDash([8 * this.scale, 12 * this.scale]);
        ctx.beginPath(); for (let i = 0; i < track.length; i++) { const s = this.w2s(track[i].x, track[i].y); i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y); } ctx.stroke(); ctx.setLineDash([]);
    }

    _sectorStripes(track) {
        const ctx = this.ctx, sw = Math.max(2, 3 * this.scale);
        for (let i = 1; i < track.length; i++) {
            const sec = track[i - 1].sector; if (sec === 0) continue;
            ctx.strokeStyle = sec === 1 ? this.C.s1 : sec === 2 ? this.C.s2 : this.C.s3;
            ctx.lineWidth = sw; ctx.globalAlpha = 0.7;
            const a = this.w2s(track[i - 1].x - track[i - 1].nx * (track[i - 1].widthLeft + 2), track[i - 1].y - track[i - 1].ny * (track[i - 1].widthLeft + 2));
            const b = this.w2s(track[i].x - track[i].nx * (track[i].widthLeft + 2), track[i].y - track[i].ny * (track[i].widthLeft + 2));
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    _barriers(track) {
        const ctx = this.ctx; ctx.strokeStyle = this.C.barrier; ctx.lineWidth = Math.max(3, 4 * this.scale);
        let inB = false; ctx.beginPath();
        for (let i = 0; i < track.length; i++) { const p = track[i]; if (p.barrierLeft) { const w = p.widthLeft + (p.surfaceWidthLeft ?? 10); const s = this.w2s(p.x - p.nx * w, p.y - p.ny * w); inB ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); inB = true; } else inB = false; }
        ctx.stroke(); inB = false; ctx.beginPath();
        for (let i = 0; i < track.length; i++) { const p = track[i]; if (p.barrierRight) { const w = p.widthRight + (p.surfaceWidthRight ?? 10); const s = this.w2s(p.x + p.nx * w, p.y + p.ny * w); inB ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); inB = true; } else inB = false; }
        ctx.stroke();
    }

    /* Straight Mode - red dashes close to track edge using strips.png */
    _straightModeZones(data, editor, track, sel) {
        const ctx = this.ctx;
        const firstSMZ = data.zones.find(z => z.type === 'straight_mode');
        data.zones.filter(z => { const zt = F1.ZONE_TYPES.find(t => t.key === z.type); return zt && zt.range; }).forEach(zone => {
            const si = zone.segIndex * editor.resolution + Math.floor(zone.t * editor.resolution);
            const ei = zone.endSegIndex * editor.resolution + Math.floor(zone.endT * editor.resolution);
            const spacing = zone.stripSpacing || 2;
            const sw = zone.stripWidth || 5;

            const targetGap = spacing * 5; // e.g. 5m to 75m
            let stripPoints = [];
            let currentDist = 0;
            let prevP = null;

            const addStripPoints = (startIdx, endIdx, sideSign) => {
                for (let i = startIdx; i <= endIdx; i++) {
                    const p = track[i];
                    const w = sideSign < 0 ? p.widthLeft : p.widthRight;
                    const offset = w + 6 + sw;
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
                
                for (let sp of stripPoints) {
                    const s = this.w2s(sp.x, sp.y);
                    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(sp.ny, sp.nx));
                    if (this.stripsImg.complete && this.stripsImg.naturalWidth > 0) {
                        ctx.drawImage(this.stripsImg, -sw * this.scale, -sw * 0.5 * this.scale, sw * 2 * this.scale, sw * this.scale);
                    } else {
                        ctx.fillStyle = '#ff1801';
                        ctx.fillRect(-sw * this.scale, -sw * 0.3 * this.scale, sw * 2 * this.scale, sw * 0.6 * this.scale);
                    }
                    ctx.restore();
                }
            };

            if (zone.side === 'both') {
                generateStripsForSide(-1);
                generateStripsForSide(1);
            } else {
                generateStripsForSide(zone.side === 'left' ? -1 : 1);
            }
            const isSel = sel && sel.type === 'zone' && sel.id === zone.id;

            // Render label
            let midIdx = si;
            if (si <= ei) {
                midIdx = Math.floor((si + ei) / 2);
            } else if (data.isClosed) {
                const dist = (track.length - si) + ei;
                midIdx = (si + Math.floor(dist / 2)) % track.length;
            }
            const pMid = track[midIdx];
            if (pMid) {
                const sMid = this.w2s(pMid.x, pMid.y);
                const lx = sMid.x + (zone.labelOffsetX || 0) * this.scale;
                const ly = sMid.y + (zone.labelOffsetY || 0) * this.scale;
                ctx.save(); ctx.translate(lx, ly); ctx.rotate((zone.rotation || 0) * Math.PI / 180);
                const sf = Math.max(0.9, this.scale);
                ctx.font = `bold ${10 * sf}px Outfit`;
                let text = (zone.label || "STRAIGHT MODE ZONE").toUpperCase().replace(/\n/g, ' ');
                const tw = ctx.measureText(text).width + 16 * sf, th = 22 * sf;
                if (isSel) {
                    const hd = (th / 2) + 25; // slightly higher
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -hd);
                    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); // white line
                    ctx.beginPath(); ctx.arc(0, -hd, 6 * sf, 0, Math.PI * 2); // bigger dot
                    ctx.fillStyle = '#00ff88'; ctx.fill(); 
                    ctx.strokeStyle = '#000000'; ctx.lineWidth = 1; ctx.stroke(); // black border
                }

                ctx.fillStyle = '#ff1801'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, 0);
                ctx.restore();
            }
        });
    }

    /* Checkered flag 🏁 aligned with track + arrow next to it using preloaded PNGs */
    _startFinish(track, data) {
        if (!data.isClosed || track.length < 4) return;
        const ctx = this.ctx, p = track[0], p2 = track[1];
        const angle = Math.atan2(p2.y - p.y, p2.x - p.x);

        // Checkered flag spanning track width, aligned with direction
        const l = this.w2s(p.x + p.nx * p.widthLeft, p.y + p.ny * p.widthLeft);
        const r = this.w2s(p.x - p.nx * p.widthRight, p.y - p.ny * p.widthRight);

        if (this.chequeredImg.complete && this.chequeredImg.naturalWidth > 0) {
            ctx.save();
            const s = this.w2s(p.x, p.y);
            ctx.translate(s.x, s.y);
            ctx.rotate(angle + Math.PI / 2);
            const tw = (p.widthLeft + p.widthRight) * this.scale;
            const th = 8 * this.scale;
            ctx.drawImage(this.chequeredImg, -tw / 2, -th / 2, tw, th);
            ctx.restore();
        } else {
            // Procedural checkered fallback
            const dx = r.x - l.x, dy = r.y - l.y, len = Math.hypot(dx, dy);
            if (len > 2) {
                const ux = dx / len, uy = dy / len, px = -uy, py = ux;
                const checks = Math.max(6, Math.round(len / 4)), cw = len / checks;
                const ch = Math.max(3, 5 * this.scale);
                for (let row = 0; row < 2; row++)for (let col = 0; col < checks; col++) {
                    ctx.fillStyle = (row + col) % 2 === 0 ? '#fff' : '#000';
                    ctx.fillRect(l.x + ux * col * cw + px * row * ch, l.y + uy * col * cw + py * row * ch, cw + .5, ch + .5);
                }
            }
        }

        // Direction arrow — half size, right next to checkered flag
        const ai = Math.min(1, track.length - 2);
        const ap = track[ai], anp = track[ai + 1];
        const as = this.w2s(ap.x, ap.y);
        const aAngle = Math.atan2(anp.y - ap.y, anp.x - ap.x);
        if (this.arrowImg.complete && this.arrowImg.naturalWidth > 0) {
            ctx.save(); ctx.translate(as.x, as.y); ctx.rotate(aAngle);
            const ar = Math.max(6, 7 * this.scale);
            ctx.drawImage(this.arrowImg, -ar, -ar, ar * 2, ar * 2); ctx.restore();
        } else {
            const ar = Math.max(5, 6 * this.scale);
            ctx.beginPath(); ctx.arc(as.x, as.y, ar, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.save(); ctx.translate(as.x, as.y); ctx.rotate(aAngle); ctx.fillStyle = '#fff'; ctx.beginPath();
            ctx.moveTo(ar * 0.5, 0); ctx.lineTo(-ar * 0.3, -ar * 0.35); ctx.lineTo(-ar * 0.3, ar * 0.35); ctx.closePath(); ctx.fill(); ctx.restore();
        }
    }

    _pitLane(editor) {
        const pit = editor.getInterpolatedPitLane(); if (pit.length < 2) return;
        const ctx = this.ctx, w = editor.data.pitLane.width;
        ctx.fillStyle = this.C.pitLane; ctx.beginPath();
        for (let i = 0; i < pit.length; i++) { const s = this.w2s(pit[i].x + (pit[i].nx || 0) * w, pit[i].y + (pit[i].ny || 0) * w); i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y); }
        for (let i = pit.length - 1; i >= 0; i--) { const s = this.w2s(pit[i].x - (pit[i].nx || 0) * w, pit[i].y - (pit[i].ny || 0) * w); ctx.lineTo(s.x, s.y); }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#888'; ctx.lineWidth = Math.max(1, 1.2 * this.scale);
        ctx.beginPath(); for (let i = 0; i < pit.length; i++) { const s = this.w2s(pit[i].x + (pit[i].nx || 0) * w, pit[i].y + (pit[i].ny || 0) * w); i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y); } ctx.stroke();
        ctx.beginPath(); for (let i = 0; i < pit.length; i++) { const s = this.w2s(pit[i].x - (pit[i].nx || 0) * w, pit[i].y - (pit[i].ny || 0) * w); i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y); } ctx.stroke();
        ctx.strokeStyle = this.C.pitLine; ctx.lineWidth = Math.max(1, 1.5 * this.scale); ctx.setLineDash([6 * this.scale, 6 * this.scale]);
        ctx.beginPath(); for (let i = 0; i < pit.length; i++) { const s = this.w2s(pit[i].x, pit[i].y); i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y); } ctx.stroke(); ctx.setLineDash([]);
        if (pit.length > 4) { const mid = pit[Math.floor(pit.length / 2)], s = this.w2s(mid.x, mid.y); ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(10, 12 * this.scale)}px Outfit`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PIT LANE', s.x, s.y); }
    }

    _garages(data, sel) {
        const ctx = this.ctx;
        data.garages.forEach(g => {
            ctx.save(); const s = this.w2s(g.x, g.y); ctx.translate(s.x, s.y); ctx.rotate((g.rotation || 0) * Math.PI / 180);
            const w = g.width * this.scale, h = g.height * this.scale;
            ctx.fillStyle = g.color || '#555'; ctx.globalAlpha = 0.7; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.globalAlpha = 1;
            const isSel = sel && sel.type === 'garage' && sel.id === g.id;
            ctx.strokeStyle = isSel ? '#00ff88' : '#aaa'; ctx.lineWidth = isSel ? 2 : 1; ctx.strokeRect(-w / 2, -h / 2, w, h);
            ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(6, 7 * this.scale)}px Outfit`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(g.teamName || 'Garage', 0, 0); ctx.restore();
        });
    }

    _grandstands(data, sel) {
        const ctx = this.ctx;
        data.grandstands.forEach((gs, idx) => {
            ctx.save(); const s = this.w2s(gs.x, gs.y); ctx.translate(s.x, s.y); ctx.rotate(gs.rotation * Math.PI / 180);
            const w = gs.width * this.scale, h = gs.height * this.scale;
            ctx.fillStyle = '#555'; ctx.fillRect(-w / 2, -h / 2, w, h);
            ctx.fillStyle = this.C.gsRoof[idx % this.C.gsRoof.length]; ctx.fillRect(-w / 2, -h / 2, w, h * 0.35);
            const isSel = sel && sel.type === 'grandstand' && sel.id === gs.id;
            ctx.strokeStyle = isSel ? '#00ff88' : '#888'; ctx.lineWidth = isSel ? 2 : 1; ctx.strokeRect(-w / 2, -h / 2, w, h);
            ctx.fillStyle = '#fff'; ctx.font = `${Math.max(7, 8 * this.scale)}px Outfit`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('GRANDSTAND', 0, h * .15); ctx.restore();
        });
    }

    _drawRotHandle(cx, cy, rad, dist) {
        const ctx = this.ctx;
        const hx = cx + Math.sin(rad) * dist, hy = cy - Math.cos(rad) * dist;
        ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(hx, hy); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,255,136,0.3)'; ctx.fill();
        ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2; ctx.stroke();
    }

    _rotationHandles(data, editor, sel) {
        if (!sel) return;
        if (sel.type === 'grandstand' || sel.type === 'garage') {
            const obj = sel.type === 'grandstand' ? data.getGrandstandById(sel.id) : data.getGarageById(sel.id);
            if (!obj) return;
            const s = this.w2s(obj.x, obj.y);
            this._drawRotHandle(s.x, s.y, (obj.rotation || 0) * Math.PI / 180, ((obj.height || 16) * this.scale / 2) + 20);
        } else if (sel.type === 'zone') {
            const zone = data.getZoneById(sel.id);
            if (!zone) return;
            const zt = F1.ZONE_TYPES.find(z => z.key === zone.type);
            if (zt && !zt.range) {
                const pos = editor.getZoneWorldPos(zone); if (!pos) return;
                const s = this.w2s(pos.x, pos.y);
                const lx = s.x + zone.labelOffsetX * this.scale, ly = s.y + zone.labelOffsetY * this.scale;
                const sf = Math.max(0.9, this.scale);
                const text = zone.label ? zone.label.toUpperCase() : '';
                const lines = text.split('\n');
                const th = lines.length * 16 * sf + 6 * sf;
                const hd = th / 2 + 20;
                this._drawRotHandle(lx, ly, (zone.rotation || 0) * Math.PI / 180, hd);
            }

        } else if (sel.type === 'sector_label') {
            const sl = data.sectorLabels.find(s => s.sector === sel.sector); if (!sl) return;
            const track = editor.getInterpolatedTrack();
            const pts = track.filter(pt => pt.sector === sl.sector); if (!pts.length) return;
            const mid = pts[Math.floor(pts.length / 2)]; const sMid = this.w2s(mid.x, mid.y);
            const lx = sMid.x + sl.labelOffsetX * this.scale, ly = sMid.y + sl.labelOffsetY * this.scale;
            const sf = Math.max(0.9, this.scale);
            const th = 22 * sf;
            const hd = th / 2 + 20;
            this._drawRotHandle(lx, ly, (sl.rotation || 0) * Math.PI / 180, hd);
        } else if (sel.type === 'turn') {
            const tm = data.getTurnMarkerById(sel.id); if (!tm) return;
            const track = editor.getInterpolatedTrack();
            const idx = tm.segIndex * editor.resolution + Math.floor(tm.t * editor.resolution);
            const p = track[Math.min(idx, track.length - 1)]; if (!p) return;
            const actualSgn = tm.side === 'left' ? -1 : 1;
            const w = actualSgn < 0 ? p.widthLeft : p.widthRight;
            const sw2 = actualSgn < 0 ? ((p.surfaceLeft || p.barrierLeft) ? (p.surfaceWidthLeft ?? 10) : 0) : ((p.surfaceRight || p.barrierRight) ? (p.surfaceWidthRight ?? 10) : 0);
            const wx = p.x + p.nx * (w + sw2 + 13) * actualSgn;
            const wy = p.y + p.ny * (w + sw2 + 13) * actualSgn;
            const s = this.w2s(wx, wy);
            this._drawRotHandle(s.x, s.y, (tm.rotation || 0) * Math.PI / 180, 22);
        }
    }

    _zones(data, editor, sel) {
        const ctx = this.ctx;
        data.zones.forEach(zone => {
            const zt = F1.ZONE_TYPES.find(z => z.key === zone.type);
            if (!zt) return;

            // If range zone like straight mode, we drew its dashes already
            // If it is straight mode, we can draw interactive handle circles if selected!
            if (zt.range) {
                if (sel && sel.type === 'zone' && sel.id === zone.id) {
                    const track = editor.getInterpolatedTrack();
                    const si = zone.segIndex * editor.resolution + Math.floor(zone.t * editor.resolution);
                    const ei = zone.endSegIndex * editor.resolution + Math.floor(zone.endT * editor.resolution);
                    const pStart = track[Math.min(si, track.length - 1)];
                    const pEnd = track[Math.min(ei, track.length - 1)];
                    if (pStart) {
                        const sStart = this.w2s(pStart.x, pStart.y);
                        ctx.fillStyle = '#00ff66'; // Green for Start
                        ctx.beginPath(); ctx.arc(sStart.x, sStart.y, 7, 0, Math.PI * 2); ctx.fill();
                        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
                    }
                    if (pEnd) {
                        const sEnd = this.w2s(pEnd.x, pEnd.y);
                        ctx.fillStyle = '#ff3333'; // Red for End
                        ctx.beginPath(); ctx.arc(sEnd.x, sEnd.y, 7, 0, Math.PI * 2); ctx.fill();
                        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
                    }
                }
                return;
            }

            const pos = editor.getZoneWorldPos(zone); if (!pos) return;
            const s = this.w2s(pos.x, pos.y);

            // Draw line connecting track to label container FIRST
            const lx = s.x + zone.labelOffsetX * this.scale;
            const ly = s.y + zone.labelOffsetY * this.scale;
            if (zone.type !== 'straight_mode') {
                ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, ly); ctx.lineTo(lx, ly); ctx.stroke();
            }

            // Draw anchor circle on track ON TOP of the line
            ctx.beginPath(); ctx.arc(s.x, s.y, 5 * this.scale, 0, Math.PI * 2);
            ctx.fillStyle = zt.color; ctx.fill();
            if (zone.type === 'overtake_activation') {
                ctx.beginPath(); ctx.arc(s.x, s.y, 2 * this.scale, 0, Math.PI * 2);
                ctx.fillStyle = '#181818'; ctx.fill();
            } else {
                ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.stroke();
            }

            // Rotatable label
            const isSel = sel && sel.type === 'zone' && sel.id === zone.id;
            const sf = Math.max(0.9, this.scale);
            ctx.font = `bold ${10 * sf}px Outfit`;
            const text = zone.label.toUpperCase();
            const lines = text.split('\n');
            const tw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 16 * sf;
            const th = lines.length * 16 * sf + 6 * sf;
            ctx.save(); ctx.translate(lx, ly); ctx.rotate((zone.rotation || 0) * Math.PI / 180);
            ctx.fillStyle = zt.color; ctx.beginPath(); ctx.roundRect(-tw / 2, -th / 2, tw, th, 4); ctx.fill();
            if (isSel) { ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2; ctx.stroke(); }
            ctx.fillStyle = zt.textColor || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            if (lines.length === 1) {
                ctx.fillText(text, 0, 0);
            } else {
                lines.forEach((l, i) => ctx.fillText(l, 0, (i - (lines.length - 1) / 2) * 14 * sf));
            }
            ctx.restore();
        });
    }

    /* Movable Sector Labels */
    _sectorLabels(data, editor, sel) {
        const ctx = this.ctx;
        const track = editor.getInterpolatedTrack();
        data.sectorLabels.forEach(sl => {
            const pts = track.filter(pt => pt.sector === sl.sector);
            if (!pts.length) return;
            const mid = pts[Math.floor(pts.length / 2)];
            const sMid = this.w2s(mid.x, mid.y);
            const lx = sMid.x + sl.labelOffsetX * this.scale;
            const ly = sMid.y + sl.labelOffsetY * this.scale;

            // Connected line removed as per user request

            // Rotatable label container
            const text = `SECTOR ${sl.sector}`;
            const sf = Math.max(0.9, this.scale);
            ctx.font = `bold ${10 * sf}px Outfit`;
            const tw = ctx.measureText(text).width + 16 * sf, th = 22 * sf;
            const isSel = sel && sel.type === 'sector_label' && sel.sector === sl.sector;
            const sColor = sl.sector === 1 ? this.C.s1 : sl.sector === 2 ? this.C.s2 : this.C.s3;
            ctx.save(); ctx.translate(lx, ly); ctx.rotate((sl.rotation || 0) * Math.PI / 180);
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(-tw / 2, -th / 2, tw, th, 4); ctx.fill();
            ctx.strokeStyle = isSel ? '#00ff88' : sColor; ctx.lineWidth = isSel ? 2 : 1.5; ctx.stroke();
            ctx.fillStyle = '#000000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, 0);
            ctx.restore();
        });
    }

    /* Turn markers - user-placed, on the SIDE of the track */
    _turnMarkers(data, editor, sel) {
        const ctx = this.ctx;
        const track = editor.getInterpolatedTrack();
        data.turnMarkers.forEach(tm => {
            const idx = tm.segIndex * editor.resolution + Math.floor(tm.t * editor.resolution);
            const p = track[Math.min(idx, track.length - 1)];
            if (!p) return;
            const actualSgn = tm.side === 'left' ? -1 : 1;
            const w = actualSgn < 0 ? p.widthLeft : p.widthRight;
            const sw = actualSgn < 0 ? ((p.surfaceLeft || p.barrierLeft) ? (p.surfaceWidthLeft || 10) : 0) : ((p.surfaceRight || p.barrierRight) ? (p.surfaceWidthRight || 10) : 0);
            const offset = w + sw + 13;
            const wx = p.x + p.nx * offset * actualSgn;
            const wy = p.y + p.ny * offset * actualSgn;
            const s = this.w2s(wx, wy);

            const isSel = sel && sel.type === 'turn' && sel.id === tm.id;
            ctx.save(); ctx.translate(s.x, s.y); ctx.rotate((tm.rotation || 0) * Math.PI / 180);
            ctx.beginPath(); ctx.arc(0, 0, 11 * this.scale, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.strokeStyle = isSel ? '#00ff88' : '#000000'; ctx.lineWidth = isSel ? 2.5 : 1.5; ctx.stroke();
            ctx.fillStyle = '#000'; ctx.font = `bold ${Math.max(10, 11 * this.scale)}px Outfit`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(tm.label, 0, 0);
            if (tm.name) {
                ctx.fillStyle = '#fff'; ctx.font = `normal ${Math.max(8, 9 * this.scale)}px Outfit`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(tm.name.toUpperCase(), 0, -16 * this.scale);
            }
            ctx.restore();
        });
    }

    /* Node points (control points) - can be hidden */
    _controlPoints(data, sel, hoverPt) {
        const ctx = this.ctx;
        data.controlPoints.forEach(pt => {
            const s = this.w2s(pt.x, pt.y);
            const isSel = sel && sel.type === 'cp' && sel.id === pt.id;
            const isHov = hoverPt && hoverPt.id === pt.id;
            if (isSel || isHov) {
                ctx.strokeStyle = 'rgba(0,255,136,0.15)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(s.x, s.y, (pt.widthLeft + (pt.surfaceWidthLeft ?? 10)) * this.scale, 0, Math.PI * 2); ctx.stroke();
                ctx.strokeStyle = 'rgba(0,255,136,0.25)';
                ctx.beginPath(); ctx.arc(s.x, s.y, pt.widthLeft * this.scale, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = isSel ? this.C.cpSel : isHov ? this.C.cpHover : this.C.cp; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
            if (pt.sector > 0) { ctx.beginPath(); ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2); ctx.fillStyle = pt.sector === 1 ? this.C.s1 : pt.sector === 2 ? this.C.s2 : this.C.s3; ctx.fill(); }
            if (pt === data.controlPoints[0] && data.controlPoints.length >= 3 && !data.isClosed) {
                ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(s.x, s.y, 18, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
            }
        });
    }

    _pitPoints(data, sel, activeTool) {
        if (activeTool !== 'pitlane') return;
        const ctx = this.ctx;
        data.pitLane.points.forEach(pt => {
            const s = this.w2s(pt.x, pt.y);
            const isSel = sel && sel.type === 'pit' && sel.id === pt.id;
            ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = isSel ? '#ff8800' : '#ffff00'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
        });
    }
};

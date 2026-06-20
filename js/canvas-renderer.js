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
        this.gridColor = '#ffffff'; this.gridOpacity = 0.04;
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
        this.chequeredImg.src = 'resources/chequered.svg';
        this.arrowImg = new Image();
        this.arrowImg.src = 'resources/arrow.png';
        this.stripsImg = new Image();
        this.stripsImg.src = 'resources/strips.svg';

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

    _getTrackOutsideSgn(track) {
        // Use the signed area (shoelace formula) of the centerline to determine
        // track winding direction. This gives a single consistent "outside" for
        // the entire track, preventing stripes from flipping between inside/outside.
        if (track.length < 3) return 1;
        let area = 0;
        for (let i = 0; i < track.length - 1; i++) {
            area += (track[i].x * track[i + 1].y - track[i + 1].x * track[i].y);
        }
        // Positive area = counter-clockwise winding → outside is to the right (sgn=1)
        // Negative area = clockwise winding → outside is to the left (sgn=-1)
        return area >= 0 ? 1 : -1;
    }

    render(data, editor, sel, hoverPt, activeTool) {
        this._editor = editor;
        const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
        ctx.fillStyle = this.C.bg; ctx.fillRect(0, 0, W, H);
        if (this.showGrid) this._grid(data);
        const track = editor.getInterpolatedTrack();
        if (track.length > 1) {
            this._surfaces(track); this._trackSurface(track); this._sectorStripes(track, data);
            this._barriers(track); this._straightModeZones(data, editor, track, sel);
            this._renderIntersections(track, data, editor, sel);
            this._startFinish(track, data);
        }
        this._pitLane(editor);
        this._zones(data, editor, sel, activeTool); this._sectorLabels(data, editor, sel); this._turnMarkers(data, editor, sel);
        if (this.showCtrlPts) { this._controlPoints(data, sel, hoverPt); }
        this._pitPoints(data, sel, activeTool);
        this._rotationHandles(data, editor, sel);
        this._rulers(track, data);

        // Hover tooltip for Nodes
        if (hoverPt) {
            const nodeIdx = data.getLogicalNodeIndex(hoverPt.id);
            if (nodeIdx > 0) {
                const s = this.w2s(hoverPt.x, hoverPt.y);
                ctx.font = `bold 12px Outfit`;
                const txt = `Node ${nodeIdx}`;
                const tw = ctx.measureText(txt).width;
                ctx.fillStyle = 'rgba(0,0,0,0.8)';
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(s.x + 12, s.y - 12, tw + 8, 24, 4) : ctx.rect(s.x + 12, s.y - 12, tw + 8, 24);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                ctx.fillText(txt, s.x + 16, s.y);
            }
        }
    }

    _grid(data) {
        const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, step = 50;
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

    _sectorStripes(track, data, forceSgn = null) {
        const ctx = this.ctx, sw = Math.max(2, 3 * this.scale);
        const sgn = forceSgn !== null ? forceSgn : this._getTrackOutsideSgn(track);
        let currentSec = -1;
        let pathStarted = false;
        
        ctx.lineWidth = sw; ctx.globalAlpha = 0.7;
        
        for (let i = 1; i < track.length; i++) {
            const sec = track[i - 1].sector; 
            if (sec === 0) {
                if (pathStarted) { ctx.stroke(); pathStarted = false; }
                continue;
            }
            if (sec !== currentSec || !pathStarted) {
                if (pathStarted) { ctx.stroke(); }
                currentSec = sec;
                ctx.strokeStyle = sec === 1 ? this.C.s1 : sec === 2 ? this.C.s2 : this.C.s3;
                ctx.beginPath();
                const w1 = sgn > 0 ? track[i - 1].widthRight : track[i - 1].widthLeft;
                const a = this.w2s(track[i - 1].x + track[i - 1].nx * (w1 + 2) * sgn, track[i - 1].y + track[i - 1].ny * (w1 + 2) * sgn);
                ctx.moveTo(a.x, a.y);
                pathStarted = true;
            }
            const w2 = sgn > 0 ? track[i].widthRight : track[i].widthLeft;
            const b = this.w2s(track[i].x + track[i].nx * (w2 + 2) * sgn, track[i].y + track[i].ny * (w2 + 2) * sgn);
            ctx.lineTo(b.x, b.y);
        }
        if (pathStarted) ctx.stroke();
        ctx.globalAlpha = 1;
    }

    _barriers(track) {
        const ctx = this.ctx; ctx.strokeStyle = this.C.barrier; ctx.lineWidth = Math.max(3, 4 * this.scale);
        let i = 0;
        while (i < track.length - 1) {
            const hasL = track[i].barrierLeft, hasR = track[i].barrierRight;
            if (!hasL && !hasR) { i++; continue; }
            
            let j = i;
            while (j < track.length - 1 && track[j].barrierLeft === hasL && track[j].barrierRight === hasR) j++;
            
            if (hasL) {
                ctx.beginPath();
                for (let k = i; k <= Math.min(j, track.length - 1); k++) {
                    const p = track[k], w = p.widthLeft + (p.surfaceWidthLeft ?? 10);
                    const s = this.w2s(p.x - p.nx * w, p.y - p.ny * w);
                    k === i ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y);
                }
                ctx.stroke();
            }
            if (hasR) {
                ctx.beginPath();
                for (let k = i; k <= Math.min(j, track.length - 1); k++) {
                    const p = track[k], w = p.widthRight + (p.surfaceWidthRight ?? 10);
                    const s = this.w2s(p.x + p.nx * w, p.y + p.ny * w);
                    k === i ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y);
                }
                ctx.stroke();
            }
            i = j;
        }
    }

    /* Straight Mode - red dashes close to track edge using strips.png */
    _straightModeZones(data, editor, track, sel, ixRange = null) {
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
                    // The drawing center is placed such that the closest edge of the strip has a 4px screen gap.
                    // The strip is drawn from -L_half to +L_half relative to the center.
                    // When taper = 1.0, L_half = sw. So the strip extends inward by sw.
                    // Therefore, the center should be at: road edge (w) + 4px gap + sw.
                    const offset = w + 4 / this.scale + sw;
                    const ox = p.x + p.nx * offset * sideSign;
                    const oy = p.y + p.ny * offset * sideSign;

                    if (!prevP) {
                        stripPoints.push({ x: ox, y: oy, nx: p.nx, ny: p.ny, trackIndex: i });
                        prevP = { x: ox, y: oy, nx: p.nx, ny: p.ny, trackIndex: i };
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

                            stripPoints.push({ x: exactX, y: exactY, nx: exactNx, ny: exactNy, trackIndex: i });

                            currentDist = 0;
                            prevP = { x: exactX, y: exactY, nx: exactNx, ny: exactNy, trackIndex: i };
                            dx = ox - prevP.x;
                            dy = oy - prevP.y;
                            d = Math.hypot(dx, dy);
                            if (d < 0.0001) break;
                        }
                        currentDist += d;
                    }
                    prevP = { x: ox, y: oy, nx: p.nx, ny: p.ny, trackIndex: i };
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

                    if (ixRange) {
                        let actualI = sp.trackIndex;
                        if (actualI < 0) actualI += track.length;
                        if (actualI >= track.length) actualI -= track.length;
                        
                        let inRange = false;
                        for (let k = ixRange.start; k <= ixRange.end; k++) {
                            let actualK = k;
                            if (actualK < 0) actualK += track.length;
                            if (actualK >= track.length) actualK -= track.length;
                            if (actualI === actualK) { inRange = true; break; }
                        }
                        if (!inRange) continue;
                    }

                    // Only first and last strips are full length, rest are 35%
                    const taper = (idx === 0 || idx === n - 1) ? 1.0 : 0.35;
                    const L_half = sw * taper;

                    const s = this.w2s(sp.x, sp.y);
                    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(sp.ny * sideSign, sp.nx * sideSign));

                    const shiftX = -(sw - L_half) * this.scale;
                    const len = L_half * 2 * this.scale;
                    const thick = sw * 0.6 * this.scale; // Constant thickness

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

            const isSel = sel && sel.type === 'zone' && sel.id === zone.id;

            // Text-on-path label: render only if this zone has showLabel
            if (zone.showLabel !== false && !ixRange) {
                const sgn = zone.side === 'left' ? -1 : 1;
                // Build path points along the offset curve for text placement
                let pathPts = [];
                const buildPath = (startIdx, endIdx) => {
                    for (let i = startIdx; i <= endIdx; i++) {
                        const p = track[i];
                        const w = sgn < 0 ? p.widthLeft : p.widthRight;
                        const sw = zone.stripWidth || 5;
                        const offset = w + sw * 2 + 8 / this.scale + 5.5;
                        pathPts.push({ x: p.x + p.nx * offset * sgn, y: p.y + p.ny * offset * sgn });
                    }
                };
                if (si <= ei) { buildPath(si, ei); }
                else if (data.isClosed) { buildPath(si, track.length - 1); buildPath(0, ei); }
                else { buildPath(ei, si); }

                // Flip: auto-flip text to always be upright, user can override
                const autoFlip = pathPts.length > 1 && (pathPts[pathPts.length - 1].x < pathPts[0].x);
                let shouldFlip = autoFlip;
                if (zone.labelFlipped) { shouldFlip = !shouldFlip; }
                if (shouldFlip) { pathPts.reverse(); }

                if (pathPts.length > 1) {
                    // Compute cumulative arc-length along the path
                    let cumLen = [0];
                    for (let i = 1; i < pathPts.length; i++) {
                        cumLen.push(cumLen[i - 1] + Math.hypot(pathPts[i].x - pathPts[i - 1].x, pathPts[i].y - pathPts[i - 1].y));
                    }
                    const totalLen = cumLen[cumLen.length - 1];

                    const sf = this.scale;
                    const fontSize = (zone.labelFontSize || 10) * sf;
                    ctx.font = `bold ${fontSize}px Outfit`;
                    const text = (zone.label || "STRAIGHT MODE ZONE").toUpperCase().replace(/\n/g, ' ');
                    
                    // Measure each character width and convert to world distance
                    const charWidthsWorld = [];
                    let totalTextWWorld = 0;
                    for (let c = 0; c < text.length; c++) {
                        const cwScreen = ctx.measureText(text[c]).width;
                        const cwWorld = cwScreen / sf;
                        charWidthsWorld.push(cwWorld);
                        totalTextWWorld += cwWorld;
                    }
                    const charGapWorld = 1 / sf; // small gap between chars in world units
                    totalTextWWorld += charGapWorld * (text.length - 1);

                    // Center text along path (all in world coordinates)
                    let startOffset = (totalLen - totalTextWWorld) / 2;
                    if (startOffset < 0) startOffset = 0;

                    // Helper: get position + angle at a given arc-length distance
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

                    // Draw each character along the path
                    let curDist = startOffset;
                    ctx.fillStyle = '#ff1801';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    for (let c = 0; c < text.length; c++) {
                        const charMid = curDist + charWidthsWorld[c] / 2;
                        const pt = getPointAt(charMid);
                        const s = this.w2s(pt.x, pt.y);
                        ctx.save();
                        ctx.translate(s.x, s.y);
                        ctx.rotate(pt.angle);
                        ctx.font = `bold ${fontSize}px Outfit`;
                        ctx.fillText(text[c], 0, 0);
                        ctx.restore();
                        curDist += charWidthsWorld[c] + charGapWorld;
                    }
                }
            }
        });
    }

    /* Checkered flag 🏁 aligned with track + arrow next to it using preloaded PNGs */
    _startFinish(track, data) {
        if (track.length < 4) return;
        const ctx = this.ctx;
        let p = track[0], p2 = track[1];
        if (data.startNodeId) {
            const cpIdx = data.controlPoints.findIndex(cp => cp.id === data.startNodeId);
            if (cpIdx >= 0) {
                const trkIdx = cpIdx * this._editor.resolution;
                p = track[trkIdx] || track[0];
                p2 = track[trkIdx + 1] || track[1];
            }
        }
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

        // Direction arrow — using provided SVG
        ctx.save();
        const s2 = this.w2s(p.x, p.y);
        ctx.translate(s2.x, s2.y);
        ctx.rotate(angle);
        ctx.translate(13 * this.scale, 0); // 4px flag half + 6px gap + 3px arrow base

        const svgScale = (16 * this.scale) / 24;
        ctx.scale(svgScale, svgScale);
        ctx.rotate(Math.PI / 4); // point it forward
        ctx.translate(-12, -12); // center the 24x24 SVG

        ctx.fillStyle = '#fff';
        ctx.fill(new Path2D("M21.15,2.86a2.89,2.89,0,0,0-3-.71L4,6.88a2.9,2.9,0,0,0-.12,5.47l5.24,2h0a.93.93,0,0,1,.53.52l2,5.25A2.87,2.87,0,0,0,14.36,22h.07a2.88,2.88,0,0,0,2.69-2L21.85,5.83A2.89,2.89,0,0,0,21.15,2.86ZM20,5.2,15.22,19.38a.88.88,0,0,1-.84.62.92.92,0,0,1-.87-.58l-2-5.25a2.91,2.91,0,0,0-1.67-1.68l-5.25-2A.9.9,0,0,1,4,9.62a.88.88,0,0,1,.62-.84L18.8,4.05A.91.91,0,0,1,20,5.2Z"));
        ctx.restore();
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
        if (pit.length > 4) { const mid = pit[Math.floor(pit.length / 2)], s = this.w2s(mid.x, mid.y); ctx.fillStyle = '#fff'; ctx.font = `bold ${12 * this.scale}px Outfit`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PIT LANE', s.x, s.y); }
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
        if (sel.type === 'zone') {
            const zone = data.getZoneById(sel.id);
            if (!zone) return;
            const zt = F1.ZONE_TYPES.find(z => z.key === zone.type);
            if (zt && !zt.range) {
                const pos = editor.getZoneWorldPos(zone); if (!pos) return;
                const s = this.w2s(pos.x, pos.y);
                const lx = s.x + zone.labelOffsetX * this.scale, ly = s.y + zone.labelOffsetY * this.scale;
                const sf = this.scale;
                const text = zone.label ? zone.label.toUpperCase() : '';
                const lines = text.split('\n');
                const th = lines.length * 16 * sf + 6 * sf;
                const hd = th / 2 + 20 * this.scale;
                this._drawRotHandle(lx, ly, (zone.rotation || 0) * Math.PI / 180, hd);
            }

        } else if (sel.type === 'sector_label') {
            const sl = data.sectorLabels.find(s => s.sector === sel.sector); if (!sl) return;
            const track = editor.getInterpolatedTrack();
            const pts = track.filter(pt => pt.sector === sl.sector); if (!pts.length) return;
            const mid = pts[Math.floor(pts.length / 2)]; const sMid = this.w2s(mid.x, mid.y);
            const lx = sMid.x + sl.labelOffsetX * this.scale, ly = sMid.y + sl.labelOffsetY * this.scale;
            const sf = this.scale;
            const th = 22 * sf;
            const hd = th / 2 + 20 * this.scale;
            this._drawRotHandle(lx, ly, (sl.rotation || 0) * Math.PI / 180, hd);
        } else if (sel.type === 'turn') {
            const tm = data.getTurnMarkerById(sel.id); if (!tm) return;
            const track = editor.getInterpolatedTrack();
            const idx = tm.segIndex * editor.resolution + Math.floor(tm.t * editor.resolution);
            const p = track[Math.min(idx, track.length - 1)]; if (!p) return;
            const actualSgn = tm.side === 'left' ? -1 : 1;
            const w = actualSgn < 0 ? p.widthLeft : p.widthRight;
            const offset = w + 23; // 15px radius + 8px gap
            const wx = p.x + p.nx * offset * actualSgn;
            const wy = p.y + p.ny * offset * actualSgn;
            const s = this.w2s(wx, wy);
            this._drawRotHandle(s.x, s.y, (tm.rotation || 0) * Math.PI / 180, 22 * this.scale);
        }
    }

    _zones(data, editor, sel, activeTool) {
        const ctx = this.ctx;
        data.zones.forEach(zone => {
            const zt = F1.ZONE_TYPES.find(z => z.key === zone.type);
            if (!zt) return;

            // If range zone like straight mode, we drew its dashes already
            // If it is straight mode, we can draw interactive handle circles if selected!
            if (zt.range) {
                if (sel && sel.type === 'zone' && sel.id === zone.id && activeTool === 'straightMode') {
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
            const sf = this.scale;
            ctx.font = `bold ${10 * sf}px Outfit`;
            const text = (zone.label || zt.label || '').toUpperCase();
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
            const sf = this.scale;
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
            const offset = w + 23; // 15px radius + 8px gap
            const wx = p.x + p.nx * offset * actualSgn;
            const wy = p.y + p.ny * offset * actualSgn;
            const s = this.w2s(wx, wy);

            const isSel = sel && sel.type === 'turn' && sel.id === tm.id;
            ctx.save(); ctx.translate(s.x, s.y); ctx.rotate((tm.rotation || 0) * Math.PI / 180);
            ctx.beginPath(); ctx.arc(0, 0, 15 * this.scale, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.strokeStyle = isSel ? '#00ff88' : '#000000'; ctx.lineWidth = isSel ? 2.5 : 2.0; ctx.stroke();
            ctx.fillStyle = '#000'; ctx.font = `bold ${13 * this.scale}px Outfit`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(tm.label, 0, 0);
            if (tm.name) {
                ctx.fillStyle = '#fff'; ctx.font = `normal ${9 * this.scale}px Outfit`;
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

    _renderIntersections(track, data, editor, sel) {
        if (!window.app || !window.app.intersections) return;
        
        window.app.intersections.forEach(ix => {
            const key = ix.key;
            const legacyKey = `${ix.cpA}-${ix.cpB}`;
            const inverted = data.overlapInversions && (data.overlapInversions.includes(key) || data.overlapInversions.includes(legacyKey));
            
            const idxA = ix.trackIdxA;
            const idxB = ix.trackIdxB;
            
            let topIdx = Math.max(idxA, idxB);
            if (inverted) topIdx = Math.min(idxA, idxB);
            
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
                this._surfaces(subTrack); 
                this._trackSurface(subTrack); 
                this._sectorStripes(subTrack, data, this._getTrackOutsideSgn(track));
                this._barriers(subTrack);
                this._straightModeZones(data, editor, track, sel, { start, end });
            }
        });
    }

    _rulers(track, data) {
        if (!window.app || !window.app.rulers) return;
        // ... (unchanged previous logic up to end of class)
        // I will just add _renderIntersections before _rulers.
        if (!window.app || !window.app.rulers) return;
        const ctx = this.ctx;
        
        const allRulers = [...window.app.rulers];
        if (window.app.activeRuler && !allRulers.includes(window.app.activeRuler)) {
            allRulers.push(window.app.activeRuler);
        }

        const scaleFact = (data.gridSize || 50) / 50.0;
        const N = track.length;

        allRulers.forEach(r => {
            if (r.start === undefined || r.end === undefined) return;
            if (r.start >= N) return;
            
            let s = r.start;
            let e = r.end;
            let wrap = false;
            
            if (data.isClosed && Math.abs(s - e) > N / 2) {
                wrap = true;
            }
            
            ctx.beginPath();
            let dist = 0;
            
            let cur = s;
            const step = wrap ? (s < e ? -1 : 1) : (s < e ? 1 : -1);
            
            const indices = [];
            if (s === e) {
                indices.push(s);
            } else {
                while (cur !== e) {
                    indices.push(cur);
                    cur += step;
                    if (data.isClosed) {
                        if (cur >= N) cur = 0;
                        if (cur < 0) cur = N - 1;
                    } else {
                        if (cur >= N || cur < 0) break;
                    }
                }
                indices.push(e);
            }

            for (let k = 0; k < indices.length; k++) {
                const i = indices[k];
                const pt = track[i];
                if (!pt) continue;
                const sp = this.w2s(pt.x, pt.y);
                if (k === 0) ctx.moveTo(sp.x, sp.y);
                else {
                    ctx.lineTo(sp.x, sp.y);
                    const prevPt = track[indices[k-1]];
                    dist += Math.hypot(pt.x - prevPt.x, pt.y - prevPt.y);
                }
            }
            
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = Math.max(4, 6 * this.scale);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            
            const drawEndpoint = (idx) => {
                const p = track[Math.min(idx, track.length - 1)];
                if (!p) return;
                const s = this.w2s(p.x, p.y);
                ctx.beginPath();
                ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
                ctx.fillStyle = '#00ffff';
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#000';
                ctx.stroke();
            };
            drawEndpoint(r.start);
            if (r.start !== r.end) drawEndpoint(r.end);
            
            if (s !== e && indices.length > 0) {
                const midIdx = indices[Math.floor(indices.length / 2)];
                const p = track[Math.min(midIdx, track.length - 1)];
                if (p) {
                    const realDist = dist * scaleFact;
                    const txt = realDist >= 1000 ? (realDist/1000).toFixed(3) + ' km' : realDist.toFixed(1) + ' m';
                    const s = this.w2s(p.x, p.y);
                    
                    ctx.font = 'bold 12px Outfit';
                    const tm = ctx.measureText(txt);
                    const tw = tm.width;
                    
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    ctx.beginPath();
                    ctx.roundRect(s.x - tw/2 - 6, s.y - 12 - 14, tw + 12, 20, 4);
                    ctx.fill();
                    
                    ctx.fillStyle = '#00ffff';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(txt, s.x, s.y - 14);
                }
            }
        });
    }
};

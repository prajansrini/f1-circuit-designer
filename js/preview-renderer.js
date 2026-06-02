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
        this.infoColor = '#ffffff';
        this.nameColor = '#ffffff';
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
        this.userOx = sx - this.canvas.width/2 - (sx - this.canvas.width/2 - this.userOx) * ratio;
        this.userOy = sy - this.canvas.height/2 - (sy - this.canvas.height/2 - this.userOy) * ratio;
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
        if (this.layers.track) { this._trackBase(ctx, track, tf); this._sectorEdges(ctx, track, tf); }
        this._startFinish(ctx, track, data, tf);
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

    _sectorEdges(ctx, track, tf) {
        const lw = Math.max(4, 5 * tf.scale);
        for (let i = 1; i < track.length; i++) {
            const sec = track[i - 1].sector;
            if (sec === 0) continue;
            ctx.strokeStyle = this.sectorColors[sec] || '#555';
            ctx.lineWidth = lw; ctx.lineCap = 'round';
            const a = tf.toScreen(track[i - 1].x, track[i - 1].y), b = tf.toScreen(track[i].x, track[i].y);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
    }

    /* Straight mode: red dashes close to track edge using strips.png */
    _straightModeZones(ctx, data, editor, track, tf) {
        const firstSMZ = data.zones.find(z => z.type === 'straight_mode');
        data.zones.filter(z => { const zt = F1.ZONE_TYPES.find(t => t.key === z.type); return zt && zt.range; }).forEach(zone => {
            const si = zone.segIndex * editor.resolution + Math.floor(zone.t * editor.resolution);
            const ei = zone.endSegIndex * editor.resolution + Math.floor(zone.endT * editor.resolution);
            const lo = Math.min(si, ei), hi = Math.max(si, ei);
            const spacing = zone.stripSpacing || 2;
            const sw = zone.stripWidth || 5;
            for (let i = lo; i <= Math.min(hi, track.length - 1); i += spacing) {
                const p = track[i];
                const sgn = zone.side === 'left' ? -1 : 1;
                const w = sgn < 0 ? p.widthLeft : p.widthRight;
                const offset = w + 4;
                const s = tf.toScreen(p.x + p.nx * offset * sgn, p.y + p.ny * offset * sgn);
                ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(p.ny, p.nx));
                if (this.stripsImg.complete && this.stripsImg.naturalWidth > 0) {
                    ctx.drawImage(this.stripsImg, -sw * tf.scale, -sw * 0.5 * tf.scale, sw * 2 * tf.scale, sw * tf.scale);
                } else {
                    ctx.fillStyle = '#ff1801';
                    ctx.fillRect(-sw * tf.scale, -sw * 0.3 * tf.scale, sw * 2 * tf.scale, sw * 0.6 * tf.scale);
                }
                ctx.restore();
            }
            if (zone === firstSMZ) {
                const midIdx = Math.floor((lo + hi) / 2);
                const pMid = track[midIdx];
                if (pMid) {
                    const sMid = tf.toScreen(pMid.x, pMid.y);
                    const lx = sMid.x + (zone.labelOffsetX || 0) * tf.scale;
                    const ly = sMid.y + (zone.labelOffsetY || 0) * tf.scale;
                    ctx.save(); ctx.translate(lx, ly); ctx.rotate((zone.rotation || 0) * Math.PI / 180);
                    const sf = Math.max(0.9, tf.scale);
                    ctx.font = `bold ${10 * sf}px Outfit`;
                    const text = "STRAIGHT MODE ZONE";
                    const tw = ctx.measureText(text).width + 16 * sf, th = 22 * sf;
                    ctx.fillStyle = 'rgba(15, 26, 15, 0.95)'; ctx.beginPath(); ctx.roundRect(-tw / 2, -th / 2, tw, th, 4); ctx.fill();
                    ctx.strokeStyle = '#ff1801'; ctx.lineWidth = 1.5; ctx.stroke();
                    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, 0);
                    ctx.restore();
                }
            }
        });
    }

    /* Checkered flag spanning track + arrow next to it using preloaded PNGs */
    _startFinish(ctx, track, data, tf) {
        if (!data.isClosed || track.length < 4) return;
        const p = track[0], p2 = track[1];
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

        // Direction arrow — half size, right next to checkered flag
        if (this.layers.direction !== false) {
            const ai = Math.min(1, track.length - 2);
            const ap = track[ai], anp = track[ai + 1];
            const as = tf.toScreen(ap.x, ap.y);
            const aAngle = Math.atan2(anp.y - ap.y, anp.x - ap.x);
            if (this.arrowImg.complete && this.arrowImg.naturalWidth > 0) {
                ctx.save(); ctx.translate(as.x, as.y); ctx.rotate(aAngle);
                const ar = Math.max(6, 7 * tf.scale);
                ctx.drawImage(this.arrowImg, -ar, -ar, ar * 2, ar * 2); ctx.restore();
            } else {
                const ar = Math.max(5, 6 * tf.scale);
                ctx.beginPath(); ctx.arc(as.x, as.y, ar, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
                ctx.save(); ctx.translate(as.x, as.y); ctx.rotate(aAngle); ctx.fillStyle = '#fff'; ctx.beginPath();
                ctx.moveTo(ar * 0.5, 0); ctx.lineTo(-ar * 0.3, -ar * 0.35); ctx.lineTo(-ar * 0.3, ar * 0.35); ctx.closePath(); ctx.fill(); ctx.restore();
            }
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
            const sf = Math.max(0.9, tf.scale);
            const sCenter = tf.toScreen(p.x, p.y);
            const trackRadiusPx = Math.max(8, 10 * tf.scale);
            const circleRadiusPx = 11 * sf;
            const distPx = trackRadiusPx + circleRadiusPx + 6;
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
            ctx.font = `bold ${10 * sf}px Outfit`;
            const tw = ctx.measureText(text).width + 16 * sf, th = 22 * sf;

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

            // Draw anchor circle on track
            if (zone.type === 'overtake_activation') {
                ctx.beginPath(); ctx.arc(s.x, s.y, 6 * tf.scale, 0, Math.PI * 2);
                ctx.fillStyle = '#000'; ctx.fill();
                ctx.strokeStyle = '#00ff66'; ctx.lineWidth = 2 * tf.scale; ctx.stroke();
            } else {
                ctx.beginPath(); ctx.arc(s.x, s.y, 5 * tf.scale, 0, Math.PI * 2);
                ctx.fillStyle = zt.color; ctx.fill();
                ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5 * tf.scale; ctx.stroke();
            }

            // Draw line connecting track to label container
            const lx = s.x + zone.labelOffsetX * tf.scale;
            const ly = s.y + zone.labelOffsetY * tf.scale;
            ctx.strokeStyle = zt.color; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(lx, ly); ctx.stroke();

            // Label container
            const sf = Math.max(0.9, tf.scale);
            ctx.font = `bold ${10 * sf}px Outfit`;
            const text = zone.label.toUpperCase();
            const lines = text.split('\n');
            const tw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 16 * sf;
            const th = lines.length * 16 * sf + 6 * sf;

            ctx.save(); ctx.translate(lx, ly); ctx.rotate((zone.rotation || 0) * Math.PI / 180);
            ctx.fillStyle = 'rgba(15, 26, 15, 0.95)'; ctx.beginPath(); ctx.roundRect(-tw / 2, -th / 2, tw, th, 4); ctx.fill();
            ctx.strokeStyle = zt.color; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
        ctx.fillText(data.name || 'Circuit', 20, 16);
    }

    _info(ctx, data, editor, W, H) {
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        const len = editor.getTrackLength();
        if (len > 0) { ctx.fillStyle = this.infoColor || '#ccc'; ctx.font = '14px Outfit'; ctx.fillText(`Track Length: ${len.toFixed(0)}m (${(len / 1000).toFixed(2)} km)`, 20, 46); }
        ctx.fillStyle = this.infoColor || '#999'; ctx.font = '12px Outfit'; ctx.fillText(`${data.turnMarkers.length} Turns`, 20, 68);
        const ly = H - 30; ctx.font = 'bold 10px Outfit'; let lx = 20;
        [{ l: 'SECTOR 1', c: this.sectorColors[1] }, { l: 'SECTOR 2', c: this.sectorColors[2] }, { l: 'SECTOR 3', c: this.sectorColors[3] }].forEach(item => {
            ctx.fillStyle = item.c; ctx.fillRect(lx, ly, 12, 12); ctx.fillStyle = this.infoColor || '#ccc'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(item.l, lx + 16, ly + 6); lx += ctx.measureText(item.l).width + 32;
        });
    }
};

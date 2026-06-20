window.F1 = window.F1 || {};

F1.SVGExporter = class SVGExporter {
    constructor(bgColor, infoColor, nameColor) {
        this.bgColor = bgColor;
        this.infoColor = infoColor;
        this.nameColor = nameColor;
    }

    _getBounds(track, data) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of track) {
            const ex = Math.max(p.widthLeft, p.widthRight) + 35;
            minX = Math.min(minX, p.x - ex); maxX = Math.max(maxX, p.x + ex);
            minY = Math.min(minY, p.y - ex); maxY = Math.max(maxY, p.y + ex);
        }
        for (const p of data.pitLane.points) {
            minX = Math.min(minX, p.x - 25); maxX = Math.max(maxX, p.x + 25);
            minY = Math.min(minY, p.y - 25); maxY = Math.max(maxY, p.y + 25);
        }
        return { minX, minY, maxX, maxY };
    }

    async _fetchSvgAsDataURI(url) {
        try {
            const res = await fetch(url);
            const text = await res.text();
            // Use base64 to avoid URI length and encoding issues in some SVG viewers
            return `data:image/svg+xml;base64,${btoa(text)}`;
        } catch (e) {
            console.error("Failed to fetch", url, e);
            return "";
        }
    }

    async export(data, editor, W, H, transparent, customNamePos = null) {
        const track = editor.getInterpolatedTrack();
        if (track.length < 2) return '';

        const bounds = this._getBounds(track, data);
        const margin = 80;
        const scaleX = (W - margin * 2) / (bounds.maxX - bounds.minX || 1);
        const scaleY = (H - margin * 2) / (bounds.maxY - bounds.minY || 1);
        const scale = Math.min(scaleX, scaleY);
        const cx = (bounds.minX + bounds.maxX) / 2;
        const cy = (bounds.minY + bounds.maxY) / 2;

        const ts = (x, y) => ({
            x: x * scale + W / 2 - cx * scale,
            y: y * scale + H / 2 - cy * scale
        });

        // Pre-fetch SVG assets
        const chequeredURI = await this._fetchSvgAsDataURI('resources/chequered.svg');
        const stripsURI = await this._fetchSvgAsDataURI('resources/strips.svg');

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;

        // Definitions
        svg += `<defs>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&amp;display=swap');
            </style>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <g id="track_arrow">
                <path d="M21.15,2.86c-0.66,-1.15 -2.14,-1.55 -3.29,-0.88c-0.12,0.07 -0.23,0.15 -0.34,0.24l-7.53,7.53l-7.52,-7.53c-0.96,-0.96 -2.52,-0.96 -3.49,0c-0.96,0.96 -0.96,2.52 0,3.49l8.84,8.84c0.55,0.55 1.28,0.85 2,0.94l0.17,0.01c0.72,-0.04 1.45,-0.34 2,-0.89l8.89,-8.89C22.04,4.78 22.06,3.67 21.15,2.86Z" fill="#fff" />
            </g>
        </defs>`;

        // Background
        if (!transparent) {
            svg += `<rect width="${W}" height="${H}" fill="${this.bgColor}" />`;
        }

        // Track Path Construction
        let pathStr = `M ${ts(track[0].x, track[0].y).x} ${ts(track[0].x, track[0].y).y} `;
        for (let i = 1; i < track.length; i++) {
            const s = ts(track[i].x, track[i].y);
            pathStr += `L ${s.x} ${s.y} `;
        }
        if (data.isClosed) {
            pathStr += 'Z';
        }

        // Track Edges and Base
        svg += `<path d="${pathStr}" fill="none" stroke="#ffffff" stroke-width="${43 * scale}" stroke-linecap="round" stroke-linejoin="round" />`;
        svg += `<path d="${pathStr}" fill="none" stroke="#111111" stroke-width="${40 * scale}" stroke-linecap="round" stroke-linejoin="round" />`;

        // Sectors
        const sectorColors = { 1: '#E70E6C', 2: '#FBCF02', 3: '#369BE5' };
        const slw = Math.max(6, 6 * scale);
        let currentSector = -1;
        let sectorPath = "";
        for (let i = 0; i < track.length; i++) {
            const p = track[i];
            const sec = p.sector;
            if (sec === 0) continue;
            
            const s = ts(p.x, p.y);
            if (sec !== currentSector) {
                if (sectorPath !== "") {
                    svg += `<path d="${sectorPath}" fill="none" stroke="${sectorColors[currentSector] || '#555'}" stroke-width="${slw}" stroke-linecap="round" stroke-linejoin="round" />`;
                }
                currentSector = sec;
                
                // Start new path slightly before this point by connecting from previous if possible
                let startS = s;
                if (i > 0) {
                    startS = ts(track[i-1].x, track[i-1].y);
                }
                sectorPath = `M ${startS.x} ${startS.y} L ${s.x} ${s.y} `;
            } else {
                sectorPath += `L ${s.x} ${s.y} `;
            }
        }
        if (sectorPath !== "") {
            svg += `<path d="${sectorPath}" fill="none" stroke="${sectorColors[currentSector] || '#555'}" stroke-width="${slw}" stroke-linecap="round" stroke-linejoin="round" />`;
        }

        // Overlaps/Bridges moved below SMZ
        // Straight Mode Zones (Red Dashes and Text)
        data.zones.filter(z => z.type === 'straight_mode').forEach(zone => {
            const si = zone.segIndex * editor.resolution + Math.floor(zone.t * editor.resolution);
            const ei = zone.endSegIndex * editor.resolution + Math.floor(zone.endT * editor.resolution);
            if (si === undefined || ei === undefined) return;

            const spacing = zone.stripSpacing || 2;
            const sw = zone.stripWidth || 5;
            const targetGap = spacing * 5;
            const stripOffsetWorld = 20 + 4 / scale + sw;
            const sideSign = zone.side === 'left' ? -1 : 1;

            let stripPoints = [];
            let currentDist = 0;
            let prevP = null;

            const addStripPoints = (startIdx, endIdx) => {
                for (let i = startIdx; i <= endIdx; i++) {
                    const p = track[i];
                    const ox = p.x + p.nx * stripOffsetWorld * sideSign;
                    const oy = p.y + p.ny * stripOffsetWorld * sideSign;

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

            if (si <= ei) { addStripPoints(si, ei); }
            else if (data.isClosed) { addStripPoints(si, track.length - 1); addStripPoints(0, ei); }
            else { addStripPoints(ei, si); }

            const n = stripPoints.length;
            for (let idx = 0; idx < n; idx++) {
                const sp = stripPoints[idx];
                const taper = (idx === 0 || idx === n - 1) ? 1.0 : 0.35;
                const L_half = sw * taper;
                const s = ts(sp.x, sp.y);
                const angle = Math.atan2(sp.ny * sideSign, sp.nx * sideSign) * 180 / Math.PI;

                const shiftX = -(sw - L_half) * scale;
                const len = L_half * 2 * scale;
                const thick = sw * 0.6 * scale;
                
                svg += `<g transform="translate(${s.x}, ${s.y}) rotate(${angle})">`;
                if (stripsURI) {
                    svg += `<image href="${stripsURI}" x="${shiftX - len/2}" y="${-thick/2}" width="${len}" height="${thick}" preserveAspectRatio="none" />`;
                } else {
                    svg += `<rect x="${shiftX - len/2}" y="${-thick/2}" width="${len}" height="${thick}" fill="#ff1801" />`;
                }
                svg += `</g>`;
            }

            // Text Label
            if (zone.showLabel !== false) {
                const textOffsetWorld = stripOffsetWorld + sw + 4 / scale + 11 / 2;
                let pathPts = [];
                const buildPathPts = (startIdx, endIdx) => {
                    for (let i = startIdx; i <= endIdx; i++) {
                        const p = track[i];
                        pathPts.push({
                            x: p.x + p.nx * textOffsetWorld * sideSign,
                            y: p.y + p.ny * textOffsetWorld * sideSign
                        });
                    }
                };
                if (si <= ei) { buildPathPts(si, ei); }
                else if (data.isClosed) { buildPathPts(si, track.length - 1); buildPathPts(0, ei); }
                else { buildPathPts(ei, si); }

                const autoFlip = pathPts.length > 1 && (pathPts[pathPts.length - 1].x < pathPts[0].x);
                let shouldFlip = autoFlip;
                if (zone.labelFlipped) { shouldFlip = !shouldFlip; }
                if (shouldFlip) { pathPts.reverse(); }

                if (pathPts.length > 2) {
                    let dPath = `M ${ts(pathPts[0].x, pathPts[0].y).x} ${ts(pathPts[0].x, pathPts[0].y).y} `;
                    let totalLen = 0;
                    for (let i = 1; i < pathPts.length; i++) {
                        const s = ts(pathPts[i].x, pathPts[i].y);
                        dPath += `L ${s.x} ${s.y} `;
                        totalLen += Math.hypot(pathPts[i].x - pathPts[i-1].x, pathPts[i].y - pathPts[i-1].y) * scale;
                    }
                    const textId = `smz_path_${zone.id || Math.random().toString(36).substr(2, 9)}`;
                    svg += `<defs><path id="${textId}" d="${dPath}" fill="none" /></defs>`;
                    const zt = F1.ZONE_TYPES.find(t => t.key === zone.type);
                    const labelText = (zone.label || zt.label || '').toUpperCase();
                    // Rough estimate of text width to center it
                    // The text-anchor="middle" with startOffset="50%" perfectly centers it on the path!
                    svg += `<text fill="#ff1801" font-family="Outfit" font-size="${11 * scale}" font-weight="bold" letter-spacing="${3 * scale}">`;
                    svg += `<textPath href="#${textId}" startOffset="50%" text-anchor="middle" method="align">${labelText}</textPath>`;
                    svg += `</text>`;
                }
            }
        });

        // Overlaps/Bridges (simplified fallback for SVG to match renderer)
        if (window.app && window.app.intersections) {
            window.app.intersections.forEach(ix => {
                const key = ix.key;
                const legacyKey = `${ix.cpA}-${ix.cpB}`;
                const inverted = data.overlapInversions && (data.overlapInversions.includes(key) || data.overlapInversions.includes(legacyKey));
                let topIdx = Math.max(ix.trackIdxA, ix.trackIdxB);
                if (inverted) topIdx = Math.min(ix.trackIdxA, ix.trackIdxB);

                const span = 25;
                let start = topIdx - span;
                let end = topIdx + span;

                if (!data.isClosed) {
                    start = Math.max(0, start);
                    end = Math.min(track.length - 1, end);
                }

                let subPath = "";
                let secPaths = {};

                for (let i = start; i <= end; i++) {
                    let actualI = i;
                    if (actualI < 0) actualI += track.length;
                    if (actualI >= track.length) actualI -= track.length;
                    const p = track[actualI];
                    if (!p) continue;

                    const s = ts(p.x, p.y);
                    if (subPath === "") subPath += `M ${s.x} ${s.y} `;
                    else subPath += `L ${s.x} ${s.y} `;

                    if (i > start) {
                        const prevI = actualI === 0 ? track.length - 1 : actualI - 1;
                        const prevP = track[prevI];
                        const sec = prevP ? prevP.sector : 0;
                        if (sec !== 0) {
                            if (!secPaths[sec]) secPaths[sec] = { path: "", lastPoint: null };
                            const a = ts(prevP.x, prevP.y);
                            if (secPaths[sec].lastPoint && Math.abs(secPaths[sec].lastPoint.x - a.x) < 0.01 && Math.abs(secPaths[sec].lastPoint.y - a.y) < 0.01) {
                                secPaths[sec].path += `L ${s.x} ${s.y} `;
                            } else {
                                secPaths[sec].path += `M ${a.x} ${a.y} L ${s.x} ${s.y} `;
                            }
                            secPaths[sec].lastPoint = s;
                        }
                    }
                }

                if (subPath !== "") {
                    svg += `<path d="${subPath}" fill="none" stroke="${this.bgColor}" stroke-width="${43 * scale + 2}" stroke-linecap="butt" stroke-linejoin="round" />`;
                    svg += `<path d="${subPath}" fill="none" stroke="#ffffff" stroke-width="${43 * scale}" stroke-linecap="butt" stroke-linejoin="round" />`;
                    svg += `<path d="${subPath}" fill="none" stroke="#111111" stroke-width="${40 * scale}" stroke-linecap="butt" stroke-linejoin="round" />`;
                    Object.keys(secPaths).forEach(sec => {
                        svg += `<path d="${secPaths[sec].path}" fill="none" stroke="${sectorColors[sec] || '#555'}" stroke-width="${slw}" stroke-linecap="butt" />`;
                    });
                }
            });
        }

        // Start/Finish Line & Arrow
        const startPoint = track[0];
        const sStart = ts(startPoint.x, startPoint.y);
        const sn = { x: startPoint.nx, y: startPoint.ny };
        const angle = Math.atan2(sn.y, sn.x) * 180 / Math.PI;
        
        svg += `<g transform="translate(${sStart.x}, ${sStart.y}) rotate(${angle})">`;
        const size = 30 * scale;
        if (chequeredURI) {
            svg += `<image href="${chequeredURI}" x="${-size/2}" y="${-40*scale}" width="${size}" height="${80*scale}" preserveAspectRatio="none" />`;
        } else {
            // Fallback just in case
            svg += `<rect x="${-size/2}" y="${-40*scale}" width="${size}" height="${80*scale}" fill="url(#chequered)" />`;
        }
        
        // Arrow (translated slightly like in preview-renderer)
        const ax = 35 * scale;
        const ay = 0;
        // The arrow SVG in preview uses a fixed coordinate Path2D roughly 24x24 in size, so we'll just scale and translate it
        // The preview renderer draws it at `ctx.translate(cx, cy); ctx.scale(sf, sf); ctx.translate(-12, -12);`
        svg += `<g transform="translate(${ax}, ${ay}) rotate(90) scale(${scale}) translate(-12, -12)">`;
        svg += `<use href="#track_arrow" />`;
        svg += `</g>`;
        svg += `</g>`;

        // Zones (Green/Yellow circles)
        data.zones.forEach(z => {
            const zt = F1.ZONE_TYPES.find(t => t.key === z.type);
            if (!zt) return;
            if (zt.range) return; 

            const p = editor.getZoneWorldPos(z);
            if (!p) return;
            const sp = ts(p.x, p.y);
            const lx = sp.x + (z.labelOffsetX || 0) * scale, ly = sp.y + (z.labelOffsetY || 0) * scale;

            svg += `<line x1="${sp.x}" y1="${sp.y}" x2="${lx}" y2="${ly}" stroke="#555" stroke-width="1.5" />`;
            svg += `<circle cx="${sp.x}" cy="${sp.y}" r="${5 * scale}" fill="${zt.color}" />`;
            svg += `<circle cx="${sp.x}" cy="${sp.y}" r="${9 * scale}" fill="none" stroke="${zt.color}" stroke-width="2" />`;
            
            const lines = z.label.toUpperCase().split('\n');
            lines.forEach((l, i) => {
                svg += `<text x="${lx}" y="${ly + i * 14 * scale}" fill="${zt.color}" font-family="Outfit" font-size="${12 * scale}" font-weight="bold" text-anchor="middle" filter="url(#glow)">${l}</text>`;
            });
        });

        // Sector Labels
        if (data.sectorLabels) {
            data.sectorLabels.forEach(sl => {
                const pts = track.filter(pt => pt.sector === sl.sector); if (!pts.length) return;
                const mid = pts[Math.floor(pts.length / 2)];
                const sMid = ts(mid.x, mid.y);
                const lx = sMid.x + sl.labelOffsetX * scale, ly = sMid.y + sl.labelOffsetY * scale;
                const text = `SECTOR ${sl.sector}`;
                // Estimate width based on scale
                const tw = 60 * scale; 
                const th = 22 * scale;
                const sColor = sl.sector === 1 ? '#E70E6C' : sl.sector === 2 ? '#FBCF02' : '#369BE5';
                
                svg += `<g transform="translate(${lx}, ${ly}) rotate(${sl.rotation || 0})">`;
                svg += `<rect x="${-tw/2}" y="${-th/2}" width="${tw}" height="${th}" rx="${4*scale}" ry="${4*scale}" fill="#ffffff" stroke="${sColor}" stroke-width="1.5" />`;
                svg += `<text x="0" y="${1*scale}" fill="#000000" font-family="Outfit" font-size="${10*scale}" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${text}</text>`;
                svg += `</g>`;
            });
        }

        // Turn Markers
        data.turnMarkers.forEach(tm => {
            const p = track[tm.segIndex * editor.resolution + Math.floor(tm.t * editor.resolution)];
            if (!p) return;
            const sgn = tm.side === 'left' ? -1 : 1;
            const w = sgn < 0 ? p.widthLeft : p.widthRight;
            const circleRadiusPx = 15 * scale;
            const distPx = w * scale + circleRadiusPx + 8 * scale;
            const sCenter = ts(p.x, p.y);
            const sp = { x: sCenter.x + p.nx * distPx * sgn, y: sCenter.y + p.ny * distPx * sgn };
            
            svg += `<circle cx="${sp.x}" cy="${sp.y}" r="${15 * scale}" fill="#ffffff" stroke="#000000" stroke-width="2.5" />`;
            svg += `<text x="${sp.x}" y="${sp.y + 1 * scale}" fill="#000000" font-family="Outfit" font-size="${13 * scale}" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${tm.label}</text>`;
        });

        // Text Overlay (Title & Info)
        const px = customNamePos ? customNamePos.x : (data.namePos ? data.namePos.x : 20);
        const py = customNamePos ? customNamePos.y : (data.namePos ? data.namePos.y : 20);
        const cname = data.name || 'UNTITLED CIRCUIT';
        svg += `<text x="${px}" y="${py}" fill="${this.nameColor}" font-family="Outfit" font-size="28" font-weight="bold" text-anchor="start" dominant-baseline="hanging">${cname.toUpperCase()}</text>`;

        const len = (editor.getTrackLength() * (data.gridSize / 50)) / 1000;
        const turns = data.turnMarkers.length;
        if (len > 0) {
            svg += `<text x="${px}" y="${py + 35}" fill="${this.infoColor}" font-family="Outfit" font-size="14" text-anchor="start" dominant-baseline="hanging">TRACK LENGTH: ${(len * 1000).toFixed(0)}m (${len.toFixed(3)} km)</text>`;
        }
        svg += `<text x="${px}" y="${py + 55}" fill="${this.infoColor}" font-family="Outfit" font-size="12" text-anchor="start" dominant-baseline="hanging">${turns} TURNS</text>`;

        svg += `</svg>`;
        return svg;
    }
};

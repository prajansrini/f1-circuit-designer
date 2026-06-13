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

    export(data, editor, W, H, transparent, customNamePos = null) {
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

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;

        // Definitions for patterns
        svg += `<defs>
            <pattern id="chequered" patternUnits="userSpaceOnUse" width="10" height="10">
                <rect width="5" height="5" fill="white"/>
                <rect x="5" y="5" width="5" height="5" fill="white"/>
                <rect x="5" width="5" height="5" fill="black"/>
                <rect y="5" width="5" height="5" fill="black"/>
            </pattern>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>`;

        // Background
        if (!transparent) {
            svg += `<rect width="${W}" height="${H}" fill="${this.bgColor}" />`;
        }

        // Track Base
        const lw = Math.max(16, 20 * scale);
        let path = `M ${ts(track[0].x, track[0].y).x} ${ts(track[0].x, track[0].y).y} `;
        for (let i = 1; i < track.length; i++) {
            const s = ts(track[i].x, track[i].y);
            path += `L ${s.x} ${s.y} `;
        }
        svg += `<path d="${path}" fill="none" stroke="#111111" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round" />`;

        // Sectors
        const sectorColors = { 1: '#E70E6C', 2: '#FBCF02', 3: '#369BE5' };
        const slw = Math.max(4, 5 * scale);
        for (let i = 1; i < track.length; i++) {
            const sec = track[i - 1].sector;
            if (sec === 0) continue;
            const a = ts(track[i - 1].x, track[i - 1].y);
            const b = ts(track[i].x, track[i].y);
            svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${sectorColors[sec] || '#555'}" stroke-width="${slw}" stroke-linecap="round" />`;
        }

        // Straight Mode Zones (Red Dashes)
        data.zones.filter(z => z.type === 'straight_mode').forEach(zone => {
            const si = zone.segIndex * editor.resolution + Math.floor(zone.t * editor.resolution);
            const ei = zone.endSegIndex * editor.resolution + Math.floor(zone.endT * editor.resolution);
            if (si === undefined || ei === undefined) return;

            const sgn = zone.side === 'left' ? -1 : 1;
            let spath = "";
            const buildPath = (startIdx, endIdx) => {
                for (let i = startIdx; i <= endIdx; i++) {
                    const p = track[i];
                    const w = sgn < 0 ? p.widthLeft : p.widthRight;
                    const offset = w + 8;
                    const sp = ts(p.x + p.nx * offset * sgn, p.y + p.ny * offset * sgn);
                    if (spath === "") spath += `M ${sp.x} ${sp.y} `;
                    else spath += `L ${sp.x} ${sp.y} `;
                }
            };

            if (si <= ei) { buildPath(si, ei); }
            else if (data.isClosed) { buildPath(si, track.length - 1); buildPath(0, ei); }
            else { buildPath(ei, si); }

            svg += `<path d="${spath}" fill="none" stroke="#ff1801" stroke-width="${6 * scale}" stroke-dasharray="${15 * scale} ${10 * scale}" stroke-linecap="butt" />`;
        });

        // Track Intersections (Overlaps)
        if (window.app && window.app.intersections) {
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

                let subPath = "";
                let prevSec = null;
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

                    // Collect sector line segments
                    if (i > start) {
                        const prevI = actualI === 0 ? track.length - 1 : actualI - 1;
                        const prevP = track[prevI];
                        const sec = prevP ? prevP.sector : 0;
                        if (sec !== 0) {
                            if (!secPaths[sec]) {
                                secPaths[sec] = { path: "", lastPoint: null };
                            }
                            const a = ts(prevP.x, prevP.y);
                            
                            // If we already have a path and the last point matches this start point, just LineTo
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
                    // Draw base layer for the bridge (creates a cutout effect against the track below)
                    svg += `<path d="${subPath}" fill="none" stroke="${this.bgColor}" stroke-width="${lw + 2}" stroke-linecap="butt" stroke-linejoin="round" />`;
                    // Draw track top
                    svg += `<path d="${subPath}" fill="none" stroke="#111111" stroke-width="${lw}" stroke-linecap="butt" stroke-linejoin="round" />`;
                    // Draw sectors for top
                    Object.keys(secPaths).forEach(sec => {
                        svg += `<path d="${secPaths[sec].path}" fill="none" stroke="${sectorColors[sec] || '#555'}" stroke-width="${slw}" stroke-linecap="butt" />`;
                    });
                }
            });
        }

        // Start/Finish Line & Arrow
        const startPoint = track[0];
        const s = ts(startPoint.x, startPoint.y);
        const sn = { x: startPoint.nx, y: startPoint.ny };
        const wTot = (startPoint.widthLeft + startPoint.widthRight) * scale * 1.5;
        const angle = Math.atan2(sn.y, sn.x) * 180 / Math.PI;
        svg += `<g transform="translate(${s.x}, ${s.y}) rotate(${angle})">
                    <rect x="-4" y="${-wTot}" width="8" height="${wTot * 2}" fill="url(#chequered)" />
                    <!-- Arrow -->
                    <g transform="translate(15, 0)">
                        <circle cx="0" cy="0" r="10" fill="#222" />
                        <path d="M -2 -4 L 3 0 L -2 4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </g>
                </g>`;

        // Zones
        data.zones.forEach(z => {
            const zt = F1.ZONE_TYPES.find(t => t.key === z.type);
            if (!zt) return;
            if (zt.range) return; // Handled straight_mode separately above

            const p = editor.getZoneWorldPos(z);
            if (!p) return;
            const sp = ts(p.x, p.y);
            const lx = sp.x + (z.labelOffsetX || 0) * scale, ly = sp.y + (z.labelOffsetY || 0) * scale;

            svg += `<line x1="${sp.x}" y1="${sp.y}" x2="${lx}" y2="${ly}" stroke="#888" stroke-width="1.5" />`;
            svg += `<circle cx="${sp.x}" cy="${sp.y}" r="6" fill="${zt.color}" />`;
            svg += `<circle cx="${sp.x}" cy="${sp.y}" r="10" fill="none" stroke="${zt.color}" stroke-width="2" />`;
            const lines = z.label.toUpperCase().split('\\n');
            lines.forEach((l, i) => {
                svg += `<text x="${lx}" y="${ly + i * 14}" fill="${zt.color}" font-family="Outfit" font-size="11" font-weight="bold" text-anchor="middle" filter="url(#glow)">${l}</text>`;
            });
        });

        // Turn Markers
        data.turnMarkers.forEach(tm => {
            const p = track[tm.segIndex * editor.resolution + Math.floor(tm.t * editor.resolution)];
            if (!p) return;
            const sgn = tm.side === 'left' ? -1 : 1;
            const w = sgn < 0 ? p.widthLeft : p.widthRight;
            const sp = ts(p.x + p.nx * (w + 12) * sgn, p.y + p.ny * (w + 12) * sgn);
            svg += `<circle cx="${sp.x}" cy="${sp.y}" r="12" fill="#fff" />`;
            svg += `<text x="${sp.x}" y="${sp.y + 4}" fill="#000" font-family="Outfit" font-size="12" font-weight="bold" text-anchor="middle">${tm.label}</text>`;
        });

        // Text Overlay (Draggable)
        const px = customNamePos ? customNamePos.x : (data.namePos ? data.namePos.x : 20);
        const py = customNamePos ? customNamePos.y : (data.namePos ? data.namePos.y : 16);
        const cname = data.name || 'UNTITLED CIRCUIT';
        svg += `<text x="${px}" y="${py}" fill="${this.nameColor}" font-family="Outfit" font-size="24" font-weight="bold" text-anchor="start" dominant-baseline="hanging">${cname.toUpperCase()}</text>`;

        const len = (editor.getTrackLength() * (data.gridSize / 50)) / 1000;
        const turns = data.turnMarkers.length;
        if (len > 0) {
            svg += `<text x="${px}" y="${py + 30}" fill="${this.infoColor}" font-family="Outfit" font-size="14" text-anchor="start" dominant-baseline="hanging">TRACK LENGTH: ${(len * 1000).toFixed(0)}m (${len.toFixed(3)} km)</text>`;
        }
        svg += `<text x="${px}" y="${py + 52}" fill="${this.infoColor}" font-family="Outfit" font-size="12" text-anchor="start" dominant-baseline="hanging">${turns} TURNS</text>`;

        svg += `</svg>`;
        return svg;
    }
};

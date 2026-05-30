const fs = require('fs');

const ptDistFunc = `
function rayIntersectSegment(px: number, py: number, rx: number, ry: number, x1: number, y1: number, x2: number, y2: number) {
    const v1x = rx - px;
    const v1y = ry - py;
    const v2x = x2 - x1;
    const v2y = y2 - y1;
    const cross = v1x * v2y - v1y * v2x;
    if (Math.abs(cross) < 1e-6) return Infinity; // parallel
    
    const t1 = ((x1 - px) * v2y - (y1 - py) * v2x) / cross;
    const t2 = ((x1 - px) * v1y - (y1 - py) * v1x) / cross;
    
    if (t1 > 0.01 && t2 >= 0 && t2 <= 1) {
        return t1 * Math.hypot(v1x, v1y);
    }
    return Infinity;
}

function getRaycastMaxR(px: number, py: number, angleStart: number, angleEnd: number, pts: any[], sweepFlag: number) {
    let minDist = 10.7 * PIXELS_PER_METER;
    const numRays = 20;
    
    let aStart = angleStart;
    let aEnd = angleEnd;
    let diff = sweepFlag === 1 ? aEnd - aStart : aStart - aEnd;
    while (diff < 0) diff += 2 * Math.PI;
    
    for (let i = 0; i <= numRays; i++) {
        let frac = i / numRays;
        let angle = aStart + (sweepFlag === 1 ? diff * frac : -diff * frac);
        let rx = px + Math.cos(angle);
        let ry = py + Math.sin(angle);
        
        let rayMinDist = Infinity;
        for (let j = 0; j < pts.length; j++) {
            let p1 = pts[j];
            let p2 = pts[(j + 1) % pts.length];
            // skip if the ray originates exactly on this segment
            if ((Math.abs(px - p1.x) < 1e-3 && Math.abs(py - p1.y) < 1e-3) || 
                (Math.abs(px - p2.x) < 1e-3 && Math.abs(py - p2.y) < 1e-3)) {
                // If it's a corner, the neighboring segments are omitted from hits at t=0,
                // but rayIntersectSegment requires t1 > 0.01 so it skips incident edges inherently initially.
            }
            
            let dist = rayIntersectSegment(px, py, rx, ry, p1.x, p1.y, p2.x, p2.y);
            if (dist < rayMinDist) rayMinDist = dist;
        }
        if (rayMinDist < minDist) {
            minDist = rayMinDist;
        }
    }
    return Math.max(1.0 * PIXELS_PER_METER, minDist);
}
`;

console.log(ptDistFunc);

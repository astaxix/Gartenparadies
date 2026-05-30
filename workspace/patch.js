const fs = require('fs');
let content = fs.readFileSync('src/components/PlannerCanvas.tsx', 'utf8');

const raycastHelpers = `
function rayIntersectSegment(px: number, py: number, rx: number, ry: number, x1: number, y1: number, x2: number, y2: number) {
    const v1x = rx - px;
    const v1y = ry - py;
    const v2x = x2 - x1;
    const v2y = y2 - y1;
    const cross = v1x * v2y - v1y * v2x;
    if (Math.abs(cross) < 1e-6) return Infinity; // parallel
    
    const t1 = ((x1 - px) * v2y - (y1 - py) * v2x) / cross;
    const t2 = ((x1 - px) * v1y - (y1 - py) * v1x) / cross;
    
    // Ignore hits within 5 pixels (10cm) to avoid false collisions with adjacent edges
    if (t1 > 5 && t2 >= -0.01 && t2 <= 1.01) {
        return t1; // since v1 is a unit vector, t1 is the distance in pixels
    }
    return Infinity;
}

function getRaycastMaxR(px: number, py: number, angleStart: number, diff: number, sweepFlag: number, pts: any[]) {
    let minDist = 10.7 * PIXELS_PER_METER;
    const numRays = 30; // Cast 30 rays
    
    for (let i = 0; i <= numRays; i++) {
        let frac = i / numRays;
        let angle = angleStart + (sweepFlag === 1 ? diff * frac : -diff * frac);
        let rx = px + Math.cos(angle);
        let ry = py + Math.sin(angle);
        
        let rayMinDist = Infinity;
        for (let j = 0; j < pts.length; j++) {
            let p1 = pts[j];
            let p2 = pts[(j + 1) % pts.length];
            let d = rayIntersectSegment(px, py, rx, ry, p1.x, p1.y, p2.x, p2.y);
            if (d < rayMinDist) rayMinDist = d;
        }
        if (rayMinDist < minDist) {
            minDist = rayMinDist;
        }
    }
    // Limit to minimum 1.5m, maximum 10.7m.
    return Math.min(Math.max(1.5 * PIXELS_PER_METER, minDist), 10.7 * PIXELS_PER_METER);
}
`;

if (!content.includes('rayIntersectSegment')) {
    content = content.replace('export default function PlannerCanvas', raycastHelpers + 'export default function PlannerCanvas');
}

const loopBodyRegex = /let distNext = Math\.hypot\(pNext\.x - pCurr\.x, pNext\.y - pCurr\.y\);[\s\S]*?if \(distNext > targetR \* 1\.65\) {[\s\S]*?\}[\s\S]*?\}/g;

const newLoopBody = `
           let distNext = Math.hypot(pNext.x - pCurr.x, pNext.y - pCurr.y);
           let aNext = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);
           let aPrev = Math.atan2(pPrev.y - pCurr.y, pPrev.x - pCurr.x);
           
           let sweepFlag = isClockwise ? 1 : 0;
           let diff = isClockwise ? (aPrev - aNext) : (aNext - aPrev);
           
           while (diff <= 0) diff += 2 * Math.PI;
           while (diff > 2 * Math.PI) diff -= 2 * Math.PI;
           
           let targetR = getRaycastMaxR(pCurr.x, pCurr.y, aNext, diff, sweepFlag, pts);
           
           let largeArc = diff > Math.PI ? 1 : 0;
           
           const angleDeg = diff * 180 / Math.PI;
           const nz = getNozzleData(targetR, angleDeg);
           let r = nz.radiusPx;
           
           const physicalAngle = nz.physicalAngle;
           let isFullCircle = physicalAngle >= 359;
           let actualAngleEnd = isFullCircle ? Math.PI * 2 : (aNext + (physicalAngle * Math.PI / 180) * (sweepFlag === 1 ? 1 : -1));
           while (actualAngleEnd < 0) actualAngleEnd += Math.PI * 2;
           while (actualAngleEnd >= Math.PI * 2) actualAngleEnd -= Math.PI * 2;
           let actualLargeArc = physicalAngle > 180 ? 1 : 0;

           let actualId = s.id + '-' + i + '-' + Date.now();
           newSprinklers.push({
              shapeId: s.id,
              id: 'sp-auto-' + actualId,
              x: pCurr.x, 
              y: pCurr.y, 
              r: r,
              angleStart: aNext,
              angleEnd: isFullCircle ? Math.PI * 2 : actualAngleEnd,
              sweepFlag: sweepFlag,
              largeArc: actualLargeArc,
              angleDeg: physicalAngle,
              label: nz.name,
              flowLpm: nz.flowLpm,
              isManual: true,
              zoneColor: nz.colorHex
           });

           // Place intermediate sprinklers
           // Use up to 1.4 * radius spacing to minimize sprinklers while keeping acceptable overlap
           // We cap at distNext - (r * 0.7) to avoid crowding the next corner
           let currentEdgePos = r * 1.4; 
           let j = 1;

           let sanity = 0;
           while (currentEdgePos < distNext - (r * 0.7) && sanity < 50) {
               sanity++;
               let frac = currentEdgePos / distNext;
               let midX = pCurr.x + (pNext.x - pCurr.x) * frac;
               let midY = pCurr.y + (pNext.y - pCurr.y) * frac;
               
               let lineAngle = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);
               let midAngleStart = lineAngle;
               let midAngleEnd = lineAngle + Math.PI;
               if (!isClockwise) {
                   midAngleStart = lineAngle + Math.PI;
                   midAngleEnd = lineAngle;
               }
               
               let midDiff = Math.PI; 
               let midTargetR = getRaycastMaxR(midX, midY, midAngleStart, midDiff, isClockwise ? 1 : 0, pts);
               
               const midNz = getNozzleData(midTargetR, 180);
               newSprinklers.push({
                   shapeId: s.id,
                   id: 'sp-auto-mid-' + actualId + '-' + j,
                   x: midX, y: midY, r: midNz.radiusPx,
                   angleStart: midAngleStart,
                   angleEnd: midAngleEnd,
                   sweepFlag: isClockwise ? 1 : 0,
                   largeArc: 0,
                   angleDeg: 180,
                   label: midNz.name,
                   flowLpm: midNz.flowLpm,
                   isManual: true,
                   zoneColor: midNz.colorHex
               });
               
               currentEdgePos += (midNz.radiusPx * 1.4);
               j++;
           }
`;

content = content.replace(loopBodyRegex, newLoopBody.trim());
fs.writeFileSync('src/components/PlannerCanvas.tsx', content);
console.log('Patched raycast');

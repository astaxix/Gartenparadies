const fs = require('fs');

let content = fs.readFileSync('src/components/PlannerCanvas.tsx', 'utf8');

const replacement = `shapes.filter(s => s.areaType === 'lawn').forEach(s => {
       let pts = [...s.points].map(p => ({...p}));
       if (s.type === 'rectangle' && pts.length === 2) {
           const minX = Math.min(pts[0].x, pts[1].x);
           const maxX = Math.max(pts[0].x, pts[1].x);
           const minY = Math.min(pts[0].y, pts[1].y);
           const maxY = Math.max(pts[0].y, pts[1].y);
           pts = [ {x:minX,y:minY}, {x:maxX,y:minY}, {x:maxX,y:maxY}, {x:minX,y:maxY} ];
       }

       if (s.type === 'circle' && pts.length === 2) {
           const [center, edge] = pts;
           const rPx = Math.hypot(edge.x - center.x, edge.y - center.y);
           let targetR = getRaycastMaxR(center.x, center.y, 0, Math.PI * 2, 1, pts);
           if (targetR > rPx) targetR = rPx;
           const nz = getNozzleData(targetR, 360);
           newSprinklers.push({
               shapeId: s.id,
               id: 'sp-auto-' + s.id + '-' + Date.now(),
               x: center.x, y: center.y, r: nz.radiusPx, 
               angleStart: 0, angleEnd: 0, sweepFlag: 1, largeArc: 1, angleDeg: 360, label: nz.name,
               flowLpm: nz.flowLpm,
               isManual: true,
               zoneColor: nz.colorHex
           });
           return; 
       }
       
       let sum = 0;
       for(let i=0; i<pts.length; i++) {
          let p1 = pts[i];
          let p2 = pts[(i+1)%pts.length];
          sum += (p2.x - p1.x)*(p2.y + p1.y);
       }
       const isClockwise = sum < 0;
       
       let minX = Math.min(...pts.map(p => p.x));
       let maxX = Math.max(...pts.map(p => p.x));
       let minY = Math.min(...pts.map(p => p.y));
       let maxY = Math.max(...pts.map(p => p.y));
       
       const isInside = (pt: Point) => {
            let inside = false;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                let xi = pts[i].x, yi = pts[i].y;
                let xj = pts[j].x, yj = pts[j].y;
                let intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
       };

       let candidates: any[] = [];
       const uuid = () => Math.random().toString(36).substr(2, 9);
       
       const addCandidate = (cx: number, cy: number, aStart: number, sweepF: number, diff: number, idSuffix: string) => {
           let targetR = getRaycastMaxR(cx, cy, aStart, diff, sweepF, pts);
           const angleDeg = diff * 180 / Math.PI;
           const nz = getNozzleData(targetR, angleDeg);
           let r = nz.radiusPx;
           
           const physicalAngle = nz.physicalAngle;
           let isFullCircle = physicalAngle >= 359;
           let actualAngleEnd = isFullCircle ? Math.PI * 2 : (aStart + (physicalAngle * Math.PI / 180) * (sweepF === 1 ? 1 : -1));
           while (actualAngleEnd < 0) actualAngleEnd += Math.PI * 2;
           while (actualAngleEnd >= Math.PI * 2) actualAngleEnd -= Math.PI * 2;
           let actualLargeArc = physicalAngle > 180 ? 1 : 0;

           candidates.push({
              shapeId: s.id,
              id: 'sp-auto-' + s.id + '-' + idSuffix + '-' + uuid(),
              x: cx, 
              y: cy, 
              r: r,
              angleStart: aStart,
              angleEnd: isFullCircle ? Math.PI * 2 : actualAngleEnd,
              sweepFlag: sweepF,
              largeArc: actualLargeArc,
              angleDeg: physicalAngle,
              label: nz.name,
              flowLpm: nz.flowLpm,
              isManual: true,
              zoneColor: nz.colorHex,
              diff: diff
           });
       };

       // Schritt 1: Ecken setzen
       for(let i=0; i<pts.length; i++) {
           let pPrev = pts[(i - 1 + pts.length) % pts.length];
           let pCurr = pts[i];
           let pNext = pts[(i + 1) % pts.length];
           
           let aNext = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);
           let aPrev = Math.atan2(pPrev.y - pCurr.y, pPrev.x - pCurr.x);
           
           let sweepFlag = isClockwise ? 1 : 0;
           let diff = isClockwise ? (aPrev - aNext) : (aNext - aPrev);
           
           while (diff <= 0) diff += 2 * Math.PI;
           while (diff > 2 * Math.PI) diff -= 2 * Math.PI;
           
           addCandidate(pCurr.x, pCurr.y, aNext, sweepFlag, diff, "corner-" + i);
       }

       // Schritt 2: Kanten auffüllen
       for(let i=0; i<pts.length; i++) {
           let pCurr = pts[i];
           let pNext = pts[(i + 1) % pts.length];
           let distNext = Math.hypot(pNext.x - pCurr.x, pNext.y - pCurr.y);
           
           let lineAngle = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);
           let midAngleStart = lineAngle;
           let sweepF = isClockwise ? 1 : 0;
           if (!isClockwise) {
               midAngleStart = lineAngle + Math.PI;
           }
           let diff = Math.PI; 
           
           let midTargetR = getRaycastMaxR(pCurr.x, pCurr.y, midAngleStart, diff, sweepF, pts); 
           let estRadius = Math.max(1.5 * PIXELS_PER_METER, midTargetR);
           
           let currentEdgePos = estRadius * 1.0; 
           let j = 1;
           let sanity = 0;
           
           while (currentEdgePos < distNext - (estRadius * 0.7) && sanity < 50) {
               sanity++;
               let frac = currentEdgePos / distNext;
               let midX = pCurr.x + (pNext.x - pCurr.x) * frac;
               let midY = pCurr.y + (pNext.y - pCurr.y) * frac;
               
               addCandidate(midX, midY, midAngleStart, sweepF, diff, "edge-" + i + "-" + j);
               
               let actualR = candidates[candidates.length-1].r;
               currentEdgePos += (actualR * 1.0);
               j++;
           }
       }
       
       // Schritt 3: Mitte prüfen
       let step = 4 * PIXELS_PER_METER;
       for(let x = minX + step; x < maxX; x += step) {
           for(let y = minY + step; y < maxY; y += step) {
               if (isInside({x, y})) {
                   addCandidate(x, y, 0, 1, Math.PI * 2, "center");
               }
           }
       }

       // Helper coverage
       const isCovered = (px: number, py: number, sp: any) => {
           let dist = Math.hypot(px - sp.x, py - sp.y);
           if (dist > sp.r) return false;
           if (sp.angleDeg >= 359) return true;
           let angleToPt = Math.atan2(py - sp.y, px - sp.x);
           
           let aStart = sp.angleStart;
           let diff = sp.diff;
           let aEnd = sp.sweepFlag === 1 ? aStart + diff : aStart - diff;
           
           let a = angleToPt;
           while (a < 0) a += 2*Math.PI; while (a >= 2*Math.PI) a -= 2*Math.PI;
           let start = aStart;
           while (start < 0) start += 2*Math.PI; while (start >= 2*Math.PI) start -= 2*Math.PI;
           let end = aEnd;
           while (end < 0) end += 2*Math.PI; while (end >= 2*Math.PI) end -= 2*Math.PI;
           
           if (sp.sweepFlag === 1) {
               if (start < end) { return a >= start && a <= end; }
               else { return a >= start || a <= end; }
           } else {
               if (start > end) { return a <= start && a >= end; }
               else { return a <= start || a >= end; }
           }
       };

       let testPoints: any[] = [];
       let evalStep = 1.0 * PIXELS_PER_METER; 
       for(let x = minX; x <= maxX; x += evalStep) {
           for(let y = minY; y <= maxY; y += evalStep) {
               if (isInside({x, y})) {
                   testPoints.push({x, y});
               }
           }
       }

       // Schritt 4: unnötige Regner entfernen
       let getCoverage = (sprinklerList: any[]) => {
           if (testPoints.length === 0) return 1;
           let coveredCount = 0;
           for(let pt of testPoints) {
               for(let sp of sprinklerList) {
                   if (isCovered(pt.x, pt.y, sp)) {
                       coveredCount++;
                       break;
                   }
               }
           }
           return coveredCount / testPoints.length;
       };

       let finalSprinklers = [...candidates];
       
       for(let i = finalSprinklers.length - 1; i >= 0; i--) {
           let testList = [...finalSprinklers];
           testList.splice(i, 1);
           
           let cov = getCoverage(testList);
           if (cov >= 0.98) {
               finalSprinklers.splice(i, 1);
           }
       }

       finalSprinklers.forEach(sp => {
           delete sp.diff;
       });

       newSprinklers.push(...finalSprinklers);
    });`;

const loopBodyRegex = /shapes\.filter\(s => s\.areaType === 'lawn'\)\.forEach\(s => \{[\s\S]*?\}\);/g;
content = content.replace(loopBodyRegex, replacement.trim());

fs.writeFileSync('src/components/PlannerCanvas.tsx', content);
console.log('Patched');

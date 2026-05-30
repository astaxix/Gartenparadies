const fs = require('fs');

let content = fs.readFileSync('src/components/PlannerCanvas.tsx', 'utf8');

// Insert pointToSegmentDist at the top, just before the component
const ptDistFunc = `function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  let dx = x2 - x1;
  let dy = y2 - y1;
  let len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

`;
if (!content.includes('pointToSegmentDist')) {
    content = content.replace('export default function PlannerCanvas', ptDistFunc + 'export default function PlannerCanvas');
}

const searchStr = `          let targetR = Math.min(bboxMin, 10.7 * PIXELS_PER_METER);
          if (targetR < 2 * PIXELS_PER_METER) targetR = 2 * PIXELS_PER_METER;

          for(let i=0; i<pts.length; i++) {
              let pPrev = pts[(i - 1 + pts.length) % pts.length];
              let pCurr = pts[i];
              let pNext = pts[(i + 1) % pts.length];`;

const replaceStr = `          let baseTargetR = Math.min(bboxMin, 10.7 * PIXELS_PER_METER);
          if (baseTargetR < 2 * PIXELS_PER_METER) baseTargetR = 2 * PIXELS_PER_METER;

          for(let i=0; i<pts.length; i++) {
              let pPrev = pts[(i - 1 + pts.length) % pts.length];
              let pCurr = pts[i];
              let pNext = pts[(i + 1) % pts.length];
              
              let distNext = Math.hypot(pNext.x - pCurr.x, pNext.y - pCurr.y);
              let distPrev = Math.hypot(pPrev.x - pCurr.x, pPrev.y - pCurr.y);

              let minNonIncidentDist = baseTargetR;
              for(let j=0; j<pts.length; j++) {
                  if (j !== i && (j + 1) % pts.length !== i && j !== (i - 1 + pts.length) % pts.length) {
                      let p1 = pts[j];
                      let p2 = pts[(j + 1) % pts.length];
                      let d = pointToSegmentDist(pCurr.x, pCurr.y, p1.x, p1.y, p2.x, p2.y);
                      if (d < minNonIncidentDist && d > 1.0 * PIXELS_PER_METER) {
                          minNonIncidentDist = d;
                      }
                  }
              }

              let targetR = Math.min(Math.max(distNext, distPrev), minNonIncidentDist);
              if (targetR < 1.1 * PIXELS_PER_METER) targetR = 1.1 * PIXELS_PER_METER;`;

while (content.includes(searchStr)) {
    content = content.replace(searchStr, replaceStr);
}

content = content.replace(/if \(width > 2\.2 \* targetR && height > 2\.2 \* targetR\)/g, 'if (width > 2.2 * baseTargetR && height > 2.2 * baseTargetR)');
content = content.replace(/let cols = Math\.floor\(width \/ targetR\)/g, 'let cols = Math.floor(width / baseTargetR)');
content = content.replace(/let rows = Math\.floor\(height \/ targetR\)/g, 'let rows = Math.floor(height / baseTargetR)');

fs.writeFileSync('src/components/PlannerCanvas.tsx', content);
console.log("Patched successfully!");

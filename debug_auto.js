const triggerOptionalAutoPlan = () => {
    const valveBoxes = infraNodes.filter(n => n.type === 'valve_box');
    if (valveBoxes.length === 0) {
      alert("Bitte platziere zuerst eine Verteilerbox auf der Zeichnung, um die automatische Bestückung zu starten!");
      setTool('valve_box');
      return;
    }
    const waterSources = infraNodes.filter(n => n.type === 'water_source');
    if (waterSources.length === 0) {
      alert("Bitte platziere zuerst einen Wasseranschluss auf der Zeichnung, um die automatische Bestückung zu starten!");
      setTool('water_source');
      return;
    }
    const vb = valveBoxes[0].pos;
    
    let newSprinklers: any[] = [];
    
    shapes.filter(s => s.areaType === 'lawn').forEach(s => {
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
           const nz = getNozzleData(rPx, 360);
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
       let bboxMin = Math.min(maxX - minX, maxY - minY);
       let baseTargetR = Math.min(bboxMin, 10.7 * PIXELS_PER_METER);
          if (baseTargetR < 2 * PIXELS_PER_METER) baseTargetR = 2 * PIXELS_PER_METER;

          for(let i=0; i<pts.length; i++) {
              let pPrev = pts[(i - 1 + pts.length) % pts.length];
              let pCurr = pts[i];
              let pNext = pts[(i + 1) % pts.length];
              
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

           let actualId = s.id + "-" + i + "-" + Date.now();
           newSprinklers.push({
              shapeId: s.id,
              id: "sp-auto-" + actualId,
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
                   id: "sp-auto-mid-" + actualId + "-" + j,
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
       }
    });

    setSprinklers(newSprinklers);
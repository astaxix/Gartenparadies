import React, { useState, useRef, useEffect, MouseEvent, WheelEvent, TouchEvent } from 'react';
import { ArrowLeft, ZoomIn, ZoomOut, Hand, MousePointer2, Square, Circle, PenTool, Image as ImageIcon, Trash2, Info, Check, X, Mouse, Droplet, Cpu, Box, Trees, Flower2, CircleDot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type Point = { x: number; y: number };
export type ShapeType = 'polygon' | 'rectangle' | 'circle';
export type AreaType = 'lawn' | 'bed' | 'tree';
export type Shape = { id: string; type: ShapeType; points: Point[]; color: string; areaType?: AreaType };

export type InfraType = 'water_source' | 'controller' | 'valve_box';
export type InfraNode = { id: string; type: InfraType; pos: Point; details?: any };
export type PlannerStep = 'start_choice' | 'draw' | 'planning_choice' | 'pipeline_drawing' | 'irrigation_choice' | 'irrigation_manual' | 'infrastructure' | 'calculation';

const PIXELS_PER_METER = 50;

function lineIntersectsShape(p1: Point, p2: Point, shape: Shape): boolean {
  const segmentsIntersect = (a: Point, b: Point, c: Point, d: Point): boolean => {
    const det = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
    if (det === 0) return false;
    const lambda = ((d.y - c.y) * (d.x - a.x) + (c.x - d.x) * (d.y - a.y)) / det;
    const gamma = ((a.y - b.y) * (d.x - a.x) + (b.x - a.x) * (d.y - a.y)) / det;
    return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
  };

  let pts = shape.points;
  if (shape.type === 'rectangle' && pts.length === 2) {
     const minX = Math.min(pts[0].x, pts[1].x);
     const maxX = Math.max(pts[0].x, pts[1].x);
     const minY = Math.min(pts[0].y, pts[1].y);
     const maxY = Math.max(pts[0].y, pts[1].y);
     pts = [ {x:minX, y:minY}, {x:maxX, y:minY}, {x:maxX, y:maxY}, {x:minX, y:maxY} ];
  }

  if (shape.type === 'circle' && pts.length === 2) {
     const [center, edge] = pts;
     const r = Math.hypot(edge.x - center.x, edge.y - center.y);
     const dx = p2.x - p1.x;
     const dy = p2.y - p1.y;
     const lenSq = dx * dx + dy * dy;
     if (lenSq === 0) return Math.hypot(p1.x - center.x, p1.y - center.y) < r;
     let t = ((center.x - p1.x) * dx + (center.y - p1.y) * dy) / lenSq;
     t = Math.max(0, Math.min(1, t));
     const closestX = p1.x + t * dx;
     const closestY = p1.y + t * dy;
     return Math.hypot(closestX - center.x, closestY - center.y) < r;
  }

  for (let i = 0; i < pts.length; i++) {
     const next = pts[(i + 1) % pts.length];
     if (segmentsIntersect(p1, p2, pts[i], next)) {
        return true;
     }
  }

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

  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  if (isInside(mid) || isInside(p1) || isInside(p2)) {
     return true;
  }

  return false;
}

function findSafePath(start: Point, end: Point, avoidShapes: Shape[]): Point[] {
  const lineIntersectsAny = (p1: Point, p2: Point) => {
     for (const shape of avoidShapes) {
        if (lineIntersectsShape(p1, p2, shape)) {
           return shape;
        }
     }
     return null;
  };

  const intersectedShape = lineIntersectsAny(start, end);
  if (!intersectedShape) {
     return [start, end];
  }

  const margin = 30; // 30 pixels offset to ensure spacing
  let pts = intersectedShape.points;
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  if (intersectedShape.type === 'circle' && pts.length === 2) {
      const [center, edge] = pts;
      const r = Math.hypot(edge.x - center.x, edge.y - center.y);
      minX = center.x - r; maxX = center.x + r;
      minY = center.y - r; maxY = center.y + r;
  } else {
      minX = Math.min(...pts.map(p => p.x));
      maxX = Math.max(...pts.map(p => p.x));
      minY = Math.min(...pts.map(p => p.y));
      maxY = Math.max(...pts.map(p => p.y));
  }

  const boxMinX = minX - margin;
  const boxMaxX = maxX + margin;
  const boxMinY = minY - margin;
  const boxMaxY = maxY + margin;

  const options = [
    [start, {x: start.x, y: boxMinY}, {x: end.x, y: boxMinY}, end],
    [start, {x: start.x, y: boxMaxY}, {x: end.x, y: boxMaxY}, end],
    [start, {x: boxMinX, y: start.y}, {x: boxMinX, y: end.y}, end],
    [start, {x: boxMaxX, y: start.y}, {x: boxMaxX, y: end.y}, end]
  ];

  let bestOption = [start, end];
  let minCost = Infinity;

  options.forEach(opt => {
     let intersects = false;
     for (let i = 0; i < opt.length - 1; i++) {
        if (lineIntersectsAny(opt[i], opt[i+1])) {
           intersects = true;
           break;
        }
     }
     if (!intersects) {
        let dist = 0;
        for (let i = 0; i < opt.length - 1; i++) {
           dist += Math.hypot(opt[i+1].x - opt[i].x, opt[i+1].y - opt[i].y);
        }
        if (dist < minCost) {
           minCost = dist;
           bestOption = opt;
        }
     }
  });

  return bestOption;
}

function getNozzleData(rPx: number, angleDeg: number, selectedModel?: string) {
  let rMeters = rPx / PIXELS_PER_METER;
  
  // Clean angle within 45 to 360
  let normAngle = Math.max(45, Math.min(360, Math.round(angleDeg)));
  
  // Choose base model based on selectedModel parameter or auto-detect
  let baseModel = selectedModel || 'auto';
  if (baseModel === 'auto') {
    if (rMeters < 2.5) {
      baseModel = "MP800SR";
    } else if (rMeters <= 4.5 && normAngle <= 105) {
      baseModel = "MP Corner";
    } else if (rMeters <= 4.5) {
      baseModel = "MP1000";
    } else if (rMeters <= 4.9) {
      baseModel = "MP815";
    } else if (rMeters <= 6.4) {
      baseModel = "MP2000";
    } else if (rMeters <= 9.1) {
      baseModel = "MP3000";
    } else {
      baseModel = "MP3500";
    }
  }

  // Let's implement the matching schema based on model choice and angle:
  let nozzleId = "";
  let name = "";
  let minR = 1.1;
  let maxR = 10.7;
  let minAngle = 90;
  let maxAngle = 210;
  let nozzleColor = "";
  let colorHex = "#1d4ed8"; // default blue
  
  if (baseModel === "MP800SR") {
    minR = 1.8;
    maxR = 3.5;
    if (normAngle >= 315) {
      nozzleId = "MP800SR-360";
      name = "MP800SR-360";
      minAngle = 360;
      maxAngle = 360;
      nozzleColor = "Gelbgrün";
      colorHex = "#84cc16"; // lime-500
    } else {
      nozzleId = "MP800SR-90";
      name = "MP800SR-90";
      minAngle = 90;
      maxAngle = 210;
      nozzleColor = "Orange";
      colorHex = "#f97316"; // orange-500
    }
  } else if (baseModel === "MP Corner" || baseModel === "MP-Corner") {
    nozzleId = "MP-Corner";
    name = "MP-Corner";
    minR = 2.5;
    maxR = 4.5;
    minAngle = 45;
    maxAngle = 105;
    nozzleColor = "Türkis";
    colorHex = "#06b6d4"; // cyan-500
  } else if (baseModel === "MP1000") {
    minR = 2.5;
    maxR = 4.5;
    if (normAngle >= 315) {
      nozzleId = "MP1000-360";
      name = "MP1000 360";
      minAngle = 360;
      maxAngle = 360;
      nozzleColor = "Grün";
      colorHex = "#22c55e"; // green-500
    } else if (normAngle > 210) {
      nozzleId = "MP1000-210";
      name = "MP1000-210";
      minAngle = 210;
      maxAngle = 270;
      nozzleColor = "Braun";
      colorHex = "#78350f"; // brown
    } else {
      nozzleId = "MP1000-90";
      name = "MP1000-90";
      minAngle = 90;
      maxAngle = 210;
      nozzleColor = "Braun/Maroon";
      colorHex = "#9a3412"; // maroon / orange-red
    }
  } else if (baseModel === "MP815") {
    minR = 2.5;
    maxR = 4.9;
    if (normAngle >= 315) {
      nozzleId = "MP815-360";
      name = "MP815-360";
      minAngle = 360;
      maxAngle = 360;
      nozzleColor = "Grau";
      colorHex = "#64748b"; // slate-500
    } else if (normAngle > 210) {
      nozzleId = "MP815-210";
      name = "MP815-210";
      minAngle = 210;
      maxAngle = 270;
      nozzleColor = "Blau-Grau";
      colorHex = "#475569"; // slate-600
    } else {
      nozzleId = "MP815-90";
      name = "MP815-90";
      minAngle = 90;
      maxAngle = 210;
      nozzleColor = "Hellblau";
      colorHex = "#38bdf8"; // sky-400
    }
  } else if (baseModel === "MP2000") {
    minR = 4.0;
    maxR = 6.4;
    if (normAngle >= 315) {
      nozzleId = "MP2000-360";
      name = "MP2000 360";
      minAngle = 360;
      maxAngle = 360;
      nozzleColor = "Rot";
      colorHex = "#ef4444"; // red-500
    } else if (normAngle > 210) {
      nozzleId = "MP2000-210";
      name = "MP2000-210";
      minAngle = 210;
      maxAngle = 270;
      nozzleColor = "Grün";
      colorHex = "#16a34a"; // green-600
    } else {
      nozzleId = "MP2000-90";
      name = "MP2000 90-210";
      minAngle = 90;
      maxAngle = 210;
      nozzleColor = "Schwarz";
      colorHex = "#1e293b"; // slate-800
    }
  } else if (baseModel === "MP3000") {
    minR = 6.7;
    maxR = 9.1;
    if (normAngle >= 315) {
      nozzleId = "MP3000-360";
      name = "MP3000 360";
      minAngle = 360;
      maxAngle = 360;
      nozzleColor = "Schwarz/Rot";
      colorHex = "#581c87"; // black-red representation
    } else if (normAngle > 210) {
      nozzleId = "MP3000-210";
      name = "MP3000-210";
      minAngle = 210;
      maxAngle = 270;
      nozzleColor = "Gelb";
      colorHex = "#eab308"; // yellow-500
    } else {
      nozzleId = "MP3000-90";
      name = "MP3000-90";
      minAngle = 90;
      maxAngle = 210;
      nozzleColor = "Blau";
      colorHex = "#2563eb"; // blue-600
    }
  } else {
    // MP3500 series (from 9.4m up to 10.7m, only has 90°-210° model)
    baseModel = "MP3500";
    minR = 9.4;
    maxR = 10.7;
    nozzleId = "MP3500-90";
    name = "MP3500 90-210";
    minAngle = 90;
    maxAngle = 210;
    nozzleColor = "Hellbraun";
    colorHex = "#ca8a04"; // warm yellow/brown
  }

  let clampedMeters = Math.max(minR, Math.min(maxR, rMeters));
  let isOutOfBounds = rMeters < minR || rMeters > maxR;
  let physicalAngle = Math.max(minAngle, Math.min(maxAngle, normAngle));
  
  let labelForDevice = name;
  if (baseModel !== "MP Corner" && baseModel !== "MP-Corner" && !labelForDevice.includes("/PRS30")) {
    labelForDevice = `${labelForDevice}/PRS30`;
  }
  if (labelForDevice === "MP-Corner") {
     labelForDevice = "MP-Corner/PRS30";
  }

  // Real precip rate: 20 mm/h for MP800 & MP815, 10 mm/h for standard MP series
  const precipRate = (baseModel === 'MP800SR' || baseModel === 'MP815') ? 20 : 10;
  const area = Math.PI * clampedMeters * clampedMeters * (physicalAngle / 360);
  const flowM3H = (area * precipRate) / 1000;
  const flowLpm = (flowM3H * 1000) / 60;

  return {
    name: labelForDevice,
    radiusPx: clampedMeters * PIXELS_PER_METER,
    flowLpm: flowLpm,
    model: baseModel,
    nozzleId: nozzleId,
    minR: minR,
    maxR: maxR,
    isOutOfBounds: isOutOfBounds,
    physicalAngle: physicalAngle,
    colorName: nozzleColor,
    colorHex: colorHex
  };
}

function getRealisticNozzleLabel(sp: { r: number; angleDeg: number; selectedModel?: string }) {
  const nz = getNozzleData(sp.r, sp.angleDeg, sp.selectedModel);
  return nz.name;
}

function calculateArea(shape: Shape): number {
  if (shape.points.length < 2) return 0;
  
  if (shape.type === 'polygon' && shape.points.length > 2) {
    let area = 0;
    const pts = shape.points;
    for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += (pts[i].x * pts[j].y) - (pts[j].x * pts[i].y);
    }
    return Math.abs(area / 2) / (PIXELS_PER_METER * PIXELS_PER_METER);
  } else if (shape.type === 'rectangle' && shape.points.length === 2) {
    const w = Math.abs(shape.points[1].x - shape.points[0].x);
    const h = Math.abs(shape.points[1].y - shape.points[0].y);
    return (w * h) / (PIXELS_PER_METER * PIXELS_PER_METER);
  } else if (shape.type === 'circle' && shape.points.length === 2) {
    const r = Math.hypot(shape.points[1].x - shape.points[0].x, shape.points[1].y - shape.points[0].y);
    return (Math.PI * r * r) / (PIXELS_PER_METER * PIXELS_PER_METER);
  }
  return 0;
}

export type PlannerData = {
  zones: number;
  pePipeLengthMeters: number;
  dripTubesMeters: number;
  cableLengthMeters: number;
  cableWires: number;
  valves: number;
  valveBoxes: number;
  controllers: number;
  sprinklers: number;
  svgSnapshot?: string;
  softPePipeLengthMeters?: number;
  softPeConnections?: number;
  sprinklerDetails?: Array<{ nozzleName: string; isEndPoint: boolean }>;
  pePipeLength25Meters?: number;
  pePipeLength32Meters?: number;
  pePipeLength40Meters?: number;
  elbows25Count?: number;
  elbows32Count?: number;
  elbows40Count?: number;
  tPieces25Count?: number;
  tPieces32Count?: number;
  tPieces40Count?: number;
  connectors25Count?: number;
  connectors32Count?: number;
  connectors40Count?: number;
  rzwsCount?: number;
  pressure?: number;
  gardenArea?: number;
};

interface PlannerCanvasProps {
  onBack: () => void;
  onNext?: (data: PlannerData, rawState?: any) => void;
  initialState?: any;
  currentUser?: any;
  setCurrentUser?: (user: any) => void;
}

export default function PlannerCanvas({ onBack, onNext, initialState, currentUser, setCurrentUser }: PlannerCanvasProps) {
  const [step, setStep] = useState<PlannerStep>('start_choice');

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const [lastTouchCenter, setLastTouchCenter] = useState<Point | null>(null);

  const [tool, setTool] = useState<string>('pan');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [currentShape, setCurrentShape] = useState<Point[]>([]);
  const [hoverPos, setHoverPos] = useState<Point | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [selectedSprinklerIdx, setSelectedSprinklerIdx] = useState<number | null>(null);
  
  const [infraNodes, setInfraNodes] = useState<InfraNode[]>([]);
  const [pendingArea, setPendingArea] = useState<{type: ShapeType, points: Point[]} | null>(null);
  const [pendingInfra, setPendingInfra] = useState<Point | null>(null);
  
  const [bgImage, setBgImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const lastPointAddedTime = useRef<number>(0);
  const [showIntro, setShowIntro] = useState(false);
  const [showStats, setShowStats] = useState(true);

  // States for manual planning
  const [manualPipes, setManualPipes] = useState<any[]>([]);
  const [manualDripLines, setManualDripLines] = useState<any[]>([]);
  const [manualRzws, setManualRzws] = useState<any[]>([]);
  const [isDraggingRadius, setIsDraggingRadius] = useState<boolean>(false);
  const [isDraggingAngle, setIsDraggingAngle] = useState<boolean>(false);
  const [isDraggingAngleStart, setIsDraggingAngleStart] = useState<boolean>(false);

  // Sizing and Pressure Loss States
  const [elevationDiff, setElevationDiff] = useState<number>(0);
  const [inletPressure, setInletPressure] = useState<number>(3.5);
  const [extraBends, setExtraBends] = useState<number>(0);
  const [isSizingExpanded, setIsSizingExpanded] = useState<boolean>(true);
  const [isParamsExpanded, setIsParamsExpanded] = useState<boolean>(false);

  const [sprinklers, setSprinklers] = useState<any[]>([]);
  const [pipes, setPipes] = useState<{points: Point[], color: string, id?: string}[]>([]);

  // Restore plan effect inside PlannerCanvas
  useEffect(() => {
    if (initialState) {
      if (initialState.shapes) setShapes(initialState.shapes);
      if (initialState.sprinklers) setSprinklers(initialState.sprinklers);
      if (initialState.pipes) setPipes(initialState.pipes);
      if (initialState.infraNodes) setInfraNodes(initialState.infraNodes);
      if (initialState.manualPipes) setManualPipes(initialState.manualPipes);
      if (initialState.manualDripLines) setManualDripLines(initialState.manualDripLines);
      if (initialState.manualRzws) setManualRzws(initialState.manualRzws);
      if (initialState.bgImage) setBgImage(initialState.bgImage);
      if (initialState.elevationDiff !== undefined) setElevationDiff(initialState.elevationDiff);
      if (initialState.inletPressure !== undefined) setInletPressure(initialState.inletPressure);
      if (initialState.extraBends !== undefined) setExtraBends(initialState.extraBends);
      if (initialState.step) setStep(initialState.step);
      if (initialState.scale) setScale(initialState.scale);
      if (initialState.pan) setPan(initialState.pan);
    }
  }, [initialState]);

  const handleUpdateSprinklerModel = (modelId: string) => {
    if (selectedSprinklerIdx === null || !sprinklers[selectedSprinklerIdx]) return;
    const sp = sprinklers[selectedSprinklerIdx];
    
    // Evaluate nozzle data based on the desired model and current state
    const nz = getNozzleData(sp.r, sp.angleDeg, modelId);
    
    const physicalAngle = nz.physicalAngle;
    let isFullCircle = physicalAngle >= 359;
    let angleStart = sp.angleStart; 
    let angleEnd = isFullCircle ? Math.PI * 2 : (angleStart + (physicalAngle * Math.PI / 180));
    let largeArc = physicalAngle > 180 ? 1 : 0;

    const updated = [...sprinklers];
    updated[selectedSprinklerIdx] = {
      ...sp,
      r: nz.radiusPx,
      angleDeg: physicalAngle,
      angleEnd: angleEnd,
      largeArc: largeArc,
      label: nz.name,
      flowLpm: nz.flowLpm,
      selectedModel: modelId,
      zoneColor: nz.colorHex
    };
    setSprinklers(updated);
  };

  const handleUpdateSprinklerAngle = (newAngle: number) => {
    if (selectedSprinklerIdx === null || !sprinklers[selectedSprinklerIdx]) return;
    const sp = sprinklers[selectedSprinklerIdx];
    const nz = getNozzleData(sp.r, newAngle, sp.selectedModel);
    
    const updated = [...sprinklers];
    
    const physicalAngle = nz.physicalAngle;
    let isFullCircle = physicalAngle >= 359;
    let angleStart = sp.angleStart; 
    let angleEnd = isFullCircle ? Math.PI * 2 : (angleStart + (physicalAngle * Math.PI / 180));
    let largeArc = physicalAngle > 180 ? 1 : 0;
    
    updated[selectedSprinklerIdx] = {
      ...sp,
      angleDeg: physicalAngle,
      angleStart: angleStart,
      angleEnd: angleEnd,
      largeArc: largeArc,
      label: nz.name,
      flowLpm: nz.flowLpm,
      r: nz.radiusPx,
      selectedModel: nz.model
    };
    
    setSprinklers(updated);
  };

  const handleUpdateSprinklerRadius = (newRadiusM: number) => {
    if (selectedSprinklerIdx === null || !sprinklers[selectedSprinklerIdx]) return;
    const sp = sprinklers[selectedSprinklerIdx];
    const nz = getNozzleData(newRadiusM * PIXELS_PER_METER, sp.angleDeg, sp.selectedModel);
    
    const physicalAngle = nz.physicalAngle;
    let isFullCircle = physicalAngle >= 359;
    let angleStart = sp.angleStart; 
    let angleEnd = isFullCircle ? Math.PI * 2 : (angleStart + (physicalAngle * Math.PI / 180));
    let largeArc = physicalAngle > 180 ? 1 : 0;

    const updated = [...sprinklers];
    updated[selectedSprinklerIdx] = {
      ...sp,
      r: nz.radiusPx,
      angleDeg: physicalAngle,
      angleEnd: angleEnd,
      largeArc: largeArc,
      label: nz.name,
      flowLpm: nz.flowLpm,
      selectedModel: nz.model
    };
    setSprinklers(updated);
  };

  const getToolHelper = () => {
    switch (tool) {
      case 'pan':
        return {
          title: 'Hand-Werkzeug (Ansicht verschieben)',
          desc: 'Ziehe die Karte mit der Maus oder dem Finger, um dich zu bewegen. Nutze Mausrad oder Gesten zum Zoomen.'
        };
      case 'polygon':
        return {
          title: 'Freie Fläche zeichnen (Gartenfläche)',
          desc: 'Klicke nacheinander Eckpunkte deines Rasens oder Beets an. Klicke am Ende auf "Fläche abschließen".'
        };
      case 'rectangle':
        return {
          title: 'Viereckige Fläche aufziehen',
          desc: 'Klicke und ziehe eine gerade viereckige Rasen- oder Beetfläche auf.'
        };
      case 'circle':
        return {
          title: 'Kreisrunde Baum- oder Beetfläche aufziehen',
          desc: 'Klicke und ziehe einen exakten Kreis auf.'
        };
      case 'draw_pipe':
        return {
          title: '🔧 PE-Rohr verlegen (Wasserleitung 25mm)',
          desc: 'Klicke nacheinander auf den Plan, um die Hauptwasserleitung zu zeichnen. Klicke oben rechts auf "Rohr fertigstellen" oder mache einen Doppelklick zum Beenden.'
        };
      case 'draw_drip':
        return {
          title: '💦 Tropfrohr verlegen (Beet- & Heckenbewässerung)',
          desc: 'Klicke Punkte auf dem Plan an, um das Tropfrohr (Perlschlauch) zu verlegen. Klicke oben auf "Schlauch fertigstellen" oder Doppelklick zum Beenden.'
        };
      case 'water_source':
        return {
          title: 'Wasseranschluss platzieren',
          desc: 'Platziere deinen Wasserhahn, Brunnen oder Ventilanschluss auf dem Plan.'
        };
      case 'valve_box':
        return {
          title: 'Ventil-Verteilerbox platzieren',
          desc: 'Klicke auf den Plan, um die grüne Box für Magnetventile und Abzweige zu setzen.'
        };
      case 'controller':
        return {
          title: 'Bewässerungs-Computer platzieren',
          desc: 'Platziere deine Steuerungseinheit an einer Hauswand oder Gartenhütte.'
        };
      case 'add_sprinkler':
        return {
          title: '🚿 Regner setzen (MP Rotator)',
          desc: 'Klicke auf den Plan (vorzugsweise auf das PE-Rohr), um Regner zu platzieren. Wähle einen gesetzten Regner aus, um seinen Winkel oder Radius im rechten Menü anzupassen!'
        };
      case 'add_rzws':
        return {
          title: '🌳 Tiefenbewässerung (RZWS) platzieren',
          desc: 'Klicke auf den Plan, um Baumwurzelbelüftung (Root Zone Watering) zu platzieren.'
        };
      default:
        return null;
    }
  };

  const runCalculation = () => {
    const valveBoxes = infraNodes.filter(n => n.type === 'valve_box');
    if (valveBoxes.length === 0) {
      alert("Bitte zuerst eine Verteilerbox platzieren!");
      return;
    }
    const waterSources = infraNodes.filter(n => n.type === 'water_source');
    if (waterSources.length === 0) {
      alert("Bitte zuerst eine Wasserquelle platzieren!");
      return;
    }
    const vb = valveBoxes[0].pos;
    
    let newSprinklers: any[] = [];
    let extraPipes: {points: Point[], color: string, id: string, type: string, isSoftPe?: boolean}[] = [];
    
    shapes.filter(s => s.areaType === 'lawn' || s.areaType === 'bed').forEach(s => {
       const cx = s.points.reduce((sum, p) => sum + p.x, 0) / s.points.length;
       const cy = s.points.reduce((sum, p) => sum + p.y, 0) / s.points.length;
       
       let pts = [...s.points].map(p => ({...p}));
       if (s.type === 'rectangle' && pts.length === 2) {
           const minX = Math.min(pts[0].x, pts[1].x);
           const maxX = Math.max(pts[0].x, pts[1].x);
           const minY = Math.min(pts[0].y, pts[1].y);
           const maxY = Math.max(pts[0].y, pts[1].y);
           pts = [ {x:minX,y:minY}, {x:maxX,y:minY}, {x:maxX,y:maxY}, {x:minX,y:maxY} ];
       }

       if (s.areaType === 'lawn') {
         if (s.type === 'polygon') {
             let changed = true;
             
             // First pass: remove points that are too close to each other (less than 1.5m)
             while (changed && pts.length > 3) {
                 changed = false;
                 for (let i = 0; i < pts.length; i++) {
                     let pCurr = pts[i];
                     let pNext = pts[(i + 1) % pts.length];
                     if (Math.hypot(pNext.x - pCurr.x, pNext.y - pCurr.y) < 1.5 * PIXELS_PER_METER) {
                         pts.splice((i + 1) % pts.length, 1);
                         changed = true;
                         break;
                     }
                 }
             }

             changed = true;
             while (changed && pts.length > 3) {
                 changed = false;
                 for (let i = 0; i < pts.length; i++) {
                     let pPrev = pts[(i - 1 + pts.length) % pts.length];
                     let pCurr = pts[i];
                     let pNext = pts[(i + 1) % pts.length];
                     let aIn = Math.atan2(pCurr.y - pPrev.y, pCurr.x - pPrev.x);
                     let aOut = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);
                     let turn = (aOut - aIn) * 180 / Math.PI;
                     while (turn <= -180) turn += 360;
                     while (turn > 180) turn -= 360;
                     if (Math.abs(turn) < 25) { // remove points that make < 25 deg turn (smooth curves or straight lines)
                         pts.splice(i, 1);
                         changed = true;
                         break;
                     }
                 }
             }
         } else if (s.type === 'circle' && pts.length === 2) {
             const [center, edge] = pts;
             const rPx = Math.hypot(edge.x - center.x, edge.y - center.y);
             const nz = getNozzleData(rPx, 360);
             newSprinklers.push({
                 shapeId: s.id,
                 x: center.x, y: center.y, r: nz.radiusPx, 
                 angleStart: 0, angleEnd: 0, sweepFlag: 1, largeArc: 1, angleDeg: 360, label: nz.name,
                 flowLpm: nz.flowLpm
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
         
         // Calculate bounding box for optimal radius
         let minX = Math.min(...pts.map(p => p.x));
         let maxX = Math.max(...pts.map(p => p.x));
         let minY = Math.min(...pts.map(p => p.y));
         let maxY = Math.max(...pts.map(p => p.y));
         let bboxMin = Math.min(maxX - minX, maxY - minY);
         let targetR = Math.min(bboxMin, 10.7 * PIXELS_PER_METER);
         if (targetR < 2 * PIXELS_PER_METER) targetR = 2 * PIXELS_PER_METER;

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
             
             let largeArc = diff > Math.PI ? 1 : 0;
             let distNext = Math.hypot(pNext.x - pCurr.x, pNext.y - pCurr.y);
             
             const angleDeg = diff * 180 / Math.PI;
             // Use targetR for corner radius, but if the edge is shorter, don't overshoot too much?
             // Actually, targetR is based on bboxMin, which is safe for rectangles.
             const nz = getNozzleData(targetR, angleDeg);
             let r = nz.radiusPx;
             
             newSprinklers.push({
                shapeId: s.id,
                x: pCurr.x, 
                y: pCurr.y, 
                r: r,
                angleStart: aNext,
                angleEnd: aPrev,
                sweepFlag: sweepFlag,
                largeArc: largeArc,
                angleDeg: (diff * 180 / Math.PI),
                label: nz.name,
                flowLpm: nz.flowLpm
             });

             // Intermediate sprinklers along the edge
             // Space them so that distance between them is approx `targetR`
             if (distNext > targetR * 1.2) { 
                 const numSegments = Math.ceil(distNext / targetR);
                 const numIntermediate = numSegments - 1; 
                 if (numIntermediate > 0) {
                     const spacing = distNext / numSegments;
                     for (let j = 1; j <= numIntermediate; j++) {
                         let frac = j / numSegments;
                         let midX = pCurr.x + (pNext.x - pCurr.x) * frac;
                         let midY = pCurr.y + (pNext.y - pCurr.y) * frac;
                         
                         let lineAngle = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);
                         let midAngleStart = lineAngle;
                         let midAngleEnd = lineAngle + Math.PI;
                         if (!isClockwise) {
                             midAngleStart = lineAngle + Math.PI;
                             midAngleEnd = lineAngle;
                         }
                         const midNz = getNozzleData(spacing, 180);
                         newSprinklers.push({
                             shapeId: s.id,
                             x: midX, y: midY, r: midNz.radiusPx,
                             angleStart: midAngleStart,
                             angleEnd: midAngleEnd,
                             sweepFlag: isClockwise ? 1 : 0,
                             largeArc: 0,
                             angleDeg: 180,
                             label: midNz.name,
                             flowLpm: midNz.flowLpm
                         });
                     }
                 }
              }
         }
         
         // Inner 360 degree sprinklers for large lawns
         let width = maxX - minX;
         let height = maxY - minY;
         
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

         // If BOTH dimensions are larger than 2x the target radius, we need middle sprinklers
         if (width > 2.2 * targetR && height > 2.2 * targetR) {
             // simplified: fill a grid inside
             let cols = Math.floor(width / targetR);
             let rows = Math.floor(height / targetR);
             for(let c=1; c<cols; c++) {
                 for(let rIdx=1; rIdx<rows; rIdx++) {
                     let cx = minX + c * (width/cols);
                     let cy = minY + rIdx * (height/rows);
                     if (isInside({x: cx, y: cy})) {
                         const innerNz = getNozzleData(Math.min(width/cols, height/rows), 360);
                         newSprinklers.push({
                             shapeId: s.id,
                             x: cx, y: cy, r: innerNz.radiusPx,
                             angleStart: 0, angleEnd: 0, sweepFlag: 1, largeArc: 1, angleDeg: 360, label: innerNz.name,
                             flowLpm: innerNz.flowLpm
                         });
                     }
                 }
             }
         }
       } else if (s.areaType === 'bed') {
           const isInsideBed = (pt: Point) => {
              if (s.type === 'circle' && pts.length === 2) {
                  const [center, edge] = pts;
                  const r = Math.hypot(edge.x - center.x, edge.y - center.y);
                  return Math.hypot(pt.x - center.x, pt.y - center.y) <= r;
              }
              let inside = false;
              for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                  let xi = pts[i].x, yi = pts[i].y;
                  let xj = pts[j].x, yj = pts[j].y;
                  let intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
                  if (intersect) inside = !inside;
              }
              return inside;
           };

           let minX = 0, maxX = 0, minY = 0, maxY = 0;
           if (s.type === 'circle' && pts.length === 2) {
               const [center, edge] = pts;
               const r = Math.hypot(edge.x - center.x, edge.y - center.y);
               minX = center.x - r; maxX = center.x + r;
               minY = center.y - r; maxY = center.y + r;
           } else {
               minX = Math.min(...pts.map(p => p.x));
               maxX = Math.max(...pts.map(p => p.x));
               minY = Math.min(...pts.map(p => p.y));
               maxY = Math.max(...pts.map(p => p.y));
           }

           const spacing = 0.33 * PIXELS_PER_METER;
           let bedLines = [];
           let startPoint: Point | null = null;
           
           let dir = 1;
           for(let y = minY + spacing / 2; y <= maxY; y += spacing) {
                let rowPts = [];
                for (let x = minX; x <= maxX; x += 5) {
                    if (isInsideBed({x, y})) rowPts.push({x, y});
                }
                if (rowPts.length > 0) {
                    if (dir === -1) rowPts.reverse();
                    bedLines.push(...rowPts);
                    if (!startPoint) startPoint = rowPts[0];
                    dir *= -1;
                }
           }
           if (bedLines.length > 0 && startPoint) {
              const bedZoneColor = '#8b5cf6'; // purple for bed zones
              // Find closest point to vb to be the start point to avoid crossing entire bed
              let bestIdx = 0;
              let bestStartDist = Math.hypot(startPoint.x - vb.x, startPoint.y - vb.y);
              if (bedLines.length > 0) {
                  let endPoint = bedLines[bedLines.length - 1];
                  let endDist = Math.hypot(endPoint.x - vb.x, endPoint.y - vb.y);
                  if (endDist < bestStartDist) {
                      bedLines.reverse();
                      startPoint = endPoint;
                  }
              }

              // Route PE pipe from ValveBox to Bed Edge
              const bedPePath = findSafePath(vb, startPoint, shapes.filter(sh => sh.id !== s.id && (sh.areaType === 'lawn' || sh.areaType === 'bed')));
              extraPipes.push({ id: `bed-pe-${s.id}`, points: bedPePath, color: bedZoneColor, type: 'zone', isSoftPe: true });
              // Route Drip Tube
              extraPipes.push({ id: `bed-drip-${s.id}`, points: bedLines, color: '#f59e0b', type: 'drip' });
           }
       }
    });
    
    // Process tree shapes: rigid PE pipe to perimeter, soft PE to center for RZWS root irrigation
     shapes.filter(s => s.areaType === 'tree').forEach(s => {
        if (s.type === 'circle' && s.points.length === 2) {
           const [center, edge] = s.points;
           const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
           
           const dx = center.x - vb.x;
           const dy = center.y - vb.y;
           const totalDist = Math.hypot(dx, dy);
           const fraction = totalDist > radius ? (totalDist - radius) / totalDist : 0.8;
           const peEndPoint = {
              x: vb.x + dx * fraction,
              y: vb.y + dy * fraction
           };
           
           // 1. Rigid PE-pipe from ValveBox to peEndPoint
           const rigidPath = findSafePath(vb, peEndPoint, shapes.filter(sh => sh.id !== s.id && (sh.areaType === 'lawn' || sh.areaType === 'bed')));
           extraPipes.push({
              id: `tree-pe-rigid-${s.id}`,
              points: rigidPath,
              color: '#166534',
              type: 'zone',
              isSoftPe: false
           });

           // 2. Soft PE-pipe (Zuleitungsstück) 16mm to tree center
           extraPipes.push({
              id: `tree-pe-soft-${s.id}`,
              points: [peEndPoint, center],
              color: '#22c55e',
              type: 'zone',
              isSoftPe: true
           });
        }
     });

     // ZONING and PIPE ROUTING based on available maxFlowLpm
    const ws = infraNodes.find(n => n.type === 'water_source');
    const pressure = ws?.details?.pressure ? parseFloat(ws.details.pressure) : 3.5;
    const maxFlowLpm = (pressure / 3.5) * 28; // safe flow assumption
    
    let zones: { color: string, sprinklers: any[] }[] = [];
    const colors = ['#dc2626', '#16a34a', '#2563eb', '#9333ea', '#ea580c', '#0d9488'];

    const sprinklersByShape = new Map<string, any[]>();
    newSprinklers.forEach(sp => {
        if (!sprinklersByShape.has(sp.shapeId)) sprinklersByShape.set(sp.shapeId, []);
        sprinklersByShape.get(sp.shapeId)!.push(sp);
    });

    sprinklersByShape.forEach((shapeSprinklers, shapeId) => {
        let unassigned = [...shapeSprinklers];
        while(unassigned.length > 0) {
            let currentZone = { color: colors[zones.length % colors.length], sprinklers: [] as any[] };
            let zoneFlow = 0;
            
            // start with the one closest to valve box
            let closestIdx = 0;
            let minDist = Infinity;
            unassigned.forEach((sp, idx) => {
                let d = Math.hypot(sp.x - vb.x, sp.y - vb.y);
                if(d < minDist) { minDist = d; closestIdx = idx; }
            });
            
            let currSp = unassigned.splice(closestIdx, 1)[0];
            currentZone.sprinklers.push(currSp);
            zoneFlow += currSp.flowLpm || 0;
            currSp.zoneColor = currentZone.color;
            
            // greedily add closest sprinklers
            while(unassigned.length > 0) {
                closestIdx = -1;
                minDist = Infinity;
                unassigned.forEach((sp, idx) => {
                    let d = Math.hypot(sp.x - currSp.x, sp.y - currSp.y);
                    if (d < minDist && (zoneFlow + (sp.flowLpm || 0)) <= maxFlowLpm) {
                        minDist = d; closestIdx = idx;
                    }
                });
                
                if (closestIdx !== -1) {
                    currSp = unassigned.splice(closestIdx, 1)[0];
                    currentZone.sprinklers.push(currSp);
                    zoneFlow += currSp.flowLpm || 0;
                    currSp.zoneColor = currentZone.color;
                } else {
                    break; // zone full or no reachable sprinkler
                }
            }
            zones.push(currentZone);
        }
    });
    
    // Simple Pipe routing per zone (Nearest Neighbor from Valve Box)
    let finalPipes: {points: Point[], color: string, id: string, type: 'main' | 'zone'}[] = [];
    
    if (ws && vb) {
        const mainPath = findSafePath(ws.pos, vb, shapes.filter(s => s.areaType === 'lawn' || s.areaType === 'bed'));
        finalPipes.push({ id: 'main-pipe', points: mainPath, color: '#64748b', type: 'main' });
    }

    zones.forEach((z, zIdx) => {
        let remaining = [...z.sprinklers];
        let path = [vb];
        let curr = vb;
        
        while(remaining.length > 0) {
            let closestIdx = -1;
            let minDist = Infinity;
            remaining.forEach((sp, idx) => {
                let d = Math.hypot(sp.x - curr.x, sp.y - curr.y);
                if(d < minDist) { minDist = d; closestIdx = idx; }
            });
            let nextSp = remaining.splice(closestIdx, 1)[0];
            const nextPt = {x: nextSp.x, y: nextSp.y};
            const subPath = findSafePath(curr, nextPt, shapes.filter(s => s.id !== nextSp.shapeId && (s.areaType === 'lawn' || s.areaType === 'bed')));
            for (let i = 1; i < subPath.length; i++) {
                path.push(subPath[i]);
            }
            curr = nextPt;
        }
        finalPipes.push({ id: `zone-${zIdx}`, points: path, color: z.color, type: 'zone' });
    });
    
    extraPipes.forEach(ep => {
        finalPipes.push(ep as any);
    });

    const sprinklerZonesCount = zones.length;
    const bedZonesCount = shapes.filter(s => s.areaType === 'bed').length;
    const treeZonesCount = shapes.filter(s => s.areaType === 'tree').length;
    const totalZones = sprinklerZonesCount + bedZonesCount + treeZonesCount;
    const controller = infraNodes.find(n => n.type === 'controller');
    if (controller && vb) {
        let requiredWires = totalZones + 1;
        let availableCables = [3, 5, 7, 9, 13];
        let chosenCable = availableCables.find(c => c >= requiredWires) || Math.max(...availableCables, requiredWires);
        
        finalPipes.push({ 
             id: 'control-cable', 
             points: [controller.pos, vb], 
             color: '#eab308', // yellow for cable
             type: 'cable',
             wires: chosenCable
        } as any);
    }
    
    setSprinklers(newSprinklers);
    setPipes(finalPipes);
    setShowStats(true);
    setTool('select');
    setStep('calculation');
  };

  const runManualCalculation = () => {
    let sources = infraNodes.filter(n => n.type === 'water_source');
    let valveBoxes = infraNodes.filter(n => n.type === 'valve_box');
    let controllers = infraNodes.filter(n => n.type === 'controller');

    if (sources.length === 0) {
      alert("Bitte platziere zuerst einen Wasseranschluss auf der Zeichnung!");
      setTool('water_source');
      return;
    }
    if (valveBoxes.length === 0) {
      alert("Bitte platziere zuerst eine Verteilerbox (Zonenventile) auf der Zeichnung!");
      setTool('valve_box');
      return;
    }
    if (controllers.length === 0) {
      alert("Bitte platziere zuerst ein Steuergerät (Computer) auf der Zeichnung!");
      setTool('controller');
      return;
    }

    const finalPipes: any[] = [];

    // Map manual pipes
    manualPipes.forEach((p, idx) => {
      finalPipes.push({
        points: p.points,
        color: '#0284c7',
        id: p.id,
        type: 'zone'
      });
    });

    // Map manual drip lines
    manualDripLines.forEach((p, idx) => {
      finalPipes.push({
        points: p.points,
        color: '#d97706',
        id: p.id,
        type: 'drip'
      });
    });

    // Route manual sprinklers to closest manually placed pipeline or direct to valve box
    if (manualPipes.length === 0) {
      const vBox = valveBoxes[0] || sources[0];
      sprinklers.forEach((sp, idx) => {
        finalPipes.push({
          points: [vBox.pos, { x: sp.x, y: sp.y }],
          color: '#2563eb',
          id: `pipe-sp-${idx}`,
          type: 'zone'
        });
      });
    }

    // Connect controller to valve box
    if (controllers[0] && valveBoxes[0]) {
      finalPipes.push({
        id: 'control-cable',
        points: [controllers[0].pos, valveBoxes[0].pos],
        color: '#eab308',
        type: 'cable',
        wires: Math.max(2, sprinklers.length + 1)
      });
    }

    setPipes(finalPipes);
    setShowStats(true);
    setTool('pan');
    setStep('calculation');
  };

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
       let targetR = Math.min(bboxMin, 10.7 * PIXELS_PER_METER);
       if (targetR < 2 * PIXELS_PER_METER) targetR = 2 * PIXELS_PER_METER;

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
           
           let largeArc = diff > Math.PI ? 1 : 0;
           let distNext = Math.hypot(pNext.x - pCurr.x, pNext.y - pCurr.y);
           
           const angleDeg = diff * 180 / Math.PI;
           const nz = getNozzleData(targetR, angleDeg);
           let r = nz.radiusPx;
           
           newSprinklers.push({
              shapeId: s.id,
              id: 'sp-auto-' + s.id + '-' + i + '-' + Date.now(),
              x: pCurr.x, 
              y: pCurr.y, 
              r: r,
              angleStart: aNext,
              angleEnd: aPrev,
              sweepFlag: sweepFlag,
              largeArc: largeArc,
              angleDeg: (diff * 180 / Math.PI),
              label: nz.name,
              flowLpm: nz.flowLpm,
              isManual: true,
              zoneColor: nz.colorHex
           });

           if (distNext > targetR * 1.2) { 
               const numSegments = Math.ceil(distNext / targetR);
               const numIntermediate = numSegments - 1; 
               if (numIntermediate > 0) {
                   const spacing = distNext / numSegments;
                   for (let j = 1; j <= numIntermediate; j++) {
                       let frac = j / numSegments;
                       let midX = pCurr.x + (pNext.x - pCurr.x) * frac;
                       let midY = pCurr.y + (pNext.y - pCurr.y) * frac;
                       
                       let lineAngle = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);
                       let midAngleStart = lineAngle;
                       let midAngleEnd = lineAngle + Math.PI;
                       if (!isClockwise) {
                           midAngleStart = lineAngle + Math.PI;
                           midAngleEnd = lineAngle;
                       }
                       const midNz = getNozzleData(spacing, 180);
                       newSprinklers.push({
                           shapeId: s.id,
                           id: 'sp-auto-mid-' + s.id + '-' + i + '-' + j + '-' + Date.now(),
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
                   }
               }
            }
       }
    });

    setSprinklers(newSprinklers);
    alert("Die Regner wurden erfolgreich automatisch geplant! Du kannst jetzt jeden einzelnen Regner anklicken und seinen Winkel und Radius direkt am Kreis verschieben.");
  };

  // Dynamic Sizing & Pressure Loss Calculation Logic
  const calculateAnalysis = () => {
    const ws = infraNodes.find(n => n.type === 'water_source');
    const vbNode = infraNodes.find(n => n.type === 'valve_box');
    const vb = vbNode ? vbNode.pos : { x: 0, y: 0 };

    // Group sprinklers by zone color
    const zonesMap = new Map<string, any[]>();
    sprinklers.forEach(sp => {
       const color = sp.zoneColor || 'default';
       if (!zonesMap.has(color)) zonesMap.set(color, []);
       zonesMap.get(color)!.push(sp);
    });

    const zoneDetailsList: any[] = [];
    let maxZoneFlow = 0;

    // First find the flow rates and sizes for all zone pipes
    zonesMap.forEach((zoneSps, color) => {
       const zoneSprinklersCount = zoneSps.length;
       const zoneFlowLpm = zoneSps.reduce((sum, sp) => sum + (sp.flowLpm || 0), 0);
       if (zoneFlowLpm > maxZoneFlow) {
          maxZoneFlow = zoneFlowLpm;
       }

       // Find the zone pipe line length inside `pipes`
       const zonePipe = pipes.find(p => p.color === color && (p as any).type === 'zone');
       let lengthPixels = 0;
       if (zonePipe && zonePipe.points) {
          for(let i = 1; i < zonePipe.points.length; i++) {
             lengthPixels += Math.hypot(zonePipe.points[i].x - zonePipe.points[i-1].x, zonePipe.points[i].y - zonePipe.points[i-1].y);
          }
       }
       const L = lengthPixels / PIXELS_PER_METER;

       // Fittings for sprinklers along the pipe
       const tPieces = Math.max(0, zoneSprinklersCount - 1);
       const elbows = zoneSprinklersCount > 0 ? 1 : 0;
       const fittingLossMeters = (elbows * 1.0) + (tPieces * 2.0);
       const effectiveLength = L + fittingLossMeters;

       // Sizing logic
       let size: 25 | 32 | 40 = 25;
       if (zoneFlowLpm > 25 || effectiveLength > 40) {
          size = 32;
       }
       if (zoneFlowLpm > 45 || effectiveLength > 70) {
          size = 40;
       }

       // Loss coefficient
       let lossCoeff = 0.003;
       if (size === 25) {
          if (zoneFlowLpm <= 25) lossCoeff = 0.003;
          else if (zoneFlowLpm <= 35) lossCoeff = 0.008;
          else lossCoeff = 0.02;
       } else if (size === 32) {
          if (zoneFlowLpm <= 45) lossCoeff = 0.0015;
          else if (zoneFlowLpm <= 60) lossCoeff = 0.004;
          else lossCoeff = 0.01;
       } else {
          if (zoneFlowLpm <= 70) lossCoeff = 0.0008;
          else lossCoeff = 0.003;
       }

       const loss = effectiveLength * lossCoeff;

       zoneDetailsList.push({
          color,
          length: L,
          effectiveLength,
          flow: zoneFlowLpm,
          size,
          loss,
          tPieces,
          elbows,
          sprinklersCount: zoneSprinklersCount
       });
    });

    // Main line analysis (Quelle -> Box)
    const mainPipe = pipes.find(p => (p as any).type === 'main');
    let mainLen = 0;
    if (mainPipe && mainPipe.points) {
       for(let i=1; i<mainPipe.points.length; i++) {
          mainLen += Math.hypot(mainPipe.points[i].x - mainPipe.points[i-1].x, mainPipe.points[i].y - mainPipe.points[i-1].y);
       }
    }
    const L_main = mainLen / PIXELS_PER_METER;
    const elbows_main = 2 + extraBends;
    const fittingLossMeters_main = elbows_main * 1.0;
    const effectiveLength_main = L_main + fittingLossMeters_main;

    // Sizing logic for mainline
    let size_main: 25 | 32 | 40 = 25;
    if (maxZoneFlow > 25 || effectiveLength_main > 40) {
       size_main = 32;
    }
    if (maxZoneFlow > 45 || effectiveLength_main > 70) {
       size_main = 40;
    }

    let lossCoeff_main = 0.003;
    if (size_main === 25) {
       if (maxZoneFlow <= 25) lossCoeff_main = 0.003;
       else if (maxZoneFlow <= 35) lossCoeff_main = 0.008;
       else lossCoeff_main = 0.02;
    } else if (size_main === 32) {
       if (maxZoneFlow <= 45) lossCoeff_main = 0.0015;
       else if (maxZoneFlow <= 60) lossCoeff_main = 0.004;
       else lossCoeff_main = 0.01;
    } else {
       if (maxZoneFlow <= 70) lossCoeff_main = 0.0008;
       else lossCoeff_main = 0.003;
    }

    const loss_main = effectiveLength_main * lossCoeff_main;

    // Loss constants or custom settings
    const wl = 0.3; // wasseruhrverlust (bar)
    const fl = 0.1; // filterverlust (bar)
    const mvl = 0.15; // magnetventilverlust (bar)
    const elevationLoss = elevationDiff * 0.1;

    // Warnings and suggestions
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Calculate pressures and warnings per zone
    zoneDetailsList.forEach((z, idx) => {
       const totalLoss = wl + fl + mvl + loss_main + z.loss + elevationLoss;
       const estimatedNozzlePressure = Math.max(0, inletPressure - totalLoss);
       z.pressure = estimatedNozzlePressure;

       if (estimatedNozzlePressure < 2.5) {
          warnings.push(`Zu wenig Druck in Zone ${idx + 1}: ${estimatedNozzlePressure.toFixed(2)} Bar (min. 2.5 Bar benötigt, 2.8 Bar optimal)`);
       }

       if (z.size === 25 && z.flow > 35) {
          warnings.push(`Rohrdimension der Zone ${idx + 1} ist kritisch überlastet für Systemdurchfluss! (${z.flow.toFixed(1)} l/min auf 25mm Rohr)`);
       } else if (z.size === 25 && z.flow > 25) {
          recommendations.push(`Zone ${idx + 1} Durchfluss hoch: Eine 32mm Leitung verringert Verluste.`);
       }
    });

    if (size_main === 25 && maxZoneFlow > 35) {
       warnings.push(`Hauptleitung ist extrem unterdimensioniert mit 25mm bei ${maxZoneFlow.toFixed(1)} l/min!`);
    } else if (size_main === 25 && (L_main > 40 || maxZoneFlow > 25)) {
       recommendations.push(`Empfehlung: Hauptleitung (Quelle → Ventilbox) auf 32mm vergrößern für besseres Druckbudget.`);
    }

    // Best practices suggestions based on project size
    const totalSprinklers = sprinklers.length;
    const totalHardPeLength = L_main + zoneDetailsList.reduce((sum, z) => sum + z.length, 0);
    if (totalHardPeLength > 40 && totalSprinklers > 6) {
       recommendations.push(`Profi-Tipp: Hauptanschluss → Verteilerbox mit 32 mm, Verteilerbox → Kreise mit 25 mm legen.`);
    }

    return {
       mainPipe: {
          length: L_main,
          effectiveLength: effectiveLength_main,
          size: size_main,
          loss: loss_main,
          elbows: elbows_main
       },
       zones: zoneDetailsList,
       maxZoneFlow,
       wl,
       fl,
       mvl,
       elevationLoss,
       warnings,
       recommendations,
       totalHardPeLength
    };
  };

  const handleProceedToBom = () => {
    if (!onNext) return;
    
    // 1. Calculate pipe size and material totals
    const result = calculateAnalysis();

    let peLen = 0;
    let softPeLen = 0;
    
    // Fallback support for any raw listing count
    pipes.filter((p: any) => p.type === 'zone' || p.type === 'main').forEach(pipe => {
      let len = 0;
      if (pipe.points) {
        for(let i=1; i<pipe.points.length; i++) {
           len += Math.hypot(pipe.points[i].x-pipe.points[i-1].x, pipe.points[i].y-pipe.points[i-1].y);
        }
      }
      if ((pipe as any).isSoftPe) {
         softPeLen += len;
      } else {
         peLen += len;
      }
    });

    // Categorized sizer-specific rigid pipe lengths (meters)
    let pePipeLength25Meters = 0;
    let pePipeLength32Meters = 0;
    let pePipeLength40Meters = 0;

    if (result.mainPipe.size === 25) pePipeLength25Meters += result.mainPipe.length;
    else if (result.mainPipe.size === 32) pePipeLength32Meters += result.mainPipe.length;
    else if (result.mainPipe.size === 40) pePipeLength40Meters += result.mainPipe.length;

    result.zones.forEach((z: any) => {
       if (z.size === 25) pePipeLength25Meters += z.length;
       else if (z.size === 32) pePipeLength32Meters += z.length;
       else if (z.size === 40) pePipeLength40Meters += z.length;
    });

    // Sized fittings counts
    let elbows25Count = 0;
    let elbows32Count = 0;
    let elbows40Count = 0;
    let tPieces25Count = 0;
    let tPieces32Count = 0;
    let tPieces40Count = 0;

    // Mainline elbows
    if (result.mainPipe.size === 25) elbows25Count += result.mainPipe.elbows;
    else if (result.mainPipe.size === 32) elbows32Count += result.mainPipe.elbows;
    else if (result.mainPipe.size === 40) elbows40Count += result.mainPipe.elbows;

    // Zone fittings
    result.zones.forEach((z: any) => {
       if (z.size === 25) {
          elbows25Count += z.elbows;
          tPieces25Count += z.tPieces;
       } else if (z.size === 32) {
          elbows32Count += z.elbows;
          tPieces32Count += z.tPieces;
       } else if (z.size === 40) {
          elbows40Count += z.elbows;
          tPieces40Count += z.tPieces;
       }
    });

    // Transition connectors counts
    let connectors25Count = 0;
    let connectors32Count = 0;
    let connectors40Count = 0;

    // For any bed zones with soft-pe lines, count them as transition connectors of corresponding zone size
    const softPeConnsTotal = pipes.filter(p => (p as any).isSoftPe).length;
    connectors25Count += softPeConnsTotal; // standard drip adapters are 25x16

    let dLen = 0;
    pipes.filter(p => (p as any).type === 'drip').forEach(pipe => {
      if (pipe.points) {
        for(let i=1; i<pipe.points.length; i++) {
           dLen += Math.hypot(pipe.points[i].x-pipe.points[i-1].x, pipe.points[i].y-pipe.points[i-1].y);
        }
      }
    });

    let cLen = 0;
    const cable = pipes.find((p: any) => p.type === 'cable') as any;
    if (cable && cable.points) {
       for(let i=1; i<cable.points.length; i++) {
           cLen += Math.hypot(cable.points[i].x-cable.points[i-1].x, cable.points[i].y-cable.points[i-1].y);
       }
    }

    // Determine sprinkler details: endpoint vs middle
    const vbNode = infraNodes.find(n => n.type === 'valve_box');
    const vb = vbNode ? vbNode.pos : { x: 0, y: 0 };
    
    const zonesMap = new Map<string, any[]>();
    sprinklers.forEach(sp => {
       const color = sp.zoneColor || 'default';
       if (!zonesMap.has(color)) zonesMap.set(color, []);
       zonesMap.get(color)!.push(sp);
    });

    const sprinklerDetailsList: Array<{ nozzleName: string, isEndPoint: boolean }> = [];

    zonesMap.forEach((zoneSps, color) => {
       let remaining = [...zoneSps];
       let curr = vb;
       let ordered: any[] = [];
       
       while(remaining.length > 0) {
          let closestIdx = -1;
          let minDist = Infinity;
          remaining.forEach((sp, idx) => {
             let d = Math.hypot(sp.x - curr.x, sp.y - curr.y);
             if (d < minDist) { minDist = d; closestIdx = idx; }
          });
          if (closestIdx !== -1) {
             const nextSp = remaining.splice(closestIdx, 1)[0];
             ordered.push(nextSp);
             curr = { x: nextSp.x, y: nextSp.y };
          } else {
             break;
          }
       }

       ordered.forEach((sp, idx) => {
          sprinklerDetailsList.push({
             nozzleName: sp.label || 'MP Rotator',
             isEndPoint: idx === ordered.length - 1
          });
       });
    });

    onNext({
       zones: zonesMap.size + shapes.filter(s => s.areaType === 'bed').length + shapes.filter(s => s.areaType === 'tree').length,
       pePipeLengthMeters: peLen / PIXELS_PER_METER,
       softPePipeLengthMeters: softPeLen / PIXELS_PER_METER,
       softPeConnections: softPeConnsTotal,
       dripTubesMeters: dLen / PIXELS_PER_METER,
       cableLengthMeters: cLen / PIXELS_PER_METER,
       cableWires: cable ? cable.wires : 0,
       pressure: (infraNodes.find(n => n.type === 'water_source')?.details?.pressure ? parseFloat(infraNodes.find(n => n.type === 'water_source')!.details!.pressure) : 3.5),
       gardenArea: shapes.reduce((acc, s) => acc + calculateArea(s), 0),
       valves: zonesMap.size + shapes.filter(s => s.areaType === 'bed').length + shapes.filter(s => s.areaType === 'tree').length,
       valveBoxes: infraNodes.filter(n => n.type === 'valve_box').length,
       controllers: infraNodes.filter(n => n.type === 'controller').length,
       sprinklers: sprinklers.length,
       sprinklerDetails: sprinklerDetailsList,
       pePipeLength25Meters,
       pePipeLength32Meters,
       pePipeLength40Meters,
       elbows25Count,
       elbows32Count,
       elbows40Count,
       tPieces25Count,
       tPieces32Count,
       tPieces40Count,
       connectors25Count,
       connectors32Count,
       connectors40Count,
       rzwsCount: shapes.filter(s => s.areaType === 'tree').length + manualRzws.length,
       svgSnapshot: (() => {
          if (!svgRef.current) return undefined;
          const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
          
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          const checkPoint = (x: number, y: number) => {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
          };
          
          shapes.forEach(s => s.points.forEach(p => checkPoint(p.x, p.y)));
          infraNodes.forEach(n => checkPoint(n.pos.x, n.pos.y));
          pipes.forEach(p => p.points?.forEach(pt => checkPoint(pt.x, pt.y)));
          sprinklers.forEach(sp => {
              checkPoint(sp.x - sp.r, sp.y - sp.r);
              checkPoint(sp.x + sp.r, sp.y + sp.r);
          });
          
          if (minX !== Infinity) {
              const padX = Math.max((maxX - minX) * 0.25, 100);
              const padY = Math.max((maxY - minY) * 0.25, 100);
              const w = (maxX - minX) + padX*2;
              const h = (maxY - minY) + padY*2;
              clone.setAttribute('viewBox', `${minX - padX} ${minY - padY} ${w} ${h}`);
              
              const drawingLayer = clone.querySelector('#drawing-layer');
              if (drawingLayer) {
                  drawingLayer.removeAttribute('transform');
              }
              
              const rects = clone.querySelectorAll('rect[fill^="url(#grid"]');
              rects.forEach(r => (r as HTMLElement).style.display = 'none');
          }
          return clone.outerHTML;
       })()
    }, {
       shapes,
       sprinklers,
       pipes,
       infraNodes,
       manualPipes,
       manualDripLines,
       manualRzws,
       bgImage,
       elevationDiff,
       inletPressure,
       extraBends,
       step,
       scale,
       pan
    });
  };

  // Calculate mouse position relative to SVG coordinates
  const getMouseCoords = (clientX: number, clientY: number): Point | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - pan.x) / scale;
    const y = (clientY - rect.top - pan.y) / scale;
    return { x, y };
  };

  // Live drag handler for radius and angle sliders directly on the sprinkler itself
  useEffect(() => {
    if (!isDraggingRadius && !isDraggingAngle && !isDraggingAngleStart) return;

    const panX = pan.x;
    const panY = pan.y;

    const handleGlobalMove = (e: PointerEvent) => {
      if (selectedSprinklerIdx === null) return;
      
      const coords = getMouseCoords(e.clientX, e.clientY);
      if (!coords) return;

      if (isDraggingRadius) {
        setSprinklers(prev => {
          const sp = prev[selectedSprinklerIdx];
          if (!sp) return prev;
          const dist = Math.hypot(coords.x - sp.x, coords.y - sp.y);
          const meters = dist / PIXELS_PER_METER;
          // Constrain physical spray bounds: min 1.1m (MP800SR) to max 11.0m (MP3500 max range or custom)
          const clampedMeters = Math.max(1.1, Math.min(11.0, meters));
          const nz = getNozzleData(clampedMeters * PIXELS_PER_METER, sp.angleDeg, sp.selectedModel || 'auto');
          
          const physicalAngle = nz.physicalAngle;
          let isFullCircle = physicalAngle >= 359;
          let angleEnd = isFullCircle ? Math.PI * 2 : (sp.angleStart + (physicalAngle * Math.PI / 180));
          let largeArc = physicalAngle > 180 ? 1 : 0;

          const updated = [...prev];
          updated[selectedSprinklerIdx] = {
            ...sp,
            r: nz.radiusPx,
            angleDeg: physicalAngle,
            angleEnd: angleEnd,
            largeArc: largeArc,
            label: nz.name,
            flowLpm: nz.flowLpm,
            selectedModel: sp.selectedModel || 'auto',
            zoneColor: nz.colorHex
          };
          return updated;
        });
      } else if (isDraggingAngle) {
        setSprinklers(prev => {
          const sp = prev[selectedSprinklerIdx];
          if (!sp) return prev;
          let pointerAngle = Math.atan2(coords.y - sp.y, coords.x - sp.x);
          let diffRad = pointerAngle - sp.angleStart;
          while (diffRad < 0) diffRad += Math.PI * 2;
          let newAngleDeg = Math.round(diffRad * 180 / Math.PI);
          if (newAngleDeg > 355) newAngleDeg = 360;
          
          // Determine the min allowed angle for the current radius and nozzle selection
          const testNz = getNozzleData(sp.r, 45, sp.selectedModel || 'auto');
          const minAngleAllowed = (testNz.model === 'MP Corner' || testNz.model === 'MP-Corner') ? 45 : 90;
          
          newAngleDeg = Math.max(minAngleAllowed, Math.min(360, newAngleDeg));
          
          const nz = getNozzleData(sp.r, newAngleDeg, sp.selectedModel || 'auto');
          const physicalAngle = nz.physicalAngle;
          
          let isFullCircle = physicalAngle >= 359;
          let angleEnd = isFullCircle ? Math.PI * 2 : (sp.angleStart + (physicalAngle * Math.PI / 180));
          let largeArc = physicalAngle > 180 ? 1 : 0;
          
          const updated = [...prev];
          updated[selectedSprinklerIdx] = {
            ...sp,
            angleDeg: physicalAngle,
            angleEnd: angleEnd,
            largeArc: largeArc,
            label: nz.name,
            flowLpm: nz.flowLpm,
            r: nz.radiusPx,
            selectedModel: sp.selectedModel || 'auto',
            zoneColor: nz.colorHex
          };
          return updated;
        });
      } else if (isDraggingAngleStart) {
        setSprinklers(prev => {
          const sp = prev[selectedSprinklerIdx];
          if (!sp) return prev;
          let pointerAngle = Math.atan2(coords.y - sp.y, coords.x - sp.x);
          let diffRad = sp.angleEnd - pointerAngle;
          while (diffRad < 0) diffRad += Math.PI * 2;
          let newAngleDeg = Math.round(diffRad * 180 / Math.PI);
          if (newAngleDeg > 355) newAngleDeg = 360;
          
          // Determine the min allowed angle for the current radius and nozzle selection
          const testNz = getNozzleData(sp.r, 45, sp.selectedModel || 'auto');
          const minAngleAllowed = (testNz.model === 'MP Corner' || testNz.model === 'MP-Corner') ? 45 : 90;
          
          newAngleDeg = Math.max(minAngleAllowed, Math.min(360, newAngleDeg));
          
          const nz = getNozzleData(sp.r, newAngleDeg, sp.selectedModel || 'auto');
          const physicalAngle = nz.physicalAngle;
          
          let isFullCircle = physicalAngle >= 359;
          let newAngleStart = isFullCircle ? 0 : (sp.angleEnd - (physicalAngle * Math.PI / 180));
          while (newAngleStart < 0) newAngleStart += Math.PI * 2;
          while (newAngleStart >= Math.PI * 2) newAngleStart -= Math.PI * 2;
          
          let angleEnd = isFullCircle ? Math.PI * 2 : sp.angleEnd;
          let largeArc = physicalAngle > 180 ? 1 : 0;
          
          const updated = [...prev];
          updated[selectedSprinklerIdx] = {
            ...sp,
            angleStart: newAngleStart,
            angleDeg: physicalAngle,
            angleEnd: angleEnd,
            largeArc: largeArc,
            label: nz.name,
            flowLpm: nz.flowLpm,
            r: nz.radiusPx,
            selectedModel: sp.selectedModel || 'auto',
            zoneColor: nz.colorHex
          };
          return updated;
        });
      }
    };

    const handleGlobalUp = () => {
      setIsDraggingRadius(false);
      setIsDraggingAngle(false);
      setIsDraggingAngleStart(false);
    };

    window.addEventListener('pointermove', handleGlobalMove, { passive: true });
    window.addEventListener('pointerup', handleGlobalUp, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
    };
  }, [isDraggingRadius, isDraggingAngle, isDraggingAngleStart, selectedSprinklerIdx, scale, pan.x, pan.y]);

  // Mobile zooming/panning tracking
  const activePointers = useRef<Map<number, React.PointerEvent>>(new Map());
  const touchState = useRef({ isZooming: false, isPanning: false, moved: false, lastDist: 0, startPos: { x: 0, y: 0 }, startPan: { x: 0, y: 0 } });

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    activePointers.current.set(e.pointerId, e);
    
    // Clear selection if clicking on the background
    setSelectedSprinklerIdx(null);
    if (tool === 'select') {
      setSelectedShapeId(null);
    }
    
    // Middle mouse button or Space+Click or Pan tool
    if (e.button === 1 || tool === 'pan' || activePointers.current.size > 1) {
      if (!touchState.current.isPanning) {
        touchState.current.isPanning = true;
        setIsPanning(true);
        touchState.current.startPan = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        setStartPan(touchState.current.startPan);
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }

    touchState.current.moved = false;
    touchState.current.startPos = { x: e.clientX, y: e.clientY };

    const coords = getMouseCoords(e.clientX, e.clientY);
    if (!coords) return;

    if (tool === 'rectangle' || tool === 'circle') {
      setCurrentShape([coords, coords]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if ((isDraggingRadius || isDraggingAngle || isDraggingAngleStart) && selectedSprinklerIdx !== null) {
      return;
    }

    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, e);
    }

    if (activePointers.current.size > 1) {
      touchState.current.isZooming = true;
      touchState.current.isPanning = true;
      setIsPanning(true); 
      return;
    }

    const distMoved = Math.hypot(e.clientX - touchState.current.startPos.x, e.clientY - touchState.current.startPos.y);
    if (distMoved > 10) {
      touchState.current.moved = true;
      
      // Auto-start panning if dragging on a touch screen
      if (!touchState.current.isPanning && (e.pointerType === 'touch' || e.pointerType === 'pen')) {
         if (tool === 'polygon' || tool === 'water_source' || tool === 'controller' || tool === 'valve_box' || tool === 'select') {
             touchState.current.isPanning = true;
             touchState.current.startPan = { x: e.clientX - pan.x, y: e.clientY - pan.y };
             setIsPanning(true);
             setStartPan(touchState.current.startPan);
         }
      }
    }

    if (touchState.current.isPanning) {
      if (activePointers.current.size <= 1) {
        // use setPan with callback to avoid stale pan if needed, but absolute computation is fine:
        setPan({ x: e.clientX - touchState.current.startPan.x, y: e.clientY - touchState.current.startPan.y });
      }
      return;
    }

    const coords = getMouseCoords(e.clientX, e.clientY);
    if (!coords) return;
    setHoverPos(coords);

    if (currentShape.length > 0) {
      if (tool === 'rectangle' || tool === 'circle') {
        setCurrentShape([currentShape[0], coords]);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    activePointers.current.delete(e.pointerId);

    if (activePointers.current.size === 1) {
       // Transition from pinch zoom to pan: need to update startPan for the remaining pointer
       const remainingId = Array.from(activePointers.current.keys())[0];
       const remainingEvent = activePointers.current.get(remainingId);
       if (remainingEvent && (touchState.current.isPanning || touchState.current.isZooming)) {
           touchState.current.startPan = { x: remainingEvent.clientX - pan.x, y: remainingEvent.clientY - pan.y };
           setStartPan(touchState.current.startPan);
       }
    }

    if (activePointers.current.size === 0) {
      const wasZooming = touchState.current.isZooming;
      const wasPanning = touchState.current.isPanning;
      touchState.current.isZooming = false;
      touchState.current.isPanning = false;
      
      if (isDraggingRadius || isDraggingAngle || isDraggingAngleStart) {
        setIsDraggingRadius(false);
        setIsDraggingAngle(false);
        setIsDraggingAngleStart(false);
        return;
      }

      if (isPanning || wasPanning || wasZooming) {
        setIsPanning(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
        return;
      }
      
      // Only process click/drawing actions on a genuine pointerup event
      if (e.type !== 'pointerup') {
        return;
      }
      
      const coords = getMouseCoords(e.clientX, e.clientY);
      if (!coords) return;

      if (tool === 'polygon' && !touchState.current.moved) {
        // Prevent registering a point if clicked/tapped too quickly (duplicate pointer/touch browser event prevention)
        const now = Date.now();
        if (now - lastPointAddedTime.current < 250) {
          return;
        }

        // Prevent duplicate adjacent points (double click bug)
        if (currentShape.length > 0) {
          const lastPt = currentShape[currentShape.length - 1];
          const distToLast = Math.hypot(coords.x - lastPt.x, coords.y - lastPt.y);
          if (distToLast < 20 / scale) {
            return; // skip duplicate point
          }
        }

        lastPointAddedTime.current = now;

        if (currentShape.length > 2) {
          const firstPt = currentShape[0];
          const dist = Math.hypot(coords.x - firstPt.x, coords.y - firstPt.y);
          if (dist < 40 / scale) {
             setPendingArea({ type: 'polygon', points: currentShape });
             setCurrentShape([]);
             return;
          }
        }
        // Only add point if we didn't drag/pan
        setCurrentShape([...currentShape, coords]);
      } else if ((tool === 'draw_pipe' || tool === 'draw_drip') && !touchState.current.moved) {
        const now = Date.now();
        if (now - lastPointAddedTime.current < 250) {
          return;
        }

        // Prevent duplicate adjacent points (double click bug)
        if (currentShape.length > 0) {
          const lastPt = currentShape[currentShape.length - 1];
          const distToLast = Math.hypot(coords.x - lastPt.x, coords.y - lastPt.y);
          if (distToLast < 20 / scale) {
            return; // skip duplicate point
          }
        }

        lastPointAddedTime.current = now;
        setCurrentShape([...currentShape, coords]);
      } else if (tool === 'add_sprinkler' && !touchState.current.moved) {
        const nz = getNozzleData(4.6 * PIXELS_PER_METER, 90);
        const newSp = {
          id: 'sp-' + Date.now().toString(),
          x: coords.x,
          y: coords.y,
          r: nz.radiusPx,
          angleStart: 0,
          angleEnd: Math.PI / 2,
          sweepFlag: 1,
          largeArc: 0,
          angleDeg: 90,
          label: nz.name,
          flowLpm: nz.flowLpm,
          zoneColor: nz.colorHex,
          isManual: true
        };
        const newSprinklersList = [...sprinklers, newSp];
        setSprinklers(newSprinklersList);
        setSelectedSprinklerIdx(newSprinklersList.length - 1);
        setTool('pan');
      } else if (tool === 'add_rzws' && !touchState.current.moved) {
        setManualRzws([...manualRzws, { id: 'rzws-' + Date.now(), pos: coords }]);
        setTool('pan');
      } else if (tool === 'rectangle' || tool === 'circle') {
        if (currentShape.length === 2 && touchState.current.moved) {
          setPendingArea({ type: tool, points: currentShape });
        }
        setCurrentShape([]);
      } else if (['water_source', 'controller', 'valve_box'].includes(tool)) {
        if (!touchState.current.moved) {
           if (tool === 'water_source') {
              setPendingInfra(coords);
           } else {
              setInfraNodes([...infraNodes, { id: Date.now().toString(), type: tool as InfraType, pos: coords }]);
              setTool('pan');
           }
        }
      }
    }
  };

  // Close polygon on double click or pressing Enter/button
  const completePolygon = () => {
    if (currentShape.length > 2) {
      setPendingArea({ type: 'polygon', points: currentShape });
    }
    setCurrentShape([]);
  };

  const handleWheel = (e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!svgRef.current) return;

    // Zooming
    const zoomDir = e.deltaY < 0 ? 1 : -1;
    const zoomFactor = 1.1;
    const newScale = zoomDir > 0 ? scale * zoomFactor : scale / zoomFactor;
    const clampedScale = Math.max(0.1, Math.min(newScale, 10));
    
    // Zoom around mouse pointer
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const s = clampedScale / scale;
    setPan({
      x: mouseX - (mouseX - pan.x) * s,
      y: mouseY - (mouseY - pan.y) * s
    });
    setScale(clampedScale);
  };

  // Touch zooming (pinch)
  const handleTouchStart = (e: TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setLastTouchDistance(Math.hypot(dx, dy));
      setLastTouchCenter({ x: cx, y: cy });
    }
  };

  const handleTouchMove = (e: TouchEvent<SVGSVGElement>) => {
    // Prevent default browser behavior explicitly just in case
    if (e.cancelable) e.preventDefault();

    if (e.touches.length === 2 && lastTouchDistance !== null && lastTouchCenter !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      
      const s = dist / lastTouchDistance;
      const newScale = Math.max(0.1, Math.min(scale * s, 10));
      
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      
      const deltaX = cx - lastTouchCenter.x;
      const deltaY = cy - lastTouchCenter.y;
      
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const mouseX = cx - rect.left;
        const mouseY = cy - rect.top;
        const scaleChange = newScale / scale;
        
        // Combine panning distance with zoom offset
        setPan({
          x: mouseX - (mouseX - pan.x - deltaX) * scaleChange,
          y: mouseY - (mouseY - pan.y - deltaY) * scaleChange
        });
      }
      
      setScale(newScale);
      setLastTouchDistance(dist);
      setLastTouchCenter({ x: cx, y: cy });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setBgImage(url);
      setStep('draw');
      setTool('polygon');
      setShowIntro(true);
    }
  };

  const deleteSelected = () => {
    if (currentShape.length > 0) {
      // If actively drawing a shape, undo/delete the last clicked point
      setCurrentShape(currentShape.slice(0, -1));
    } else if (selectedShapeId) {
      setShapes(shapes.filter(s => s.id !== selectedShapeId));
      setSelectedShapeId(null);
    } else {
       // If nothing selected and not drawing, undo the last completed shape
       setShapes(shapes.slice(0, -1));
    }
  };

  // Create SVG path string for polygon
  const createPolyPath = (points: Point[], closed = false) => {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    if (closed) d += ' Z';
    return d;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden font-sans relative">
      {/* Header */}
      <header className="bg-white shadow-sm z-30 border-b border-gray-200 shrink-0">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-4 overflow-hidden">
            <button 
              onClick={() => {
                if (step === 'draw') setStep('start_choice');
                else if (step === 'planning_choice') setStep('draw');
                else if (step === 'pipeline_drawing') setStep('planning_choice');
                else if (step === 'irrigation_choice') setStep('pipeline_drawing');
                else if (step === 'irrigation_manual') setStep('planning_choice');
                else if (step === 'infrastructure') setStep('planning_choice');
                else if (step === 'calculation') setStep('draw');
                else onBack();
              }} 
              className="p-1 sm:p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-700 font-bold shrink-0"
              title="Zurück"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="overflow-hidden">
              <h1 className="font-black text-sm sm:text-base md:text-xl text-emerald-700 tracking-tight leading-none truncate">Bewässerungsplaner</h1>
              <p className="hidden sm:block text-[10px] md:text-xs text-slate-500 font-medium truncate mt-0.5">
                {step === 'start_choice' && "Schritt 1: Startweise wählen"}
                {step === 'draw' && "Schritt 2: Handzeichnung oder Plan-Nachzeichnung"}
                {step === 'planning_choice' && "Schritt 3: Planungsmethode wählen"}
                {step === 'pipeline_drawing' && "Schritt 4: Rohrleitungen einzeichnen"}
                {step === 'irrigation_choice' && "Schritt 5: Komponenten bestimmen"}
                {step === 'irrigation_manual' && "Schritt 6: Bauteile manuell platzieren"}
                {step === 'infrastructure' && "Schritt 4: Stationen setzen"}
                {step === 'calculation' && "Ergebnis: Materialliste & Druckanalyse"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
            {step === 'draw' && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md transition-colors"
                title="Hintergrund-Plan hochladen"
              >
                <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Plan hochladen</span>
                <span className="xs:hidden">Plan</span>
              </button>
            )}
            {step === 'draw' && (
              <button 
                onClick={() => {
                  if (shapes.length === 0) {
                    alert("Zeichne bitte zuerst mindestens eine Rasen-, Beet- oder Baumfläche ein.");
                    return;
                  }
                  setStep('planning_choice'); 
                  setTool('pan');
                }} 
                className="bg-emerald-600 text-white font-bold text-xs sm:text-sm px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-md hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
              >
                <span className="hidden xs:inline">Schnitt-Planung</span>
                <span className="xs:hidden">Planen</span>
              </button>
            )}
            {step === 'pipeline_drawing' && (
              <div className="flex gap-2">
                {currentShape.length >= 2 && (
                  <button 
                    onClick={() => {
                      setManualPipes([...manualPipes, { id: 'pipe-' + Date.now(), points: currentShape, type: 'pe25' }]);
                      setCurrentShape([]);
                    }} 
                    className="bg-sky-600 text-white font-semibold text-xs sm:text-sm px-2.5 py-1.5 rounded-md hover:bg-sky-700 transition-colors shadow-sm"
                  >
                    Rohr fertigstellen ({currentShape.length} Punkte)
                  </button>
                )}
                <button 
                  onClick={() => {
                    setStep('irrigation_choice'); 
                    setTool('pan');
                    setCurrentShape([]);
                  }} 
                  className="bg-emerald-600 text-white font-bold text-xs sm:text-sm px-3 py-1.5 rounded-md hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                >
                  Weiter zur Bestückung
                </button>
              </div>
            )}
            {step === 'irrigation_manual' && (
              <div className="flex items-center gap-2">
                {currentShape.length >= 2 && tool === 'draw_pipe' && (
                  <button 
                    onClick={() => {
                      setManualPipes([...manualPipes, { id: 'pipe-' + Date.now(), points: currentShape, type: 'pe25' }]);
                      setCurrentShape([]);
                    }} 
                    className="bg-sky-600 text-white font-semibold text-xs sm:text-sm px-2.5 py-1.5 rounded-md hover:bg-sky-700 transition-colors shadow-sm"
                  >
                    Leitung fertig ({currentShape.length})
                  </button>
                )}
                {currentShape.length >= 2 && tool === 'draw_drip' && (
                  <button 
                    onClick={() => {
                      setManualDripLines([...manualDripLines, { id: 'drip-' + Date.now(), points: currentShape }]);
                      setCurrentShape([]);
                    }} 
                    className="bg-amber-600 text-white font-semibold text-xs sm:text-sm px-2.5 py-1.5 rounded-md hover:bg-amber-700 transition-colors shadow-sm font-sans"
                  >
                    Schlauch fertig ({currentShape.length})
                  </button>
                )}
                <button 
                  onClick={triggerOptionalAutoPlan} 
                  className="bg-indigo-600 text-white font-semibold text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border border-indigo-500/20"
                  title="Regner automatisch auf Rasenflächen platzieren"
                >
                  <span className="hidden xs:inline">🧙‍♂️ Auto-Sprinkler</span>
                  <span className="xs:hidden">🧙‍♂️ Auto</span>
                </button>
                <button 
                  onClick={runManualCalculation} 
                  className="bg-emerald-600 text-white font-extrabold text-xs sm:text-sm px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-md animate-pulse cursor-pointer"
                >
                  Fertig & Berechnen
                </button>
              </div>
            )}
            {step === 'infrastructure' && (
              <button onClick={runCalculation} className="bg-emerald-600 text-white font-bold text-xs sm:text-sm px-3 py-2 sm:px-4 rounded-xl hover:bg-emerald-700 transition-colors shadow-md cursor-pointer">
                <span className="hidden sm:inline font-bold">Planung automatisch berechnen</span>
                <span className="sm:hidden font-bold">Auto-Planen</span>
              </button>
            )}
            {step === 'calculation' && (
              <div className="flex gap-1.5 sm:gap-2">
                <button 
                  onClick={() => {
                    setStep('draw'); 
                    setShapes([]); 
                    setInfraNodes([]); 
                    setManualPipes([]); 
                    setManualDripLines([]); 
                    setManualRzws([]);
                    setSprinklers([]);
                    setPipes([]);
                  }} 
                  className="bg-gray-900 text-white font-semibold text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 rounded-md hover:bg-black transition-colors shadow-sm font-sans"
                >
                  <span>Neu Planen</span>
                </button>
                {onNext && (
                  <button onClick={handleProceedToBom} className="bg-emerald-600 text-white font-semibold text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 rounded-md hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer ml-auto flex items-center gap-1 font-sans">
                    <span className="hidden sm:inline font-bold">Zur Bestellung & Stückliste</span>
                    <span className="sm:hidden font-bold">Fertig</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 relative flex">
        {/* Toolbar - Floating */}
        {step !== 'start_choice' && (
          <div className="absolute left-3 top-3 sm:left-4 sm:top-4 z-20 flex flex-col gap-1.5 sm:gap-2 bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-gray-200 shadow-xl max-w-[56px]">
            <button 
              onClick={() => setTool('pan')} 
              className={`p-2 rounded-xl transition-all ${tool === 'pan' ? 'bg-emerald-500 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`} 
              title="Verschieben (Hand-Werkzeug)"
            >
              <Hand className="w-5 h-5" />
            </button>
            <div className="w-full h-px bg-slate-200 my-1"></div>
            
            {step === 'draw' && (
              <>
                <button 
                  onClick={() => setTool('polygon')} 
                  className={`p-2 rounded-xl transition-all ${tool === 'polygon' ? 'bg-emerald-500 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`} 
                  title="Fläche frei einzeichnen"
                >
                  <PenTool className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setTool('rectangle')} 
                  className={`p-2 rounded-xl transition-all ${tool === 'rectangle' ? 'bg-emerald-500 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`} 
                  title="Viereck zeichnen"
                >
                  <Square className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setTool('circle')} 
                  className={`p-2 rounded-xl transition-all ${tool === 'circle' ? 'bg-emerald-500 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`} 
                  title="Kreis zeichnen"
                >
                  <Circle className="w-5 h-5" />
                </button>
                <div className="w-full h-px bg-slate-200 my-1"></div>
              </>
            )}

            {step === 'pipeline_drawing' && (
              <>
                <button 
                  onClick={() => { setTool('draw_pipe'); setCurrentShape([]); }} 
                  className={`p-2 rounded-xl transition-all ${tool === 'draw_pipe' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`} 
                  title="Hauptleitung verlegen (PE-Rohr 25mm)"
                >
                  <PenTool className="w-5 h-5 text-sky-600" style={{ stroke: tool === 'draw_pipe' ? '#fff' : undefined }} />
                </button>
                <button 
                  onClick={() => setTool('water_source')} 
                  className={`p-2 rounded-xl transition-all ${tool === 'water_source' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`} 
                  title="Wasseranschluss platzieren"
                >
                  <Droplet className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setTool('valve_box')} 
                  className={`p-2 rounded-xl transition-all ${tool === 'valve_box' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`} 
                  title="Verteilerbox platzieren"
                >
                  <Box className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setTool('controller')} 
                  className={`p-2 rounded-xl transition-all ${tool === 'controller' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`} 
                  title="Steuerungs-Computer platzieren"
                >
                  <Cpu className="w-5 h-5" />
                </button>
                <div className="w-full h-px bg-slate-200 my-1"></div>
              </>
            )}

            {step === 'irrigation_manual' && (
              <>
                <button 
                  onClick={() => setTool('add_sprinkler')} 
                  className={`p-2 rounded-xl transition-all ${tool === 'add_sprinkler' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`} 
                  title="Regner platzieren (MP Rotator)"
                >
                  <CircleDot className="w-5 h-5 text-emerald-600" style={{ stroke: tool === 'add_sprinkler' ? '#fff' : undefined }} />
                </button>
                <button 
                  onClick={() => { setTool('draw_pipe'); setCurrentShape([]); }} 
                  className={`p-2 rounded-xl transition-all ${tool === 'draw_pipe' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`} 
                  title="PE-Rohr verlegen (Zonenleitung)"
                >
                  <PenTool className="w-5 h-5 text-sky-600" style={{ stroke: tool === 'draw_pipe' ? '#fff' : undefined }} />
                </button>
                <button 
                  onClick={() => { setTool('draw_drip'); setCurrentShape([]); }} 
                  className={`p-2 rounded-xl transition-all ${tool === 'draw_drip' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`} 
                  title="Tropfschlauch / Heckenbewässerung verlegen (Tropfrohr)"
                >
                  <PenTool className="w-5 h-5 text-amber-600" style={{ stroke: tool === 'draw_drip' ? '#fff' : undefined }} />
                </button>
                <button 
                  onClick={() => setTool('add_rzws')} 
                  className={`p-2 rounded-xl transition-all ${tool === 'add_rzws' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`} 
                  title="RZWS Baum-Bewässerung setzen"
                >
                  <Trees className="w-5 h-5 text-green-700" style={{ stroke: tool === 'add_rzws' ? '#fff' : undefined }} />
                </button>
                <div className="w-full h-px bg-slate-200 my-1"></div>
                <button 
                  onClick={() => setTool('water_source')} 
                  className={`p-2 rounded-xl transition-all ${tool === 'water_source' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`} 
                  title="Wasseranschluss platzieren"
                >
                  <Droplet className="w-5 h-5 text-indigo-500" style={{ stroke: tool === 'water_source' ? '#fff' : undefined }} />
                </button>
                <button 
                  onClick={() => setTool('valve_box')} 
                  className={`p-2 rounded-xl transition-all ${tool === 'valve_box' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`} 
                  title="Verteilerbox platzieren (Pflicht)"
                >
                  <Box className="w-5 h-5 text-teal-600" style={{ stroke: tool === 'valve_box' ? '#fff' : undefined }} />
                </button>
                <button 
                  onClick={() => setTool('controller')} 
                  className={`p-2 rounded-xl transition-all ${tool === 'controller' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`} 
                  title="Steuerungs-Computer platzieren (Pflicht)"
                >
                  <Cpu className="w-5 h-5 text-fuchsia-600" style={{ stroke: tool === 'controller' ? '#fff' : undefined }} />
                </button>
                <div className="w-full h-px bg-slate-200 my-1"></div>
              </>
            )}

            {step === 'infrastructure' && (
              <>
                <button 
                  onClick={() => setTool('water_source')} 
                  className={`p-2 rounded-xl transition-all ${tool === 'water_source' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`} 
                  title="Wasserquelle"
                >
                  <Droplet className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setTool('controller')} 
                  className={`p-2 rounded-xl transition-all ${tool === 'controller' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`} 
                  title="Steuergerät"
                >
                  <Cpu className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setTool('valve_box')} 
                  className={`p-2 rounded-xl transition-all ${tool === 'valve_box' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`} 
                  title="Verteilerbox"
                >
                  <Box className="w-5 h-5" />
                </button>
                <div className="w-full h-px bg-slate-200 my-1"></div>
              </>
            )}

            <button onClick={() => setScale(s => s * 1.25)} className="p-2 rounded-xl transition-all hover:bg-slate-100 text-slate-600 font-bold" title="Hineinzoomen">
              <ZoomIn className="w-5 h-5" />
            </button>
            <button onClick={() => setScale(s => s / 1.25)} className="p-2 rounded-xl transition-all hover:bg-slate-100 text-slate-600 font-bold" title="Herauszoomen">
              <ZoomOut className="w-5 h-5" />
            </button>
            <button onClick={() => { setPan({x:0, y:0}); setScale(1); }} className="p-2 rounded-xl transition-all hover:bg-slate-100 text-slate-600" title="Kamera zurücksetzen">
              <Mouse className="w-5 h-5" />
            </button>
            <div className="w-full h-px bg-slate-200 my-1"></div>
            <button onClick={deleteSelected} className="p-2 rounded-xl transition-all hover:bg-red-50 text-red-500 font-bold" title="Löschen / Rückgängig">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Dynamic Tool Helper Card */}
        {(() => {
          const helper = getToolHelper();
          if (!helper) return null;
          return (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-25 bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl border border-slate-700/50 shadow-2xl max-w-sm sm:max-w-md w-[calc(100vw-2.5rem)] flex gap-3 items-center justify-start text-left pointer-events-none select-none">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </div>
              <div className="flex-1 min-w-0 font-sans">
                <h4 className="font-bold text-xs sm:text-sm text-emerald-400 tracking-wide leading-none">{helper.title}</h4>
                <p className="text-[10px] sm:text-xs text-slate-300 mt-1.5 leading-normal leading-relaxed">{helper.desc}</p>
              </div>
            </div>
          );
        })()}

        {/* Live Area Info */}
        <div className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-3 pointer-events-none">
          {tool === 'polygon' && currentShape.length > 2 && (
            <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="pointer-events-auto">
              <button 
                onClick={completePolygon}
                className="bg-emerald-600 text-white font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-emerald-700 flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> Fläche abschließen
              </button>
            </motion.div>
          )}

          {shapes.length > 0 && (
            <div className="bg-white/90 backdrop-blur-md border border-gray-200 rounded-xl shadow-lg p-3 min-w-[150px] sm:p-4 sm:min-w-[200px]">
              <h3 className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 sm:mb-3">Erfasste Flächen</h3>
              <div className="space-y-1.5 sm:space-y-2">
                {shapes.map((s, i) => (
                  <div key={s.id} className="flex justify-between items-center bg-gray-50 px-2 py-1 sm:py-1.5 rounded border border-gray-100">
                    <span className="text-xs sm:text-sm font-medium text-gray-700">
                       {s.areaType === 'lawn' ? 'Rasen' : s.areaType === 'bed' ? 'Beet' : s.areaType === 'tree' ? 'Baum' : 'Fläche'} {i+1}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-emerald-700">{calculateArea(s).toFixed(1)} m²</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xs sm:text-sm font-bold text-gray-900">Gesamt:</span>
                <span className="text-sm sm:text-base font-black text-emerald-700">
                  {shapes.reduce((sum, s) => sum + calculateArea(s), 0).toFixed(1)} m²
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Result Area Info */}
        {(step === 'calculation' && showStats && selectedSprinklerIdx === null) && (
          <div className="absolute top-24 right-4 sm:right-6 z-20 flex flex-col items-end gap-3 pointer-events-none">
            {showStats ? (
              <motion.div initial={{opacity: 0, x: 20}} animate={{opacity: 1, x: 0}} className="bg-white/90 backdrop-blur-md border border-gray-200 rounded-xl shadow-xl w-[calc(100vw-2rem)] sm:w-[320px] max-h-[calc(100vh-10rem)] overflow-y-auto pointer-events-auto flex flex-col">
                 <div className="bg-slate-50 border-b border-slate-200/80 p-4 text-slate-800 flex justify-between items-center">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">System-Analyse</h3>
                      <p className="text-slate-500 text-[11px] font-semibold">Basierend auf Hunter MP Rotator</p>
                    </div>
                    <button onClick={() => setShowStats(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-1.5 rounded-full transition-colors cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                 </div>
                 
                 {selectedSprinklerIdx !== null && sprinklers[selectedSprinklerIdx] ? (
                    <div className="p-4 space-y-4 text-sm font-sans">
                       
                       {/* Display model and description */}
                       <div className="flex flex-col pb-3 border-b border-gray-100 gap-1 font-sans">
                           <span className="text-xs text-slate-400 uppercase font-black tracking-wider">Aktives Modell</span>
                           <span className="font-bold text-gray-950 text-base">{sprinklers[selectedSprinklerIdx].label}</span>
                       </div>

                       {/* Nozzle Select dropdown */}
                       <div className="space-y-1.5 pb-3 border-b border-gray-100 font-sans">
                           <span className="text-xs text-slate-500 font-extrabold tracking-wide block">Düse manuell auswählen</span>
                           <select
                             value={sprinklers[selectedSprinklerIdx].selectedModel || 'auto'}
                             onChange={(e) => handleUpdateSprinklerModel(e.target.value)}
                             className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-800 shadow-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-sans cursor-pointer focus:outline-none"
                           >
                             <option value="auto">Automatische Bestimmung (Wurfweite)</option>
                             <option value="MP800SR">MP800SR (Kurzstrecke: 1.1m - 3.5m)</option>
                             <option value="MP1000">MP1000 (Mittelstrecke: 2.5m - 4.6m)</option>
                             <option value="MP815">MP815 (Schnellberegnung: 2.5m - 4.9m)</option>
                             <option value="MP2000">MP2000 (Mittelstrecke groß: 4.0m - 6.4m)</option>
                             <option value="MP3000">MP3000 (Großfläche: 6.7m - 9.1m)</option>
                             <option value="MP3500">MP3500 (Großfläche maximal: 9.4m - 10.7m)</option>
                           </select>
                              {(() => {
                              const sp = sprinklers[selectedSprinklerIdx];
                              const nz = getNozzleData(sp.r, sp.angleDeg, sp.selectedModel);
                              const minR = nz.minR;
                              const maxR = nz.maxR;
                              let desc = "Optimaler Hunter MP Rotator Regner";
                              if (nz.model === 'MP800SR') desc = "Kurzstrecken-Düse (1,8m - 3,5m) mit hoher Niederschlagsrate für kleine Gärten.";
                              else if (nz.model === 'MP1000') desc = "Standard-Düse (2,5m - 4,5m) für mittelgroße Rasenflächen.";
                              else if (nz.model === 'MP815') desc = "Schnellberegnungs-Düse (2,5m - 4,9m) mit hoher Niederschlagsrate.";
                              else if (nz.model === 'MP2000') desc = "Stabile Mittelstrecken-Düse (4,0m - 6,4m) für optimalen Windschutz.";
                              else if (nz.model === 'MP3000') desc = "Großflächen-Düse (6,7m - 9,1m) für weite Rasenflächen.";
                              else if (nz.model === 'MP3500') desc = "Maximal-Düse (9,4m - 10,7m) für extrem weite Reichweiten.";
                              else if (nz.model === 'MP Corner') desc = "Spezialdüse (2,5m - 4,5m) für exakte 90°-Eckenbewässerung.";

                              const currentR = parseFloat((sp.r / PIXELS_PER_METER).toFixed(1));
                              const isAtLimit = currentR <= minR || currentR >= maxR;
                              
                              return (
                                <div className="mt-2 bg-slate-50 rounded-lg p-2.5 border border-slate-150 text-[11px] space-y-1">
                                  <div className="flex justify-between items-center text-slate-600 font-sans">
                                    <span>Grenzbereich der Wurfweite:</span>
                                    <span className="font-mono font-bold text-slate-900">{minR.toFixed(1)}m – {maxR.toFixed(1)}m</span>
                                  </div>
                                  <div className="flex justify-between items-center text-slate-600 font-sans">
                                    <span>Düsenfarbe (Kappe):</span>
                                    <span className="flex items-center gap-1.5 font-bold text-slate-800">
                                      <span 
                                        className="w-2.5 h-2.5 rounded-full inline-block border border-black/10 animate-pulse shadow-xs shrink-0" 
                                        style={{ backgroundColor: nz.colorHex }}
                                      />
                                      {nz.colorName}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-slate-600 font-sans">
                                    <span>Wasserverbrauch:</span>
                                    <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100/50">~{(sp.flowLpm || 0).toFixed(1)} l/min</span>
                                  </div>
                                  {desc && <p className="text-[10px] text-slate-400 font-normal italic font-sans leading-tight pt-0.5">{desc}</p>}
                                  {isAtLimit && (
                                    <div className="text-[10px] text-amber-600 flex items-center gap-1 font-bold pt-1 border-t border-slate-100">
                                      <span>⚠️ Leistungsgrenze erreicht ({currentR.toFixed(1)}m)</span>
                                    </div>
                                  )}
                                </div>
                              );
                           })()}
                       </div>

                       {/* Wurfweite adjustment with slider and +/- buttons */}
                       <div className="space-y-2 pb-3 border-b border-gray-100 font-sans">
                           <div className="flex justify-between items-center font-sans">
                              <span className="text-xs text-slate-500 font-bold tracking-wide">Wurfweite (Radius)</span>
                              <span className="font-mono text-xs font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shadow-xs">
                                {(sprinklers[selectedSprinklerIdx].r / PIXELS_PER_METER).toFixed(1)}m
                              </span>
                           </div>
                           <div className="flex items-center gap-2">
                             <button
                               type="button"
                               onClick={() => {
                                 const currentR = sprinklers[selectedSprinklerIdx].r / PIXELS_PER_METER;
                                 const nextVal = Math.max(1.1, parseFloat((currentR - 0.1).toFixed(1)));
                                 handleUpdateSprinklerRadius(nextVal);
                               }}
                               className="w-8 h-8 select-none bg-slate-50 border border-slate-200 hover:bg-slate-150 active:bg-slate-200 text-slate-800 rounded-lg flex items-center justify-center font-black text-base transition-colors shrink-0 cursor-pointer"
                             >
                               -
                             </button>
                             <input
                               type="range"
                               min="1.1"
                               max="10.7"
                               step="0.1"
                               value={parseFloat((sprinklers[selectedSprinklerIdx].r / PIXELS_PER_METER).toFixed(1))}
                               onChange={(e) => handleUpdateSprinklerRadius(parseFloat(e.target.value))}
                               className="flex-1 accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                             />
                             <button
                               type="button"
                               onClick={() => {
                                 const currentR = sprinklers[selectedSprinklerIdx].r / PIXELS_PER_METER;
                                 const nextVal = Math.min(10.7, parseFloat((currentR + 0.1).toFixed(1)));
                                 handleUpdateSprinklerRadius(nextVal);
                               }}
                               className="w-8 h-8 select-none bg-slate-50 border border-slate-200 hover:bg-slate-150 active:bg-slate-200 text-slate-800 rounded-lg flex items-center justify-center font-black text-base transition-colors shrink-0 cursor-pointer"
                             >
                               +
                             </button>
                           </div>
                       </div>

                       {/* Winkel/Sektor adjustment with presets and +/- buttons */}
                       <div className="space-y-2 pb-3 border-b border-gray-100 font-sans">
                           <div className="flex justify-between items-center font-sans">
                              <span className="text-xs text-slate-500 font-bold tracking-wide">Beregnungswinkel</span>
                              <span className="font-mono text-xs font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shadow-xs">
                                {Math.round(sprinklers[selectedSprinklerIdx].angleDeg)}°
                              </span>
                           </div>
                           <div className="flex gap-1">
                             {[90, 180, 270, 360].map(deg => (
                               <button
                                 key={deg}
                                 type="button"
                                 onClick={() => handleUpdateSprinklerAngle(deg)}
                                 className={`flex-1 py-1 rounded text-[11px] font-extrabold transition-all border cursor-pointer ${
                                   Math.round(sprinklers[selectedSprinklerIdx].angleDeg) === deg
                                     ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                     : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs'
                                 }`}
                               >
                                 {deg}°
                               </button>
                             ))}
                           </div>
                           <div className="flex items-center gap-2 pt-1 font-sans">
                              {(() => {
                                const sp = sprinklers[selectedSprinklerIdx];
                                const testNz = getNozzleData(sp.r, 45, sp.selectedModel);
                                const minAngleAllowed = (testNz.model === 'MP Corner' || testNz.model === 'MP-Corner') ? 45 : 90;
                                return (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentA = sp.angleDeg;
                                        const nextVal = Math.max(minAngleAllowed, Math.round(currentA - 5));
                                        handleUpdateSprinklerAngle(nextVal);
                                      }}
                                      className="w-8 h-8 select-none bg-slate-50 border border-slate-200 hover:bg-slate-150 active:bg-slate-200 text-slate-800 rounded-lg flex items-center justify-center font-black text-base transition-colors shrink-0 cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="range"
                                      min={minAngleAllowed}
                                      max="360"
                                      step="5"
                                      value={Math.round(sp.angleDeg)}
                                      onChange={(e) => handleUpdateSprinklerAngle(parseInt(e.target.value))}
                                      className="flex-1 accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentA = sp.angleDeg;
                                        const nextVal = Math.min(360, Math.round(currentA + 5));
                                        handleUpdateSprinklerAngle(nextVal);
                                      }}
                                      className="w-8 h-8 select-none bg-slate-50 border border-slate-200 hover:bg-slate-150 active:bg-slate-200 text-slate-800 rounded-lg flex items-center justify-center font-black text-base transition-colors shrink-0 cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                       </div>

                       {/* Interactive clean quick buttons */}
                       <div className="pt-2 flex flex-col gap-2 font-sans">
                           <button 
                             type="button"
                             onClick={() => {
                               const updated = sprinklers.filter((_, idx) => idx !== selectedSprinklerIdx);
                               setSprinklers(updated);
                               setSelectedSprinklerIdx(null);
                             }} 
                             className="w-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                           >
                             <Trash2 className="w-3.5 h-3.5" /> Düse löschen
                           </button>
                           <button 
                             type="button"
                             onClick={() => setSelectedSprinklerIdx(null)} 
                             className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                           >
                             Schließen
                           </button>
                       </div>
                    </div>
                  ) : (
                  <div className="p-4 space-y-4 text-sm max-h-[calc(100vh-14rem)] overflow-y-auto">
                    {/* Collapsible Section 1: Parameters */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm font-sans">
                      <button
                        onClick={() => setIsParamsExpanded(!isParamsExpanded)}
                        className="w-full flex justify-between items-center px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100 border-none outline-none focus:outline-none"
                      >
                        <span className="font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-1.5 font-sans">
                          <Droplet className="w-3.5 h-3.5 text-blue-500" />
                          Anlagendaten & Verluste
                        </span>
                        <span className="text-gray-400 font-bold">{isParamsExpanded ? '▼' : '►'}</span>
                      </button>
                      
                      {isParamsExpanded && (
                        <div className="p-3 space-y-3.5 bg-white font-sans">
                          {/* Pressure setting */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-500 font-medium font-sans">Eingangsdruck:</span>
                              <span className="font-bold text-gray-800">{inletPressure.toFixed(2)} bar</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => setInletPressure(prev => Math.max(1.0, prev - 0.1))} 
                                className="w-6 h-6 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded flex items-center justify-center font-bold text-xs"
                              >
                                -
                              </button>
                              <input 
                                type="range" 
                                min="1.5" 
                                max="6.0" 
                                step="0.1" 
                                value={inletPressure} 
                                onChange={(e) => setInletPressure(parseFloat(e.target.value))}
                                className="flex-1 accent-blue-600 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                              />
                              <button 
                                onClick={() => setInletPressure(prev => Math.min(6.0, prev + 0.1))} 
                                className="w-6 h-6 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded flex items-center justify-center font-bold text-xs"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Elevation setting */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-500 font-medium font-sans">Höhenunterschied:</span>
                              <span className="font-bold text-gray-800 font-sans">
                                {elevationDiff > 0 ? `+${elevationDiff}` : elevationDiff} m
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => setElevationDiff(prev => Math.max(-10, prev - 1))} 
                                className="w-6 h-6 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded flex items-center justify-center font-bold text-xs"
                              >
                                -
                              </button>
                              <input 
                                type="range" 
                                min="-10" 
                                max="15" 
                                step="1" 
                                value={elevationDiff} 
                                onChange={(e) => setElevationDiff(parseInt(e.target.value))}
                                className="flex-1 accent-cyan-600 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                              />
                              <button 
                                onClick={() => setElevationDiff(prev => Math.min(15, prev + 1))} 
                                className="w-6 h-6 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded flex items-center justify-center font-bold text-xs"
                              >
                                +
                              </button>
                            </div>
                            <div className="text-[10px] text-gray-400 italic font-sans">
                              1m Steigung = -0.1 bar Druck
                            </div>
                          </div>

                          {/* Extra bends / fittings setting */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-500 font-medium">Zusätzliche Bögen (Hauptl.):</span>
                              <span className="font-bold text-gray-800">{extraBends}x</span>
                            </div>
                            <div className="flex items-center gap-2 text-sans">
                              <button 
                                onClick={() => setExtraBends(prev => Math.max(0, prev - 1))} 
                                className="w-6 h-6 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded flex items-center justify-center font-bold text-xs"
                              >
                                -
                              </button>
                              <input 
                                type="range" 
                                min="0" 
                                max="10" 
                                step="1" 
                                value={extraBends} 
                                onChange={(e) => setExtraBends(parseInt(e.target.value))}
                                className="flex-1 accent-amber-600 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                              />
                              <button 
                                onClick={() => setExtraBends(prev => Math.min(10, prev + 1))} 
                                className="w-6 h-6 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded flex items-center justify-center font-bold text-xs"
                              >
                                +
                              </button>
                            </div>
                            <div className="text-[10px] text-gray-400 italic font-sans">
                              Bögen erhöhen Widerstand (+1.0m pro Bogen)
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Collapsible Section 2: Pipe Sizing Results */}
                    {(() => {
                      const analysis = calculateAnalysis();
                      return (
                        <div className="space-y-4 font-sans">
                          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                            <button
                              onClick={() => setIsSizingExpanded(!isSizingExpanded)}
                              className="w-full flex justify-between items-center px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100 border-none outline-none focus:outline-none"
                            >
                              <span className="font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-1.5 font-sans">
                                <Box className="w-3.5 h-3.5 text-emerald-500" />
                                Rohrdimensionierung & Druck
                              </span>
                              <span className="text-gray-400 font-bold">{isSizingExpanded ? '▼' : '►'}</span>
                            </button>

                            {isSizingExpanded && (
                              <div className="p-3 space-y-3 bg-white">
                                {/* Main pipe */}
                                <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-semibold text-xs text-gray-800 font-sans">Hauptleitung (Quelle → Box)</span>
                                    <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100/50 text-emerald-800 font-extrabold text-[10px] rounded uppercase font-sans">
                                      {analysis.mainPipe.size} mm PE
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1.5 text-[10px] text-gray-500 border-t border-gray-100 pt-1.5 font-sans">
                                    <div>Länge: <span className="font-semibold text-gray-700">{analysis.mainPipe.length.toFixed(1)}m</span></div>
                                    <div>Peak-Fluss: <span className="font-semibold text-gray-700">{analysis.maxZoneFlow.toFixed(1)} l/min</span></div>
                                    <div className="col-span-2 text-xs font-semibold">Druckverlust: <span className="font-semibold text-red-600">-{analysis.mainPipe.loss.toFixed(2)} bar</span></div>
                                  </div>
                                </div>

                                {/* Zones */}
                                <div className="space-y-2">
                                  <h4 className="font-bold text-gray-500 text-[10px] uppercase tracking-wider">Bewässerungskreise (Zonen)</h4>
                                  {analysis.zones.map((z, idx) => (
                                    <div key={idx} className="p-2 bg-gray-50 border border-gray-100 rounded-lg">
                                      <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }}></div>
                                          Kreis {idx + 1}
                                        </div>
                                        <span className={`px-1.5 py-0.5 text-white font-bold text-[10px] rounded ${z.size === 25 ? 'bg-indigo-600' : z.size === 32 ? 'bg-violet-600' : 'bg-fuchsia-600'}`}>
                                          {z.size} mm PE
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1.5 text-[10px] text-gray-500 border-t border-gray-100 pt-1.5 font-sans">
                                        <div>Durchfluss: <span className="font-semibold text-gray-700 text-xs font-sans">{z.flow.toFixed(1)} l/min</span></div>
                                        <div>Regner: <span className="font-semibold text-gray-700 text-xs font-sans">{z.sprinklersCount}</span></div>
                                        <div>Rohrlänge: <span className="font-semibold text-gray-700 text-xs font-sans">{z.length.toFixed(1)} m</span></div>
                                        <div>T-Stück/Bogen: <span className="font-semibold text-gray-700 text-[10px] font-sans">{z.tPieces}x/{z.elbows}x</span></div>
                                        <div className="col-span-2 font-medium flex justify-between items-center text-gray-700 border-t border-dashed border-gray-200 pt-1 mt-1 font-sans">
                                          <span>Regner-Flussdruck:</span>
                                          <span className={`font-bold ${z.pressure >= 2.8 ? 'text-emerald-600' : z.pressure >= 2.5 ? 'text-amber-600' : 'text-red-500'}`}>
                                            {z.pressure.toFixed(2)} bar
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Alerts Section (Warnings & Recommendations) */}
                          {(analysis.warnings.length > 0 || analysis.recommendations.length > 0) ? (
                            <div className="space-y-2 font-sans">
                              {analysis.warnings.map((w, i) => (
                                <div key={i} className="bg-red-50/75 px-2.5 py-2 border border-red-100 rounded-lg text-[11px] text-red-700 font-semibold flex items-start gap-1.5 animate-pulse font-sans">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span>{w}</span>
                                </div>
                              ))}
                              {analysis.recommendations.map((r, i) => (
                                <div key={i} className="bg-amber-50 px-2.5 py-2 border border-amber-100 rounded-lg text-[11px] text-amber-800 font-medium flex items-start gap-1.5 font-sans">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 9a1 1 0 102 0v-3a1 1 0 00-2 0v3z" clipRule="evenodd" />
                                  </svg>
                                  <span>{r}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {/* Best Practice Info Box */}
                          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-[11px] text-slate-700 space-y-1.5 font-sans">
                            <span className="font-bold uppercase text-[9px] tracking-wide text-emerald-600 font-sans">Profi Best Practices</span>
                            <div className="space-y-1 font-sans text-xs text-slate-600">
                              <div>• Hauptleitung (Quelle → Box): <span className="font-bold text-slate-800">32 mm</span> bevorzugen.</div>
                              <div>• Kreiszuleitungen (Box → Regner): <span className="font-bold text-slate-800">25 mm</span> PE-Rohr.</div>
                              <div>• Regneranschluss: <span className="font-bold text-slate-800">16 mm weiches Flexrohr</span> (Swing Joint).</div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {onNext && (
                      <button 
                        onClick={handleProceedToBom}
                        className="mt-4 w-full bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-emerald-700 transition shadow flex items-center justify-center gap-2 text-sm cursor-pointer shrink-0 font-sans font-semibold border-none outline-none"
                      >
                        Weiter zur Artikelübersicht
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                  )}
              </motion.div>
            ) : (
              <button onClick={() => setShowStats(true)} className="pointer-events-auto bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 p-3.5 rounded-full shadow-lg transition duration-200 cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Canvas Area */}
        <div 
          className="flex-1 w-full h-full relative overflow-hidden bg-[#fafafa] touch-none"
          style={{ cursor: tool === 'pan' ? (isPanning ? 'grabbing' : 'grab') : 'crosshair', touchAction: 'none' }}
        >
          <svg 
            ref={svgRef}
            className="w-full h-full absolute inset-0 block touch-none"
            style={{ touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => setLastTouchDistance(null)}
          >
            <defs>
              <pattern 
                id="grid" 
                width={PIXELS_PER_METER} 
                height={PIXELS_PER_METER} 
                patternUnits="userSpaceOnUse"
                patternTransform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}
              >
                <rect width={PIXELS_PER_METER} height={PIXELS_PER_METER} fill="none" stroke="#e5e7eb" strokeWidth={1 / scale} />
              </pattern>
              <pattern 
                id="grid-large" 
                width={PIXELS_PER_METER * 5} 
                height={PIXELS_PER_METER * 5} 
                patternUnits="userSpaceOnUse"
                patternTransform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}
              >
                <rect width={PIXELS_PER_METER * 5} height={PIXELS_PER_METER * 5} fill="none" stroke="#d1d5db" strokeWidth={1.5 / scale} />
              </pattern>
              {shapes.map(s => {
                  let pathData = '';
                  if (s.type === 'polygon' || (s.type === 'rectangle' && s.points.length === 2)) {
                      let pts = s.points;
                      if (s.type === 'rectangle') {
                          const minX = Math.min(pts[0].x, pts[1].x);
                          const maxX = Math.max(pts[0].x, pts[1].x);
                          const minY = Math.min(pts[0].y, pts[1].y);
                          const maxY = Math.max(pts[0].y, pts[1].y);
                          pts = [ {x:minX,y:minY}, {x:maxX,y:minY}, {x:maxX,y:maxY}, {x:minX,y:maxY} ];
                      }
                      pathData = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + ' Z';
                  } else if (s.type === 'circle' && s.points.length === 2) {
                      const [c, e] = s.points;
                      const r = Math.hypot(e.x - c.x, e.y - c.y);
                      pathData = `M ${c.x-r} ${c.y} A ${r} ${r} 0 1 0 ${c.x+r} ${c.y} A ${r} ${r} 0 1 0 ${c.x-r} ${c.y} Z`;
                  }
                  return (
                     <clipPath id={`clip-${s.id}`} key={`clip-${s.id}`}>
                        {pathData ? <path d={pathData} /> : null}
                     </clipPath>
                  );
              })}
            </defs>

            {/* Grids */}
            <rect width="100%" height="100%" fill="url(#grid)" />
            <rect width="100%" height="100%" fill="url(#grid-large)" />

            {/* Drawing Layer */}
            <g id="drawing-layer" transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
              
              {/* Background Image if uploaded */}
              {bgImage && (
                <image href={bgImage} x="0" y="0" width="800" height="auto" opacity="0.7" preserveAspectRatio="xMidYMid meet" />
              )}

              {/* Pipes linking Valve Box to Areas */}
              {pipes.map((p, i) => (
                <polyline 
                  key={`pipe-${p.id || i}`}
                  points={p.points.map(pt => `${pt.x},${pt.y}`).join(' ')}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-80"
                  style={{ stroke: p.color }}
                  strokeWidth={4 / scale}
                />
              ))}

              {/* Manual/Custom Pipes */}
              {manualPipes.map((p, i) => (
                <polyline 
                  key={`manual-pipe-${p.id}`}
                  points={p.points.map(pt => `${pt.x},${pt.y}`).join(' ')}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-90"
                  stroke="#0284c7"
                  strokeWidth={5 / scale}
                  strokeDasharray={`${4/scale},${4/scale}`}
                />
              ))}

              {/* Manual/Custom Drip Tubes */}
              {manualDripLines.map((p, i) => (
                <polyline 
                  key={`manual-drip-${p.id}`}
                  points={p.points.map(pt => `${pt.x},${pt.y}`).join(' ')}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  stroke="#d97706"
                  className="opacity-90"
                  strokeWidth={4 / scale}
                />
              ))}

              {/* Manual/Custom RZWS */}
              {manualRzws.map((p, i) => (
                <g key={`manual-rzws-${p.id}`} transform={`translate(${p.pos.x}, ${p.pos.y})`}>
                  <circle cx="0" cy="0" r={12 / scale} className="fill-emerald-800 stroke-white" strokeWidth={1.5 / scale} />
                  <Trees className="text-white" x={-6/scale} y={-6/scale} width={12/scale} height={12/scale} />
                </g>
              ))}

              {/* Interactive pipeline or drip drawing line */}
              {currentShape.length > 0 && (tool === 'draw_pipe' || tool === 'draw_drip') && (
                <>
                  <polyline 
                    points={currentShape.map(pt => `${pt.x},${pt.y}`).join(' ') + (hoverPos ? ` ${hoverPos.x},${hoverPos.y}` : '')}
                    fill="none" 
                    stroke={tool === 'draw_pipe' ? '#0284c7' : '#d97706'}
                    strokeWidth={4 / scale} 
                    strokeDasharray={`${5/scale},${5/scale}`}
                  />
                  {currentShape.map((pt, i) => (
                    <circle key={`segment-dot-${i}`} cx={pt.x} cy={pt.y} r={5 / scale} className="fill-blue-600 stroke-white" strokeWidth={1.5 / scale} />
                  ))}
                </>
              )}

              {/* Completed Shapes */}
              {shapes.map(s => {
                const isSelected = selectedShapeId === s.id;
                let fillClass = isSelected ? "fill-emerald-400 opacity-60" : "fill-emerald-200 opacity-40";
                let strokeClass = isSelected ? "stroke-emerald-600" : "stroke-emerald-500";
                
                if (s.areaType === 'bed') {
                  fillClass = isSelected ? "fill-amber-400 opacity-60" : "fill-amber-200 opacity-40";
                  strokeClass = isSelected ? "stroke-amber-600" : "stroke-amber-500";
                } else if (s.areaType === 'tree') {
                  fillClass = isSelected ? "fill-green-600 opacity-60" : "fill-green-800 opacity-40";
                  strokeClass = isSelected ? "stroke-green-900" : "stroke-green-800";
                }
                
                if (s.type === 'polygon' || (s.type === 'rectangle' && s.points.length === 2)) {
                   let pathData = '';
                   if (s.type === 'polygon') {
                     pathData = createPolyPath(s.points, true);
                   } else {
                     const [p1, p2] = s.points;
                     pathData = `M ${p1.x} ${p1.y} L ${p2.x} ${p1.y} L ${p2.x} ${p2.y} L ${p1.x} ${p2.y} Z`;
                   }
                   return (
                     <path 
                       key={s.id} 
                       d={pathData} 
                       className={`${fillClass} ${strokeClass} hover:opacity-70 transition-opacity cursor-pointer`}
                       style={{ pointerEvents: tool === 'select' ? 'auto' : 'none' }}
                       strokeWidth={2 / scale}
                       onPointerDown={(e) => { e.stopPropagation(); setSelectedShapeId(s.id); setTool('select'); }}
                       onClick={(e) => { e.stopPropagation(); setSelectedShapeId(s.id); setTool('select'); }}
                     />
                   );
                } else if (s.type === 'circle' && s.points.length === 2) {
                   const [center, edge] = s.points;
                   const r = Math.hypot(edge.x - center.x, edge.y - center.y);
                   return (
                    <circle 
                      key={s.id} 
                      cx={center.x} cy={center.y} r={r} 
                      className={`${fillClass} ${strokeClass} hover:opacity-70 transition-opacity cursor-pointer`}
                      style={{ pointerEvents: tool === 'select' ? 'auto' : 'none' }}
                      strokeWidth={2 / scale}
                      onPointerDown={(e) => { e.stopPropagation(); setSelectedShapeId(s.id); setTool('select'); }}
                      onClick={(e) => { e.stopPropagation(); setSelectedShapeId(s.id); setTool('select'); }}
                    />
                   );
                }
                return null;
              })}

              {/* Current Drawing Shape */}
              {currentShape.length > 0 && tool === 'polygon' && (
                <>
                  <path 
                    d={createPolyPath(currentShape) + (hoverPos ? ` L ${hoverPos.x} ${hoverPos.y}` : '')} 
                    fill="none" 
                    className="stroke-emerald-500 opacity-70" 
                    strokeWidth={2 / scale} 
                    strokeDasharray={`${5/scale},${5/scale}`}
                  />
                  {currentShape.map((pt, i) => (
                    <circle key={i} cx={pt.x} cy={pt.y} r={4 / scale} className="fill-emerald-500 stroke-white" strokeWidth={1.5 / scale} />
                  ))}
                </>
              )}

              {currentShape.length === 2 && tool === 'rectangle' && (
                <rect 
                  x={Math.min(currentShape[0].x, hoverPos?.x || currentShape[1].x)}
                  y={Math.min(currentShape[0].y, hoverPos?.y || currentShape[1].y)}
                  width={Math.abs(currentShape[0].x - (hoverPos?.x || currentShape[1].x))}
                  height={Math.abs(currentShape[0].y - (hoverPos?.y || currentShape[1].y))}
                  className="fill-emerald-200 stroke-emerald-500 opacity-50"
                  strokeWidth={2 / scale}
                  strokeDasharray={`${5/scale},${5/scale}`}
                />
              )}

               {currentShape.length === 2 && tool === 'circle' && (
                <circle 
                  cx={currentShape[0].x}
                  cy={currentShape[0].y}
                  r={Math.hypot(currentShape[0].x - (hoverPos?.x || currentShape[1].x), currentShape[0].y - (hoverPos?.y || currentShape[1].y))}
                  className="fill-emerald-200 stroke-emerald-500 opacity-50"
                  strokeWidth={2 / scale}
                  strokeDasharray={`${5/scale},${5/scale}`}
                />
              )}

              {/* Sprinklers */}
              {sprinklers.map((sp, i) => {
                const isFullCircle = sp.angleDeg >= 359;
                const isSelected = selectedSprinklerIdx === i;
                
                const startDeg = Math.round(((sp.angleStart * 180 / Math.PI) % 360 + 360) % 360);
                const endDeg = Math.round(((sp.angleEnd * 180 / Math.PI) % 360 + 360) % 360);
                const angleLabel = sp.angleDeg >= 359 ? "▶ 360°" : `▶ ${startDeg}° – ${endDeg}°`;

                return (
                 <g 
                    key={`sprinkler-${i}`} 
                    onPointerDown={(e) => { e.stopPropagation(); setSelectedSprinklerIdx(i); }}
                    onClick={(e) => { e.stopPropagation(); setSelectedSprinklerIdx(i); }}
                    className="cursor-pointer"
                 >
                  {/* Sprinkler spray area */}
                  <g clipPath={sp.shapeId ? `url(#clip-${sp.shapeId})` : undefined}>
                    <g transform={`translate(${sp.x}, ${sp.y})`}>
                      {isFullCircle ? (
                        <circle cx="0" cy="0" r={sp.r} className={`${isSelected ? 'fill-sky-400/25 stroke-sky-500' : 'fill-blue-400/20 stroke-blue-500'} pointer-events-none transition-all`} strokeWidth={1.5/scale} />
                      ) : (
                        <path 
                          d={`M 0 0 L ${sp.r * Math.cos(sp.angleStart)} ${sp.r * Math.sin(sp.angleStart)} A ${sp.r} ${sp.r} 0 ${sp.largeArc} ${sp.sweepFlag} ${sp.r * Math.cos(sp.angleEnd)} ${sp.r * Math.sin(sp.angleEnd)} Z`}
                          className={`${isSelected ? 'fill-sky-400/25 stroke-sky-500' : 'fill-blue-400/20 stroke-blue-500'} pointer-events-none transition-all`}
                          strokeWidth={1.5/scale}
                        />
                      )}
                    </g>
                  </g>
                  {/* Outer dot and text remain visible */}
                  <g transform={`translate(${sp.x}, ${sp.y})`}>
                    <circle cx="0" cy="0" r={24/scale} className="fill-transparent cursor-pointer" />
                    
                    {/* Center dot - Orange when selected, zone-colored when not selected */}
                    {isSelected ? (
                      <circle 
                        cx="0" cy="0" r={8/scale} 
                        fill="#ff6b3d" 
                        stroke="#c2410c" 
                        strokeWidth={2/scale}
                        className="transition-all hover:scale-110 drop-shadow-md cursor-pointer" 
                      />
                    ) : (
                      <circle 
                        cx="0" cy="0" r={6/scale} 
                        fill={sp.zoneColor || '#1d4ed8'} 
                        stroke="white" 
                        strokeWidth={1.5/scale}
                        className="transition-all cursor-pointer" 
                      />
                    )}

                    {/* Floating local Delete (trash/cross) Button above/left of the orange dot if selected */}
                    {isSelected && (
                      <g 
                        transform={`translate(${-18/scale}, ${-18/scale})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const updated = sprinklers.filter((_, idx) => idx !== i);
                          setSprinklers(updated);
                          setSelectedSprinklerIdx(null);
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        className="cursor-pointer"
                      >
                        <circle cx="0" cy="0" r={10/scale} fill="#ef4444" stroke="#ffffff" strokeWidth={1.5/scale} className="hover:fill-red-600 transition-colors shadow-sm" />
                        <path d={`M ${-4.5/scale} ${-4.5/scale} L ${4.5/scale} ${4.5/scale} M ${4.5/scale} ${-4.5/scale} L ${-4.5/scale} ${4.5/scale}`} stroke="#ffffff" strokeWidth={1.8/scale} strokeLinecap="round" />
                      </g>
                    )}

                    {/* Start sector white knob marker (as reference) if selected */}
                    {isSelected && !isFullCircle && (
                      <circle
                        cx={sp.r * Math.cos(sp.angleStart)}
                        cy={sp.r * Math.sin(sp.angleStart)}
                        r={7 / scale}
                        fill="#ffffff"
                        stroke="#334155"
                        strokeWidth={2 / scale}
                        className="pointer-events-none drop-shadow-md"
                      />
                    )}
                    
                    {/* Live Multi-Line High Precision Nozzle Data Label Card underneath */}
                    <g transform={`translate(0, ${18 / scale})`}>
                      {/* Name of Nozzle model (Hunter MP line) */}
                      <text 
                        x={0} y={0} 
                        fontSize={9.5 / scale} 
                        textAnchor="middle" 
                        stroke="#ffffff" 
                        strokeWidth={3/scale} 
                        paintOrder="stroke" 
                        className={`font-sans font-black pointer-events-none ${isSelected ? 'fill-slate-900 text-[10.5px]' : 'fill-slate-700'}`}
                      >
                        {getRealisticNozzleLabel(sp)}
                      </text>
                      
                      {/* Flow rate */}
                      <text 
                        x={0} y={11.5 / scale} 
                        fontSize={8.5 / scale} 
                        textAnchor="middle" 
                        stroke="#ffffff" 
                        strokeWidth={2.5/scale} 
                        paintOrder="stroke" 
                        className={`font-sans font-bold pointer-events-none ${isSelected ? 'fill-emerald-700' : 'fill-slate-500'}`}
                      >
                        💧 {(sp.flowLpm * 0.06).toFixed(2).replace('.', ',')} m³/h
                      </text>
                      
                      {/* Angles start-end list or degrees */}
                      <text 
                        x={0} y={22 / scale} 
                        fontSize={8.5 / scale} 
                        textAnchor="middle" 
                        stroke="#ffffff" 
                        strokeWidth={2.5/scale} 
                        paintOrder="stroke" 
                        className={`font-sans font-semibold pointer-events-none ${isSelected ? 'fill-slate-800' : 'fill-slate-400'}`}
                      >
                        {angleLabel}
                      </text>
                      
                      {/* Throw radius distance in meters */}
                      <text 
                        x={0} y={32.5 / scale} 
                        fontSize={8.5 / scale} 
                        textAnchor="middle" 
                        stroke="#ffffff" 
                        strokeWidth={2.5/scale} 
                        paintOrder="stroke" 
                        className={`font-sans font-black pointer-events-none ${isSelected ? 'fill-slate-950 font-black' : 'fill-slate-600'}`}
                      >
                        {(sp.r / PIXELS_PER_METER).toFixed(1).replace('.', ',')} m
                      </text>
                    </g>
                  </g>
                 </g>
                );
              })}

              {/* Radius Drag Handle for selected sprinkler */}
              {selectedSprinklerIdx !== null && sprinklers[selectedSprinklerIdx] && (
                (() => {
                  const sp = sprinklers[selectedSprinklerIdx];
                  // Let's place the handle at the edge of the sector (angleStart + half angle)
                  const handleAngle = sp.angleStart + (sp.angleDeg * Math.PI / 360);
                  const handleX = sp.x + sp.r * Math.cos(handleAngle);
                  const handleY = sp.y + sp.r * Math.sin(handleAngle);
                  return (
                    <g key={`selected-guides-${selectedSprinklerIdx}`}>
                      {/* Interactive visual guide circle showing complete 360° possible coverage (Wurfkreis) */}
                      <circle 
                        cx={sp.x} cy={sp.y} r={sp.r} 
                        fill="none" 
                        stroke="#0ea5e9" 
                        strokeWidth={1.5 / scale} 
                        strokeDasharray={`${5/scale},${5/scale}`} 
                        opacity={0.35} 
                        className="pointer-events-none"
                      />
                      
                      {/* Connection Line of current radius */}
                      <line 
                        x1={sp.x} y1={sp.y} x2={handleX} y2={handleY} 
                        stroke="#0ea5e9" strokeWidth={2 / scale} strokeDasharray={`${3/scale},${3/scale}`} 
                      />
                      
                      {/* Ripple visual indicator behind radius knob */}
                      <circle 
                        cx={handleX} cy={handleY} r={16 / scale} 
                        className="fill-sky-500/10 animate-ping pointer-events-none" 
                      />
                      
                      {/* Actual visual knob (Radius) */}
                      <circle 
                        cx={handleX} cy={handleY} r={8 / scale} 
                        className="fill-sky-600 stroke-white cursor-ew-resize hover:fill-sky-700 hover:scale-125 transition-transform shadow-lg" 
                        strokeWidth={2.5 / scale}
                      />
                      
                      {/* Large invisible padding hit segment for finger or point-dragging */}
                      <circle 
                        cx={handleX} cy={handleY} r={Math.max(28, 28 / scale)} 
                        className="fill-transparent cursor-ew-resize"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setIsDraggingRadius(true);
                        }}
                      />
 
                      {/* Live text tag directly on the image next to the knob */}
                      <g transform={`translate(${handleX}, ${handleY - 16/scale})`}>
                        <rect 
                          x={-28 / scale} y={-8 / scale} width={56 / scale} height={16 / scale} rx={4 / scale}
                          className="fill-slate-900/90 stroke-white" strokeWidth={1 / scale}
                        />
                        <text 
                          x={0} y={3 / scale} fontSize={10 / scale} textAnchor="middle" fontWeight="black" fill="white"
                          className="pointer-events-none font-sans"
                        >
                          {(sp.r / PIXELS_PER_METER).toFixed(1).replace('.', ',')} m
                        </text>
                      </g>
                    </g>
                  );
                })()
              )}
 
              {/* Angle Drag Handle for selected sprinkler */}
              {selectedSprinklerIdx !== null && sprinklers[selectedSprinklerIdx] && (
                (() => {
                  const sp = sprinklers[selectedSprinklerIdx];
                  if (sp.angleDeg >= 359) return null; // No angle handle needed for full 360 degree circle
                  const angleHandleX = sp.x + sp.r * Math.cos(sp.angleEnd);
                  const angleHandleY = sp.y + sp.r * Math.sin(sp.angleEnd);
                  return (
                    <g key={`selected-angle-guides-${selectedSprinklerIdx}`}>
                      {/* Line of target angle limit */}
                      <line 
                        x1={sp.x} y1={sp.y} x2={angleHandleX} y2={angleHandleY} 
                        stroke="#64748b" strokeWidth={2 / scale} strokeDasharray={`${3/scale},${3/scale}`} 
                      />
                      
                      {/* Pulse visual indicator behind angle knob */}
                      <circle 
                        cx={angleHandleX} cy={angleHandleY} r={16 / scale} 
                        className="fill-slate-500/10 animate-pulse pointer-events-none" 
                      />
                      
                      {/* Actual visual knob (Angle) */}
                      <circle 
                        cx={angleHandleX} cy={angleHandleY} r={8 / scale} 
                        className="fill-slate-700 stroke-white cursor-pointer hover:fill-slate-800 hover:scale-125 transition-transform shadow-lg" 
                        strokeWidth={2.5 / scale}
                      />
                      
                      {/* Large invisible padding hit segment for finger or point-dragging */}
                      <circle 
                        cx={angleHandleX} cy={angleHandleY} r={Math.max(28, 28 / scale)} 
                        className="fill-transparent cursor-pointer"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setIsDraggingAngle(true);
                        }}
                      />
 
                      {/* Live text tag directly on the image next to the angle knob */}
                      <g transform={`translate(${angleHandleX}, ${angleHandleY + 22/scale})`}>
                        <rect 
                          x={-28 / scale} y={-8 / scale} width={56 / scale} height={16 / scale} rx={4 / scale}
                          className="fill-slate-800/90 stroke-white" strokeWidth={1 / scale}
                        />
                        <text 
                          x={0} y={3 / scale} fontSize={10 / scale} textAnchor="middle" fontWeight="black" fill="white"
                          className="pointer-events-none font-sans"
                        >
                          {Math.round(sp.angleDeg)}°
                        </text>
                      </g>
                    </g>
                  );
                })()
              )}

              {/* Angle Drag Handle for selected sprinkler (Start angle) */}
              {selectedSprinklerIdx !== null && sprinklers[selectedSprinklerIdx] && (
                (() => {
                  const sp = sprinklers[selectedSprinklerIdx];
                  if (sp.angleDeg >= 359) return null; // No angle handle needed for full 360 degree circle
                  const angleStartHandleX = sp.x + sp.r * Math.cos(sp.angleStart);
                  const angleStartHandleY = sp.y + sp.r * Math.sin(sp.angleStart);
                  return (
                    <g key={`selected-angle-start-guides-${selectedSprinklerIdx}`}>
                      {/* Line of target angle limit (Start) */}
                      <line 
                        x1={sp.x} y1={sp.y} x2={angleStartHandleX} y2={angleStartHandleY} 
                        stroke="#475569" strokeWidth={2 / scale} strokeDasharray={`${3/scale},${3/scale}`} 
                      />
                      
                      {/* Pulse visual indicator behind angle start knob */}
                      <circle 
                        cx={angleStartHandleX} cy={angleStartHandleY} r={16 / scale} 
                        className="fill-slate-500/10 animate-pulse pointer-events-none" 
                      />
                      
                      {/* Actual visual knob (Angle Start) */}
                      <circle 
                        cx={angleStartHandleX} cy={angleStartHandleY} r={8 / scale} 
                        className="fill-slate-600 stroke-white cursor-pointer hover:fill-slate-700 hover:scale-125 transition-transform shadow-lg" 
                        strokeWidth={2.5 / scale}
                      />
                      
                      {/* Large invisible padding hit segment for finger or point-dragging */}
                      <circle 
                        cx={angleStartHandleX} cy={angleStartHandleY} r={Math.max(28, 28 / scale)} 
                        className="fill-transparent cursor-pointer"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setIsDraggingAngleStart(true);
                        }}
                      />
 
                      {/* Live text tag next to the start angle knob */}
                      <g transform={`translate(${angleStartHandleX}, ${angleStartHandleY - 22/scale})`}>
                        <rect 
                          x={-28 / scale} y={-8 / scale} width={56 / scale} height={16 / scale} rx={4 / scale}
                          className="fill-slate-700/90 stroke-white" strokeWidth={1 / scale}
                        />
                        <text 
                          x={0} y={3 / scale} fontSize={10 / scale} textAnchor="middle" fontWeight="black" fill="white"
                          className="pointer-events-none font-sans"
                        >
                          Start
                        </text>
                      </g>
                    </g>
                  );
                })()
              )}
              {shapes.filter(s => s.type === 'polygon' || s.type === 'rectangle').flatMap(s => {
                  let pts = s.points;
                  if (s.type === 'rectangle') {
                      const minX = Math.min(pts[0].x, pts[1].x);
                      const maxX = Math.max(pts[0].x, pts[1].x);
                      const minY = Math.min(pts[0].y, pts[1].y);
                      const maxY = Math.max(pts[0].y, pts[1].y);
                      pts = [ {x:minX,y:minY}, {x:maxX,y:minY}, {x:maxX,y:maxY}, {x:minX,y:maxY} ];
                  }
                  return pts.map((p, i) => {
                     let nextP = pts[(i + 1) % pts.length];
                     let dx = nextP.x - p.x;
                     let dy = nextP.y - p.y;
                     let cx = p.x + dx / 2;
                     let cy = p.y + dy / 2;
                     let m = (Math.hypot(dx, dy) / PIXELS_PER_METER).toFixed(1);
                     return (
                         <text key={`shape-${s.id}-len-${i}`} x={cx} y={cy} fontSize={14/scale} fill="#16a34a" fontWeight="bold" textAnchor="middle" stroke="white" strokeWidth={4/scale} paintOrder="stroke" className="pointer-events-none drop-shadow-sm">
                            {m}m
                         </text>
                     );
                  });
              })}

              {/* Edge Lengths for Current Drawing */}
              {tool === 'polygon' && currentShape.length > 0 && currentShape.map((p, i) => {
                 let nextP = currentShape[i + 1] || hoverPos;
                 if (!nextP) return null;
                 let dx = nextP.x - p.x;
                 let dy = nextP.y - p.y;
                 let cx = p.x + dx / 2;
                 let cy = p.y + dy / 2;
                 let m = (Math.hypot(dx, dy) / PIXELS_PER_METER).toFixed(1);
                 return (
                     <text key={`curr-len-${i}`} x={cx} y={cy} fontSize={14/scale} fill="#16a34a" fontWeight="bold" textAnchor="middle" stroke="white" strokeWidth={4/scale} paintOrder="stroke" className="pointer-events-none drop-shadow-sm">
                        {m}m
                     </text>
                 );
              })}

              {/* Infrastructures */}
              {infraNodes.map(node => (
                <g key={node.id} transform={`translate(${node.pos.x}, ${node.pos.y})`} className="cursor-pointer">
                  {node.type === 'water_source' && (
                    <>
                      <circle cx="0" cy="0" r={16 / scale} className="fill-blue-500 shadow-md" />
                      <Droplet className="w-4 h-4 text-white" x={-8/scale} y={-8/scale} width={16/scale} height={16/scale} />
                    </>
                  )}
                  {node.type === 'controller' && (
                    <>
                      <rect x={-16/scale} y={-16/scale} width={32/scale} height={32/scale} rx={4/scale} className="fill-purple-500" />
                      <Cpu className="w-4 h-4 text-white" x={-8/scale} y={-8/scale} width={16/scale} height={16/scale} />
                    </>
                  )}
                  {node.type === 'valve_box' && (
                    <>
                      <rect x={-16/scale} y={-16/scale} width={32/scale} height={32/scale} rx={4/scale} className="fill-amber-500" />
                      <Box className="w-4 h-4 text-white" x={-8/scale} y={-8/scale} width={16/scale} height={16/scale} />
                    </>
                  )}
                </g>
              ))}

            </g>
          </svg>
        </div>

        {/* Tutorial Overlay */}
        <AnimatePresence>
          {step === 'start_choice' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-50/98 backdrop-blur-md px-3 sm:px-4 py-8 overflow-y-auto"
            >
              <div className="max-w-xl w-full text-center space-y-5 sm:space-y-6 select-none p-1 shrink-0 my-auto">
                <div className="space-y-2">
                  <div className="inline-flex w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl items-center justify-center border border-emerald-100 shadow-sm">
                    <Droplet className="w-5 h-5 animate-pulse" />
                  </div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight font-sans">
                    Wie möchtest du starten?
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 max-w-sm mx-auto leading-relaxed font-sans font-medium">
                    Gestalte deinen Garten ganz frei oder nutze eine maßgetreue Skizze als Zeichenvorlage.
                  </p>
                </div>

                <div className="grid gap-3.5 sm:grid-cols-2 max-w-lg mx-auto">
                  <button 
                    onClick={() => {
                      setStep('draw');
                      setTool('polygon');
                      setShowIntro(true);
                    }}
                    type="button"
                    className="flex flex-col items-center text-center p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:shadow-xl hover:scale-[1.01] shadow-sm transition-all duration-200 cursor-pointer group space-y-4"
                  >
                    <div className="w-11 h-11 rounded-xl bg-slate-50 text-emerald-600 flex items-center justify-center border border-slate-100 group-hover:scale-105 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-all">
                      <PenTool className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 font-sans tracking-wide">Frei einzeichnen</h3>
                      <p className="text-[11px] text-slate-500 leading-normal font-sans">
                        Starte direkt auf dem leeren Konstruktionsraster und zeichne deine Gartenflächen ein.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-55 px-2.5 py-0.5 rounded-full border border-emerald-100/50 group-hover:bg-emerald-100/60 transition-colors">
                      Einfach starten
                    </span>
                  </button>

                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                    className="flex flex-col items-center text-center p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:shadow-xl hover:scale-[1.01] shadow-sm transition-all duration-200 cursor-pointer group space-y-4"
                  >
                    <div className="w-11 h-11 rounded-xl bg-slate-50 text-emerald-600 flex items-center justify-center border border-slate-100 group-hover:scale-105 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-all">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 font-sans tracking-wide">Plan hochladen</h3>
                      <p className="text-[11px] text-slate-500 leading-normal font-sans">
                        Lade ein Skizzenfoto oder JPG hoch, um deine Flächen maßgetreu nachzuzeichnen.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-55 px-2.5 py-0.5 rounded-full border border-emerald-100/50 group-hover:bg-emerald-100/60 transition-colors">
                      JPG / PNG hochladen
                    </span>
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={onBack}
                    type="button"
                    className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 shadow-sm rounded-xl font-bold transition-all text-xs cursor-pointer"
                  >
                    Zurück zum Shop
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'planning_choice' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-50/98 backdrop-blur-md px-3 sm:px-4 py-8 overflow-y-auto"
            >
              <div className="max-w-xl w-full text-center space-y-5 sm:space-y-6 select-none p-1 shrink-0 my-auto">
                <div className="space-y-2">
                  <div className="inline-flex w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl items-center justify-center border border-emerald-100 shadow-sm">
                    <Cpu className="w-5 h-5 animate-pulse" />
                  </div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight font-sans">
                    Planungsmethode wählen
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 max-w-sm mx-auto leading-relaxed font-sans font-medium">
                    Möchtest du Rohrleitungen manuell verlegen oder die intelligente Komplettplanung anwenden?
                  </p>
                </div>

                <div className="grid gap-3.5 sm:grid-cols-2 max-w-lg mx-auto">
                  <button 
                    onClick={() => {
                      setStep('irrigation_manual');
                      setTool('add_sprinkler');
                    }}
                    type="button"
                    className="flex flex-col items-center text-center p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:shadow-xl hover:scale-[1.01] shadow-sm transition-all duration-200 cursor-pointer group space-y-4"
                  >
                    <div className="w-11 h-11 rounded-xl bg-slate-50 text-emerald-600 flex items-center justify-center border border-slate-100 group-hover:scale-105 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-all">
                      <Hand className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 font-sans tracking-wide">Manuelle Komplettplanung</h3>
                      <p className="text-[11px] text-slate-500 leading-normal font-sans">
                        Platziere Regner, PE-Zuleitungen, Tropfschläuche & Steuergeräte frei nach deinen Vorstellungen.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-55 px-2.5 py-0.5 rounded-full border border-emerald-100/50 group-hover:bg-emerald-100/60 transition-colors">
                      Eigene Platzierung
                    </span>
                  </button>

                  <button 
                    onClick={() => {
                      setStep('infrastructure');
                      setTool('water_source');
                    }}
                    type="button"
                    className="flex flex-col items-center text-center p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:shadow-xl hover:scale-[1.01] shadow-sm transition-all duration-200 cursor-pointer group space-y-4"
                  >
                    <div className="w-11 h-11 rounded-xl bg-slate-50 text-emerald-600 flex items-center justify-center border border-slate-100 group-hover:scale-105 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-all">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 font-sans tracking-wide">Automatische Planung</h3>
                      <p className="text-[11px] text-slate-500 leading-normal font-sans">
                        Setze Wasserquelle & Reglerbox. Den Rest erledigt das System vollautomatisch für dich.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-55 px-2.5 py-0.5 rounded-full border border-emerald-100/50 group-hover:bg-emerald-100/60 transition-colors">
                      Assistent (Empfohlen)
                    </span>
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setStep('draw')}
                    type="button"
                    className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 shadow-sm rounded-xl font-bold transition-all text-xs cursor-pointer"
                  >
                    Zurück zum Garten-Plan
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'irrigation_choice' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-50/98 backdrop-blur-md px-3 sm:px-4 py-8 overflow-y-auto"
            >
              <div className="max-w-xl w-full text-center space-y-5 sm:space-y-6 select-none p-1 shrink-0 my-auto">
                <div className="space-y-2">
                  <div className="inline-flex w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl items-center justify-center border border-emerald-100 shadow-sm">
                    <Droplet className="w-5 h-5 animate-pulse" />
                  </div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight font-sans">
                    Komponenten-Bestückung
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 max-w-sm mx-auto leading-relaxed font-sans font-medium">
                    Wie sollen Regner, Tropfschläuche und Anschlussboxen platziert werden?
                  </p>
                </div>

                <div className="grid gap-3.5 sm:grid-cols-2 max-w-lg mx-auto">
                  <button 
                    onClick={() => {
                      setStep('irrigation_manual');
                      setTool('add_sprinkler');
                    }}
                    type="button"
                    className="flex flex-col items-center text-center p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:shadow-xl hover:scale-[1.01] shadow-sm transition-all duration-200 cursor-pointer group space-y-4"
                  >
                    <div className="w-11 h-11 rounded-xl bg-slate-50 text-emerald-600 flex items-center justify-center border border-slate-100 group-hover:scale-105 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-all">
                      <Hand className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 font-sans tracking-wide">Manuell platzieren</h3>
                      <p className="text-[11px] text-slate-500 leading-normal font-sans">
                        Platziere jeden Regner, Tiefenbewässerungen & Tropfschläuche ganz individuell.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-55 px-2.5 py-0.5 rounded-full border border-emerald-100/50 group-hover:bg-emerald-100/60 transition-colors">
                      Eigene Aufteilung
                    </span>
                  </button>

                  <button 
                    onClick={() => {
                      runCalculation();
                    }}
                    type="button"
                    className="flex flex-col items-center text-center p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:shadow-xl hover:scale-[1.01] shadow-sm transition-all duration-200 cursor-pointer group space-y-4"
                  >
                    <div className="w-11 h-11 rounded-xl bg-slate-50 text-emerald-600 flex items-center justify-center border border-slate-100 group-hover:scale-105 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-all">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 font-sans tracking-wide">Automatisch bestücken</h3>
                      <p className="text-[11px] text-slate-500 leading-normal font-sans">
                        Lass das System deine Leitungen analysieren und Verbraucher optimal darauf platzieren.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-55 px-2.5 py-0.5 rounded-full border border-emerald-100/50 group-hover:bg-emerald-100/60 transition-colors">
                      Smart Bestücken
                    </span>
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setStep('pipeline_drawing')}
                    type="button"
                    className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 shadow-sm rounded-xl font-bold transition-all text-xs cursor-pointer"
                  >
                    Zurück zur Leitungsplanung
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {showIntro && (
            <motion.div 
              initial={{opacity: 0, scale: 0.95}} 
              animate={{opacity: 1, scale: 1}} 
              exit={{opacity: 0, scale: 0.95}}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            >
              <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5">
                    <PenTool className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 mb-3">Zeichne dein Paradies</h2>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    Willkommen im Bewässerungsplaner! Nutze die Werkzeuge auf der linken Seite, um deine Rasenflächen einzuzeichnen.
                  </p>
                  
                  <div className="grid sm:grid-cols-2 gap-4 text-left mb-8">
                    <div className="flex gap-3 items-start bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <MousePointer2 className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-sm text-gray-900">Punkte setzen</h4>
                        <p className="text-xs text-gray-500 mt-1">Klicke nacheinander, um eine freie Form (Polygon) zu erzeugen.</p>
                      </div>
                    </div>
                    <div className="flex gap-3 items-start bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <ZoomIn className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-sm text-gray-900">Zoomen & Bewegen</h4>
                        <p className="text-xs text-gray-500 mt-1">Mausrad zum Zoomen, 2-Finger am Handy. Nutze die Hand, um das Raster zu verschieben.</p>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowIntro(false)}
                    className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 transition-colors shadow-md hover:shadow-lg"
                  >
                    Verstanden, loslegen!
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {pendingArea && (
            <motion.div 
               initial={{opacity: 0, scale: 0.95}} 
               animate={{opacity: 1, scale: 1}} 
               exit={{opacity: 0, scale: 0.95}}
               className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            >
               <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Flächentyp auswählen</h3>
                  <div className="space-y-3">
                     <button onClick={() => { setShapes([...shapes, { id: Date.now().toString(), type: pendingArea.type, points: pendingArea.points, color: '#10b981', areaType: 'lawn' }]); setPendingArea(null); }} className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-colors text-left">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><CircleDot className="w-5 h-5"/></div>
                        <div><div className="font-bold text-gray-900">Rasen (Regner)</div><div className="text-xs text-gray-500">Für Versenkregner (MP Rotator)</div></div>
                     </button>
                     <button onClick={() => { setShapes([...shapes, { id: Date.now().toString(), type: pendingArea.type, points: pendingArea.points, color: '#f59e0b', areaType: 'bed' }]); setPendingArea(null); }} className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-amber-500 hover:bg-amber-50 transition-colors text-left">
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center"><Flower2 className="w-5 h-5"/></div>
                        <div><div className="font-bold text-gray-900">Beet (Tropfrohr)</div><div className="text-xs text-gray-500">Für Tropfschlauch/Micro-Drip</div></div>
                     </button>
                     {pendingArea.type === 'circle' && (
                        <button onClick={() => { setShapes([...shapes, { id: Date.now().toString(), type: pendingArea.type, points: pendingArea.points, color: '#166534', areaType: 'tree' }]); setPendingArea(null); }} className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-green-700 hover:bg-green-50 transition-colors text-left">
                           <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center"><Trees className="w-5 h-5"/></div>
                           <div><div className="font-bold text-gray-900">Baum (Wurzelbewässerung RZWS)</div><div className="text-xs text-gray-500">Hunter RZWS Wurzelbewässerungssystem</div></div>
                        </button>
                     )}
                  </div>
                  <button onClick={() => setPendingArea(null)} className="mt-4 w-full text-center text-sm font-medium text-gray-500 hover:text-gray-900 p-2">Abbrechen</button>
               </div>
            </motion.div>
          )}

          {pendingInfra && (
             <motion.div 
               initial={{opacity: 0, scale: 0.95}} 
               animate={{opacity: 1, scale: 1}} 
               exit={{opacity: 0, scale: 0.95}}
               className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
             >
                <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
                   <h3 className="text-lg font-bold text-gray-900 mb-4">Wasserquelle Details</h3>
                   <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      setInfraNodes([...infraNodes, {
                         id: Date.now().toString(), type: 'water_source', pos: pendingInfra, details: {
                            sourceType: formData.get('sourceType'), pressure: formData.get('pressure')
                         }
                      }]);
                      setPendingInfra(null);
                      setTool('pan');
                   }}>
                      <div className="mb-4">
                         <label className="block text-sm font-bold text-gray-700 mb-2">Art der Wasserquelle</label>
                         <select name="sourceType" className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none cursor-pointer">
                           <option value="fresh">Frischwasser (Hausanschluss)</option>
                           <option value="cistern">Zisterne mit Pumpe</option>
                           <option value="well">Brunnenwasser</option>
                         </select>
                      </div>
                      <div className="mb-6">
                         <label className="block text-sm font-bold text-gray-700 mb-2">Wasserdruck (Bar)</label>
                         <input type="number" name="pressure" step="0.1" defaultValue="3.5" min="1" max="10" className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"/>
                         <p className="text-xs text-gray-500 mt-1">Für Hunter MP Rotator sollten mindestens 2,5 Bar am Regner anliegen (Empfehlung 2,8 Bar).</p>
                      </div>
                      <div className="flex gap-3">
                         <button type="button" onClick={() => setPendingInfra(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200">Abbrechen</button>
                         <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-md">Speichern</button>
                      </div>
                   </form>
                </div>
             </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

```javascript
import React, { useState, useRef, useEffect } from 'react';
import { 
  Square, Minus, MousePointer2, Trash2, 
  Undo2, Hexagon, RotateCcw, ZoomIn, ZoomOut, Hand, X, FlipVertical,
  Crosshair
} from 'lucide-react';

const LOGICAL_HEIGHT_CM = 30;
const PIXELS_PER_CM = 20; 
const LOGICAL_H = LOGICAL_HEIGHT_CM * PIXELS_PER_CM; 
const SNAP_DIST = 10;
const CM_TO_INCH = 0.393701;

const THEME_ORANGE = "#FF6D00"; 
const BLUE_PURE = "#0000FF";
const BLUE_MEDIUM = "#6666FF";
const BLUE_LIGHT = "#CCCCFF";
const BLUE_ULTRA_LIGHT = "#F5F5FF";

const App = () => {
  const [mode, setMode] = useState('line'); 
  const [thickness, setThickness] = useState(6);
  const [unit, setUnit] = useState('metric'); 
  const [metricSubUnit, setMetricSubUnit] = useState('cm'); 
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [sides, setSides] = useState(6);
  const [lines, setLines] = useState([]);
  const [history, setHistory] = useState([]); 
  const [activeLine, setActiveLine] = useState(null);
  const [chainOrigin, setChainOrigin] = useState(null);
  const [hoverPoint, setHoverPoint] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null); 
  const [activeMiterKey, setActiveMiterKey] = useState(null);
  const [dragOffset, setDragOffset] = useState(null);
  const [showSidesPopup, setShowSidesPopup] = useState(false);
  const [sawAngle, setSawAngle] = useState(0); 
  const [miterGaugeAngle, setMiterGaugeAngle] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  
  const [isStanding, setIsStanding] = useState(false);
  const [sawWarningDismissed, setSawWarningDismissed] = useState(false);
  const [miterWarningDismissed, setMiterWarningDismissed] = useState(false);
  
  const [logicalW, setLogicalW] = useState(800); 
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const saveHistory = () => {
    setHistory(prev => [...prev.slice(-49), JSON.stringify(lines)]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setLines(JSON.parse(last));
    setHistory(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const handleResize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setLogicalW((width / height) * LOGICAL_H);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') cancelDrawing();
      if (e.key.toLowerCase() === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        undo();
      }
    };

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('keydown', handleKeyDown);
    handleResize();
    return () => {
      observer.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [history, lines]);

  const formatLen = (px) => {
    const valCm = px / PIXELS_PER_CM;
    if (unit === 'imperial') return (valCm * CM_TO_INCH).toFixed(2);
    return metricSubUnit === 'mm' ? (valCm * 10).toFixed(0) : valCm.toFixed(1);
  };

  const parseInputToPx = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return null;
    let cm = num;
    if (unit === 'imperial') cm = num / CM_TO_INCH;
    else if (metricSubUnit === 'mm') cm = num / 10;
    return cm * PIXELS_PER_CM;
  };

  const getMousePos = (e) => {
    const svg = canvasRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const transformed = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: transformed.x, y: transformed.y };
  };

  const getSnappedPos = (pos) => {
    let snapped = { ...pos };
    let minDist = SNAP_DIST / zoom;
    const gx = Math.round(pos.x / PIXELS_PER_CM) * PIXELS_PER_CM;
    const gy = Math.round(pos.y / PIXELS_PER_CM) * PIXELS_PER_CM;
    if (Math.hypot(pos.x - gx, pos.y - gy) < minDist) snapped = { x: gx, y: gy };
    lines.forEach(line => {
      const d1 = Math.hypot(pos.x - line.x1, pos.y - line.y1);
      const d2 = Math.hypot(pos.x - line.x2, pos.y - line.y2);
      if (d1 < minDist) { snapped = { x: line.x1, y: line.y1 }; minDist = d1; }
      if (d2 < minDist) { snapped = { x: line.x2, y: line.y2 }; minDist = d2; }
    });
    return snapped;
  };

  const distToSegment = (p, v, w) => {
    const l2 = Math.hypot(v.x - w.x, v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = Math.max(0, Math.min(1, ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  };

  const calculateAngles = (line, index) => {
    const getMiterData = (x, y, isStart) => {
      const connections = lines.filter((l, i) => i !== index && (Math.hypot(l.x1 - x, l.y1 - y) < 2 || Math.hypot(l.x2 - x, l.y2 - y) < 2));
      const baseAngle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
      const currentDir = isStart ? baseAngle : baseAngle + Math.PI;

      if (connections.length === 0) return { label: "90.0°", angle: 0, bisectRel: 90, labelOffsetAngle: currentDir + Math.PI/2 };
      
      const other = connections[0];
      const v1 = isStart ? { x: line.x2 - line.x1, y: line.y2 - line.y1 } : { x: line.x1 - line.x2, y: line.y1 - line.y2 };
      
      const a1 = Math.atan2(v1.y, v1.x);
      const a2 = (Math.hypot(other.x1 - x, other.y1 - y) < 2) 
        ? Math.atan2(other.y2 - other.y1, other.x2 - other.x1) 
        : Math.atan2(other.y1 - other.y2, other.x1 - other.x2);
      
      let diff = (a2 - a1) * 180 / Math.PI;
      while (diff > 180) diff -= 360; while (diff < -180) diff += 360;
      
      const theta = Math.abs(diff) * (Math.PI / 180);
      const tSelf = line.thickness || thickness;
      const tOther = other.thickness || thickness;
      
      const miterFromSide = Math.atan2(tSelf * Math.sin(theta), tOther + tSelf * Math.cos(theta));
      const sawSetting = Math.abs(90 - (miterFromSide * 180 / Math.PI));
      const bisectRel = (diff > 0) ? miterFromSide * 180 / Math.PI : -miterFromSide * 180 / Math.PI;
      
      return { 
        label: `${sawSetting.toFixed(1)}°`, 
        angle: sawSetting, 
        bisectRel: bisectRel,
        labelOffsetAngle: a1 + (diff / 2) * (Math.PI / 180) + Math.PI 
      };
    };
    return { left: getMiterData(line.x1, line.y1, true), right: getMiterData(line.x2, line.y2, false) };
  };

  const getBoardPoints = (l, mLeft, mRight, isProfile = false, lineThickness) => {
    const angle = Math.atan2(l.y2 - l.y1, l.x2 - l.x1);
    const length = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
    const h = ((lineThickness || thickness) / 20) * PIXELS_PER_CM;
    
    const getShift = (y_off, miter) => {
        if (Math.abs(miter.angle) < 0.01) return 0;
        const rad = miter.bisectRel * Math.PI / 180;
        return y_off / Math.tan(rad);
    };

    let pts = [
        { x: getShift(-h, mLeft), y: -h }, 
        { x: length + getShift(-h, mRight), y: -h }, 
        { x: length + getShift(h, mRight), y: h }, 
        { x: getShift(h, mLeft), y: h }
    ];

    if (isProfile) {
      const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
      return pts.map(p => ({ x: p.x - ((minX + maxX) / 2) + 50, y: p.y }));
    }
    return pts.map(p => ({ x: l.x1 + p.x * Math.cos(angle) - p.y * Math.sin(angle), y: l.y1 + p.x * Math.sin(angle) + p.y * Math.cos(angle) }));
  };

  const handleMouseDown = (e) => {
    const rawPos = getMousePos(e);
    const pos = getSnappedPos(rawPos);
    if (mode === 'pan') { setIsPanning(true); return; }
    
    if (mode === 'select-point') {
      const foundIdx = lines.findIndex(l => Math.hypot(rawPos.x - l.x1, rawPos.y - l.y1) < 15 || Math.hypot(rawPos.x - l.x2, rawPos.y - l.y2) < 15);
      if (foundIdx !== -1) {
        saveHistory();
        const l = lines[foundIdx];
        const pointKey = Math.hypot(rawPos.x - l.x1, rawPos.y - l.y1) < 15 ? 'p1' : 'p2';
        setSelectedPoint({ idx: foundIdx, pointKey });
      }
      return;
    }

    if (mode === 'select-obj') {
      const idx = lines.findIndex(l => distToSegment(rawPos, {x: l.x1, y: l.y1}, {x: l.x2, y: l.y2}) < 20);
      if (idx !== -1) {
        saveHistory();
        setSelectedId(idx);
        setDragOffset({ x1: lines[idx].x1 - rawPos.x, y1: lines[idx].y1 - rawPos.y, x2: lines[idx].x2 - rawPos.x, y2: lines[idx].y2 - rawPos.y });
      } else setSelectedId(null);
    } else {
      if (activeLine) {
        const { x1, y1, x2, y2, type } = activeLine;
        if (Math.hypot(x2 - x1, y2 - y1) > 5) {
          saveHistory();
          let nl = [];
          if (type === 'line') {
            nl = [{ x1, y1, x2, y2, thickness }]; setLines([...lines, ...nl]);
            if (chainOrigin && Math.hypot(x2 - chainOrigin.x, y2 - chainOrigin.y) < 5) { cancelDrawing(); }
            else setActiveLine({ x1: x2, y1: y2, x2, y2, type: 'line', thickness });
            return;
          } else if (type === 'rect') {
            nl = [{ x1: x1, y1: y1, x2: x2, y2: y1, thickness }, { x1: x2, y1: y1, x2: x2, y2: y2, thickness }, { x1: x2, y1: y2, x2: x1, y2: y2, thickness }, { x1: x1, y1: y2, x2: x1, y2: y1, thickness }];
          } else if (type === 'polygon') {
            const r = Math.hypot(x2-x1, y2-y1)/2, cx = (x1+x2)/2, cy = (y1+y2)/2;
            const pts = Array.from({length: sides}, (_, i) => ({ x: cx + r * Math.cos(i * (360/sides) * Math.PI / 180), y: cy + r * Math.sin(i * (360/sides) * Math.PI / 180) }));
            for(let i=0; i<sides; i++) nl.push({x1: pts[i].x, y1: pts[i].y, x2: pts[(i+1)%sides].x, y2: pts[(i+1)%sides].y, thickness});
          }
          setLines([...lines, ...nl]);
        }
        cancelDrawing();
      } else {
        setActiveLine({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, type: mode, thickness });
        if (mode === 'line') setChainOrigin({ x: pos.x, y: pos.y });
      }
    }
  };

  const handleMouseMove = (e) => {
    const rawPos = getMousePos(e);
    const snapped = getSnappedPos(rawPos);
    setHoverPoint(snapped);
    if (isPanning) { setPanOffset(prev => ({ x: prev.x + e.movementX / zoom, y: prev.y + e.movementY / zoom })); return; }
    
    if (selectedPoint) {
      const { idx, pointKey } = selectedPoint;
      setLines(lines.map((l, i) => {
        if (i !== idx) return l;
        return pointKey === 'p1' ? { ...l, x1: snapped.x, y1: snapped.y } : { ...l, x2: snapped.x, y2: snapped.y };
      }));
      return;
    }

    if (activeLine) setActiveLine(prev => ({ ...prev, x2: snapped.x, y2: snapped.y }));
    else if (mode === 'select-obj' && selectedId !== null && dragOffset) {
      setLines(lines.map((l, i) => i === selectedId ? { ...l, x1: rawPos.x + dragOffset.x1, y1: rawPos.y + dragOffset.y1, x2: rawPos.x + dragOffset.x2, y2: rawPos.y + dragOffset.y2 } : l));
    }
  };

  const handleMouseUp = () => { setIsPanning(false); setDragOffset(null); setSelectedPoint(null); };

  const handleAngleSelection = (angle, key) => {
    setSawAngle(angle); setMiterGaugeAngle(angle);
    setActiveMiterKey(key);
    setSawWarningDismissed(false); setMiterWarningDismissed(false);
    if (angle <= 45) setIsStanding(false);
  };

  const cancelDrawing = () => { setActiveLine(null); setChainOrigin(null); setShowSidesPopup(false); };

  const renderRulers = () => {
    const ticks = [];
    const baseInterval = unit === 'metric' ? PIXELS_PER_CM : PIXELS_PER_CM / CM_TO_INCH;
    const isMM = unit === 'metric' && metricSubUnit === 'mm';
    for (let i = -2000; i < 4000; i += baseInterval / 10) {
      const val = Math.round(isMM ? (i/baseInterval)*10 : i/baseInterval);
      if (val === 0) continue; 
      const isMajor = Math.round(i / (baseInterval / 10)) % 10 === 0;
      if (isMajor) {
        ticks.push(<g key={`h-${i}`}><line x1={i} y1={0} x2={i} y2={8} stroke={BLUE_LIGHT} strokeWidth={1/zoom} /><text x={i + 2/zoom} y={10/zoom} fill={BLUE_MEDIUM} fontSize={6/zoom} fontWeight="bold">{val}</text></g>);
        ticks.push(<g key={`v-${i}`}><line x1={0} y1={i} x2={8} y2={i} stroke={BLUE_LIGHT} strokeWidth={1/zoom} /><text x={12/zoom} y={i + 2.5/zoom} fill={BLUE_MEDIUM} fontSize={6/zoom} fontWeight="bold" textAnchor="start">{val}</text></g>);
      }
    }
    return ticks;
  };

  const getCanvasCursor = () => {
    if (isPanning) return 'grabbing';
    if (mode === 'pan') return 'grab';
    const rawPos = hoverPoint; 
    if (rawPos && mode === 'select-obj') {
        const foundIdx = lines.findIndex(l => distToSegment(rawPos, {x: l.x1, y: l.y1}, {x: l.x2, y: l.y2}) < 20);
        if (foundIdx !== -1) return 'pointer';
    }
    return 'crosshair';
  };

  const updateLineLength = (idx, newLenPx) => {
    if (newLenPx === null || newLenPx <= 0) return;
    saveHistory();
    const l = lines[idx];
    const angle = Math.atan2(l.y2 - l.y1, l.x2 - l.x1);
    const nl = [...lines];
    nl[idx] = { ...l, x2: l.x1 + newLenPx * Math.cos(angle), y2: l.y1 + newLenPx * Math.sin(angle) };
    setLines(nl);
  };

  const updateLineThickness = (idx, thick) => {
    saveHistory();
    setLines(lines.map((l, i) => i === idx ? { ...l, thickness: thick } : l));
  };

  const HalftoneWoodPattern = () => (
    <pattern id="halftone-wood" width="2" height="2" patternUnits="userSpaceOnUse">
      <rect x="0.2" y="0.2" width="0.6" height="0.6" fill={BLUE_PURE} opacity="0.4" />
      <rect x="1.2" y="1.2" width="0.6" height="0.6" fill={BLUE_PURE} opacity="0.4" />
    </pattern>
  );

  const ToolBtn = ({ icon, label, active, onClick, children }) => (
    <div className="relative group">
        <button onClick={onClick} className={`p-2 w-full rounded-xl flex flex-col items-center justify-center gap-1 transition-all border shadow-sm h-16 min-h-[64px]`} style={{ backgroundColor: active ? BLUE_PURE : 'white', color: active ? 'white' : BLUE_PURE, borderColor: active ? BLUE_PURE : BLUE_LIGHT }}>
            {icon}<span className="text-[8px] font-black uppercase text-center leading-none mt-1">{label}</span>
        </button>
        {children}
    </div>
  );

  return (
    <div className="flex flex-col h-screen font-['Space_Grotesk'] p-4 overflow-hidden select-none" style={{ backgroundColor: BLUE_ULTRA_LIGHT, color: BLUE_PURE }}>
      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="w-28 flex flex-col items-stretch gap-2 bg-white p-3 rounded-2xl border shadow-sm relative z-50 overflow-visible" style={{ borderColor: BLUE_LIGHT }}>
          <ToolBtn active={mode === 'select-obj'} onClick={() => { setMode('select-obj'); cancelDrawing(); }} icon={<MousePointer2 size={18}/>} label="SELECT OBJECT" />
          <ToolBtn active={mode === 'select-point'} onClick={() => { setMode('select-point'); cancelDrawing(); }} icon={<Crosshair size={18}/>} label="SELECT POINT" />
          <hr className="my-1" style={{ borderColor: BLUE_ULTRA_LIGHT }} />
          <ToolBtn active={mode === 'line'} onClick={() => setMode('line')} icon={<Minus size={18}/>} label="LINE" />
          <ToolBtn active={mode === 'rect'} onClick={() => setMode('rect')} icon={<Square size={18}/>} label="RECTANGLE" />
          <ToolBtn active={mode === 'polygon'} onClick={() => { setMode('polygon'); setShowSidesPopup(!showSidesPopup); }} icon={<Hexagon size={18}/>} label={`POLYGON (${sides})`}>
            {showSidesPopup && (
              <div className="absolute left-full top-0 ml-4 p-3 rounded-xl shadow-2xl flex flex-col items-center gap-2 z-[70] border bg-white min-w-[80px]" style={{ borderColor: BLUE_PURE }}>
                <label className="text-[10px] font-black uppercase text-blue-600">Sides</label>
                <input autoFocus type="number" min="3" max="24" value={sides} onChange={e => setSides(Math.max(3, Number(e.target.value)))} className="w-full border text-center font-bold text-sm outline-none rounded p-1" style={{ borderColor: BLUE_LIGHT, color: BLUE_PURE }} />
                <button onClick={() => setShowSidesPopup(false)} className="w-full text-[10px] font-black py-1 rounded text-white" style={{ backgroundColor: BLUE_PURE }}>SET</button>
              </div>
            )}
          </ToolBtn>
          <hr className="my-1" style={{ borderColor: BLUE_ULTRA_LIGHT }} />
          <ToolBtn onClick={undo} icon={<Undo2 size={18}/>} label="UNDO" />
          <ToolBtn onClick={() => { saveHistory(); setLines([]); }} icon={<Trash2 size={18} style={{color: THEME_ORANGE}}/>} label="CLEAR" />
          <div className="mt-auto flex flex-col gap-2 p-2 rounded-xl border bg-white" style={{ backgroundColor: BLUE_ULTRA_LIGHT, borderColor: BLUE_LIGHT }}>
             <button onClick={() => setUnit(unit === 'metric' ? 'imperial' : 'metric')} className="text-[10px] font-bold bg-white px-1 py-2 rounded shadow-sm border uppercase w-full" style={{ color: BLUE_PURE, borderColor: BLUE_LIGHT }}>{unit === 'metric' ? 'Metric' : 'Imp'}</button>
             <div className="flex items-center justify-center gap-1 border-t pt-2" style={{ borderColor: BLUE_LIGHT }}>
                <input type="number" value={thickness} onChange={e => setThickness(Number(e.target.value))} className="w-full text-center bg-transparent font-bold text-[12px] outline-none" style={{ color: BLUE_PURE }} />
                <span className="text-[10px] font-bold text-blue-400">mm</span>
             </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="flex flex-1 gap-4 overflow-hidden">
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                <div ref={containerRef} className="flex-[2] relative bg-white border rounded-3xl shadow-inner overflow-hidden" style={{ borderColor: BLUE_LIGHT }}>
                  <div className="w-full h-full relative" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} style={{ cursor: getCanvasCursor() }}>
                    <svg ref={canvasRef} viewBox={`${-panOffset.x} ${-panOffset.y} ${logicalW/zoom} ${LOGICAL_H/zoom}`} className="w-full h-full absolute inset-0 pointer-events-auto">
                      <defs>
                        <pattern id="grid" width={20} height={20} patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke={BLUE_LIGHT} strokeWidth="0.4"/></pattern>
                        <HalftoneWoodPattern />
                      </defs>
                      <rect width="20000" height="20000" x="-10000" y="-10000" fill="url(#grid)" pointerEvents="all" />
                      {renderRulers()}
                      {lines.map((l, i) => {
                        const angles = calculateAngles(l, i);
                        const polyPts = getBoardPoints(l, angles.left, angles.right, false, l.thickness);
                        const isSelected = selectedId === i;
                        
                        const renderMiterLabel = (x, y, miter, sideKey) => {
                            const pushDist = 24 / zoom;
                            const lx = x + pushDist * Math.cos(miter.labelOffsetAngle);
                            const ly = y + pushDist * Math.sin(miter.labelOffsetAngle);
                            const miterKey = `${i}-${sideKey}`;
                            const isMiterActive = activeMiterKey === miterKey;
                            
                            // Dimensions calculated to stay roughly constant on screen
                            const rectW = 32 / zoom;
                            const rectH = 16 / zoom;
                            const fs = 8 / zoom;

                            return (
                              <g className="pointer-events-auto cursor-pointer" key={miterKey} onClick={(e) => { e.stopPropagation(); handleAngleSelection(miter.angle, miterKey); }}>
                                 <rect x={lx - rectW/2} y={ly - rectH/2} width={rectW} height={rectH} rx={4/zoom} fill={isMiterActive ? THEME_ORANGE : "white"} stroke={THEME_ORANGE} strokeWidth={1/zoom} />
                                 <text x={lx} y={ly} dominantBaseline="middle" textAnchor="middle" fill={isMiterActive ? "white" : THEME_ORANGE} fontSize={fs} fontWeight="800" className="select-none">{miter.label}</text>
                              </g>
                            );
                        };

                        return (
                          <g key={i}>
                            <polygon points={polyPts.map(p => `${p.x},${p.y}`).join(' ')} fill="url(#halftone-wood)" className="pointer-events-none" />
                            <polygon points={polyPts.map(p => `${p.x},${p.y}`).join(' ')} fill={isSelected ? `${THEME_ORANGE}15` : BLUE_ULTRA_LIGHT} fillOpacity={isSelected ? 1 : 0.4} stroke={isSelected ? THEME_ORANGE : BLUE_MEDIUM} strokeWidth={isSelected ? 2/zoom : 1.5/zoom} className="pointer-events-none" />
                            {renderMiterLabel(l.x1, l.y1, angles.left, 'left')} {renderMiterLabel(l.x2, l.y2, angles.right, 'right')}
                            <circle cx={l.x1} cy={l.y1} r={2.5/zoom} fill={isSelected ? THEME_ORANGE : BLUE_PURE} className="pointer-events-none" />
                            <circle cx={l.x2} cy={l.y2} r={2.5/zoom} fill={isSelected ? THEME_ORANGE : BLUE_PURE} className="pointer-events-none" />
                            <g transform={`translate(${(l.x1+l.x2)/2},${(l.y1+l.y2)/2})`} className="pointer-events-none"><circle r={8/zoom} fill={isSelected ? THEME_ORANGE : BLUE_PURE} /><text dominantBaseline="middle" textAnchor="middle" fill="white" fontSize={8/zoom} fontWeight="bold">{i + 1}</text></g>
                          </g>
                        );
                      })}
                      {activeLine && (
                        <g>
                            <line x1={activeLine.x1} y1={activeLine.y1} x2={activeLine.x2} y2={activeLine.y2} stroke={THEME_ORANGE} strokeWidth={2/zoom} strokeDasharray="4 4" />
                            <text x={(activeLine.x1+activeLine.x2)/2} y={(activeLine.y1+activeLine.y2)/2 - 12/zoom} fill={THEME_ORANGE} fontSize={10/zoom} fontWeight="bold" textAnchor="middle" className="pointer-events-none">{formatLen(Math.hypot(activeLine.x2-activeLine.x1, activeLine.y2-activeLine.y1))}</text>
                        </g>
                      )}
                    </svg>
                    <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-30">
                      <button onClick={() => { setMode('pan'); cancelDrawing(); }} className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-colors border ${mode === 'pan' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-200'}`}><Hand size={20}/></button>
                      <button onClick={() => { setZoom(z => Math.min(4, z + 0.4)); cancelDrawing(); }} className="w-11 h-11 bg-white border border-blue-200 rounded-full shadow-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors"><ZoomIn size={20}/></button>
                      <button onClick={() => { setZoom(z => Math.max(0.2, z - 0.4)); cancelDrawing(); }} className="w-11 h-11 bg-white border border-blue-200 rounded-full shadow-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors"><ZoomOut size={20}/></button>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 bg-white border rounded-3xl shadow-sm overflow-hidden flex flex-col" style={{ borderColor: BLUE_LIGHT }}>
                    <div className="p-3 bg-blue-50 border-b flex justify-between items-center" style={{ borderColor: BLUE_LIGHT }}>
                        <span className="text-[10px] font-black uppercase text-blue-800">Cut List</span>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="text-[10px] uppercase font-black sticky top-0 z-10" style={{ backgroundColor: BLUE_ULTRA_LIGHT, color: BLUE_PURE }}>
                            <tr><th className="p-3 border-b">ID & PROFILE</th><th className="p-3 border-b">LENGTH ({unit === 'metric' ? metricSubUnit : 'in'})</th><th className="p-3 border-b">THICKNESS</th><th className="p-3 border-b text-center">LEFT CUT</th><th className="p-3 border-b text-center">RIGHT CUT</th></tr>
                          </thead>
                          <tbody>
                            {lines.map((l, i) => {
                              const angles = calculateAngles(l, i);
                              const profilePts = getBoardPoints({x1:15, y1:20, x2:85, y2:20}, angles.left, angles.right, true, l.thickness);
                              const isSelected = selectedId === i;
                              return (
                                <tr key={i} className="cursor-pointer transition-colors" style={{ backgroundColor: isSelected ? `${THEME_ORANGE}10` : 'transparent' }} onClick={() => { setSelectedId(i); cancelDrawing(); }}>
                                  <td className="p-3 border-b"><div className="flex items-center gap-3"><div className="w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-[10px]" style={{ backgroundColor: isSelected ? THEME_ORANGE : BLUE_PURE }}>{i+1}</div><div className="w-20 h-8 bg-white rounded border flex items-center justify-center overflow-hidden" style={{ borderColor: BLUE_LIGHT }}><svg width="80" height="30" viewBox="0 0 100 40"><defs><HalftoneWoodPattern /></defs><polygon points={profilePts.map(p => `${p.x},${p.y + 20}`).join(' ')} fill="url(#halftone-wood)" /><polygon points={profilePts.map(p => `${p.x},${p.y + 20}`).join(' ')} fill={isSelected ? THEME_ORANGE : BLUE_ULTRA_LIGHT} fillOpacity={0.2} stroke={isSelected ? THEME_ORANGE : BLUE_MEDIUM} strokeWidth={0.75} /></svg></div></div></td>
                                  <td className="p-3 border-b"><input type="number" step="0.1" value={formatLen(Math.hypot(l.x2-l.x1, l.y2-l.y1))} onClick={e => e.stopPropagation()} onChange={e => updateLineLength(i, parseInputToPx(e.target.value))} className="w-20 border rounded text-center text-xs font-bold p-1 outline-none focus:border-orange-500" /></td>
                                  <td className="p-3 border-b"><input type="number" value={l.thickness || thickness} onClick={e => e.stopPropagation()} onChange={e => updateLineThickness(i, Number(e.target.value))} className="w-16 border rounded text-center text-xs font-bold p-1 outline-none focus:border-orange-500" /></td>
                                  <td className="p-3 border-b text-center" onClick={(e) => { e.stopPropagation(); handleAngleSelection(angles.left.angle, `${i}-left`); }}><button className="text-[10px] px-2 py-1 rounded font-black border transition-all" style={{ backgroundColor: (activeMiterKey === `${i}-left`) ? THEME_ORANGE : 'transparent', color: (activeMiterKey === `${i}-left`) ? 'white' : THEME_ORANGE, borderColor: THEME_ORANGE }}>{angles.left.label}</button></td>
                                  <td className="p-3 border-b text-center" onClick={(e) => { e.stopPropagation(); handleAngleSelection(angles.right.angle, `${i}-right`); }}><button className="text-[10px] px-2 py-1 rounded font-black border transition-all" style={{ backgroundColor: (activeMiterKey === `${i}-right`) ? THEME_ORANGE : 'transparent', color: (activeMiterKey === `${i}-right`) ? 'white' : THEME_ORANGE, borderColor: THEME_ORANGE }}>{angles.right.label}</button></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="w-80 flex flex-col gap-4 overflow-hidden">
              <div className="flex-1 bg-white border rounded-3xl shadow-sm p-5 flex flex-col gap-3 relative" style={{ borderColor: BLUE_LIGHT }}>
                {selectedId !== null && (
                  <div className="absolute top-4 left-4 w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[11px] z-10 shadow-md" style={{ backgroundColor: BLUE_PURE }}>{selectedId + 1}</div>
                )}
                <h3 className="text-[10px] font-black uppercase tracking-widest text-center" style={{ color: BLUE_MEDIUM }}>Saw Blade Angle</h3>
                <button className="absolute top-4 right-4 text-blue-200 hover:text-orange-500" onClick={() => { setSawAngle(0); setIsStanding(false); }}><RotateCcw size={14} /></button>
                <div className="flex-1 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden" style={{ backgroundColor: BLUE_ULTRA_LIGHT }}>
                   <svg width="100%" height="80%" viewBox="0 0 160 160">
                        <defs><HalftoneWoodPattern /></defs>
                        <rect x="10" y="130" width="140" height="6" fill={BLUE_LIGHT} rx="1" /> 
                        {(() => {
                          const rad = (isStanding ? (90 - sawAngle) : sawAngle) * Math.PI / 180;
                          if (isStanding) {
                            const boardL = 70, boardR = 105, boardT = 40, boardB = 130;
                            const intersectY = 130 - (10 / Math.tan(rad));
                            const safeIntersectY = Math.max(boardT, Math.min(boardB, intersectY));
                            let pts = intersectY > boardT ? `${boardL},${safeIntersectY} ${boardL},${boardT} ${boardR},${boardT} ${boardR},${boardB} 80,130` : `${80 - (boardB - boardT) * Math.tan(rad)},${boardT} ${boardR},${boardT} ${boardR},${boardB} 80,130`;
                            return <g><rect x="105" y="70" width="15" height="60" fill={BLUE_PURE} rx="1" /><polygon points={pts} fill="url(#halftone-wood)" /><polygon points={pts} fill={BLUE_ULTRA_LIGHT} fillOpacity={0.4} stroke={BLUE_PURE} strokeWidth="0.75" /></g>;
                          } else {
                            const pts = `${80 - 15 * Math.tan(rad)},115 120,115 120,130 80,130`;
                            return <g><rect x="120" y="70" width="20" height="60" fill={BLUE_PURE} rx="1" /><polygon points={pts} fill="url(#halftone-wood)" /><polygon points={pts} fill={BLUE_ULTRA_LIGHT} fillOpacity={0.4} stroke={BLUE_PURE} strokeWidth="0.75" /></g>;
                          }
                        })()}
                        <g transform={`translate(80, 130) rotate(${- (isStanding ? (90 - sawAngle) : sawAngle)})`}><rect x="-0.5" y="-100" width="1" height="100" fill={THEME_ORANGE} /><circle cx="0" cy="0" r="3" fill={THEME_ORANGE} /></g>
                     </svg>
                     <div className="absolute bottom-2 flex items-center gap-2">
                        <span className="text-[11px] font-black text-white px-2 py-0.5 rounded shadow-lg" style={{ backgroundColor: THEME_ORANGE }}>{(isStanding ? (90 - sawAngle) : sawAngle).toFixed(1)}°</span>
                        {isStanding && <span className="text-[9px] font-bold text-blue-400">({sawAngle.toFixed(1)}°)</span>}
                     </div>
                </div>
                {sawAngle > 45 && (
                  <button onClick={() => setIsStanding(!isStanding)} className="flex items-center justify-center gap-2 py-2 rounded-xl bg-orange-50 text-[10px] font-black border transition-colors hover:bg-orange-100 w-full" style={{ borderColor: THEME_ORANGE, color: THEME_ORANGE }}><FlipVertical size={14} /> {isStanding ? "LAY BOARD FLAT" : "STAND BOARD UP"}</button>
                )}
              </div>

              <div className="flex-1 bg-white border rounded-3xl shadow-sm p-5 flex flex-col gap-3 relative" style={{ borderColor: BLUE_LIGHT }}>
                {selectedId !== null && (
                  <div className="absolute top-4 left-4 w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[11px] z-10 shadow-md" style={{ backgroundColor: BLUE_PURE }}>{selectedId + 1}</div>
                )}
                <h3 className="text-[10px] font-black uppercase tracking-widest text-center" style={{ color: BLUE_MEDIUM }}>Miter Gauge</h3>
                <button className="absolute top-4 right-4 text-blue-200 hover:text-orange-500" onClick={() => setMiterGaugeAngle(0)}><RotateCcw size={14} /></button>
                <div className="flex-1 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden" style={{ backgroundColor: BLUE_ULTRA_LIGHT }}>
                   <svg width="100%" height="80%" viewBox="0 0 160 160">
                     <defs><HalftoneWoodPattern /></defs>
                     <rect x="145" y="0" width="1" height="160" fill={THEME_ORANGE} /><circle cx="145.5" cy="80" r="3" fill={THEME_ORANGE} />
                     <rect x="75" y="10" width="10" height="140" fill={BLUE_LIGHT} /> 
                     <g transform={`translate(80, 80) rotate(${miterGaugeAngle})`}>
                       {(() => { const rad = (miterGaugeAngle * Math.PI) / 180; const cosV = Math.cos(rad), sinV = Math.sin(rad); const xTop = (65 + (-23) * sinV) / cosV, xBot = (65 + (-8) * sinV) / cosV; const pts = `0,-23 ${xTop},-23 ${xBot},-8 0,-8`; return <g><polygon points={pts} fill="url(#halftone-wood)" /><polygon points={pts} fill={BLUE_ULTRA_LIGHT} fillOpacity={0.4} stroke={BLUE_PURE} strokeWidth="0.75" /></g>; })()}
                       <path d="M -25 0 A 25 25 0 0 0 25 0 Z" fill={BLUE_LIGHT} /><rect x="-60" y="-8" width="120" height="8" fill={BLUE_PURE} rx="1" /><rect x="-2" y="0" width="2" height="40" fill={BLUE_PURE} />
                     </g>
                   </svg>
                   <div className="absolute bottom-2">
                        <span className="text-[11px] font-black text-white px-2 py-0.5 rounded shadow-lg" style={{ backgroundColor: THEME_ORANGE }}>{miterGaugeAngle.toFixed(1)}°</span>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
```

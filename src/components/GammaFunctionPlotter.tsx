import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ViewBox { xMin: number; xMax: number; yMin: number; yMax: number }

// ── Overlays drawn on main thread (Axes, Grid, Asymptotes) ───────────────────
function drawOverlays(
  ctx: CanvasRenderingContext2D,
  PW: number, PH: number, dpr: number,
  v: ViewBox,
  showGrid: boolean, showAsymptotes: boolean
) {
  const toX = (x: number) => ((x - v.xMin) / (v.xMax - v.xMin)) * PW;
  const toY = (y: number) => ((v.yMax - y) / (v.yMax - v.yMin)) * PH;

  // 1. Grid Lines
  if (showGrid) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = dpr * 0.5;
    ctx.setLineDash([4 * dpr, 4 * dpr]);

    const rangeX = v.xMax - v.xMin;
    const stepX = Math.pow(10, Math.floor(Math.log10(rangeX / 5))) || 1;
    
    for (let x = Math.ceil(v.xMin / stepX) * stepX; x <= v.xMax; x += stepX) {
      ctx.beginPath(); ctx.moveTo(toX(x), 0); ctx.lineTo(toX(x), PH); ctx.stroke();
    }

    const rangeY = v.yMax - v.yMin;
    const stepY = Math.pow(10, Math.floor(Math.log10(rangeY / 5))) || 1;

    for (let y = Math.ceil(v.yMin / stepY) * stepY; y <= v.yMax; y += stepY) {
      ctx.beginPath(); ctx.moveTo(0, toY(y)); ctx.lineTo(PW, toY(y)); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Grid Labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = `${10 * dpr}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    for (let x = Math.ceil(v.xMin / stepX) * stepX; x <= v.xMax; x += stepX) {
      ctx.fillText(x.toFixed(1).replace(".0", ""), toX(x), PH - 6 * dpr);
    }
    ctx.textAlign = "right";
    for (let y = Math.ceil(v.yMin / stepY) * stepY; y <= v.yMax; y += stepY) {
      const posY = toY(y);
      if (posY > 14 * dpr && posY < PH - 14 * dpr) {
        ctx.fillText(y.toFixed(1).replace(".0", ""), 35 * dpr, posY + 3 * dpr);
      }
    }
  }

  // 2. Main Axes (X and Y)
  const y0 = toY(0), x0 = toX(0);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = dpr * 1.5;
  if (y0 >= 0 && y0 <= PH) { ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(PW, y0); ctx.stroke(); }
  if (x0 >= 0 && x0 <= PW) { ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, PH); ctx.stroke(); }

  // 3. Asymptotes (Poles at x <= 0)
  if (showAsymptotes) {
    ctx.save();
    ctx.strokeStyle = "rgba(59, 130, 246, 0.6)"; // Blue dashed lines
    ctx.lineWidth = dpr * 1;
    ctx.setLineDash([6 * dpr, 4 * dpr]);
    
    const startPole = Math.floor(v.xMin);
    const endPole = Math.min(0, Math.ceil(v.xMax));
    
    for (let p = startPole; p <= endPole; p++) {
      if (p <= 0) {
        const xP = toX(p);
        if (xP >= 0 && xP <= PW) {
          ctx.beginPath(); ctx.moveTo(xP, 0); ctx.lineTo(xP, PH); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}

// ── Inline worker for sampling and plotting lines cleanly ───────────────────
function createWorker(): Worker {
  const src = `
// Lanczos approximation coefficients for Gamma function
const p_coefficients = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
];
const g_constant = 7;

function gamma(z) {
  if (z < 0.5) {
    // Reflection formula: Gamma(z) = pi / (sin(pi*z) * Gamma(1-z))
    return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  }
  z -= 1;
  let x = p_coefficients[0];
  for (let i = 1; i < g_constant + 2; i++) {
    x += p_coefficients[i] / (z + i);
  }
  let t = z + g_constant + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

self.onmessage = function(e) {
  const { id, PW, PH, xMin, xMax, yMin, yMax, stepSize } = e.data;
  
  // Sample the points to build a continuous curve path
  const points = [];
  
  // We scan along pixel width
  for (let px = 0; px <= PW; px += stepSize) {
    const x = xMin + (px / PW) * (xMax - xMin);
    
    // Ignore near integer poles to avoid infinite spikes breaking the line drawing
    if (x <= 0 && Math.abs(x - Math.round(x)) < 1e-3) {
      points.push({ px, py: null });
      continue;
    }
    
    const y = gamma(x);
    
    if (isNaN(y) || !isFinite(y)) {
      points.push({ px, py: null });
    } else {
      const py = ((yMax - y) / (yMax - yMin)) * PH;
      points.push({ px, py });
    }
  }
  
  self.postMessage({ id, points });
};
`;
  const blob = new Blob([src], { type: "application/javascript" });
  return new Worker(URL.createObjectURL(blob));
}

// ── Hover fast evaluation ─────────────────────────────────────────────────────
const P_COEFFS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
const G_CONST = 7;

function gammaFast(z: number): number {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaFast(1 - z));
  z -= 1;
  let x = P_COEFFS[0];
  for (let i = 1; i < G_CONST + 2; i++) x += P_COEFFS[i] / (z + i);
  let t = z + G_CONST + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

export default function GammaFunctionPlotter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const renderIdRef = useRef(0);
  const dragRef = useRef<{ x0: number; y0: number; v0: ViewBox } | null>(null);

  const [view, setView] = useState<ViewBox>({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 });
  const [showGrid, setShowGrid] = useState(true);
  const [showAsymptotes, setShowAsymptotes] = useState(true);
  const [info, setInfo] = useState<string | null>(null);

  const viewRef = useRef(view);
  const showGridRef = useRef(showGrid);
  const showAsymptotesRef = useRef(showAsymptotes);

  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { showGridRef.current = showGrid; }, [showGrid]);
  useEffect(() => { showAsymptotesRef.current = showAsymptotes; }, [showAsymptotes]);

  const redrawOverlay = useCallback(() => {
    const oc = overlayRef.current;
    if (!oc) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = oc.getContext("2d")!;
    ctx.clearRect(0, 0, oc.width, oc.height);
    drawOverlays(ctx, oc.width, oc.height, dpr, viewRef.current, showGridRef.current, showAsymptotesRef.current);
  }, []);

  const render = useCallback((v: ViewBox) => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const container = containerRef.current;
    if (!canvas || !overlay || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = container.clientWidth;
    const cssH = container.clientHeight;
    if (cssW === 0 || cssH === 0) return;

    const PW = Math.floor(cssW * dpr);
    const PH = Math.floor(cssH * dpr);

    for (const c of [canvas, overlay]) {
      c.width = PW; c.height = PH;
      c.style.width = cssW + "px";
      c.style.height = cssH + "px";
    }

    workerRef.current?.terminate();
    const worker = createWorker();
    workerRef.current = worker;

    const myId = ++renderIdRef.current;
    const ctx = canvas.getContext("2d")!;
    
    // Background style
    ctx.fillStyle = "#0b0f19";
    ctx.fillRect(0, 0, PW, PH);

    redrawOverlay();

    // High resolution sampling (stepSize = 1 pixel width)
    worker.postMessage({ id: myId, PW, PH, ...v, stepSize: 1 });

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.id !== myId) return;

      const points = msg.points as { px: number; py: number | null }[];
      
      ctx.strokeStyle = "#ef4444"; // Red plotting line like the image
      ctx.lineWidth = dpr * 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      ctx.beginPath();
      let first = true;

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        // If a point jumps out of scale or hits a pole, split the stroke path
        if (p.py === null || p.py < -PH || p.py > PH * 2) {
          first = true;
          continue;
        }

        if (first) {
          ctx.moveTo(p.px, p.py);
          first = false;
        } else {
          ctx.lineTo(p.px, p.py);
        }
      }
      ctx.stroke();
    };
  }, [redrawOverlay]);

  useEffect(() => { render(view); }, [view, render]);
  useEffect(() => { redrawOverlay(); }, [showGrid, showAsymptotes, redrawOverlay]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => render(viewRef.current));
    ro.observe(container);
    return () => ro.disconnect();
  }, [render]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  // ── Interação ───────────────────────────────────────────────────────────────
  const toCoords = useCallback((cx: number, cy: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return {
      x: v.xMin + ((cx - r.left) / r.width) * (v.xMax - v.xMin),
      y: v.yMax - ((cy - r.top) / r.height) * (v.yMax - v.yMin),
    };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.x0;
      const dy = e.clientY - dragRef.current.y0;
      const sv = dragRef.current.v0;
      const r = canvasRef.current!.getBoundingClientRect();
      const dxCoord = -(dx / r.width) * (sv.xMax - sv.xMin);
      const dyCoord = (dy / r.height) * (sv.yMax - sv.yMin);
      setView({ xMin: sv.xMin + dxCoord, xMax: sv.xMax + dxCoord, yMin: sv.yMin + dyCoord, yMax: sv.yMax + dyCoord });
      return;
    }
    const { x } = toCoords(e.clientX, e.clientY);
    if (x <= 0 && Math.abs(x - Math.round(x)) < 0.05) {
      setInfo(`x = ${x.toFixed(3)} | Γ(x) = Indefinido (Polo)`);
    } else {
      const yVal = gammaFast(x);
      if (isNaN(yVal) || !isFinite(yVal)) setInfo(null);
      else setInfo(`x = ${x.toFixed(3)} | Γ(x) = ${yVal.toFixed(4)}`);
    }
  }, [toCoords]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { x0: e.clientX, y0: e.clientY, v0: { ...viewRef.current } };
  }, []);

  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const { x, y } = toCoords(e.clientX, e.clientY);
    const k = e.deltaY > 0 ? 1.25 : 1 / 1.25;
    setView(v => ({
      xMin: x + (v.xMin - x) * k, xMax: x + (v.xMax - x) * k,
      yMin: y + (v.yMin - y) * k, yMax: y + (v.yMax - y) * k,
    }));
  }, [toCoords]);

  return (
    <div className="flex flex-col w-full h-full bg-[#0b0f19] text-slate-200 select-none font-mono text-xs">
      
      {/* Topbar */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-2 border-b border-slate-800 bg-[#0f1626] min-h-[44px]">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-red-500">Γ(x)</span>
          <span className="text-[10px] tracking-wider uppercase text-slate-500">Função Gama</span>
        </div>

        <div className="w-[1px] h-4 bg-slate-800" />

        {/* Presets */}
        <div className="flex gap-1">
          <button onClick={() => setView({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 })} className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors">Vista Geral</button>
          <button onClick={() => setView({ xMin: -1, xMax: 5, yMin: -1, yMax: 6 })} className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors">Fatorial Positivo</button>
          <button onClick={() => setView({ xMin: -4.5, xMax: -0.5, yMin: -6, yMax: 6 })} className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors">Polos Negativos</button>
        </div>

        <div className="w-[1px] h-4 bg-slate-800" />

        {/* Toggles */}
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="rounded text-red-500 focus:ring-0 bg-slate-900 border-slate-700" />
            <span>Grade</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showAsymptotes} onChange={e => setShowAsymptotes(e.target.checked)} className="rounded text-red-500 focus:ring-0 bg-slate-900 border-slate-700" />
            <span>Assíntotas</span>
          </label>
        </div>
      </div>

      {/* Render Workspace */}
      <div className="flex flex-1 relative overflow-hidden min-h-0">
        <div ref={containerRef} className="flex-1 relative overflow-hidden h-full">
          {/* Main Line Canvas */}
          <canvas ref={canvasRef} className="absolute inset-0 block" />

          {/* Background Elements Canvas */}
          <canvas ref={overlayRef} className="absolute inset-0 block pointer-events-none" />

          {/* Overlay Event Handler */}
          <div
            className={`absolute inset-0 ${dragRef.current ? "cursor-grabbing" : "cursor-crosshair"}`}
            onMouseMove={onMouseMove}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={() => { onMouseUp(); setInfo(null); }}
            onWheel={onWheel}
          />

          {/* Data Footer */}
          <div className="absolute bottom-0 inset-x-0 px-4 py-1.5 bg-[#0b0f19]/80 backdrop-blur border-t border-slate-800/50 pointer-events-none text-slate-400">
            {info ?? "Scroll: Zoom · Arrastar: Mover e Explorar eixos"}
          </div>
        </div>
      </div>
    </div>
  );
}
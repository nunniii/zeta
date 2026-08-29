import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ViewBox { reMin: number; reMax: number; imMin: number; imMax: number }

// ── Overlays drawn on main thread ─────────────────────────────────────────────
const ZEROS = [
  14.134725, 21.022040, 25.010858, 30.424876, 32.935062,
  37.586178, 40.918719, 43.327073, 48.005150, 49.773832,
  52.970321, 56.446248, 59.347044, 60.831778, 65.112544,
];

function drawOverlays(
  ctx: CanvasRenderingContext2D,
  PW: number, PH: number, dpr: number,
  v: ViewBox,
  showZeros: boolean, showCritical: boolean, showGrid: boolean
) {
  const toX = (re: number) => ((re - v.reMin) / (v.reMax - v.reMin)) * PW;
  const toY = (im: number) => ((v.imMax - im) / (v.imMax - v.imMin)) * PH;

  if (showGrid) {
    ctx.strokeStyle = "rgba(255,255,255,0.13)";
    ctx.lineWidth = dpr * 0.5;
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    const range = Math.min(v.reMax - v.reMin, v.imMax - v.imMin);
    const step  = Math.pow(10, Math.floor(Math.log10(range / 5)));
    for (let r = Math.ceil(v.reMin / step) * step; r <= v.reMax; r += step) {
      ctx.beginPath(); ctx.moveTo(toX(r), 0); ctx.lineTo(toX(r), PH); ctx.stroke();
    }
    for (let i = Math.ceil(v.imMin / step) * step; i <= v.imMax; i += step) {
      ctx.beginPath(); ctx.moveTo(0, toY(i)); ctx.lineTo(PW, toY(i)); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.font = `${10 * dpr}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    for (let r = Math.ceil(v.reMin / step) * step; r <= v.reMax; r += step * 2)
      ctx.fillText(r.toFixed(0), toX(r), PH - 4 * dpr);
    ctx.textAlign = "right";
    for (let i = Math.ceil(v.imMin / step) * step; i <= v.imMax; i += step * 2) {
      const y = toY(i);
      if (y > 14 * dpr && y < PH - 8 * dpr)
        ctx.fillText(i.toFixed(0), 30 * dpr, y + 3 * dpr);
    }
  }

  // Axes
  const y0 = toY(0), x0 = toX(0);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = dpr;
  if (y0 >= 0 && y0 <= PH) { ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(PW, y0); ctx.stroke(); }
  if (x0 >= 0 && x0 <= PW) { ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, PH); ctx.stroke(); }

  if (showCritical) {
    const xH = toX(0.5);
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 1.5 * dpr;
    ctx.setLineDash([8 * dpr, 5 * dpr]);
    ctx.beginPath(); ctx.moveTo(xH, 0); ctx.lineTo(xH, PH); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = `bold ${10 * dpr}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    ctx.fillText("Re = ½", xH, 16 * dpr);
  }

  if (showZeros) {
    const xH = toX(0.5);
    ZEROS.forEach((t, idx) => {
      for (const sign of [1, -1]) {
        const im = sign * t;
        if (im < v.imMin || im > v.imMax) return;
        const y = toY(im);
        ctx.beginPath(); ctx.arc(xH, y, 5 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = "#000"; ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
        if (sign > 0) {
          ctx.fillStyle = "rgba(255,255,255,0.82)";
          ctx.font = `${9 * dpr}px 'JetBrains Mono', monospace`;
          ctx.textAlign = "left";
          ctx.fillText(`γ${idx + 1}`, xH + 8 * dpr, y + 3 * dpr);
        }
      }
    });
  }
}

// ── Inline worker (no extra file needed) ──────────────────────────────────────
function createWorker(): Worker {
  const src = `
function zeta(sigma, t, N) {
  let re = 0, im = 0;
  for (let n = 1; n <= N; n++) {
    const lnn = Math.log(n);
    const mag = Math.pow(n, -sigma);
    const sign = n % 2 === 1 ? 1 : -1;
    re += sign * mag * Math.cos(t * lnn);
    im += sign * mag * Math.sin(-t * lnn);
  }
  const m2  = Math.pow(2, 1 - sigma);
  const dr  = 1 - m2 * Math.cos(-t * Math.LN2);
  const di  = -m2 * Math.sin(-t * Math.LN2);
  const den = dr * dr + di * di;
  if (den < 1e-20) return [0, 0];
  return [(re * dr + im * di) / den, (im * dr - re * di) / den];
}

function hsvToRgb(h, s, v) {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), tt = v * (1 - (1 - f) * s);
  const cases = [[v,tt,p],[q,v,p],[p,v,tt],[p,q,v],[tt,p,v],[v,p,q]];
  const [r,g,b] = cases[i % 6];
  return [r * 255 | 0, g * 255 | 0, b * 255 | 0];
}

function domainColor(re, im) {
  const mod  = Math.sqrt(re * re + im * im);
  const arg  = Math.atan2(im, re);
  const h    = (arg + Math.PI) / (2 * Math.PI);
  const logm = Math.log2(mod + 1e-12);
  const frac = logm - Math.floor(logm);
  const ring = 0.5 + 0.5 * Math.cos(2 * Math.PI * frac);
  const v    = 0.45 + 0.5 * ring;
  const s    = Math.min(1, mod * 0.6 + 0.4);
  return hsvToRgb(h, s, v);
}

self.onmessage = function(e) {
  const { id, PW, PH, reMin, reMax, imMin, imMax, N, stripH } = e.data;
  let y = 0;

  function doStrip() {
    const y1   = Math.min(y + stripH, PH);
    const rows = y1 - y;
    const buf  = new Uint8ClampedArray(PW * rows * 4);
    for (let row = 0; row < rows; row++) {
      const py   = y + row;
      const im_s = imMax - (py / PH) * (imMax - imMin);
      for (let px = 0; px < PW; px++) {
        const re_s = reMin + (px / PW) * (reMax - reMin);
        const [zr, zi] = zeta(re_s, im_s, N);
        const [r, g, b] = domainColor(zr, zi);
        const idx = (row * PW + px) * 4;
        buf[idx] = r; buf[idx+1] = g; buf[idx+2] = b; buf[idx+3] = 255;
      }
    }
    self.postMessage({ id, y, PW, rows, buf }, [buf.buffer]);
    y = y1;
    if (y < PH) setTimeout(doStrip, 0);
    else self.postMessage({ id, done: true });
  }

  doStrip();
};
`;
  const blob = new Blob([src], { type: "application/javascript" });
  return new Worker(URL.createObjectURL(blob));
}

// ── Hover zeta (fast, few terms) ─────────────────────────────────────────────
function zetaFast(sigma: number, t: number): [number, number] {
  let re = 0, im = 0;
  for (let n = 1; n <= 60; n++) {
    const lnn = Math.log(n);
    const mag = Math.pow(n, -sigma);
    const sign = n % 2 === 1 ? 1 : -1;
    re += sign * mag * Math.cos(t * lnn);
    im += sign * mag * Math.sin(-t * lnn);
  }
  const m2 = Math.pow(2, 1 - sigma);
  const dr = 1 - m2 * Math.cos(-t * Math.LN2);
  const di = -m2 * Math.sin(-t * Math.LN2);
  const den = dr * dr + di * di;
  if (den < 1e-20) return [0, 0];
  return [(re * dr + im * di) / den, (im * dr - re * di) / den];
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ZetaDomainColoring() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const overlayRef   = useRef<HTMLCanvasElement>(null); // separate canvas for overlays
  const containerRef = useRef<HTMLDivElement>(null);
  const workerRef    = useRef<Worker | null>(null);
  const renderIdRef  = useRef(0);
  const dragRef      = useRef<{ x0: number; y0: number; v0: ViewBox } | null>(null);

  const [view, setView]                   = useState<ViewBox>({ reMin: -30, reMax: 5, imMin: -40, imMax: 40 });
  const [terms, setTerms]                 = useState(100);
  const [showZeros, setShowZeros]         = useState(true);
  const [showCritical, setShowCritical]   = useState(true);
  const [showGrid, setShowGrid]           = useState(true);
  const [progress, setProgress]           = useState(0);
  const [rendering, setRendering]         = useState(false);
  const [info, setInfo]                   = useState<string | null>(null);

  // keep refs in sync for use inside callbacks without re-creating them
  const viewRef         = useRef(view);
  const showZerosRef    = useRef(showZeros);
  const showCriticalRef = useRef(showCritical);
  const showGridRef     = useRef(showGrid);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { showZerosRef.current = showZeros; }, [showZeros]);
  useEffect(() => { showCriticalRef.current = showCritical; }, [showCritical]);
  useEffect(() => { showGridRef.current = showGrid; }, [showGrid]);

  // ── Redraw overlay canvas only (cheap) ───────────────────────────────────────
  const redrawOverlay = useCallback(() => {
    const oc = overlayRef.current;
    const container = containerRef.current;
    if (!oc || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const PW = oc.width, PH = oc.height;
    const ctx = oc.getContext("2d")!;
    ctx.clearRect(0, 0, PW, PH);
    drawOverlays(ctx, PW, PH, dpr, viewRef.current,
      showZerosRef.current, showCriticalRef.current, showGridRef.current);
  }, []);

  // ── Main render via worker ───────────────────────────────────────────────────
  const render = useCallback((v: ViewBox, N: number) => {
    const canvas    = canvasRef.current;
    const overlay   = overlayRef.current;
    const container = containerRef.current;
    if (!canvas || !overlay || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = container.clientWidth;
    const cssH = container.clientHeight;
    if (cssW === 0 || cssH === 0) return;

    const PW = Math.floor(cssW * dpr);
    const PH = Math.floor(cssH * dpr);

    // resize both canvases
    for (const c of [canvas, overlay]) {
      c.width  = PW; c.height = PH;
      c.style.width  = cssW + "px";
      c.style.height = cssH + "px";
    }

    // terminate previous worker
    workerRef.current?.terminate();
    const worker = createWorker();
    workerRef.current = worker;

    const myId = ++renderIdRef.current;
    setRendering(true);
    setProgress(0);

    const ctx = canvas.getContext("2d")!;
    // clear to dark immediately so user sees something
    ctx.fillStyle = "#0a0b0e";
    ctx.fillRect(0, 0, PW, PH);

    // draw overlays immediately (on the separate canvas)
    const octx = overlay.getContext("2d")!;
    octx.clearRect(0, 0, PW, PH);
    drawOverlays(octx, PW, PH, dpr, v,
      showZerosRef.current, showCriticalRef.current, showGridRef.current);

    // adaptive strip height: fewer strips on mobile, more on desktop for smoother preview
    const stripH = Math.max(8, Math.floor(PH / 80)) * dpr | 0;

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.id !== myId) return; // stale

      if (msg.done) {
        setRendering(false);
        setProgress(100);
        return;
      }

      // paint strip immediately
      const { y, PW: w, rows, buf } = msg;
      const imgData = new ImageData(new Uint8ClampedArray(buf), w, rows);
      ctx.putImageData(imgData, 0, y);
      setProgress(Math.round((y + rows) / PH * 100));
    };

    worker.postMessage({ id: myId, PW, PH, ...v, N, stripH });
  }, []);

  // Trigger render when view / terms change
  useEffect(() => {
    render(view, terms);
  }, [view, terms, render]);

  // Re-draw overlays when toggle state changes (no re-render needed)
  useEffect(() => {
    redrawOverlay();
  }, [showZeros, showCritical, showGrid, view, redrawOverlay]);

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => render(viewRef.current, terms));
    ro.observe(container);
    return () => ro.disconnect();
  }, [terms, render]);

  // cleanup worker on unmount
  useEffect(() => () => workerRef.current?.terminate(), []);

  // ── Interaction ───────────────────────────────────────────────────────────────
  const toComplex = useCallback((cx: number, cy: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return {
      re: v.reMin + ((cx - r.left) / r.width)  * (v.reMax - v.reMin),
      im: v.imMax - ((cy - r.top)  / r.height) * (v.imMax - v.imMin),
    };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.x0;
      const dy = e.clientY - dragRef.current.y0;
      const sv = dragRef.current.v0;
      const r  = canvasRef.current!.getBoundingClientRect();
      const dre = -(dx / r.width)  * (sv.reMax - sv.reMin);
      const dim =  (dy / r.height) * (sv.imMax - sv.imMin);
      setView({ reMin: sv.reMin + dre, reMax: sv.reMax + dre, imMin: sv.imMin + dim, imMax: sv.imMax + dim });
      return;
    }
    const { re, im } = toComplex(e.clientX, e.clientY);
    const [zr, zi]   = zetaFast(re, im);
    const mod = Math.sqrt(zr * zr + zi * zi);
    const arg = (Math.atan2(zi, zr) * 180 / Math.PI).toFixed(1);
    setInfo(`s = ${re >= 0 ? " " : ""}${re.toFixed(3)} + ${im.toFixed(3)}i     |ζ| = ${mod.toFixed(4)}     arg = ${arg}°`);
  }, [toComplex]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { x0: e.clientX, y0: e.clientY, v0: { ...viewRef.current } };
  }, []);

  const onMouseUp   = useCallback(() => { dragRef.current = null; }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const { re, im } = toComplex(e.clientX, e.clientY);
    const k = e.deltaY > 0 ? 1.28 : 1 / 1.28;
    setView(v => ({
      reMin: re + (v.reMin - re) * k, reMax: re + (v.reMax - re) * k,
      imMin: im + (v.imMin - im) * k, imMax: im + (v.imMax - im) * k,
    }));
  }, [toComplex]);

  // ── Presets ───────────────────────────────────────────────────────────────────
  const presets: { label: string; v: ViewBox }[] = [
    { label: "Geral",         v: { reMin: -30, reMax: 5,  imMin: -40, imMax: 40 } },
    { label: "Linha crítica", v: { reMin: -2,  reMax: 3,  imMin: -5,  imMax: 65 } },
    { label: "Zeros γ1–γ5",  v: { reMin: -1,  reMax: 2,  imMin: 10,  imMax: 55 } },
    { label: "Polo s = 1",   v: { reMin: -2,  reMax: 4,  imMin: -4,  imMax: 4  } },
  ];

  // ── UI ────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column",
                  background: "#0a0b0e", fontFamily: "'JetBrains Mono', monospace",
                  color: "rgba(255,255,255,0.88)", userSelect: "none" }}>

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px",
                    borderBottom: "1px solid rgba(255,255,255,0.08)", background: "#0f1117",
                    flexWrap: "wrap", flexShrink: 0, minHeight: 44 }}>

        <span style={{ fontSize: 18, fontWeight: 700, color: "#7f77dd", letterSpacing: "-0.02em" }}>ζ(s)</span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", letterSpacing: "0.12em",
                       textTransform: "uppercase", marginRight: 4 }}>domain coloring</span>

        <Sep />

        {presets.map(p => (
          <button key={p.label} onClick={() => setView(p.v)} style={btnStyle}>
            {p.label}
          </button>
        ))}

        <Sep />

        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10,
                        color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>
          N =&nbsp;<span style={{ color: "#7f77dd", minWidth: 28 }}>{terms}</span>
          <input type="range" min={30} max={250} step={10} value={terms}
            onChange={e => setTerms(+e.target.value)}
            style={{ width: 70, accentColor: "#7f77dd" }} />
        </label>

        {[
          { label: "Zeros",  val: showZeros,    set: setShowZeros },
          { label: "Re = ½", val: showCritical, set: setShowCritical },
          { label: "Grade",  val: showGrid,      set: setShowGrid },
        ].map(({ label, val, set }) => (
          <label key={label} style={{ display: "flex", alignItems: "center", gap: 4,
                                      cursor: "pointer", fontSize: 10,
                                      color: val ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.28)" }}>
            <input type="checkbox" checked={val} onChange={e => set(e.target.checked)}
              style={{ accentColor: "#7f77dd" }} />
            {label}
          </label>
        ))}

        {/* Progress bar */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 90, height: 2, background: "rgba(255,255,255,0.07)", borderRadius: 2 }}>
            <div style={{
              width: `${progress}%`, height: "100%",
              background: rendering ? "#7f77dd" : "#1d9e75",
              borderRadius: 2, transition: "width 0.06s, background 0.4s"
            }} />
          </div>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", minWidth: 28 }}>
            {rendering ? `${progress}%` : "✓"}
          </span>
        </div>
      </div>

      {/* ── Canvas area + sidebar ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden", minWidth: 0 }}>

          {/* pixel canvas (colours) */}
          <canvas ref={canvasRef}
            style={{ position: "absolute", inset: 0, display: "block" }} />

          {/* overlay canvas (grid, zeros, axes) — pointer-events go through to pixel canvas */}
          <canvas ref={overlayRef}
            style={{ position: "absolute", inset: 0, display: "block", pointerEvents: "none" }} />

          {/* event-capture div on top */}
          <div
            style={{ position: "absolute", inset: 0,
                     cursor: dragRef.current ? "grabbing" : "crosshair" }}
            onMouseMove={onMouseMove}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={() => { onMouseUp(); setInfo(null); }}
            onWheel={onWheel}
          />

          {/* Info bar */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: "4px 12px", fontSize: 10, letterSpacing: "0.04em",
            background: "rgba(10,11,14,0.78)", backdropFilter: "blur(4px)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            color: info ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.18)",
            pointerEvents: "none", transition: "color 0.2s",
          }}>
            {info ?? "scroll = zoom  ·  arrastar = mover  ·  hover = valores"}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div style={{ width: 148, background: "#0f1117", flexShrink: 0, overflowY: "auto",
                      borderLeft: "1px solid rgba(255,255,255,0.07)",
                      padding: "12px 10px", display: "flex", flexDirection: "column", gap: 16 }}>

          <div>
            <SectionTitle>Fase → Cor</SectionTitle>
            <ColorWheel />
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.32)", textAlign: "center", marginTop: 4 }}>
              arg ζ(s)
            </div>
          </div>

          <div>
            <SectionTitle>Anéis = |ζ|</SectionTitle>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.38)", lineHeight: 1.8 }}>
              Cada anel = ×2 em módulo<br />
              ■ Escuro → zero<br />
              □ Claro → polo (s=1)
            </div>
          </div>

          <div>
            <SectionTitle>Zeros γₙ</SectionTitle>
            {ZEROS.slice(0, 10).map((t, i) => (
              <div key={i}
                onClick={() => setView({ reMin: -1.5, reMax: 2.5, imMin: t - 10, imMax: t + 10 })}
                style={{ display: "flex", justifyContent: "space-between", fontSize: 10,
                         padding: "2px 3px", borderRadius: 3, cursor: "pointer",
                         color: "rgba(255,255,255,0.42)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <span style={{ color: "rgba(255,255,255,0.2)" }}>γ{i + 1}</span>
                <span style={{ color: "#1d9e75" }}>{t.toFixed(4)}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "auto" }}>
            <SectionTitle>Vista</SectionTitle>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", lineHeight: 2 }}>
              Re [{view.reMin.toFixed(1)}, {view.reMax.toFixed(1)}]<br />
              Im [{view.imMin.toFixed(1)}, {view.imMax.toFixed(1)}]
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function Sep() {
  return <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.09)", flexShrink: 0 }} />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                  color: "rgba(255,255,255,0.26)", marginBottom: 6, paddingBottom: 4,
                  borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      {children}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 4, color: "rgba(255,255,255,0.52)", fontSize: 10, padding: "2px 8px",
  cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.03em",
};

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v*(1-s), q = v*(1-f*s), tt = v*(1-(1-f)*s);
  const c: [number,number,number][] = [[v,tt,p],[q,v,p],[p,v,tt],[p,q,v],[tt,p,v],[v,p,q]];
  const [r,g,b] = c[i%6];
  return [r*255|0, g*255|0, b*255|0];
}

function ColorWheel() {
  return (
    <svg width="100%" viewBox="0 0 80 80" style={{ display: "block", margin: "0 auto" }}>
      {Array.from({ length: 360 }, (_, deg) => {
        const a1 = (deg/360)*2*Math.PI - Math.PI/2;
        const a2 = ((deg+1)/360)*2*Math.PI - Math.PI/2;
        const r1=14, r2=36;
        const pts = [
          [40+r1*Math.cos(a1), 40+r1*Math.sin(a1)],
          [40+r2*Math.cos(a1), 40+r2*Math.sin(a1)],
          [40+r2*Math.cos(a2), 40+r2*Math.sin(a2)],
          [40+r1*Math.cos(a2), 40+r1*Math.sin(a2)],
        ];
        const [r,g,b] = hsvToRgb(deg/360, 1, 0.9);
        return (
          <path key={deg}
            d={`M${pts.map(p=>p.join(",")).join("L")}Z`}
            fill={`rgb(${r},${g},${b})`} />
        );
      })}
      {([ ["0",0],["π/2",90],["π",180],["-π/2",270] ] as [string,number][]).map(([lbl,deg])=>{
        const a = (deg/360)*2*Math.PI - Math.PI/2;
        return <text key={lbl} x={40+44*Math.cos(a)} y={40+44*Math.sin(a)+3}
          fontSize="6" fill="rgba(255,255,255,0.38)" textAnchor="middle">{lbl}</text>;
      })}
    </svg>
  );
}

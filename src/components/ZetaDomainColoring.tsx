import { useEffect, useRef, useState, useCallback } from "react";
import type { Complex, RootFindingStep } from "./zeta/zetaMath";
import {
  cAbs,
  cArg,
  riemannZeta,
  findZetaZero,
  KNOWN_ZEROS,
  ZERO_RECORDS,
  TRIVIAL_ZEROS,
} from "./zeta/zetaMath";
import { ZetaGLRenderer } from "./zeta/zetaShader";
import { ZetaWaveform } from "./zeta/ZetaWaveform";

interface ViewBox {
  reMin: number;
  reMax: number;
  imMin: number;
  imMax: number;
}

type ToolMode = "explore" | "hunter" | "measure";

interface ZeroFoundRecord {
  id: string;
  seed: Complex;
  root: Complex;
  steps: RootFindingStep[];
  residual: number;
  converged: boolean;
  time: string;
}

export default function ZetaDomainColoring() {
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ZetaGLRenderer | null>(null);
  const dragRef = useRef<{ x0: number; y0: number; v0: ViewBox } | null>(null);
  const measureStartRef = useRef<{ x: number; y: number; s: Complex } | null>(null);

  // ── View State ─────────────────────────────────────────────────────────────
  const [view, setView] = useState<ViewBox>({
    reMin: -4,
    reMax: 5,
    imMin: -5,
    imMax: 45,
  });

  // ── Visualization Settings ──────────────────────────────────────────────────
  const [colorMode, setColorMode] = useState<number>(0); // 0: Standard, 1: Phase Rays, 2: Modulus Contours, 3: Re/Im Zero Curves, 4: Conformal Grid
  const [palette, setPalette] = useState<number>(0); // 0: Cosmic Neon, 1: Twilight, 2: Turbo, 3: Classic HSV, 4: Deep Ocean, 5: Monochrome
  const [contourDensity, setContourDensity] = useState<number>(1.0);
  const [isophaseDensity, setIsophaseDensity] = useState<number>(16.0);
  const [showModulusRings, setShowModulusRings] = useState<boolean>(true);
  const [showIsophases, setShowIsophases] = useState<boolean>(false);
  const [brightness, setBrightness] = useState<number>(1.0);

  // ── Overlays & Tools ───────────────────────────────────────────────────────
  const [toolMode, setToolMode] = useState<ToolMode>("explore");
  const [showCriticalZeros, setShowCriticalZeros] = useState<boolean>(true);
  const [showTrivialZeros, setShowTrivialZeros] = useState<boolean>(true);
  const [showCriticalLine, setShowCriticalLine] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showWaveform, setShowWaveform] = useState<boolean>(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState<"zeros" | "settings" | "hunter" | "info">("zeros");

  // ── Interactive Inspections & Hunter ───────────────────────────────────────
  const [hoverData, setHoverData] = useState<{
    s: Complex;
    zetaVal: Complex;
    modVal: number;
    argVal: number;
    argDeg: number;
    closestZero: { gamma: number; dist: number; index: number };
  } | null>(null);

  const [activeHoverT, setActiveHoverT] = useState<number | null>(null);
  const [foundZeros, setFoundZeros] = useState<ZeroFoundRecord[]>([]);
  const [activeHunterTrajectory, setActiveHunterTrajectory] = useState<RootFindingStep[] | null>(null);
  const [measurement, setMeasurement] = useState<{ start: Complex; end: Complex; dist: number; dRe: number; dIm: number } | null>(null);

  // Refs for rendering synchronization
  const viewRef = useRef(view);
  const showCriticalZerosRef = useRef(showCriticalZeros);
  const showTrivialZerosRef = useRef(showTrivialZeros);
  const showCriticalLineRef = useRef(showCriticalLine);
  const showGridRef = useRef(showGrid);
  const activeHunterTrajectoryRef = useRef(activeHunterTrajectory);
  const foundZerosRef = useRef(foundZeros);
  const measurementRef = useRef(measurement);

  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { showCriticalZerosRef.current = showCriticalZeros; }, [showCriticalZeros]);
  useEffect(() => { showTrivialZerosRef.current = showTrivialZeros; }, [showTrivialZeros]);
  useEffect(() => { showCriticalLineRef.current = showCriticalLine; }, [showCriticalLine]);
  useEffect(() => { showGridRef.current = showGrid; }, [showGrid]);
  useEffect(() => { activeHunterTrajectoryRef.current = activeHunterTrajectory; }, [activeHunterTrajectory]);
  useEffect(() => { foundZerosRef.current = foundZeros; }, [foundZeros]);
  useEffect(() => { measurementRef.current = measurement; }, [measurement]);

  // ── Initialize WebGL Renderer ─────────────────────────────────────────────
  useEffect(() => {
    if (glCanvasRef.current && !rendererRef.current) {
      rendererRef.current = new ZetaGLRenderer(glCanvasRef.current);
    }
  }, []);

  // ── Render 2D Vector Overlays ─────────────────────────────────────────────
  const drawOverlayCanvas = useCallback(() => {
    const oc = overlayRef.current;
    const container = containerRef.current;
    if (!oc || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const PW = oc.width;
    const PH = oc.height;
    const ctx = oc.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, PW, PH);

    const v = viewRef.current;
    const toX = (re: number) => ((re - v.reMin) / (v.reMax - v.reMin)) * PW;
    const toY = (im: number) => ((v.imMax - im) / (v.imMax - v.imMin)) * PH;

    // 1. Grid Lines & Axis Ticks
    if (showGridRef.current) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 0.8 * dpr;
      ctx.setLineDash([4 * dpr, 4 * dpr]);

      const rangeX = v.reMax - v.reMin;
      const stepX = Math.pow(10, Math.floor(Math.log10(Math.max(1e-5, rangeX / 6)))) || 1;

      for (let r = Math.ceil(v.reMin / stepX) * stepX; r <= v.reMax; r += stepX) {
        const x = toX(r);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, PH);
        ctx.stroke();
      }

      const rangeY = v.imMax - v.imMin;
      const stepY = Math.pow(10, Math.floor(Math.log10(Math.max(1e-5, rangeY / 6)))) || 1;

      for (let i = Math.ceil(v.imMin / stepY) * stepY; i <= v.imMax; i += stepY) {
        const y = toY(i);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(PW, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Coordinate Labels along border
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.font = `${10 * dpr}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "center";
      for (let r = Math.ceil(v.reMin / stepX) * stepX; r <= v.reMax; r += stepX) {
        const x = toX(r);
        if (x > 20 * dpr && x < PW - 20 * dpr) {
          ctx.fillText(r.toFixed(Math.max(0, -Math.floor(Math.log10(stepX)))), x, PH - 6 * dpr);
        }
      }
      ctx.textAlign = "left";
      for (let i = Math.ceil(v.imMin / stepY) * stepY; i <= v.imMax; i += stepY) {
        const y = toY(i);
        if (y > 20 * dpr && y < PH - 20 * dpr) {
          ctx.fillText(`${i.toFixed(Math.max(0, -Math.floor(Math.log10(stepY))))}i`, 8 * dpr, y - 4 * dpr);
        }
      }
    }

    // 2. Primary Axes (Real and Imaginary lines)
    const y0 = toY(0);
    const x0 = toX(0);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 1.2 * dpr;
    if (y0 >= 0 && y0 <= PH) {
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.lineTo(PW, y0);
      ctx.stroke();
    }
    if (x0 >= 0 && x0 <= PW) {
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0, PH);
      ctx.stroke();
    }

    // 3. Critical Line Re(s) = 1/2
    if (showCriticalLineRef.current) {
      const xHalf = toX(0.5);
      if (xHalf >= 0 && xHalf <= PW) {
        ctx.save();
        // Glow effect
        ctx.strokeStyle = "rgba(168, 85, 247, 0.4)";
        ctx.lineWidth = 4 * dpr;
        ctx.beginPath();
        ctx.moveTo(xHalf, 0);
        ctx.lineTo(xHalf, PH);
        ctx.stroke();

        // Main line
        ctx.strokeStyle = "#c084fc";
        ctx.lineWidth = 1.8 * dpr;
        ctx.setLineDash([8 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.moveTo(xHalf, 0);
        ctx.lineTo(xHalf, PH);
        ctx.stroke();
        ctx.restore();

        // Badge label
        ctx.fillStyle = "#c084fc";
        ctx.font = `bold ${10 * dpr}px 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.fillText("Re(s) = ½", xHalf, 18 * dpr);
      }
    }

    // 4. Pole at s = 1 indicator
    const xPole = toX(1);
    const yPole = toY(0);
    if (xPole >= -20 && xPole <= PW + 20 && yPole >= -20 && yPole <= PH + 20) {
      ctx.save();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2 * dpr;
      const sz = 6 * dpr;
      ctx.beginPath();
      ctx.moveTo(xPole - sz, yPole - sz);
      ctx.lineTo(xPole + sz, yPole + sz);
      ctx.moveTo(xPole + sz, yPole - sz);
      ctx.lineTo(xPole - sz, yPole + sz);
      ctx.stroke();

      ctx.fillStyle = "#ef4444";
      ctx.font = `bold ${9 * dpr}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "center";
      ctx.fillText("Polo s=1", xPole, yPole - 10 * dpr);
      ctx.restore();
    }

    // 5. Trivial Zeros (s = -2, -4, -6, ...)
    if (showTrivialZerosRef.current) {
      for (const tz of TRIVIAL_ZEROS) {
        if (tz < v.reMin || tz > v.reMax || 0 < v.imMin || 0 > v.imMax) continue;
        const xTz = toX(tz);
        const yTz = toY(0);

        ctx.beginPath();
        ctx.arc(xTz, yTz, 4 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(56, 189, 248, 0.2)";
        ctx.fill();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1.5 * dpr;
        ctx.stroke();

        ctx.fillStyle = "rgba(56, 189, 248, 0.85)";
        ctx.font = `${8 * dpr}px 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.fillText(`s=${tz}`, xTz, yTz + 14 * dpr);
      }
    }

    // 6. Non-Trivial Critical Zeros γ_n
    if (showCriticalZerosRef.current) {
      const xHalf = toX(0.5);
      KNOWN_ZEROS.forEach((gamma, idx) => {
        // Upper half (positive imaginary) and lower half (negative imaginary by symmetry)
        for (const sign of [1, -1]) {
          const im = sign * gamma;
          if (im < v.imMin || im > v.imMax) return;
          const yZ = toY(im);

          // Glowing pulse circle
          ctx.beginPath();
          ctx.arc(xHalf, yZ, 5 * dpr, 0, Math.PI * 2);
          ctx.fillStyle = "#0f172a";
          ctx.fill();
          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = 1.8 * dpr;
          ctx.stroke();

          // Inner dot
          ctx.beginPath();
          ctx.arc(xHalf, yZ, 1.8 * dpr, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();

          // Label
          if (sign > 0) {
            ctx.fillStyle = "#ffffff";
            ctx.font = `bold ${9 * dpr}px 'JetBrains Mono', monospace`;
            ctx.textAlign = "left";
            ctx.fillText(`γ${idx + 1}`, xHalf + 8 * dpr, yZ + 3 * dpr);

            ctx.fillStyle = "rgba(34, 197, 94, 0.8)";
            ctx.font = `${8 * dpr}px 'JetBrains Mono', monospace`;
            ctx.fillText(`${gamma.toFixed(3)}i`, xHalf + 8 * dpr, yZ + 12 * dpr);
          }
        }
      });
    }

    // 7. Found Zeros (User Discovered via Root Hunter)
    const userZeros = foundZerosRef.current;
    userZeros.forEach((item, idx) => {
      const xRoot = toX(item.root.re);
      const yRoot = toY(item.root.im);

      if (xRoot >= -20 && xRoot <= PW + 20 && yRoot >= -20 && yRoot <= PH + 20) {
        // Gold Target Ring
        ctx.beginPath();
        ctx.arc(xRoot, yRoot, 8 * dpr, 0, Math.PI * 2);
        ctx.strokeStyle = "#eab308";
        ctx.lineWidth = 1.8 * dpr;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(xRoot, yRoot, 3 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = "#facc15";
        ctx.fill();

        ctx.fillStyle = "#facc15";
        ctx.font = `bold ${9 * dpr}px 'JetBrains Mono', monospace`;
        ctx.textAlign = "left";
        ctx.fillText(`Zero #${idx + 1} (${item.root.im.toFixed(4)}i)`, xRoot + 12 * dpr, yRoot + 3 * dpr);
      }
    });

    // 8. Active Root Hunter Trajectory Animation
    const traj = activeHunterTrajectoryRef.current;
    if (traj && traj.length > 1) {
      ctx.save();
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 1.6 * dpr;
      ctx.setLineDash([3 * dpr, 3 * dpr]);

      ctx.beginPath();
      for (let i = 0; i < traj.length; i++) {
        const xT = toX(traj[i].s.re);
        const yT = toY(traj[i].s.im);
        if (i === 0) ctx.moveTo(xT, yT);
        else ctx.lineTo(xT, yT);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw trajectory nodes
      for (let i = 0; i < traj.length; i++) {
        const xT = toX(traj[i].s.re);
        const yT = toY(traj[i].s.im);
        ctx.beginPath();
        ctx.arc(xT, yT, (i === 0 ? 4 : 2.5) * dpr, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? "#3b82f6" : i === traj.length - 1 ? "#eab308" : "rgba(234, 179, 8, 0.7)";
        ctx.fill();
      }
      ctx.restore();
    }

    // 9. Measurement Calipers
    const meas = measurementRef.current;
    if (meas) {
      const x1 = toX(meas.start.re);
      const y1 = toY(meas.start.im);
      const x2 = toX(meas.end.re);
      const y2 = toY(meas.end.im);

      ctx.save();
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Measurement calipers ends
      ctx.beginPath();
      ctx.arc(x1, y1, 4 * dpr, 0, Math.PI * 2);
      ctx.arc(x2, y2, 4 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = "#ec4899";
      ctx.fill();

      // Midpoint measurement badge
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const distStr = `Δs = ${meas.dist.toFixed(4)} (ΔRe: ${meas.dRe.toFixed(3)}, ΔIm: ${meas.dIm.toFixed(3)})`;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.font = `${9 * dpr}px 'JetBrains Mono', monospace`;
      const txtW = ctx.measureText(distStr).width;
      ctx.fillRect(midX - txtW / 2 - 4 * dpr, midY - 14 * dpr, txtW + 8 * dpr, 18 * dpr);
      ctx.strokeStyle = "#ec4899";
      ctx.strokeRect(midX - txtW / 2 - 4 * dpr, midY - 14 * dpr, txtW + 8 * dpr, 18 * dpr);

      ctx.fillStyle = "#f472b6";
      ctx.textAlign = "center";
      ctx.fillText(distStr, midX, midY - 2 * dpr);
      ctx.restore();
    }
  }, []);

  // ── Main Render Loop (WebGL + Overlay) ──────────────────────────────────────
  const renderAll = useCallback(() => {
    const glCanvas = glCanvasRef.current;
    const overlay = overlayRef.current;
    const container = containerRef.current;
    const renderer = rendererRef.current;
    if (!glCanvas || !overlay || !container || !renderer) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = container.clientWidth;
    const cssH = container.clientHeight;
    if (cssW === 0 || cssH === 0) return;

    const PW = Math.floor(cssW * dpr);
    const PH = Math.floor(cssH * dpr);

    for (const c of [glCanvas, overlay]) {
      if (c.width !== PW || c.height !== PH) {
        c.width = PW;
        c.height = PH;
        c.style.width = `${cssW}px`;
        c.style.height = `${cssH}px`;
      }
    }

    // Render WebGL Domain Coloring
    renderer.render(PW, PH, viewRef.current, {
      colorMode,
      palette,
      contourDensity,
      isophaseDensity,
      showModulusRings,
      showIsophases,
      brightness,
    });

    // Render 2D Vector Overlays
    drawOverlayCanvas();
  }, [
    colorMode,
    palette,
    contourDensity,
    isophaseDensity,
    showModulusRings,
    showIsophases,
    brightness,
    drawOverlayCanvas,
  ]);

  useEffect(() => {
    renderAll();
  }, [renderAll, view]);

  // Redraw overlays on toggles
  useEffect(() => {
    drawOverlayCanvas();
  }, [
    showCriticalZeros,
    showTrivialZeros,
    showCriticalLine,
    showGrid,
    activeHunterTrajectory,
    foundZeros,
    measurement,
    drawOverlayCanvas,
  ]);

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => renderAll());
    ro.observe(container);
    return () => ro.disconnect();
  }, [renderAll]);

  // ── Coordinate Conversions ──────────────────────────────────────────────────
  const toComplex = useCallback((clientX: number, clientY: number): Complex => {
    const r = overlayRef.current?.getBoundingClientRect();
    if (!r) return { re: 0, im: 0 };
    const v = viewRef.current;
    return {
      re: v.reMin + ((clientX - r.left) / r.width) * (v.reMax - v.reMin),
      im: v.imMax - ((clientY - r.top) / r.height) * (v.imMax - v.imMin),
    };
  }, []);

  // ── Mouse & Wheel Interaction ───────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (toolMode === "measure") {
        const s = toComplex(e.clientX, e.clientY);
        measureStartRef.current = { x: e.clientX, y: e.clientY, s };
        setMeasurement({ start: s, end: s, dist: 0, dRe: 0, dIm: 0 });
        return;
      }

      if (toolMode === "hunter") {
        const seed = toComplex(e.clientX, e.clientY);
        const result = findZetaZero(seed, 30, 1e-10);
        setActiveHunterTrajectory(result.steps);

        const newZeroRecord: ZeroFoundRecord = {
          id: `${Date.now()}-${Math.random()}`,
          seed,
          root: result.root,
          steps: result.steps,
          residual: result.residual,
          converged: result.converged,
          time: new Date().toLocaleTimeString(),
        };

        setFoundZeros((prev) => [newZeroRecord, ...prev.slice(0, 24)]);
        setActiveSidebarTab("hunter");
        return;
      }

      dragRef.current = { x0: e.clientX, y0: e.clientY, v0: { ...viewRef.current } };
    },
    [toolMode, toComplex]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // 1. Measuring Tool
      if (toolMode === "measure" && measureStartRef.current) {
        const curS = toComplex(e.clientX, e.clientY);
        const startS = measureStartRef.current.s;
        const dRe = curS.re - startS.re;
        const dIm = curS.im - startS.im;
        const dist = Math.hypot(dRe, dIm);
        setMeasurement({ start: startS, end: curS, dist, dRe, dIm });
        return;
      }

      // 2. Dragging / Panning
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.x0;
        const dy = e.clientY - dragRef.current.y0;
        const sv = dragRef.current.v0;
        const r = overlayRef.current?.getBoundingClientRect();
        if (!r) return;

        const dRe = -(dx / r.width) * (sv.reMax - sv.reMin);
        const dIm = (dy / r.height) * (sv.imMax - sv.imMin);

        setView({
          reMin: sv.reMin + dRe,
          reMax: sv.reMax + dRe,
          imMin: sv.imMin + dIm,
          imMax: sv.imMax + dIm,
        });
        return;
      }

      // 3. Hover Inspector HUD
      const s = toComplex(e.clientX, e.clientY);
      const zetaVal = riemannZeta(s);
      const modVal = cAbs(zetaVal);
      const argVal = cArg(zetaVal);
      const argDeg = (argVal * 180) / Math.PI;

      // Find closest known zero
      let closestZero = { gamma: KNOWN_ZEROS[0], dist: 1e9, index: 1 };
      KNOWN_ZEROS.forEach((gamma, i) => {
        const d = Math.hypot(s.re - 0.5, Math.abs(s.im) - gamma);
        if (d < closestZero.dist) {
          closestZero = { gamma, dist: d, index: i + 1 };
        }
      });

      setHoverData({
        s,
        zetaVal,
        modVal,
        argVal,
        argDeg,
        closestZero,
      });

      setActiveHoverT(s.im);
    },
    [toolMode, toComplex]
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
    if (toolMode === "measure") {
      measureStartRef.current = null;
    }
  }, [toolMode]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const { re, im } = toComplex(e.clientX, e.clientY);
      const zoomFactor = e.deltaY > 0 ? 1.2 : 1 / 1.2;

      setView((v) => ({
        reMin: re + (v.reMin - re) * zoomFactor,
        reMax: re + (v.reMax - re) * zoomFactor,
        imMin: im + (v.imMin - im) * zoomFactor,
        imMax: im + (v.imMax - im) * zoomFactor,
      }));
    },
    [toComplex]
  );

  // ── Jump to Presets & Specific Zeros ─────────────────────────────────────────
  const jumpToView = (v: ViewBox) => {
    setView(v);
  };

  const jumpToZero = (gamma: number) => {
    setView({
      reMin: -1.5,
      reMax: 2.5,
      imMin: gamma - 4,
      imMax: gamma + 4,
    });
  };

  const jumpToTrivial = (sVal: number) => {
    setView({
      reMin: sVal - 3,
      reMax: sVal + 3,
      imMin: -4,
      imMax: 4,
    });
  };

  // ── Screenshot / High-Res PNG Capture ───────────────────────────────────────
  const exportSnapshot = () => {
    const glCanvas = glCanvasRef.current;
    const overlay = overlayRef.current;
    if (!glCanvas || !overlay) return;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = glCanvas.width;
    exportCanvas.height = glCanvas.height;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(glCanvas, 0, 0);
    ctx.drawImage(overlay, 0, 0);

    const link = document.createElement("a");
    link.download = `riemann-zeta-explorer-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  };

  // ── Presets List ────────────────────────────────────────────────────────────
  const PRESETS: { label: string; v: ViewBox; desc: string }[] = [
    {
      label: "Vista Geral",
      v: { reMin: -30, reMax: 5, imMin: -30, imMax: 50 },
      desc: "Zeros triviais, polo em s=1 e faixa crítica",
    },
    {
      label: "Faixa Crítica",
      v: { reMin: -1.5, reMax: 2.5, imMin: -2, imMax: 55 },
      desc: "0 < Re(s) < 1 com primeiros 10 zeros",
    },
    {
      label: "Zeros γ1–γ5",
      v: { reMin: -1, reMax: 2, imMin: 12, imMax: 35 },
      desc: "Primeiros cinco zeros não-triviais",
    },
    {
      label: "Polo em s = 1",
      v: { reMin: -2, reMax: 4, imMin: -3, imMax: 3 },
      desc: "Polo simples com resíduo 1",
    },
    {
      label: "Zeros Triviais",
      v: { reMin: -25, reMax: 2, imMin: -8, imMax: 8 },
      desc: "s = -2, -4, -6, -8, -10, ...",
    },
    {
      label: "Altos Zeros (t > 100)",
      v: { reMin: -1, reMax: 2, imMin: 98, imMax: 130 },
      desc: "Oscilações de alta frequência",
    },
  ];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#080c14",
        fontFamily: "'JetBrains Mono', monospace",
        color: "rgba(255, 255, 255, 0.9)",
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      {/* ── Top Bar / Controls Toolbar ────────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "6px 14px",
          background: "#0d1322",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          flexWrap: "wrap",
          minHeight: 48,
          zIndex: 20,
        }}
      >
        {/* Brand Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 20,
              fontWeight: 800,
              background: "linear-gradient(135deg, #a855f7, #38bdf8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.03em",
            }}
          >
            ζ(s)
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            Riemann Explorer
          </span>
        </div>

        <Sep />

        {/* Tool Mode Selectors */}
        <div
          style={{
            display: "flex",
            background: "rgba(255, 255, 255, 0.04)",
            padding: 2,
            borderRadius: 6,
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <button
            onClick={() => setToolMode("explore")}
            style={toolBtnStyle(toolMode === "explore", "#38bdf8")}
            title="Navegar, Pan e Zoom no plano complexo"
          >
            🔍 Explorar
          </button>
          <button
            onClick={() => {
              setToolMode("hunter");
              setActiveSidebarTab("hunter");
            }}
            style={toolBtnStyle(toolMode === "hunter", "#eab308")}
            title="Clique em qualquer ponto para convergir numericamente ao Zero mais próximo"
          >
            🎯 Caçador de Zeros
          </button>
          <button
            onClick={() => setToolMode("measure")}
            style={toolBtnStyle(toolMode === "measure", "#ec4899")}
            title="Clique e arraste para medir distância e espaçamento no plano"
          >
            📏 Régua
          </button>
        </div>

        <Sep />

        {/* Quick Presets */}
        <div style={{ display: "flex", gap: 4 }}>
          {PRESETS.slice(0, 4).map((p) => (
            <button
              key={p.label}
              onClick={() => jumpToView(p.v)}
              style={{
                ...baseBtnStyle,
                background: "rgba(255, 255, 255, 0.04)",
                fontSize: 10,
              }}
              title={p.desc}
            >
              {p.label}
            </button>
          ))}
        </div>

        <Sep />

        {/* Palette & Modes Selectors */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
          <span style={{ color: "rgba(255, 255, 255, 0.4)" }}>Paleta:</span>
          <select
            value={palette}
            onChange={(e) => setPalette(Number(e.target.value))}
            style={selectStyle}
          >
            <option value={0}>Cosmic Neon</option>
            <option value={1}>Twilight</option>
            <option value={2}>Turbo Thermal</option>
            <option value={3}>HSV Clássico</option>
            <option value={4}>Oceano Profundo</option>
            <option value={5}>Monocromático</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
          <span style={{ color: "rgba(255, 255, 255, 0.4)" }}>Modo:</span>
          <select
            value={colorMode}
            onChange={(e) => setColorMode(Number(e.target.value))}
            style={selectStyle}
          >
            <option value={0}>Retrato de Fase</option>
            <option value={1}>Raios Isofásicos</option>
            <option value={2}>Contornos |ζ|</option>
            <option value={3}>Zero Re/Im Curves</option>
            <option value={4}>Grade Conforme</option>
          </select>
        </div>

        {/* Right Action Tools */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setShowWaveform((prev) => !prev)}
            style={{
              ...baseBtnStyle,
              background: showWaveform ? "rgba(168, 85, 247, 0.2)" : "rgba(255, 255, 255, 0.04)",
              borderColor: showWaveform ? "#a855f7" : "rgba(255, 255, 255, 0.1)",
              color: showWaveform ? "#c084fc" : "rgba(255, 255, 255, 0.6)",
            }}
            title="Alternar Osciloscópio da função Z(t) de Riemann-Siegel"
          >
            📊 Waveform Z(t)
          </button>

          <button
            onClick={exportSnapshot}
            style={{
              ...baseBtnStyle,
              background: "rgba(34, 197, 94, 0.15)",
              borderColor: "rgba(34, 197, 94, 0.4)",
              color: "#4ade80",
            }}
            title="Exportar Imagem PNG de Alta Resolução"
          >
            📸 Exportar PNG
          </button>
        </div>
      </header>

      {/* ── Main Workspace Body ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0, position: "relative" }}>
        {/* Central Viewport & Waveform Column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
          {/* Main 2D Domain Coloring Viewport */}
          <div
            ref={containerRef}
            style={{
              flex: 1,
              position: "relative",
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            {/* GPU WebGL Domain Coloring Canvas */}
            <canvas
              ref={glCanvasRef}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
            />

            {/* 2D Vector Overlays Canvas (Grid, Zeros, Critical Line, Hunter Steps) */}
            <canvas
              ref={overlayRef}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                display: "block",
                pointerEvents: "none",
              }}
            />

            {/* Event Layer */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                cursor:
                  toolMode === "hunter"
                    ? "crosshair"
                    : toolMode === "measure"
                    ? "ew-resize"
                    : dragRef.current
                    ? "grabbing"
                    : "grab",
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                handleMouseUp();
                setHoverData(null);
                setActiveHoverT(null);
              }}
              onWheel={handleWheel}
            />

            {/* Live Floating Inspector HUD Reticle */}
            {hoverData && (
              <div
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: 12,
                  background: "rgba(13, 19, 34, 0.88)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 11,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6)",
                  pointerEvents: "none",
                  zIndex: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span>
                    <strong style={{ color: "rgba(255,255,255,0.4)" }}>s = </strong>
                    <span style={{ color: "#38bdf8", fontWeight: 700 }}>
                      {hoverData.s.re >= 0 ? " " : ""}
                      {hoverData.s.re.toFixed(4)} + {hoverData.s.im.toFixed(4)}i
                    </span>
                  </span>
                  <span>
                    <strong style={{ color: "rgba(255,255,255,0.4)" }}>ζ(s) = </strong>
                    <span style={{ color: "#c084fc" }}>
                      {hoverData.zetaVal.re.toFixed(4)} + {hoverData.zetaVal.im.toFixed(4)}i
                    </span>
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 10, color: "rgba(255,255,255,0.7)" }}>
                  <span>
                    |ζ(s)| = <strong style={{ color: "#22c55e" }}>{hoverData.modVal.toFixed(5)}</strong>
                  </span>
                  <span>
                    Fase = <strong style={{ color: "#facc15" }}>{hoverData.argDeg.toFixed(1)}°</strong> ({hoverData.argVal.toFixed(3)} rad)
                  </span>
                  <span>
                    Zero mais próx. = <strong style={{ color: "#38bdf8" }}>γ{hoverData.closestZero.index}</strong> ({hoverData.closestZero.gamma.toFixed(2)}i, Δ={hoverData.closestZero.dist.toFixed(3)})
                  </span>
                </div>
              </div>
            )}

            {/* Mode indicator badge */}
            <div
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                background: "rgba(13, 19, 34, 0.75)",
                backdropFilter: "blur(6px)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 4,
                padding: "3px 8px",
                fontSize: 9,
                color: "rgba(255, 255, 255, 0.6)",
                pointerEvents: "none",
              }}
            >
              {toolMode === "explore" && "Modo Explorar: Scroll = Zoom · Arrastar = Pan"}
              {toolMode === "hunter" && "Modo Caçador: Clique em qualquer ponto para encontrar a raiz ζ(s)=0"}
              {toolMode === "measure" && "Modo Régua: Clique e arraste para medir distância e espaçamento"}
            </div>
          </div>

          {/* ── Retractable Riemann-Siegel Z(t) Waveform Drawer ─────────────────── */}
          {showWaveform && (
            <div
              style={{
                height: 140,
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                background: "#090d18",
                position: "relative",
                flexShrink: 0,
              }}
            >
              <ZetaWaveform
                tMin={view.imMin}
                tMax={view.imMax}
                currentHoverT={activeHoverT}
                onSelectT={(t) => {
                  setView((v) => {
                    const span = v.imMax - v.imMin;
                    return {
                      ...v,
                      imMin: t - span / 2,
                      imMax: t + span / 2,
                    };
                  });
                }}
              />
            </div>
          )}
        </div>

        {/* ── Sidebar: Zeros Navigator, Tools & Settings ────────────────────────── */}
        <aside
          style={{
            width: 280,
            background: "#0d1322",
            borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            overflow: "hidden",
            zIndex: 10,
          }}
        >
          {/* Sidebar Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              background: "rgba(0, 0, 0, 0.2)",
            }}
          >
            {[
              { id: "zeros", label: "Zeros γₙ" },
              { id: "hunter", label: "Caçador" },
              { id: "settings", label: "Ajustes" },
              { id: "info", label: "Teoria" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSidebarTab(tab.id as any)}
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  fontSize: 10,
                  fontWeight: activeSidebarTab === tab.id ? 700 : 500,
                  color: activeSidebarTab === tab.id ? "#38bdf8" : "rgba(255, 255, 255, 0.4)",
                  background: activeSidebarTab === tab.id ? "rgba(56, 189, 248, 0.08)" : "transparent",
                  border: "none",
                  borderBottom: activeSidebarTab === tab.id ? "2px solid #38bdf8" : "2px solid transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sidebar Content Area */}
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 14 }}>
            {/* TAB 1: ZEROS DATABASE & NAVIGATOR */}
            {activeSidebarTab === "zeros" && (
              <>
                <div>
                  <SectionTitle>Zeros Críticos Não-Triviais</SectionTitle>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
                    Conjectura de Riemann: Todos os zeros não-triviais possuem Re(s) = ½.
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 280, overflowY: "auto" }}>
                    {ZERO_RECORDS.map((z) => (
                      <div
                        key={z.index}
                        onClick={() => jumpToZero(z.gamma)}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "4px 6px",
                          borderRadius: 4,
                          background: "rgba(255, 255, 255, 0.03)",
                          border: "1px solid rgba(255, 255, 255, 0.05)",
                          cursor: "pointer",
                          fontSize: 10,
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(56, 189, 248, 0.1)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)")}
                      >
                        <span style={{ color: "#c084fc", fontWeight: 600 }}>γ{z.index}</span>
                        <span style={{ color: "#22c55e", fontWeight: 700 }}>{z.gamma.toFixed(5)}i</span>
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 8 }}>Δ={z.gap.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <SectionTitle>Zeros Triviais (s &lt; 0)</SectionTitle>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                    {TRIVIAL_ZEROS.slice(0, 9).map((tz) => (
                      <button
                        key={tz}
                        onClick={() => jumpToTrivial(tz)}
                        style={{
                          ...baseBtnStyle,
                          background: "rgba(56, 189, 248, 0.08)",
                          color: "#38bdf8",
                          fontSize: 9,
                          padding: "4px 2px",
                        }}
                      >
                        s = {tz}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* TAB 2: ROOT HUNTER (NEWTON-RAPHSON) */}
            {activeSidebarTab === "hunter" && (
              <>
                <div>
                  <SectionTitle>Caçador de Raízes Interativo</SectionTitle>
                  <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.6)", lineHeight: 1.5, marginBottom: 10 }}>
                    Clique em qualquer ponto do plano complexo para iniciar as iterações de <strong>Newton-Raphson</strong>:
                    <div
                      style={{
                        padding: "6px 8px",
                        background: "rgba(0,0,0,0.3)",
                        borderRadius: 4,
                        margin: "6px 0",
                        color: "#eab308",
                        fontSize: 9,
                      }}
                    >
                      sₖ₊₁ = sₖ - ζ(sₖ) / ζ'(sₖ)
                    </div>
                  </div>

                  {foundZeros.length === 0 ? (
                    <div
                      style={{
                        padding: 16,
                        textAlign: "center",
                        fontSize: 10,
                        color: "rgba(255,255,255,0.3)",
                        border: "1px dashed rgba(255,255,255,0.1)",
                        borderRadius: 6,
                      }}
                    >
                      Nenhum zero caçado ainda.<br />Ative a ferramenta e clique no gráfico!
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {foundZeros.map((item, idx) => (
                        <div
                          key={item.id}
                          style={{
                            padding: "8px 10px",
                            background: "rgba(234, 179, 8, 0.08)",
                            border: "1px solid rgba(234, 179, 8, 0.25)",
                            borderRadius: 6,
                            fontSize: 10,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <strong style={{ color: "#facc15" }}>Zero Encontrado #{foundZeros.length - idx}</strong>
                            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 8 }}>{item.time}</span>
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.85)", marginBottom: 2 }}>
                            s = {item.root.re.toFixed(6)} + {item.root.im.toFixed(6)}i
                          </div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", display: "flex", gap: 8 }}>
                            <span>Iterações: {item.steps.length}</span>
                            <span>|ζ| = {item.residual.toExponential(2)}</span>
                          </div>
                          <button
                            onClick={() =>
                              setView({
                                reMin: item.root.re - 2,
                                reMax: item.root.re + 2,
                                imMin: item.root.im - 2,
                                imMax: item.root.im + 2,
                              })
                            }
                            style={{
                              marginTop: 6,
                              width: "100%",
                              padding: "3px 0",
                              fontSize: 9,
                              background: "rgba(234, 179, 8, 0.2)",
                              border: "1px solid rgba(234, 179, 8, 0.4)",
                              borderRadius: 4,
                              color: "#fef08a",
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            Centralizar neste Zero
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TAB 3: SETTINGS & DISPLAY CUSTOMIZATION */}
            {activeSidebarTab === "settings" && (
              <>
                <div>
                  <SectionTitle>Camadas e Marcadores</SectionTitle>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { label: "Zeros Críticos (γₙ)", val: showCriticalZeros, set: setShowCriticalZeros, color: "#22c55e" },
                      { label: "Zeros Triviais (s < 0)", val: showTrivialZeros, set: setShowTrivialZeros, color: "#38bdf8" },
                      { label: "Linha Crítica Re(s) = ½", val: showCriticalLine, set: setShowCriticalLine, color: "#c084fc" },
                      { label: "Grade Cartesiana", val: showGrid, set: setShowGrid, color: "#ffffff" },
                      { label: "Anéis de Módulo |ζ|", val: showModulusRings, set: setShowModulusRings, color: "#eab308" },
                      { label: "Raios Isofásicos", val: showIsophases, set: setShowIsophases, color: "#ec4899" },
                    ].map(({ label, val, set, color }) => (
                      <label
                        key={label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 10,
                          cursor: "pointer",
                          color: val ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={val}
                          onChange={(e) => set(e.target.checked)}
                          style={{ accentColor: color }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <SectionTitle>Ajustes de Renderização GPU</SectionTitle>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 10 }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span>Densidade de Contornos</span>
                        <span style={{ color: "#38bdf8" }}>{contourDensity.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={3.0}
                        step={0.1}
                        value={contourDensity}
                        onChange={(e) => setContourDensity(Number(e.target.value))}
                        style={{ width: "100%", accentColor: "#38bdf8" }}
                      />
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span>Densidade Isofásica</span>
                        <span style={{ color: "#c084fc" }}>{isophaseDensity.toFixed(0)}</span>
                      </div>
                      <input
                        type="range"
                        min={4}
                        max={32}
                        step={2}
                        value={isophaseDensity}
                        onChange={(e) => setIsophaseDensity(Number(e.target.value))}
                        style={{ width: "100%", accentColor: "#c084fc" }}
                      />
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span>Brilho / Exposição</span>
                        <span style={{ color: "#facc15" }}>{brightness.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={2.0}
                        step={0.05}
                        value={brightness}
                        onChange={(e) => setBrightness(Number(e.target.value))}
                        style={{ width: "100%", accentColor: "#facc15" }}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* TAB 4: MATHEMATICAL THEORY & OBSERVER GUIDE */}
            {activeSidebarTab === "info" && (
              <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.7)", lineHeight: 1.6 }}>
                <SectionTitle>Fundamentos Matemáticos</SectionTitle>
                <p style={{ margin: "0 0 8px" }}>
                  A <strong>Função Zeta de Riemann</strong> é definida para $\Re(s) &gt; 1$ por:
                </p>
                <div style={{ padding: 6, background: "rgba(0,0,0,0.3)", borderRadius: 4, color: "#38bdf8", marginBottom: 8 }}>
                  ζ(s) = ∑ (1 / nˢ) = ∏ (1 - p⁻ˢ)⁻¹
                </div>
                <p style={{ margin: "0 0 8px" }}>
                  Por continuação analítica através da <strong>Equação Funcional de Reflexão</strong>:
                </p>
                <div style={{ padding: 6, background: "rgba(0,0,0,0.3)", borderRadius: 4, color: "#c084fc", marginBottom: 8 }}>
                  ζ(s) = 2ˢ πˢ⁻¹ sin(πs/2) Γ(1-s) ζ(1-s)
                </div>
                <SectionTitle>Leitura de Cores</SectionTitle>
                <ul style={{ paddingLeft: 16, margin: 0 }}>
                  <li><strong>Matiz / Cor</strong>: Argumento / Fase de ζ(s) [-π, π].</li>
                  <li><strong>Vórtices Escuros</strong>: Zeros (onde |ζ(s)| = 0).</li>
                  <li><strong>Picos Brancos</strong>: Polos (onde |ζ(s)| → ∞).</li>
                  <li><strong>Anéis Consecutivos</strong>: Escala logarítmica de magnitude.</li>
                </ul>
              </div>
            )}

            {/* Coordinates Footer */}
            <div
              style={{
                marginTop: "auto",
                padding: "8px 10px",
                background: "rgba(0, 0, 0, 0.25)",
                borderRadius: 6,
                fontSize: 9,
                color: "rgba(255, 255, 255, 0.4)",
                lineHeight: 1.6,
              }}
            >
              <div>Re: [{view.reMin.toFixed(2)}, {view.reMax.toFixed(2)}]</div>
              <div>Im: [{view.imMin.toFixed(2)}, {view.imMax.toFixed(2)}]</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Small UI Elements & Styles ────────────────────────────────────────────────
function Sep() {
  return <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "rgba(255, 255, 255, 0.4)",
        marginBottom: 8,
        paddingBottom: 4,
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      {children}
    </div>
  );
}

const baseBtnStyle: React.CSSProperties = {
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: 4,
  padding: "4px 8px",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 0.15s",
};

const toolBtnStyle = (active: boolean, activeColor: string): React.CSSProperties => ({
  background: active ? activeColor : "transparent",
  color: active ? "#000000" : "rgba(255, 255, 255, 0.7)",
  fontWeight: active ? 700 : 500,
  fontSize: 10,
  padding: "4px 10px",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 0.15s",
});

const selectStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.06)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 4,
  color: "rgba(255, 255, 255, 0.85)",
  fontSize: 10,
  padding: "3px 6px",
  fontFamily: "inherit",
  outline: "none",
};

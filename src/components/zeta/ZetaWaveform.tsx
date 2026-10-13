import { useEffect, useRef, useState, useCallback } from "react";
import { riemannSiegelZ, riemannZeta, KNOWN_ZEROS } from "./zetaMath";

interface ZetaWaveformProps {
  tMin: number;
  tMax: number;
  onSelectT: (t: number) => void;
  currentHoverT: number | null;
}

export function ZetaWaveform({ tMin, tMax, onSelectT, currentHoverT }: ZetaWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverInfo, setHoverInfo] = useState<{ t: number; zVal: number; modVal: number; x: number; y: number } | null>(null);

  const renderWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = container.clientWidth;
    const cssH = container.clientHeight;
    if (cssW === 0 || cssH === 0) return;

    const PW = Math.floor(cssW * dpr);
    const PH = Math.floor(cssH * dpr);

    canvas.width = PW;
    canvas.height = PH;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, PW, PH);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, PH);
    bgGrad.addColorStop(0, "rgba(15, 23, 42, 0.95)");
    bgGrad.addColorStop(1, "rgba(10, 15, 29, 0.98)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, PW, PH);

    // Coordinate transformation
    const toX = (t: number) => ((t - tMin) / (tMax - tMin)) * PW;

    // Sample points along t in range
    const numSamples = Math.min(600, Math.max(100, Math.floor(PW / 2)));
    const samples: { t: number; zVal: number; modVal: number }[] = [];

    let maxAbsZ = 1.0;
    for (let i = 0; i <= numSamples; i++) {
      const t = tMin + (i / numSamples) * (tMax - tMin);
      const zVal = riemannSiegelZ(t);
      const zComplex = riemannZeta({ re: 0.5, im: t });
      const modVal = Math.hypot(zComplex.re, zComplex.im);
      samples.push({ t, zVal, modVal });
      if (Math.abs(zVal) > maxAbsZ && isFinite(zVal)) maxAbsZ = Math.abs(zVal);
    }

    // Set vertical scale nicely with padding
    const yMax = Math.max(3.0, maxAbsZ * 1.2);
    const toY = (v: number) => PH * 0.5 - (v / yMax) * (PH * 0.42);

    // 1. Grid & Zero Line (Z = 0)
    const yZero = toY(0);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.moveTo(0, yZero);
    ctx.lineTo(PW, yZero);
    ctx.stroke();

    // 2. Mark visible critical zeros γ_n
    const visibleZeros = KNOWN_ZEROS.filter((z) => z >= tMin && z <= tMax);
    for (const z of visibleZeros) {
      const xZ = toX(z);
      // Vertical dash
      ctx.strokeStyle = "rgba(34, 197, 94, 0.5)";
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(xZ, 0);
      ctx.lineTo(xZ, PH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Zero dot on axis
      ctx.beginPath();
      ctx.arc(xZ, yZero, 4 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = "#22c55e";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();

      // Zero label
      ctx.fillStyle = "rgba(34, 197, 94, 0.9)";
      ctx.font = `${9 * dpr}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "center";
      ctx.fillText(`${z.toFixed(2)}`, xZ, PH - 6 * dpr);
    }

    // 3. Draw Modulus Envelope |ζ(1/2 + it)| (dashed cyan)
    ctx.strokeStyle = "rgba(6, 182, 212, 0.35)";
    ctx.lineWidth = 1.2 * dpr;
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const pt = samples[i];
      const x = toX(pt.t);
      const y = toY(pt.modVal);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Fill under Z(t) curve with subtle glowing gradient
    const areaGrad = ctx.createLinearGradient(0, 0, 0, PH);
    areaGrad.addColorStop(0, "rgba(168, 85, 247, 0.25)");
    areaGrad.addColorStop(0.5, "rgba(168, 85, 247, 0.05)");
    areaGrad.addColorStop(1, "rgba(59, 130, 246, 0.25)");

    ctx.fillStyle = areaGrad;
    ctx.beginPath();
    ctx.moveTo(toX(samples[0].t), yZero);
    for (let i = 0; i < samples.length; i++) {
      const pt = samples[i];
      ctx.lineTo(toX(pt.t), toY(pt.zVal));
    }
    ctx.lineTo(toX(samples[samples.length - 1].t), yZero);
    ctx.closePath();
    ctx.fill();

    // 5. Draw Primary Waveform Z(t) line (Neon Violet/Purple glow)
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 2.2 * dpr;
    ctx.shadowColor = "#a855f7";
    ctx.shadowBlur = 8 * dpr;
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const pt = samples[i];
      const x = toX(pt.t);
      const y = toY(pt.zVal);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 6. Highlight active hover position
    if (currentHoverT !== null && currentHoverT >= tMin && currentHoverT <= tMax) {
      const xH = toX(currentHoverT);
      const zH = riemannSiegelZ(currentHoverT);
      const yH = toY(zH);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 1 * dpr;
      ctx.setLineDash([2 * dpr, 2 * dpr]);
      ctx.beginPath();
      ctx.moveTo(xH, 0);
      ctx.lineTo(xH, PH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(xH, yH, 5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();
    }
  }, [tMin, tMax, currentHoverT]);

  useEffect(() => {
    renderWaveform();
  }, [renderWaveform]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => renderWaveform());
    ro.observe(container);
    return () => ro.disconnect();
  }, [renderWaveform]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const t = tMin + (x / rect.width) * (tMax - tMin);
    const zVal = riemannSiegelZ(t);
    const zetaVal = riemannZeta({ re: 0.5, im: t });
    const modVal = Math.hypot(zetaVal.re, zetaVal.im);
    setHoverInfo({ t, zVal, modVal, x: e.clientX, y: e.clientY });
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const t = tMin + (x / rect.width) * (tMax - tMin);
    onSelectT(t);
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
        cursor: "crosshair",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverInfo(null)}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />

      {/* Header Badge */}
      <div
        style={{
          position: "absolute",
          top: 6,
          left: 10,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 10,
          color: "rgba(255,255,255,0.7)",
          fontFamily: "'JetBrains Mono', monospace",
          pointerEvents: "none",
        }}
      >
        <span style={{ fontWeight: 700, color: "#a855f7" }}>Z(t) Riemann-Siegel</span>
        <span style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
        <span style={{ color: "rgba(6, 182, 212, 0.8)" }}>|ζ(½ + it)|</span>
        <span style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
        <span style={{ color: "rgba(34, 197, 94, 0.9)" }}>● Zeros na Linha Crítica</span>
      </div>

      {/* Floating Tooltip */}
      {hoverInfo && (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 10,
            background: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(168, 85, 247, 0.3)",
            borderRadius: 4,
            padding: "3px 8px",
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            color: "rgba(255,255,255,0.9)",
            pointerEvents: "none",
            display: "flex",
            gap: 12,
          }}
        >
          <span>
            t = <strong style={{ color: "#38bdf8" }}>{hoverInfo.t.toFixed(4)}</strong>
          </span>
          <span>
            Z(t) = <strong style={{ color: "#a855f7" }}>{hoverInfo.zVal.toFixed(4)}</strong>
          </span>
          <span>
            |ζ| = <strong style={{ color: "#22c55e" }}>{hoverInfo.modVal.toFixed(4)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

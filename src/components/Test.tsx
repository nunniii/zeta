/**
 * Test.tsx — Domain Coloring Visualizer
 *
 * Renderiza o "domain coloring" de f: ℂ → ℂ no plano complexo.
 * Cada pixel (x, y) mapeia para z = x + iy. A cor é dada por:
 *   Matiz  H = (arg f(z) + π) / 2π    →  fase ∈ [−π, π] → cor no espectro
 *   Brilho V = (2/π) · arctan|f(z)|   →  módulo comprimido em [0, 1)
 *
 * Eixos e rótulos são desenhados no mesmo canvas, sobre o domain coloring.
 *
 * Dependências: React, TypeScript, Tailwind CSS — zero libs externas.
 */

import { useRef, useEffect, useState, useCallback } from "react";

// ─── Tipos e aritmética complexa ─────────────────────────────────────────────

/** Número complexo z = re + im·i */
type C = { re: number; im: number };

/** Operações complexas — todas puras (sem mutação). */
const cx = {
  add: (a: C, b: C): C => ({ re: a.re + b.re,                         im: a.im + b.im }),
  sub: (a: C, b: C): C => ({ re: a.re - b.re,                         im: a.im - b.im }),
  mul: (a: C, b: C): C => ({ re: a.re * b.re - a.im * b.im,           im: a.re * b.im + a.im * b.re }),
  div: (a: C, b: C): C => {
    const d = b.re ** 2 + b.im ** 2;
    return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
  },
  abs: (a: C): number => Math.sqrt(a.re ** 2 + a.im ** 2),
  arg: (a: C): number => Math.atan2(a.im, a.re),
  /** z^n por multiplicação iterativa (n inteiro) */
  pow: (a: C, n: number): C => {
    if (n === 0) return { re: 1, im: 0 };
    const base = n < 0 ? cx.div({ re: 1, im: 0 }, a) : a;
    let r: C = { re: 1, im: 0 };
    for (let i = 0; i < Math.abs(n); i++) r = cx.mul(r, base);
    return r;
  },
  /** e^z = e^a (cos b + i sin b) */
  exp: (a: C): C => { const r = Math.exp(a.re); return { re: r * Math.cos(a.im), im: r * Math.sin(a.im) }; },
  /** log z = ln|z| + i·arg z  (ramo principal) */
  log: (a: C): C => ({ re: Math.log(cx.abs(a)), im: cx.arg(a) }),
  sin: (a: C): C => ({ re: Math.sin(a.re) * Math.cosh(a.im),  im: Math.cos(a.re) * Math.sinh(a.im) }),
  cos: (a: C): C => ({ re: Math.cos(a.re) * Math.cosh(a.im),  im: -Math.sin(a.re) * Math.sinh(a.im) }),
};





// ─── 💚💖 Funções predefinidas ─────────────────────────────────────────────────────

const PRESETS: { label: string; description: string; fn: (z: C) => C }[] = [
  {
    label: "z² + 1",
    description: "Polinomial — zeros em z = ±i",
    fn: z => cx.add(cx.pow(z, 2), { re: 1, im: 0 }),
  },
  {
    label: "z³ − 1",
    description: "Raízes cúbicas da unidade — três zeros",
    fn: z => cx.sub(cx.pow(z, 3), { re: 1, im: 0 }),
  },
  {
    label: "sin(z)",
    description: "Seno complexo — zeros em kπ, k ∈ ℤ",
    fn: z => cx.sin(z),
  },
  {
    label: "1/z",
    description: "Inversão — polo simples em z = 0",
    fn: z => cx.div({ re: 1, im: 0 }, z),
  },
  {
    label: "z²",
    description: "Z^2",
    fn: z => cx.pow(z, 2),
  },
  {
    label: "(z²−1)/z²",
    description: "Dois zeros ±1 e polo duplo em 0",
    fn: z => cx.div(cx.sub(cx.pow(z, 2), { re: 1, im: 0 }), cx.pow(z, 2)),
  },
];

// ─── Cor: HSV → RGB ───────────────────────────────────────────────────────────

/** HSV ∈ [0,1]³  →  RGB ∈ [0,255]³ */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6) % 6;
  const f = h * 6 - Math.floor(h * 6);
  const [p, q, t] = [v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)];
  const [r, g, b] = ([
    [v, t, p], [q, v, p], [p, v, t],
    [p, q, v], [t, p, v], [v, p, q],
  ] as [number, number, number][])[i];
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Cor do pixel dado f(z):
 *   H = fase normalizada em [0,1]
 *   V = módulo comprimido via arctan em [0,1)
 *   S = 1 (sempre saturado)
 */
function pixelColor(fz: C): [number, number, number] {
  return hsvToRgb(
    (cx.arg(fz) + Math.PI) / (2 * Math.PI),   // H
    1,                                          // S
    (2 / Math.PI) * Math.atan(cx.abs(fz)),     // V
  );
}

// ─── Viewport ─────────────────────────────────────────────────────────────────

/** Descreve a janela de visualização no plano complexo. */
interface Viewport {
  /** Parte real do centro da tela */
  centerRe: number;
  /** Parte imaginária do centro da tela */
  centerIm: number;
  /** Unidades complexas por pixel */
  scale: number;
}

const DEFAULT_VP: Viewport = { centerRe: 0, centerIm: 0, scale: 0.006 };

/** Pixel (px, py) → número complexo z */
function toComplex(px: number, py: number, W: number, H: number, vp: Viewport): C {
  return {
    re: vp.centerRe + (px - W / 2) * vp.scale,
    im: vp.centerIm - (py - H / 2) * vp.scale,  // Y para cima
  };
}

/** Número complexo z → pixel (px, py) */
function toScreen(z: C, W: number, H: number, vp: Viewport): [number, number] {
  return [
    W / 2 + (z.re - vp.centerRe) / vp.scale,
    H / 2 - (z.im - vp.centerIm) / vp.scale,
  ];
}

// ─── Renderização de eixos ────────────────────────────────────────────────────

/**
 * Desenha eixos Re e Im com marcas e rótulos numéricos sobre o ctx.
 * Calcula automaticamente o espaçamento entre marcas com base no zoom.
 */
function drawAxes(ctx: CanvasRenderingContext2D, W: number, H: number, vp: Viewport) {
  const [ox, oy] = toScreen({ re: 0, im: 0 }, W, H, vp);

  // Escolhe espaçamento "bonito" entre marcas (potências de 10 ou meios)
  const rawStep = vp.scale * 80;                       // ~80px entre marcas
  const mag     = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step    = rawStep / mag < 2 ? mag : rawStep / mag < 5 ? 2 * mag : 5 * mag;

  ctx.save();

  // ── Linhas dos eixos ──
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, oy); ctx.lineTo(W, oy);   // eixo Re (horizontal)
  ctx.moveTo(ox, 0); ctx.lineTo(ox, H);   // eixo Im (vertical)
  ctx.stroke();

  // Rótulos dos eixos
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.font      = "bold 11px monospace";
  ctx.fillText("Re", W - 20, oy - 6);
  ctx.fillText("Im", ox + 6,  14);

  // ── Marcas e números ──
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.fillStyle   = "rgba(255,255,255,0.55)";
  ctx.font        = "10px monospace";
  ctx.lineWidth   = 1;

  const fmt = (n: number) => {
    // Evita "-0" e formata com poucos decimais
    const s = parseFloat(n.toPrecision(4));
    return s === 0 ? "0" : String(s);
  };

  // Marcas no eixo Re (horizontal)
  const reMin = vp.centerRe - (W / 2) * vp.scale;
  const reMax = vp.centerRe + (W / 2) * vp.scale;
  for (let v = Math.ceil(reMin / step) * step; v <= reMax; v += step) {
    if (Math.abs(v) < step * 0.01) continue;   // pula a origem
    const [px] = toScreen({ re: v, im: 0 }, W, H, vp);
    ctx.beginPath();
    ctx.moveTo(px, oy - 4); ctx.lineTo(px, oy + 4);
    ctx.stroke();
    ctx.fillText(fmt(v), px - 10, oy + 15);
  }

  // Marcas no eixo Im (vertical)
  const imMin = vp.centerIm - (H / 2) * vp.scale;
  const imMax = vp.centerIm + (H / 2) * vp.scale;
  for (let v = Math.ceil(imMin / step) * step; v <= imMax; v += step) {
    if (Math.abs(v) < step * 0.01) continue;
    const [, py] = toScreen({ re: 0, im: v }, W, H, vp);
    ctx.beginPath();
    ctx.moveTo(ox - 4, py); ctx.lineTo(ox + 4, py);
    ctx.stroke();
    ctx.fillText(fmt(v) + "i", ox + 7, py + 3);
  }

  ctx.restore();
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function Test() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [vp,      setVp]      = useState<Viewport>(DEFAULT_VP);
  const [preset,  setPreset]  = useState(0);
  const [hover,   setHover]   = useState<{ z: C; fz: C } | null>(null);

  const dragging = useRef(false);
  const lastPos  = useRef({ x: 0, y: 0 });

  const fn = PRESETS[preset].fn;

  // ─── Renderização ────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width: W, height: H } = canvas;

    // 1. Preenche o ImageData com o domain coloring pixel a pixel
    const img  = ctx.createImageData(W, H);
    const data = img.data;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const z  = toComplex(px, py, W, H, vp);
        let fz: C;
        try { fz = fn(z); } catch { fz = { re: NaN, im: NaN }; }

        const i = (py * W + px) * 4;
        if (!isFinite(fz.re) || !isFinite(fz.im)) {
          data[i] = data[i+1] = data[i+2] = 0;   // singularidade → preto
        } else {
          const [r, g, b] = pixelColor(fz);
          data[i] = r; data[i+1] = g; data[i+2] = b;
        }
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // 2. Sobrepõe eixos e rótulos via Canvas 2D API
    drawAxes(ctx, W, H, vp);
  }, [vp, fn]);

  // ─── Interação ───────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const { left, top } = canvas.getBoundingClientRect();
    const mx = e.clientX - left;
    const my = e.clientY - top;
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    setVp(prev => {
      // Ponto sob o cursor permanece fixo após o zoom
      const zc = toComplex(mx, my, canvas.width, canvas.height, prev);
      const ns = prev.scale * factor;
      return {
        scale:    ns,
        centerRe: zc.re - (mx - canvas.width  / 2) * ns,
        centerIm: zc.im + (my - canvas.height / 2) * ns,
      };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current  = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const { left, top, width, height } = canvas.getBoundingClientRect();
    // Converte posição CSS → pixels do canvas (DPR-agnostic)
    const px = (e.clientX - left) * (canvas.width  / width);
    const py = (e.clientY - top)  * (canvas.height / height);
    const z  = toComplex(px, py, canvas.width, canvas.height, vp);
    try { setHover({ z, fz: fn(z) }); } catch { setHover(null); }

    if (dragging.current) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      setVp(prev => ({
        ...prev,
        centerRe: prev.centerRe - dx * prev.scale,
        centerIm: prev.centerIm + dy * prev.scale,
      }));
    }
  }, [vp, fn]);

  const handleMouseUp    = useCallback(() => { dragging.current = false; }, []);
  const handleMouseLeave = useCallback(() => { dragging.current = false; setHover(null); }, []);

  // ─── Formatação ──────────────────────────────────────────────────────────

  const f4   = (n: number) => n.toFixed(4);
  const fmtC = (z: C) => `${f4(z.re)} ${z.im >= 0 ? "+" : "−"} ${f4(Math.abs(z.im))}i`;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-[#0e0e10] text-white font-mono select-none">

      {/* Cabeçalho */}
      <header className="text-center py-2.5 border-b border-white/10 shrink-0">
        <h1 className="text-sm font-semibold tracking-widest text-white/90">Domain Coloring</h1>
        <p className="text-[10px] text-white/35">Visualização de funções complexas</p>
      </header>

      {/* Canvas — ocupa todo o espaço disponível */}
      <div className="relative flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={960}
          height={620}
          className="w-full h-full cursor-crosshair"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />

        {/* Dica de uso */}
        <div className="absolute top-3 left-3 bg-black/55 text-white/50 text-[10px] leading-[1.7] px-2.5 py-2 rounded pointer-events-none">
          <div>⠿ Arrastar: mover</div>
          <div>⊕ Scroll: zoom</div>
          <div>· Mouse: inspecionar</div>
        </div>

        {/* Legenda da roda de cores */}
        <div className="absolute bottom-3 right-3 bg-black/55 text-[10px] text-white/50 px-3 py-2 rounded flex items-center gap-2.5 pointer-events-none">
          <ColorWheel size={34} />
          <div className="leading-[1.7]">
            <div>Cor → arg f(z)</div>
            <div>Brilho → |f(z)|</div>
          </div>
        </div>

        {/* Painel hover */}
        {hover && (
          <div className="absolute top-3 right-3 bg-black/65 text-[10px] text-white/65 px-3 py-2 rounded leading-[1.75] pointer-events-none">
            <div><span className="text-white/35">z =</span> {fmtC(hover.z)}</div>
            <div><span className="text-white/35">f(z) =</span> {fmtC(hover.fz)}</div>
            <div><span className="text-white/35">|f(z)| =</span> {f4(cx.abs(hover.fz))}</div>
            <div><span className="text-white/35">arg f(z) =</span> {f4(cx.arg(hover.fz))} rad</div>
          </div>
        )}
      </div>

      {/* Rodapé — seletor de função */}
      <footer className="border-t border-white/10 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 shrink-0">

        {/* Botões de preset */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => setPreset(i)}
              className={`text-[10px] px-2.5 py-1 rounded border transition-colors ${
                preset === i
                  ? "border-cyan-400 text-cyan-300 bg-cyan-400/10"
                  : "border-white/15 text-white/45 hover:border-white/35 hover:text-white/70"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Descrição da função ativa */}
        <div className="text-[10px] text-white/35 italic">
          f(z) = <span className="not-italic text-cyan-400/80">{PRESETS[preset].label}</span>
          <span className="mx-2 text-white/20">·</span>
          {PRESETS[preset].description}
        </div>
      </footer>
    </div>
  );
}

// ─── Sub-componente: roda HSV ─────────────────────────────────────────────────

/** Roda de cores HSV gerada como SVG — ilustra a convenção de fase → cor. */
function ColorWheel({ size }: { size: number }) {
  const r = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ borderRadius: "50%" }}>
      {Array.from({ length: 360 }, (_, i) => {
        const a0 = (i - 0.5) * (Math.PI / 180);
        const a1 = (i + 0.5) * (Math.PI / 180);
        const [cr, cg, cb] = hsvToRgb(i / 360, 1, 1);
        const x0 = r + (r - 1) * Math.cos(a0), y0 = r + (r - 1) * Math.sin(a0);
        const x1 = r + (r - 1) * Math.cos(a1), y1 = r + (r - 1) * Math.sin(a1);
        return (
          <path key={i} d={`M${r} ${r} L${x0} ${y0} A${r-1} ${r-1} 0 0 1 ${x1} ${y1}Z`}
            fill={`rgb(${cr},${cg},${cb})`} />
        );
      })}
    </svg>
  );
}
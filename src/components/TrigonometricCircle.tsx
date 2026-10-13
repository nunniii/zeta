import React, { useMemo, useState, useEffect, useRef } from "react";
import "../styles/for_components/TrigonometricCircle.scss";

// Constantes visuais do SVG
const SVG_SIZE = 640;
const CENTER = SVG_SIZE / 2;
const R = 190; // Raio em pixels para a unidade 1.0

type StudyMode = "fundamental" | "two_points" | "roots_of_unity" | "de_moivre";

// Helpers matemáticos
const TWO_PI = 2 * Math.PI;

function normalizeAngle(angle: number): number {
  let a = angle % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a;
}

function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function formatPiFraction(angleRad: number): string {
  const norm = normalizeAngle(angleRad);
  if (Math.abs(norm) < 1e-4 || Math.abs(norm - TWO_PI) < 1e-4) return "0";
  if (Math.abs(norm - Math.PI) < 1e-4) return "π";

  const frac = norm / Math.PI;
  for (const d of [1, 2, 3, 4, 6, 8, 12, 16, 24]) {
    const n = Math.round(frac * d);
    if (Math.abs(frac - n / d) < 0.002) {
      const g = gcd(n, d);
      const num = n / g;
      const den = d / g;
      if (den === 1) return num === 1 ? "π" : `${num}π`;
      if (num === 1) return `π/${den}`;
      return `${num}π/${den}`;
    }
  }
  return `${(norm / Math.PI).toFixed(3)}π`;
}

function formatNum(val: number | null, decimals = 4): string {
  if (val === null || !isFinite(val)) return "Indefinido (±∞)";
  if (Math.abs(val) < 1e-9) return "0";
  if (Math.abs(val - 1) < 1e-9) return "1";
  if (Math.abs(val + 1) < 1e-9) return "-1";
  return val.toFixed(decimals);
}

function polarToSvg(angle: number, radius = R): { x: number; y: number } {
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER - radius * Math.sin(angle),
  };
}

function createArcD(
  startAngle: number,
  endAngle: number,
  radius: number
): string {
  const start = polarToSvg(startAngle, radius);
  const end = polarToSvg(endAngle, radius);

  // Calcula a diferença angular positiva
  let diff = normalizeAngle(endAngle - startAngle);
  if (diff === 0) diff = TWO_PI;

  const largeArcFlag = diff > Math.PI ? 1 : 0;
  // No SVG (onde Y é invertido), sentido trigonométrico anti-horário usa sweepFlag = 0
  const sweepFlag = 0;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
}

// Ângulos notáveis para o recurso de imã / snap
const NOTABLE_ANGLES = [
  0,
  Math.PI / 6,
  Math.PI / 4,
  Math.PI / 3,
  Math.PI / 2,
  (2 * Math.PI) / 3,
  (3 * Math.PI) / 4,
  (5 * Math.PI) / 6,
  Math.PI,
  (7 * Math.PI) / 6,
  (5 * Math.PI) / 4,
  (4 * Math.PI) / 3,
  (3 * Math.PI) / 2,
  (5 * Math.PI) / 3,
  (7 * Math.PI) / 4,
  (11 * Math.PI) / 6,
];

export default function TrigonometricCircle() {
  // Estado do modo de estudo
  const [mode, setMode] = useState<StudyMode>("fundamental");

  // Ângulos principais
  const [theta, setTheta] = useState<number>(Math.PI / 3); // 60° default
  const [theta2, setTheta2] = useState<number>((5 * Math.PI) / 6); // 150° para modo dois pontos
  const [numRoots, setNumRoots] = useState<number>(5); // Para modo raízes da unidade (pentágono default)
  const [deMoivrePowers, setDeMoivrePowers] = useState<number>(6); // Potências no modo De Moivre

  // Configurações de interação
  const [snapToNotable, setSnapToNotable] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [animSpeed, setAnimSpeed] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"chords" | "complex" | "trig" | "theorems" | "layers">("chords");

  // Camadas visíveis
  const [visible, setVisible] = useState({
    circle: true,
    grid: true,
    axes: true,
    notableTicks: true,
    radius: true,
    arc: true,
    chord: true,
    apothem: true,
    sagitta: true,
    sine: true,
    cosine: true,
    tangent: false,
    cotangent: false,
    secant: false,
    cosecant: false,
    eulerTriangle: true,
    conjugate: true,
    chordVector: true,
    inscribedAngle: true,
    rootsChords: true,
  });

  const toggleLayer = (key: keyof typeof visible) => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Referência do SVG para cálculos de ponteiro
  const svgRef = useRef<SVGSVGElement | null>(null);
  const isDragging = useRef<"p1" | "p2" | null>(null);

  // Animação de rotação contínua
  useEffect(() => {
    if (!isPlaying) return;
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      const dTheta = dt * 0.4 * animSpeed;
      setTheta((prev) => normalizeAngle(prev + dTheta));
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, animSpeed]);

  // Aplica snap a ângulos notáveis se habilitado
  const applySnap = (rawAngle: number): number => {
    const norm = normalizeAngle(rawAngle);
    if (!snapToNotable) return norm;

    const threshold = 0.05; // ~2.8 graus
    for (const notable of NOTABLE_ANGLES) {
      if (Math.abs(norm - notable) < threshold) {
        return notable;
      }
      if (Math.abs(norm - (notable + TWO_PI)) < threshold) {
        return notable;
      }
    }
    return norm;
  };

  // Tratamento de ponteiro (arrasto livre e suave no círculo)
  const getAngleFromEvent = (e: React.PointerEvent<SVGSVGElement>): number => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = -(e.clientY - cy); // Inverte Y cartesiano
    let a = Math.atan2(dy, dx);
    return normalizeAngle(a);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const targetAngle = getAngleFromEvent(e);

    if (mode === "two_points") {
      // Determina qual ponto está mais próximo do clique
      const dist1 = Math.abs(normalizeAngle(targetAngle - theta));
      const dist2 = Math.abs(normalizeAngle(targetAngle - theta2));
      const d1 = Math.min(dist1, TWO_PI - dist1);
      const d2 = Math.min(dist2, TWO_PI - dist2);

      if (d1 <= d2) {
        isDragging.current = "p1";
        setTheta(applySnap(targetAngle));
      } else {
        isDragging.current = "p2";
        setTheta2(applySnap(targetAngle));
      }
    } else {
      isDragging.current = "p1";
      setTheta(applySnap(targetAngle));
    }

    if (svgRef.current) {
      svgRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging.current) return;
    const targetAngle = getAngleFromEvent(e);
    const snapped = applySnap(targetAngle);

    if (isDragging.current === "p1") {
      setTheta(snapped);
    } else if (isDragging.current === "p2") {
      setTheta2(snapped);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    isDragging.current = null;
    if (svgRef.current) {
      try {
        svgRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // Ignora erro caso já tenha sido liberado
      }
    }
  };

  // -------------------------------------------------------------
  // Cálculos Fundamentais de Trigonometria e Cordas
  // -------------------------------------------------------------
  const math = useMemo(() => {
    const sin = Math.sin(theta);
    const cos = Math.cos(theta);
    const tan = Math.abs(cos) < 1e-5 ? null : sin / cos;
    const cot = Math.abs(sin) < 1e-5 ? null : cos / sin;
    const sec = Math.abs(cos) < 1e-5 ? null : 1 / cos;
    const csc = Math.abs(sin) < 1e-5 ? null : 1 / sin;

    // Corda fundamental: crd(θ) = 2 sin(θ/2) = |z - 1|
    const halfAngle = theta / 2;
    const chord = 2 * Math.sin(halfAngle); // Comprimento euclidiano na unidade
    const apothem = Math.cos(halfAngle); // Distância da origem ao ponto médio da corda
    const sagitta = 1 - apothem; // Altura do arco = 1 - cos(θ/2)
    const versine = 1 - cos; // versin(θ) = 1 - cos(θ)
    const coversine = 1 - sin; // coversin(θ) = 1 - sin(θ)
    const haversine = (1 - cos) / 2; // hav(θ) = sin²(θ/2) = crd²(θ)/4
    const exsecant = sec !== null ? sec - 1 : null; // exsec(θ) = sec(θ) - 1

    // Pontos geométricos no SVG
    const p0 = polarToSvg(0, R); // Ponto inicial (1, 0)
    const pZ = polarToSvg(theta, R); // Ponto P(z) = (cos θ, sin θ)
    const pConj = polarToSvg(-theta, R); // Ponto P(z*) = (cos θ, -sin θ)

    // Ponto Médio da corda fundamental: M = (z + 1)/2
    // Em polares, M tem ângulo θ/2 e raio R * cos(θ/2)
    const pM = polarToSvg(halfAngle, R * apothem);

    // Ponto da Bissetriz no Círculo: raio 1 na direção θ/2
    const pBisector = polarToSvg(halfAngle, R);

    // Projeções cartesianas
    const pCos = { x: pZ.x, y: CENTER }; // Projeção no eixo real X
    const pSin = { x: CENTER, y: pZ.y }; // Projeção no eixo imag Y

    // Pontos das funções trigonométricas tangenciais
    const pTan = tan !== null ? { x: CENTER + R, y: CENTER - R * tan } : null;
    const pCot = cot !== null ? { x: CENTER + R * cot, y: CENTER - R } : null;
    const pSec = sec !== null ? { x: CENTER + R * sec, y: CENTER } : null;
    const pCsc = csc !== null ? { x: CENTER, y: CENTER - R * csc } : null;

    // Área do triângulo isósceles formado pela corda e raios: A = 1/2 * R² * sin(θ)
    const triangleArea = 0.5 * Math.abs(sin);
    // Área do setor circular: A_setor = 1/2 * R² * θ
    const sectorArea = 0.5 * theta;
    // Área do segmento circular: A_seg = A_setor - A_triangulo
    const segmentArea = sectorArea - triangleArea;

    return {
      sin,
      cos,
      tan,
      cot,
      sec,
      csc,
      chord,
      apothem,
      sagitta,
      versine,
      coversine,
      haversine,
      exsecant,
      halfAngle,
      triangleArea,
      sectorArea,
      segmentArea,
      p0,
      pZ,
      pConj,
      pM,
      pBisector,
      pCos,
      pSin,
      pTan,
      pCot,
      pSec,
      pCsc,
    };
  }, [theta]);

  // -------------------------------------------------------------
  // Cálculos do Modo Dois Pontos (Corda Geral z1 -> z2)
  // -------------------------------------------------------------
  const twoPointsMath = useMemo(() => {
    const p1 = polarToSvg(theta, R);
    const p2 = polarToSvg(theta2, R);

    let deltaAngle = normalizeAngle(theta2 - theta);
    const chordLen = 2 * Math.sin(deltaAngle / 2);
    const bisectorAngle = normalizeAngle(theta + deltaAngle / 2);
    const apothemLen = Math.cos(deltaAngle / 2);
    const sagittaLen = 1 - apothemLen;

    const pMid = polarToSvg(bisectorAngle, R * apothemLen);
    const pBis = polarToSvg(bisectorAngle, R);

    // Ponto para ângulo inscrito no arco oposto
    const oppositeAngle = normalizeAngle(bisectorAngle + Math.PI);
    const pInscribed = polarToSvg(oppositeAngle, R);

    return {
      p1,
      p2,
      deltaAngle,
      chordLen,
      bisectorAngle,
      apothemLen,
      sagittaLen,
      pMid,
      pBis,
      pInscribed,
      inscribedAngle: deltaAngle / 2,
    };
  }, [theta, theta2]);

  // -------------------------------------------------------------
  // Cálculos do Modo Raízes da Unidade (Polígonos & Produto de Cordas)
  // -------------------------------------------------------------
  const rootsMath = useMemo(() => {
    const n = Math.max(3, Math.min(24, numRoots));
    const roots: {
      k: number;
      angle: number;
      point: { x: number; y: number };
      chordFromZ0: number;
      zReal: number;
      zImag: number;
    }[] = [];

    let chordProduct = 1;

    for (let k = 0; k < n; k++) {
      // Permite girar o polígono com base no ângulo theta para estudo dinâmico
      const angle = normalizeAngle(theta + (TWO_PI * k) / n);
      const point = polarToSvg(angle, R);
      const diffAngle = (TWO_PI * k) / n;
      const chordFromZ0 = k === 0 ? 0 : 2 * Math.sin(diffAngle / 2);

      if (k > 0) {
        chordProduct *= chordFromZ0;
      }

      roots.push({
        k,
        angle,
        point,
        chordFromZ0,
        zReal: Math.cos(angle),
        zImag: Math.sin(angle),
      });
    }

    // Teorema de Gauss/Euler: o produto de todas as cordas saindo de z0 para os demais vértices é exatamente n!
    return {
      n,
      roots,
      chordProduct,
      polygonSide: 2 * Math.sin(Math.PI / n),
      perimeter: n * 2 * Math.sin(Math.PI / n),
    };
  }, [numRoots, theta]);

  // -------------------------------------------------------------
  // Cálculos do Modo De Moivre (Potências z^k)
  // -------------------------------------------------------------
  const deMoivreMath = useMemo(() => {
    const powers: {
      k: number;
      angle: number;
      point: { x: number; y: number };
      zReal: number;
      zImag: number;
    }[] = [];

    for (let k = 0; k <= deMoivrePowers; k++) {
      const angle = normalizeAngle(k * theta);
      const point = polarToSvg(angle, R);
      powers.push({
        k,
        angle,
        point,
        zReal: Math.cos(angle),
        zImag: Math.sin(angle),
      });
    }

    return { powers };
  }, [theta, deMoivrePowers]);

  return (
    <section className="trigonometric-circle">
      {/* ========================================================= */}
      {/* HEADER: Título, Modos e Info do Ângulo */}
      {/* ========================================================= */}
      <header className="trigonometric-circle__header">
        <div className="trigonometric-circle__title-group">
          <div className="trigonometric-circle__badge">
            <span className="dot" />
            ANÁLISE HARMÔNICA &amp; NÚMEROS COMPLEXOS
          </div>
          <h2>Círculo Trigonométrico &amp; Cordas de Euler</h2>
          <p className="trigonometric-circle__subtitle">
            Estudo das cordas unitárias crd(θ) = |z - 1|, relações com o plano ℂ, apótemas, sagitas e projeções trigonométricas.
          </p>
        </div>

        {/* Seletor de Modo */}
        <div className="trigonometric-circle__mode-selector">
          <button
            className={`mode-btn ${mode === "fundamental" ? "active" : ""}`}
            onClick={() => setMode("fundamental")}
            title="Corda fundamental a partir do polo (1, 0) e todas as projeções trigonométricas"
          >
            <span className="icon">🎯</span>
            <span className="label">Corda Fundamental</span>
          </button>
          <button
            className={`mode-btn ${mode === "two_points" ? "active" : ""}`}
            onClick={() => setMode("two_points")}
            title="Dois pontos arbitrários z1 e z2 no círculo: ângulo central vs ângulo inscrito"
          >
            <span className="icon">↔️</span>
            <span className="label">Dois Pontos (z₁ → z₂)</span>
          </button>
          <button
            className={`mode-btn ${mode === "roots_of_unity" ? "active" : ""}`}
            onClick={() => setMode("roots_of_unity")}
            title="Polígonos regulares e o Teorema do Produto de Cordas de Gauss"
          >
            <span className="icon">⬡</span>
            <span className="label">Raízes da Unidade (ζᵏ)</span>
          </button>
          <button
            className={`mode-btn ${mode === "de_moivre" ? "active" : ""}`}
            onClick={() => setMode("de_moivre")}
            title="Potências sucessivas de z = e^(iθ) e cordas de passo angular constante"
          >
            <span className="icon">🌀</span>
            <span className="label">De Moivre (zᵏ)</span>
          </button>
        </div>

        {/* Display do Ângulo */}
        <div className="trigonometric-circle__angle-card">
          <div className="angle-main">
            <span className="deg">{((theta * 180) / Math.PI).toFixed(1)}°</span>
            <span className="rad-frac">{formatPiFraction(theta)} rad</span>
          </div>
          <div className="angle-sub">
            <span>{(theta / Math.PI).toFixed(4)}π</span>
            <span>{(theta / TWO_PI).toFixed(3)} rev</span>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* BODY: Visualizador SVG + Painel Analítico */}
      {/* ========================================================= */}
      <div className="trigonometric-circle__body">
        {/* Visualizador SVG Interativo */}
        <div className="trigonometric-circle__visual">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            className="trigonometric-circle__svg"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <defs>
              {/* Filtro de Glow Neon Suave */}
              <filter id="glow-purple" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Marcadores de Seta */}
              <marker
                id="arrow-cyan"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto"
              >
                <path d="M 0 1 L 7 4 L 0 7 Z" fill="#38bdf8" />
              </marker>
              <marker
                id="arrow-purple"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto"
              >
                <path d="M 0 1 L 7 4 L 0 7 Z" fill="#c084fc" />
              </marker>
              <marker
                id="arrow-axis"
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
              >
                <path d="M 0 0 L 6 3 L 0 6 Z" fill="#64748b" />
              </marker>

              {/* Gradiente do Setor Circular */}
              <radialGradient id="sector-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(56, 189, 248, 0.18)" />
                <stop offset="100%" stopColor="rgba(192, 132, 252, 0.04)" />
              </radialGradient>
            </defs>

            {/* 1. Grid & Círculos Concêntricos */}
            {visible.grid && (
              <g className="grid-layer">
                <circle cx={CENTER} cy={CENTER} r={R * 0.25} className="grid-circle sub" />
                <circle cx={CENTER} cy={CENTER} r={R * 0.5} className="grid-circle" />
                <circle cx={CENTER} cy={CENTER} r={R * 0.75} className="grid-circle sub" />
                <circle cx={CENTER} cy={CENTER} r={R * 1.25} className="grid-circle sub" />
                <circle cx={CENTER} cy={CENTER} r={R * 1.5} className="grid-circle" />

                {/* Raios guias a cada 30° e 45° */}
                {NOTABLE_ANGLES.map((ang, idx) => {
                  const p = polarToSvg(ang, R * 1.5);
                  return (
                    <line
                      key={idx}
                      x1={CENTER}
                      y1={CENTER}
                      x2={p.x}
                      y2={p.y}
                      className="grid-ray"
                    />
                  );
                })}
              </g>
            )}

            {/* 2. Eixos de Argand-Gauss (Re e Im) */}
            {visible.axes && (
              <g className="axes-layer">
                <line
                  x1={CENTER - R * 1.55}
                  y1={CENTER}
                  x2={CENTER + R * 1.55}
                  y2={CENTER}
                  className="axis-line"
                  markerEnd="url(#arrow-axis)"
                />
                <line
                  x1={CENTER}
                  y1={CENTER + R * 1.55}
                  x2={CENTER}
                  y2={CENTER - R * 1.55}
                  className="axis-line"
                  markerEnd="url(#arrow-axis)"
                />

                {/* Marcadores de Unidade 1, -1, i, -i */}
                <circle cx={CENTER + R} cy={CENTER} r="3" className="axis-tick" />
                <circle cx={CENTER - R} cy={CENTER} r="3" className="axis-tick" />
                <circle cx={CENTER} cy={CENTER - R} r="3" className="axis-tick" />
                <circle cx={CENTER} cy={CENTER + R} r="3" className="axis-tick" />

                <text x={CENTER + R + 14} y={CENTER - 10} className="axis-label-unit">
                  +1 (Re)
                </text>
                <text x={CENTER - R - 38} y={CENTER - 10} className="axis-label-unit">
                  -1
                </text>
                <text x={CENTER + 10} y={CENTER - R - 12} className="axis-label-unit">
                  +i (Im)
                </text>
                <text x={CENTER + 10} y={CENTER + R + 18} className="axis-label-unit">
                  -i
                </text>
              </g>
            )}

            {/* 3. Ticks dos Ângulos Notáveis no Círculo */}
            {visible.notableTicks && (
              <g className="notable-ticks">
                {NOTABLE_ANGLES.map((ang, idx) => {
                  const pInner = polarToSvg(ang, R - 5);
                  const pOuter = polarToSvg(ang, R + 5);
                  const pText = polarToSvg(ang, R + 18);
                  const isCurrent = Math.abs(normalizeAngle(theta) - ang) < 0.03;
                  return (
                    <g key={idx} className={`notable-group ${isCurrent ? "current" : ""}`}>
                      <line
                        x1={pInner.x}
                        y1={pInner.y}
                        x2={pOuter.x}
                        y2={pOuter.y}
                        className="notable-tick"
                      />
                      <text x={pText.x} y={pText.y} className="notable-text">
                        {Math.round((ang * 180) / Math.PI)}°
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* 4. Círculo Unitário S¹ */}
            {visible.circle && (
              <circle
                cx={CENTER}
                cy={CENTER}
                r={R}
                className="unit-circle"
              />
            )}

            {/* ========================================================= */}
            {/* RENDERIZAÇÃO ESPECÍFICA POR MODO */}
            {/* ========================================================= */}

            {/* MODO 1: CORDA FUNDAMENTAL & TRIGONOMETRIA */}
            {mode === "fundamental" && (
              <>
                {/* Setor Circular Preenchido */}
                {visible.arc && (
                  <path
                    d={`M ${CENTER} ${CENTER} L ${math.p0.x} ${math.p0.y} ${createArcD(0, theta, R)} Z`}
                    className="sector-fill"
                  />
                )}

                {/* Triângulo Euler Shaded: 0 -> cos θ -> z */}
                {visible.eulerTriangle && (
                  <path
                    d={`M ${CENTER} ${CENTER} L ${math.pCos.x} ${math.pCos.y} L ${math.pZ.x} ${math.pZ.y} Z`}
                    className="euler-triangle-fill"
                  />
                )}

                {/* Arco Angular com Marcador */}
                {visible.arc && (
                  <path
                    d={createArcD(0, theta, R)}
                    className="arc-path"
                  />
                )}

                {/* Arco Angular Pequeno de Referência */}
                <path
                  d={createArcD(0, theta, 36)}
                  className="angle-inner-arc"
                />

                {/* Raio Unitário z = e^(iθ) */}
                {visible.radius && (
                  <line
                    x1={CENTER}
                    y1={CENTER}
                    x2={math.pZ.x}
                    y2={math.pZ.y}
                    className="radius-line"
                  />
                )}

                {/* Projeção Cosseno (Eixo Real) */}
                {visible.cosine && (
                  <>
                    <line
                      x1={CENTER}
                      y1={CENTER}
                      x2={math.pCos.x}
                      y2={CENTER}
                      className="cosine-segment"
                    />
                    <line
                      x1={math.pZ.x}
                      y1={math.pZ.y}
                      x2={math.pCos.x}
                      y2={CENTER}
                      className="projection-dash"
                    />
                  </>
                )}

                {/* Projeção Seno (Eixo Imaginário) */}
                {visible.sine && (
                  <>
                    <line
                      x1={math.pCos.x}
                      y1={CENTER}
                      x2={math.pZ.x}
                      y2={math.pZ.y}
                      className="sine-segment"
                    />
                    <line
                      x1={CENTER}
                      y1={math.pZ.y}
                      x2={math.pZ.x}
                      y2={math.pZ.y}
                      className="projection-dash"
                    />
                  </>
                )}

                {/* Conjugado Complexo z* = e^(-iθ) e Corda Vertical z - z* */}
                {visible.conjugate && (
                  <g className="conjugate-group">
                    <line
                      x1={math.pZ.x}
                      y1={math.pZ.y}
                      x2={math.pConj.x}
                      y2={math.pConj.y}
                      className="conjugate-chord"
                    />
                    <circle
                      cx={math.pConj.x}
                      cy={math.pConj.y}
                      r="6"
                      className="conjugate-point"
                    />
                    <text
                      x={math.pConj.x + 10}
                      y={math.pConj.y + 16}
                      className="conjugate-label"
                    >
                      {"z* = e^(-iθ)"}
                    </text>
                  </g>
                )}

                {/* Linha da Tangente & Cotangente */}
                {visible.tangent && math.pTan && (
                  <>
                    <line
                      x1={CENTER + R}
                      y1={CENTER - R * 2.2}
                      x2={CENTER + R}
                      y2={CENTER + R * 2.2}
                      className="tangent-axis"
                    />
                    <line
                      x1={CENTER}
                      y1={CENTER}
                      x2={math.pTan.x}
                      y2={math.pTan.y}
                      className="secant-ray"
                    />
                    <line
                      x1={CENTER + R}
                      y1={CENTER}
                      x2={math.pTan.x}
                      y2={math.pTan.y}
                      className="tangent-segment"
                    />
                    <circle cx={math.pTan.x} cy={math.pTan.y} r="4.5" className="construction-dot" />
                  </>
                )}

                {visible.cotangent && math.pCot && (
                  <>
                    <line
                      x1={CENTER - R * 2.2}
                      y1={CENTER - R}
                      x2={CENTER + R * 2.2}
                      y2={CENTER - R}
                      className="cotangent-axis"
                    />
                    <line
                      x1={CENTER}
                      y1={CENTER}
                      x2={math.pCot.x}
                      y2={math.pCot.y}
                      className="secant-ray"
                    />
                    <line
                      x1={CENTER}
                      y1={CENTER - R}
                      x2={math.pCot.x}
                      y2={math.pCot.y}
                      className="cotangent-segment"
                    />
                    <circle cx={math.pCot.x} cy={math.pCot.y} r="4.5" className="construction-dot" />
                  </>
                )}

                {/* Bissetriz Radial: 0 -> pBisector */}
                {visible.apothem && (
                  <line
                    x1={CENTER}
                    y1={CENTER}
                    x2={math.pBisector.x}
                    y2={math.pBisector.y}
                    className="bisector-line"
                  />
                )}

                {/* Apótema: 0 -> pM */}
                {visible.apothem && (
                  <>
                    <line
                      x1={CENTER}
                      y1={CENTER}
                      x2={math.pM.x}
                      y2={math.pM.y}
                      className="apothem-segment"
                    />
                    <circle cx={math.pM.x} cy={math.pM.y} r="4" className="midpoint-dot" />
                    <text
                      x={math.pM.x - 12}
                      y={math.pM.y - 10}
                      className="midpoint-label"
                    >
                      M
                    </text>
                  </>
                )}

                {/* Sagita: pM -> pBisector */}
                {visible.sagitta && (
                  <line
                    x1={math.pM.x}
                    y1={math.pM.y}
                    x2={math.pBisector.x}
                    y2={math.pBisector.y}
                    className="sagitta-segment"
                  />
                )}

                {/* Corda Fundamental: p0 (1,0) -> pZ */}
                {visible.chord && (
                  <line
                    x1={math.p0.x}
                    y1={math.p0.y}
                    x2={math.pZ.x}
                    y2={math.pZ.y}
                    className="chord-fundamental"
                    filter="url(#glow-purple)"
                  />
                )}

                {/* Polo Inicial (1, 0) */}
                <circle cx={math.p0.x} cy={math.p0.y} r="5" className="p0-dot" />
                <text x={math.p0.x + 8} y={math.p0.y + 18} className="p0-label">
                  z₀ = 1
                </text>
              </>
            )}

            {/* MODO 2: DOIS PONTOS (z1 -> z2) */}
            {mode === "two_points" && (
              <>
                {/* Setor Central */}
                <path
                  d={`M ${CENTER} ${CENTER} L ${twoPointsMath.p1.x} ${twoPointsMath.p1.y} ${createArcD(
                    theta,
                    theta2,
                    R
                  )} Z`}
                  className="sector-fill"
                />

                {/* Ângulo Inscrito até P_inscribed */}
                {visible.inscribedAngle && (
                  <g className="inscribed-layer">
                    <line
                      x1={twoPointsMath.pInscribed.x}
                      y1={twoPointsMath.pInscribed.y}
                      x2={twoPointsMath.p1.x}
                      y2={twoPointsMath.p1.y}
                      className="inscribed-line"
                    />
                    <line
                      x1={twoPointsMath.pInscribed.x}
                      y1={twoPointsMath.pInscribed.y}
                      x2={twoPointsMath.p2.x}
                      y2={twoPointsMath.p2.y}
                      className="inscribed-line"
                    />
                    <circle
                      cx={twoPointsMath.pInscribed.x}
                      cy={twoPointsMath.pInscribed.y}
                      r="6"
                      className="inscribed-vertex"
                    />
                    <text
                      x={twoPointsMath.pInscribed.x - 20}
                      y={twoPointsMath.pInscribed.y + 20}
                      className="inscribed-label"
                    >
                      {`Q (Inscrito: ${((twoPointsMath.inscribedAngle * 180) / Math.PI).toFixed(1)}°)`}
                    </text>
                  </g>
                )}

                {/* Raios até P1 e P2 */}
                <line
                  x1={CENTER}
                  y1={CENTER}
                  x2={twoPointsMath.p1.x}
                  y2={twoPointsMath.p1.y}
                  className="radius-line"
                />
                <line
                  x1={CENTER}
                  y1={CENTER}
                  x2={twoPointsMath.p2.x}
                  y2={twoPointsMath.p2.y}
                  className="radius-line"
                />

                {/* Apótema e Ponto Médio */}
                <line
                  x1={CENTER}
                  y1={CENTER}
                  x2={twoPointsMath.pMid.x}
                  y2={twoPointsMath.pMid.y}
                  className="apothem-segment"
                />
                <circle
                  cx={twoPointsMath.pMid.x}
                  cy={twoPointsMath.pMid.y}
                  r="5"
                  className="midpoint-dot"
                />

                {/* Sagita */}
                <line
                  x1={twoPointsMath.pMid.x}
                  y1={twoPointsMath.pMid.y}
                  x2={twoPointsMath.pBis.x}
                  y2={twoPointsMath.pBis.y}
                  className="sagitta-segment"
                />

                {/* Corda entre P1 e P2 */}
                <line
                  x1={twoPointsMath.p1.x}
                  y1={twoPointsMath.p1.y}
                  x2={twoPointsMath.p2.x}
                  y2={twoPointsMath.p2.y}
                  className="chord-fundamental"
                  filter="url(#glow-purple)"
                />

                {/* Ponto P2 */}
                <circle
                  cx={twoPointsMath.p2.x}
                  cy={twoPointsMath.p2.y}
                  r="8"
                  className="point-handle p2"
                />
                <text
                  x={twoPointsMath.p2.x + 12}
                  y={twoPointsMath.p2.y - 12}
                  className="point-handle-label"
                >
                  {`z₂ (${((theta2 * 180) / Math.PI).toFixed(0)}°)`}
                </text>
              </>
            )}

            {/* MODO 3: RAÍZES DA UNIDADE (POLÍGONO REGULAR) */}
            {mode === "roots_of_unity" && (
              <g className="roots-layer">
                {/* Polígono Regular (Cordas do Perímetro) */}
                <polygon
                  points={rootsMath.roots.map((r) => `${r.point.x},${r.point.y}`).join(" ")}
                  className="roots-polygon"
                />

                {/* Todas as Cordas Saindo de z0 = 1 para as raízes z_k */}
                {visible.rootsChords &&
                  rootsMath.roots.map((r, i) => {
                    if (i === 0) return null;
                    return (
                      <line
                        key={i}
                        x1={rootsMath.roots[0].point.x}
                        y1={rootsMath.roots[0].point.y}
                        x2={r.point.x}
                        y2={r.point.y}
                        className="root-chord-line"
                      />
                    );
                  })}

                {/* Vértices das Raízes */}
                {rootsMath.roots.map((r, i) => (
                  <g key={i}>
                    <circle
                      cx={r.point.x}
                      cy={r.point.y}
                      r={i === 0 ? "7" : "5"}
                      className={`root-vertex ${i === 0 ? "root-zero" : ""}`}
                    />
                    <text
                      x={r.point.x + (r.zReal >= 0 ? 10 : -22)}
                      y={r.point.y + (r.zImag >= 0 ? -10 : 16)}
                      className="root-label"
                    >
                      {i === 0 ? "ζ₀ = 1" : `ζ${i}`}
                    </text>
                  </g>
                ))}
              </g>
            )}

            {/* MODO 4: DE MOIVRE (POTÊNCIAS z^k) */}
            {mode === "de_moivre" && (
              <g className="demoivre-layer">
                {/* Cordas conectando potências sucessivas z^k -> z^(k+1) */}
                {deMoivreMath.powers.map((p, i) => {
                  if (i === 0) return null;
                  const prev = deMoivreMath.powers[i - 1];
                  return (
                    <line
                      key={i}
                      x1={prev.point.x}
                      y1={prev.point.y}
                      x2={p.point.x}
                      y2={p.point.y}
                      className="demoivre-step-chord"
                    />
                  );
                })}

                {/* Pontos de cada potência */}
                {deMoivreMath.powers.map((p, i) => (
                  <g key={i}>
                    <line
                      x1={CENTER}
                      y1={CENTER}
                      x2={p.point.x}
                      y2={p.point.y}
                      className="demoivre-radius"
                    />
                    <circle
                      cx={p.point.x}
                      cy={p.point.y}
                      r={i === 1 ? "7" : "5"}
                      className={`demoivre-dot ${i === 1 ? "generator" : ""}`}
                    />
                    <text
                      x={p.point.x + (p.zReal >= 0 ? 10 : -24)}
                      y={p.point.y + (p.zImag >= 0 ? -10 : 16)}
                      className="demoivre-label"
                    >
                      {i === 0 ? "z⁰ = 1" : i === 1 ? "z¹" : `z${i > 1 ? `^${i}` : ""}`}
                    </text>
                  </g>
                ))}
              </g>
            )}

            {/* Origem (0, 0) */}
            <circle cx={CENTER} cy={CENTER} r="4" className="origin-dot" />
            <text x={CENTER - 14} y={CENTER + 16} className="origin-label">
              O
            </text>

            {/* Ponto Principal P(z) com Handle de Arrasto */}
            <g className="main-handle-group">
              <circle
                cx={math.pZ.x}
                cy={math.pZ.y}
                r="12"
                className="point-handle-halo"
              />
              <circle
                cx={math.pZ.x}
                cy={math.pZ.y}
                r="8"
                className="point-handle p1"
              />
              <text
                x={math.pZ.x + (math.cos >= 0 ? 14 : -30)}
                y={math.pZ.y + (math.sin >= 0 ? -14 : 20)}
                className="point-handle-label"
              >
                {"P(z = e^iθ)"}
              </text>
            </g>
          </svg>

          {/* Controles Flutuantes da Visualização (Play, Velocidade, Imã, Snap) */}
          <div className="trigonometric-circle__floating-controls">
            <div className="control-group">
              <button
                className={`icon-btn ${isPlaying ? "playing" : ""}`}
                onClick={() => setIsPlaying(!isPlaying)}
                title={isPlaying ? "Pausar Rotação" : "Iniciar Rotação Automática"}
              >
                {isPlaying ? "⏸️ Pausar" : "▶️ Girar"}
              </button>

              {isPlaying && (
                <div className="speed-buttons">
                  {[0.5, 1, 2].map((s) => (
                    <button
                      key={s}
                      className={`speed-btn ${animSpeed === s ? "active" : ""}`}
                      onClick={() => setAnimSpeed(s)}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}

              <button
                className={`icon-btn ${snapToNotable ? "snap-active" : ""}`}
                onClick={() => setSnapToNotable(!snapToNotable)}
                title="Ativar/Desativar atração magnética para ângulos notáveis"
              >
                {`🧲 Snap Notáveis: ${snapToNotable ? "ON" : "OFF"}`}
              </button>

              <button
                className="icon-btn"
                onClick={() => {
                  setTheta(Math.PI / 4);
                  setTheta2((3 * Math.PI) / 4);
                }}
                title="Restaurar ângulo para 45° (π/4)"
              >
                ↺ Reset 45°
              </button>
            </div>

            {/* Slider de Alta Precisão */}
            <div className="slider-container">
              <label htmlFor="theta-slider">
                <span>Ângulo θ:</span>
                <strong>{((theta * 180) / Math.PI).toFixed(1)}°</strong>
              </label>
              <input
                id="theta-slider"
                type="range"
                min="0"
                max={TWO_PI}
                step="any"
                value={theta}
                onChange={(e) => setTheta(parseFloat(e.target.value))}
              />
            </div>

            {/* Controles extras por modo */}
            {mode === "roots_of_unity" && (
              <div className="slider-container roots-slider">
                <label htmlFor="roots-slider-input">
                  <span>Lados / Raízes (n):</span>
                  <strong>{numRoots}</strong>
                </label>
                <input
                  id="roots-slider-input"
                  type="range"
                  min="3"
                  max="16"
                  step="1"
                  value={numRoots}
                  onChange={(e) => setNumRoots(parseInt(e.target.value, 10))}
                />
              </div>
            )}

            {mode === "de_moivre" && (
              <div className="slider-container roots-slider">
                <label htmlFor="demoivre-slider-input">
                  <span>Potências (z⁰ a zᵐ):</span>
                  <strong>{`m = ${deMoivrePowers}`}</strong>
                </label>
                <input
                  id="demoivre-slider-input"
                  type="range"
                  min="2"
                  max="16"
                  step="1"
                  value={deMoivrePowers}
                  onChange={(e) => setDeMoivrePowers(parseInt(e.target.value, 10))}
                />
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* PAINEL LATERAL ANALÍTICO & MATEMÁTICO */}
        {/* ========================================================= */}
        <aside className="trigonometric-circle__panel">
          {/* Navegação de Abas */}
          <nav className="panel-tabs">
            <button
              className={activeTab === "chords" ? "active" : ""}
              onClick={() => setActiveTab("chords")}
            >
              📏 Cordas &amp; Sagitas
            </button>
            <button
              className={activeTab === "complex" ? "active" : ""}
              onClick={() => setActiveTab("complex")}
            >
              ℂ Complexos
            </button>
            <button
              className={activeTab === "trig" ? "active" : ""}
              onClick={() => setActiveTab("trig")}
            >
              📐 Funções
            </button>
            <button
              className={activeTab === "theorems" ? "active" : ""}
              onClick={() => setActiveTab("theorems")}
            >
              📜 Teoremas
            </button>
            <button
              className={activeTab === "layers" ? "active" : ""}
              onClick={() => setActiveTab("layers")}
            >
              👁️ Camadas
            </button>
          </nav>

          {/* CONTEÚDO DA ABA: CORDAS & SAGITAS */}
          {activeTab === "chords" && (
            <div className="tab-content chords-tab">
              <div className="section-title">
                <span>MÉTRICAS FUNDAMENTAIS DA CORDA</span>
              </div>

              <div className="metric-cards-grid">
                <div className="metric-card chord-highlight">
                  <div className="metric-header">
                    <span className="badge-dot purple" />
                    <span className="metric-name">Corda crd(θ)</span>
                  </div>
                  <strong className="metric-value">{formatNum(math.chord)}</strong>
                  <span className="metric-formula">|z - 1| = 2·sin(θ/2)</span>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span className="badge-dot sky" />
                    <span className="metric-name">Apótema d</span>
                  </div>
                  <strong className="metric-value">{formatNum(math.apothem)}</strong>
                  <span className="metric-formula">cos(θ/2) = ½√(4 - c²)</span>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span className="badge-dot orange" />
                    <span className="metric-name">Sagita s</span>
                  </div>
                  <strong className="metric-value">{formatNum(math.sagitta)}</strong>
                  <span className="metric-formula">1 - cos(θ/2) = 1 - d</span>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span className="badge-dot emerald" />
                    <span className="metric-name">Haverseno hav(θ)</span>
                  </div>
                  <strong className="metric-value">{formatNum(math.haversine)}</strong>
                  <span className="metric-formula">sin²(θ/2) = crd²(θ)/4</span>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span className="badge-dot amber" />
                    <span className="metric-name">Verseno versin(θ)</span>
                  </div>
                  <strong className="metric-value">{formatNum(math.versine)}</strong>
                  <span className="metric-formula">1 - cos(θ)</span>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span className="badge-dot pink" />
                    <span className="metric-name">Área do Triângulo</span>
                  </div>
                  <strong className="metric-value">{formatNum(math.triangleArea)}</strong>
                  <span className="metric-formula">½|sin θ| = ½ · c · d</span>
                </div>
              </div>

              {/* Relação Pitagórica da Corda */}
              <div className="identity-banner">
                <div className="identity-title">Relação Pitagórica da Corda:</div>
                <code>
                  {`crd²(θ) + 4d² = 4  ⟹  ${formatNum(math.chord * math.chord, 3)} + ${formatNum(4 * math.apothem * math.apothem, 3)} = 4.000`}
                </code>
              </div>
            </div>
          )}

          {/* CONTEÚDO DA ABA: COMPLEXOS */}
          {activeTab === "complex" && (
            <div className="tab-content complex-tab">
              <div className="section-title">
                <span>REPRESENTAÇÃO NO PLANO ℂ</span>
              </div>

              <div className="complex-formula-card">
                <div className="formula-row">
                  <span className="tag">Ponto z:</span>
                  <code>
                    {`z = e^(i ${(theta / Math.PI).toFixed(3)}π) = ${formatNum(math.cos)} + ${formatNum(math.sin)}i`}
                  </code>
                </div>

                <div className="formula-row">
                  <span className="tag">Conjugado z̄:</span>
                  <code>
                    {`z̄ = e^(-i ${(theta / Math.PI).toFixed(3)}π) = ${formatNum(math.cos)} - ${formatNum(math.sin)}i`}
                  </code>
                </div>

                <div className="formula-row">
                  <span className="tag">Vetor Corda:</span>
                  <code>
                    {`Δz = z - 1 = ${formatNum(math.cos - 1)} + ${formatNum(math.sin)}i`}
                  </code>
                </div>

                <div className="formula-row highlight">
                  <span className="tag">Módulo do Vetor:</span>
                  <code>{`|Δz| = |z - 1| = ${formatNum(math.chord)} = 2·sin(θ/2)`}</code>
                </div>

                <div className="formula-row">
                  <span className="tag">Corda Conjugada:</span>
                  <code>{`|z - z̄| = |2i·sin θ| = ${formatNum(2 * Math.abs(math.sin))}`}</code>
                </div>

                <div className="formula-row">
                  <span className="tag">Ponto Médio M:</span>
                  <code>
                    {`M = (z + 1)/2 = ${formatNum((math.cos + 1) / 2)} + ${formatNum(math.sin / 2)}i`}
                  </code>
                </div>
              </div>

              <div className="identity-banner">
                <div className="identity-title">Identidade de Euler &amp; Módulo:</div>
                <code>|z|² = cos²θ + sin²θ = 1.000</code>
              </div>
            </div>
          )}

          {/* CONTEÚDO DA ABA: FUNÇÕES TRIGONOMÉTRICAS */}
          {activeTab === "trig" && (
            <div className="tab-content trig-tab">
              <div className="section-title">
                <span>PROJEÇÕES CIRCULARES</span>
              </div>

              <div className="values-grid">
                <div className="value-box">
                  <span className="val-name">sin θ (Seno)</span>
                  <strong className="val-number emerald">{formatNum(math.sin)}</strong>
                  <span className="val-detail">Im(z)</span>
                </div>

                <div className="value-box">
                  <span className="val-name">cos θ (Cosseno)</span>
                  <strong className="val-number cobalt">{formatNum(math.cos)}</strong>
                  <span className="val-detail">Re(z)</span>
                </div>

                <div className="value-box">
                  <span className="val-name">tan θ (Tangente)</span>
                  <strong className="val-number amber">{formatNum(math.tan)}</strong>
                  <span className="val-detail">sin / cos</span>
                </div>

                <div className="value-box">
                  <span className="val-name">cot θ (Cotangente)</span>
                  <strong className="val-number pink">{formatNum(math.cot)}</strong>
                  <span className="val-detail">cos / sin</span>
                </div>

                <div className="value-box">
                  <span className="val-name">sec θ (Secante)</span>
                  <strong className="val-number purple">{formatNum(math.sec)}</strong>
                  <span className="val-detail">1 / cos</span>
                </div>

                <div className="value-box">
                  <span className="val-name">csc θ (Cossecante)</span>
                  <strong className="val-number red">{formatNum(math.csc)}</strong>
                  <span className="val-detail">1 / sin</span>
                </div>
              </div>

              <div className="quadrant-info">
                <span>Quadrante:</span>
                <strong>
                  {theta >= 0 && theta < Math.PI / 2
                    ? "1º Quadrante (0 a π/2)"
                    : theta >= Math.PI / 2 && theta < Math.PI
                    ? "2º Quadrante (π/2 a π)"
                    : theta >= Math.PI && theta < (3 * Math.PI) / 2
                    ? "3º Quadrante (π a 3π/2)"
                    : "4º Quadrante (3π/2 a 2π)"}
                </strong>
              </div>
            </div>
          )}

          {/* CONTEÚDO DA ABA: TEOREMAS */}
          {activeTab === "theorems" && (
            <div className="tab-content theorems-tab">
              <div className="theorem-card">
                <h4>1. Tábua de Cordas de Ptolomeu</h4>
                <p>
                  Historicamente (Hiparco e Ptolomeu no <em>Almagesto</em>), a trigonometria nasceu com a função corda:
                </p>
                <code>crd(θ) = 2R · sin(θ/2)</code>
                <p>
                  No círculo unitário (R = 1): crd²(θ) + crd²(π - θ) = 4.
                </p>
              </div>

              <div className="theorem-card">
                <h4>2. Teorema do Produto de Cordas nas Raízes da Unidade</h4>
                <p>
                  {"Para as n-ésimas raízes ζₖ = e^(i 2πk/n), o produto de todas as cordas conectando z₀ = 1 a todos os outros vértices é exatamente igual a n:"}
                </p>
                <code>{"∏ (k=1..n-1) |1 - e^(i 2πk/n)| = n"}</code>
                {mode === "roots_of_unity" && (
                  <div className="theorem-live-calc">
                    <span>{`Cálculo ao vivo para n = ${rootsMath.n}:`}</span>
                    <strong>{`Produto das ${rootsMath.n - 1} cordas = ${rootsMath.chordProduct.toFixed(4)} ≈ ${rootsMath.n}`}</strong>
                  </div>
                )}
              </div>

              <div className="theorem-card">
                <h4>3. Teorema do Ângulo Inscrito</h4>
                <p>
                  O ângulo central subtendido por uma corda é sempre o dobro de qualquer ângulo inscrito que enxerga o mesmo arco:
                </p>
                <code>θ_central = 2 · θ_inscrito</code>
              </div>
            </div>
          )}

          {/* CONTEÚDO DA ABA: CAMADAS */}
          {activeTab === "layers" && (
            <div className="tab-content layers-tab">
              <div className="section-title">
                <span>VISIBILIDADE DOS ELEMENTOS</span>
              </div>

              <div className="layers-grid">
                {[
                  { key: "circle" as const, label: "Círculo Unitário S¹", color: "#d4d7dc" },
                  { key: "grid" as const, label: "Grade Polar & Raios", color: "#64748b" },
                  { key: "axes" as const, label: "Eixos Cartesianos (Re / Im)", color: "#8b919b" },
                  { key: "chord" as const, label: "Corda crd(θ) = |z - 1|", color: "#c084fc" },
                  { key: "apothem" as const, label: "Apótema (Centro ao Ponto Médio)", color: "#38bdf8" },
                  { key: "sagitta" as const, label: "Sagita (Flecha do Arco)", color: "#fb923c" },
                  { key: "sine" as const, label: "Seno Im(z)", color: "#4ade80" },
                  { key: "cosine" as const, label: "Cosseno Re(z)", color: "#60a5fa" },
                  { key: "eulerTriangle" as const, label: "Triângulo de Euler", color: "#38bdf8" },
                  { key: "conjugate" as const, label: "Ponto Conjugado z*", color: "#a855f7" },
                  { key: "tangent" as const, label: "Tangente & Secante", color: "#f59e0b" },
                  { key: "cotangent" as const, label: "Cotangente & Cossecante", color: "#f472b6" },
                  { key: "inscribedAngle" as const, label: "Ângulo Inscrito", color: "#34d399" },
                ].map(({ key, label, color }) => (
                  <button
                    key={key}
                    className={`layer-btn ${visible[key] ? "active" : ""}`}
                    onClick={() => toggleLayer(key)}
                  >
                    <span className="layer-dot" style={{ backgroundColor: color }} />
                    <span className="layer-name">{label}</span>
                    <span className="layer-check">{visible[key] ? "✓" : ""}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

export { TrigonometricCircle };
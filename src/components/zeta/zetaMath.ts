// ── High-Precision Riemann Zeta Mathematical Engine ──────────────────────────────

export interface Complex {
  re: number;
  im: number;
}

export function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

export function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

export function cDiv(a: Complex, b: Complex): Complex {
  const den = b.re * b.re + b.im * b.im;
  if (den === 0) return { re: 0, im: 0 };
  return {
    re: (a.re * b.re + a.im * b.im) / den,
    im: (a.im * b.re - a.re * b.im) / den,
  };
}

export function cAbs(a: Complex): number {
  return Math.hypot(a.re, a.im);
}

export function cArg(a: Complex): number {
  return Math.atan2(a.im, a.re);
}

export function cExp(a: Complex): Complex {
  const expR = Math.exp(a.re);
  return {
    re: expR * Math.cos(a.im),
    im: expR * Math.sin(a.im),
  };
}

export function cLog(a: Complex): Complex {
  return {
    re: Math.log(Math.max(1e-300, cAbs(a))),
    im: cArg(a),
  };
}

export function cPow(base: Complex, exp: Complex): Complex {
  if (base.re === 0 && base.im === 0) return { re: 0, im: 0 };
  const logB = cLog(base);
  const prod = cMul(exp, logB);
  return cExp(prod);
}

export function cRealPow(base: number, exp: Complex): Complex {
  if (base <= 0) return cPow({ re: base, im: 0 }, exp);
  const lnB = Math.log(base);
  const mag = Math.pow(base, exp.re);
  const phase = exp.im * lnB;
  return {
    re: mag * Math.cos(phase),
    im: mag * Math.sin(phase),
  };
}

export function cSin(a: Complex): Complex {
  const coshY = Math.cosh(Math.min(700, Math.max(-700, a.im)));
  const sinhY = Math.sinh(Math.min(700, Math.max(-700, a.im)));
  return {
    re: Math.sin(a.re) * coshY,
    im: Math.cos(a.re) * sinhY,
  };
}

export function cCos(a: Complex): Complex {
  const coshY = Math.cosh(Math.min(700, Math.max(-700, a.im)));
  const sinhY = Math.sinh(Math.min(700, Math.max(-700, a.im)));
  return {
    re: Math.cos(a.re) * coshY,
    im: -Math.sin(a.re) * sinhY,
  };
}

// ── Lanczos Approximation for Complex Gamma Function Γ(z) ─────────────────────
const LANCZOS_G = 7;
const LANCZOS_COEFFS = [
  0.99999999999980993,
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
];

export function cGamma(z: Complex): Complex {
  if (z.re < 0.5) {
    // Reflection formula: Γ(z) = π / (sin(π z) * Γ(1 - z))
    const piZ = { re: Math.PI * z.re, im: Math.PI * z.im };
    const sinPiZ = cSin(piZ);
    const oneMinusZ = { re: 1 - z.re, im: -z.im };
    const gammaOneMinusZ = cGamma(oneMinusZ);
    const denom = cMul(sinPiZ, gammaOneMinusZ);
    return cDiv({ re: Math.PI, im: 0 }, denom);
  }

  const zm1 = { re: z.re - 1, im: z.im };
  let x: Complex = { re: LANCZOS_COEFFS[0], im: 0 };

  for (let i = 1; i < LANCZOS_G + 2; i++) {
    const termDenom = { re: zm1.re + i, im: zm1.im };
    const term = cDiv({ re: LANCZOS_COEFFS[i], im: 0 }, termDenom);
    x = cAdd(x, term);
  }

  const t = { re: zm1.re + LANCZOS_G + 0.5, im: zm1.im };
  const sqrtTwoPi: Complex = { re: Math.sqrt(2 * Math.PI), im: 0 };
  const tPow = cPow(t, { re: zm1.re + 0.5, im: zm1.im });
  const expNegT = cExp({ re: -t.re, im: -t.im });

  return cMul(cMul(cMul(sqrtTwoPi, tPow), expNegT), x);
}

// ── Borwein's Accelerated Algorithm for Dirichlet Eta η(s) ───────────────────
const BORWEIN_N = 28;
const { BORWEIN_COEFFS, BORWEIN_DN } = (() => {
  const n = BORWEIN_N;
  const d: number[] = new Array(n);
  for (let k = 0; k < n; k++) {
    let term = 0;
    for (let i = 0; i <= k; i++) {
      let logVal = Math.log(n) + i * Math.LN2 * 2;
      for (let j = 1; j <= n + i - 1; j++) logVal += Math.log(j);
      for (let j = 1; j <= n - i; j++) logVal -= Math.log(j);
      for (let j = 1; j <= 2 * i; j++) logVal -= Math.log(j);
      term += Math.exp(logVal);
    }
    d[k] = term;
  }
  let dn = 0;
  for (let i = 0; i <= n - 1; i++) {
    let logVal = Math.log(n) + i * Math.LN2 * 2;
    for (let j = 1; j <= n + i - 1; j++) logVal += Math.log(j);
    for (let j = 1; j <= n - i; j++) logVal -= Math.log(j);
    for (let j = 1; j <= 2 * i; j++) logVal -= Math.log(j);
    dn += Math.exp(logVal);
  }
  const coeffs = new Array(n);
  for (let k = 0; k < n; k++) {
    coeffs[k] = (d[k] - dn) * (k % 2 === 0 ? 1 : -1);
  }
  return { BORWEIN_COEFFS: coeffs, BORWEIN_DN: dn };
})();

/**
 * Computes Dirichlet Eta function η(s) using Borwein's algorithm
 */
export function dirichletEta(s: Complex): Complex {
  let sumRe = 0;
  let sumIm = 0;

  for (let k = 0; k < BORWEIN_N; k++) {
    const coeff = BORWEIN_COEFFS[k];
    const nVal = k + 1;
    const lnn = Math.log(nVal);
    const mag = Math.pow(nVal, -s.re);
    const phase = -s.im * lnn;
    const termRe = mag * Math.cos(phase);
    const termIm = mag * Math.sin(phase);

    sumRe += coeff * termRe;
    sumIm += coeff * termIm;
  }

  const invDn = -1 / BORWEIN_DN;
  return {
    re: sumRe * invDn,
    im: sumIm * invDn,
  };
}

/**
 * High-precision analytic continuation of Riemann Zeta function ζ(s)
 * Defined across the entire complex plane ℂ
 */
export function riemannZeta(s: Complex): Complex {
  // Check if near pole at s = 1
  if (Math.abs(s.re - 1) < 1e-12 && Math.abs(s.im) < 1e-12) {
    return { re: 1e15, im: 0 };
  }

  // Trivial zeros at s = -2, -4, -6, -8, ...
  if (s.re < 0 && Math.abs(s.im) < 1e-12) {
    const roundRe = Math.round(s.re);
    if (Math.abs(s.re - roundRe) < 1e-12 && roundRe % 2 === 0 && roundRe < 0) {
      return { re: 0, im: 0 };
    }
  }

  // If Re(s) >= 0.5, use Dirichlet eta relation: ζ(s) = η(s) / (1 - 2^(1-s))
  if (s.re >= 0.5) {
    const eta = dirichletEta(s);
    const twoPow = cRealPow(2, { re: 1 - s.re, im: -s.im });
    const denom = { re: 1 - twoPow.re, im: -twoPow.im };
    return cDiv(eta, denom);
  }

  // If Re(s) < 0.5, use Riemann Reflection Functional Equation:
  // ζ(s) = 2^s * π^(s-1) * sin(π*s/2) * Γ(1-s) * ζ(1-s)
  const oneMinusS: Complex = { re: 1 - s.re, im: -s.im };
  const zetaOneMinusS = riemannZeta(oneMinusS);

  const twoPowS = cRealPow(2, s);
  const piPowSMinusOne = cRealPow(Math.PI, { re: s.re - 1, im: s.im });

  const halfPiS: Complex = { re: (Math.PI * s.re) / 2, im: (Math.PI * s.im) / 2 };
  const sinHalfPiS = cSin(halfPiS);

  const gammaOneMinusS = cGamma(oneMinusS);

  const factor1 = cMul(twoPowS, piPowSMinusOne);
  const factor2 = cMul(sinHalfPiS, gammaOneMinusS);
  const factor12 = cMul(factor1, factor2);

  return cMul(factor12, zetaOneMinusS);
}

/**
 * Numerical derivative ζ'(s) via symmetric difference
 */
export function riemannZetaDerivative(s: Complex, h = 1e-6): Complex {
  const sPlus = { re: s.re + h, im: s.im };
  const sMinus = { re: s.re - h, im: s.im };
  const zPlus = riemannZeta(sPlus);
  const zMinus = riemannZeta(sMinus);
  return {
    re: (zPlus.re - zMinus.re) / (2 * h),
    im: (zPlus.im - zMinus.im) / (2 * h),
  };
}

/**
 * Complex Newton-Raphson solver to find exact zero nearby
 */
export interface RootFindingStep {
  s: Complex;
  val: Complex;
  absVal: number;
}

export function findZetaZero(
  initialGuess: Complex,
  maxIterations = 30,
  tolerance = 1e-10
): {
  converged: boolean;
  root: Complex;
  steps: RootFindingStep[];
  residual: number;
} {
  let current = { ...initialGuess };
  const steps: RootFindingStep[] = [];

  for (let i = 0; i < maxIterations; i++) {
    const val = riemannZeta(current);
    const absVal = cAbs(val);
    steps.push({ s: { ...current }, val, absVal });

    if (absVal < tolerance) {
      return { converged: true, root: current, steps, residual: absVal };
    }

    const deriv = riemannZetaDerivative(current);
    const step = cDiv(val, deriv);

    const stepMag = cAbs(step);
    const damping = stepMag > 1.5 ? 1.5 / stepMag : 1.0;

    current = {
      re: current.re - step.re * damping,
      im: current.im - step.im * damping,
    };

    if (isNaN(current.re) || isNaN(current.im) || !isFinite(current.re) || !isFinite(current.im)) {
      return { converged: false, root: initialGuess, steps, residual: absVal };
    }
  }

  const finalVal = riemannZeta(current);
  return {
    converged: cAbs(finalVal) < tolerance * 10,
    root: current,
    steps,
    residual: cAbs(finalVal),
  };
}

// ── Riemann-Siegel Theta θ(t) and Z(t) Function ──────────────────────────────
export function riemannSiegelTheta(t: number): number {
  if (Math.abs(t) < 1e-12) return 0;
  if (Math.abs(t) >= 10) {
    const tAbs = Math.abs(t);
    let val = (tAbs / 2) * Math.log(tAbs / (2 * Math.PI)) - tAbs / 2 - Math.PI / 8;
    val += 1 / (48 * tAbs);
    val += 7 / (5760 * Math.pow(tAbs, 3));
    return t < 0 ? -val : val;
  }

  const z: Complex = { re: 0.25, im: t / 2 };
  const gammaVal = cGamma(z);
  const logGammaIm = cArg(gammaVal);
  return logGammaIm - (t / 2) * Math.log(Math.PI);
}

export function riemannSiegelZ(t: number): number {
  const theta = riemannSiegelTheta(t);
  const s: Complex = { re: 0.5, im: t };
  const zetaVal = riemannZeta(s);
  return Math.cos(theta) * zetaVal.re - Math.sin(theta) * zetaVal.im;
}

// ── High-Precision Database of the First 60 Non-Trivial Zeros (γ_n) ───────────
export interface ZeroRecord {
  index: number;
  gamma: number;
  gap: number;
}

export const KNOWN_ZEROS: number[] = [
  14.1347251417347, 21.0220396387716, 25.0108575801457, 30.4248761258595, 32.9350615877392,
  37.5861781588257, 40.9187190121475, 43.3270732809150, 48.0051508811672, 49.7738324776723,
  52.9703214777145, 56.4462476970634, 59.3470440026024, 60.8317785246098, 65.1125440480816,
  67.0798105294942, 69.5464017111740, 72.0671576744819, 75.7046906990839, 77.1448400688748,
  79.3373750202493, 82.9103808540860, 84.7354929805121, 87.4252746131252, 88.8091112076345,
  92.4918992705585, 94.6513440405199, 95.8706342282453, 98.8311942181936, 101.3178510057314,
  103.7255380404784, 105.4466230523261, 107.1686111842764, 111.0295355431697, 111.8746591769926,
  114.3202209154527, 116.2266803208576, 118.7907828659762, 121.3701250024206, 122.9468292935526,
  124.2568185543458, 127.5166838795964, 129.5787041999560, 131.0876885309327, 133.4977372029976,
  134.7565097533738, 138.1160420545334, 139.7362089521214, 141.1197191717882, 143.1118458076206,
  146.0009824867659, 147.4227653425597, 150.0535204207850, 150.9252576122416, 153.0246938111904,
  156.1129092942475, 157.5975918175402, 158.8499881714207, 161.1889641375959, 163.0307096871800,
];

export const ZERO_RECORDS: ZeroRecord[] = KNOWN_ZEROS.map((gamma, i) => ({
  index: i + 1,
  gamma,
  gap: i === 0 ? gamma : gamma - KNOWN_ZEROS[i - 1],
}));

export const TRIVIAL_ZEROS = [-2, -4, -6, -8, -10, -12, -14, -16, -18, -20, -22, -24, -26, -28, -30];

// ── WebGL GPU Shader Program for Riemann Zeta Domain Coloring ─────────────────

export const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER_SOURCE = `
precision highp float;

varying vec2 v_uv;

uniform vec2 u_resolution;
uniform vec4 u_view; // vec4(reMin, reMax, imMin, imMax)
uniform int u_color_mode; // 0: Standard, 1: Phase Rays, 2: Modulus Contours, 3: Re/Im Zero Curves, 4: Conformal Grid
uniform int u_palette;    // 0: Cosmic Neon, 1: Twilight, 2: Turbo, 3: Classic HSV, 4: Deep Ocean, 5: Monochrome
uniform float u_contour_density;
uniform float u_isophase_density;
uniform float u_show_modulus_rings;
uniform float u_show_isophases;
uniform float u_brightness;

#define PI 3.14159265358979323846
#define LN2 0.693147180559945309417
#define LN_PI 1.14472988584940017414

// ── Complex Arithmetic in GLSL ────────────────────────────────────────────────
vec2 c_add(vec2 a, vec2 b) { return a + b; }
vec2 c_sub(vec2 a, vec2 b) { return a - b; }
vec2 c_mul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }

vec2 c_div(vec2 a, vec2 b) {
  float den = dot(b, b);
  if (den < 1e-25) return vec2(0.0);
  return vec2(dot(a, b), a.y * b.x - a.x * b.y) / den;
}

float c_abs(vec2 a) { return length(a); }
float c_arg(vec2 a) { return atan(a.y, a.x); }

vec2 c_exp(vec2 a) {
  float r = exp(clamp(a.x, -80.0, 80.0));
  return vec2(r * cos(a.y), r * sin(a.y));
}

vec2 c_log(vec2 a) {
  return vec2(log(max(1e-20, length(a))), atan(a.y, a.x));
}

vec2 c_pow(vec2 base, vec2 expVal) {
  if (dot(base, base) < 1e-25) return vec2(0.0);
  vec2 logB = c_log(base);
  return c_exp(c_mul(expVal, logB));
}

vec2 c_real_pow(float base, vec2 expVal) {
  if (base <= 0.0) return c_pow(vec2(base, 0.0), expVal);
  float lnB = log(base);
  float mag = exp(clamp(expVal.x * lnB, -80.0, 80.0));
  float phase = expVal.y * lnB;
  return vec2(mag * cos(phase), mag * sin(phase));
}

vec2 c_sin(vec2 a) {
  float yClamped = clamp(a.y, -60.0, 60.0);
  float coshY = (exp(yClamped) + exp(-yClamped)) * 0.5;
  float sinhY = (exp(yClamped) - exp(-yClamped)) * 0.5;
  return vec2(sin(a.x) * coshY, cos(a.x) * sinhY);
}

// ── Lanczos Complex Gamma Approximation ─────────────────────────────────────────
vec2 c_gamma(vec2 z) {
  if (z.x < 0.5) {
    vec2 piZ = z * PI;
    vec2 sinPiZ = c_sin(piZ);
    vec2 oneMinusZ = vec2(1.0 - z.x, -z.y);
    vec2 gammaOneMinusZ = c_gamma(oneMinusZ);
    vec2 denom = c_mul(sinPiZ, gammaOneMinusZ);
    return c_div(vec2(PI, 0.0), denom);
  }

  vec2 zm1 = vec2(z.x - 1.0, z.y);
  vec2 x = vec2(0.99999999999980993, 0.0);

  // Lanczos 7 terms
  float c1 = 676.5203681218851;
  float c2 = -1259.1392167224028;
  float c3 = 771.32342877765313;
  float c4 = -176.61502916214059;
  float c5 = 12.507343278686905;
  float c6 = -0.13857109526572012;
  float c7 = 9.9843695780195716e-6;

  x = c_add(x, c_div(vec2(c1, 0.0), zm1 + vec2(1.0, 0.0)));
  x = c_add(x, c_div(vec2(c2, 0.0), zm1 + vec2(2.0, 0.0)));
  x = c_add(x, c_div(vec2(c3, 0.0), zm1 + vec2(3.0, 0.0)));
  x = c_add(x, c_div(vec2(c4, 0.0), zm1 + vec2(4.0, 0.0)));
  x = c_add(x, c_div(vec2(c5, 0.0), zm1 + vec2(5.0, 0.0)));
  x = c_add(x, c_div(vec2(c6, 0.0), zm1 + vec2(6.0, 0.0)));
  x = c_add(x, c_div(vec2(c7, 0.0), zm1 + vec2(7.0, 0.0)));

  vec2 t = zm1 + vec2(7.5, 0.0);
  vec2 sqrtTwoPi = vec2(2.5066282746310005, 0.0);
  vec2 tPow = c_pow(t, zm1 + vec2(0.5, 0.0));
  vec2 expNegT = c_exp(-t);

  return c_mul(c_mul(c_mul(sqrtTwoPi, tPow), expNegT), x);
}

// ── Accelerated Borwein Series for Dirichlet Eta Function η(s) ─────────────────
vec2 dirichlet_eta_borwein(vec2 s) {
  vec2 sum = vec2(0.0);
  
  // Borwein coefficients for n = 20
  float coeffs[20];
  coeffs[0]  = -1.048575e+06; coeffs[1]  = 1.048555e+06;  coeffs[2]  = -1.048365e+06; coeffs[3]  = 1.047035e+06;
  coeffs[4]  = -1.040180e+06; coeffs[5]  = 1.011680e+06;  coeffs[6]  = -9.141800e+05; coeffs[7]  = 6.381800e+05;
  coeffs[8]  = -3.000000e+05; coeffs[9]  = 6.500000e+04;  coeffs[10] = -5.000000e+03; coeffs[11] = 2.000000e+02;
  coeffs[12] = -5.000000e+00; coeffs[13] = 1.000000e-01;  coeffs[14] = 0.0;           coeffs[15] = 0.0;
  coeffs[16] = 0.0;           coeffs[17] = 0.0;           coeffs[18] = 0.0;           coeffs[19] = 0.0;

  float inv_dn = -1.0 / 1048576.0;

  for (int k = 0; k < 14; k++) {
    float nVal = float(k + 1);
    float lnn = log(nVal);
    float mag = exp(clamp(-s.x * lnn, -70.0, 70.0));
    float phase = -s.y * lnn;
    vec2 term = vec2(mag * cos(phase), mag * sin(phase));
    sum += coeffs[k] * term;
  }

  return sum * inv_dn;
}

// ── Complete Analytic Continuation of Riemann Zeta ζ(s) ───────────────────────
vec2 compute_zeta(vec2 s) {
  if (abs(s.x - 1.0) < 1e-4 && abs(s.y) < 1e-4) {
    return vec2(1e6, 0.0);
  }

  // Trivial zeros check: s = -2, -4, -6, ...
  if (s.x < 0.0 && abs(s.y) < 1e-4) {
    float r = s.x * 0.5;
    if (abs(r - floor(r + 0.5)) < 1e-4) return vec2(0.0);
  }

  if (s.x >= 0.5) {
    vec2 eta = dirichlet_eta_borwein(s);
    vec2 twoPow = c_real_pow(2.0, vec2(1.0 - s.x, -s.y));
    vec2 denom = vec2(1.0 - twoPow.x, -twoPow.y);
    return c_div(eta, denom);
  }

  // Reflection formula: ζ(s) = 2^s * π^(s-1) * sin(π*s/2) * Γ(1-s) * ζ(1-s)
  vec2 oneMinusS = vec2(1.0 - s.x, -s.y);
  vec2 eta1 = dirichlet_eta_borwein(oneMinusS);
  vec2 twoPow1 = c_real_pow(2.0, vec2(1.0 - oneMinusS.x, -oneMinusS.y));
  vec2 denom1 = vec2(1.0 - twoPow1.x, -twoPow1.y);
  vec2 zetaOneMinusS = c_div(eta1, denom1);

  vec2 twoPowS = c_real_pow(2.0, s);
  vec2 piPowSm1 = c_real_pow(PI, vec2(s.x - 1.0, s.y));
  vec2 halfPiS = s * (PI * 0.5);
  vec2 sinHalfPiS = c_sin(halfPiS);
  vec2 gammaOneMinusS = c_gamma(oneMinusS);

  vec2 factor1 = c_mul(twoPowS, piPowSm1);
  vec2 factor2 = c_mul(sinHalfPiS, gammaOneMinusS);
  vec2 factor12 = c_mul(factor1, factor2);

  return c_mul(factor12, zetaOneMinusS);
}

// ── Color Palettes & Mapping ──────────────────────────────────────────────────
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 palette_cosmic(float phase) {
  // Rich neon/cyberpunk spectral gradient: Magenta -> Violet -> Cyan -> Green -> Gold -> Red
  float t = phase;
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.00, 0.33, 0.67);
  return a + b * cos(2.0 * PI * (c * t + d));
}

vec3 palette_twilight(float phase) {
  // Cyclic perceptual twilight
  float t = phase;
  vec3 a = vec3(0.52, 0.45, 0.62);
  vec3 b = vec3(0.48, 0.42, 0.55);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.12, 0.50, 0.78);
  return a + b * cos(2.0 * PI * (c * t + d));
}

vec3 palette_turbo(float phase) {
  // High contrast thermal scientific map
  float x = phase;
  vec4 r = vec4(0.1357, 4.6153, -42.6603, 132.1310);
  vec4 g = vec4(0.0914, 2.1941, 4.8429, -14.1850);
  vec4 b = vec4(0.1066, 12.5879, -51.2723, 100.8690);
  vec3 col;
  col.r = r.x + x * (r.y + x * (r.z + x * r.w));
  col.g = g.x + x * (g.y + x * (g.z + x * g.w));
  col.b = b.x + x * (b.y + x * (b.z + x * b.w));
  return clamp(col, 0.0, 1.0);
}

vec3 palette_ocean(float phase) {
  // Deep ocean / emerald / cyan / gold glow
  float t = phase;
  vec3 a = vec3(0.1, 0.4, 0.5);
  vec3 b = vec3(0.2, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.25, 0.60, 0.85);
  return a + b * cos(2.0 * PI * (c * t + d));
}

vec3 palette_monochrome(float phase, float modVal) {
  float v = 0.5 + 0.5 * cos(phase * 2.0 * PI);
  return vec3(v);
}

void main() {
  vec2 coord = v_uv;
  // Map UV to Complex coordinates s = sigma + i*t
  vec2 s;
  s.x = u_view.x + coord.x * (u_view.y - u_view.x);
  s.y = u_view.w - (1.0 - coord.y) * (u_view.w - u_view.z);

  // Compute Riemann Zeta ζ(s)
  vec2 zeta = compute_zeta(s);

  float modVal = length(zeta);
  float phaseAngle = atan(zeta.y, zeta.x); // [-PI, PI]
  float normPhase = (phaseAngle + PI) / (2.0 * PI); // [0, 1]

  // Base color from palette
  vec3 col = vec3(0.0);
  if (u_palette == 0) {
    col = palette_cosmic(normPhase);
  } else if (u_palette == 1) {
    col = palette_twilight(normPhase);
  } else if (u_palette == 2) {
    col = palette_turbo(normPhase);
  } else if (u_palette == 3) {
    col = hsv2rgb(vec3(normPhase, 0.85, 0.95));
  } else if (u_palette == 4) {
    col = palette_ocean(normPhase);
  } else {
    col = palette_monochrome(normPhase, modVal);
  }

  // Modulus Contours / Rings (logarithmic scale: log2|ζ|)
  float logMod = log2(max(1e-15, modVal));
  float ringFrac = fract(logMod * u_contour_density);
  float ringFactor = 0.5 + 0.5 * cos(2.0 * PI * ringFrac);
  // Sharpen contour lines
  float ringLine = smoothstep(0.0, 0.2, ringFactor) * 0.4 + 0.6;

  if (u_show_modulus_rings > 0.5) {
    col *= ringLine;
  }

  // Isophase Rays (Phase streamlines radiating from zeros/poles)
  if (u_show_isophases > 0.5) {
    float rayFrac = fract(normPhase * u_isophase_density);
    float rayVal = smoothstep(0.0, 0.1, abs(rayFrac - 0.5) * 2.0);
    col = mix(col * 0.4, col, rayVal);
  }

  // Specific Visualization Modes
  if (u_color_mode == 1) {
    // Phase Rays Mode: emphasize radiating phase streamlines
    float rays = fract(normPhase * 16.0);
    float raySharp = pow(0.5 + 0.5 * cos(2.0 * PI * rays), 4.0);
    col = mix(col * 0.3, col * 1.3, raySharp);
  } else if (u_color_mode == 2) {
    // Equipotential Modulus Contours
    float contours = fract(logMod * 2.0);
    float contourEdge = 1.0 - smoothstep(0.0, 0.08, abs(contours - 0.5) * 2.0);
    col = mix(col * 0.7, vec3(1.0, 0.9, 0.4), contourEdge * 0.85);
  } else if (u_color_mode == 3) {
    // Re/Im Zero Curves Mode: Re(ζ) = 0 and Im(ζ) = 0 curves
    float reVal = abs(zeta.x) / (fwidth(zeta.x) + 1e-4);
    float imVal = abs(zeta.y) / (fwidth(zeta.y) + 1e-4);
    float reLine = 1.0 - clamp(reVal * 0.5, 0.0, 1.0);
    float imLine = 1.0 - clamp(imVal * 0.5, 0.0, 1.0);
    col = mix(col * 0.4, vec3(0.0, 0.9, 1.0), reLine * 0.9); // Re = 0 in Cyan
    col = mix(col, vec3(1.0, 0.2, 0.4), imLine * 0.9);        // Im = 0 in Magenta
  } else if (u_color_mode == 4) {
    // Conformal Grid Mode
    vec2 gridUV = fract(zeta * 0.5);
    vec2 gridLine = abs(gridUV - 0.5) * 2.0;
    float g = min(gridLine.x, gridLine.y);
    col = mix(col * 0.3, col * 1.2, smoothstep(0.0, 0.15, g));
  }

  // Enhance zero vortices (dark wells) and poles (luminous peaks)
  float zeroWell = smoothstep(0.0, 1.5, modVal);
  col *= clamp(zeroWell * 0.7 + 0.3, 0.0, 1.5);

  // Apply overall brightness
  col *= u_brightness;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export class ZetaGLRenderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private posBuffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", {
      preserveDrawingBuffer: true,
      antialias: false,
      powerPreference: "high-performance",
    });

    if (!gl) {
      console.warn("WebGL not supported, falling back to 2D context");
      return;
    }

    this.gl = gl;
    this.initShaders();
  }

  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;
    const shader = this.gl.createShader(type);
    if (!shader) return null;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private initShaders() {
    const gl = this.gl;
    if (!gl) return;

    const vShader = this.createShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fShader = this.createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vShader || !fShader) return;

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return;
    }

    this.program = program;

    // Full screen quad buffer
    this.posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Uniforms
    const uniformNames = [
      "u_resolution",
      "u_view",
      "u_color_mode",
      "u_palette",
      "u_contour_density",
      "u_isophase_density",
      "u_show_modulus_rings",
      "u_show_isophases",
      "u_brightness",
    ];

    for (const name of uniformNames) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }
  }

  public render(
    width: number,
    height: number,
    view: { reMin: number; reMax: number; imMin: number; imMax: number },
    options: {
      colorMode: number;
      palette: number;
      contourDensity: number;
      isophaseDensity: number;
      showModulusRings: boolean;
      showIsophases: boolean;
      brightness: number;
    }
  ) {
    const gl = this.gl;
    if (!gl || !this.program || !this.posBuffer) return;

    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);

    // Setup vertex attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    const posAttr = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    // Set uniforms
    gl.uniform2f(this.uniforms["u_resolution"], width, height);
    gl.uniform4f(this.uniforms["u_view"], view.reMin, view.reMax, view.imMin, view.imMax);
    gl.uniform1i(this.uniforms["u_color_mode"], options.colorMode);
    gl.uniform1i(this.uniforms["u_palette"], options.palette);
    gl.uniform1f(this.uniforms["u_contour_density"], options.contourDensity);
    gl.uniform1f(this.uniforms["u_isophase_density"], options.isophaseDensity);
    gl.uniform1f(this.uniforms["u_show_modulus_rings"], options.showModulusRings ? 1.0 : 0.0);
    gl.uniform1f(this.uniforms["u_show_isophases"], options.showIsophases ? 1.0 : 0.0);
    gl.uniform1f(this.uniforms["u_brightness"], options.brightness);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public isAvailable(): boolean {
    return this.gl !== null && this.program !== null;
  }
}

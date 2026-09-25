// Hydrogen eigenfunctions ψ_nlm = R_nl(r) Y_l^m(θ,φ) in atomic units (Bohr radius a0 = 1).
// The same formulas are implemented in GLSL (src/shaders/hydrogen.ts) for the volumetric render.
import { Rng } from '../engine/prng';

function factorial(n: number) { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }

/** generalised Laguerre L_k^{(α)}(x) by recurrence */
export function laguerre(k: number, alpha: number, x: number) {
  if (k === 0) return 1;
  let l0 = 1, l1 = 1 + alpha - x;
  for (let i = 1; i < k; i++) {
    const l2 = ((2 * i + 1 + alpha - x) * l1 - (i + alpha) * l0) / (i + 1);
    l0 = l1; l1 = l2;
  }
  return l1;
}

/** R_nl(r), normalised so ∫ R² r² dr = 1 */
export function radial(n: number, l: number, r: number) {
  const rho = (2 * r) / n;
  const norm = Math.sqrt(Math.pow(2 / n, 3) * factorial(n - l - 1) / (2 * n * factorial(n + l)));
  return norm * Math.exp(-rho / 2) * Math.pow(rho, l) * laguerre(n - l - 1, 2 * l + 1, rho);
}

/** associated Legendre P_l^m(x), m ≥ 0, with Condon–Shortley phase */
export function legendre(l: number, m: number, x: number) {
  let pmm = 1;
  if (m > 0) {
    const s = Math.sqrt((1 - x) * (1 + x));
    let f = 1;
    for (let i = 1; i <= m; i++) { pmm *= -f * s; f += 2; }
  }
  if (l === m) return pmm;
  let pmmp1 = x * (2 * m + 1) * pmm;
  if (l === m + 1) return pmmp1;
  let pll = 0;
  for (let ll = m + 2; ll <= l; ll++) {
    pll = ((2 * ll - 1) * x * pmmp1 - (ll + m - 1) * pmm) / (ll - m);
    pmm = pmmp1; pmmp1 = pll;
  }
  return pll;
}

/** |Y_l^m| normalisation × P_l^|m|(cosθ); the φ-dependence is e^{imφ} */
export function ylmTheta(l: number, m: number, theta: number) {
  const am = Math.abs(m);
  const k = Math.sqrt(((2 * l + 1) / (4 * Math.PI)) * factorial(l - am) / factorial(l + am));
  return k * legendre(l, am, Math.cos(theta));
}

/** complex ψ at a Cartesian point */
export function psi(n: number, l: number, m: number, x: number, y: number, z: number): [number, number] {
  const r = Math.hypot(x, y, z);
  const theta = r > 0 ? Math.acos(Math.max(-1, Math.min(1, z / r))) : 0;
  const phi = Math.atan2(y, x);
  const a = radial(n, l, r) * ylmTheta(l, m, theta);
  return [a * Math.cos(m * phi), a * Math.sin(m * phi)];
}

/** Draw samples from |ψ_nlm|² (exact: radial inverse-CDF × angular rejection). Returns xyz + phase (0..1). */
export function sampleOrbital(n: number, l: number, m: number, count: number, seed: number): Float32Array {
  const rng = new Rng(seed, n * 100 + l * 10 + m + 7);
  const rMax = n * n * 4 + 10;
  const bins = 4096;
  const cdf = new Float64Array(bins + 1);
  for (let i = 1; i <= bins; i++) {
    const r = ((i - 0.5) / bins) * rMax;
    const R = radial(n, l, r);
    cdf[i] = cdf[i - 1] + R * R * r * r;
  }
  for (let i = 1; i <= bins; i++) cdf[i] /= cdf[bins];
  let maxAng = 0;
  for (let i = 0; i <= 256; i++) { const v = ylmTheta(l, m, (Math.PI * i) / 256) ** 2; if (v > maxAng) maxAng = v; }
  const out = new Float32Array(count * 4);
  for (let k = 0; k < count; k++) {
    const u = rng.float();
    let lo = 0, hi = bins;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid; else hi = mid; }
    const frac = (u - cdf[lo]) / Math.max(1e-12, cdf[hi] - cdf[lo]);
    const r = ((lo + frac) / bins) * rMax;
    let theta = 0;
    for (;;) {
      const ct = rng.range(-1, 1);
      theta = Math.acos(ct);
      if (rng.float() * maxAng <= ylmTheta(l, m, theta) ** 2) break;
    }
    const phi = rng.range(0, 2 * Math.PI);
    const st = Math.sin(theta);
    const x = r * st * Math.cos(phi), y = r * st * Math.sin(phi), z = r * Math.cos(theta);
    // phase of ψ at this point: sign of the real part of R·Y·e^{imφ}, plus mφ
    const amp = radial(n, l, r) * ylmTheta(l, m, theta);
    let ph = m * phi + (amp < 0 ? Math.PI : 0);
    ph = ((ph % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    out[k * 4] = x; out[k * 4 + 1] = y; out[k * 4 + 2] = z; out[k * 4 + 3] = ph / (2 * Math.PI);
  }
  return out;
}

/** Hydrogen energy in eV */
export const energyEV = (n: number) => -13.605693122994 / (n * n);

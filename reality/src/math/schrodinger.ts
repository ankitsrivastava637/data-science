// 2D time-dependent Schrödinger equation, split-step Fourier (Strang splitting), ħ = m = 1.
//   ψ ← e^{-iVΔt/2} · F⁻¹[ e^{-i k²Δt/2} F[ e^{-iVΔt/2} ψ ] ]
// Used for the double slit: a Gaussian packet hits a wall with two slits; the time-integrated
// |ψ|² along a detector line becomes the probability density for Born-rule sampling.
import { fft2 } from './fft';

export interface SlitParams {
  nx: number; ny: number;      // grid (powers of two)
  dx: number;                  // grid spacing
  dt: number;
  steps: number;
  frames: number;              // snapshots to store
  k0: number;                  // mean momentum along +x
  sigma: number;               // packet width
  x0: number;                  // initial packet centre (x, relative to grid centre)
  wallX: number;               // wall position (relative to centre)
  wallThick: number;
  slitSep: number;             // centre-to-centre
  slitWidth: number;
  V0: number;                  // barrier height
  screenX: number;             // detector line (relative to centre)
  absorb: number;              // width of absorbing border (cells)
}

export const DEFAULT_SLIT: SlitParams = {
  nx: 256, ny: 256, dx: 1, dt: 0.9, steps: 300, frames: 75,
  k0: 1.1, sigma: 14, x0: -84, wallX: -38, wallThick: 3, slitSep: 22, slitWidth: 5, V0: 12,
  screenX: 92, absorb: 20,
};

export interface Grid {
  re: Float64Array; im: Float64Array; V: Float64Array;
  kin: { c: Float64Array; s: Float64Array };
  mask: Float64Array | null;
  p: SlitParams;
}

export function makeGrid(p: SlitParams, withAbsorber = true, withWall = true): Grid {
  const { nx, ny, dx } = p;
  const N = nx * ny;
  const re = new Float64Array(N), im = new Float64Array(N), V = new Float64Array(N);
  const cx = nx / 2, cy = ny / 2;
  for (let j = 0; j < ny; j++) {
    const y = (j - cy) * dx;
    for (let i = 0; i < nx; i++) {
      const x = (i - cx) * dx;
      const g = Math.exp(-((x - p.x0) ** 2 + y * y) / (4 * p.sigma * p.sigma));
      re[j * nx + i] = g * Math.cos(p.k0 * x);
      im[j * nx + i] = g * Math.sin(p.k0 * x);
      if (withWall && Math.abs(x - p.wallX) <= p.wallThick / 2) {
        const inSlit = Math.abs(Math.abs(y) - p.slitSep / 2) <= p.slitWidth / 2;
        if (!inSlit) V[j * nx + i] = p.V0;
      }
    }
  }
  normalise(re, im, dx);
  // kinetic propagator e^{-i k² dt / 2}
  const c = new Float64Array(N), s = new Float64Array(N);
  for (let j = 0; j < ny; j++) {
    const ky = (2 * Math.PI * (j < ny / 2 ? j : j - ny)) / (ny * dx);
    for (let i = 0; i < nx; i++) {
      const kx = (2 * Math.PI * (i < nx / 2 ? i : i - nx)) / (nx * dx);
      const ph = -0.5 * (kx * kx + ky * ky) * p.dt;
      c[j * nx + i] = Math.cos(ph); s[j * nx + i] = Math.sin(ph);
    }
  }
  let mask: Float64Array | null = null;
  if (withAbsorber) {
    mask = new Float64Array(N);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const d = Math.min(i, nx - 1 - i, j, ny - 1 - j);
      mask[j * nx + i] = d >= p.absorb ? 1 : Math.pow(Math.sin((Math.PI / 2) * (d / p.absorb)), 0.25);
    }
  }
  return { re, im, V, kin: { c, s }, mask, p };
}

export function normalise(re: Float64Array, im: Float64Array, dx: number) {
  let n = 0;
  for (let i = 0; i < re.length; i++) n += re[i] * re[i] + im[i] * im[i];
  n = Math.sqrt(n * dx * dx);
  for (let i = 0; i < re.length; i++) { re[i] /= n; im[i] /= n; }
}

export function norm(re: Float64Array, im: Float64Array, dx: number) {
  let n = 0;
  for (let i = 0; i < re.length; i++) n += re[i] * re[i] + im[i] * im[i];
  return n * dx * dx;
}

function potentialHalf(g: Grid) {
  const { re, im, V } = g;
  const h = g.p.dt / 2;
  for (let i = 0; i < re.length; i++) {
    const v = V[i];
    if (v === 0) continue;
    const c = Math.cos(-v * h), s = Math.sin(-v * h);
    const r = re[i], m = im[i];
    re[i] = r * c - m * s; im[i] = r * s + m * c;
  }
}

export function step(g: Grid) {
  const { re, im, kin, mask } = g;
  const { nx, ny } = g.p;
  potentialHalf(g);
  fft2(re, im, nx, ny);
  for (let i = 0; i < re.length; i++) {
    const r = re[i], m = im[i], c = kin.c[i], s = kin.s[i];
    re[i] = r * c - m * s; im[i] = r * s + m * c;
  }
  fft2(re, im, nx, ny, true);
  potentialHalf(g);
  if (mask) for (let i = 0; i < re.length; i++) { re[i] *= mask[i]; im[i] *= mask[i]; }
}

export interface SlitResult {
  nx: number; ny: number; frames: number;
  /** per frame: interleaved (re, im) quantised to int8 relative to frame max amplitude */
  psi: Int8Array;
  /** per frame amplitude scale (max |ψ|) */
  scale: Float32Array;
  /** simulation time of each frame */
  times: Float32Array;
  /** detection probability density along y at the screen line (normalised to sum 1) */
  screen: Float64Array;
  wall: { x: number; sep: number; width: number; thick: number };
  screenX: number;
  dx: number;
}

export function runDoubleSlit(p: SlitParams = DEFAULT_SLIT, onProgress?: (f: number) => void): SlitResult {
  const g = makeGrid(p);
  const { nx, ny } = p;
  const N = nx * ny;
  const psi = new Int8Array(N * 2 * p.frames);
  const scale = new Float32Array(p.frames);
  const times = new Float32Array(p.frames);
  const screen = new Float64Array(ny);
  const si = Math.round(nx / 2 + p.screenX / p.dx);
  const every = p.steps / (p.frames - 1);
  let f = 0;
  const snap = (stepIndex: number) => {
    let m = 1e-30;
    for (let i = 0; i < N; i++) { const a = Math.abs(g.re[i]) > Math.abs(g.im[i]) ? Math.abs(g.re[i]) : Math.abs(g.im[i]); if (a > m) m = a; }
    const off = f * N * 2;
    for (let i = 0; i < N; i++) {
      psi[off + 2 * i] = Math.max(-127, Math.min(127, Math.round((g.re[i] / m) * 127)));
      psi[off + 2 * i + 1] = Math.max(-127, Math.min(127, Math.round((g.im[i] / m) * 127)));
    }
    scale[f] = m;
    times[f] = stepIndex * p.dt;
    f++;
  };
  snap(0);
  for (let s = 1; s <= p.steps; s++) {
    step(g);
    for (let j = 0; j < ny; j++) {
      const k = j * nx + si;
      screen[j] += g.re[k] * g.re[k] + g.im[k] * g.im[k];
    }
    if (f < p.frames && s >= Math.round(f * every)) snap(s);
    if (onProgress && s % 20 === 0) onProgress(s / p.steps);
  }
  while (f < p.frames) snap(p.steps);
  let tot = 0;
  for (let j = 0; j < ny; j++) tot += screen[j];
  for (let j = 0; j < ny; j++) screen[j] /= tot;
  return { nx, ny, frames: p.frames, psi, scale, times, screen, wall: { x: p.wallX, sep: p.slitSep, width: p.slitWidth, thick: p.wallThick }, screenX: p.screenX, dx: p.dx };
}

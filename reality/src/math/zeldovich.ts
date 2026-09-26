// Zel'dovich approximation (first-order Lagrangian perturbation theory):
//   x(q, a) = q + D(a) ψ(q),   ψ = −∇φ,   ∇²φ = δ_lin(q)   (at D = 1)
// from a Gaussian random field with a schematic ΛCDM-like power-spectrum shape
// P(k) ∝ k / (1 + (k/k0)^2)^2 (turnover near k0; normalisation chosen for a well-developed web).
import { fft3 } from './fft';
import { Rng } from '../engine/prng';

export interface Web { n: number; box: number; disp: Float32Array; q: Float32Array; rms: number }

export function zeldovich(n: number, boxMpc: number, seed: number, dispRmsCells = 1.9): Web {
  const N = n * n * n;
  const rng = new Rng(seed, 2001);
  // white noise → Fourier → shape by √P
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = rng.normal();
  fft3(re, im, n);
  const k0 = (2 * Math.PI / boxMpc) * 9; // turnover ~ box/9
  const kf = (i: number) => (i <= n / 2 ? i : i - n) * (2 * Math.PI / boxMpc);
  const dx = new Float64Array(N), dxi = new Float64Array(N), dy = new Float64Array(N), dyi = new Float64Array(N), dz = new Float64Array(N), dzi = new Float64Array(N);
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const idx = (z * n + y) * n + x;
    const kx = kf(x), ky = kf(y), kz = kf(z);
    const k2 = kx * kx + ky * ky + kz * kz;
    if (k2 === 0) continue;
    const k = Math.sqrt(k2);
    const amp = Math.sqrt(k / (1 + (k / k0) ** 2) ** 2);
    const dr = re[idx] * amp, di = im[idx] * amp; // δ_k
    // ψ_k = i k δ_k / k²  →  (i·δ)·k/k² = (−di + i dr)·k/k²
    const f = 1 / k2;
    dx[idx] = -di * kx * f; dxi[idx] = dr * kx * f;
    dy[idx] = -di * ky * f; dyi[idx] = dr * ky * f;
    dz[idx] = -di * kz * f; dzi[idx] = dr * kz * f;
  }
  fft3(dx, dxi, n, true); fft3(dy, dyi, n, true); fft3(dz, dzi, n, true);
  let s2 = 0;
  for (let i = 0; i < N; i++) s2 += dx[i] ** 2 + dy[i] ** 2 + dz[i] ** 2;
  const rms = Math.sqrt(s2 / (3 * N));
  const cell = boxMpc / n;
  const scale = (dispRmsCells * cell) / rms;
  const disp = new Float32Array(N * 3), q = new Float32Array(N * 3);
  const jr = new Rng(seed, 2002);
  const jit = () => jr.float();
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (z * n + y) * n + x;
    // sub-cell jitter hides the Lagrangian lattice (no moiré at early times)
    q[i * 3] = (x + jit()) * cell - boxMpc / 2; q[i * 3 + 1] = (y + jit()) * cell - boxMpc / 2; q[i * 3 + 2] = (z + jit()) * cell - boxMpc / 2;
    disp[i * 3] = dx[i] * scale; disp[i * 3 + 1] = dy[i] * scale; disp[i * 3 + 2] = dz[i] * scale;
  }
  return { n, box: boxMpc, disp, q, rms: rms * scale };
}

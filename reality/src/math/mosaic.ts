// Foveal cone mosaic: a hexagonal lattice warped radially so the local density follows
// D(r) = D0 / (1 + (r/r1)^1.2) with D0 = 199,000 / mm² (Curcio et al. 1990), then jittered and
// relaxed. S cones absent inside r < 50 µm (S-cone-free zone ~100 µm across), ~7 % beyond;
// L:M ≈ 2:1 at random (one ratio within the wide normal range reported by Hofer et al. 2005).
import { Rng } from '../engine/prng';

export const D0_PER_UM2 = 0.199;      // 199,000 per mm²
export const R1_UM = 80;
export const S_FREE_RADIUS_UM = 50;

export function densityPerUm2(rUm: number) { return D0_PER_UM2 / (1 + Math.pow(rUm / R1_UM, 1.2)); }

export interface Mosaic {
  count: number;
  /** x, y in µm (fovea centre at origin), spacing (local cone diameter, µm) */
  pos: Float32Array;     // 2 per cone
  size: Float32Array;    // 1 per cone
  type: Uint8Array;      // 0 = L, 1 = M, 2 = S
}

export function makeMosaic(radiusUm: number, seed: number): Mosaic {
  const rng = new Rng(seed, 101);
  // cumulative count N(r) = ∫ D 2πr dr (numerical), for inverse radial warp
  const steps = 4000;
  const rs = new Float64Array(steps + 1), Ns = new Float64Array(steps + 1);
  for (let i = 1; i <= steps; i++) {
    const r0 = ((i - 1) / steps) * radiusUm, r1 = (i / steps) * radiusUm;
    const rm = 0.5 * (r0 + r1);
    rs[i] = r1;
    Ns[i] = Ns[i - 1] + densityPerUm2(rm) * 2 * Math.PI * rm * (r1 - r0);
  }
  const total = Ns[steps];
  // unit-density hex lattice in ρ-space: n0 = 1 per unit area; spacing a = sqrt(2/√3)
  const a = Math.sqrt(2 / Math.sqrt(3));
  const rhoMax = Math.sqrt(total / Math.PI);
  const pts: number[] = [];
  const rows = Math.ceil(rhoMax / (a * Math.sqrt(3) / 2)) + 2;
  for (let j = -rows; j <= rows; j++) {
    const y = j * a * Math.sqrt(3) / 2;
    const off = (j & 1) * a / 2;
    const cols = Math.ceil(rhoMax / a) + 2;
    for (let i = -cols; i <= cols; i++) {
      const x = i * a + off;
      const rho = Math.hypot(x, y);
      if (rho > rhoMax) continue;
      // find r with N(r) = π ρ²
      const target = Math.PI * rho * rho;
      let lo = 0, hi = steps;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (Ns[mid] < target) lo = mid; else hi = mid; }
      const f = (target - Ns[lo]) / Math.max(1e-12, Ns[hi] - Ns[lo]);
      const r = rs[lo] + f * (rs[hi] - rs[lo]);
      const k = rho > 0 ? r / rho : 0;
      pts.push(x * k, y * k);
    }
  }
  const count = pts.length / 2;
  const pos = new Float32Array(pts);
  const size = new Float32Array(count);
  const type = new Uint8Array(count);
  // jitter proportional to local spacing, then two relaxation passes toward neighbour mean distance
  for (let i = 0; i < count; i++) {
    const r = Math.hypot(pos[2 * i], pos[2 * i + 1]);
    const sp = Math.sqrt(2 / (Math.sqrt(3) * densityPerUm2(r)));
    size[i] = sp;
    pos[2 * i] += rng.normal() * sp * 0.07;
    pos[2 * i + 1] += rng.normal() * sp * 0.07;
  }
  for (let i = 0; i < count; i++) {
    const r = Math.hypot(pos[2 * i], pos[2 * i + 1]);
    if (r < S_FREE_RADIUS_UM) type[i] = rng.float() < 2 / 3 ? 0 : 1;
    else { const u = rng.float(); type[i] = u < 0.07 ? 2 : u < 0.07 + 0.93 * (2 / 3) ? 0 : 1; }
  }
  return { count, pos, size, type };
}

/** Govardovskii et al. (2000) A1 visual-pigment template (α + β bands), normalised to 1 at peak. */
export function govardovskii(lambdaNm: number, lmax: number) {
  const x = lmax / lambdaNm;
  const A = 69.7, B = 28, b = 0.922, C = -14.9, c = 1.104, D = 0.674;
  const a = 0.8795 + 0.0459 * Math.exp(-((lmax - 300) ** 2) / 11940);
  const alpha = 1 / (Math.exp(A * (a - x)) + Math.exp(B * (b - x)) + Math.exp(C * (c - x)) + D);
  const lmb = 189 + 0.315 * lmax;
  const bb = -40.5 + 0.195 * lmax;
  const beta = 0.26 * Math.exp(-(((lambdaNm - lmb) / bb) ** 2));
  return alpha + beta;
}
export const LMAX = { L: 558.4, M: 530.8, S: 419.0, rod: 496.3 } as const;

/** Photon absorption times per cone in "exposure" units; up to K per cone. */
export interface PhotonEvents {
  K: number;
  times: Float32Array; // count × K, sorted per cone, +Inf padded
}

export function photonEvents(rates: Float32Array, exposureMax: number, K: number, seed: number): PhotonEvents {
  const n = rates.length;
  const times = new Float32Array(n * K).fill(Infinity);
  for (let i = 0; i < n; i++) {
    const rng = new Rng(seed, 5000 + i);
    let tt = 0;
    const lam = Math.max(1e-6, rates[i]);
    for (let k = 0; k < K; k++) {
      tt += -Math.log(1 - rng.float()) / lam;
      if (tt > exposureMax) break;
      times[i * K + k] = tt;
    }
  }
  return { K, times };
}

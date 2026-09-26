// Jobs for chapters beyond the first three helpers in jobs.ts.
import { makeBDNA, densityGrid } from '../math/dna';
import { zetaZeros, zeta } from '../math/numbertheory';
import { zeldovich } from '../math/zeldovich';
import { hashU32 } from './prng';

/** Tileable 3D value-noise fBm (3 octaves, periods 8/16/32 lattice units over an 8-unit tile),
 *  baked to an N³ R8 volume. Used by the proton's gluon "action density" instead of per-step noise. */
export function tileableFbm3(N: number, seed: number): Uint8Array {
  const out = new Uint8Array(N * N * N);
  const fade = (t: number) => t * t * (3 - 2 * t);
  const lattice = (x: number, y: number, z: number, P: number, o: number) =>
    hashU32(((x % P) + P) % P + o * 131, ((((y % P) + P) % P) * 977) ^ seed, (((z % P) + P) % P) * 7919 + o) / 4294967296;
  const vn = (x: number, y: number, z: number, P: number, o: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const fx = fade(x - xi), fy = fade(y - yi), fz = fade(z - zi);
    let s = 0;
    for (let c = 0; c < 8; c++) {
      const dx = c & 1, dy = (c >> 1) & 1, dz = (c >> 2) & 1;
      s += lattice(xi + dx, yi + dy, zi + dz, P, o) * (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
    }
    return s;
  };
  for (let k = 0; k < N; k++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i / N) * 8, y = (j / N) * 8, z = (k / N) * 8;
    const v = 0.5 * vn(x, y, z, 8, 1) + 0.25 * vn(x * 2, y * 2, z * 2, 16, 2) + 0.125 * vn(x * 4, y * 4, z * 4, 32, 3) + 0.0625 * 0.5;
    out[(k * N + j) * N + i] = Math.round(Math.min(1, v) * 255);
  }
  return out;
}

export const extraJobs: Record<string, (...a: any[]) => unknown> = {
  dna: (seed: number) => makeBDNA(24, seed),
  density: (seed: number) => {
    const m = makeBDNA(24, seed);
    const H1 = m.atoms[m.focusH1], N1 = m.atoms[m.focusN1];
    const c: [number, number, number] = [(H1.x + N1.x) / 2, (H1.y + N1.y) / 2, (H1.z + N1.z) / 2];
    const h = 5.2, N = 72;
    return { data: densityGrid(m, c, h, N), N, c, h };
  },
  zeta: () => {
    const zeros = zetaZeros(100);
    const n = 2501;
    const curve = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) { const z = zeta([0.5, i * 0.02]); curve[i * 2] = z[0]; curve[i * 2 + 1] = z[1]; }
    return { zeros, curve };
  },
  web: (n: number, seed: number) => zeldovich(n, 500, seed),
  protonNoise: (seed: number) => ({ N: 96, data: tileableFbm3(96, seed) }),
};

// Jobs for chapters beyond the first three helpers in jobs.ts.
import { makeBDNA, densityGrid } from '../math/dna';
import { zetaZeros, zeta } from '../math/numbertheory';
import { zeldovich } from '../math/zeldovich';

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
};

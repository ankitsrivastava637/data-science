// Jobs for chapters beyond the first three helpers in jobs.ts.
import { makeBDNA, densityGrid } from '../math/dna';

export const extraJobs: Record<string, (...a: any[]) => unknown> = {
  dna: (seed: number) => makeBDNA(24, seed),
  density: (seed: number) => {
    const m = makeBDNA(24, seed);
    const H1 = m.atoms[m.focusH1], N1 = m.atoms[m.focusN1];
    const c: [number, number, number] = [(H1.x + N1.x) / 2, (H1.y + N1.y) / 2, (H1.z + N1.z) / 2];
    const h = 5.2, N = 72;
    return { data: densityGrid(m, c, h, N), N, c, h };
  },
};

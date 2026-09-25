// Shared precomputed data, produced once at boot by a pool of compute workers.
import ComputeWorker from './compute.worker.ts?worker&inline';
import type { MosaicJob, OrbitalSet, Detections } from './jobs';
import type { SlitResult } from '../math/schrodinger';
import { makeCell, type CellModel } from '../content/cellModel';

export interface Shared {
  seed: number;
  cell: CellModel;
  mosaic: MosaicJob;
  orbitals: OrbitalSet[];
  slit: SlitResult;
  detections: Detections;
  extra: Record<string, any>;
}

class Pool {
  private workers: Worker[] = [];
  private queue: { job: string; args: unknown[]; resolve: (v: any) => void; reject: (e: any) => void }[] = [];
  private busy = new Map<Worker, number>();
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void; w: Worker }>();
  private nextId = 1;
  constructor(n: number) {
    for (let i = 0; i < n; i++) {
      const w = new ComputeWorker();
      w.onmessage = (e) => {
        const p = this.pending.get(e.data.id);
        if (!p) return;
        this.pending.delete(e.data.id);
        this.busy.delete(w);
        if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data.result);
        this.pump();
      };
      w.onerror = (e) => { console.error('worker error', e.message); };
      this.workers.push(w);
    }
  }
  run<T>(job: string, ...args: unknown[]): Promise<T> {
    return new Promise((resolve, reject) => { this.queue.push({ job, args, resolve, reject }); this.pump(); });
  }
  private pump() {
    for (const w of this.workers) {
      if (this.busy.has(w) || !this.queue.length) continue;
      const q = this.queue.shift()!;
      const id = this.nextId++;
      this.busy.set(w, id);
      this.pending.set(id, { resolve: q.resolve, reject: q.reject, w });
      w.postMessage({ id, job: q.job, args: q.args });
    }
  }
  terminate() { for (const w of this.workers) w.terminate(); }
}

export type ExtraJob = { key: string; job: string; args: (s: Partial<Shared>) => unknown[]; after?: string };
/** Later chapters append their precomputation here. */
export const EXTRA_JOBS: ExtraJob[] = [
  { key: 'dna', job: 'dna', args: (s) => [s.seed] },
  { key: 'density', job: 'density', args: (s) => [s.seed] },
  { key: 'zeta', job: 'zeta', args: () => [] },
];

export async function precompute(seed: number, particleScale: number, onProgress: (done: number, total: number, label: string) => void): Promise<Shared> {
  const hc = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  const pool = new Pool(Math.max(2, Math.min(4, hc - 1)));
  const total = 4 + EXTRA_JOBS.length;
  let done = 0;
  const tick = (label: string) => onProgress(++done, total, label);
  const shared: Partial<Shared> = { seed, cell: makeCell(seed), extra: {} };
  const slitP = pool.run<SlitResult>('doubleSlit').then((r) => { tick('Schrödinger evolution'); shared.slit = r; return r; });
  const mosaicP = pool.run<MosaicJob>('mosaic', seed).then((r) => { tick('cone mosaic'); shared.mosaic = r; });
  const orbP = pool.run<OrbitalSet[]>('orbitals', seed, Math.round(60000 * Math.min(1.5, particleScale))).then((r) => { tick('orbital samples'); shared.orbitals = r; });
  const detP = slitP.then((r) => pool.run<Detections>('detections', r.screen, 12000, seed)).then((d) => { tick('Born-rule detections'); shared.detections = d; });
  const extraP = Promise.all(EXTRA_JOBS.map(async (j) => {
    const r = await pool.run(j.job, ...j.args(shared));
    shared.extra![j.key] = r;
    tick(j.key);
  }));
  await Promise.all([slitP, mosaicP, orbP, detP, extraP]);
  pool.terminate();
  return shared as Shared;
}

// Shared precomputed data, produced once at boot by a pool of compute workers.
import ComputeWorker from './compute.worker.ts?worker&inline';
import type { MosaicJob, OrbitalSet, Detections } from './jobs';
import type { SlitResult } from '../math/schrodinger';
import { makeCell, type CellModel } from '../content/cellModel';
import { rasterizeLatex } from './katexRaster';
import { equationById } from '../content/ledger';
import earthDayUrl from '../assets/earth/blue-marble.jpg';
import earthNightUrl from '../assets/earth/night-lights.jpg';

/** Bundled images (inlined as data URIs in the single-file build), decoded before playback. */
const IMAGES: Record<string, string> = { earthDay: earthDayUrl, earthNight: earthNightUrl };
async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

export interface Shared {
  seed: number;
  cell: CellModel;
  mosaic: MosaicJob;
  orbitals: OrbitalSet[];
  slit: SlitResult;
  detections: Detections;
  extra: Record<string, any>;
  images: Record<string, HTMLImageElement>;
  /** ink pixels of the Synthesis equation stack: x, y pairs in raster pixels */
  glyphs: { w: number; h: number; ink: Float32Array };
}

/** Equations whose glyphs the Synthesis particles pass through (all shown earlier in the film). */
export const SYNTHESIS_EQUATIONS = ['E2.2', 'E7.1', 'E9.4'];
async function sampleGlyphs() {
  const latex = '\\begin{gathered}' + SYNTHESIS_EQUATIONS.map((id) => equationById(id)!.latex).join('\\\\[10pt]') + '\\end{gathered}';
  const bmp = await rasterizeLatex(latex, 64);
  const g = bmp.canvas.getContext('2d', { willReadFrequently: true })!;
  const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
  const ink: number[] = [];
  for (let y = 0; y < bmp.height; y++) for (let x = 0; x < bmp.width; x++) if (d[(y * bmp.width + x) * 4 + 3] > 140) ink.push(x, y);
  return { w: bmp.width, h: bmp.height, ink: new Float32Array(ink) };
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
  { key: 'web', job: 'web', args: (s) => [webN, s.seed] },
  { key: 'protonNoise', job: 'protonNoise', args: (s) => [s.seed] },
];
let webN = 64;
export function setWebResolution(n: number) { webN = n; }

export async function precompute(seed: number, particleScale: number, onProgress: (done: number, total: number, label: string) => void): Promise<Shared> {
  const hc = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  const pool = new Pool(Math.max(2, Math.min(4, hc - 1)));
  const total = 6 + EXTRA_JOBS.length;
  let done = 0;
  const tick = (label: string) => onProgress(++done, total, label);
  const shared: Partial<Shared> = { seed, cell: makeCell(seed), extra: {}, images: {} };
  const glyphP = sampleGlyphs().then((g) => { shared.glyphs = g; tick('equation glyphs'); });
  const imgP = Promise.all(Object.entries(IMAGES).map(async ([k, u]) => { shared.images![k] = await loadImage(u); })).then(() => tick('images'));
  const slitP = pool.run<SlitResult>('doubleSlit').then((r) => { tick('Schrödinger evolution'); shared.slit = r; return r; });
  const mosaicP = pool.run<MosaicJob>('mosaic', seed).then((r) => { tick('cone mosaic'); shared.mosaic = r; });
  const orbP = pool.run<OrbitalSet[]>('orbitals', seed, Math.round(60000 * Math.min(1.5, particleScale))).then((r) => { tick('orbital samples'); shared.orbitals = r; });
  const detP = slitP.then((r) => pool.run<Detections>('detections', r.screen, 12000, seed)).then((d) => { tick('Born-rule detections'); shared.detections = d; });
  const extraP = Promise.all(EXTRA_JOBS.map(async (j) => {
    const r = await pool.run(j.job, ...j.args(shared));
    shared.extra![j.key] = r;
    tick(j.key);
  }));
  await Promise.all([slitP, mosaicP, orbP, detP, extraP, imgP, glyphP]);
  pool.terminate();
  return shared as Shared;
}

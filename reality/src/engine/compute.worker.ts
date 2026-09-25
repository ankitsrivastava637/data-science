// Compute worker: runs deterministic precomputation off the main thread.
import { jobMosaic, jobOrbitals, jobDoubleSlit, jobDetections } from './jobs';
import { extraJobs } from './jobsExtra';

type Msg = { id: number; job: string; args: unknown[] };

function transferables(v: unknown, out: Transferable[] = [], seen = new Set<unknown>()): Transferable[] {
  if (v && typeof v === 'object' && !seen.has(v)) {
    seen.add(v);
    if (ArrayBuffer.isView(v)) { if (!out.includes(v.buffer as ArrayBuffer)) out.push(v.buffer as ArrayBuffer); return out; }
    for (const k of Object.keys(v as object)) transferables((v as Record<string, unknown>)[k], out, seen);
  }
  return out;
}

const JOBS: Record<string, (...a: any[]) => unknown> = {
  mosaic: (seed: number) => jobMosaic(seed),
  orbitals: (seed: number, count: number) => jobOrbitals(seed, count),
  doubleSlit: () => jobDoubleSlit(),
  detections: (screen: Float64Array, count: number, seed: number) => jobDetections(screen, count, seed),
  ...extraJobs,
};

self.onmessage = (e: MessageEvent<Msg>) => {
  const { id, job, args } = e.data;
  try {
    const f = JOBS[job];
    if (!f) throw new Error('unknown job ' + job);
    const result = f(...args);
    (self as unknown as Worker).postMessage({ id, result }, transferables(result));
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String((err as Error)?.stack ?? err) });
  }
};

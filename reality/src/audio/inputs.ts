// Score inputs derived from the shared precomputation (the same arrays the pictures use).
import type { Shared } from '../engine/shared';
import type { ScoreInputs } from './score';
import { tauInv } from '../content/cues';

export function scoreInputs(shared: Pick<Shared, 'seed' | 'detections' | 'mosaic' | 'extra'>): ScoreInputs {
  // chapter-1 photon absorptions: every event of a deterministic subset of cones, as chapter-local times
  const ev = shared.mosaic.events, K = ev.K, nCones = ev.times.length / K;
  const stride = Math.max(1, Math.floor(nCones / 90));
  const lt: number[] = [];
  for (let c = 0; c < nCones; c += stride) for (let k = 0; k < K; k++) { const t = ev.times[c * K + k]; if (!Number.isFinite(t)) break; lt.push(tauInv(t)); }
  lt.sort((a, b) => a - b);
  return {
    seed: shared.seed,
    detT: shared.detections.t, detX: shared.detections.x,
    zeros: (shared.extra.zeta as { zeros: number[] }).zeros,
    photonLt: lt,
  };
}

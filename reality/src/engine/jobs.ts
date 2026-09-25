// Heavy deterministic precomputation. Runs inside compute.worker.ts (or directly, in tests).
import { runDoubleSlit, DEFAULT_SLIT, type SlitResult } from '../math/schrodinger';
import { makeMosaic, photonEvents, govardovskii, LMAX, type Mosaic, type PhotonEvents } from '../math/mosaic';
import { sampleOrbital } from '../math/hydrogen';
import { makeCell, cellImage } from '../content/cellModel';
import { Rng } from './prng';

export interface MosaicJob {
  mosaic: Mosaic;
  events: PhotonEvents;
  /** perceived (reconstructed) linear RGB at each cone */
  recon: Float32Array;
  /** expected count at full exposure, per cone (for normalisation) */
  expected: Float32Array;
  radiusUm: number;
  imageScale: number; // µm of retina per µm of cell in the image
}

export const MOSAIC_RADIUS_UM = 260;
export const IMAGE_SCALE = 4.0; // the cell's image on the mosaic is magnified: 25 µm cell → ~100 µm image
export const EXPOSURE_MAX = 1;

// approximate emission spectra (nm) of the three fluorescence channels; used only to derive
// cone catch ratios through the Govardovskii templates
function band(peak: number, width: number) { return (l: number) => Math.exp(-(((l - peak) / width) ** 2)); }
const CHANNELS = [band(605, 32), band(515, 22), band(455, 24)]; // "red" (mitochondria), "green", "blue"
function catchMatrix(): number[][] {
  const m: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const lm = [LMAX.L, LMAX.M, LMAX.S];
  for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) {
    let s = 0;
    for (let l = 380; l <= 720; l += 2) s += CHANNELS[c](l) * govardovskii(l, lm[k]);
    m[k][c] = s;
  }
  return m; // m[coneType][channel]
}

export function jobMosaic(seed: number): MosaicJob {
  const mosaic = makeMosaic(MOSAIC_RADIUS_UM, seed);
  const cell = makeCell(seed);
  const M = catchMatrix();
  const norm = Math.max(...M.map((r) => Math.max(...r)));
  const n = mosaic.count;
  const rates = new Float32Array(n), recon = new Float32Array(n * 3), expected = new Float32Array(n);
  const peakCount = 38; // expected absorptions for the brightest cones at full exposure
  for (let i = 0; i < n; i++) {
    const x = mosaic.pos[2 * i] / IMAGE_SCALE, y = mosaic.pos[2 * i + 1] / IMAGE_SCALE;
    const [r, g, b] = cellImage(cell, x, y);
    const row = M[mosaic.type[i]];
    const rate = (row[0] * r + row[1] * g + row[2] * b) / norm;
    rates[i] = rate * peakCount + 0.08; // + dark noise / stray light
    expected[i] = rates[i];
    recon[i * 3] = r; recon[i * 3 + 1] = g; recon[i * 3 + 2] = b;
  }
  const events = photonEvents(rates, EXPOSURE_MAX, 64, seed);
  return { mosaic, events, recon, expected, radiusUm: MOSAIC_RADIUS_UM, imageScale: IMAGE_SCALE };
}

export interface OrbitalSet { key: string; n: number; l: number; m: number; samples: Float32Array }
export const ORBITALS: [number, number, number][] = [[1, 0, 0], [2, 0, 0], [2, 1, 0], [2, 1, 1], [3, 2, 0], [3, 2, 1], [4, 3, 1]];
export function jobOrbitals(seed: number, count: number): OrbitalSet[] {
  return ORBITALS.map(([n, l, m]) => ({ key: `${n}${l}${m}`, n, l, m, samples: sampleOrbital(n, l, m, count, seed) }));
}

export function jobDoubleSlit(): SlitResult { return runDoubleSlit(DEFAULT_SLIT); }

/** Born-rule detections: sample y from the simulated screen density; times accelerate. */
export interface Detections { y: Float32Array; x: Float32Array; t: Float32Array; count: number }
export function jobDetections(screen: Float64Array, count: number, seed: number): Detections {
  const rng = new Rng(seed, 303);
  const ny = screen.length;
  const cdf = new Float64Array(ny + 1);
  for (let j = 0; j < ny; j++) cdf[j + 1] = cdf[j] + screen[j];
  const y = new Float32Array(count), x = new Float32Array(count), t = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    const u = rng.float() * cdf[ny];
    let lo = 0, hi = ny;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid; else hi = mid; }
    const f = (u - cdf[lo]) / Math.max(1e-15, cdf[hi] - cdf[lo]);
    y[k] = (lo + f) / ny;            // 0..1 across the screen
    x[k] = rng.normal() * 0.25;       // small spread in depth of the detector
    // detection times in [0,1]: one at a time at first, then a flood (rate ∝ τ²)
    t[k] = Math.cbrt((k + rng.float()) / count);
  }
  return { y, x, t, count };
}

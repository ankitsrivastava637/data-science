// Timing constants shared by the chapters that draw an event and the score that sounds it.
// DOM-free and three-free, so the audio worker can import it. All times are chapter-local seconds.
import { Rng } from '../engine/prng';
import { clamp } from '../engine/ease';

// Chapter 1 · photon absorptions build the image on the mosaic
export const EXPOSURE_START = 45, EXPOSURE_LEN = 13, EXPOSURE_POW = 1.7;
export const tauOf = (lt: number) => Math.pow(clamp((lt - EXPOSURE_START) / EXPOSURE_LEN), EXPOSURE_POW);
export const tauInv = (x: number) => EXPOSURE_START + EXPOSURE_LEN * Math.pow(Math.max(0, x), 1 / EXPOSURE_POW);

// Chapter 3 · double slit and entangled pairs
export const SLIT = { simStart: 66.5, simEnd: 78.5, detStart: 74.5, detEnd: 95 };
export const detTau = (lt: number) => clamp((lt - SLIT.detStart) / (SLIT.detEnd - SLIT.detStart));
export const ENT_START = 109.3, ENT_RATE = 4.0; // pairs per second
export interface EntRecord { a: number[]; b: number[]; thetaB: number[] }
export function makeEntanglementRecord(seed: number): EntRecord {
  const rng = new Rng(seed, 1301);
  const a: number[] = [], b: number[] = [], thetaB: number[] = [];
  for (let i = 0; i < 64; i++) {
    const th = i < 18 ? 0 : Math.PI / 3; // detector B turned by 60° for the later pairs
    const A = rng.float() < 0.5 ? 1 : -1;
    // singlet: P(B = −A) = cos²(θ/2)
    const B = rng.float() < Math.cos(th / 2) ** 2 ? -A : A;
    a.push(A); b.push(B); thetaB.push(th);
  }
  return { a, b, thetaB };
}

// Chapter 6 · transcription, then one codon per 1.3 s
export const TX = { start: 2, end: 12 };
export const TL = { start: 14.5, per: 1.3 };

// Chapter 7 · twin paradox (v = 0.8c, γ = 5/3): the diagram's clock advances 10 years over 12 s from lt 60
export const TWIN = { start: 60, span: 12, years: 10, v: 0.8, tickYears: 0.5 };

// Chapter 8 · static clocks at r = 1.5, 3, 10 rₛ shown from lt 47 to 57.8; hands turn 1.6 rad/s × rate
export const STATIC_CLOCKS = { radii: [1.5, 3, 10], start: 47, end: 57.8, omega: 1.6 };

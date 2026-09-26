// The score: deterministic, procedural, derived from the timeline. Every output sample is a pure
// function of (seed, sample index, sample rate). Voices are closed-form (phase = 2π f τ, no
// oscillator state); the two stateful stages — an FDN reverb and a look-ahead limiter — are re-run
// over a fixed warm-up before every block, so any block renders independently and live playback,
// seeking and the offline render produce the same sound.
//
// DOM-free: runs in the audio worker, on the main thread for offline renders, and in Node tests.
import { CHAPTERS, SINGULARITY_CUT_LOCAL, DURATION, END_START, TITLE_END } from '../content/chapters';
import { EQ_CUES } from '../content/script';
import { SLIT, ENT_START, ENT_RATE, makeEntanglementRecord, TL, TX, TWIN, STATIC_CLOCKS, EXPOSURE_START } from '../content/cues';
import { DEMO_MRNA, translateCodon } from '../math/geneticCode';
import { NU } from '../math/water';

export const BLOCK_SEC = 4;
export const WARM_SEC = 3;
const LOOKAHEAD_SEC = 0.004;
/** master gain, calibrated so the full film measures ≈ −14 LUFS integrated (see tests/audio.test.ts) */
export const MASTER_DB = 14.8;
const CEILING = 0.891; // −1 dBFS

// ── voices ──────────────────────────────────────────────────────────────────
export const enum K { PAD, BELL, PLUCK, TICK, GLIDE, SWELL, GRAIN, SUB }
export interface Voice {
  k: K; t0: number; t1: number; f: number; f1: number; amp: number; pan: number;
  att: number; rel: number; send: number; seed: number;
  /** PAD / SAW: partial ratios and amplitudes; BELL/PLUCK: decay (s) in p[0] */
  p?: number[]; q?: number[];
}
export interface ScoreInputs {
  seed: number;
  /** Born-rule detection times (0..1, cube-root schedule) and positions, from the slit simulation */
  detT: ArrayLike<number>; detX: ArrayLike<number>;
  /** imaginary parts of the first zeta zeros */
  zeros: ArrayLike<number>;
  /** chapter-1 photon absorption times (chapter-local seconds), a deterministic subset */
  photonLt: ArrayLike<number>;
}
export interface Score { voices: Voice[]; ducks: [number, number][]; duration: number }

const TAU = Math.PI * 2;
function h32(n: number) {
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d); n = Math.imul(n ^ (n >>> 15), 0x846ca68b); return (n ^ (n >>> 16)) >>> 0;
}
const h01 = (a: number, b = 0) => h32((Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x632be5ab, 0x85ebca77)) >>> 0) / 4294967296;
const chStart = (n: number) => CHAPTERS[n - 1].start;
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Build the full event list. Pure function of the inputs. */
export function buildScore(inp: ScoreInputs): Score {
  const V: Voice[] = [];
  const ducks: [number, number][] = [];
  let sid = 1;
  const add = (v: Partial<Voice> & { k: K; t0: number; t1: number; f: number }) => V.push({ f1: v.f, amp: 0.1, pan: 0, att: 0.005, rel: 0.05, send: 0.25, seed: sid++, ...v } as Voice);
  const pad = (t0: number, t1: number, f: number, amp: number, ratios: number[], amps: number[], att = 3, rel = 3, pan = 0, send = 0.45) =>
    add({ k: K.PAD, t0, t1, f, amp, att, rel, pan, send, p: ratios, q: amps });
  const bell = (t: number, f: number, amp: number, decay = 2.5, pan = 0, send = 0.5) => add({ k: K.BELL, t0: t, t1: t + decay * 4, f, amp, pan, send, p: [decay] });
  const pluck = (t: number, f: number, amp: number, decay = 0.9, pan = 0, send = 0.35) => add({ k: K.PLUCK, t0: t, t1: t + decay * 5, f, amp, pan, send, p: [decay] });
  const tick = (t: number, f: number, amp: number, pan = 0, send = 0.2) => add({ k: K.TICK, t0: t, t1: t + 0.12, f, amp, pan, send });
  const grain = (t: number, dur: number, f: number, amp: number, pan = 0, send = 0.5) => add({ k: K.GRAIN, t0: t, t1: t + dur, f, amp, pan, send });
  const glide = (t0: number, t1: number, f0: number, f1: number, amp: number, att = 1, rel = 1, pan = 0, send = 0.4) => add({ k: K.GLIDE, t0, t1, f: f0, f1, amp, att, rel, pan, send });
  const swell = (t0: number, t1: number, fc: number, amp: number) => add({ k: K.SWELL, t0, t1, f: fc, amp, att: (t1 - t0) * 0.7, rel: (t1 - t0) * 0.3, send: 0.6 });
  const sub = (t: number, f: number, amp: number, dur = 2.5) => add({ k: K.SUB, t0: t, t1: t + dur, f, amp, send: 0.15 });

  const OPEN = [1, 1.5, 2, 3, 4, 6], OPEN_A = [1, 0.55, 0.5, 0.22, 0.14, 0.06];
  const WARMP = [1, 2, 2.5, 3, 4, 5], WARM_A = [1, 0.5, 0.25, 0.3, 0.15, 0.08];
  const HOLLOW = [1, 3, 5, 7], HOLLOW_A = [1, 0.3, 0.12, 0.05];

  // title (0–4): a low fifth opening
  pad(0.5, TITLE_END + 2, midi(33), 0.05, OPEN, OPEN_A, 2.5, 2.5);

  // chapter beds: root, voicing and level per chapter; cross-fades across dissolves, hard edges at cuts
  const beds: [number, number, number[], number[], number][] = [
    // [chapter, root midi, ratios, amps, level]
    [1, 38, WARMP, WARM_A, 0.05], [2, 34, OPEN, OPEN_A, 0.045], [3, 36, HOLLOW, HOLLOW_A, 0.04], [4, 40, WARMP, WARM_A, 0.045],
    [5, 41, OPEN, OPEN_A, 0.035], [6, 43, WARMP, WARM_A, 0.04], [7, 33, OPEN, OPEN_A, 0.045], [8, 29, HOLLOW, HOLLOW_A, 0.06],
    [9, 38, OPEN, OPEN_A, 0.04], [10, 28, OPEN, OPEN_A, 0.055], [11, 35, HOLLOW, HOLLOW_A, 0.03], [12, 38, WARMP, WARM_A, 0.05],
  ];
  for (const [n, m, r, a, lvl] of beds) {
    const c = CHAPTERS[n - 1], nx = CHAPTERS[n];
    const cutIn = c.transitionIn.type === 'cut', cutOut = nx ? nx.transitionIn.type === 'cut' : false;
    const t0 = cutIn ? c.start : c.start - c.transitionIn.duration / 2;
    const t1 = nx ? (cutOut ? nx.start : nx.start + nx.transitionIn.duration / 2) : c.end;
    pad(t0, t1, midi(m), lvl, r, a, cutIn ? 0.03 : c.transitionIn.duration, cutOut ? 0.03 : nx ? nx.transitionIn.duration : 3, 0, 0.5);
    // an octave-up shimmer layer, slightly detuned, for width
    pad(t0 + 1, t1, midi(m + 12) * 1.003, lvl * 0.35, [1, 1.5, 2], [1, 0.4, 0.2], cutIn ? 2 : c.transitionIn.duration + 1, cutOut ? 0.03 : 3, -0.4, 0.7);
    pad(t0 + 1.5, t1, midi(m + 12) * 0.997, lvl * 0.35, [1, 1.5, 2], [1, 0.4, 0.2], cutIn ? 2 : c.transitionIn.duration + 1, cutOut ? 0.03 : 3, 0.4, 0.7);
  }

  // cue: transition:start — a soft swell into every dissolve; hard cuts get silence and an impact
  for (let i = 1; i < CHAPTERS.length; i++) {
    const c = CHAPTERS[i];
    if (c.transitionIn.type === 'cut') { ducks.push([c.start - 0.06, c.start + 0.22]); sub(c.start + 0.22, 55, 0.22, 2.2); }
    else swell(c.start - c.transitionIn.duration / 2 - 1.2, c.start + 0.3, 900, 0.035);
  }
  // cue: equation:reveal — a quiet bell as each equation appears
  const eqNotes = [74, 76, 79, 81, 83, 86];
  EQ_CUES.forEach((e, i) => bell(e.t0 + 0.05, midi(eqNotes[i % eqNotes.length]), 0.035, 2.2, (h01(i, 7) - 0.5) * 0.6, 0.6));

  // ── Ch1 · Observer: photon absorptions as faint high ticks (cue: detection) ──
  {
    const s = chStart(1);
    for (let i = 0; i < inp.photonLt.length; i++) {
      const lt = inp.photonLt[i];
      const rate = 1 + Math.max(0, lt - EXPOSURE_START) * 6;
      tick(s + lt, 2400 + 1800 * h01(i, 11), 0.05 / Math.sqrt(rate), (h01(i, 12) - 0.5) * 1.2, 0.25);
    }
    bell(s + 1.2, midi(62), 0.03, 4);
  }
  // ── Ch2 · Inner scale: a long descending glide; hydrogen's Balmer lines as bells ──
  {
    const s = chStart(2);
    glide(s + 1, s + 62, 1320, 165, 0.018, 4, 5, 0.2, 0.6);
    // Balmer series: 1/λ ∝ 1/4 − 1/n² → frequency ratios (Hα = 1), transposed to 330 Hz (sonification)
    const balmer = [3, 4, 5, 6].map((n) => (0.25 - 1 / (n * n)) / (0.25 - 1 / 9));
    for (let k = 0; k < 10; k++) bell(s + 71.5 + k * 2.1, 330 * balmer[k % 4], 0.045, 3, (k % 2 ? -0.3 : 0.3), 0.55);
    // superposition of two energies (lt 80–87.5): a slow beat between two close tones
    pad(s + 80, s + 88, 330, 0.03, [1], [1], 1.5, 1.5, -0.2, 0.5); pad(s + 80, s + 88, 330 * 1.012, 0.03, [1], [1], 1.5, 1.5, 0.2, 0.5);
  }
  // ── Ch3 · Quantum: gluon grains, field hum, Born-rule detections, spins, entangled pairs ──
  {
    const s = chStart(3);
    for (let i = 0; i < 260; i++) { const t = 7 + 38 * h01(i, 31); grain(s + t, 0.08 + 0.12 * h01(i, 32), 90 + 260 * h01(i, 33), 0.05, (h01(i, 34) - 0.5) * 1.4, 0.6); }
    // a free field: oscillator modes (ħω(n + ½)) heard as a harmonic hum
    pad(s + 46, s + 66, 110, 0.035, [1, 2, 3, 4, 5, 6, 7], [1, 0.5, 0.33, 0.25, 0.2, 0.16, 0.14], 2.5, 2.5, 0, 0.5);
    // detections: one tick per detected particle; level falls as the rate climbs so the texture stays even
    const N = inp.detT.length, span = SLIT.detEnd - SLIT.detStart;
    for (let k = 0; k < N; k++) {
      const lt = SLIT.detStart + inp.detT[k] * span;
      if (lt > SLIT.detEnd + 0.5) break;
      const u = Math.max(inp.detT[k], 1e-3), rate = (3 * N * u * u) / span; // dk/dlt for k = N t³
      tick(s + lt, 1400 + 900 * h01(k, 41), Math.min(0.09, 0.09 / Math.sqrt(1 + rate / 6)), Math.max(-1, Math.min(1, (inp.detX[k] ?? 0) * 2)), 0.15);
    }
    glide(s + 96, s + 108, 440, 523.25, 0.02, 1.5, 1.5, 0, 0.5); // spin: a slow rotation of one tone
    const ent = makeEntanglementRecord(inp.seed);
    for (let i = 0; i < ent.a.length; i++) {
      const t = s + ENT_START + i / ENT_RATE + 0.9; // pulses reach the detectors ~0.9 s after emission
      if (t > s + 120) break;
      tick(t, ent.a[i] > 0 ? 1760 : 1320, 0.06, -0.8, 0.2);
      tick(t, ent.b[i] > 0 ? 1760 : 1320, 0.06, 0.8, 0.2);
    }
  }
  // ── Ch4 · Sensory filter: cone triad (λmax 558, 531, 419 nm → frequency ∝ 1/λ), a spectrum sweep ──
  {
    const s = chStart(4);
    const lm = [558.4, 530.8, 419.0];
    lm.forEach((l, i) => pad(s + 30, s + 44, 220 * (558.4 / l), 0.028, [1, 2], [1, 0.2], 1.5, 2, (i - 1) * 0.6, 0.5));
    glide(s + 46, s + 56, 60, 3200, 0.015, 1.5, 2, 0, 0.6);
    for (let k = 0; k < 6; k++) pluck(s + 1.5 + k * 0.33, midi(76 + k * 2), 0.03, 0.6, 0, 0.4); // the retinal flip cascade
  }
  // ── Ch5 · Frequency & information: water's normal modes, transposed down 37 octaves ──
  {
    const s = chStart(5);
    const c = 2.99792458e10; // cm/s: frequency = c·ν̃
    const f = [NU.bend, NU.sym, NU.asym].map((nu) => (c * nu) / 2 ** 37); // ≈ 348, 798, 820 Hz
    f.forEach((fi, i) => pad(s + 1, s + 20, fi, i === 0 ? 0.03 : 0.018, [1], [1], 2, 2, (i - 1) * 0.5, 0.4));
    // oscillator ladder: evenly spaced steps
    for (let n = 0; n < 6; n++) pluck(s + 24 + n * 1.1, 220 * (n + 0.5) / 0.5 / 4 + 110, 0.035, 1.2, 0, 0.4);
    // entropy: many microstates — grains thicken as the gas spreads
    for (let i = 0; i < 300; i++) { const t = 50 + 21 * Math.sqrt(h01(i, 51)); grain(s + t, 0.05, 500 + 2500 * h01(i, 52), 0.02, (h01(i, 53) - 0.5) * 1.8, 0.5); }
  }
  // ── Ch6 · Life as information: one note per codon (amino acid → pentatonic degree) ──
  {
    const s = chStart(6);
    const codons = DEMO_MRNA.match(/.{3}/g)!;
    const penta = [0, 2, 4, 7, 9];
    for (let i = 0; i < 20; i++) tick(s + TX.start + (i / 20) * (TX.end - TX.start), 2100, 0.03, -0.3, 0.2);
    codons.forEach((cd, i) => {
      const aa = translateCodon(cd);
      const h = [...aa].reduce((a, ch) => a + ch.charCodeAt(0), 0);
      const m = aa === '*' ? 57 : 67 + penta[h % 5] + 12 * ((h >> 3) % 2);
      pluck(s + TL.start + i * TL.per, midi(m), 0.05, aa === '*' ? 2 : 0.9, (i % 2 ? 0.25 : -0.25), 0.4);
    });
  }
  // ── Ch7 · Spacetime: dimensions stack as fifths; twin clocks tick at their own proper-time rates ──
  {
    const s = chStart(7);
    [0, 7, 14, 21, 28].forEach((iv, i) => pad(s + 1 + i * 2.6, s + 24, midi(45 + iv), 0.018, [1, 2], [1, 0.25], 1.2, 2, (i - 2) * 0.3, 0.5));
    const g = 1 / Math.sqrt(1 - TWIN.v * TWIN.v);
    const lt = (yrs: number) => TWIN.start + (TWIN.span * yrs) / TWIN.years;
    for (let k = 1; k * TWIN.tickYears <= TWIN.years; k++) tick(s + lt(k * TWIN.tickYears), 1320, 0.07, -0.5, 0.2);      // stay-at-home
    for (let k = 1; k * TWIN.tickYears * g <= TWIN.years + 1e-9; k++) tick(s + lt(k * TWIN.tickYears * g), 990, 0.07, 0.5, 0.2); // traveller
    pad(s + 80, s + 105, midi(45), 0.03, OPEN, OPEN_A, 4, 3, 0, 0.7); // the block: stillness
  }
  // ── Ch8 · Gravity: sub rumble; static clocks slowed by √(1 − rₛ/r); the horizon cut ──
  {
    const s = chStart(8);
    glide(s + 17, s + 57.8, 41, 36, 0.05, 6, 0.05, 0, 0.2);
    STATIC_CLOCKS.radii.forEach((r, i) => {
      const rate = Math.sqrt(1 - 1 / r), per = (Math.PI / 3) / (STATIC_CLOCKS.omega * rate); // a tick every 60° of the hand
      for (let t = STATIC_CLOCKS.start + per; t < STATIC_CLOCKS.end; t += per) tick(s + t, 700 + 350 * i, 0.06, (i - 1) * 0.6, 0.25);
    });
    const cut = s + SINGULARITY_CUT_LOCAL;
    ducks.push([cut - 0.04, cut + 0.5]);                 // cue: horizon:crossed — silence, then the fall
    sub(cut + 0.5, 48, 0.3, 4);
    glide(cut + 0.6, cut + 8, 220, 55, 0.025, 0.3, 1.5, 0, 0.5);
    for (let i = 0; i < 90; i++) grain(s + 67 + 19 * h01(i, 81), 0.03, 3000 + 3000 * h01(i, 82), 0.018, (h01(i, 83) - 0.5) * 1.6, 0.6); // Hawking quanta (sparse)
  }
  // ── Ch9 · Mathematics: plucks for history; prime ticks; zeta zeros as a chord ──
  {
    const s = chStart(9);
    const hist = [62, 65, 69, 67, 72, 71, 69, 74];
    hist.forEach((m, i) => pluck(s + 0.8 + i * 3.4, midi(m), 0.04, 1.4, (i % 2 ? 0.3 : -0.3), 0.45));
    let p = 0; const isPrime = (n: number) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
    for (let n = 2; n < 400; n++) if (isPrime(n)) { const t = 28 + 9 * (n / 400); tick(s + t, 1600 + (n % 7) * 90, 0.04, (p++ % 2 ? 0.4 : -0.4), 0.2); }
    // zeros γₖ mapped linearly to pitch (γ × 12 Hz): a sonification of the explicit formula's waves
    for (let k = 0; k < Math.min(8, inp.zeros.length); k++) pad(s + 56 + k * 0.4, s + 69, inp.zeros[k] * 12, 0.012, [1], [1], 1.2, 2, (k % 2 ? 0.35 : -0.35), 0.55);
    pad(s + 77.5, s + 84, midi(57) * 1.0595, 0.02, [1, 2.01], [1, 0.3], 2, 1.5, 0, 0.6); // an unresolved tone
  }
  // ── Ch10 · Cosmos: a tone that redshifts, f = f₀/(1 + z), as we look farther ──
  {
    const s = chStart(10);
    for (let i = 0; i < 200; i++) { const t = 33 + 7 * h01(i, 101); grain(s + t, 0.06, 200 + 900 * h01(i, 102), 0.018 * (0.4 + 0.6 * (t - 33) / 7), (h01(i, 103) - 0.5) * 1.8, 0.6); }
    glide(s + 40, s + 52, 660, 60, 0.03, 1.5, 2.5, 0, 0.6);
  }
  // ── Ch11 · Frontier: sparse, dithered grains — structure left incomplete ──
  {
    const s = chStart(11);
    for (let i = 0; i < 160; i++) { const t = 0.2 + 24.5 * h01(i, 111); if (h01(i, 112) < 0.35) continue; grain(s + t, 0.05 + 0.2 * h01(i, 113), midi(60 + 12 * Math.floor(h01(i, 114) * 3) + [0, 3, 7, 10][Math.floor(h01(i, 115) * 4)]), 0.03, (h01(i, 116) - 0.5) * 1.6, 0.75); }
  }
  // ── Ch12 · Synthesis: echoes of each chapter's motif, resolving on the mosaic ──
  {
    const s = chStart(12);
    const echoes: [number, number][] = [[0.4, 330], [1.8, 110], [4.8, midi(52)], [7.9, midi(59)], [10.9, midi(79)], [14.2, midi(64)], [17.2, midi(55)]];
    echoes.forEach(([t, f], i) => bell(s + t, f, 0.035, 2.5, (i % 2 ? 0.3 : -0.3), 0.6));
    for (let i = 0; i < 120; i++) { const t = 20 + 5 * Math.sqrt(h01(i, 121)); tick(s + t, 2400 + 1600 * h01(i, 122), 0.025, (h01(i, 123) - 0.5) * 1.4, 0.3); }
    pad(s + 20, END_START + 1.5, midi(50), 0.05, [1, 1.5, 2, 2.5, 3, 4], [1, 0.6, 0.5, 0.25, 0.2, 0.1], 3, 3.5, 0, 0.6);
  }
  V.sort((a, b) => a.t0 - b.t0);
  return { voices: V, ducks, duration: DURATION };
}

// ── synthesis ───────────────────────────────────────────────────────────────
const envAR = (tau: number, dur: number, att: number, rel: number) => {
  if (tau < 0 || tau > dur) return 0;
  let e = 1;
  if (tau < att) { const x = tau / att; e = x * x * (3 - 2 * x); }
  const tr = dur - tau;
  if (tr < rel) { const x = tr / rel; e *= x * x * (3 - 2 * x); }
  return e;
};

function renderVoice(v: Voice, sr: number, a: number, n: number, L: Float32Array, R: Float32Array, SL: Float32Array, SR_: Float32Array) {
  const i0 = Math.max(0, Math.ceil(v.t0 * sr) - a), i1 = Math.min(n, Math.floor(v.t1 * sr) - a);
  if (i1 <= i0) return;
  const pan = Math.max(-1, Math.min(1, v.pan)), gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  const dur = v.t1 - v.t0, send = v.send;
  const s0 = v.seed;
  // per-voice random constants (hash once, not per sample)
  const np = v.k === K.SWELL ? 14 : v.p ? v.p.length : 0;
  const cA = new Float64Array(np), cB = new Float64Array(np), cC = new Float64Array(np);
  for (let j = 0; j < np; j++) {
    if (v.k === K.SWELL) { cA[j] = v.f * Math.pow(2, (h01(s0, j) - 0.5) * 3); cB[j] = TAU * h01(s0, j + 30); cC[j] = TAU * (0.7 + 2 * h01(s0, j + 60)); }
    else { cA[j] = TAU * (0.05 + 0.13 * h01(s0, j)); cB[j] = TAU * h01(s0, j + 50); cC[j] = TAU * h01(s0, j + 100); }
  }
  for (let i = i0; i < i1; i++) {
    const tau = (a + i) / sr - v.t0;
    let x = 0;
    switch (v.k) {
      case K.PAD: {
        const e = envAR(tau, dur, v.att, v.rel);
        if (e === 0) continue;
        const p = v.p!, q = v.q!;
        for (let j = 0; j < p.length; j++) {
          const lfo = 1 + 0.25 * Math.sin(cA[j] * tau + cB[j]);
          x += q[j] * lfo * Math.sin(TAU * v.f * p[j] * tau + cC[j]);
        }
        x *= e * v.amp; break;
      }
      case K.BELL: {
        const d = v.p![0];
        const at = tau < 0.004 ? tau / 0.004 : 1;
        x = at * v.amp * (Math.exp(-tau / d) * Math.sin(TAU * v.f * tau) + 0.35 * Math.exp(-tau / (d * 0.45)) * Math.sin(TAU * v.f * 2.0 * tau)
          + 0.4 * Math.exp(-tau / (d * 0.35)) * Math.sin(TAU * v.f * 2.76 * tau) + 0.18 * Math.exp(-tau / (d * 0.22)) * Math.sin(TAU * v.f * 5.4 * tau));
        break;
      }
      case K.PLUCK: {
        const d = v.p![0];
        const at = tau < 0.003 ? tau / 0.003 : 1;
        x = at * v.amp * (Math.exp(-tau / d) * Math.sin(TAU * v.f * tau) + 0.5 * Math.exp(-tau / (d * 0.5)) * Math.sin(TAU * v.f * 2 * tau)
          + 0.25 * Math.exp(-tau / (d * 0.3)) * Math.sin(TAU * v.f * 3 * tau) + 0.12 * Math.exp(-tau / (d * 0.2)) * Math.sin(TAU * v.f * 4 * tau));
        break;
      }
      case K.TICK: {
        const nz = h32(((a + i) * 2654435761 + s0 * 97) >>> 0) / 2147483648 - 1;
        x = v.amp * (Math.exp(-tau / 0.012) * Math.sin(TAU * v.f * tau) + 0.35 * Math.exp(-tau / 0.0015) * nz);
        break;
      }
      case K.GLIDE: {
        const e = envAR(tau, dur, v.att, v.rel);
        if (e === 0) continue;
        const r = v.f1 / v.f, lr = Math.log(r);
        const ph = Math.abs(lr) < 1e-9 ? v.f * tau : (v.f * dur / lr) * (Math.pow(r, tau / dur) - 1);
        x = e * v.amp * (Math.sin(TAU * ph) + 0.3 * Math.sin(TAU * 2 * ph + 0.7));
        break;
      }
      case K.SWELL: {
        const e = envAR(tau, dur, v.att, v.rel);
        if (e === 0) continue;
        for (let j = 0; j < 14; j++) x += Math.sin(TAU * cA[j] * tau + cB[j]) * (0.6 + 0.4 * Math.sin(cC[j] * tau));
        x *= e * e * v.amp / 4; break;
      }
      case K.GRAIN: {
        const w = Math.sin(Math.PI * tau / dur);
        x = v.amp * w * w * Math.sin(TAU * v.f * tau);
        break;
      }
      case K.SUB: {
        const f = v.f * Math.pow(0.5, tau / dur);
        const ph = (v.f * dur / Math.log(0.5)) * (Math.pow(0.5, tau / dur) - 1);
        x = v.amp * Math.exp(-tau / (dur * 0.35)) * Math.min(1, tau / 0.01) * Math.sin(TAU * ph) * (f > 20 ? 1 : 0);
        break;
      }
    }
    L[i] += x * gl; R[i] += x * gr;
    SL[i] += x * gl * send; SR_[i] += x * gr * send;
  }
}

/** a small FDN reverb (4 lines, Hadamard feedback, damped), ~2.6 s RT60 */
function reverb(SL: Float32Array, SR_: Float32Array, sr: number, outL: Float32Array, outR: Float32Array) {
  const lens = [1557, 1617, 1491, 1422].map((l) => Math.round((l * sr) / 44100 * 1.9));
  const pre = Math.round(0.022 * sr);
  const rt60 = 2.6;
  const g = lens.map((l) => Math.pow(10, (-3 * l) / (sr * rt60)));
  const lines = lens.map((l) => new Float32Array(l));
  const idx = [0, 0, 0, 0];
  const lp = [0, 0, 0, 0];
  const damp = 0.35;
  const n = SL.length;
  for (let i = 0; i < n; i++) {
    const inL = i >= pre ? SL[i - pre] : 0, inR = i >= pre ? SR_[i - pre] : 0;
    const o0 = lines[0][idx[0]], o1 = lines[1][idx[1]], o2 = lines[2][idx[2]], o3 = lines[3][idx[3]];
    // Hadamard mix
    const m0 = 0.5 * (o0 + o1 + o2 + o3), m1 = 0.5 * (o0 - o1 + o2 - o3), m2 = 0.5 * (o0 + o1 - o2 - o3), m3 = 0.5 * (o0 - o1 - o2 + o3);
    const ms = [m0, m1, m2, m3];
    for (let j = 0; j < 4; j++) {
      lp[j] += (1 - damp) * (ms[j] * g[j] - lp[j]);
      lines[j][idx[j]] = lp[j] + (j < 2 ? inL : inR) * 0.5;
      idx[j] = idx[j] + 1 === lens[j] ? 0 : idx[j] + 1;
    }
    outL[i] = 0.6 * (o0 + o2 * 0.6); outR[i] = 0.6 * (o1 + o3 * 0.6);
  }
}

/** transparent below −3 dBFS; a tanh knee catches anything the limiter's release lets through */
function softClip(y: number) {
  const k = 0.7 * CEILING, ay = Math.abs(y);
  return ay <= k ? y : Math.sign(y) * (k + (CEILING - k) * Math.tanh((ay - k) / (CEILING - k)));
}

/** Render `count` stereo samples starting at sample `start` (absolute timeline). Interleaved L,R. */
export function renderBlock(score: Score, sr: number, start: number, count: number): Float32Array {
  const warm = Math.round(WARM_SEC * sr), la = Math.max(1, Math.round(LOOKAHEAD_SEC * sr));
  const a = start - warm, n = warm + count + la;
  const L = new Float32Array(n), R = new Float32Array(n), SL = new Float32Array(n), SRb = new Float32Array(n);
  const tA = a / sr, tB = (a + n) / sr;
  for (const v of score.voices) {
    if (v.t0 > tB) break;
    if (v.t1 < tA) continue;
    renderVoice(v, sr, a, n, L, R, SL, SRb);
  }
  const WL = new Float32Array(n), WR = new Float32Array(n);
  reverb(SL, SRb, sr, WL, WR);
  const master = Math.pow(10, MASTER_DB / 20);
  for (let i = 0; i < n; i++) {
    const t = (a + i) / sr;
    let g = master;
    // global shape: silence before 0 and after the end card; hard-cut ducks
    if (t < 0 || t > score.duration) g = 0;
    for (const [d0, d1] of score.ducks) {
      if (t > d0 - 0.02 && t < d1 + 0.02) {
        const e = Math.min(Math.max(0, (d0 - t) / 0.02), 1) + Math.min(Math.max(0, (t - d1) / 0.02), 1);
        g *= Math.min(1, e);
      }
    }
    if (t > END_START - 3) g *= Math.max(0, 1 - (t - (END_START - 3)) / 4.5); // the film's last fade, trailing into the end card
    L[i] = (L[i] + WL[i]) * g; R[i] = (R[i] + WR[i]) * g;
  }
  // look-ahead peak limiter: the gain at i anticipates the peak within the next `la` samples
  const out = new Float32Array(count * 2);
  let gain = 1;
  const rel = 1 - Math.exp(-1 / (0.15 * sr));
  // sliding-window max via a monotonic deque
  const dq = new Int32Array(n); let h = 0, tl = 0;
  const pk = (i: number) => Math.max(Math.abs(L[i]), Math.abs(R[i]));
  for (let i = 0; i < Math.min(la, n); i++) { while (tl > h && pk(dq[tl - 1]) <= pk(i)) tl--; dq[tl++] = i; }
  for (let i = 0; i < n - la; i++) {
    const j = i + la;
    while (tl > h && pk(dq[tl - 1]) <= pk(j)) tl--; dq[tl++] = j;
    while (dq[h] < i) h++;
    const peak = pk(dq[h]);
    const target = peak > CEILING ? CEILING / peak : 1;
    gain = target < gain ? target : gain + (target - gain) * rel;
    if (i >= warm) {
      const o = (i - warm) * 2;
      out[o] = softClip(L[i] * gain);
      out[o + 1] = softClip(R[i] * gain);
    }
  }
  return out;
}

/** The sample range [start, start+count) assembled from fixed blocks (cached by the caller). */
export function blockIndexRange(sr: number, start: number, count: number) {
  const B = BLOCK_SEC * sr;
  return { first: Math.floor(start / B), last: Math.floor((start + count - 1) / B), B };
}

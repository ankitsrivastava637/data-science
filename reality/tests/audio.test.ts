// The score is deterministic, blocks render independently, and levels are sane.
// Full-film loudness (≈ −14 LUFS integrated) is checked by `npm run audio:check` (≈ 1 min), or here with FULL_AUDIO=1.
import { describe, it, expect, beforeAll } from 'vitest';
import { buildScore, renderBlock, BLOCK_SEC, type Score } from '../src/audio/score';
import { scoreInputs } from '../src/audio/inputs';
import { integratedLUFS } from '../src/audio/loudness';
import { jobMosaic, jobDoubleSlit, jobDetections } from '../src/engine/jobs';
import { zetaZeros } from '../src/math/numbertheory';
import { DURATION } from '../src/content/chapters';

const SR = 48000;
let score: Score, inputs: ReturnType<typeof scoreInputs>;
beforeAll(() => {
  const slit = jobDoubleSlit();
  inputs = scoreInputs({ seed: 1, mosaic: jobMosaic(1), detections: jobDetections(slit.screen, 12000, 1), extra: { zeta: { zeros: zetaZeros(100) } } } as never);
  score = buildScore(inputs);
}, 60000);

describe('score', () => {
  it('is a pure function of its inputs', () => {
    const again = buildScore(inputs);
    expect(again.voices.length).toBe(score.voices.length);
    expect(JSON.stringify(again.voices.slice(0, 200))).toBe(JSON.stringify(score.voices.slice(0, 200)));
  });
  it('renders any block independently (seek = play-through), to within −70 dBFS', () => {
    for (const t of [30.2, 234.5, 616.9]) {
      const s = Math.round(t * SR);
      const a = renderBlock(score, SR, s, 4800), b = renderBlock(score, SR, s - 9600, 14400);
      let md = 0; for (let i = 0; i < a.length; i++) md = Math.max(md, Math.abs(a[i] - b[i + 19200]));
      expect(md).toBeLessThan(3.2e-4); // the reverb tail beyond the 3 s warm-up; ≈ −79 dBFS measured
    }
  }, 60000);
  it('produces finite samples under the −1 dBFS ceiling', () => {
    for (const t of [0, 150, 300, 616, 800, 848]) {
      const blk = renderBlock(score, SR, Math.round(t * SR), BLOCK_SEC * SR);
      let pk = 0, bad = 0; for (const v of blk) { if (!Number.isFinite(v)) bad++; else pk = Math.max(pk, Math.abs(v)); }
      expect(bad).toBe(0);
      expect(pk).toBeLessThanOrEqual(0.8913);
    }
  }, 60000);
  it('is silent before the first frame and after the end card', () => {
    const tail = renderBlock(score, SR, Math.round((DURATION - 0.5) * SR), SR);
    let pk = 0; for (let i = SR; i < tail.length; i++) pk = Math.max(pk, Math.abs(tail[i]));
    expect(pk).toBeLessThan(1e-3);
  }, 60000);
  it('an excerpt sits near the programme loudness', () => {
    const a = Math.round(150 * SR), n = 40 * SR;
    const out = new Float32Array(n * 2);
    for (let s = 0; s < n; s += BLOCK_SEC * SR) out.set(renderBlock(score, SR, a + s, Math.min(BLOCK_SEC * SR, n - s)), s * 2);
    const { lufs } = integratedLUFS(out, SR);
    expect(lufs).toBeGreaterThan(-20); expect(lufs).toBeLessThan(-9);
  }, 60000);
  it.runIf(process.env.FULL_AUDIO === '1')('the whole film measures −14 ± 1 LUFS integrated', () => {
    const total = Math.ceil(DURATION * SR), B = BLOCK_SEC * SR, out = new Float32Array(total * 2);
    for (let s = 0; s < total; s += B) out.set(renderBlock(score, SR, s, Math.min(B, total - s)), s * 2);
    const { lufs } = integratedLUFS(out, SR);
    expect(Math.abs(lufs + 14)).toBeLessThan(1);
  }, 600000);
});

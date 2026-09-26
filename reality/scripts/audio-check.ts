// Render the whole soundtrack offline in Node (the same block renderer the page uses), then report
// integrated loudness, peak, block-seam continuity and speed.   node scripts/run-ts.mjs scripts/audio-check.ts [out.wav]
import { writeFileSync } from 'node:fs';
import { buildScore, renderBlock, BLOCK_SEC } from '../src/audio/score';
import { scoreInputs } from '../src/audio/inputs';
import { integratedLUFS } from '../src/audio/loudness';
import { jobMosaic, jobDoubleSlit, jobDetections } from '../src/engine/jobs';
import { zetaZeros } from '../src/math/numbertheory';
import { DURATION, CHAPTERS } from '../src/content/chapters';

const seed = 1, SR = 48000;
const t0 = Date.now();
const slit = jobDoubleSlit();
const shared = { seed, mosaic: jobMosaic(seed), detections: jobDetections(slit.screen, 12000, seed), extra: { zeta: { zeros: zetaZeros(100) } } } as any;
console.log(`inputs ${(Date.now() - t0) / 1000}s`);
const score = buildScore(scoreInputs(shared));
console.log(`voices ${score.voices.length}`);
const total = Math.ceil(DURATION * SR), B = BLOCK_SEC * SR;
const out = new Float32Array(total * 2);
const t1 = Date.now();
for (let s = 0; s < total; s += B) { const n = Math.min(B, total - s); out.set(renderBlock(score, SR, s, n), s * 2); }
const secs = (Date.now() - t1) / 1000;
console.log(`rendered ${DURATION}s in ${secs.toFixed(1)}s (${(DURATION / secs).toFixed(1)}× real time)`);
const { lufs, peakDb } = integratedLUFS(out, SR);
console.log(`integrated loudness ${lufs.toFixed(2)} LUFS, sample peak ${peakDb.toFixed(2)} dBFS`);
// seam check: a block rendered on its own equals the same samples inside a longer render
const probeAt = 150 * SR + 123;
const a = renderBlock(score, SR, probeAt, 2000), b = renderBlock(score, SR, probeAt - 1000, 3000);
let md = 0; for (let i = 0; i < 4000; i++) md = Math.max(md, Math.abs(a[i] - b[i + 2000]));
console.log(`independent-block max difference ${md.toExponential(2)}`);
// per-chapter loudness (balance check)
for (const c of CHAPTERS) {
  const seg = out.subarray(Math.round(c.start * SR) * 2, Math.round(c.end * SR) * 2);
  const r = integratedLUFS(seg, SR);
  console.log(`  ch${String(c.n).padStart(2)} ${c.key.padEnd(10)} ${r.lufs.toFixed(1)} LUFS  peak ${r.peakDb.toFixed(1)} dBFS`);
}
const path = process.argv[2];
if (path) {
  const pcm = Buffer.alloc(total * 2 * 3);
  for (let i = 0; i < total * 2; i++) { const v = Math.max(-1, Math.min(1, out[i])); pcm.writeIntLE(Math.round(v * 8388607), i * 3, 3); }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 6, 28); h.writeUInt16LE(6, 32); h.writeUInt16LE(24, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  writeFileSync(path, Buffer.concat([h, pcm]));
  console.log('wrote', path);
}

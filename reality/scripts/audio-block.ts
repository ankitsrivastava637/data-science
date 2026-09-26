// Print base64 24-bit PCM for [from, from + count) samples at 48 kHz, rendered in Node (used by verify.mjs).
import { buildScore } from '../src/audio/score';
import { scoreInputs } from '../src/audio/inputs';
import { renderPcm24, base64 } from '../src/audio/offline';
import { jobMosaic, jobDoubleSlit, jobDetections } from '../src/engine/jobs';
import { zetaZeros } from '../src/math/numbertheory';
const [from, count] = process.argv.slice(2).map(Number);
const slit = jobDoubleSlit();
const score = buildScore(scoreInputs({ seed: 1, mosaic: jobMosaic(1), detections: jobDetections(slit.screen, 12000, 1), extra: { zeta: { zeros: zetaZeros(100) } } } as never));
process.stdout.write(base64(renderPcm24(score, 48000, from, count)));

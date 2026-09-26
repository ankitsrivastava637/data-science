// Renders score blocks off the main thread for live playback.
import { buildScore, renderBlock, BLOCK_SEC, type Score, type ScoreInputs } from './score';

let score: Score | null = null;
let sr = 48000;
self.onmessage = (e: MessageEvent<{ type: 'init'; inputs: ScoreInputs; sr: number } | { type: 'block'; k: number }>) => {
  const m = e.data;
  if (m.type === 'init') { score = buildScore(m.inputs); sr = m.sr; return; }
  if (!score) return;
  const B = BLOCK_SEC * sr;
  const buf = renderBlock(score, sr, m.k * B, B);
  (self as unknown as Worker).postMessage({ k: m.k, buf }, [buf.buffer]);
};

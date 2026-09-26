// Offline PCM: a sample range assembled from fixed score blocks, as interleaved stereo 24-bit LE.
// Shared by the page (window.__renderAudio) and Node tooling, so both produce identical bytes.
import { renderBlock, BLOCK_SEC, type Score } from './score';

export function renderPcm24(score: Score, sr: number, from: number, count: number, cache = new Map<string, Float32Array>()): Uint8Array {
  const B = BLOCK_SEC * sr;
  const out = new Uint8Array(count * 2 * 3);
  for (let k = Math.floor(from / B); k * B < from + count; k++) {
    const key = `${sr}:${k}`;
    let blk = cache.get(key);
    if (!blk) {
      blk = renderBlock(score, sr, k * B, B);
      cache.set(key, blk);
      for (const kk of [...cache.keys()]) if (+kk.split(':')[1] < k - 1) cache.delete(kk);
    }
    const a = Math.max(from, k * B), b = Math.min(from + count, (k + 1) * B);
    for (let s = a; s < b; s++) for (let c = 0; c < 2; c++) {
      const v = Math.round(Math.max(-1, Math.min(1, blk[(s - k * B) * 2 + c])) * 8388607);
      const o = ((s - from) * 2 + c) * 3;
      out[o] = v & 255; out[o + 1] = (v >> 8) & 255; out[o + 2] = (v >> 16) & 255;
    }
  }
  return out;
}

export function base64(u8: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
}

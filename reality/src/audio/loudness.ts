// Integrated loudness per ITU-R BS.1770-4 / EBU R128 (K-weighting, 400 ms blocks, 75 % overlap,
// absolute gate −70 LUFS, relative gate −10 LU). Coefficients are the standard 48 kHz set.
export function integratedLUFS(interleaved: Float32Array, sr = 48000): { lufs: number; peakDb: number } {
  if (sr !== 48000) throw new Error('loudness meter implemented for 48 kHz');
  const n = interleaved.length / 2;
  const kw = (ch: number) => {
    const y = new Float64Array(n);
    // stage 1: high shelf
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const b0 = 1.53512485958697, b1 = -2.69169618940638, b2 = 1.19839281085285, a1 = -1.69065929318241, a2 = 0.73248077421585;
    // stage 2: RLB high-pass
    let u1 = 0, u2 = 0, w1 = 0, w2 = 0;
    const c1 = -1.99004745483398, c2 = 0.99007225036621;
    for (let i = 0; i < n; i++) {
      const x = interleaved[i * 2 + ch];
      const s = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = s;
      const r = s - 2 * u1 + u2 - c1 * w1 - c2 * w2; u2 = u1; u1 = s; w2 = w1; w1 = r;
      y[i] = r * r;
    }
    return y;
  };
  const L = kw(0), R = kw(1);
  const blk = Math.round(0.4 * sr), hop = Math.round(0.1 * sr);
  const z: number[] = [];
  // prefix sums for fast block means
  const P = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) P[i + 1] = P[i] + L[i] + R[i];
  for (let s = 0; s + blk <= n; s += hop) z.push((P[s + blk] - P[s]) / blk);
  const lk = (m: number) => -0.691 + 10 * Math.log10(m);
  const abs = z.filter((m) => lk(m) > -70);
  if (!abs.length) return { lufs: -Infinity, peakDb: -Infinity };
  const rel = lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const gated = abs.filter((m) => lk(m) > rel);
  let pk = 0;
  for (let i = 0; i < interleaved.length; i++) pk = Math.max(pk, Math.abs(interleaved[i]));
  return { lufs: lk(gated.reduce((a, b) => a + b, 0) / gated.length), peakDb: 20 * Math.log10(pk) };
}

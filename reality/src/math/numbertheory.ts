// Number theory for Chapter 9: ζ on the critical line (Euler–Maclaurin), its zeros (sign changes
// of the Riemann–Siegel Z function), Riemann's explicit formula, partitions (exact, BigInt),
// Hardy–Ramanujan asymptotics, continued fractions, Ramanujan's 1/π series, Mādhava's series.

// ── complex helpers ──
type C = [number, number];
const cadd = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const cmul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a: C, b: C): C => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
/** n^{−s} for real n > 0 and complex s */
const npow = (n: number, s: C): C => { const l = Math.log(n); const m = Math.exp(-s[0] * l); return [m * Math.cos(-s[1] * l), m * Math.sin(-s[1] * l)]; };

// Bernoulli numbers B_{2k}, k = 1..12
const B2K = [1 / 6, -1 / 30, 1 / 42, -1 / 30, 5 / 66, -691 / 2730, 7 / 6, -3617 / 510, 43867 / 798, -174611 / 330, 854513 / 138, -236364091 / 2730];

/** ζ(s) by Euler–Maclaurin summation (accurate to ~1e-10 for |Im s| ≲ 300) */
export function zeta(s: C): C {
  const t = Math.abs(s[1]);
  const N = Math.max(12, Math.ceil(t / (2 * Math.PI)) + 12);
  let sum: C = [0, 0];
  for (let n = 1; n < N; n++) sum = cadd(sum, npow(n, s));
  const Ns = npow(N, s); // N^{−s}
  // N^{1−s}/(s−1)
  sum = cadd(sum, cdiv(cmul([N, 0], Ns), [s[0] - 1, s[1]]));
  sum = cadd(sum, [Ns[0] / 2, Ns[1] / 2]);
  // Σ B_{2k}/(2k)! · s(s+1)…(s+2k−2) · N^{−s−2k+1}
  let fact = 1;
  let poch: C = s; // s(s+1)…(s+2k−2), starts with k=1: s
  let Npow: C = cdiv(Ns, [N, 0]); // N^{−s−1}
  for (let k = 1; k <= 12; k++) {
    fact *= (2 * k - 1) * (2 * k);
    const term = cmul(poch, Npow);
    sum = cadd(sum, [(B2K[k - 1] / fact) * term[0], (B2K[k - 1] / fact) * term[1]]);
    poch = cmul(poch, cmul([s[0] + 2 * k - 1, s[1]], [s[0] + 2 * k, s[1]]));
    Npow = cdiv(Npow, [N * N, 0]);
  }
  return sum;
}

/** Riemann–Siegel θ(t) (asymptotic series, accurate for t ≳ 10) */
export function theta(t: number) {
  return (t / 2) * Math.log(t / (2 * Math.PI)) - t / 2 - Math.PI / 8 + 1 / (48 * t) + 7 / (5760 * t ** 3) + 31 / (80640 * t ** 5);
}
/** Z(t) = e^{iθ(t)} ζ(½ + it), real on the critical line */
export function Z(t: number) {
  const z = zeta([0.5, t]);
  const th = theta(t);
  return Math.cos(th) * z[0] - Math.sin(th) * z[1];
}

/** first `count` nontrivial zeros (imaginary parts) found as sign changes of Z, refined by bisection */
export function zetaZeros(count: number): number[] {
  const out: number[] = [];
  let t = 10, prev = Z(t);
  const step = 0.05;
  while (out.length < count) {
    const t2 = t + step, v = Z(t2);
    if (Math.sign(v) !== Math.sign(prev) && v !== 0) {
      let a = t, b = t2, fa = prev;
      for (let i = 0; i < 60; i++) { const m = 0.5 * (a + b), fm = Z(m); if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m; }
      out.push(0.5 * (a + b));
    }
    t = t2; prev = v;
  }
  return out;
}

/** Chebyshev ψ(x) = Σ_{p^k ≤ x} ln p (exact) */
export function chebyshevPsi(x: number): number {
  let s = 0;
  for (let n = 2; n <= x; n++) { const p = primePowerBase(n); if (p) s += Math.log(p); }
  return s;
}
function primePowerBase(n: number): number {
  for (let p = 2; p * p <= n; p++) if (n % p === 0) { let m = n; while (m % p === 0) m /= p; return m === 1 ? p : 0; }
  return n; // n itself prime
}
export function isPrime(n: number) { if (n < 2) return false; for (let p = 2; p * p <= n; p++) if (n % p === 0) return false; return true; }
export function sieve(n: number): Uint8Array { const s = new Uint8Array(n + 1).fill(1); s[0] = s[1] = 0; for (let p = 2; p * p <= n; p++) if (s[p]) for (let q = p * p; q <= n; q += p) s[q] = 0; return s; }

/** Riemann–von Mangoldt explicit formula truncated to the first zeros (conjugate pairs) */
export function psiExplicit(x: number, zeros: number[], nZeros = zeros.length): number {
  let s = x - Math.log(2 * Math.PI) - 0.5 * Math.log(1 - 1 / (x * x));
  const sx = Math.sqrt(x), lx = Math.log(x);
  for (let k = 0; k < nZeros; k++) {
    const g = zeros[k];
    // 2 Re( x^{1/2+iγ} / (1/2 + iγ) )
    const re = sx * Math.cos(g * lx), im = sx * Math.sin(g * lx);
    const d = 0.25 + g * g;
    s -= 2 * ((re * 0.5 + im * g) / d);
  }
  return s;
}

/** exact partition numbers p(0..n) via Euler's pentagonal-number recurrence */
export function partitions(n: number): bigint[] {
  const p: bigint[] = [1n];
  for (let m = 1; m <= n; m++) {
    let s = 0n;
    for (let k = 1; ; k++) {
      const g1 = (k * (3 * k - 1)) / 2, g2 = (k * (3 * k + 1)) / 2;
      if (g1 > m) break;
      const sign = k % 2 ? 1n : -1n;
      s += sign * p[m - g1];
      if (g2 <= m) s += sign * p[m - g2];
    }
    p.push(s);
  }
  return p;
}
export const hardyRamanujan = (n: number) => Math.exp(Math.PI * Math.sqrt((2 * n) / 3)) / (4 * n * Math.sqrt(3));

/** all partitions of n (for the Young diagrams), largest part first */
export function listPartitions(n: number, max = n): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (let k = Math.min(n, max); k >= 1; k--) for (const rest of listPartitions(n - k, k)) out.push([k, ...rest]);
  return out;
}

/** continued fraction terms of x (double precision: reliable for the first ~12 terms of π) */
export function continuedFraction(x: number, terms: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < terms; i++) { const a = Math.floor(x); out.push(a); const f = x - a; if (f < 1e-12) break; x = 1 / f; }
  return out;
}
export function convergents(cf: number[]): [bigint, bigint][] {
  const out: [bigint, bigint][] = [];
  let h0 = 1n, h1 = BigInt(cf[0]), k0 = 0n, k1 = 1n;
  out.push([h1, k1]);
  for (let i = 1; i < cf.length; i++) {
    const a = BigInt(cf[i]);
    const h2 = a * h1 + h0, k2 = a * k1 + k0;
    out.push([h2, k2]);
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
  }
  return out;
}

/** π from the first `terms` terms of Ramanujan's 1914 series, as a decimal string with `digits` digits (BigInt fixed point) */
export function ramanujanPi(terms: number, digits = 60): string {
  const SCALE = 10n ** BigInt(digits + 10);
  // sqrt(2) in fixed point by Newton's method
  let r = SCALE * 14142n / 10000n;
  const two = 2n * SCALE * SCALE;
  for (let i = 0; i < 200; i++) { const nr = (r + two / r) / 2n; if (nr === r) break; r = nr; }
  let sum = 0n; // fixed point Σ (4k)!(1103+26390k)/((k!)^4 396^{4k})
  const fact = (n: number) => { let f = 1n; for (let i = 2n; i <= BigInt(n); i++) f *= i; return f; };
  for (let k = 0; k < terms; k++) {
    const num = fact(4 * k) * BigInt(1103 + 26390 * k);
    const den = fact(k) ** 4n * 396n ** BigInt(4 * k);
    sum += (num * SCALE) / den;
  }
  // 1/π = 2√2/9801 · sum  →  π = 9801 / (2√2 · sum)
  const invPi = (2n * r * sum) / (9801n * SCALE);
  const pi = (SCALE * SCALE) / invPi;
  const s = pi.toString();
  return s[0] + '.' + s.slice(1, digits + 1);
}

/** Mādhava–Leibniz partial sums of π/4 */
export function madhava(n: number) { let s = 0; for (let k = 0; k < n; k++) s += (k % 2 ? -1 : 1) / (2 * k + 1); return 4 * s; }

/** Kepler orbit position at mean anomaly M (for Noether / equal areas) */
export function kepler(e: number, M: number): [number, number] {
  let E = M;
  for (let i = 0; i < 30; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return [Math.cos(E) - e, Math.sqrt(1 - e * e) * Math.sin(E)];
}

// Deterministic randomness. Nothing in the piece may call Math.random.

/** sfc32: small fast counter PRNG. Returns a function producing floats in [0,1). */
export function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Seeded generator with a few conveniences. */
export class Rng {
  private next: () => number;
  constructor(seed: number, stream = 0) {
    const s = hashU32(seed >>> 0, stream >>> 0);
    this.next = sfc32(0x9e3779b9, 0x243f6a88, 0xb7e15162, s);
    for (let i = 0; i < 16; i++) this.next();
  }
  float(): number { return this.next(); }
  range(a: number, b: number): number { return a + (b - a) * this.next(); }
  int(n: number): number { return Math.floor(this.next() * n); }
  /** standard normal via Box–Muller */
  normal(): number {
    let u = this.next();
    if (u < 1e-12) u = 1e-12;
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  /** Poisson sample (Knuth for small λ, normal approximation for large). */
  poisson(lambda: number): number {
    if (lambda <= 0) return 0;
    if (lambda > 60) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * this.normal()));
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= this.next(); } while (p > L);
    return k - 1;
  }
  pick<T>(arr: readonly T[]): T { return arr[this.int(arr.length)]; }
}

/** Integer hash of up to three 32-bit words (lowbias32-style mixing). */
export function hashU32(a: number, b = 0, c = 0): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = (h ^ Math.imul(b + 0x85ebca6b, 0x2c1b3c6d)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  h = (h ^ Math.imul(c + 0xc2b2ae35, 0x297a2d39)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Hash to float in [0,1). */
export function hash01(a: number, b = 0, c = 0): number {
  return hashU32(a, b, c) / 4294967296;
}

let globalSeed = 1;
export function setGlobalSeed(s: number) { globalSeed = s >>> 0; }
export function getGlobalSeed() { return globalSeed; }

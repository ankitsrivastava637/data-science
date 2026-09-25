// Performance tiers, auto-detection and dynamic resolution.
export type Tier = 'low' | 'high' | 'ultra';

export interface Quality {
  tier: Tier;
  pixelRatio: number;
  renderScale: number;   // fraction of canvas resolution used for the HDR scene targets
  minScale: number;
  maxScale: number;
  particles: number;     // multiplier on particle counts
  steps: number;         // multiplier on raymarch / integration step counts
  msaa: number;
  bloomLevels: number;
  accumulateWhenPaused: boolean;
}

export function makeQuality(tier: Tier, devicePixelRatio = 1): Quality {
  switch (tier) {
    case 'low':
      return { tier, pixelRatio: 1, renderScale: 0.75, minScale: 0.5, maxScale: 1, particles: 0.35, steps: 0.5, msaa: 0, bloomLevels: 3, accumulateWhenPaused: false };
    case 'high':
      return { tier, pixelRatio: 1, renderScale: 1, minScale: 0.7, maxScale: 1, particles: 1, steps: 1, msaa: 4, bloomLevels: 5, accumulateWhenPaused: false };
    case 'ultra':
      return { tier, pixelRatio: Math.min(2, Math.max(1, devicePixelRatio)), renderScale: 1, minScale: 0.85, maxScale: 1, particles: 2, steps: 1.5, msaa: 4, bloomLevels: 6, accumulateWhenPaused: true };
  }
}

/** Initial guess from the GPU string. Software rasterisers start on Low. */
export function detectTier(gl: WebGL2RenderingContext): Tier {
  let r = '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
  } catch { /* ignore */ }
  if (/swiftshader|llvmpipe|software|basic render/.test(r)) return 'low';
  if (/intel|mali|adreno [1-5]|powervr|apple m1(?! (pro|max|ultra))/.test(r)) return 'low';
  if (/rtx|radeon rx [67]|rx 7|apple m[2-9] (pro|max|ultra)|apple m[34]/.test(r)) return 'ultra';
  return 'high';
}

/** Rolling frame-time monitor that nudges renderScale (and tier as a last resort). */
export class Adaptive {
  private samples: number[] = [];
  private cooldown = 0;
  constructor(public q: Quality, private target = 1000 / 58, private floorMs = 1000 / 30) {}
  /** returns true when the quality object changed */
  push(ms: number): boolean {
    if (ms <= 0 || ms > 500) return false; // tab switches, stalls
    this.samples.push(ms);
    if (this.samples.length > 90) this.samples.shift();
    if (this.cooldown > 0) { this.cooldown--; return false; }
    if (this.samples.length < 45) return false;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    const q = this.q;
    if (p75 > this.target * 1.12 && q.renderScale > q.minScale) {
      q.renderScale = Math.max(q.minScale, q.renderScale * Math.sqrt(this.target / p75));
      this.reset();
      return true;
    }
    if (p75 > this.floorMs && q.renderScale <= q.minScale + 1e-3 && q.tier !== 'low') {
      const next = makeQuality(q.tier === 'ultra' ? 'high' : 'low');
      Object.assign(q, next);
      this.reset();
      return true;
    }
    if (p75 < this.target * 0.7 && q.renderScale < q.maxScale) {
      q.renderScale = Math.min(q.maxScale, q.renderScale * 1.08);
      this.reset();
      return true;
    }
    return false;
  }
  private reset() { this.samples.length = 0; this.cooldown = 60; }
}

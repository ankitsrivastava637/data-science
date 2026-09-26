// Director: decides which chapter(s) are visible at t, creates/disposes chapter instances,
// renders them (two at once during transitions) and merges their overlay output.
import * as THREE from 'three';
import { CHAPTERS, END_START, TITLE_END, type ChapterMeta } from '../content/chapters';
import type { ChapterFactory, ChapterInstance, ChapterOutput, EngineContext, Frame } from './types';
import { emptyOutput } from './types';
import { hdrTarget, type PostChain, type PostParams } from './post';
import { smooth } from './ease';

export interface Active {
  meta: ChapterMeta;
  weight: number;
}

export interface Plan {
  a: Active | null;       // primary (or outgoing) chapter
  b: Active | null;       // incoming chapter during a transition
  progress: number;       // 0..1 transition progress (b's weight)
  noisy: boolean;
  fade: number;           // multiplier toward black (title/end/cuts)
}

const END_FADE = 3;

/** Pure function: which chapters are on screen at t. */
export function planAt(t: number): Plan {
  // title → chapter 1 fades up from black
  const c1 = CHAPTERS[0];
  const d1 = c1.transitionIn.duration;
  if (t < c1.start - d1 / 2) return { a: null, b: null, progress: 0, noisy: false, fade: 0 };
  for (let i = 0; i < CHAPTERS.length; i++) {
    const c = CHAPTERS[i];
    const din = c.transitionIn.type === 'cut' ? 0 : c.transitionIn.duration;
    const next = CHAPTERS[i + 1];
    const dnext = next ? (next.transitionIn.type === 'cut' ? 0 : next.transitionIn.duration) : END_FADE;
    const inStart = c.start - din / 2, inEnd = c.start + din / 2;
    const outStart = next ? c.end - dnext / 2 : c.end - dnext; // the last chapter is fully dark when the end card begins
    if (t >= inStart && t < inEnd && din > 0) {
      const p = (t - inStart) / din;
      if (i === 0) return { a: { meta: c, weight: 1 }, b: null, progress: 0, noisy: false, fade: smooth(p) };
      return { a: { meta: CHAPTERS[i - 1], weight: 1 - p }, b: { meta: c, weight: p }, progress: p, noisy: c.transitionIn.type === 'dissolve', fade: 1 };
    }
    if (t >= Math.max(inEnd, c.start) && t < outStart) return { a: { meta: c, weight: 1 }, b: null, progress: 0, noisy: false, fade: 1 };
    if (!next && t >= outStart) {
      const p = (t - outStart) / dnext;
      return { a: { meta: c, weight: 1 }, b: null, progress: 0, noisy: false, fade: 1 - smooth(p) };
    }
  }
  return { a: null, b: null, progress: 0, noisy: false, fade: 0 };
}

export class Director {
  private inst = new Map<number, ChapterInstance>();
  private rtA: THREE.WebGLRenderTarget;
  private rtB: THREE.WebGLRenderTarget;
  private w = 1; private h = 1;

  constructor(private ctx: EngineContext, private factories: Record<number, ChapterFactory>, private post: PostChain) {
    this.rtA = hdrTarget(1, 1, ctx.quality.msaa);
    this.rtB = hdrTarget(1, 1, ctx.quality.msaa);
  }

  setSize(w: number, h: number, msaa: number) {
    if (w === this.w && h === this.h && this.rtA.samples === msaa) return;
    this.w = w; this.h = h;
    if (this.rtA.samples !== msaa) {
      this.rtA.dispose(); this.rtB.dispose();
      this.rtA = hdrTarget(w, h, msaa); this.rtB = hdrTarget(w, h, msaa);
    } else {
      this.rtA.setSize(w, h); this.rtB.setSize(w, h);
    }
  }

  /** verification: scan the last chapter render (HDR, half float) for NaN/Inf on a sparse grid */
  hdrCheck(r: THREE.WebGLRenderer, stride = 4) {
    const rt = this.rtA, w = rt.width, h = rt.height;
    const buf = new Uint16Array(w * h * 4);
    r.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    let bad = 0, max = 0, n = 0;
    for (let y = 0; y < h; y += stride) for (let x = 0; x < w; x += stride) {
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v = buf[o + c];
        if ((v & 0x7c00) === 0x7c00) bad++; else max = Math.max(max, THREE.DataUtils.fromHalfFloat(v));
      }
      n++;
    }
    return { samples: n, nonFinite: bad, maxValue: max, size: [w, h] };
  }

  private get(n: number): ChapterInstance {
    let c = this.inst.get(n);
    if (!c) {
      const f = this.factories[n];
      if (!f) throw new Error(`chapter ${n} has no implementation`);
      c = f(this.ctx);
      this.inst.set(n, c);
    }
    return c;
  }

  /** dispose instances that are not needed near t; pre-create the next one */
  housekeeping(t: number) {
    for (const [n, c] of this.inst) {
      const m = CHAPTERS[n - 1];
      if (t < m.start - 12 || t > m.end + 12) { c.dispose(); this.inst.delete(n); }
    }
    for (const m of CHAPTERS) if (t > m.start - 6 && t < m.start && this.factories[m.n]) this.get(m.n);
  }

  frameFor(meta: ChapterMeta, base: Omit<Frame, 'lt'>): Frame {
    return { ...base, lt: base.t - meta.start };
  }

  /** Update + render everything visible at base.t into an HDR texture; returns it with merged output. */
  render(base: Omit<Frame, 'lt'>, out: ChapterOutput): { texture: THREE.Texture | null; post: Partial<PostParams>; fade: number } {
    const r = this.ctx.renderer;
    const plan = planAt(base.t);
    if (!plan.a) {
      r.setRenderTarget(this.rtA);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      return { texture: this.rtA.texture, post: {}, fade: 0 };
    }
    const oa = emptyOutput();
    const fa = this.frameFor(plan.a.meta, base);
    const ca = this.get(plan.a.meta.n);
    ca.update(fa, oa);
    ca.render(r, this.rtA, fa);
    if (!plan.b) {
      merge(out, oa, 1);
      out.hud = oa.hud;
      return { texture: this.rtA.texture, post: oa.post, fade: plan.fade };
    }
    const ob = emptyOutput();
    const fb = this.frameFor(plan.b.meta, base);
    const cb = this.get(plan.b.meta.n);
    cb.update(fb, ob);
    cb.render(r, this.rtB, fb);
    this.post.blend(r, this.rtA.texture, this.rtB.texture, plan.progress, plan.noisy, this.post.mixRT);
    merge(out, oa, 1 - smooth(plan.progress));
    merge(out, ob, smooth(plan.progress));
    out.hud = plan.progress < 0.5 ? oa.hud : ob.hud;
    const post: Partial<PostParams> = {};
    for (const k of ['exposure', 'bloom', 'grain', 'vignette'] as const) {
      const va = oa.post[k], vb = ob.post[k];
      if (va != null || vb != null) post[k] = (va ?? vb!) * (1 - plan.progress) + (vb ?? va!) * plan.progress;
    }
    return { texture: this.post.mixRT.texture, post, fade: plan.fade };
  }

  dispose() {
    for (const c of this.inst.values()) c.dispose();
    this.inst.clear();
    this.rtA.dispose(); this.rtB.dispose();
  }
}

function merge(into: ChapterOutput, from: ChapterOutput, w: number) {
  if (w <= 0.001) return;
  for (const l of from.labels) into.labels.push({ ...l, alpha: (l.alpha ?? 1) * w });
  for (const e of from.equations) into.equations.push({ ...e, alpha: e.alpha * w });
  for (const d of from.draw) into.draw.push((ctx, W, H, a) => d(ctx, W, H, a * w));
}

export { TITLE_END, END_START };

// Overlay: every piece of text (captions, equations, labels, HUD) is drawn into one 2D canvas
// which the final composite samples. The WebGL canvas therefore contains the whole picture.
import * as THREE from 'three';
import { CHAPTERS, TITLE_END, END_START, END_END, chapterAt } from '../content/chapters';
import { CAPTIONS, EQ_CUES, type Caption } from '../content/script';
import { claimById, equationById, EQUATIONS, type Epistemic } from '../content/ledger';
import { rasterizeLatex, type LatexBitmap } from './katexRaster';
import { clamp, ramp, smooth } from './ease';

export const LEVEL_COLOR: Record<Epistemic, string> = {
  ESTABLISHED: '#8fc2ad',
  INTERPRETATION: '#dcb877',
  SPECULATIVE: '#c99ab8',
};

export interface Label {
  /** screen position in [0,1]² (origin top-left) */
  x: number; y: number;
  text: string;
  alpha?: number;
  align?: 'left' | 'center' | 'right';
  size?: number;            // relative size, 1 = label default
  color?: string;
  leader?: { x: number; y: number }; // draw a thin line from (x,y) to leader point
  level?: Epistemic;         // small epistemic tick before the text
  mono?: boolean;
}

export interface EquationDraw {
  id: string;
  x: number; y: number;        // anchor in [0,1]²
  alpha: number;
  scale?: number;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
}

export interface HudInfo {
  /** log10 metres of field-of-view width, or null for abstract spaces */
  s: number | null;
  /** replacement text when s is null (e.g. "units: c = 1") */
  abstractLabel?: string;
  hudAlpha?: number;
}

export interface OverlayFrame {
  t: number;
  labels: Label[];
  equations: EquationDraw[];
  hud: HudInfo;
  /** extra free-form drawing hooks (chapter-specific 2D text layers) */
  draw: ((ctx: CanvasRenderingContext2D, W: number, H: number, alpha: number) => void)[];
  captionsEnabled: boolean;
  hideHud?: boolean;
  /** 0..1 dims captions & HUD (synthesis ending) */
  fadeAll?: number;
}

const FONT = 'Inter, "Helvetica Neue", Arial, sans-serif';

export class Overlay {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  W = 1; H = 1;
  private eqs = new Map<string, LatexBitmap>();
  private eqPx = 0;
  empty = true;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.flipY = true;
    this.texture.premultiplyAlpha = true;
  }

  get u() { return this.H / 1080; }

  async resize(w: number, h: number) {
    this.W = this.canvas.width = Math.max(2, Math.round(w));
    this.H = this.canvas.height = Math.max(2, Math.round(h));
    this.texture.dispose();
    this.texture.needsUpdate = true;
    const px = Math.round(30 * this.u);
    if (Math.abs(px - this.eqPx) > 1) await this.rasterEquations(px);
  }

  async rasterEquations(px: number) {
    this.eqPx = px;
    const results = await Promise.all(EQUATIONS.map(async (e) => [e.id, await rasterizeLatex(e.latex, px)] as const));
    for (const [id, bmp] of results) this.eqs.set(id, bmp);
  }

  equationSize(id: string) {
    const b = this.eqs.get(id);
    return b ? { w: b.width / this.W, h: b.height / this.H } : { w: 0, h: 0 };
  }

  render(f: OverlayFrame) {
    const { ctx, W, H } = this;
    const u = this.u;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';
    const fade = 1 - (f.fadeAll ?? 0);

    this.drawTitleCards(f.t);
    for (const d of f.draw) { ctx.save(); d(ctx, W, H, 1); ctx.restore(); }
    for (const e of f.equations) this.drawEquation(e);
    for (const e of EQ_CUES) {
      const a = capAlpha(f.t, e.t0, e.t1, 0.9);
      if (a > 0.002 && f.captionsEnabled) this.drawEquation({ id: e.eq, x: e.x, y: e.y, alpha: a * fade, align: e.align, valign: 'top', scale: e.scale });
    }
    for (const l of f.labels) this.drawLabel(l);
    if (f.captionsEnabled) this.drawCaptions(f.t, fade);
    if (!f.hideHud) this.drawHud(f.t, f.hud, fade);
    this.texture.needsUpdate = true;
  }

  private drawTitleCards(t: number) {
    const { ctx, W, H } = this;
    const u = this.u;
    // opening title card
    if (t < TITLE_END + 0.5) {
      const a = Math.min(ramp(0.3, 1.3, t), 1 - ramp(TITLE_END - 1.2, TITLE_END + 0.2, t));
      if (a > 0) {
        ctx.globalAlpha = a;
        ctx.fillStyle = '#efe9dd';
        ctx.textAlign = 'center';
        ctx.font = `300 ${Math.round(74 * u)}px ${FONT}`;
        spaced(ctx, 'REALITY', W / 2, H * 0.47, 0.42 * 74 * u);
        ctx.font = `300 ${Math.round(22 * u)}px ${FONT}`;
        ctx.fillStyle = '#b9b2a4';
        spaced(ctx, 'From the human eye to the structure of the universe', W / 2, H * 0.47 + 52 * u, 0.06 * 22 * u);
        ctx.globalAlpha = 1;
      }
    }
    // end card
    if (t > END_START - 0.5) {
      const a = Math.min(ramp(END_START - 0.2, END_START + 1.0, t), 1 - ramp(END_END - 0.8, END_END, t) * 0);
      if (a > 0) {
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#efe9dd';
        ctx.font = `300 ${Math.round(46 * u)}px ${FONT}`;
        spaced(ctx, 'REALITY', W / 2, H * 0.42, 0.4 * 46 * u);
        ctx.font = `300 ${Math.round(19 * u)}px ${FONT}`;
        ctx.fillStyle = '#b9b2a4';
        const lines = [
          'A real-time scientific visualization. Every on-screen claim carries an epistemic tag:',
        ];
        ctx.fillText(lines[0], W / 2, H * 0.42 + 56 * u);
        const tags: Epistemic[] = ['ESTABLISHED', 'INTERPRETATION', 'SPECULATIVE'];
        ctx.font = `500 ${Math.round(15 * u)}px ${FONT}`;
        const gap = 34 * u;
        const widths = tags.map((k) => ctx.measureText(k).width + 26 * u);
        let x = W / 2 - (widths.reduce((s, w) => s + w, 0) + gap * 2) / 2;
        tags.forEach((k, i) => { this.pill(x, H * 0.42 + 84 * u, k, a); x += widths[i] + gap; });
        ctx.font = `300 ${Math.round(16 * u)}px ${FONT}`;
        ctx.fillStyle = '#948d80';
        ctx.textAlign = 'center';
        ctx.globalAlpha = a;
        ctx.fillText('Sources and simplifications: SCIENCE.md.  Illustrations are labelled as such.', W / 2, H * 0.42 + 140 * u);
        ctx.globalAlpha = 1;
      }
    }
  }

  private pill(x: number, y: number, level: Epistemic, a: number, small = false) {
    const { ctx } = this;
    const u = this.u;
    const fs = Math.round((small ? 12.5 : 15) * u);
    ctx.font = `500 ${fs}px ${FONT}`;
    const w = ctx.measureText(level).width + (small ? 20 : 26) * u;
    const h = fs * 1.75;
    ctx.globalAlpha = a;
    ctx.strokeStyle = LEVEL_COLOR[level];
    ctx.lineWidth = Math.max(1, 1.2 * u);
    roundRect(ctx, x, y - h * 0.72, w, h, h / 2);
    ctx.stroke();
    ctx.fillStyle = LEVEL_COLOR[level];
    ctx.textAlign = 'left';
    spaced(ctx, level, x + (small ? 10 : 13) * u, y + fs * 0.08, 0.08 * fs, 'left');
    ctx.globalAlpha = 1;
    return w;
  }

  private drawCaptions(t: number, fade: number) {
    const { ctx, W, H } = this;
    const u = this.u;
    const active = CAPTIONS.filter((c) => t > c.t0 - 1 && t < c.t1 + 1);
    // stack from the bottom of the title-safe area
    const left = W * 0.05 + 4 * u;
    let base = H * 0.95 - 8 * u;
    const byPlace = { lower: [] as Caption[], upper: [] as Caption[] };
    for (const c of active) (c.place === 'upper' ? byPlace.upper : byPlace.lower).push(c);
    const fs = Math.round(23 * u);
    const lineH = fs * 1.38;
    const maxW = Math.min(W * 0.46, 860 * u);
    ctx.textAlign = 'left';
    for (const c of byPlace.lower.slice().reverse()) {
      const a = capAlpha(t, c.t0, c.t1, 0.8) * fade;
      if (a <= 0.002) continue;
      ctx.font = `350 ${fs}px ${FONT}`;
      const lines = wrap(ctx, c.text, maxW);
      const blockH = lines.length * lineH;
      const y0 = base - blockH + lineH * 0.8;
      const lvl = claimById(c.ref)?.level ?? 'ESTABLISHED';
      // epistemic tick
      ctx.globalAlpha = a;
      ctx.fillStyle = LEVEL_COLOR[lvl];
      ctx.fillRect(left - 14 * u, y0 - fs * 0.78, Math.max(2, 2.2 * u), blockH - lineH + fs * 0.98);
      // soft shadow for legibility on bright frames
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = 10 * u;
      ctx.fillStyle = '#eee8dc';
      lines.forEach((ln, i) => ctx.fillText(ln, left, y0 + i * lineH));
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      base = y0 - lineH * 0.8 - 18 * u;
    }
    let top = H * 0.05 + 150 * u;
    for (const c of byPlace.upper) {
      const a = capAlpha(t, c.t0, c.t1, 0.8) * fade;
      if (a <= 0.002) continue;
      ctx.font = `350 ${fs}px ${FONT}`;
      const lines = wrap(ctx, c.text, maxW);
      const lvl = claimById(c.ref)?.level ?? 'ESTABLISHED';
      ctx.globalAlpha = a;
      ctx.fillStyle = LEVEL_COLOR[lvl];
      ctx.fillRect(left - 14 * u, top - fs * 0.78, Math.max(2, 2.2 * u), lines.length * lineH - lineH + fs * 0.98);
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = 10 * u;
      ctx.fillStyle = '#eee8dc';
      lines.forEach((ln, i) => ctx.fillText(ln, left, top + i * lineH));
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      top += lines.length * lineH + 18 * u;
    }
  }

  drawEquation(e: EquationDraw) {
    const b = this.eqs.get(e.id);
    if (!b || e.alpha <= 0.002) return;
    const { ctx, W, H } = this;
    const s = e.scale ?? 1;
    const w = b.width * s, h = b.height * s;
    let x = e.x * W, y = e.y * H;
    if ((e.align ?? 'left') === 'center') x -= w / 2; else if (e.align === 'right') x -= w;
    if (e.valign === 'middle') y -= h / 2; else if (e.valign === 'bottom') y -= h;
    ctx.globalAlpha = clamp(e.alpha);
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 12 * this.u;
    ctx.drawImage(b.canvas, x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  private drawLabel(l: Label) {
    const a = l.alpha ?? 1;
    if (a <= 0.002) return;
    const { ctx, W, H } = this;
    const u = this.u;
    const fs = Math.round(17 * u * (l.size ?? 1));
    const x = l.x * W, y = l.y * H;
    ctx.globalAlpha = a;
    if (l.leader) {
      ctx.strokeStyle = 'rgba(230,224,212,0.55)';
      ctx.lineWidth = Math.max(1, 1 * u);
      ctx.beginPath();
      ctx.moveTo(l.leader.x * W, l.leader.y * H);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(230,224,212,0.8)';
      ctx.beginPath(); ctx.arc(l.leader.x * W, l.leader.y * H, 2.2 * u, 0, Math.PI * 2); ctx.fill();
    }
    ctx.font = `${l.mono ? 400 : 380} ${fs}px ${l.mono ? '"DejaVu Sans Mono", Menlo, monospace' : FONT}`;
    ctx.textAlign = l.align ?? 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8 * u;
    ctx.fillStyle = l.color ?? '#e6e0d4';
    let tx = x;
    if (l.level) {
      ctx.fillStyle = LEVEL_COLOR[l.level];
      const off = (l.align === 'right' ? -1 : 1) * 0;
      ctx.fillRect(tx + off - (l.align === 'right' ? -6 * u : 10 * u), y - fs * 0.72, 2 * u, fs * 0.9);
      ctx.fillStyle = l.color ?? '#e6e0d4';
    }
    const lines = l.text.split('\n');
    lines.forEach((ln, i) => ctx.fillText(ln, tx, y + i * fs * 1.3));
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  private drawHud(t: number, hud: HudInfo, fade: number) {
    const { ctx, W, H } = this;
    const u = this.u;
    const ch = chapterAt(t);
    if (!ch) return;
    const hudA = (hud.hudAlpha ?? 1) * fade * Math.min(ramp(ch.start, ch.start + 1.2, t), 1 - ramp(ch.end - 0.6, ch.end, t) * 0);
    const left = W * 0.05, top = H * 0.05;
    // chapter indicator + epistemic badge (top-left)
    ctx.globalAlpha = hudA * 0.9;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#d8d1c3';
    ctx.font = `400 ${Math.round(14 * u)}px ${FONT}`;
    spaced(ctx, `${String(ch.n).padStart(2, '0')} / 12   ${ch.title.toUpperCase()}`, left, top + 14 * u, 0.16 * 14 * u, 'left');
    ctx.globalAlpha = 1;
    this.pill(left, top + 46 * u, ch.epistemicLevel, hudA * 0.95, true);

    // chapter title card (large, fades after a few seconds)
    const ta = Math.min(ramp(ch.start + 0.4, ch.start + 1.8, t), 1 - ramp(ch.start + 5.2, ch.start + 6.8, t)) * fade;
    if (ta > 0.002) {
      ctx.globalAlpha = ta;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f1ebdf';
      ctx.font = `300 ${Math.round(50 * u)}px ${FONT}`;
      spaced(ctx, ch.title, left, H * 0.3, 0.02 * 50 * u, 'left');
      if (ch.subtitle) {
        ctx.fillStyle = '#aaa396';
        ctx.font = `350 ${Math.round(17 * u)}px ${FONT}`;
        spaced(ctx, ch.subtitle, left + 2 * u, H * 0.3 + 38 * u, 0.06 * 17 * u, 'left');
      }
      ctx.globalAlpha = 1;
    }

    // scale bar (bottom-right)
    const right = W * 0.95, bottom = H * 0.95;
    ctx.textAlign = 'right';
    if (hud.s != null && isFinite(hud.s)) {
      const fieldM = Math.pow(10, hud.s);
      const pxPerM = W / fieldM;
      const target = 150 * u;
      const L = niceLength(target / pxPerM);
      const barPx = L * pxPerM;
      ctx.globalAlpha = hudA * 0.9;
      ctx.strokeStyle = '#e4ddcf';
      ctx.lineWidth = Math.max(1, 1.4 * u);
      ctx.beginPath();
      ctx.moveTo(right - barPx, bottom - 30 * u); ctx.lineTo(right, bottom - 30 * u);
      ctx.moveTo(right - barPx, bottom - 35 * u); ctx.lineTo(right - barPx, bottom - 25 * u);
      ctx.moveTo(right, bottom - 35 * u); ctx.lineTo(right, bottom - 25 * u);
      ctx.stroke();
      ctx.fillStyle = '#e4ddcf';
      ctx.font = `400 ${Math.round(15 * u)}px ${FONT}`;
      ctx.fillText(formatLength(L), right, bottom - 42 * u);
      ctx.fillStyle = '#a79f91';
      ctx.font = `350 ${Math.round(13.5 * u)}px ${FONT}`;
      ctx.fillText(`field of view ≈ ${formatLength(fieldM, true)}   ·   log₁₀(m) = ${hud.s.toFixed(1)}`, right, bottom - 4 * u);
      ctx.globalAlpha = 1;
    } else if (hud.abstractLabel) {
      ctx.globalAlpha = hudA * 0.85;
      ctx.fillStyle = '#a79f91';
      ctx.font = `350 ${Math.round(13.5 * u)}px ${FONT}`;
      ctx.fillText(hud.abstractLabel, right, bottom - 4 * u);
      ctx.globalAlpha = 1;
    }
  }
}

export function capAlpha(t: number, t0: number, t1: number, fadeDur = 0.8) {
  return Math.min(smooth((t - t0) / fadeDur), smooth((t1 - t) / fadeDur));
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: 'center' | 'left' = 'center') {
  // canvas letterSpacing is widely supported now; fall back to plain fillText
  const anyCtx = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in anyCtx) {
    const prev = anyCtx.letterSpacing;
    anyCtx.letterSpacing = `${spacing.toFixed(2)}px`;
    ctx.textAlign = align;
    // letterSpacing adds trailing space after the last glyph; compensate for centring
    ctx.fillText(text, align === 'center' ? x + spacing / 2 : x, y);
    anyCtx.letterSpacing = prev ?? '0px';
  } else {
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
    }
    out.push(line);
  }
  return out;
}

export function niceLength(x: number): number {
  const e = Math.floor(Math.log10(x));
  const b = x / Math.pow(10, e);
  const n = b < 1.5 ? 1 : b < 3.5 ? 2 : b < 7.5 ? 5 : 10;
  return n * Math.pow(10, e);
}

const LY = 9.4607304725808e15;
const AU = 149597870700;
export function formatLength(m: number, approx = false): string {
  const f = (v: number, unit: string) => {
    const digits = approx ? (v >= 100 ? 0 : v >= 10 ? 0 : 1) : 0;
    let s = approx ? v.toFixed(digits) : String(+v.toPrecision(3));
    if (s.endsWith('.0')) s = s.slice(0, -2);
    return `${s} ${unit}`;
  };
  if (m < 1e-12) return f(m / 1e-15, 'fm');
  if (m < 1e-9) return f(m / 1e-12, 'pm');
  if (m < 1e-6) return f(m / 1e-9, 'nm');
  if (m < 1e-3) return f(m / 1e-6, 'µm');
  if (m < 1) return f(m / 1e-3, 'mm');
  if (m < 1e3) return f(m, 'm');
  if (m < 1e9) return approx ? `${Math.round(m / 1e3).toLocaleString('en-US')} km` : f(m / 1e3, 'km');
  if (m < 0.05 * LY) return f(m / AU, 'au');
  if (m < 1e6 * LY) return approx && m / LY >= 1000 ? `${Math.round(m / LY).toLocaleString('en-US')} ly` : f(m / LY, 'ly');
  if (m < 1e9 * LY) return f(m / LY / 1e6, 'million ly');
  return f(m / LY / 1e9, 'billion ly');
}

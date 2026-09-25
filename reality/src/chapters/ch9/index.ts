// Chapter 9 · Mathematics — zero and place value (history, with uncertainty) → primes → partitions
// and a modular form → continued fractions and Ramanujan's 1/π → ζ on the critical line and the
// explicit formula rebuilding the primes → Cantor's diagonal → halting/Gödel → Noether.
import * as THREE from 'three';
import type { ChapterInstance, ChapterOutput, EngineContext, Frame } from '../../engine/types';
import { ramp, clamp, trap, smooth } from '../../engine/ease';
import { D2, lerp } from '../draw2d';
import { FullscreenPass, shaderMat } from '../../engine/post';
import { chebyshevPsi, psiExplicit, partitions, hardyRamanujan, listPartitions, continuedFraction, convergents, ramanujanPi, madhava, kepler, sieve } from '../../math/numbertheory';
import { Rng } from '../../engine/prng';
import { sup } from '../ch4';

const ETA_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform float aspect; uniform float uW; uniform float uRot; uniform float uR;
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
vec2 cdiv(vec2 a, vec2 b){ float d = dot(b,b); return vec2(a.x*b.x + a.y*b.y, a.y*b.x - a.x*b.y)/d; }
void main(){
  vec2 p = (vUv*2.0 - 1.0) * vec2(aspect, 1.0) / uR;
  float r = length(p);
  if (r >= 1.0) { o = vec4(0,0,0,1); return; }
  float cr = cos(uRot), sr = sin(uRot);
  vec2 w = vec2(cr*p.x - sr*p.y, sr*p.x + cr*p.y);
  // Cayley map: disk → upper half-plane, τ = i(1+w)/(1−w)
  vec2 tau = cmul(vec2(0.0, 1.0), cdiv(vec2(1.0 + w.x, w.y), vec2(1.0 - w.x, -w.y)));
  float mq = exp(-6.28318530718*tau.y);
  if (mq > 0.985) { o = vec4(0,0,0,1); return; }
  vec2 q = mq * vec2(cos(6.28318530718*tau.x), sin(6.28318530718*tau.x));
  // η(τ) = q^{1/24} ∏ (1 − qⁿ)
  vec2 eta = exp(-6.28318530718*tau.y/24.0) * vec2(cos(6.28318530718*tau.x/24.0), sin(6.28318530718*tau.x/24.0));
  vec2 qn = q;
  float logAbs = log(length(eta));
  float phase = atan(eta.y, eta.x);
  for (int n = 1; n <= 400; n++) {
    vec2 f = vec2(1.0 - qn.x, -qn.y);
    logAbs += log(length(f));
    phase += atan(f.y, f.x);
    qn = cmul(qn, q);
    if (length(qn) < 1e-5) break;
  }
  // domain colouring: phase → muted hue, log|η| → soft contour bands
  // Δ = η²⁴: 24× the phase and 24× log|η|
  phase *= 24.0; logAbs *= 24.0;
  float h = fract(phase / 6.28318530718);
  vec3 warm = vec3(0.95, 0.62, 0.36), cool = vec3(0.36, 0.58, 0.95), pale = vec3(0.86, 0.84, 0.76);
  float c = cos(h*6.28318530718), s = sin(h*6.28318530718);
  vec3 col = max(vec3(0.0), 0.5*(1.0+c)*warm + 0.5*(1.0-c)*cool + 0.2*s*(pale - vec3(0.6,0.45,0.85)));
  float band = 0.55 + 0.45*smoothstep(0.0, 0.5, abs(fract(logAbs*0.35) - 0.5));
  float fade = smoothstep(0.985, 0.9, mq) * smoothstep(1.0, 0.97, r);
  o = vec4(col * band * fade * 0.55 * uW, 1.0);
}`;

export default function create(ctx: EngineContext): ChapterInstance {
  const zeros: number[] = ctx.shared.extra.zeta.zeros;
  const curve: Float64Array = ctx.shared.extra.zeta.curve; // (re, im) of ζ(½+it), t = 0…50 step 0.02
  const pn = partitions(60);
  const young5 = listPartitions(5);
  const cf = continuedFraction(Math.PI, 6), conv = convergents(cf);
  const piK = [1, 2, 3, 4].map((k) => ramanujanPi(k, 40));
  const isP = sieve(60000);
  const etaPass = new FullscreenPass(shaderMat(ETA_FRAG, { aspect: { value: 16 / 9 }, uW: { value: 0 }, uRot: { value: 0 }, uR: { value: 0.9 } }, { blending: THREE.AdditiveBlending, transparent: true }));
  const rows = cantorRows(ctx.seed);
  let wEta = 0;

  return {
    update(f: Frame, out: ChapterOutput) {
      const lt = f.lt;
      const L = (a: number, b: number, fi = 1, fo = 1) => trap(a, b, lt, fi, fo);
      const push = (a: number, fn: (d: D2) => void) => { if (a > 0.01) out.draw.push((g, W, H, a0) => fn(new D2(g, W, H, a0 * a))); };
      push(L(-1, 27.5, 1, 1.2), (d) => drawHistory(d, lt));
      push(L(27, 36.5, 1, 1), (d) => drawUlam(d, lt, isP));
      push(L(36, 44.5, 1, 0.8), (d) => drawPartitions(d, lt, pn, young5));
      wEta = L(44, 50.5, 1.2, 1.2);
      etaPass.material.uniforms.uW.value = wEta;
      etaPass.material.uniforms.aspect.value = f.aspect;
      etaPass.material.uniforms.uRot.value = (lt - 44) * 0.04;
      if (wEta > 0.01) out.labels.push({ x: 0.5, y: 0.93, text: 'Δ(τ) = η(τ)²⁴, built from the same infinite product, on the hyperbolic disk — colour: phase, bands: |Δ|', align: 'center', alpha: wEta, size: 0.95 });
      push(L(50, 56, 0.8, 1), (d) => drawPiPanel(d, lt, cf, conv, piK));
      push(L(55.5, 68.5, 1, 1), (d) => drawZeta(d, lt, zeros, curve));
      push(L(68, 78, 1, 0.8), (d) => drawCantor(d, lt, rows));
      push(L(77.5, 83.5, 0.8, 0.8), (d) => drawHalting(d, lt, rows));
      push(L(82.8, 92, 1, 1.5), (d) => drawNoether(d, lt));
      out.hud = { s: null, abstractLabel: lt < 27 ? 'history — dates as attested, with their uncertainties' : 'mathematics — no physical scale' };
      out.post = { exposure: 1.0, bloom: 0.04, vignette: 0.3 };
    },
    render(r, target) {
      r.setRenderTarget(target);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      if (wEta > 0.01) etaPass.render(r, target);
    },
    dispose() { etaPass.material.dispose(); },
  };
}

// ── history ──────────────────────────────────────────────────────────────
function drawHistory(d: D2, lt: number) {
  // timeline 200 CE → 1250 CE
  const x0 = 0.08, x1 = 0.92, y = 0.72;
  const X = (yr: number) => x0 + ((yr - 200) / 1050) * (x1 - x0);
  const tl = ramp(0.3, 2, lt);
  d.alpha(tl);
  d.line([[x0, y], [x1, y]], '#8b857a', 1.2);
  for (let yr = 200; yr <= 1200; yr += 100) { d.line([[X(yr), y - 0.006], [X(yr), y + 0.006]], '#8b857a', 1); d.text(`${yr}`, X(yr), y + 0.035, { size: 13, align: 'center', color: '#8b857a' }); }
  d.text('CE', x1 + 0.01, y + 0.035, { size: 13, color: '#8b857a' });
  d.alpha(1);
  const ev = (yr: number, t0: number, label: string, sub: string, row: number, color = '#efe6d2') => {
    const a = ramp(t0, t0 + 0.8, lt);
    if (a <= 0) return;
    d.alpha(a);
    const yy = y - 0.08 - row * 0.085;
    d.line([[X(yr), y], [X(yr), yy + 0.012]], 'rgba(200,190,172,0.5)', 1);
    d.circle(X(yr), y, 4, color);
    d.text(label, X(yr), yy, { size: 16, align: 'center', color });
    d.text(sub, X(yr), yy + 0.028, { size: 13, align: 'center', color: '#aaa394' });
    d.alpha(1);
  };
  // Bakhshālī folios: three radiocarbon ranges (interpretation disputed)
  const bk = ramp(11.5, 12.5, lt);
  if (bk > 0) {
    d.alpha(bk);
    for (const [a, b] of [[224, 383], [680, 779], [885, 993]]) d.rect(X(a), y + 0.055, X(b) - X(a), 0.012, 'rgba(201,154,184,0.55)');
    d.text('Bakhshālī manuscript: radiocarbon ranges of three folios (what they mean for its zero is disputed)', X(224), y + 0.1, { size: 13, color: '#c99ab8' });
    d.alpha(1);
  }
  ev(499, 1, 'Āryabhaṭa', 'Āryabhaṭīya, 499', 0);
  ev(628, 6, 'Brahmagupta', 'rules for zero, 628', 1);
  ev(683, 11, 'Sambor (Khmer)', 'zero as a dot, 683', 2);
  ev(876, 11.8, 'Gwalior', 'circle zero in “270”, 876', 0);
  ev(825, 20, 'al-Khwārizmī', 'Hindu numerals, c. 825', 3);
  ev(1202, 21, 'Fibonacci', 'Liber Abaci, 1202', 1);
  // Āryabhaṭa's ratio
  const ar = trap(1.5, 7, lt, 0.8, 0.8);
  if (ar > 0.01) {
    d.alpha(ar);
    d.circle(0.55, 0.3, 70, undefined, '#e4ddcf', 1.5);
    d.line([[0.55 - (70 * d.u) / d.W, 0.3], [0.55 + (70 * d.u) / d.W, 0.3]], '#ffd6a0', 1.5);
    d.text('diameter 20 000', 0.55, 0.29, { size: 14, align: 'center', color: '#ffd6a0' });
    d.text('circumference ≈ 62 832   →   π ≈ 3.1416', 0.62, 0.305, { size: 19, color: '#efe6d2' });
    d.alpha(1);
  }
  const bg = trap(6, 11.5, lt, 0.8, 0.8);
  if (bg > 0.01) {
    d.alpha(bg);
    const rules = ['a − a = 0 (zero as the result of subtraction)', 'a + 0 = a,   a − 0 = a', 'a × 0 = 0', 'a debt minus zero is a debt; a fortune minus zero, a fortune'];
    rules.forEach((r, i) => d.text(r, 0.45, 0.2 + i * 0.04, { size: 18, color: i === 3 ? '#aaa394' : '#efe6d2' }));
    d.text('zero treated as a number with rules of its own', 0.45, 0.2 + 4 * 0.04 + 0.01, { size: 15, color: '#aaa394' });
    d.alpha(1);
  }
  // nakshatra ring: 27 sectors of 13°20′, the Moon advancing about one per day
  const nk = trap(16.5, 23, lt, 0.8, 0.8);
  if (nk > 0.01) {
    d.alpha(nk);
    const cx = 0.6, cy = 0.33, R = 110 * d.u;
    const g = d.g;
    for (let i = 0; i < 27; i++) {
      const a0 = (i / 27) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / 27) * Math.PI * 2 - Math.PI / 2;
      g.strokeStyle = 'rgba(210,200,182,0.6)'; g.lineWidth = 1 * d.u;
      g.beginPath(); g.moveTo(cx * d.W + Math.cos(a0) * R * 0.8, cy * d.H + Math.sin(a0) * R * 0.8); g.lineTo(cx * d.W + Math.cos(a0) * R, cy * d.H + Math.sin(a0) * R); g.stroke();
      g.beginPath(); g.arc(cx * d.W, cy * d.H, R, a0, a1); g.stroke();
      void a1;
    }
    const day = (lt - 16.5) * 3.2; // days (displayed fast)
    const moonA = (day / 27.32) * Math.PI * 2 - Math.PI / 2;
    d.circle(cx + (Math.cos(moonA) * R * 0.9) / d.W, cy + (Math.sin(moonA) * R * 0.9) / d.H, 7, '#efe6d2');
    d.text('27 nakshatras × 13°20′', cx, cy - 0.005, { size: 15, align: 'center', color: '#efe6d2' });
    d.text(`day ${day.toFixed(0)} of a sidereal month (27.3 d)`, cx, cy + 0.03, { size: 13, align: 'center', color: '#aaa394' });
    d.alpha(1);
  }
  // Mādhava series
  const md = trap(22, 27.5, lt, 0.8, 0.8);
  if (md > 0.01) {
    d.alpha(md);
    const n = Math.max(1, Math.floor(Math.pow(10, clamp((lt - 22) / 4.5) * 3)));
    d.text(`Mādhava (Kerala, c. 1340–1425): 4(1 − 1/3 + 1/5 − …) with ${n.toLocaleString('en-US')} terms = ${madhava(n).toFixed(6)}`, 0.6, 0.36, { size: 17, align: 'center', color: '#efe6d2' });
    d.alpha(1);
  }
}

// ── primes on a square spiral ────────────────────────────────────────────
function drawUlam(d: D2, lt: number, isP: Uint8Array) {
  const n = Math.floor(Math.pow(clamp((lt - 27.5) / 5), 2) * 40000) + 1;
  const cx = 0.5 * d.W, cy = 0.46 * d.H, cell = 3.1 * d.u;
  let x = 0, y = 0, dx = 1, dy = 0, seg = 1, segPassed = 0, turns = 0;
  const g = d.g;
  g.fillStyle = 'rgba(255,220,176,0.95)';
  for (let k = 1; k <= n; k++) {
    if (isP[k]) g.fillRect(cx + x * cell - cell * 0.5, cy + y * cell - cell * 0.5, cell * 0.9, cell * 0.9);
    x += dx; y += dy; segPassed++;
    if (segPassed === seg) { segPassed = 0; [dx, dy] = [-dy, dx]; turns++; if (turns % 2 === 0) seg++; }
  }
  d.text(`the integers 1 … ${n.toLocaleString('en-US')} on a square spiral; primes lit`, 0.5, 0.9, { size: 15, align: 'center', color: '#aaa394' });
}

// ── partitions ───────────────────────────────────────────────────────────
function drawPartitions(d: D2, lt: number, pn: bigint[], young: number[][]) {
  const cs = 19 * d.u;
  young.forEach((part, i) => {
    const a = ramp(36.5 + i * 0.35, 37 + i * 0.35, lt);
    if (a <= 0) return;
    d.alpha(a);
    const bx = (0.1 + i * 0.082) * d.W, by = 0.17 * d.H;
    part.forEach((len, r) => { for (let c = 0; c < len; c++) { d.g.strokeStyle = '#efe6d2'; d.g.lineWidth = 1.2 * d.u; d.g.strokeRect(bx + c * cs, by + r * cs, cs * 0.9, cs * 0.9); } });
    d.text(part.join('+'), bx / d.W + 0.03, 0.17 + 0.16, { size: 14, align: 'center', color: '#aaa394' });
    d.alpha(1);
  });
  d.text('p(5) = 7 ways to write 5 as a sum', 0.1, 0.13, { size: 16, color: '#efe6d2', alpha: ramp(37, 38, lt) });
  // growth of p(n) and the Hardy–Ramanujan curve (log scale)
  const pl = ramp(39.5, 40.5, lt);
  if (pl <= 0) return;
  d.alpha(pl);
  const box = { x: 0.1, y: 0.46, w: 0.4, h: 0.34 };
  const N = 60;
  const Y = (v: number) => box.y + box.h - (Math.log10(v) / Math.log10(Number(pn[N]) * 2)) * box.h;
  d.line([[box.x, box.y + box.h], [box.x + box.w, box.y + box.h]], '#6f6a60', 1);
  for (let n = 1; n <= N; n++) d.circle(box.x + (n / N) * box.w, Y(Number(pn[n])), 2.6, '#efe6d2');
  d.plot(box, [1, N], [0, Math.log10(Number(pn[N]) * 2)], (n) => Math.log10(hardyRamanujan(n)), '#ffc98f', 1.8);
  d.text('p(n), n = 1…60 (dots) and the Hardy–Ramanujan formula (curve), log scale', box.x, box.y - 0.02, { size: 13, color: '#aaa394' });
  d.text(`p(60) = ${pn[60].toLocaleString()}`, box.x + box.w, box.y + 0.02, { size: 14, align: 'right', color: '#efe6d2' });
  d.alpha(1);
}

// ── continued fraction and Ramanujan's series ────────────────────────────
function drawPiPanel(d: D2, lt: number, cf: number[], conv: [bigint, bigint][], piK: string[]) {
  d.text(`π = [${cf.join('; ').replace(';', ';')} …]`, 0.08, 0.2, { size: 20, color: '#efe6d2' });
  conv.slice(1, 4).forEach(([p, q], i) => {
    const a = ramp(50.5 + i * 0.6, 51 + i * 0.6, lt);
    d.text(`${p}/${q} = ${(Number(p) / Number(q)).toFixed(9)}`, 0.08, 0.26 + i * 0.04, { size: 17, color: '#d9d2c4', alpha: a });
  });
  const ra = ramp(53, 54, lt);
  if (ra <= 0) return;
  d.alpha(ra);
  d.text('Ramanujan (1914): terms of the series for 1/π', 0.55, 0.2, { size: 16, color: '#aaa394' });
  const truePi = '3.141592653589793238462643383279502884197';
  piK.forEach((s, i) => {
    const a = ramp(53.3 + i * 0.5, 53.8 + i * 0.5, lt);
    let ok = 0;
    while (ok < s.length && s[ok] === truePi[ok]) ok++;
    const y = 0.26 + i * 0.045;
    d.g.globalAlpha = d.a * ra * a;
    d.font(17);
    d.g.textAlign = 'left';
    const good = s.slice(0, ok), bad = s.slice(ok, 34);
    d.g.fillStyle = '#ffd6a0'; d.g.fillText(good, 0.55 * d.W, y * d.H);
    const w = d.g.measureText(good).width;
    d.g.fillStyle = '#6f6a60'; d.g.fillText(bad, 0.55 * d.W + w, y * d.H);
    d.g.fillStyle = '#aaa394'; d.g.fillText(`  ${i + 1} term${i ? 's' : ''}`, 0.55 * d.W + d.g.measureText(s.slice(0, 34)).width, y * d.H);
  });
  d.alpha(1);
}

// ── ζ on the critical line and the explicit formula ──────────────────────
function drawZeta(d: D2, lt: number, zeros: number[], curve: Float64Array) {
  const phase1 = 1 - ramp(61.5, 62.5, lt);
  if (phase1 > 0.01) {
    d.alpha(phase1);
    // left: the curve ζ(½+it) in the complex plane, drawn as t grows
    const tMax = Math.min(50, 1 + clamp((lt - 55.5) / 5.5) * 49);
    const cx = 0.3, cy = 0.46, sc = 0.12;
    d.line([[cx - 0.2, cy], [cx + 0.2, cy]], '#4d4940', 1); d.line([[cx, cy - 0.3], [cx, cy + 0.3]], '#4d4940', 1);
    const pts: [number, number][] = [];
    const n = Math.floor(tMax / 0.02);
    for (let i = 0; i <= n; i++) pts.push([cx + curve[i * 2] * sc * (9 / 16), cy - curve[i * 2 + 1] * sc]);
    d.line(pts, '#ffc98f', 1.4);
    d.circle(cx, cy, 3, '#efe6d2');
    d.text('ζ(½ + it) for 0 ≤ t ≤ ' + tMax.toFixed(0), cx, 0.12, { size: 15, align: 'center', color: '#aaa394' });
    d.text('every pass through 0 is a zero', cx, 0.8, { size: 14, align: 'center', color: '#aaa394' });
    // right: zeros on the critical line
    const x = 0.66;
    d.line([[x, 0.12], [x, 0.84]], '#6f6a60', 1);
    d.text('Re(s) = ½', x, 0.1, { size: 14, align: 'center', color: '#aaa394' });
    zeros.forEach((g, i) => {
      if (g > tMax) return;
      const y = 0.84 - (g / 50) * 0.7;
      d.circle(x, y, 4, '#ffd6a0');
      if (i < 6) d.text(g.toFixed(6), x + 0.012, y + 0.006, { size: 13, color: '#d9d2c4' });
    });
    d.text('zeros computed here (Euler–Maclaurin + sign changes)', x + 0.012, 0.88, { size: 13, color: '#8b857a' });
    d.alpha(1);
  }
  const phase2 = ramp(61.8, 62.8, lt);
  if (phase2 > 0.01) {
    d.alpha(phase2);
    const box = { x: 0.1, y: 0.16, w: 0.8, h: 0.6 };
    const xr: [number, number] = [2, 50], yr: [number, number] = [0, 52];
    d.line([[box.x, box.y + box.h], [box.x + box.w, box.y + box.h]], '#6f6a60', 1);
    // true staircase ψ(x)
    d.plot(box, xr, yr, (x) => chebyshevPsi(x), 'rgba(160,152,138,0.55)', 1.2, 960);
    const nZ = Math.max(1, Math.round(Math.pow(clamp((lt - 62.5) / 5), 1.5) * zeros.length));
    d.plot(box, xr, yr, (x) => psiExplicit(x, zeros, nZ), '#ffc98f', 1.8, 960);
    for (const p of [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]) d.text(String(p), box.x + ((p - 2) / 48) * box.w, box.y + box.h + 0.03, { size: 12, align: 'center', color: '#8b857a' });
    d.text(`waves from the first ${nZ} zeta zeros rebuild the prime staircase ψ(x)`, 0.5, 0.1, { size: 18, align: 'center', color: '#efe6d2' });
    d.alpha(1);
  }
}

// ── Cantor's diagonal ────────────────────────────────────────────────────
function cantorRows(seed: number): number[][] {
  const rng = new Rng(seed, 1901);
  return Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => (rng.float() < 0.5 ? 0 : 1)));
}
function drawCantor(d: D2, lt: number, rows: number[][]) {
  const n = rows.length, cs = 0.03, x0 = 0.34, y0 = 0.13;
  const csy = 0.043;
  const k = Math.floor(clamp((lt - 70) / 4) * n); // diagonal progress
  rows.forEach((row, i) => {
    d.text(`s${sub(i + 1)}`, x0 - 0.02, y0 + i * csy + csy * 0.7, { size: 15, align: 'right', color: '#aaa394' });
    row.forEach((b, j) => {
      const onDiag = i === j && i < k;
      if (onDiag) d.rect(x0 + j * cs, y0 + i * csy, cs * 0.92, csy * 0.92, 'rgba(255,214,160,0.25)');
      d.text(String(b), x0 + j * cs + cs * 0.46, y0 + i * csy + csy * 0.68, { size: 16, align: 'center', color: onDiag ? '#ffd6a0' : '#d9d2c4' });
    });
    d.text('…', x0 + n * cs + 0.01, y0 + i * csy + csy * 0.68, { size: 16, color: '#8b857a' });
  });
  d.text('⋮', x0 + 0.18, y0 + n * csy + 0.01, { size: 18, align: 'center', color: '#8b857a' });
  d.text('a list of infinite binary sequences — suppose it contains them all', x0 + 0.18, y0 - 0.03, { size: 16, align: 'center', color: '#efe6d2' });
  // new row: flipped diagonal
  const ny = y0 + (n + 1.3) * csy;
  d.text('new', x0 - 0.02, ny + csy * 0.7, { size: 15, align: 'right', color: '#ffd6a0' });
  for (let j = 0; j < k; j++) d.text(String(1 - rows[j][j]), x0 + j * cs + cs * 0.46, ny + csy * 0.68, { size: 17, align: 'center', color: '#ffd6a0' });
  const cmp = ramp(74.5, 75.5, lt);
  if (cmp > 0) d.text('it differs from row n at position n — so it is on no row. The list was incomplete.', x0 + 0.18, ny + csy * 1.8, { size: 17, align: 'center', color: '#efe6d2', alpha: cmp });
}
function sub(n: number) { return String(n).split('').map((c) => '₀₁₂₃₄₅₆₇₈₉'[+c]).join(''); }

function drawHalting(d: D2, lt: number, rows: number[][]) {
  const n = 8, cs = 0.05, x0 = 0.34, y0 = 0.22;
  const csy = 0.042;
  d.text('program i run on input j:   ✓ halts   ∞ runs forever', 0.5, 0.14, { size: 17, align: 'center', color: '#efe6d2' });
  for (let i = 0; i < n; i++) {
    d.text(`P${sub(i + 1)}`, x0 - 0.02, y0 + i * csy + csy * 0.7, { size: 14, align: 'right', color: '#aaa394' });
    for (let j = 0; j < n; j++) {
      const diag = i === j;
      if (diag) d.rect(x0 + j * cs, y0 + i * csy, cs * 0.92, csy * 0.92, 'rgba(255,214,160,0.22)');
      d.text(rows[i][j] ? '✓' : '∞', x0 + j * cs + cs * 0.46, y0 + i * csy + csy * 0.7, { size: 15, align: 'center', color: diag ? '#ffd6a0' : '#bdb6a8' });
    }
  }
  d.text('D: run program i on itself, then do the opposite → D differs from every row: no halting-decider can exist', 0.5, y0 + n * csy + 0.06, { size: 16, align: 'center', color: '#ffd6a0' });
}

function drawNoether(d: D2, lt: number) {
  const cx = 0.36, cy = 0.46, a = 0.2, e = 0.6;
  const sx = a, sy = a * (16 / 9);
  const pts: [number, number][] = [];
  for (let i = 0; i <= 200; i++) { const [x, y] = kepler(e, (i / 200) * Math.PI * 2); pts.push([cx + x * sx, cy + y * sy * 0.8]); }
  d.line(pts, '#8b857a', 1.2);
  d.circle(cx, cy, 8, '#ffd6a0');
  // equal areas in equal times
  const T = 8;
  const g = d.g;
  for (let k = 0; k < 8; k++) {
    const m0 = (k / T) * Math.PI * 2, m1 = m0 + 0.35;
    g.fillStyle = k % 2 ? 'rgba(156,194,255,0.18)' : 'rgba(255,201,143,0.18)';
    g.beginPath(); g.moveTo(cx * d.W, cy * d.H);
    for (let s = 0; s <= 20; s++) { const [x, y] = kepler(e, m0 + ((m1 - m0) * s) / 20); g.lineTo((cx + x * sx) * d.W, (cy + y * sy * 0.8) * d.H); }
    g.closePath(); g.fill();
  }
  const [px, py] = kepler(e, (lt - 83) * 1.1);
  d.circle(cx + px * sx, cy + py * sy * 0.8, 6, '#efe6d2');
  d.text('equal areas in equal times: the planet speeds up near the Sun', cx, 0.83, { size: 15, align: 'center', color: '#aaa394' });
  d.text('rotational symmetry  →  angular momentum conserved', 0.66, 0.36, { size: 18, color: '#efe6d2' });
  d.text('time-shift symmetry  →  energy', 0.66, 0.42, { size: 17, color: '#d9d2c4' });
  d.text('space-shift symmetry  →  momentum', 0.66, 0.47, { size: 17, color: '#d9d2c4' });
  d.text('phase symmetry of ψ  →  electric charge', 0.66, 0.52, { size: 17, color: '#d9d2c4' });
}

export { sup, lerp, smooth };

// Chapter 4 · Sensory filter — photon → retinal isomerisation → cascade → spikes to cortex →
// colour built from three cone signals (a computed metamer pair) → the visible band on a true
// logarithmic axis of the electromagnetic spectrum.
import * as THREE from 'three';
import type { ChapterInstance, ChapterOutput, EngineContext, Frame } from '../../engine/types';
import { ramp, clamp, trap, smooth } from '../../engine/ease';
import { govardovskii, LMAX } from '../../math/mosaic';
import { D2, lerp } from '../draw2d';
import { spectralSRGB, xyzOfLine, encode } from '../../math/color';

// ── metamer: monochromatic 580 nm vs a mixture of 545 + 630 nm matched in L and M ──
export function metamer() {
  const L = (l: number) => govardovskii(l, LMAX.L), M = (l: number) => govardovskii(l, LMAX.M), S = (l: number) => govardovskii(l, LMAX.S);
  const t = 580, a1 = 545, a2 = 630;
  // solve [L(a1) L(a2); M(a1) M(a2)] [w1 w2]ᵀ = [L(t) M(t)]ᵀ
  const det = L(a1) * M(a2) - L(a2) * M(a1);
  const w1 = (L(t) * M(a2) - L(a2) * M(t)) / det;
  const w2 = (L(a1) * M(t) - L(t) * M(a1)) / det;
  const mono = [L(t), M(t), S(t)];
  const mix = [w1 * L(a1) + w2 * L(a2), w1 * M(a1) + w2 * M(a2), w1 * S(a1) + w2 * S(a2)];
  return { t, a1, a2, w1, w2, mono, mix };
}

export default function create(ctx: EngineContext): ChapterInstance {
  // 3D opsin: seven transmembrane helices around a retinal chromophore (schematic, nm)
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  scene.add(group);
  const helixMat = new THREE.MeshStandardMaterial({ color: 0xb68d62, roughness: 0.55, transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.2;
    const r = 1.55 + 0.15 * Math.sin(i * 2.3);
    // transmembrane α-helices drawn as cylinders (cartoon convention), slightly tilted
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      const z = -2.3 + (4.6 * k) / 8;
      pts.push(new THREE.Vector3(r * Math.cos(a) + 0.18 * Math.sin(k * 0.7 + i) + 0.12 * z * Math.cos(a + 1), z, r * Math.sin(a) + 0.18 * Math.cos(k * 0.6 + i)));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.42, 20), helixMat);
    group.add(tube);
  }
  // membrane slabs
  const memMat = new THREE.MeshBasicMaterial({ color: 0x2a3440, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const y of [-2.0, 2.0]) { const m = new THREE.Mesh(new THREE.CircleGeometry(4.2, 64), memMat); m.rotation.x = Math.PI / 2; m.position.y = y; group.add(m); }
  const retGeo = new THREE.BufferGeometry();
  const retPts = new Float32Array(3 * 12);
  retGeo.setAttribute('position', new THREE.BufferAttribute(retPts, 3));
  const retina = new THREE.Line(retGeo, new THREE.LineBasicMaterial({ color: 0xffd08a }));
  const retTube = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0xffb35c, emissive: 0x7a3a08, roughness: 0.3 }));
  group.add(retina, retTube);
  scene.add(new THREE.HemisphereLight(0xc8d4e8, 0x201810, 0.7));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.2); key.position.set(3, 5, 4); scene.add(key);
  // photon wave packet
  const photonGeo = new THREE.BufferGeometry();
  const phPts = new Float32Array(3 * 200);
  photonGeo.setAttribute('position', new THREE.BufferAttribute(phPts, 3));
  const photonMat = new THREE.LineBasicMaterial({ color: new THREE.Color().setRGB(...spectralSRGB(500), THREE.SRGBColorSpace), transparent: true, blending: THREE.AdditiveBlending });
  const photon = new THREE.Line(photonGeo, photonMat);
  scene.add(photon);
  const cam = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 200);
  const mm = metamer();

  let w3d = 0;
  function retinalShape(iso: number) {
    // polyene chain: β-ionone ring end → C11=C12 → Schiff base; cis kink straightens as iso → 1
    const kink = (1 - iso) * 1.0;
    const pts: THREE.Vector3[] = [];
    let x = -1.4, y = 0.0, z = 0.1, dir = 0;
    for (let i = 0; i < 12; i++) {
      pts.push(new THREE.Vector3(x, y + (i % 2 ? 0.1 : -0.1), z));
      if (i === 6) dir += kink;
      x += Math.cos(dir) * 0.26; z += Math.sin(dir) * 0.26;
    }
    return pts;
  }

  return {
    update(f: Frame, out: ChapterOutput) {
      const lt = f.lt;
      w3d = 1 - ramp(9.0, 11.0, lt);
      if (w3d > 0.001) {
        const ang = 0.5 + lt * 0.05;
        cam.aspect = f.aspect; cam.updateProjectionMatrix();
        cam.position.set(Math.sin(ang) * 11, 3.2, Math.cos(ang) * 11);
        cam.lookAt(0, 0.2, 0); cam.updateMatrixWorld();
        const iso = smooth(clamp((lt - 4.3) / 0.8));
        const pts = retinalShape(iso);
        pts.forEach((p, i) => { retPts[i * 3] = p.x; retPts[i * 3 + 1] = p.y; retPts[i * 3 + 2] = p.z; });
        retGeo.attributes.position.needsUpdate = true;
        retTube.geometry.dispose();
        retTube.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.07, 8);
        (retTube.material as THREE.MeshStandardMaterial).emissiveIntensity = 1 + 3 * Math.exp(-Math.max(0, lt - 4.3) / 0.6) * (lt > 4.3 ? 1 : 0);
        // photon: packet travelling down onto the retinal, absorbed at lt ≈ 4.3
        const pr = clamp((lt - 1) / 3.3);
        const head = lerp(12, 0.2, pr);
        for (let i = 0; i < 200; i++) {
          const s = i / 199;
          const yy = head + s * 5;
          const env = Math.exp(-((s - 0.35) ** 2) / 0.02);
          phPts[i * 3] = 0.35 * env * Math.sin(yy * 9); phPts[i * 3 + 1] = yy; phPts[i * 3 + 2] = 0.1;
        }
        photonGeo.attributes.position.needsUpdate = true;
        photonMat.opacity = (lt < 4.3 ? 1 : 0) * ramp(0.8, 1.6, lt);
        helixMat.opacity = 0.55 * w3d;
        memMat.opacity = 0.25 * w3d;
        if (trap(2, 8, lt, 0.8, 0.8) > 0.01) out.labels.push({ x: 0.5, y: 0.2, text: 'rhodopsin: seven helices around 11-cis-retinal (schematic)', align: 'center', alpha: trap(2, 8, lt, 0.8, 0.8) });
        if (trap(4.4, 9, lt, 0.5, 0.8) > 0.01) out.labels.push({ x: 0.5, y: 0.24, text: 'cis → trans in ~200 femtoseconds (shown slowed ~10¹³×)', align: 'center', alpha: trap(4.4, 9, lt, 0.5, 0.8), color: '#ffd6a0' });
      }
      // cascade + single-photon current (2D)
      const cA = trap(6.5, 15, lt, 0.8, 1.2);
      if (cA > 0.01) out.draw.push((g, W, H, a0) => {
        const d = new D2(g, W, H, a0 * cA);
        const steps = ['photon', 'rhodopsin*', 'transducin', 'phosphodiesterase', 'cGMP falls', 'channels close', 'cell hyperpolarises'];
        const x0 = 0.1, dx = 0.13, y = 0.72;
        steps.forEach((s, i) => {
          const on = ramp(6.8 + i * 0.55, 7.2 + i * 0.55, lt);
          d.circle(x0 + i * dx, y, 6 + 3 * on, on > 0.5 ? '#ffcf8f' : '#4b4740');
          d.text(s, x0 + i * dx, y + 0.045, { size: 15, align: 'center', color: on > 0.5 ? '#efe7d8' : '#8b857a' });
          if (i < steps.length - 1) d.arrow(x0 + i * dx + 0.012, y, x0 + (i + 1) * dx - 0.014, y, on > 0.5 ? '#bdb5a5' : '#4b4740', 1.2, 7);
        });
        // current trace: a quantised dip for one photon
        const box = { x: 0.62, y: 0.2, w: 0.3, h: 0.2 };
        d.alpha(ramp(8.8, 9.6, lt));
        d.line([[box.x, box.y + box.h], [box.x + box.w, box.y + box.h]], '#6d685f', 1);
        d.text('rod current (pA), one photon', box.x, box.y - 0.015, { size: 14, color: '#aaa394' });
        const tNow = clamp((lt - 9.2) / 4);
        d.plot(box, [0, 1], [-1.3, 0.2], (x) => { if (x > tNow) return NaN; const sN = (x - 0.15) / 0.18; return sN <= 0 ? 0 : -Math.pow(sN, 3) * Math.exp(3 - 3 * sN); }, '#ffd6a0', 2);
        d.alpha(1);
      });
      // visual pathway (2D)
      const pA = trap(14.5, 29.5, lt, 1.2, 1.2);
      if (pA > 0.01) out.draw.push((g, W, H, a0) => drawPathway(new D2(g, W, H, a0 * pA), lt));
      // cone spectra and metamer (2D)
      const sA = trap(28.8, 43.5, lt, 1.2, 1.2);
      if (sA > 0.01) out.draw.push((g, W, H, a0) => drawSpectra(new D2(g, W, H, a0 * sA), lt, mm));
      // log-scale spectrum (2D) — the awe moment
      const eA = ramp(43, 44.5, lt);
      if (eA > 0.01) out.draw.push((g, W, H, a0) => drawEM(new D2(g, W, H, a0 * eA), lt));
      if (lt < 14.5) out.hud = { s: Math.log10(9e-9) };
      else if (lt < 29) out.hud = { s: Math.log10(0.16) };
      else out.hud = { s: null, abstractLabel: lt < 43 ? 'wavelength (nm)' : 'wavelength, logarithmic axis' };
      out.post = { exposure: 1.0, bloom: 0.04, vignette: 0.3 };
    },
    render(r, target) {
      r.setRenderTarget(target);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      if (w3d > 0.001) { group.visible = true; r.render(scene, cam); }
    },
    dispose() { scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); }); helixMat.dispose(); memMat.dispose(); photonMat.dispose(); },
  };
}

function drawPathway(d: D2, lt: number) {
  const g = d.g, W = d.W, H = d.H, u = d.u;
  // stylised transverse brain outline (top view, front at top)
  const cx = 0.5 * W, cy = 0.52 * H, rx = 0.2 * W, ry = 0.36 * H;
  g.strokeStyle = 'rgba(200,190,175,0.45)'; g.lineWidth = 1.4 * u;
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(cx, cy - ry); g.lineTo(cx, cy + ry); g.setLineDash([4 * u, 6 * u]); g.stroke(); g.setLineDash([]);
  const P = (x: number, y: number): [number, number] => [x, y];
  const eyeL = P(0.44, 0.1), eyeR = P(0.56, 0.1), chi = P(0.5, 0.27), lgnL = P(0.43, 0.48), lgnR = P(0.57, 0.48), v1L = P(0.47, 0.84), v1R = P(0.53, 0.84);
  d.circle(eyeL[0], eyeL[1], 16, undefined, '#d9d2c4', 1.5); d.circle(eyeR[0], eyeR[1], 16, undefined, '#d9d2c4', 1.5);
  const paths: [number, number][][] = [
    [eyeL, [0.47, 0.2], chi, [0.45, 0.36], lgnL, [0.44, 0.66], v1L],
    [eyeR, [0.53, 0.2], chi, [0.55, 0.36], lgnR, [0.56, 0.66], v1R],
    [eyeL, [0.47, 0.2], chi, [0.55, 0.36], lgnR, [0.56, 0.66], v1R],
    [eyeR, [0.53, 0.2], chi, [0.45, 0.36], lgnL, [0.44, 0.66], v1L],
  ];
  for (const p of paths) d.line(p, 'rgba(210,200,185,0.5)', 1.3);
  d.circle(lgnL[0], lgnL[1], 9, '#6c655a'); d.circle(lgnR[0], lgnR[1], 9, '#6c655a');
  g.fillStyle = 'rgba(255,214,160,0.18)';
  g.beginPath(); g.ellipse(cx, 0.84 * H, 0.07 * W, 0.05 * H, 0, 0, Math.PI * 2); g.fill();
  d.text('eyes', 0.5, 0.06, { size: 15, align: 'center', color: '#bdb6a8' });
  d.text('optic chiasm', 0.535, 0.275, { size: 14, color: '#bdb6a8' });
  d.text('LGN (thalamus)', 0.6, 0.485, { size: 14, color: '#bdb6a8' });
  d.text('primary visual cortex (V1)', 0.5, 0.93, { size: 15, align: 'center', color: '#e8dfcc' });
  d.text('~1.2 million axons per optic nerve', 0.31, 0.16, { size: 14, align: 'right', color: '#bdb6a8' });
  d.text('schematic', 0.7, 0.93, { size: 13, color: '#8b857a' });
  // spikes travelling along the paths (deterministic)
  for (let k = 0; k < 64; k++) {
    const path = paths[k % 4];
    const ph = ((lt * 0.35 + k * 0.137) % 1);
    const seg = ph * (path.length - 1);
    const i = Math.floor(seg), f = seg - i;
    const a = path[i], b = path[Math.min(path.length - 1, i + 1)];
    d.circle(lerp(a[0], b[0], f), lerp(a[1], b[1], f), 2.6, 'rgba(255,214,160,0.9)');
  }
}

function drawSpectra(d: D2, lt: number, mm: ReturnType<typeof metamer>) {
  const box = { x: 0.08, y: 0.16, w: 0.44, h: 0.34 };
  const xr: [number, number] = [380, 720];
  const X = (l: number) => box.x + ((l - xr[0]) / (xr[1] - xr[0])) * box.w;
  // spectral colour bar
  const g = d.g;
  for (let l = 380; l < 720; l += 2) {
    const c = spectralSRGB(l);
    g.fillStyle = `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
    g.fillRect(X(l) * d.W, (box.y + box.h + 0.01) * d.H, (box.w / 170) * d.W + 1, 0.012 * d.H);
  }
  d.line([[box.x, box.y + box.h], [box.x + box.w, box.y + box.h]], '#6d685f', 1);
  for (const l of [400, 450, 500, 550, 600, 650, 700]) d.text(String(l), X(l), box.y + box.h + 0.05, { size: 13, align: 'center', color: '#9b9588' });
  d.text('wavelength (nm)', box.x + box.w, box.y + box.h + 0.085, { size: 13, align: 'right', color: '#9b9588' });
  const cols = { L: '#ff8a66', M: '#8fe07a', S: '#7d9bff' };
  const grow = ramp(29.5, 32, lt);
  (['S', 'M', 'L'] as const).forEach((k) => {
    d.plot(box, xr, [0, 1.1], (l) => (l > xr[0] + (xr[1] - xr[0]) * grow ? NaN : govardovskii(l, LMAX[k])), cols[k], 2);
    const peak = LMAX[k];
    d.text(`${k}  ${peak.toFixed(0)} nm`, X(peak), box.y + box.h - (box.h * 1.02) / 1.1 - 0.012, { size: 14, align: 'center', color: cols[k], alpha: grow });
  });
  d.text('cone pigment absorbance (Govardovskii templates)', box.x, box.y - 0.03, { size: 14, color: '#aaa394' });
  // metamer panel
  const m = ramp(35, 36.5, lt);
  if (m <= 0.01) return;
  d.alpha(m);
  const px = 0.6;
  d.text('two different lights…', px, 0.17, { size: 16, color: '#e4ddcf' });
  const spec = (y0: number, lines: [number, number][]) => {
    d.line([[px, y0], [px + 0.3, y0]], '#6d685f', 1);
    for (const [l, wgt] of lines) {
      const x = px + ((l - 380) / 340) * 0.3;
      const c = spectralSRGB(l);
      d.line([[x, y0], [x, y0 - 0.09 * wgt]], `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`, 3);
      d.text(`${l}`, x, y0 + 0.028, { size: 12, align: 'center', color: '#9b9588' });
    }
  };
  const wmax = Math.max(1, mm.w1, mm.w2);
  spec(0.33, [[mm.t, 1 / wmax]]);
  spec(0.5, [[mm.a1, mm.w1 / wmax], [mm.a2, mm.w2 / wmax]]);
  // cone responses (bars)
  const bars = (y0: number, v: number[]) => {
    ['L', 'M', 'S'].forEach((k, i) => {
      const x = 0.93 + i * 0.018;
      d.rect(x - 0.006, y0 - 0.1 * v[i] / Math.max(...mm.mono), 0.012, 0.1 * v[i] / Math.max(...mm.mono), (cols as Record<string, string>)[k]);
    });
  };
  const b = ramp(37, 38.5, lt);
  d.alpha(m * b);
  d.text('L M S', 0.948, 0.35, { size: 12, align: 'center', color: '#9b9588' });
  bars(0.33, mm.mono);
  bars(0.5, mm.mix);
  // perceived colour swatches (from CIE XYZ of each light)
  // The swatches are coloured from the cone signals (identical by construction of the match), using the
  // display colour of the 580 nm light as the reference for that L:M:S triple.
  const ref = xyzOfLine([[mm.t, 1]]);
  const sw = ramp(38.5, 40, lt);
  d.alpha(m * sw);
  const toCss = (c: number[], k: number) => `rgb(${c.map((v) => Math.round(255 * encode(v * k))).join(',')})`;
  const scale = (lms: number[]) => (lms[0] + lms[1]) / (mm.mono[0] + mm.mono[1]);
  const k = 0.9 / Math.max(...ref);
  d.rect(0.6, 0.6, 0.05, 0.07, toCss(ref, k * scale(mm.mono))); d.rect(0.67, 0.6, 0.05, 0.07, toCss(ref, k * scale(mm.mix)));
  d.text('…the same cone signals, the same colour', 0.6, 0.72, { size: 16, color: '#e4ddcf' });
  d.alpha(1);
}

// log10 wavelength axis: view range interpolates from the visible band to the full spectrum
function drawEM(d: D2, lt: number) {
  const z = smooth(clamp((lt - 45) / 8));
  const lo = lerp(Math.log10(360e-9), -15, z), hi = lerp(Math.log10(780e-9), 4.5, z);
  const X = (lg: number) => 0.06 + ((lg - lo) / (hi - lo)) * 0.88;
  const y = 0.5;
  const g = d.g;
  // visible band with true spectral colours
  const v0 = Math.log10(380e-9), v1 = Math.log10(750e-9);
  const N = 240;
  for (let i = 0; i < N; i++) {
    const lg = v0 + ((v1 - v0) * i) / N;
    const c = spectralSRGB(Math.pow(10, lg) * 1e9);
    g.fillStyle = `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
    const xa = X(lg) * d.W, xb = X(v0 + ((v1 - v0) * (i + 1)) / N) * d.W;
    g.fillRect(xa, (y - 0.03) * d.H, Math.max(1, xb - xa + 0.5), 0.06 * d.H);
  }
  // an actual wave whose drawn period is proportional to λ while the band is wide
  const wA = 1 - ramp(45.5, 48, lt);
  if (wA > 0.01) {
    const pts: [number, number][] = [];
    for (let px = 0; px <= 400; px++) {
      const xf = 0.06 + (0.88 * px) / 400;
      const lg = lo + ((xf - 0.06) / 0.88) * (hi - lo);
      const lam = Math.pow(10, lg) * 1e9;
      const phase = (xf * d.W) / (lam / 380 * 30 * d.u);
      pts.push([xf, y - 0.12 + 0.03 * Math.sin(phase * Math.PI * 2 - lt * 6)]);
    }
    d.alpha(wA); d.line(pts, '#d8d0c0', 1.4); d.alpha(1);
  }
  // axis and bands
  d.line([[0.06, y + 0.05], [0.94, y + 0.05]], '#8b857a', 1);
  const bands: [string, number, number][] = [['gamma rays', -15, -11], ['X-rays', -11, -8], ['ultraviolet', -8, Math.log10(380e-9)], ['infrared', Math.log10(750e-9), -3], ['microwaves', -3, 0], ['radio', 0, 4.5]];
  const bA = ramp(46.5, 49, lt);
  d.alpha(bA);
  for (const [name, a, b] of bands) {
    const xa = X(a), xb = X(b);
    if (xb < 0 || xa > 1) continue;
    d.line([[xa, y + 0.04], [xa, y + 0.06]], '#8b857a', 1);
    d.text(name, (Math.max(0.06, xa) + Math.min(0.94, xb)) / 2, y - 0.07, { size: 15, align: 'center', color: '#bdb6a8' });
  }
  // decades
  for (let e = -15; e <= 4; e++) {
    const x = X(e);
    if (x < 0.05 || x > 0.95) continue;
    d.line([[x, y + 0.05], [x, y + 0.065]], '#8b857a', 1);
    if (z > 0.6 && e % 3 === 0) d.text(`10${sup(e)} m`, x, y + 0.1, { size: 13, align: 'center', color: '#9b9588', alpha: bA * ramp(0.6, 0.9, z) });
  }
  const examples: [string, number][] = [['nucleus', -14.5], ['atom', -10], ['virus', -7], ['cell', -5], ['insect', -2.3], ['human', 0.2], ['building', 1.8]];
  d.alpha(ramp(50, 52, lt));
  for (const [n, e] of examples) { const x = X(e); if (x > 0.05 && x < 0.95) d.text(n, x, y + 0.155, { size: 13, align: 'center', color: '#8b857a' }); }
  d.alpha(ramp(52.5, 54, lt));
  const vx = X((v0 + v1) / 2);
  d.arrow(vx, y - 0.2, vx, y - 0.05, '#ffe2b8', 1.4, 8);
  d.text('everything your eyes can see', vx, y - 0.22, { size: 16, align: 'center', color: '#ffe2b8' });
  d.text(`${(v1 - v0).toFixed(2)} of one decade, out of the ~20 shown`, 0.5, 0.82, { size: 15, align: 'center', color: '#aaa394' });
  d.alpha(1);
}

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
export function sup(n: number) { return String(n).split('').map((c) => SUP[c] ?? c).join(''); }

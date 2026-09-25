// Chapter 5 · Frequency & information — water's motion = three normal modes; a Fourier view that
// collapses the messy signal into spectral lines and back; oscillator levels; chain normal modes;
// an ideal gas where many microstates collapse into one coarse-grained macrostate.
import * as THREE from 'three';
import type { ChapterInstance, ChapterOutput, EngineContext, Frame } from '../../engine/types';
import { ramp, clamp, trap, smooth } from '../../engine/ease';
import { D2 } from '../draw2d';
import { makeMotion, positions, signal, NU, hz, modeVectors } from '../../math/water';
import { Rng } from '../../engine/prng';
import { projectToScreen } from '../util';
import { lnGamma } from '../../math/special';

const MODES = ['bend', 'sym', 'asym'] as const;
const MODE_COL: Record<string, number> = { bend: 0x8fb8ff, sym: 0xffb38a, asym: 0xffe08a };
const GAIN = 21;       // Å → world units for the signal
const TWIN = 8;        // displayed seconds in the time window
const ZF = 4.2;        // world units per displayed Hz along the frequency axis

export default function create(ctx: EngineContext): ChapterInstance {
  const motion = makeMotion(0.8);
  const scene = new THREE.Scene();
  // molecule
  const molecule = new THREE.Group();
  const O = new THREE.Mesh(new THREE.SphereGeometry(0.66, 32, 20), new THREE.MeshStandardMaterial({ color: 0xc4574a, roughness: 0.4 }));
  const H1 = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 20), new THREE.MeshStandardMaterial({ color: 0xe0dcd4, roughness: 0.4 }));
  const H2 = H1.clone();
  const bondMat = new THREE.MeshStandardMaterial({ color: 0xa39c90, roughness: 0.5 });
  const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 12), bondMat), b2 = b1.clone();
  molecule.add(O, H1, H2, b1, b2);
  molecule.position.set(9.6, 5.8, 0);
  scene.add(molecule);
  scene.add(new THREE.HemisphereLight(0xc6d2e6, 0x201812, 0.8));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4); key.position.set(3, 6, 8); scene.add(key);
  // signal and component lines
  const NS = 400;
  const mkLine = (color: number) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthTest: false }));
  };
  const sumLine = mkLine(0xf2ebdd);
  const comps = MODES.map((k) => mkLine(MODE_COL[k]));
  scene.add(sumLine, ...comps);
  const axisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-TWIN, 0, 0), new THREE.Vector3(TWIN, 0, 0), new THREE.Vector3(TWIN, 0, 0), new THREE.Vector3(TWIN, 0, -ZF * 2.2)]);
  const axes = new THREE.LineSegments(axisGeo, new THREE.LineBasicMaterial({ color: 0x5f5a52, transparent: true, depthTest: false }));
  scene.add(axes);
  const link = mkLine(0x8f887b);
  scene.add(link);
  const cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 500);
  const v = modeVectors();
  const toW = (p: [number, number]) => new THREE.Vector3(p[0] * 2.4, p[1] * 2.4, 0);
  const place = (m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => { m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.set(1, a.distanceTo(b), 1); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); };
  const gas = makeGas(ctx.seed);
  void v;
  let w3d = 0;

  return {
    update(f: Frame, out: ChapterOutput) {
      const lt = f.lt;
      w3d = 1 - ramp(21, 23, lt);
      const t = lt; // displayed time drives the motion
      if (w3d > 0.001) {
        const p = positions(motion, t);
        const o = toW(p.O), h1 = toW(p.H1), h2 = toW(p.H2);
        O.position.copy(o); H1.position.copy(h1); H2.position.copy(h2);
        place(b1, o, h1); place(b2, o, h2);
        // time series: window [t − TWIN, t], newest at the right (x = +TWIN)
        const decomp = smooth(clamp((lt - 8) / 3));
        const side = smooth(clamp((lt - 12.5) / 2.5)) * (1 - smooth(clamp((lt - 17.5) / 2.5)));
        const sp = sumLine.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < NS; i++) {
          const tt = t - TWIN + (TWIN * i) / (NS - 1);
          sp[i * 3] = -TWIN + (2 * TWIN * i) / (NS - 1);
          sp[i * 3 + 1] = signal(motion, tt) * GAIN;
          sp[i * 3 + 2] = 0;
        }
        sumLine.geometry.attributes.position.needsUpdate = true;
        MODES.forEach((k, mi) => {
          const cp = comps[mi].geometry.attributes.position.array as Float32Array;
          const fd = hz(NU[k]) * motion.slow;
          for (let i = 0; i < NS; i++) {
            const tt = t - TWIN + (TWIN * i) / (NS - 1);
            cp[i * 3] = -TWIN + (2 * TWIN * i) / (NS - 1);
            cp[i * 3 + 1] = motion.amp[k] * modeVectors()[k].H1[0] * Math.cos(2 * Math.PI * fd * tt + motion.phase[k]) * GAIN;
            cp[i * 3 + 2] = -fd * ZF * decomp;
          }
          comps[mi].geometry.attributes.position.needsUpdate = true;
          (comps[mi].material as THREE.LineBasicMaterial).opacity = decomp * w3d;
        });
        (sumLine.material as THREE.LineBasicMaterial).opacity = w3d * (1 - 0.7 * side);
        (axes.material as THREE.LineBasicMaterial).opacity = 0.7 * w3d;
        // link from H1 to the newest signal sample
        const lp = link.geometry.attributes.position.array as Float32Array;
        const hw = molecule.localToWorld(h1.clone());
        for (let i = 0; i < NS; i++) { const u = i / (NS - 1); lp[i * 3] = hw.x + (TWIN - hw.x) * u; lp[i * 3 + 1] = hw.y + (signal(motion, t) * GAIN - hw.y) * u; lp[i * 3 + 2] = 0; }
        link.geometry.attributes.position.needsUpdate = true;
        (link.material as THREE.LineBasicMaterial).opacity = 0.35 * w3d * (1 - decomp);
        // camera: front → side (spectrum) → front ("and back")
        cam.aspect = f.aspect; cam.updateProjectionMatrix();
        const front = new THREE.Vector3(0.5, 3.5, 21), sidePos = new THREE.Vector3(24, 2.5, -4.2);
        cam.position.lerpVectors(front, sidePos, side);
        cam.lookAt(new THREE.Vector3(-0.5, 0.5, -1.5 * decomp).lerp(new THREE.Vector3(0, 0, -4.2), side));
        cam.updateMatrixWorld();
        molecule.visible = side < 0.6;
        // labels: spectral lines in cm⁻¹ when seen from the side
        if (side > 0.5) {
          MODES.forEach((k, mi) => {
            const pz = -hz(NU[k]) * motion.slow * ZF;
            const pp = projectToScreen(cam, new THREE.Vector3(TWIN, -2.6 - (mi === 2 ? 1.2 : 0), pz));
            out.labels.push({ x: pp.x, y: pp.y, text: `${NU[k]} cm⁻¹`, align: 'center', alpha: ramp(0.5, 0.9, side) * w3d, color: '#' + MODE_COL[k].toString(16).padStart(6, '0') });
          });
        }
        if (lt < 12 && decomp < 0.2) {
          const pp = projectToScreen(cam, molecule.position.clone().add(new THREE.Vector3(0, 3.2, 0)));
          out.labels.push({ x: pp.x, y: pp.y, text: 'H₂O (harmonic model, slowed ~10¹⁴×)', align: 'center', alpha: trap(0.5, 12, lt, 1, 1) });
        }
        const hear = trap(9, 16.5, lt, 1, 1);
        if (hear > 0.01) out.labels.push({ x: 0.95, y: 0.86, text: 'heard: the three mode frequencies, transposed down 37 octaves', align: 'right', alpha: hear * w3d, size: 0.92 });
      }
      // harmonic oscillator levels (2D)
      const hoA = trap(22, 34.5, lt, 1.2, 1.2);
      if (hoA > 0.01) out.draw.push((g, W, H, a0) => drawOscillator(new D2(g, W, H, a0 * hoA), lt));
      // chain normal modes (2D)
      const chA = trap(33.8, 46.5, lt, 1.2, 1.2);
      if (chA > 0.01) out.draw.push((g, W, H, a0) => drawChain(new D2(g, W, H, a0 * chA), lt, ctx.seed));
      // gas and coarse-graining (2D)
      const gA = ramp(45.8, 47.2, lt);
      if (gA > 0.01) out.draw.push((g, W, H, a0) => drawGas(new D2(g, W, H, a0 * gA), lt, gas));
      out.hud = lt < 22 ? { s: Math.log10(4e-10) } : { s: null, abstractLabel: lt < 46 ? 'schematic units' : 'ideal gas — schematic units' };
      out.post = { exposure: 1.0, bloom: 0.045, vignette: 0.3 };
    },
    render(r, target) {
      r.setRenderTarget(target);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      if (w3d > 0.001) r.render(scene, cam);
    },
    dispose() { scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose?.(); }); },
  };
}

// ── quantum harmonic oscillator ──
function hermite(n: number, x: number) { let h0 = 1, h1 = 2 * x; if (n === 0) return h0; for (let k = 1; k < n; k++) { const h2 = 2 * x * h1 - 2 * k * h0; h0 = h1; h1 = h2; } return h1; }
function psiHO(n: number, x: number) { let f = 1; for (let k = 2; k <= n; k++) f *= k; return (1 / Math.sqrt(Math.pow(2, n) * f)) * Math.pow(Math.PI, -0.25) * Math.exp(-x * x / 2) * hermite(n, x); }
function drawOscillator(d: D2, lt: number) {
  const box = { x: 0.22, y: 0.14, w: 0.56, h: 0.62 };
  const xr: [number, number] = [-4.2, 4.2], yr: [number, number] = [0, 6.4];
  const X = (x: number) => box.x + ((x - xr[0]) / (xr[1] - xr[0])) * box.w;
  const Y = (y: number) => box.y + box.h - ((y - yr[0]) / (yr[1] - yr[0])) * box.h;
  d.plot(box, xr, yr, (x) => 0.5 * x * x, '#8b857a', 1.5);
  for (let n = 0; n <= 5; n++) {
    const E = n + 0.5;
    const on = ramp(23 + n * 0.5, 23.6 + n * 0.5, lt);
    if (on <= 0) continue;
    const xm = Math.sqrt(2 * E);
    d.alpha(on);
    d.line([[X(-xm), Y(E)], [X(xm), Y(E)]], '#6f6a60', 1);
    d.plot(box, xr, yr, (x) => E + 0.55 * psiHO(n, x) ** 2 * 2.2, n % 2 ? '#8fb8ff' : '#ffc28f', 1.6);
    d.text(`n = ${n}`, X(4.0), Y(E) + 0.006, { size: 14, color: '#aaa394' });
    d.alpha(1);
  }
  d.text('energy levels of a quantum harmonic oscillator, with |ψₙ|²', box.x, box.y - 0.02, { size: 15, color: '#aaa394' });
}

// ── coupled chain: sum of standing waves ──
function drawChain(d: D2, lt: number, seed: number) {
  const N = 24, K = 5;
  const rng = new Rng(seed, 1501);
  const amps = Array.from({ length: K }, (_, k) => 0.9 / (k + 1) * rng.range(0.6, 1)), phs = Array.from({ length: K }, () => rng.range(0, 6.28));
  const om = (k: number) => 2 * Math.sin(((k + 1) * Math.PI) / (2 * (N + 1)));
  const t = lt * 2.2;
  const x0 = 0.18, x1 = 0.82;
  const row = (y: number, disp: (j: number) => number, color: string, label: string, r = 5) => {
    const pts: [number, number][] = [];
    for (let j = 0; j <= N + 1; j++) pts.push([x0 + ((x1 - x0) * j) / (N + 1), y - 0.035 * (j === 0 || j === N + 1 ? 0 : disp(j))]);
    d.line(pts, 'rgba(180,172,158,0.5)', 1);
    for (let j = 1; j <= N; j++) d.circle(pts[j][0], pts[j][1], r, color);
    d.text(label, x0 - 0.02, y + 0.006, { size: 14, align: 'right', color: '#aaa394' });
  };
  const sum = (j: number) => { let s = 0; for (let k = 0; k < K; k++) s += amps[k] * Math.sin((j * (k + 1) * Math.PI) / (N + 1)) * Math.cos(om(k) * t + phs[k]); return s; };
  row(0.2, sum, '#f2ebdd', 'the chain', 6);
  const sep = ramp(36, 38, lt);
  for (let k = 0; k < K; k++) {
    d.alpha(sep);
    row(0.36 + k * 0.1, (j) => amps[k] * Math.sin((j * (k + 1) * Math.PI) / (N + 1)) * Math.cos(om(k) * t + phs[k]), ['#8fb8ff', '#ffc28f', '#9fe0a0', '#e0a0e0', '#e0d890'][k], `mode ${k + 1}`, 4);
    d.alpha(1);
  }
  d.text('sum of the modes below = the chain above', 0.5, 0.12, { size: 16, align: 'center', color: '#bdb6a8', alpha: sep });
}

// ── ideal gas with a removable partition ──
interface Gas { N: number; ghosts: number; p: Float32Array; v: Float32Array }
const T0 = 48.5, GT = 0.55; // partition removed at lt = T0; display-time scale
function makeGas(seed: number): Gas {
  const N = 3000, ghosts = 16;
  const total = N * (ghosts + 1);
  const p = new Float32Array(total * 2), v = new Float32Array(total * 2);
  for (let s = 0; s <= ghosts; s++) {
    const rng = new Rng(seed, 1600 + s);
    for (let i = 0; i < N; i++) {
      const k = s * N + i;
      p[k * 2] = rng.float(); p[k * 2 + 1] = rng.float();
      const sp = 0.22 * Math.sqrt(-2 * Math.log(1 - rng.float())), a = rng.range(0, Math.PI * 2);
      v[k * 2] = sp * Math.cos(a); v[k * 2 + 1] = sp * Math.sin(a);
    }
  }
  return { N, ghosts, p, v };
}
const fold = (u: number, L: number) => { const m = ((u % (2 * L)) + 2 * L) % (2 * L); return m < L ? m : 2 * L - m; };
const dirOf = (u: number, L: number) => { const m = ((u % (2 * L)) + 2 * L) % (2 * L); return m < L ? 1 : -1; };
function gasPos(g: Gas, k: number, lt: number): [number, number] {
  const t = (lt - 46) * GT, t0 = (T0 - 46) * GT;
  const px = g.p[k * 2], py = g.p[k * 2 + 1], vx = g.v[k * 2], vy = g.v[k * 2 + 1];
  const y = fold(py + vy * t, 1);
  if (t <= t0) return [fold(px + vx * t, 1), y];
  const u0 = px + vx * t0;
  const x0 = fold(u0, 1), d0 = dirOf(u0, 1);
  return [fold(x0 + vx * d0 * (t - t0), 2), y];
}
function drawGas(d: D2, lt: number, gas: Gas) {
  const bx = 0.2, by = 0.2, bw = 0.6, bh = 0.3 * (16 / 9) * (0.6 / 0.6) * 0.95;
  const X = (x: number) => bx + (x / 2) * bw, Y = (y: number) => by + y * bh;
  const g = d.g;
  const gx = 8, gy = 4;
  const counts = new Float64Array(gx * gy);
  // ghosts: other microstates with the same macroscopic description
  const ghostA = trap(59.5, 71.5, lt, 2, 2.5);
  if (ghostA > 0.01) {
    g.fillStyle = `rgba(190,205,235,${0.09 * ghostA * d.a})`;
    for (let s = 1; s <= gas.ghosts; s++) for (let i = 0; i < gas.N; i += 2) {
      const [x, y] = gasPos(gas, s * gas.N + i, lt);
      g.fillRect(X(x) * d.W, Y(y) * d.H, 2.6 * d.u, 2.6 * d.u);
    }
  }
  const micro = 1 - 0.7 * ramp(66, 71, lt);
  g.fillStyle = `rgba(242,235,221,${0.85 * micro * d.a})`;
  for (let i = 0; i < gas.N; i++) {
    const [x, y] = gasPos(gas, i, lt);
    g.fillRect(X(x) * d.W - d.u, Y(y) * d.H - d.u, 2.2 * d.u, 2.2 * d.u);
    counts[Math.min(gy - 1, Math.floor(y * gy)) * gx + Math.min(gx - 1, Math.floor((x / 2) * gx))]++;
  }
  // macrostate: coarse-grained density as shaded cells
  const macro = ramp(64, 70, lt);
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
    const c = counts[j * gx + i] / (gas.N / (gx * gy));
    g.fillStyle = `rgba(255,205,150,${Math.min(0.55, 0.28 * c) * macro * d.a})`;
    g.fillRect(X((i / gx) * 2) * d.W, Y(j / gy) * d.H, (bw / gx) * d.W, (bh / gy) * d.H);
  }
  // box, grid, partition
  d.rect(bx, by, bw, bh, undefined, '#bdb6a8', 1.4);
  d.alpha(0.35);
  for (let i = 1; i < gx; i++) d.line([[X((i / gx) * 2), by], [X((i / gx) * 2), by + bh]], '#8b857a', 0.8, [3, 5]);
  for (let j = 1; j < gy; j++) d.line([[bx, Y(j / gy)], [bx + bw, Y(j / gy)]], '#8b857a', 0.8, [3, 5]);
  d.alpha(1);
  const part = 1 - ramp(T0 - 0.2, T0 + 0.4, lt);
  if (part > 0.01) { d.alpha(part); d.line([[X(1), by], [X(1), by + bh]], '#efe6d2', 3); d.alpha(1); }
  // entropy readouts: ln W for the coarse-grained cells, Shannon H of the cell distribution
  let lnW = lnGamma(gas.N + 1), H = 0;
  for (const n of counts) { lnW -= lnGamma(n + 1); if (n > 0) { const p = n / gas.N; H -= p * Math.log2(p); } }
  const ty = by + bh + 0.06;
  d.text(`microstates W consistent with these cell counts:  ln W = ${Math.round(lnW).toLocaleString('en-US')}`, bx, ty, { size: 17, color: '#efe6d2' });
  d.text(`Shannon entropy of the coarse description: ${H.toFixed(2)} bits per particle (max ${Math.log2(gx * gy).toFixed(0)})`, bx, ty + 0.04, { size: 16, color: '#bdb6a8' });
  if (ghostA > 0.05) d.text('faint: 16 other microstates — different in every detail, the same macrostate', bx, by - 0.025, { size: 15, color: '#c8d4ea', alpha: ghostA });
}

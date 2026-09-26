// Chapter 7 · Spacetime — point → line → square → cube → tesseract (4D, projected) → Minkowski
// spacetime with light cones, two observers' simultaneity slices and a Lorentz boost → twin clocks →
// the block-universe picture (an interpretation). Units: c = 1.
import * as THREE from 'three';
import type { ChapterInstance, ChapterOutput, EngineContext, Frame } from '../../engine/types';
import { ramp, clamp, trap, smooth } from '../../engine/ease';
import { projectToScreen } from '../util';
import { D2 } from '../draw2d';
import { registerTarget } from '../../engine/targets';
import { makeTarget } from '../../engine/particles';
import { registerRig, freeOrbit } from '../../engine/choreo';

const GLOW = 0xe9dfcc;

function dynLines(maxSeg: number, color: number, opacity = 1) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxSeg * 6), 3));
  g.setDrawRange(0, 0);
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthTest: false });
  const l = new THREE.LineSegments(g, m);
  l.frustumCulled = false;
  return { line: l, mat: m, arr: g.attributes.position.array as Float32Array, geo: g, n: 0 };
}
type DL = ReturnType<typeof dynLines>;
function begin(d: DL) { d.n = 0; }
function seg(d: DL, a: THREE.Vector3, b: THREE.Vector3) {
  if (d.n * 6 + 6 > d.arr.length) return;
  d.arr.set([a.x, a.y, a.z, b.x, b.y, b.z], d.n * 6); d.n++;
}
function end(d: DL) { d.geo.setDrawRange(0, d.n * 2); d.geo.attributes.position.needsUpdate = true; }
function polyline(d: DL, pts: THREE.Vector3[]) { for (let i = 1; i < pts.length; i++) seg(d, pts[i - 1], pts[i]); }

// tesseract vertices and edges
const TV: number[][] = [];
for (let i = 0; i < 16; i++) TV.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
const TE: [number, number][] = [];
for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) { const j = i ^ (1 << b); if (j > i) TE.push([i, j]); }
export { TV, TE };

/** Lorentz boost along x with velocity v applied to a spacetime point (x, y, t) */
export function boost(x: number, t: number, v: number): [number, number] {
  const g = 1 / Math.sqrt(1 - v * v);
  return [g * (x - v * t), g * (t - v * x)];
}

export default function create(ctx: EngineContext): ChapterInstance {
  const scene = new THREE.Scene();
  const main = dynLines(4000, GLOW);
  const dimA = dynLines(4000, 0x8d877c, 0.55);
  const warm = dynLines(3000, 0xffc98f);
  const cool = dynLines(3000, 0x9cc2ff);
  const planeA = dynLines(3000, 0xffc98f, 0.35);
  const planeB = dynLines(3000, 0x9cc2ff, 0.35);
  scene.add(main.line, dimA.line, warm.line, cool.line, planeA.line, planeB.line);
  // vertex dots
  const dotGeo = new THREE.BufferGeometry();
  const dotArr = new Float32Array(3 * 400);
  dotGeo.setAttribute('position', new THREE.BufferAttribute(dotArr, 3));
  const dotMat = new THREE.PointsMaterial({ color: 0xfff1da, size: 6, sizeAttenuation: false, transparent: true, blending: THREE.AdditiveBlending, depthTest: false });
  const dots = new THREE.Points(dotGeo, dotMat);
  dots.frustumCulled = false;
  scene.add(dots);
  // light cone surface
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const coneUp = new THREE.Mesh(new THREE.ConeGeometry(3, 3, 64, 1, true), coneMat);
  coneUp.rotation.x = Math.PI; coneUp.position.y = 1.5;
  const coneDown = new THREE.Mesh(new THREE.ConeGeometry(3, 3, 64, 1, true), coneMat);
  coneDown.position.y = -1.5;
  scene.add(coneUp, coneDown);
  const cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.05, 500);
  // register tesseract edges (sampled) as a particle target for Synthesis
  registerTarget('tesseract', makeTarget(16384, (i, d, o) => {
    const e = TE[i % TE.length], s = ((i * 0.618034) % 1);
    const a = TV[e[0]], b = TV[e[1]];
    const p = a.map((v, k) => v + (b[k] - v) * s);
    const k = 3 / (3 - p[3] * 0.8);
    d[o] = p[0] * k * 0.5; d[o + 1] = p[1] * k * 0.5; d[o + 2] = p[2] * k * 0.5; d[o + 3] = s;
  }), 'unit');
  registerRig('ch7.block', (lt) => ({ position: new THREE.Vector3(Math.sin(lt * 0.05) * 11, 5, Math.cos(lt * 0.05) * 11), target: new THREE.Vector3(0, 0, 0), up: new THREE.Vector3(0, 1, 0), fov: 38 }));

  let draw2d: ((g: CanvasRenderingContext2D, W: number, H: number, a: number) => void) | null = null;

  return {
    update(f: Frame, out: ChapterOutput) {
      const lt = f.lt;
      [main, dimA, warm, cool, planeA, planeB].forEach(begin);
      let nd = 0;
      const dot = (p: THREE.Vector3) => { if (nd < 400) { dotArr.set([p.x, p.y, p.z], nd * 3); nd++; } };
      coneMat.opacity = 0;
      draw2d = null;
      cam.aspect = f.aspect;
      const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

      if (lt < 26) {
        // ── dimensions ──
        const ex = smooth(clamp((lt - 3) / 2.5)), ey = smooth(clamp((lt - 6) / 2.5)), ez = smooth(clamp((lt - 9) / 2.5)), ew = smooth(clamp((lt - 12.5) / 2.5));
        const collapse = smooth(clamp((lt - 21) / 4));
        const ang1 = Math.max(0, lt - 14) * 0.45, ang2 = Math.max(0, lt - 14) * 0.29;
        const proj = (p: number[]) => {
          // scale by extrusion progress, rotate in xw and yz planes, project 4D → 3D
          let [x, y, z, w] = [p[0] * ex, p[1] * ey, p[2] * ez, p[3] * ew];
          const c1 = Math.cos(ang1), s1 = Math.sin(ang1), c2 = Math.cos(ang2), s2 = Math.sin(ang2);
          [x, w] = [c1 * x - s1 * w, s1 * x + c1 * w];
          [y, z] = [c2 * y - s2 * z, s2 * y + c2 * z];
          const k = 3 / (3 - w);
          return V(x * k, y * k, z * k).multiplyScalar(1 - 0.85 * collapse);
        };
        for (const [i, j] of TE) seg(main, proj(TV[i]), proj(TV[j]));
        for (const v of TV) dot(proj(v));
        main.mat.opacity = trap(0.5, 26, lt, 0.8, 1.5);
        dotMat.opacity = main.mat.opacity;
        const orbit = 0.4 + lt * 0.04;
        cam.fov = 38; cam.updateProjectionMatrix();
        cam.position.set(Math.sin(orbit) * 7.5, 2.5 + Math.sin(lt * 0.1), Math.cos(orbit) * 7.5);
        cam.lookAt(0, 0, 0); freeOrbit(cam, 0, 0, 0); cam.updateMatrixWorld();
        const lab = (t0: number, t1: number, s: string) => { const a = trap(t0, t1, lt, 0.5, 0.5); if (a > 0.01) out.labels.push({ x: 0.5, y: 0.82, text: s, align: 'center', alpha: a, size: 1.15 }); };
        lab(1, 3.4, 'a point: 0 dimensions');
        lab(3.4, 6.2, 'a line: 1');
        lab(6.2, 9.2, 'a square: 2');
        lab(9.2, 12.4, 'a cube: 3');
        lab(12.6, 20.5, 'a tesseract: 4 — what you see is its 3D shadow, rotating in four dimensions');
        out.hud = { s: null, abstractLabel: 'Euclidean space — 4D projected to 3D' };
      } else if (lt < 58.5) {
        // ── Minkowski spacetime, 2+1 D: x right, y depth, t up ──
        const appear = smooth(clamp((lt - 25.5) / 2.5));
        const vB = 0.6 * smooth(clamp((lt - 34.5) / 5)); // observer B's velocity
        const boostK = smooth(clamp((lt - 45) / 6)) * (1 - smooth(clamp((lt - 55) / 3))); // view from B's frame
        const vView = 0.6 * boostK;
        const T = (x: number, y: number, t: number) => { const [xb, tb] = boost(x, t, vView); return V(xb, tb, y); };
        // axes
        seg(dimA, T(-4, 0, 0), T(4, 0, 0)); seg(dimA, T(0, 0, -3.2), T(0, 0, 3.2));
        // light cone lines
        coneMat.opacity = 0.022 * appear;
        for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; seg(dimA, T(-3 * Math.cos(a), -3 * Math.sin(a), -3), T(3 * Math.cos(a), 3 * Math.sin(a), 3)); }
        // worldlines: clocks at rest (A's frame) and moving objects
        for (const x0 of [-3, -1.5, 1.5, 3]) {
          const pts: THREE.Vector3[] = [];
          for (let t = -3.2; t <= 3.21; t += 0.2) pts.push(T(x0, 0.6 * Math.sign(x0), t));
          polyline(main, pts);
          for (let t = -3; t <= 3; t += 1) dot(T(x0, 0.6 * Math.sign(x0), t));
        }
        // observer B's worldline (x = vB t)
        const pb: THREE.Vector3[] = [];
        for (let t = -3.2; t <= 3.21; t += 0.2) pb.push(T(vB * t, 0, t));
        polyline(cool, pb);
        const pa: THREE.Vector3[] = [];
        for (let t = -3.2; t <= 3.21; t += 0.2) pa.push(T(0, 0, t));
        polyline(warm, pa);
        // simultaneity slices: A: t = c; B: t − vB x = c (lines on the x–y sheet drawn as grids)
        const sliceA = ramp(30, 32, lt), sliceB = ramp(34.5, 36.5, lt);
        planeA.mat.opacity = 0.32 * sliceA; planeB.mat.opacity = 0.32 * sliceB;
        for (const c of [-1.5, 0, 1.5]) {
          for (let k = 0; k <= 4; k++) {
            const y = -1.6 + (3.2 * k) / 4;
            seg(planeA, T(-3.2, y, c), T(3.2, y, c));
            const tb = (x: number) => (c * Math.sqrt(1 - vB * vB)) + vB * x; // B-slice t = γ⁻¹c + v x
            seg(planeB, T(-3.2, y, tb(-3.2)), T(3.2, y, tb(3.2)));
          }
        }
        // invariant hyperbolae t² − x² = τ² (y = 0)
        const hypA = ramp(45, 47, lt);
        dimA.mat.opacity = 0.55;
        if (hypA > 0) for (const tau of [1, 2]) {
          const hp: THREE.Vector3[] = [];
          for (let s = -1.6; s <= 1.61; s += 0.08) hp.push(T(tau * Math.sinh(s), 0, tau * Math.cosh(s)));
          polyline(warm, hp);
        }
        // two events simultaneous for A (t = 1 at x = −1.5 and x = +1.5), marked
        const ev1 = T(-1.5, -0.6, 1), ev2 = T(1.5, 0.6, 1);
        dot(ev1); dot(ev2);
        main.mat.opacity = appear; warm.mat.opacity = appear; cool.mat.opacity = appear; dotMat.opacity = appear;
        const orbit = -0.55 + (lt - 26) * 0.012;
        cam.fov = 40; cam.updateProjectionMatrix();
        cam.position.set(Math.sin(orbit) * 16.5, 3.6, Math.cos(orbit) * 16.5);
        cam.lookAt(0, 0.3, 0); freeOrbit(cam, 0, 0.3, 0); cam.updateMatrixWorld();
        const e1 = projectToScreen(cam, ev1), e2 = projectToScreen(cam, ev2);
        const la = trap(37, 57, lt, 1, 1.5);
        if (la > 0.01) {
          out.labels.push({ x: e1.x - 0.02, y: e1.y - 0.04, text: 'event P', align: 'right', alpha: la });
          out.labels.push({ x: e2.x + 0.02, y: e2.y - 0.04, text: 'event Q', alpha: la });
          const [, tP] = boost(-1.5, 1, vB), [, tQ] = boost(1.5, 1, vB);
          out.labels.push({ x: 0.05, y: 0.17, text: `observer A (warm): P and Q at the same time\nobserver B (cool, moving at ${vB.toFixed(2)} c): Q is ${(tP - tQ).toFixed(2)} time units before P`, alpha: la, size: 1.05 });
        }
        const lc = trap(27.5, 34, lt, 0.8, 0.8);
        if (lc > 0.01) { const p = projectToScreen(cam, T(2.2, 0, 2.2)); out.labels.push({ x: p.x + 0.03, y: p.y, text: 'light cone (45°: c = 1)', alpha: lc }); }
        if (boostK > 0.3) out.labels.push({ x: 0.95, y: 0.24, text: 'the same diagram, seen from B’s frame: events slide along the invariant hyperbolae', align: 'right', alpha: boostK, size: 0.95 });
        out.hud = { s: null, abstractLabel: 'spacetime diagram — units with c = 1' };
      } else if (lt < 79) {
        // ── twin clocks: drawn flat, face-on ──
        const a = trap(58.5, 79.5, lt, 1.2, 1.5);
        const prog = clamp((lt - 60) / 12);
        draw2d = (g, W, H, a0) => drawTwins(new D2(g, W, H, a0 * a), prog);
        cam.position.set(0, 0, 10); cam.lookAt(0, 0, 0); freeOrbit(cam, 0, 0, 0); cam.updateMatrixWorld();
        out.hud = { s: null, abstractLabel: 'spacetime diagram — units with c = 1' };
      } else {
        // ── block universe: worldlines as a static sculpture; slices of two observers sweep ──
        const appear = smooth(clamp((lt - 78.5) / 2.5));
        const Hh = 6;
        const pts: THREE.Vector3[] = [];
        for (let t = -Hh; t <= Hh; t += 0.25) pts.push(V(0, t, 0));
        polyline(warm, pts); // "Sun" at rest
        const earth: THREE.Vector3[] = [], moon: THREE.Vector3[] = [];
        for (let t = -Hh; t <= Hh + 0.001; t += 0.02) {
          const ex2 = 2.4 * Math.cos(t * 1.3), ez2 = 2.4 * Math.sin(t * 1.3);
          earth.push(V(ex2, t, ez2));
          moon.push(V(ex2 + 0.45 * Math.cos(t * 9), t, ez2 + 0.45 * Math.sin(t * 9)));
        }
        polyline(cool, earth); void moon;
        for (let k = 0; k < 16; k++) {
          const r = 3.6 + (k % 5) * 0.45, a0 = k * 2.39;
          const vx = 0.12 * Math.sin(k * 1.7), vz = 0.12 * Math.cos(k * 1.3);
          const q: THREE.Vector3[] = [];
          for (let t = -Hh; t <= Hh + 0.001; t += 0.5) q.push(V(r * Math.cos(a0) + vx * t, t, r * Math.sin(a0) + vz * t));
          polyline(dimA, q);
        }
        const sweep = -Hh + 1 + ((lt - 80) * 0.45) % (2 * Hh - 2);
        const vS = 0.45;
        for (let k = 0; k <= 8; k++) {
          const z = -4 + k;
          seg(planeA, V(-4.5, sweep, z), V(4.5, sweep, z));
          seg(planeB, V(-4.5, sweep - vS * 4.5, z), V(4.5, sweep + vS * 4.5, z));
        }
        planeA.mat.opacity = 0.4 * appear; planeB.mat.opacity = 0.4 * appear * ramp(84, 86, lt);
        main.mat.opacity = 0.9 * appear; warm.mat.opacity = appear; cool.mat.opacity = appear; dimA.mat.opacity = 0.45 * appear;
        dotMat.opacity = 0;
        const orbit = 0.3 + (lt - 79) * 0.03;
        cam.fov = 40; cam.updateProjectionMatrix();
        cam.position.set(Math.sin(orbit) * 19, 4.5, Math.cos(orbit) * 19);
        cam.lookAt(0, 0, 0); freeOrbit(cam, 0, 0, 0); cam.updateMatrixWorld();
        const ln = trap(80, 90, lt, 1, 1);
        if (ln > 0.01) {
          const p = projectToScreen(cam, earth[Math.floor(earth.length * 0.7)]);
          out.labels.push({ x: p.x + 0.03, y: p.y, text: 'Earth’s worldline: a helix around the Sun’s (schematic)', alpha: ln });
        }
        out.labels.push({ x: 0.95, y: 0.86, text: 'warm: one observer’s “now”   ·   cool: another’s', align: 'right', alpha: ramp(85, 87, lt) * (1 - ramp(100, 102, lt)), size: 0.95 });
        out.hud = { s: null, abstractLabel: 'spacetime block — schematic, c = 1' };
      }
      [main, dimA, warm, cool, planeA, planeB].forEach(end);
      dotGeo.setDrawRange(0, nd);
      dotGeo.attributes.position.needsUpdate = true;
      if (draw2d) out.draw.push(draw2d);
      out.post = { exposure: 1.0, bloom: 0.07, vignette: 0.32 };
    },
    render(r, target) {
      r.setRenderTarget(target);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      r.render(scene, cam);
    },
    dispose() { scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose?.(); }); },
  };
}

function drawTwins(d: D2, prog: number) {
  // spacetime diagram: x horizontal (light-years), t vertical (years); v = 0.8, γ = 5/3
  const ox = 0.36, oy = 0.86, sx = 0.075, sy = 0.07;
  const P = (x: number, t: number): [number, number] => [ox + x * sx, oy - t * sy];
  d.line([P(-0.5, 0), P(5, 0)], '#6f6a60', 1);
  d.line([P(0, 0), P(0, 10.6)], '#6f6a60', 1);
  d.text('space (light-years)', P(5, 0)[0], P(5, 0)[1] + 0.035, { size: 14, align: 'right', color: '#8b857a' });
  d.text('time (years)', P(0, 10.6)[0] - 0.01, P(0, 10.6)[1], { size: 14, align: 'right', color: '#8b857a' });
  // light cone lines from the start
  d.line([P(0, 0), P(5, 5)], 'rgba(255,226,176,0.35)', 1, [5, 6]);
  const tNow = prog * 10;
  d.line([P(0, 0), P(0, tNow)], '#ffc98f', 2.4);
  const tr = (t: number): [number, number] => (t <= 5 ? P(0.8 * t, t) : P(0.8 * (10 - t), t));
  d.line([P(0, 0), tr(Math.min(tNow, 5)), ...(tNow > 5 ? [tr(tNow)] : [])], '#9cc2ff', 2.4);
  // ticks every 0.5 year of proper time: home at t = 0.5k; traveller at t = 0.5k·γ
  const g = 5 / 3;
  for (let k = 1; k <= 20; k++) { const t = 0.5 * k; if (t > tNow) break; const [x, y] = P(0, t); d.line([[x - 0.008, y], [x + 0.008, y]], '#ffc98f', 2); }
  for (let k = 1; k <= 12; k++) { const t = 0.5 * k * g; if (t > tNow) break; const [x, y] = tr(t); d.line([[x - 0.008, y], [x + 0.008, y]], '#9cc2ff', 2); }
  const home = Math.min(tNow, 10), trav = Math.min(tNow, 10) / g;
  d.text(`stay-at-home clock: ${home.toFixed(1)} years`, 0.62, 0.3, { size: 20, color: '#ffc98f' });
  d.text(`traveller at 0.8 c: ${trav.toFixed(1)} years`, 0.62, 0.36, { size: 20, color: '#9cc2ff' });
  d.text('ticks mark equal proper time (0.5 year)', 0.62, 0.42, { size: 15, color: '#aaa394' });
  if (prog >= 1) d.text('the straight worldline between two events is the longest in proper time', 0.62, 0.48, { size: 15, color: '#e4ddcf' });
}

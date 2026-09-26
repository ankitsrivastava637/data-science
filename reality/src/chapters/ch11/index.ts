// Chapter 11 · Frontier — five speculative ideas drawn so that they look unfinished: stippled,
// incomplete, dissolving. Inflation's stretching grid, bubble nucleation, a string "landscape",
// quantum-gravity candidates (spin network, strings) with a graph condensing into a surface, and a
// Calabi–Yau cross-section (Hanson's Fermat quintic — real mathematics, speculative physics).
// All geometry is built once; per frame only uniforms and a few thousand CPU points change.
import * as THREE from 'three';
import type { ChapterInstance, ChapterOutput, EngineContext, Frame } from '../../engine/types';
import { ramp, clamp, smooth } from '../../engine/ease';
import { projectToScreen, setCam } from '../util';
import { Rng } from '../../engine/prng';
import { COMMON } from '../../shaders/common';

/** beat windows (local seconds) */
export const BEATS = {
  inflation: [0, 5.6],
  bubbles: [5.0, 10.2],
  landscape: [9.6, 14.9],
  quantumGravity: [14.3, 20.6],
  calabiYau: [20.0, 25.0],
} as const;
const H_INF = 0.62; // e-folds per second of screen time (schematic)
const R_HUBBLE = 0.36; // fixed physical Hubble radius during inflation (scene units)

const GHOST_VERT = /* glsl */ `
in float aSeed; in vec3 aCol; in vec4 aP;
uniform float uT; uniform float uW; uniform float uReveal; uniform float uProj; uniform float uSize; uniform float uMask; uniform float uAlpha4;
out vec3 vC; out float vA;
${COMMON}
void main(){
  vec3 p = position;
  float born = 1.0;
#if MODE == 1
  // inflation: physical = comoving × e^{H (t − birth)}; aP.x = birth time
  float age = uT - aP.x;
  born = smoothstep(0.0, 0.25, age);
  p.xy = position.xy * exp(${H_INF.toFixed(3)} * max(age, 0.0));
#elif MODE == 2
  // bubble wall: centre aP.xyz, birth aP.w, unit direction in position
  float age = uT - aP.w;
  float rad = 0.3 * max(age, 0.0);
  born = smoothstep(0.0, 0.15, age) * clamp(rad * rad / 0.25, 0.04, 1.0); // a seed, not a flash
  p = aP.xyz + position * rad;
#elif MODE == 3
  // Calabi–Yau: position = (Re z1, Re z2, Im z1), aP.x = Im z2; rotate within the (Im z1, Im z2) plane
  p = vec3(position.x, position.y, cos(uAlpha4) * position.z + sin(uAlpha4) * aP.x) * 1.3;
#endif
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = uSize * uProj / max(1e-3, -mv.z);
  gl_PointSize = clamp(px, 1.0, 3.2);
  // incompleteness: a slowly drifting spatial mask decides which stipples are drawn at all
  float m = vnoise3(p * uMask + vec3(0.0, 0.0, uT * 0.06));
  float thr = uReveal * (0.42 + 1.1 * m);
  vA = born * uW * smoothstep(aSeed - 0.07, aSeed + 0.07, thr) * min(1.0, px);
  vC = aCol;
}`;
const GHOST_FRAG_POINTS = /* glsl */ `precision highp float; in vec3 vC; in float vA; out vec4 o;
void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard; o = vec4(vC * vA * (1.0 - r2), 1.0); }`;
const GHOST_FRAG_LINES = /* glsl */ `precision highp float; in vec3 vC; in float vA; out vec4 o;
void main(){ o = vec4(vC * vA, 1.0); }`;

function ghostMat(mode: number, lines: boolean, size = 0.02, mask = 1.3) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    defines: { MODE: mode },
    vertexShader: GHOST_VERT,
    fragmentShader: lines ? GHOST_FRAG_LINES : GHOST_FRAG_POINTS,
    uniforms: { uT: { value: 0 }, uW: { value: 1 }, uReveal: { value: 1 }, uProj: { value: 600 }, uSize: { value: size }, uMask: { value: mask }, uAlpha4: { value: 0 } },
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

/** growable stipple buffer: position, seed, colour, params */
class Stip {
  pos: number[] = []; seed: number[] = []; col: number[] = []; p4: number[] = [];
  constructor(private rng: Rng) {}
  add(x: number, y: number, z: number, c: [number, number, number], p: [number, number, number, number] = [0, 0, 0, 0], seed?: number) {
    this.pos.push(x, y, z); this.seed.push(seed ?? this.rng.float()); this.col.push(...c); this.p4.push(...p);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(this.seed), 1));
    g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(this.col), 3));
    g.setAttribute('aP', new THREE.BufferAttribute(new Float32Array(this.p4), 4));
    return g;
  }
}

const WARM: [number, number, number] = [0.62, 0.58, 0.52];
const VIOLET: [number, number, number] = [0.6, 0.44, 0.56];
const COOL: [number, number, number] = [0.42, 0.5, 0.64];
const scaleC = (c: [number, number, number], k: number): [number, number, number] => [c[0] * k, c[1] * k, c[2] * k];

/** the landscape potential (schematic): many local minima on a gentle bowl */
export function landscapeV(x: number, z: number) {
  return 0.42 * Math.sin(1.3 * x + 0.4) * Math.cos(1.1 * z) + 0.24 * Math.sin(2.7 * x - 1.9 * z + 1.0) + 0.14 * Math.cos(3.9 * x + 2.3 * z) + 0.035 * (x * x + z * z);
}

/** Hanson's parametrisation of the Fermat quintic z1^n + z2^n = 1 (n = 5): patch (k1, k2), point (ξ, θ).
 *  Returns [Re z1, Re z2, Im z1, Im z2]. */
export function fermatPoint(n: number, k1: number, k2: number, xi: number, th: number): [number, number, number, number] {
  // cosh(ξ + iθ) and −i·sinh(ξ + iθ); both have non-negative real part for θ ∈ [0, π/2]
  const cr = Math.cosh(xi) * Math.cos(th), ci = Math.sinh(xi) * Math.sin(th);
  const sr = Math.cosh(xi) * Math.sin(th), si = -Math.sinh(xi) * Math.cos(th);
  const pw = (re: number, im: number, p: number): [number, number] => { const r = Math.pow(Math.hypot(re, im), p), a = Math.atan2(im, re) * p; return [r * Math.cos(a), r * Math.sin(a)]; };
  const [u1r, u1i] = pw(cr, ci, 2 / n), [u2r, u2i] = pw(sr, si, 2 / n);
  const a1 = (2 * Math.PI * k1) / n, a2 = (2 * Math.PI * k2) / n;
  return [u1r * Math.cos(a1) - u1i * Math.sin(a1), u2r * Math.cos(a2) - u2i * Math.sin(a2), u1r * Math.sin(a1) + u1i * Math.cos(a1), u2r * Math.sin(a2) + u2i * Math.cos(a2)];
}

/** camera azimuth when the graph has condensed (lt ≈ 19): the sheet is built to face it */
const SHEET_FACING = 0.35 + 19 * 0.07;
/** triangulated sheet graph used for the spin network → surface condensation */
export function sheetGraph(n: number, seed: number) {
  const rng = new Rng(seed, 3101);
  const nodes: { cloud: THREE.Vector3; sheet: THREE.Vector3 }[] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = ((i + 0.5 * (j & 1)) / (n - 1) - 0.5) * 3.6, z = (j / (n - 1) - 0.5) * 3.1;
    const r = 2.1 * Math.cbrt(rng.float()), th = Math.acos(2 * rng.float() - 1), ph = rng.range(0, Math.PI * 2);
    nodes.push({ cloud: new THREE.Vector3(r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)), sheet: new THREE.Vector3(x, 0.35 * Math.sin(x * 0.9) * Math.cos(z * 0.8), z).applyAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 - 0.95).add(new THREE.Vector3(0, 0.25, 0)).applyAxisAngle(new THREE.Vector3(0, 1, 0), SHEET_FACING) });
  }
  const edges: [number, number][] = [];
  const id = (i: number, j: number) => j * n + i;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (i + 1 < n) edges.push([id(i, j), id(i + 1, j)]);
    if (j + 1 < n) edges.push([id(i, j), id(i, j + 1)]);
    if (j + 1 < n) { const i2 = j & 1 ? i + 1 : i - 1; if (i2 >= 0 && i2 < n) edges.push([id(i, j), id(i2, j + 1)]); }
  }
  return { nodes, edges };
}

export default function create(ctx: EngineContext): ChapterInstance {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 200);
  const rng = new Rng(ctx.seed, 3001);
  const mats: THREE.ShaderMaterial[] = [];
  const add = (obj: THREE.Object3D, m: THREE.ShaderMaterial) => { mats.push(m); obj.frustumCulled = false; return obj; };

  // ── 1 · inflation: comoving grid and horizon-crossing fluctuations, in a camera-facing plane ──
  const infl = new THREE.Group(); scene.add(infl);
  const inflMatL = ghostMat(1, true, 0.02, 2.2), inflMatP = ghostMat(1, false, 0.022, 2.2), hubMat = ghostMat(0, false, 0.02, 3.0);
  {
    // grid lines, spacing 0.07 at t = 0, split into short dashes that dither independently
    const L = new Stip(rng);
    const g0 = 0.13, N = 40, span = N * g0, dash = span / 90;
    for (let k = -N; k <= N; k++) for (let s = -90; s < 90; s++) {
      const a = s * dash, b = a + dash * 0.8, c = k * g0;
      const sd = rng.float(), col = scaleC(k === 0 ? WARM : COOL, k % 5 === 0 ? 0.55 : 0.3);
      L.add(a, c, 0, col, [0, 0, 0, 0], sd); L.add(b, c, 0, col, [0, 0, 0, 0], sd);
      L.add(c, a, 0, col, [0, 0, 0, 0], sd); L.add(c, b, 0, col, [0, 0, 0, 0], sd);
    }
    infl.add(add(new THREE.LineSegments(L.geometry(), inflMatL), inflMatL));
    // fluctuations: born at the (fixed) Hubble scale, then stretched with everything else
    const P = new Stip(rng);
    for (let i = 0; i < 80; i++) {
      const tb = 0.15 + 4.6 * (i / 80) + rng.range(-0.05, 0.05);
      const cx = rng.range(-3.9, 3.9), cy = rng.range(-2.2, 2.2);
      const r = R_HUBBLE * rng.range(0.85, 1.15);
      const col = scaleC(rng.float() < 0.5 ? VIOLET : WARM, 0.9);
      for (let k = 0; k < 90; k++) { const a = (k / 90) * Math.PI * 2 + rng.range(-0.02, 0.02); P.add(cx + r * Math.cos(a), cy + r * Math.sin(a), 0, col, [tb, 0, 0, 0]); }
    }
    infl.add(add(new THREE.Points(P.geometry(), inflMatP), inflMatP));
    // the Hubble radius: fixed physical size
    const Hs = new Stip(rng);
    for (let k = 0; k < 260; k++) { const a = (k / 260) * Math.PI * 2; if (Math.floor(k / 6) % 2) continue; Hs.add(R_HUBBLE * Math.cos(a), R_HUBBLE * Math.sin(a), 0, [0.9, 0.84, 0.74]); }
    infl.add(add(new THREE.Points(Hs.geometry(), hubMat), hubMat));
  }

  // ── 2 · bubbles in an eternally inflating false vacuum ──
  const bub = new THREE.Group(); scene.add(bub);
  const bubMat = ghostMat(2, false, 0.02, 1.6), vacMat = ghostMat(0, false, 0.016, 1.0);
  const bubbles: { c: THREE.Vector3; tb: number }[] = [];
  {
    const B = new Stip(rng);
    for (let i = 0; i < 15; i++) {
      const tb = BEATS.bubbles[0] + 0.1 + 3.6 * (i / 15) + rng.range(0, 0.25);
      const c = new THREE.Vector3(rng.normal(), rng.normal() * 0.55, rng.normal()).multiplyScalar(1.7);
      bubbles.push({ c, tb });
      const cap = new THREE.Vector3(rng.normal(), rng.normal(), rng.normal()).normalize();
      const capCos = Math.cos(rng.range(0.6, 1.3));
      const col = scaleC(i % 3 === 0 ? VIOLET : i % 3 === 1 ? COOL : WARM, 0.8);
      let k = 0;
      while (k < 1400) {
        const d = new THREE.Vector3(rng.normal(), rng.normal(), rng.normal()).normalize();
        if (d.dot(cap) > capCos) continue; // an open, unfinished wall
        B.add(d.x, d.y, d.z, col, [c.x, c.y, c.z, tb]); k++;
      }
    }
    bub.add(add(new THREE.Points(B.geometry(), bubMat), bubMat));
    const V = new Stip(rng);
    for (let i = 0; i < 9000; i++) V.add(rng.range(-4, 4), rng.range(-2.5, 2.5), rng.range(-4, 4), scaleC(WARM, 0.22));
    bub.add(add(new THREE.Points(V.geometry(), vacMat), vacMat));
  }

  // ── 3 · the landscape: a partially drawn potential surface with many valleys ──
  const land = new THREE.Group(); scene.add(land);
  const landMat = ghostMat(0, true, 0.02, 0.9), minMat = ghostMat(0, false, 0.03, 2.0);
  const minima: THREE.Vector3[] = [];
  {
    const L = new Stip(rng);
    const R = 4.2, n = 44, m = 120;
    for (let a = 0; a <= n; a++) {
      const u = (a / n - 0.5) * 2 * R;
      for (let b = 0; b < m; b++) {
        const v0 = (b / m - 0.5) * 2 * R, v1 = ((b + 1) / m - 0.5) * 2 * R;
        const fall = (x: number, z: number) => clamp(1.25 - Math.hypot(x, z) / R);
        const sd = rng.float();
        const c0 = scaleC(WARM, 0.36 * fall(u, v0)), c1 = scaleC(WARM, 0.36 * fall(u, v1));
        L.add(u, landscapeV(u, v0), v0, c0, [0, 0, 0, 0], sd); L.add(u, landscapeV(u, v1), v1, c1, [0, 0, 0, 0], sd);
        const sd2 = rng.float();
        const d0 = scaleC(COOL, 0.3 * fall(v0, u)), d1 = scaleC(COOL, 0.3 * fall(v1, u));
        L.add(v0, landscapeV(v0, u), u, d0, [0, 0, 0, 0], sd2); L.add(v1, landscapeV(v1, u), u, d1, [0, 0, 0, 0], sd2);
      }
    }
    land.add(add(new THREE.LineSegments(L.geometry(), landMat), landMat));
    // local minima on a fine grid
    const G = 90, h = (2 * 3.4) / G;
    for (let j = 1; j < G; j++) for (let i = 1; i < G; i++) {
      const x = -3.4 + i * h, z = -3.4 + j * h, v = landscapeV(x, z);
      let isMin = true;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) if (landscapeV(x + dx * h, z + dz * h) <= v) { isMin = false; break; }
      if (isMin) minima.push(new THREE.Vector3(x, v, z));
    }
    const Mn = new Stip(rng);
    for (const p of minima) for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2; Mn.add(p.x + 0.12 * Math.cos(a), p.y + 0.02, p.z + 0.12 * Math.sin(a), VIOLET); }
    land.add(add(new THREE.Points(Mn.geometry(), minMat), minMat));
  }

  // ── 4 · quantum-gravity candidates: spin network → surface; strings ──
  const qg = new THREE.Group(); scene.add(qg);
  const graph = sheetGraph(8, ctx.seed);
  const EDGE_PTS = 36, NODE_PTS = 1;
  const gCount = graph.edges.length * EDGE_PTS + graph.nodes.length * NODE_PTS;
  const gGeo = new THREE.BufferGeometry();
  const gPos = new Float32Array(gCount * 3), gSeed = new Float32Array(gCount), gCol = new Float32Array(gCount * 3);
  for (let i = 0; i < gCount; i++) { gSeed[i] = rng.float(); }
  gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  gGeo.setAttribute('aSeed', new THREE.BufferAttribute(gSeed, 1));
  gGeo.setAttribute('aCol', new THREE.BufferAttribute(gCol, 3));
  gGeo.setAttribute('aP', new THREE.BufferAttribute(new Float32Array(gCount * 4), 4));
  const gMat = ghostMat(0, false, 0.024, 1.1);
  qg.add(add(new THREE.Points(gGeo, gMat), gMat));
  const nodeGeo = new THREE.BufferGeometry();
  const nPos = new Float32Array(graph.nodes.length * 3);
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
  nodeGeo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(graph.nodes.length).fill(0.2), 1));
  nodeGeo.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(graph.nodes.length * 3).fill(0.6), 3));
  nodeGeo.setAttribute('aP', new THREE.BufferAttribute(new Float32Array(graph.nodes.length * 4), 4));
  const nodeMat = ghostMat(0, false, 0.045, 0.5);
  qg.add(add(new THREE.Points(nodeGeo, nodeMat), nodeMat));
  // strings: three closed loops and two open strings, oscillating in low normal modes
  const STR_PTS = 260;
  const strings = [
    { c: new THREE.Vector3(2.5, 0.9, -0.4), R: 0.3, open: false, n: 2, w: 1.7, tilt: 0.5 },
    { c: new THREE.Vector3(2.8, -0.2, 0.5), R: 0.22, open: false, n: 3, w: 2.3, tilt: 1.1 },
    { c: new THREE.Vector3(2.3, -1.0, -0.1), R: 0.18, open: false, n: 4, w: 2.9, tilt: 2.0 },
    { c: new THREE.Vector3(-2.5, 0.9, 0.3), R: 0.34, open: true, n: 1, w: 1.4, tilt: 0.3 },
    { c: new THREE.Vector3(-2.7, -0.7, -0.2), R: 0.3, open: true, n: 2, w: 2.0, tilt: 1.4 },
  ];
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(strings.length * STR_PTS * 3);
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(strings.length * STR_PTS).map(() => rng.float() * 0.8), 1));
  sGeo.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(strings.length * STR_PTS * 3).map((_, i) => [0.55, 0.42, 0.52][i % 3]), 3));
  sGeo.setAttribute('aP', new THREE.BufferAttribute(new Float32Array(strings.length * STR_PTS * 4), 4));
  const sMat = ghostMat(0, false, 0.02, 1.5);
  qg.add(add(new THREE.Points(sGeo, sMat), sMat));

  // ── 5 · Calabi–Yau cross-section (Fermat quintic, n = 5; 25 patches) ──
  const cy = new THREE.Group(); scene.add(cy);
  const cyMat = ghostMat(3, false, 0.016, 1.8);
  {
    const n = 5, C = new Stip(rng);
    const tints: [number, number, number][] = [[0.66, 0.58, 0.5], [0.6, 0.46, 0.58], [0.46, 0.52, 0.66], [0.62, 0.62, 0.62], [0.55, 0.6, 0.52]];
    const XI = 1.15, nx = 14, nt = 9, sp = 44;
    for (let k1 = 0; k1 < n; k1++) for (let k2 = 0; k2 < n; k2++) {
      const col = scaleC(tints[k1], 0.75);
      for (let a = 0; a <= nx; a++) for (let s = 0; s <= sp; s++) { // lines of constant ξ
        const xi = -XI + (2 * XI * a) / nx, th = (Math.PI / 2) * (s / sp);
        const [x, y, z, w] = fermatPoint(n, k1, k2, xi, th); C.add(x, y, z, col, [w, 0, 0, 0]);
      }
      for (let b = 0; b <= nt; b++) for (let s = 0; s <= sp; s++) { // lines of constant θ
        const th = (Math.PI / 2) * (b / nt), xi = -XI + (2 * XI * s) / sp;
        const [x, y, z, w] = fermatPoint(n, k1, k2, xi, th); C.add(x, y, z, col, [w, 0, 0, 0]);
      }
    }
    cy.add(add(new THREE.Points(C.geometry(), cyMat), cyMat));
  }

  const beatW = (b: readonly [number, number], lt: number, fi = 0.9, fo = 0.9) => Math.min(b[0] <= 0 ? 1 : ramp(b[0], b[0] + fi, lt), 1 - ramp(b[1] - fo, b[1], lt));
  const reveal = (b: readonly [number, number], lt: number) => 0.15 + 0.85 * ramp(b[0], b[0] + 1.4, lt) - 0.5 * ramp(b[1] - 1.2, b[1], lt);
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  let proj = 600;

  return {
    update(f: Frame, out: ChapterOutput) {
      const lt = f.lt;
      proj = f.height / (2 * Math.tan((40 * Math.PI) / 360));
      // slow orbit; the inflation plane always faces the camera
      const az = 0.35 + lt * 0.07, el = 0.28 + 0.1 * Math.sin(lt * 0.21), R = 7.2;
      setCam(cam, new THREE.Vector3(R * Math.cos(el) * Math.sin(az), R * Math.sin(el), R * Math.cos(el) * Math.cos(az)), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 40, f.aspect, 0.05, 200);
      infl.quaternion.copy(cam.quaternion);
      const wI = beatW(BEATS.inflation, lt), wB = beatW(BEATS.bubbles, lt), wL = beatW(BEATS.landscape, lt), wQ = beatW(BEATS.quantumGravity, lt), wC = beatW(BEATS.calabiYau, lt, 0.9, 0.001);
      const set = (m: THREE.ShaderMaterial, w: number, rv: number, extra: (u: Record<string, THREE.IUniform>) => void = () => {}) => { const u = m.uniforms; u.uT.value = lt; u.uW.value = w; u.uReveal.value = rv; u.uProj.value = proj; extra(u); };
      infl.visible = wI > 0.001; bub.visible = wB > 0.001; land.visible = wL > 0.001; qg.visible = wQ > 0.001; cy.visible = wC > 0.001;
      const rI = reveal(BEATS.inflation, lt) + 0.6 * (1 - ramp(0, 1.2, lt)); // the hard cut lands on a visible grid
      set(inflMatL, wI, rI); set(inflMatP, wI, rI); set(hubMat, wI * ramp(0.8, 1.8, lt), 1.2);
      set(bubMat, wB, reveal(BEATS.bubbles, lt)); set(vacMat, wB * 0.9, reveal(BEATS.bubbles, lt));
      bub.scale.setScalar(Math.exp(0.08 * (lt - BEATS.bubbles[0]))); // the false vacuum keeps inflating
      set(landMat, wL, reveal(BEATS.landscape, lt) * (0.45 + 0.3 * ramp(10.5, 13.5, lt))); set(minMat, wL * ramp(11.2, 12.4, lt), 1.2);
      land.position.set(0, -0.6, 0);
      const rq = reveal(BEATS.quantumGravity, lt);
      set(gMat, wQ, rq); set(nodeMat, wQ, 1.2);
      const wS = wQ * (1 - ramp(17.4, 18.6, lt));
      set(sMat, wS, rq);
      set(cyMat, wC, reveal(BEATS.calabiYau, lt) + 0.25, (u) => { u.uAlpha4.value = 0.35 + 0.16 * (lt - BEATS.calabiYau[0]); });
      cy.rotation.set(0.3, (lt - BEATS.calabiYau[0]) * 0.05, 0); cy.position.set(0, 0.25, 0);

      // spin network → condensing into a surface
      if (wQ > 0.001) {
        const u = smooth(clamp((lt - 17.2) / 2.6));
        const P = graph.nodes.map((nd) => tmp.copy(nd.cloud).lerp(nd.sheet, u).clone());
        let k = 0;
        for (const [a, b] of graph.edges) {
          const col = u < 0.5 ? VIOLET : WARM;
          for (let s = 0; s < EDGE_PTS; s++) {
            const t = (s + 0.5) / EDGE_PTS;
            tmp2.copy(P[a]).lerp(P[b], t);
            gPos.set([tmp2.x, tmp2.y, tmp2.z], k * 3);
            const c = scaleC(col, 0.55);
            gCol.set(c, k * 3);
            k++;
          }
        }
        for (let i = 0; i < P.length; i++) { gPos.set([P[i].x, P[i].y, P[i].z], k * 3); gCol.set([0.9, 0.85, 0.8], k * 3); k++; nPos.set([P[i].x, P[i].y, P[i].z], i * 3); }
        gGeo.attributes.position.needsUpdate = true; gGeo.attributes.aCol.needsUpdate = true; nodeGeo.attributes.position.needsUpdate = true;
        // strings
        let q = 0;
        for (const st of strings) {
          const rot = new THREE.Matrix4().makeRotationX(st.tilt).multiply(new THREE.Matrix4().makeRotationY(st.tilt * 1.7));
          for (let s = 0; s < STR_PTS; s++) {
            const sg = s / STR_PTS;
            if (st.open) {
              const x = (sg - 0.5) * 2 * st.R * 1.6, y = 0.15 * Math.sin(st.n * Math.PI * sg) * Math.cos(st.w * lt) + 0.06 * Math.sin((st.n + 1) * Math.PI * sg) * Math.cos(1.5 * st.w * lt);
              tmp.set(x, y, 0);
            } else {
              const a = sg * Math.PI * 2, rr = st.R * (1 + 0.22 * Math.sin(st.n * a) * Math.cos(st.w * lt));
              tmp.set(rr * Math.cos(a), rr * Math.sin(a), 0.1 * st.R * Math.sin((st.n + 1) * a) * Math.sin(st.w * lt));
            }
            tmp.applyMatrix4(rot).add(st.c);
            sPos.set([tmp.x, tmp.y, tmp.z], q * 3); q++;
          }
        }
        sGeo.attributes.position.needsUpdate = true;
        // spin labels on a few edges, early; then the emergence label
        const spinA = wQ * ramp(14.9, 15.6, lt) * (1 - ramp(16.9, 17.5, lt));
        if (spinA > 0.01) {
          const js = ['j = 1/2', 'j = 1', 'j = 3/2', 'j = 1/2', 'j = 2'];
          [11, 40, 77, 102, 130].forEach((ei, i) => {
            const [a, b] = graph.edges[ei % graph.edges.length];
            const q2 = projectToScreen(cam, tmp.copy(P[a]).lerp(P[b], 0.5));
            if (q2.visible) out.labels.push({ x: q2.x + 0.01, y: q2.y - 0.012, text: js[i], alpha: spinA * 0.85, size: 0.8, color: '#d8c3d2' });
          });
        }
        const lq = (p: THREE.Vector3, text: string, a: number, dx = 0.02) => { const s2 = projectToScreen(cam, p); if (s2.visible && a > 0.01) out.labels.push({ x: s2.x + dx, y: s2.y - 0.03, text, alpha: a, align: dx < 0 ? 'right' : 'left', leader: { x: s2.x, y: s2.y }, level: 'SPECULATIVE' }); };
        lq(strings[0].c, 'strings (candidate)', wS * ramp(15.0, 15.8, lt));
        lq(new THREE.Vector3(0, 1.9, 0).lerp(new THREE.Vector3(0, 0.6, -2.0), u), u < 0.3 ? 'spin network — loop quantum gravity (candidate)' : 'a graph condensing into a surface: spacetime from entanglement?', wQ * ramp(14.8, 15.6, lt) * (u < 0.3 ? 1 - ramp(0.15, 0.3, u) : ramp(0.3, 0.5, u)), -0.02);
      }

      // labels for the other beats
      const lab = (p: THREE.Vector3, text: string, a: number, opts: { align?: 'left' | 'right' | 'center'; dx?: number; dy?: number } = {}) => {
        if (a <= 0.01) return;
        const s2 = projectToScreen(cam, p);
        if (!s2.visible) return;
        out.labels.push({ x: s2.x + (opts.dx ?? 0.02), y: s2.y + (opts.dy ?? -0.03), text, alpha: a, align: opts.align ?? 'left', leader: { x: s2.x, y: s2.y }, level: 'SPECULATIVE' });
      };
      if (wI > 0.01) {
        lab(tmp.set(R_HUBBLE * 0.7071, R_HUBBLE * 0.7071, 0).applyQuaternion(infl.quaternion), 'Hubble radius: stays the same size', wI * ramp(1.2, 2.0, lt) * (1 - ramp(4.6, 5.2, lt)));
        out.labels.push({ x: 0.05, y: 0.74, text: 'grid: comoving coordinates, stretched by e^(Ht)\nrings: fluctuations stretched beyond the horizon', alpha: wI * ramp(1.8, 2.6, lt) * 0.9, size: 0.92 });
      }
      if (wB > 0.01) {
        const b0 = bubbles[3];
        const age = lt - b0.tb;
        if (age > 0) lab(tmp.copy(b0.c).add(new THREE.Vector3(0, 0.3 * age, 0)).multiplyScalar(bub.scale.x), 'a bubble universe?', wB * ramp(b0.tb + 0.6, b0.tb + 1.3, lt));
      }
      if (wL > 0.01 && minima.length) {
        const mn = minima.reduce((best, p) => (p.distanceTo(new THREE.Vector3(0.6, 0, 0.8)) < best.distanceTo(new THREE.Vector3(0.6, 0, 0.8)) ? p : best), minima[0]);
        lab(tmp.copy(mn).add(land.position), 'each valley: a possible vacuum — a different set of low-energy laws', wL * ramp(11.6, 12.4, lt));
      }
      if (wC > 0.01) out.labels.push({ x: 0.05, y: 0.74, text: 'a 2D cross-section used to picture the 6D quintic Calabi–Yau space, projected to 3D\nreal mathematics — its role in physics is speculative', alpha: wC * ramp(21.0, 21.8, lt) * 0.9, size: 0.92 });

      out.hud = { s: null, abstractLabel: 'schematic — speculative ideas, not to scale' };
      out.post = { exposure: 1.0, bloom: 0.08, vignette: 0.38 };
    },
    render(r, target) {
      r.setRenderTarget(target);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      r.render(scene, cam);
    },
    dispose() {
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); });
      for (const m of mats) m.dispose();
    },
  };
}

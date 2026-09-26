// Chapter 12 · Synthesis — one set of particles passes through the film's representations: the
// hydrogen 1s cloud, a quantum-field lattice, the tesseract, the condensed graph, equation glyphs,
// the cosmic web and the Galaxy, and comes to rest as the cone mosaic of Chapter 1: everything shown
// reached you as light absorbed by that mosaic. Every target is rebuilt here from shared data, so
// seeking straight into this chapter gives the same frames as playing through.
import * as THREE from 'three';
import type { ChapterInstance, ChapterOutput, EngineContext, Frame } from '../../engine/types';
import { ramp, clamp, smooth } from '../../engine/ease';
import { track } from '../../engine/choreo';
import { setCam } from '../util';
import { Rng } from '../../engine/prng';
import { MorphParticles, makeTarget } from '../../engine/particles';
import { TV, TE } from '../ch7';
import { makeGalaxy } from '../ch10';
import { sheetGraph } from '../ch11';
import type { Web } from '../../math/zeldovich';

/** [name, morph start, morph end] — each target holds until the next morph begins */
export const SEQUENCE: [string, number, number][] = [
  ['orbital', -2, -1],
  ['field', 1.4, 3.1],
  ['tesseract', 4.5, 6.2],
  ['graph', 7.6, 9.3],
  ['glyphs', 10.6, 12.5],
  ['web', 13.9, 15.6],
  ['galaxy', 16.9, 18.6],
  ['mosaic', 19.8, 22.6],
];
/** targets drawn in a camera-facing plane */
const FACING = new Set(['glyphs', 'mosaic']);

export default function create(ctx: EngineContext): ChapterInstance {
  const { shared, quality } = ctx;
  const N = quality.particles >= 1 ? 32768 : 16384;
  const rng = new Rng(ctx.seed, 4001);
  const jit = (s: number) => (rng.float() - 0.5) * s;
  const T: Record<string, THREE.DataTexture> = {};

  // hydrogen 1s: Born-rule samples (units a0 → scene)
  const orb = shared.orbitals.find((o) => o.key === '100')!;
  const no = orb.samples.length / 4;
  T.orbital = makeTarget(N, (i, d, o) => { const k = i % no; d[o] = orb.samples[k * 4] / 2.3; d[o + 1] = orb.samples[k * 4 + 2] / 2.3; d[o + 2] = orb.samples[k * 4 + 1] / 2.3; d[o + 3] = 0.55; });
  // a free field on a lattice with three wave packets (an excitation = a "particle")
  const side = Math.floor(Math.sqrt(N));
  const packets = [[-0.5, -0.3, 9, 0.2], [0.45, 0.35, 12, 1.4], [0.1, -0.7, 7, 2.6]];
  const field = (x: number, z: number) => packets.reduce((s, [px, pz, k, ph]) => s + Math.cos(k * (x - px) + ph) * Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / 0.09), 0);
  T.field = makeTarget(N, (i, d, o) => {
    const k = i % (side * side), gx = k % side, gz = Math.floor(k / side);
    const x = (gx / (side - 1) - 0.5) * 2.6, z = (gz / (side - 1) - 0.5) * 2.6, f = field(x, z);
    d[o] = x; d[o + 1] = 0.22 * f - 0.1; d[o + 2] = z; d[o + 3] = clamp(0.5 + 0.45 * f);
  });
  // tesseract edges, 4D → 3D perspective (as in Chapter 7)
  T.tesseract = makeTarget(N, (i, d, o) => {
    const e = TE[i % TE.length], s = (i * 0.618034) % 1;
    const a = TV[e[0]], b = TV[e[1]];
    const p = a.map((v, k) => v + (b[k] - v) * s);
    const k = 3 / (3 - p[3] * 0.8);
    d[o] = p[0] * k * 0.62; d[o + 1] = p[1] * k * 0.62; d[o + 2] = p[2] * k * 0.62; d[o + 3] = s;
  });
  // the condensed graph of Chapter 11, as a sheet
  const g = sheetGraph(8, ctx.seed);
  T.graph = makeTarget(N, (i, d, o) => {
    const [a, b] = g.edges[i % g.edges.length], s = (i * 0.754877) % 1;
    const p = g.nodes[a].sheet.clone().lerp(g.nodes[b].sheet, s).multiplyScalar(0.5);
    d[o] = p.x; d[o + 1] = p.y; d[o + 2] = p.z; d[o + 3] = 0.6;
  });
  // equation glyphs (camera-facing plane)
  const gl = shared.glyphs, ni = gl.ink.length / 2, gs = 2.9 / gl.w;
  T.glyphs = makeTarget(N, (i, d, o) => { const k = Math.floor(rng.float() * ni); d[o] = (gl.ink[k * 2] + jit(1) - gl.w / 2) * gs; d[o + 1] = -(gl.ink[k * 2 + 1] + jit(1) - gl.h / 2) * gs; d[o + 2] = 0; d[o + 3] = 0.7; });
  // the cosmic web (Zel'dovich positions), a spherical cut
  const web = shared.extra.web as Web, nw = web.q.length / 3;
  const wIdx: number[] = [];
  for (let k = 0; k < nw; k++) { const x = web.q[k * 3] + web.disp[k * 3], y = web.q[k * 3 + 1] + web.disp[k * 3 + 1], z = web.q[k * 3 + 2] + web.disp[k * 3 + 2]; if (x * x + y * y + z * z < (web.box * 0.45) ** 2) wIdx.push(k); }
  T.web = makeTarget(N, (i, d, o) => { const k = wIdx[Math.floor(rng.float() * wIdx.length)]; const sc = 1.3 / (web.box * 0.45); d[o] = (web.q[k * 3] + web.disp[k * 3]) * sc; d[o + 1] = (web.q[k * 3 + 1] + web.disp[k * 3 + 1]) * sc; d[o + 2] = (web.q[k * 3 + 2] + web.disp[k * 3 + 2]) * sc; d[o + 3] = 0.62; });
  // the Galaxy model of Chapter 10
  const gm = makeGalaxy(N, ctx.seed);
  // incline the disk ~45° toward where the camera will be while it holds (lt ≈ 18)
  const gAz = 0.4 + 18 * 0.09, gEl = 0.42 + 0.12 * Math.sin(18 * 0.23) + 0.8;
  const gRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(gEl) * Math.sin(gAz), Math.sin(gEl), Math.cos(gEl) * Math.cos(gAz)));
  const gv = new THREE.Vector3();
  T.galaxy = makeTarget(N, (i, d, o) => { gv.set(gm.pos[i * 3], gm.pos[i * 3 + 1], gm.pos[i * 3 + 2]).applyQuaternion(gRot).multiplyScalar(1 / 13); d[o] = gv.x; d[o + 1] = gv.y; d[o + 2] = gv.z; d[o + 3] = clamp(gm.col[i * 3 + 2] / 1.6); });
  // the cone mosaic of Chapter 1 (camera-facing): w = 0 S, 0.5 M, 1 L
  const mo = shared.mosaic.mosaic, R = shared.mosaic.radiusUm;
  T.mosaic = makeTarget(N, (i, d, o) => { const k = i % mo.count; const dup = i >= mo.count ? 0.15 * mo.size[k] : 0; d[o] = (mo.pos[k * 2] + jit(dup)) / R * 1.25; d[o + 1] = (mo.pos[k * 2 + 1] + jit(dup)) / R * 1.25; d[o + 2] = 0; d[o + 3] = mo.type[k] === 0 ? 1 : mo.type[k] === 1 ? 0.5 : 0; });

  const parts = new MorphParticles({ count: N, size: 0.012, intensity: 0.5, sharp: 3, palette: 1, colA: 0x9fb4e6, colB: 0xf1e2c8, colC: 0xffc39a });
  const scene = new THREE.Scene();
  scene.add(parts.points);
  const cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.01, 100);
  const facing = new THREE.Matrix4(), ident = new THREE.Matrix4();
  // neutral palette on the journey; the cone tints (S blue, M green, L red, schematic) at the end
  const cool = new THREE.Color(0x9fb4e6), neutral = new THREE.Color(0xf1e2c8), warm = new THREE.Color(0xffc39a);
  const sCone = new THREE.Color(0x5a78ff), mCone = new THREE.Color(0x6fe08a), lCone = new THREE.Color(0xff7a5c);
  // camera: slow orbit on the journey, then face the mosaic and move in until it fills the frame
  const dist = track([[0, 4.2], [10.6, 4.0], [12.9, 3.3], [13.8, 3.6], [16.8, 4.1], [19.8, 3.8], [23, 1.35], [26, 1.05]]);
  const face = (lt: number) => smooth(clamp((lt - 19.8) / 2.6));

  return {
    update(f: Frame, out: ChapterOutput) {
      const lt = f.lt;
      // which morph are we in?
      let a = 0;
      for (let i = 1; i < SEQUENCE.length; i++) if (lt >= SEQUENCE[i][1]) a = i;
      const cur = SEQUENCE[a];
      let A = cur[0], B: string | null = null, m = 0;
      if (a > 0 && lt < cur[2]) { A = SEQUENCE[a - 1][0]; B = cur[0]; m = (lt - cur[1]) / (cur[2] - cur[1]); }
      // camera
      const az = 0.4 + lt * 0.09, el = 0.42 + 0.12 * Math.sin(lt * 0.23);
      const fc = face(lt), d = dist(lt);
      const orbitPos = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(d);
      const facePos = new THREE.Vector3(0, 0, d);
      setCam(cam, orbitPos.lerp(facePos, fc), new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 38, f.aspect, 0.01, 100);
      // planar targets face the camera (which itself comes to face the z = 0 plane at the end)
      facing.makeRotationFromQuaternion(cam.quaternion);
      const mA = FACING.has(A) ? facing : ident;
      const mB = B && FACING.has(B) ? facing : ident;
      (parts.u.uModelA.value as THREE.Matrix4).copy(mA);
      (parts.u.uModelB.value as THREE.Matrix4).copy(mB);
      parts.set(T[A], B ? T[B] : null, m);
      parts.u.uStagger.value = 0.55;
      parts.u.uSwirl.value = 0.35;
      parts.u.uTime.value = lt;
      parts.u.uJitter.value = 0.0;
      parts.setProjection(cam, f.height);
      const toCone = smooth(clamp((lt - 20.4) / 2.2));
      (parts.u.uColA.value as THREE.Color).copy(cool).lerp(sCone, toCone);
      (parts.u.uColB.value as THREE.Color).copy(neutral).lerp(mCone, toCone);
      (parts.u.uColC.value as THREE.Color).copy(warm).lerp(lCone, toCone);
      // brightness: dense sets (glyphs, mosaic) need less gain; the mosaic points grow as we approach
      const dense = A === 'glyphs' || B === 'glyphs' ? 0.75 : 1;
      const core = (A === 'galaxy' ? 1 - (B ? m : 0) : 0) + (B === 'galaxy' ? m : 0); // the bulge saturates at full gain
      parts.u.uIntensity.value = 0.42 * dense * (1 - 0.45 * core) * (1 - 0.35 * toCone);
      parts.u.uSize.value = 0.012 * (1 + 0.9 * toCone);
      parts.u.uMaxPx.value = 3 + 5 * toCone;
      out.hud = { s: null, hudAlpha: 1 - ramp(1.0, 3.5, lt) };
      out.post = { exposure: 1.0, bloom: 0.09, vignette: 0.36 };
    },
    render(r, target) {
      r.setRenderTarget(target);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      r.render(scene, cam);
    },
    dispose() {
      parts.dispose();
      for (const t of Object.values(T)) t.dispose();
    },
  };
}

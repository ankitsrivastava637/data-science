// Chapter 2 · Inner scale — cell → nucleus → chromatin → nucleosome → DNA → base pair → bond →
// hydrogen atom, where the planetary picture dissolves into Born-rule samples and |ψ|² clouds.
import * as THREE from 'three';
import type { ChapterInstance, ChapterOutput, EngineContext, Frame } from '../../engine/types';
import { logTrack, track, registerRig, type CameraPose, freeOrbit } from '../../engine/choreo';
import { ramp, clamp, trap } from '../../engine/ease';
import { CellLayer, toWorld } from './cell';
import { makeChromatin, makeNucleosomes, AtomLayer, DensityLayer, LayerRT } from './nano';
import { OrbitalVolume, type State } from '../common/orbital';
import { MorphParticles, makeTarget } from '../../engine/particles';
import { projectToScreen, camRotation } from '../util';
import { registerTarget } from '../../engine/targets';

const A0_M = 5.29177210903e-11;
const FOV = 40;

// master field width (metres) for the continuous zoom, lt 0 → 65
export const zoomW = logTrack([
  [0, 37.5e-6], [9, 30e-6], [20, 3.0e-6, 'sineInOut'], [30, 1.6e-7, 'sineInOut'], [38, 2.6e-8, 'sineInOut'],
  [46, 3.4e-9, 'sineInOut'], [53, 1.8e-9, 'sineInOut'], [61, 0.6e-9, 'sineInOut'], [65, 0.42e-9, 'sineOut'],
]);
// orbital framing (Bohr radii) for lt ≥ 64
const orbW = track([[64, 7.9], [70, 11], [72.5, 14], [75, 36], [77.5, 72], [79.8, 72], [81.5, 42], [87.5, 40], [90, 14], [92, 13]]);
const el = track([[0, 1.553], [3, 1.553], [12, 0.95, 'sineInOut'], [30, 0.72], [40, 0.52], [46, 0.45], [51.5, 0.05, 'sineInOut'], [64, 0.05], [80, 0.32], [92, 0.12]]);
const az = track([[0, 0], [12, 0.42], [30, 0.78], [40, 0.98], [46, 1.05], [51.5, Math.PI / 2, 'sineInOut'], [64, Math.PI / 2], [92, Math.PI / 2 + 0.55]]);

export function ch2Scale(lt: number) {
  return lt < 64.5 ? Math.log10(zoomW(lt)) : Math.log10(orbW(lt) * A0_M);
}

function dirAt(lt: number, out = new THREE.Vector3()) {
  const e = el(lt), a = az(lt);
  return out.set(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
}

// orbital sequence
const S1: State = [{ n: 1, l: 0, m: 0, c: 1 }];
const S2P: State = [{ n: 2, l: 1, m: 0, c: 1 }];
const S3D: State = [{ n: 3, l: 2, m: 1, c: 1 }];
const SUP: State = [{ n: 1, l: 0, m: 0, c: Math.SQRT1_2 }, { n: 2, l: 1, m: 0, c: Math.SQRT1_2 }];
// physical seconds per displayed second: the 1s–2p beat (h/ΔE = 4.05e-16 s) is shown with a 4 s period (~10¹⁶× slower)
export const SLOW = 4.05e-16 / 4;

export function orbitalAt(lt: number): { a: State; b: State | null; mix: number; phase: number } {
  const seq: [number, State][] = [[0, S1], [74.5, S2P], [77.0, S3D], [79.5, SUP], [88.5, S1]];
  let i = 0;
  while (i + 1 < seq.length && lt >= seq[i + 1][0]) i++;
  const [t0, a] = seq[i];
  const next = seq[i + 1];
  const blend = next ? clamp((lt - (next[0] - 0.9)) / 0.9) : 0;
  void t0;
  const phase = ramp(73.5, 75, lt) * (1 - ramp(87.5, 89, lt));
  return { a, b: next && blend > 0 ? next[1] : null, mix: blend, phase };
}

export default function create(ctx: EngineContext): ChapterInstance {
  const { shared, quality } = ctx;
  const cell = shared.cell;
  const cellLayer = new CellLayer(cell, ctx.seed, quality.particles);
  const cellScene = new THREE.Scene();
  cellScene.add(cellLayer.group);
  const chromatin = makeChromatin(ctx.seed, Math.round(90000 * Math.min(1.6, quality.particles)));
  const chromScene = new THREE.Scene();
  chromScene.add(chromatin);
  const nucScene = new THREE.Scene();
  nucScene.add(makeNucleosomes(ctx.seed));
  const dna = shared.extra.dna as import('../../math/dna').DNAModel;
  const atoms = new AtomLayer(dna);
  const atomScene = new THREE.Scene();
  atomScene.add(atoms.group);
  const dg = shared.extra.density as { data: Float32Array; N: number; c: [number, number, number]; h: number };
  const density = new DensityLayer(dg.data, dg.N, new THREE.Vector3(...dg.c), dg.h);
  const H1 = dna.atoms[dna.focusH1];
  const H1pos = new THREE.Vector3(H1.x, H1.y, H1.z);
  const bondMid = new THREE.Vector3(...dg.c);
  const orbital = new OrbitalVolume(quality.tier === 'low' ? 0.4 : 0.5);
  // Born samples: a Bohr "orbit" ring dissolving into samples of |ψ_100|²
  const orb1 = shared.orbitals.find((o) => o.key === '100')!;
  const nPts = Math.min(orb1.samples.length / 4, Math.round(24000 * Math.min(1.5, quality.particles)));
  const ringT = makeTarget(nPts, (i, d, o) => { const a = (i / nPts) * Math.PI * 2 * 7.0; d[o] = Math.cos(a); d[o + 1] = 0; d[o + 2] = Math.sin(a); d[o + 3] = 0.5; });
  const bornT = makeTarget(nPts, (i, d, o) => { d[o] = orb1.samples[i * 4]; d[o + 1] = orb1.samples[i * 4 + 2]; d[o + 2] = orb1.samples[i * 4 + 1]; d[o + 3] = orb1.samples[i * 4 + 3]; });
  registerTarget('orbital-1s', bornT, 'a0');
  const born = new MorphParticles({ count: nPts, size: 0.09, intensity: 0.5, sharp: 3, palette: 0, colA: 0xffe2c0, colB: 0xffe2c0 });
  born.set(ringT, bornT, 0);
  const orbScene = new THREE.Scene();
  orbScene.add(born.points);
  // the old planetary icon (ghost): orbit ring + electron
  const ghost = new THREE.Group();
  const ringGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 129 }, (_, i) => new THREE.Vector3(Math.cos((i / 128) * Math.PI * 2), 0, Math.sin((i / 128) * Math.PI * 2))));
  const ringMat = new THREE.LineBasicMaterial({ color: 0xd8cfbf, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false });
  const ring = new THREE.Line(ringGeo, ringMat);
  const eMat = new THREE.MeshBasicMaterial({ color: 0xffe6c4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false });
  const electron = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), eMat);
  const nucleusDot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), eMat.clone());
  ghost.add(ring, electron, nucleusDot);
  orbScene.add(ghost);

  const solidRT = new LayerRT(quality.msaa);
  const cams = {
    cell: new THREE.PerspectiveCamera(FOV, 16 / 9, 0.01, 1000),
    nm: new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 50000),
    A: new THREE.PerspectiveCamera(FOV, 16 / 9, 0.05, 2000),
    a0: new THREE.PerspectiveCamera(FOV, 16 / 9, 0.05, 2000),
  };
  const dir = new THREE.Vector3();
  const cellFocus = toWorld(cell.focus.x, cell.focus.y, cell.focus.z);
  const cellCenter = new THREE.Vector3(0, 0.6, 0);
  const tmpT = new THREE.Vector3();
  registerRig('ch2.zoom', (lt) => {
    const d = dirAt(lt);
    const p: CameraPose = { position: d.clone().multiplyScalar(3), target: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fov: FOV };
    return p;
  });

  let w = { cell: 0, chrom: 0, nuc: 0, atom: 0, dens: 0, orb: 0, born: 0, ghost: 0 };
  let W = 1, H = 1;

  function place(cam: THREE.PerspectiveCamera, target: THREE.Vector3, fieldLocal: number, aspect: number) {
    const tanHalf = Math.tan((FOV * Math.PI) / 360);
    const d = fieldLocal / (2 * tanHalf * aspect);
    cam.aspect = aspect; cam.fov = FOV;
    cam.near = d * 0.02; cam.far = d * 400;
    cam.updateProjectionMatrix();
    cam.position.copy(target).addScaledVector(dir, d);
    cam.up.set(0, 1, 0);
    cam.lookAt(target); freeOrbit(cam, target);
    cam.updateMatrixWorld();
    return d;
  }

  return {
    update(f: Frame, out: ChapterOutput) {
      const lt = f.lt;
      W = f.width; H = f.height;
      const Wm = zoomW(Math.min(lt, 65));
      const s = Math.log10(Wm);
      dirAt(lt, dir);
      w.cell = 1 - ramp(-5.35, -5.9, s) * 1;
      w.cell = s > -5.35 ? 1 : 1 - clamp((-5.35 - s) / 0.55);
      w.chrom = clamp((-5.0 - s) / 0.5) * (1 - clamp((-6.65 - s) / 0.4));
      w.nuc = clamp((-6.55 - s) / 0.4) * (1 - clamp((-8.05 - s) / 0.3));
      w.atom = clamp((-8.0 - s) / 0.3) * (1 - 0.75 * clamp((-9.0 - s) / 0.25)) * (1 - ramp(63.5, 66, lt));
      w.dens = clamp((-8.95 - s) / 0.25) * (1 - ramp(62.3, 64.3, lt));
      w.ghost = trap(65.3, 70.8, lt, 1.2, 1.4);
      w.born = ramp(67.3, 68.5, lt) * (1 - 0.75 * ramp(71, 73.5, lt)) * (1 - ramp(74, 75, lt));
      w.orb = Math.max(0.35 * ramp(63.0, 65.0, lt) * (1 - ramp(65.5, 67.5, lt)), ramp(69.8, 72.5, lt));

      // cell (µm)
      if (w.cell > 0.001) {
        const target = tmpT.copy(cellCenter).lerp(cellFocus, ramp(8, 18, lt));
        const d = place(cams.cell, target, Wm * 1e6, f.aspect);
        const proj = f.height / (2 * Math.tan((FOV * Math.PI) / 360));
        const structMix = ramp(3.5, 10.5, lt);
        // nucleus shell fades as the camera passes through the envelope
        const nucW = 1 - ramp(15, 19, lt);
        cellLayer.set(structMix, w.cell, ramp(7, 12, lt), nucW, f.t, proj);
        (cellLayer.membrane.material as THREE.ShaderMaterial).uniforms.uNear.value = d * 0.4;
      }
      if (w.chrom > 0.001) {
        place(cams.nm, new THREE.Vector3(), Wm * 1e9, f.aspect);
        const u = (chromatin.material as THREE.ShaderMaterial).uniforms;
        u.uProj.value = f.height / (2 * Math.tan((FOV * Math.PI) / 360));
        u.uW.value = w.chrom;
      }
      if (w.nuc > 0.001 && w.chrom <= 0.001) place(cams.nm, new THREE.Vector3(), Wm * 1e9, f.aspect);
      if (w.atom > 0.001 || w.dens > 0.001) {
        // focus drifts from the helix axis to the N1–H1 bond, then to the hydrogen nucleus
        const tgt = new THREE.Vector3().lerp(bondMid, ramp(50, 58, lt)).lerp(H1pos, ramp(59, 64, lt));
        place(cams.A, tgt, Wm * 1e10, f.aspect);
        // clip base pairs between the camera and the focus pair as we look down the axis
        atoms.clip.constant = 40 - 38.2 * ramp(47, 51.5, lt);
        atoms.focus(ramp(50, 53, lt), trap(48, 63, lt, 1.5, 1.5) * 0.9);
        const du = density.mat.uniforms;
        du.camPos.value.copy(cams.A.position);
        camRotation(cams.A, du.camRot.value);
        du.tanHalf.value = Math.tan((FOV * Math.PI) / 360); du.aspect.value = f.aspect;
        du.uIso.value = ramp(59.3, 60.8, lt);
        du.uW.value = w.dens;
        du.uSteps.value = Math.round(72 * quality.steps);
      }
      if (w.orb > 0.001 || w.born > 0.001 || w.ghost > 0.001) {
        const Wa0 = lt < 64.5 ? Wm / A0_M : orbW(lt);
        place(cams.a0, new THREE.Vector3(), Wa0, f.aspect);
        const st = orbitalAt(lt);
        orbital.set(st.a, st.b, st.mix, lt - 79.5, SLOW);
        orbital.setCamera(cams.a0, f.aspect);
        orbital.setSize(W, H);
        const ou = orbital.mat.uniforms;
        ou.uPhase.value = st.phase;
        ou.uExposure.value = 0.85;
        ou.uSteps.value = Math.round(64 * quality.steps);
        ou.uCut.value = 0;
        // ghost planetary atom
        const gw = w.ghost;
        ringMat.opacity = gw * 0.8 * (1 - ramp(67.5, 69.5, lt));
        (electron.material as THREE.MeshBasicMaterial).opacity = gw * (1 - ramp(67.5, 68.5, lt));
        (nucleusDot.material as THREE.MeshBasicMaterial).opacity = gw * 0.8;
        const ea = lt * 2.1;
        electron.position.set(Math.cos(ea), 0, Math.sin(ea));
        ghost.visible = gw > 0.001;
        ghost.rotation.set(0, 0, 1.05);
        born.set(ringT, bornT, ramp(67.5, 70.5, lt));
        born.u.uStagger.value = 0.8;
        born.u.uSwirl.value = 0.6;
        born.u.uIntensity.value = 0.28 * w.born;
        born.u.uSize.value = 0.055;
        (born.u.uModelA.value as THREE.Matrix4).makeRotationZ(1.05);
        born.setProjection(cams.a0, f.height);
        born.points.visible = w.born > 0.001;
        if (trap(66, 70.5, lt, 0.8, 0.8) > 0.01) {
          const pp = projectToScreen(cams.a0, new THREE.Vector3(1, 0, 0));
          out.labels.push({ x: pp.x + 0.06, y: pp.y - 0.1, text: 'the planetary picture (wrong)', alpha: trap(66, 70.5, lt, 0.8, 0.8) * gw, leader: { x: pp.x, y: pp.y } });
        }
      }
      // labels at the molecular scale
      if (trap(48.5, 55, lt, 1, 1) > 0.01) {
        const a = trap(48.5, 55, lt, 1, 1) * w.atom;
        const g = dna.atoms.find((x) => x.bp === dna.atoms[dna.focusH1].bp && x.strand === 0 && x.name === 'C4')!;
        const c = dna.atoms.find((x) => x.bp === dna.atoms[dna.focusH1].bp && x.strand === 1 && x.name === 'C5')!;
        const pg = projectToScreen(cams.A, new THREE.Vector3(g.x, g.y, g.z));
        const pc = projectToScreen(cams.A, new THREE.Vector3(c.x, c.y, c.z));
        if (pg.visible) out.labels.push({ x: pg.x, y: pg.y - 0.12, text: 'guanine', align: 'center', alpha: a, leader: { x: pg.x, y: pg.y } });
        if (pc.visible) out.labels.push({ x: pc.x, y: pc.y + 0.14, text: 'cytosine', align: 'center', alpha: a, leader: { x: pc.x, y: pc.y } });
      }
      if (trap(58, 63.5, lt, 1, 1) > 0.01) {
        const a = trap(58, 63.5, lt, 1, 1) * w.dens;
        const N1 = dna.atoms[dna.focusN1];
        const pn = projectToScreen(cams.A, new THREE.Vector3(N1.x, N1.y, N1.z));
        const ph = projectToScreen(cams.A, H1pos);
        if (pn.visible) out.labels.push({ x: pn.x - 0.1, y: pn.y - 0.12, text: 'N', align: 'right', alpha: a, leader: { x: pn.x, y: pn.y } });
        if (ph.visible) out.labels.push({ x: ph.x + 0.1, y: ph.y + 0.12, text: 'H', alpha: a, leader: { x: ph.x, y: ph.y } });
      }
      if (lt > 79 && lt < 88.5) {
        const a = trap(79.5, 88, lt, 1, 1);
        out.labels.push({ x: 0.95, y: 0.86, text: '(1s + 2p) / √2 — slowed about 10¹⁶ times', align: 'right', alpha: a * 0.9, size: 0.95 });
      }
      out.hud = { s: ch2Scale(lt) };
      out.post = { exposure: 1.0, bloom: 0.05, vignette: 0.34 };
    },
    render(r, target) {
      r.setRenderTarget(target);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      if (w.cell > 0.001) { r.setRenderTarget(target); r.render(cellScene, cams.cell); }
      if (w.chrom > 0.001) { r.setRenderTarget(target); r.render(chromScene, cams.nm); }
      solidRT.setSize(W, H);
      if (w.nuc > 0.001) solidRT.draw(r, nucScene, cams.nm, target, w.nuc);
      if (w.atom > 0.001) { r.localClippingEnabled = true; solidRT.draw(r, atomScene, cams.A, target, w.atom); r.localClippingEnabled = false; }
      if (w.dens > 0.001) density.render(r, target);
      if (w.orb > 0.001) orbital.render(r, target, w.orb);
      if (w.born > 0.001 || w.ghost > 0.001) { r.setRenderTarget(target); r.render(orbScene, cams.a0); }
    },
    dispose() {
      cellLayer.dispose(); chromatin.geometry.dispose(); (chromatin.material as THREE.Material).dispose();
      nucScene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose?.(); });
      atoms.dispose(); density.dispose(); orbital.dispose(); born.dispose(); solidRT.dispose();
      ringGeo.dispose(); ringMat.dispose(); eMat.dispose();
    },
  };
}

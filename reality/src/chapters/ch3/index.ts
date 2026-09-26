// Chapter 3 · Quantum — atom → nucleus (a proton) → quarks & gluon fields → quantum field on a
// lattice → double slit from single detections → spin as a spinor → entanglement as correlation.
import * as THREE from 'three';
import type { ChapterInstance, ChapterOutput, EngineContext, Frame } from '../../engine/types';
import { logTrack, track, registerRig, type CameraPose } from '../../engine/choreo';
import { ramp, clamp, trap } from '../../engine/ease';
import { OrbitalVolume } from '../common/orbital';
import { ProtonVolume } from './proton';
import { FieldLattice } from './field';
import { SlitView } from './slit';
import { Rng } from '../../engine/prng';
import { projectToScreen } from '../util';
import { registerTarget } from '../../engine/targets';
import { makeTarget } from '../../engine/particles';

const A0_M = 5.29177210903e-11;
const FOV = 40;
// continuous zoom atom → proton (field width, metres)
const zoomW = logTrack([[-2, 13 * A0_M], [3, 9 * A0_M], [16, 3.2e-15, 'sineInOut'], [46, 2.6e-15]]);
// camera direction continues from the end of Chapter 2
const az = track([[-2, Math.PI / 2 + 0.55], [46, Math.PI / 2 + 1.6]]);
const el = track([[-2, 0.12], [20, 0.35], [46, 0.25]]);
const dirAt = (lt: number, out = new THREE.Vector3()) => out.set(Math.cos(el(lt)) * Math.sin(az(lt)), Math.sin(el(lt)), Math.cos(el(lt)) * Math.cos(az(lt)));

import { SLIT, detTau, ENT_START, ENT_RATE, makeEntanglementRecord, type EntRecord } from '../../content/cues';
export { SLIT, detTau, ENT_START, ENT_RATE };

export default function create(ctx: EngineContext): ChapterInstance {
  const { shared, quality } = ctx;
  const orbital = new OrbitalVolume(quality.tier === 'low' ? 0.4 : 0.5);
  const proton = new ProtonVolume(shared.extra.protonNoise, quality.tier === 'low' ? 0.4 : 0.5);
  const field = new FieldLattice(ctx.seed);
  const fieldScene = new THREE.Scene(); fieldScene.add(field.group);
  const slit = new SlitView(shared.slit, shared.detections);
  const slitScene = new THREE.Scene(); slitScene.add(slit.group);
  // detections as a particle target for the Synthesis chapter
  registerTarget('detections', makeTarget(shared.detections.count, (i, d, o) => {
    d[o] = (shared.detections.y[i] - 0.5) * 2; d[o + 1] = ((i * 0.618) % 1) * 2 - 1; d[o + 2] = shared.detections.x[i] * 0.02; d[o + 3] = shared.detections.t[i];
  }), 'unit');

  // Bloch sphere
  const bloch = new THREE.Group();
  const circle = (n: number) => new THREE.BufferGeometry().setFromPoints(Array.from({ length: n + 1 }, (_, i) => new THREE.Vector3(Math.cos((i / n) * 2 * Math.PI), 0, Math.sin((i / n) * 2 * Math.PI))));
  const lineMat = new THREE.LineBasicMaterial({ color: 0x8c8678, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthTest: false });
  const eq = new THREE.Line(circle(128), lineMat);
  const mer1 = new THREE.Line(circle(128), lineMat); mer1.rotation.x = Math.PI / 2;
  const mer2 = new THREE.Line(circle(128), lineMat); mer2.rotation.z = Math.PI / 2;
  const axisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1.25, 0), new THREE.Vector3(0, 1.25, 0), new THREE.Vector3(-1.25, 0, 0), new THREE.Vector3(1.25, 0, 0), new THREE.Vector3(0, 0, -1.25), new THREE.Vector3(0, 0, 1.25)]);
  const axes = new THREE.LineSegments(axisGeo, new THREE.LineBasicMaterial({ color: 0x5f5a52, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthTest: false }));
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffd9a8, transparent: true, blending: THREE.AdditiveBlending, depthTest: false });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 12), arrowMat); shaft.position.y = 0.5;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 16), arrowMat); head.position.y = 1.0;
  const arrow = new THREE.Group(); arrow.add(shaft, head);
  const trailPts = new Float32Array(3 * 256);
  const trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPts, 3));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffc98a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthTest: false }));
  bloch.add(eq, mer1, mer2, axes, arrow, trail);
  const blochScene = new THREE.Scene(); blochScene.add(bloch);

  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.01, 1000);
  const fmCam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.001, 1000);
  const fieldCam = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 2000);
  const slitCam = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 5000);
  const blochCam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100);
  const dir = new THREE.Vector3();
  registerRig('ch3.field', (lt) => ({ position: new THREE.Vector3(Math.sin(0.35 + lt * 0.01) * 70, 46, Math.cos(0.35 + lt * 0.01) * 70), target: new THREE.Vector3(0, 0, 0), up: new THREE.Vector3(0, 1, 0), fov: 38 } as CameraPose));

  // entanglement record (deterministic outcomes with singlet statistics)
  const ent = makeEntanglementRecord(ctx.seed);

  let w = { orb: 0, proton: 0, field: 0, slit: 0, dots: 0, bloch: 0 };
  let W = 1, H = 1;

  function place(c: THREE.PerspectiveCamera, fieldLocal: number, aspect: number) {
    const d = fieldLocal / (2 * Math.tan((FOV * Math.PI) / 360) * aspect);
    c.fov = FOV; c.aspect = aspect; c.near = d * 0.01; c.far = d * 200; c.updateProjectionMatrix();
    c.position.copy(dir).multiplyScalar(d); c.up.set(0, 1, 0); c.lookAt(0, 0, 0); c.updateMatrixWorld();
  }

  return {
    update(f: Frame, out: ChapterOutput) {
      const lt = f.lt;
      W = f.width; H = f.height;
      dirAt(lt, dir);
      const Wm = zoomW(lt);
      w.orb = 1 - ramp(4, 12, lt);
      w.proton = ramp(7, 16, lt) * (1 - ramp(44.5, 47.5, lt));
      w.field = ramp(45.5, 48.5, lt) * (1 - ramp(64.5, 67.5, lt));
      w.slit = ramp(64.5, 67.5, lt) * (1 - ramp(94.5, 97, lt));
      w.dots = w.slit;
      w.bloch = ramp(95.5, 97.5, lt) * (1 - ramp(107, 108.8, lt));
      if (w.orb > 0.001) {
        place(cam, Wm / A0_M, f.aspect);
        orbital.set([{ n: 1, l: 0, m: 0, c: 1 }], null, 0, 0, 1);
        orbital.setCamera(cam, f.aspect);
        orbital.setSize(W, H);
        orbital.mat.uniforms.uExposure.value = 0.85;
        orbital.mat.uniforms.uPhase.value = 0;
        orbital.mat.uniforms.uSteps.value = Math.round(64 * quality.steps);
      }
      if (w.proton > 0.001) {
        place(fmCam, Wm / 1e-15, f.aspect);
        proton.update(Math.max(0, lt - 7) * 0.9, f.reducedMotion);
        proton.setCamera(fmCam, f.aspect, W, H);
        const pu = proton.mat.uniforms;
        pu.uSteps.value = Math.round(56 * quality.steps);
        pu.uExposure.value = 1.0;
        pu.uTube.value = ramp(30, 34, lt) * 1.0 + 0.35;
        pu.uLumps.value = 1;
        if (trap(24, 42, lt, 1.5, 1.5) > 0.01) {
          const a = trap(24, 42, lt, 1.5, 1.5) * w.proton;
          const qs = proton.quarkPositions();
          const names = ['u', 'u', 'd'];
          qs.forEach((q, i) => { const p = projectToScreen(fmCam, q); out.labels.push({ x: p.x + 0.03, y: p.y - 0.035, text: names[i], alpha: a * 0.9, size: 1.1 }); });
          out.labels.push({ x: 0.95, y: 0.86, text: 'illustrative · motion slowed ~10²³×', align: 'right', alpha: a * 0.85, size: 0.92, level: 'ESTABLISHED' });
        }
      }
      if (w.field > 0.001) {
        const ang = 0.35 + (lt - 46) * 0.012;
        fieldCam.aspect = f.aspect; fieldCam.updateProjectionMatrix();
        fieldCam.position.set(Math.sin(ang) * 72, 44, Math.cos(ang) * 72);
        fieldCam.lookAt(0, -2, 0); fieldCam.updateMatrixWorld();
        const vac = 1;
        const mode = trap(50, 56, lt, 1.2, 1.4);
        const packet = ramp(55, 57, lt);
        const tField = lt < 55 ? (lt - 46) * 3.0 : (lt - 55) * 9.5;
        field.set(tField, vac, mode, packet, w.field);
        const la = trap(50.2, 55.6, lt, 0.8, 0.8) * w.field;
        if (la > 0.01) out.labels.push({ x: 0.5, y: 0.2, text: 'one mode', align: 'center', alpha: la });
        const lb = trap(57, 64, lt, 0.8, 0.8) * w.field;
        if (lb > 0.01) out.labels.push({ x: 0.5, y: 0.2, text: 'a particle: an excitation built from many modes', align: 'center', alpha: lb });
        const lc = trap(46.5, 50, lt, 0.8, 0.8) * w.field;
        if (lc > 0.01) out.labels.push({ x: 0.5, y: 0.2, text: 'vacuum: the field is never perfectly still (illustrative)', align: 'center', alpha: lc });
      }
      if (w.slit > 0.001) {
        // camera: oblique over the plane, then turn to face the detector plate
        const face = ramp(77.5, 82, lt) * (1 - ramp(92.5, 96, lt));
        const p0 = new THREE.Vector3(-150, 150, 175), t0 = new THREE.Vector3(10, 0, 0);
        const p1 = new THREE.Vector3(-40, 35, 0), t1 = new THREE.Vector3(shared.slit.screenX, 34, 0);
        slitCam.aspect = f.aspect; slitCam.updateProjectionMatrix();
        slitCam.position.lerpVectors(p0, p1, face);
        slitCam.lookAt(new THREE.Vector3().lerpVectors(t0, t1, face));
        slitCam.updateMatrixWorld();
        const su = clamp((lt - SLIT.simStart) / (SLIT.simEnd - SLIT.simStart));
        slit.setSim(su, w.slit * (1 - 0.85 * face), 1);
        const proj = f.height / (2 * Math.tan((38 * Math.PI) / 360));
        slit.setDetections(detTau(lt), proj, w.dots, f.reducedMotion ? 0.01 : 0.0035);
        (slit.plate.material as THREE.MeshBasicMaterial).opacity = 0;
        const n = slit.count(detTau(lt));
        const ca = trap(SLIT.detStart + 0.3, 96, lt, 0.8, 1.5) * w.slit;
        if (ca > 0.01) out.labels.push({ x: 0.95, y: 0.86, text: `detections: ${n.toLocaleString('en-US')}`, align: 'right', alpha: ca, size: 1.0, level: 'ESTABLISHED' });
        const sa = trap(67, 76, lt, 1, 1) * w.slit * (1 - face);
        if (sa > 0.01) {
          const pw = projectToScreen(slitCam, new THREE.Vector3(shared.slit.wall.x, 0, -70));
          if (pw.visible) out.labels.push({ x: pw.x - 0.04, y: pw.y + 0.07, text: 'two slits', alpha: sa, leader: { x: pw.x, y: pw.y }, align: 'right' });
          const ps = projectToScreen(slitCam, new THREE.Vector3(shared.slit.screenX, 0, 80));
          if (ps.visible) out.labels.push({ x: ps.x + 0.03, y: ps.y + 0.06, text: 'detector', alpha: sa, leader: { x: ps.x, y: ps.y } });
        }
      }
      if (w.bloch > 0.001) {
        blochCam.aspect = f.aspect; blochCam.updateProjectionMatrix();
        blochCam.position.set(3.2, 2.2, 5.6); blochCam.lookAt(0.9, 0, 0); blochCam.updateMatrixWorld();
        bloch.position.set(-0.9, 0, 0);
        const alpha = 4 * Math.PI * ramp(97.8, 106, lt);
        const theta = Math.PI / 2 - 0.35;
        const v = new THREE.Vector3(Math.sin(theta) * Math.cos(alpha), Math.cos(theta), Math.sin(theta) * Math.sin(alpha));
        arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
        // trail over the last revolution
        for (let i = 0; i < 256; i++) {
          const a = alpha - (i / 255) * Math.min(alpha, 2 * Math.PI);
          trailPts[i * 3] = Math.sin(theta) * Math.cos(a); trailPts[i * 3 + 1] = Math.cos(theta); trailPts[i * 3 + 2] = Math.sin(theta) * Math.sin(a);
        }
        trailGeo.attributes.position.needsUpdate = true;
        lineMat.opacity = 0.55 * w.bloch;
        arrowMat.opacity = w.bloch;
        (axes.material as THREE.LineBasicMaterial).opacity = 0.6 * w.bloch;
        (trail.material as THREE.LineBasicMaterial).opacity = 0.7 * w.bloch;
        const top = projectToScreen(blochCam, new THREE.Vector3(-0.9, 1.3, 0));
        const bot = projectToScreen(blochCam, new THREE.Vector3(-0.9, -1.35, 0));
        out.labels.push({ x: top.x, y: top.y - 0.01, text: '|↑⟩', align: 'center', alpha: w.bloch, size: 1.2 });
        out.labels.push({ x: bot.x, y: bot.y + 0.04, text: '|↓⟩', align: 'center', alpha: w.bloch, size: 1.2 });
        out.labels.push({ x: top.x, y: 0.83, text: 'Bloch sphere: the state’s direction', align: 'center', alpha: w.bloch * 0.9 });
        const wb = w.bloch;
        out.draw.push((g, Wc, Hc, a0) => drawPhasors(g, Wc, Hc, a0 * wb, alpha, theta));
      }
      const we = ramp(107.8, 109.3, lt);
      if (we > 0.001) out.draw.push((g, Wc, Hc, a0) => drawEntanglement(g, Wc, Hc, a0 * we, lt, ent));
      // HUD
      if (lt < 46.5) out.hud = { s: Math.log10(Wm) };
      else if (lt < 65.5) out.hud = { s: null, abstractLabel: 'a quantum field — lattice units, schematic' };
      else if (lt < 96) out.hud = { s: null, abstractLabel: 'double slit — simulation units (ħ = m = 1)' };
      else if (lt < 108) out.hud = { s: null, abstractLabel: 'state space — not a place' };
      else out.hud = { s: null, abstractLabel: 'schematic' };
      out.post = { exposure: 1.0, bloom: 0.05, vignette: 0.34 };
    },
    render(r, target) {
      r.setRenderTarget(target);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      if (w.orb > 0.001) orbital.render(r, target, w.orb);
      if (w.proton > 0.001) proton.render(r, target, w.proton);
      if (w.field > 0.001) { r.setRenderTarget(target); r.render(fieldScene, fieldCam); }
      if (w.slit > 0.001) { r.setRenderTarget(target); r.render(slitScene, slitCam); }
      if (w.bloch > 0.001) { r.setRenderTarget(target); r.render(blochScene, blochCam); }
    },
    dispose() {
      orbital.dispose(); proton.dispose(); field.dispose(); slit.dispose();
      blochScene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); });
      lineMat.dispose(); arrowMat.dispose();
    },
  };
}

// ── spinor phasors (2D overlay) ──────────────────────────────────────────
function drawPhasors(g: CanvasRenderingContext2D, W: number, H: number, a: number, alpha: number, theta: number) {
  if (a <= 0.002) return;
  const u = H / 1080;
  const cx = W * 0.64, cy = H * 0.5, R = 104 * u, gap = 300 * u;
  // rotation about z by α: |↑⟩ amplitude × e^{−iα/2}, |↓⟩ amplitude × e^{+iα/2} (relative to the initial state)
  const amps = [{ label: '|↑⟩ amplitude', mag: Math.cos(theta / 2), ph: -alpha / 2 }, { label: '|↓⟩ amplitude', mag: Math.sin(theta / 2), ph: alpha / 2 }];
  g.globalAlpha = a;
  amps.forEach((A, i) => {
    const x = cx + i * gap, y = cy;
    g.strokeStyle = 'rgba(200,192,176,0.55)'; g.lineWidth = 1.2 * u;
    g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(x - R - 8 * u, y); g.lineTo(x + R + 8 * u, y); g.moveTo(x, y - R - 8 * u); g.lineTo(x, y + R + 8 * u); g.stroke();
    const L = R * (0.35 + 0.65 * A.mag);
    const hx = x + L * Math.cos(A.ph), hy = y - L * Math.sin(A.ph);
    g.strokeStyle = '#ffd6a0'; g.lineWidth = 3 * u; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(hx, hy); g.stroke();
    g.fillStyle = '#ffd6a0'; g.beginPath(); g.arc(hx, hy, 5 * u, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d9d2c4'; g.font = `400 ${Math.round(16 * u)}px Inter, sans-serif`; g.textAlign = 'center';
    g.fillText(A.label, x, y + R + 36 * u);
  });
  const deg = (alpha * 180) / Math.PI;
  const sign = Math.cos(alpha / 2);
  g.textAlign = 'center';
  g.font = `400 ${Math.round(19 * u)}px Inter, sans-serif`;
  g.fillStyle = '#efe8da';
  g.fillText(`rotation: ${Math.round(deg)}°`, cx + gap / 2, cy - R - 58 * u);
  g.font = `400 ${Math.round(16 * u)}px Inter, sans-serif`;
  g.fillStyle = Math.abs(deg - 360) < 30 ? '#ffcf9a' : '#a9a293';
  const msg = deg < 20 ? 'the two complex amplitudes of the spinor' : Math.abs(deg - 360) < 30 ? 'after 360°: every amplitude × (−1)' : deg > 700 ? 'after 720°: back to the start' : sign < 0 ? 'sign reversed' : '';
  g.fillText(msg, cx + gap / 2, cy - R - 32 * u);
  g.globalAlpha = 1;
}

// ── entanglement record: see content/cues.ts ──

function drawEntanglement(g: CanvasRenderingContext2D, W: number, H: number, alpha: number, lt: number, rec: EntRecord) {
  if (alpha <= 0.002) return;
  const u = H / 1080;
  const n = Math.max(0, Math.min(rec.a.length, Math.floor((lt - ENT_START) * ENT_RATE)));
  const cy = H * 0.36;
  const xs = W * 0.5, xa = W * 0.16, xb = W * 0.84;
  g.globalAlpha = alpha;
  // source and flying pulses
  g.fillStyle = '#efe6d2'; g.beginPath(); g.arc(xs, cy, 6 * u, 0, Math.PI * 2); g.fill();
  g.font = `400 ${Math.round(18 * u)}px Inter, sans-serif`; g.textAlign = 'center'; g.fillStyle = '#b5ae9f';
  g.fillText('source of entangled pairs', xs, cy - 26 * u);
  const ph = ((lt - ENT_START) * ENT_RATE) % 1;
  if (lt > ENT_START) for (const side of [-1, 1]) {
    const x = xs + side * (xb - xs) * ph;
    g.fillStyle = `rgba(255,220,170,${0.9 * (1 - ph)})`;
    g.beginPath(); g.arc(x, cy, 4 * u, 0, Math.PI * 2); g.fill();
  }
  // detectors with measurement axes
  const thB = n > 0 && rec.thetaB[Math.min(n, rec.a.length) - 1] > 0 ? Math.PI / 3 : 0;
  const det = (x: number, th: number, label: string) => {
    g.strokeStyle = '#8f897c'; g.lineWidth = 1.4 * u;
    g.strokeRect(x - 40 * u, cy - 40 * u, 80 * u, 80 * u);
    g.strokeStyle = '#ffd6a0'; g.lineWidth = 3 * u;
    g.beginPath(); g.moveTo(x - 28 * u * Math.sin(th), cy + 28 * u * Math.cos(th)); g.lineTo(x + 28 * u * Math.sin(th), cy - 28 * u * Math.cos(th)); g.stroke();
    g.fillStyle = '#d9d2c4'; g.fillText(label, x, cy - 56 * u);
  };
  det(xa, 0, 'detector A'); det(xb, thB, thB ? 'detector B (turned 60°)' : 'detector B');
  // tapes of outcomes
  const cell = 22 * u;
  const rowY = [H * 0.58, H * 0.655];
  const compare = lt > 112.6;
  g.textAlign = 'right';
  g.fillStyle = '#b5ae9f';
  g.fillText('A', W * 0.12 - 8 * u, rowY[0] + 5 * u);
  g.fillText('B', W * 0.12 - 8 * u, rowY[1] + 5 * u);
  const x0 = W * 0.12;
  let opp = 0, same = 0, opp60 = 0, n60 = 0;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * cell * 1.15;
    if (x > W * 0.9) break;
    for (let r = 0; r < 2; r++) {
      const v = r === 0 ? rec.a[i] : rec.b[i];
      g.fillStyle = v > 0 ? '#e9a877' : '#7fa4e6';
      g.beginPath(); g.arc(x, rowY[r], cell * 0.36, 0, Math.PI * 2); g.fill();
    }
    if (compare) {
      const isOpp = rec.a[i] === -rec.b[i];
      if (rec.thetaB[i] === 0) { if (isOpp) opp++; else same++; } else { n60++; if (isOpp) opp60++; }
      g.strokeStyle = isOpp ? 'rgba(240,230,210,0.55)' : 'rgba(240,230,210,0.12)';
      g.lineWidth = 1 * u;
      g.beginPath(); g.moveTo(x, rowY[0] + cell * 0.4); g.lineTo(x, rowY[1] - cell * 0.4); g.stroke();
    }
  }
  g.textAlign = 'left';
  g.font = `400 ${Math.round(19 * u)}px Inter, sans-serif`;
  g.fillStyle = '#d9d2c4';
  const ty = H * 0.715;
  g.fillText('each row alone: random, 50 / 50  (warm = up, cool = down)', x0, ty);
  if (compare) {
    g.fillStyle = '#efe6d2';
    const s1 = `same axis: opposite in ${opp} of ${opp + same}`;
    const s2 = n60 ? `   ·   axes 60° apart: opposite in ${opp60} of ${n60} (quantum prediction: 75 %)` : '';
    g.fillText(s1 + s2, x0, ty + 32 * u);
  }
  g.globalAlpha = 1;
}

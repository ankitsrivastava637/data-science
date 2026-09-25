// Chapter 8 · Gravity — Flamm's paraboloid with a precessing geodesic → ray-traced Schwarzschild
// lensing (photon sphere, horizon, ISCO disk) → static-clock time dilation → HARD CUT: light cones
// tipping over at the horizon, the singularity as where classical GR fails → S = A/4 and the open
// information problem. Units: r_s = 1.
import * as THREE from 'three';
import type { ChapterInstance, ChapterOutput, EngineContext, Frame } from '../../engine/types';
import { ramp, clamp, trap, smooth } from '../../engine/ease';
import { BlackHoleView, shadowAngle } from './blackhole';
import { integrateTimelike } from '../../math/geodesic';
import { D2, lerp } from '../draw2d';
import { projectToScreen } from '../util';
import { SINGULARITY_CUT_LOCAL } from '../../content/chapters';
import { track } from '../../engine/choreo';

const flamm = (r: number) => 2 * Math.sqrt(Math.max(0, r - 1));
// black-hole camera: distance and inclination
const camR = track([[17, 27], [30, 22], [44, 11, 'sineInOut'], [56, 6.2, 'sineInOut'], [58, 6.0]]);
const camInc = track([[17, 0.2], [30, 0.13], [44, 0.18], [58, 0.3]]);
const camAz = track([[17, -0.3], [58, 0.9]]);

export default function create(ctx: EngineContext): ChapterInstance {
  const { quality } = ctx;
  // embedding surface as a grid of rings and radial lines
  const surf = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({ color: 0x8f887b, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthTest: false });
  for (let k = 0; k < 26; k++) {
    const r = 1 + 0.12 * k * k * 0.5 + k * 0.35;
    if (r > 22) break;
    const pts = Array.from({ length: 129 }, (_, i) => { const a = (i / 128) * Math.PI * 2; return new THREE.Vector3(r * Math.cos(a), -flamm(r), r * Math.sin(a)); });
    surf.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  }
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    const pts = Array.from({ length: 60 }, (_, i) => { const r = 1 + (21 * i * i) / (59 * 59); return new THREE.Vector3(r * Math.cos(a), -flamm(r), r * Math.sin(a)); });
    surf.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  }
  const orbit = integrateTimelike(6, 14, 0.5, 60, 0.01);
  const orbitGeo = new THREE.BufferGeometry();
  const orbitArr = new Float32Array(orbit.path.length * 3);
  orbit.path.forEach((p, i) => { orbitArr.set([p.r * Math.cos(p.phi), -flamm(p.r) + 0.05, p.r * Math.sin(p.phi)], i * 3); });
  orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitArr, 3));
  const orbitLine = new THREE.Line(orbitGeo, new THREE.LineBasicMaterial({ color: 0xffc98f, transparent: true, blending: THREE.AdditiveBlending, depthTest: false }));
  const planet = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffe6c4, transparent: true, blending: THREE.AdditiveBlending, depthTest: false }));
  surf.add(orbitLine, planet);
  const surfScene = new THREE.Scene(); surfScene.add(surf);
  const surfCam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 500);
  const bh = new BlackHoleView(quality.tier === 'low' ? 0.4 : quality.tier === 'ultra' ? 0.75 : 0.55);
  const bhCam = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 500);
  // horizon tiles
  const tileMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `out vec3 vN; out vec3 vP; out vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vP = position; vec4 mv = modelViewMatrix*vec4(position,1.0); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `precision highp float; in vec3 vN; in vec3 vP; in vec3 vV; uniform float uW; uniform float uT; out vec4 o;
      float h(vec3 p){ return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719)))*43758.5453); }
      void main(){
        vec3 n = normalize(vP);
        // cells in a longitude–latitude grid, equal-area-ish (schematic Planck-area tiles)
        float lat = asin(n.y), lon = atan(n.z, n.x);
        float rows = 28.0; float ri = floor((lat/3.14159+0.5)*rows);
        float cols = max(3.0, floor(2.0*rows*cos((ri+0.5)/rows*3.14159-1.5708)));
        float ci = floor((lon/6.28318+0.5)*cols);
        vec2 f = vec2(fract((lon/6.28318+0.5)*cols), fract((lat/3.14159+0.5)*rows));
        float edge = smoothstep(0.0, 0.06, min(min(f.x, 1.0-f.x), min(f.y, 1.0-f.y)));
        float b = h(vec3(ri, ci, floor(uT*1.2 + h(vec3(ci, ri, 3.0))*4.0)));
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        vec3 c = mix(vec3(0.05,0.045,0.04), vec3(0.95,0.78,0.55)*0.45, b*b) * edge + vec3(0.6,0.5,0.4)*rim*0.25;
        o = vec4(c*uW, 1.0);
      }`,
    uniforms: { uW: { value: 1 }, uT: { value: 0 } },
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const horizon = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), tileMat);
  const hawkGeo = new THREE.BufferGeometry();
  const hawkArr = new Float32Array(600 * 3);
  hawkGeo.setAttribute('position', new THREE.BufferAttribute(hawkArr, 3));
  const hawk = new THREE.Points(hawkGeo, new THREE.PointsMaterial({ color: 0xfff0d8, size: 3, sizeAttenuation: false, transparent: true, blending: THREE.AdditiveBlending, depthTest: false }));
  hawk.frustumCulled = false;
  const infoScene = new THREE.Scene(); infoScene.add(horizon, hawk);
  const infoCam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);

  let w = { surf: 0, bh: 0, info: 0 };
  let W = 1, H = 1;
  const CUT = SINGULARITY_CUT_LOCAL;

  return {
    update(f: Frame, out: ChapterOutput) {
      const lt = f.lt;
      W = f.width; H = f.height;
      w.surf = 1 - ramp(16, 19, lt);
      w.bh = ramp(16.5, 19.5, lt) * (lt < CUT ? 1 : 0);
      w.info = ramp(65.5, 67.5, lt);
      if (w.surf > 0.001) {
        const ang = 0.6 + lt * 0.05;
        surfCam.aspect = f.aspect; surfCam.updateProjectionMatrix();
        surfCam.position.set(Math.sin(ang) * 30, 13, Math.cos(ang) * 30);
        surfCam.lookAt(0, -3.5, 0); surfCam.updateMatrixWorld();
        const n = Math.min(orbit.path.length - 1, Math.floor(clamp((lt - 1) / 15) * (orbit.path.length - 1)));
        orbitGeo.setDrawRange(0, n + 1);
        const p = orbit.path[n];
        planet.position.set(p.r * Math.cos(p.phi), -flamm(p.r) + 0.1, p.r * Math.sin(p.phi));
        lineMat.opacity = 0.55 * w.surf;
        (orbitLine.material as THREE.LineBasicMaterial).opacity = w.surf;
        (planet.material as THREE.MeshBasicMaterial).opacity = w.surf;
        const lb = trap(1, 16, lt, 1, 1) * w.surf;
        if (lb > 0.01) out.labels.push({ x: 0.95, y: 0.86, text: 'embedding diagram: “depth” is not a real direction', align: 'right', alpha: lb, size: 0.95 });
        const lo = trap(8, 16, lt, 1, 1) * w.surf;
        if (lo > 0.01) { const pp = projectToScreen(surfCam, planet.position); out.labels.push({ x: pp.x + 0.03, y: pp.y - 0.04, text: 'a free-falling body: its orbit precesses', alpha: lo }); }
      }
      if (w.bh > 0.001) {
        const R = camR(lt), inc = camInc(lt), az = camAz(lt);
        bhCam.aspect = f.aspect; bhCam.fov = 46; bhCam.updateProjectionMatrix();
        bhCam.position.set(R * Math.cos(inc) * Math.sin(az), R * Math.sin(inc), R * Math.cos(inc) * Math.cos(az));
        bhCam.up.set(0.08, 1, 0).normalize();
        bhCam.lookAt(0, 0, 0); bhCam.updateMatrixWorld();
        bh.setCamera(bhCam, f.aspect, W, H);
        const u = bh.mat.uniforms;
        u.uSteps.value = Math.round(260 * Math.min(1.3, quality.steps));
        u.uTime.value = lt;
        u.uExposure.value = 0.9 * Math.pow(Math.min(1, R / 22), 0.9);
        u.uDisk.value = ramp(19, 22, lt);
        // shadow edge (photon-sphere image) and labels
        const a = shadowAngle(R);
        const tanH = Math.tan((46 * Math.PI) / 360);
        const ry = Math.tan(a) / tanH / 2; // fraction of screen height
        const la = trap(27, 44, lt, 1, 1.2) * w.bh;
        if (la > 0.01) {
          out.labels.push({ x: 0.5 + ry * (9 / 16) * 0.72 + 0.02, y: 0.5 - ry * 0.72, text: 'photon sphere (r = 1.5 rₛ) seen as the shadow’s edge', alpha: la, leader: { x: 0.5 + ry * (9 / 16) * 0.72, y: 0.5 - ry * 0.72 } });
          out.labels.push({ x: 0.5, y: 0.5 + 0.01, text: 'horizon r = rₛ', align: 'center', alpha: la * 0.85, size: 0.9 });
        }
        const ld = trap(35, 44, lt, 1, 1) * w.bh;
        if (ld > 0.01) out.labels.push({ x: 0.05, y: 0.17, text: 'disk inner edge at 3 rₛ (innermost stable orbit)\nbrightness and colour schematic; beaming approximate', alpha: ld, size: 0.95 });
        // static clock rates
        const ca = trap(47, 57.8, lt, 1, 0.5);
        if (ca > 0.01) out.draw.push((g, Wc, Hc, a0) => drawClocks(new D2(g, Wc, Hc, a0 * ca), lt));
        out.labels.push({ x: 0.95, y: 0.93, text: `camera at r = ${R.toFixed(1)} rₛ`, align: 'right', alpha: w.bh * 0.8, size: 0.9 });
      }
      // hard cut: light cones tipping over at the horizon
      const cA = lt >= CUT ? trap(CUT, 66.5, lt, 0.25, 1.2) : 0;
      if (cA > 0.01) out.draw.push((g, Wc, Hc, a0) => drawCones(new D2(g, Wc, Hc, a0 * cA), lt - CUT));
      if (w.info > 0.001) {
        const ev = smooth(clamp((lt - 74) / 10));
        const rad = lerp(1.0, 0.55, ev);
        horizon.scale.setScalar(rad);
        tileMat.uniforms.uW.value = w.info * (1 - ramp(86.5, 89, lt));
        tileMat.uniforms.uT.value = lt;
        infoCam.aspect = f.aspect; infoCam.updateProjectionMatrix();
        infoCam.position.set(-1.8, 0.6, 4.8); infoCam.lookAt(-1.1, 0, 0); infoCam.updateMatrixWorld();
        // Hawking quanta: sparse, deterministic outward streaks
        for (let i = 0; i < 600; i++) {
          const ph = (lt * 0.25 + i * 0.6180339) % 1;
          const th = Math.acos(1 - 2 * ((i * 0.7548776) % 1)), pp = i * 2.3999632;
          const rr = rad * (1.05 + ph * 3.2);
          hawkArr.set([rr * Math.sin(th) * Math.cos(pp), rr * Math.cos(th), rr * Math.sin(th) * Math.sin(pp)], i * 3);
        }
        hawkGeo.attributes.position.needsUpdate = true;
        (hawk.material as THREE.PointsMaterial).opacity = 0.35 * w.info * ramp(72, 74, lt) * (1 - ramp(86.5, 89, lt));
        const pa = ramp(75.5, 77, lt);
        if (pa > 0.01) out.draw.push((g, Wc, Hc, a0) => drawPage(new D2(g, Wc, Hc, a0 * pa * w.info), lt));
        const tl = trap(67, 74.5, lt, 1, 1) * w.info;
        if (tl > 0.01) out.labels.push({ x: 0.36, y: 0.2, text: 'tiles: schematic — a solar-mass horizon has ~10⁷⁷ Planck areas', align: 'center', alpha: tl, size: 0.95 });
      }
      if (lt < 16.5) out.hud = { s: null, abstractLabel: 'embedding diagram — units of rₛ' };
      else if (lt < CUT) out.hud = { s: null, abstractLabel: 'ray-traced Schwarzschild geometry — units of rₛ (any mass)' };
      else if (lt < 66) out.hud = { s: null, abstractLabel: 'Eddington–Finkelstein diagram — schematic' };
      else out.hud = { s: null, abstractLabel: 'schematic' };
      out.post = { exposure: 1.0, bloom: lt > 17 && lt < CUT ? 0.08 : 0.05, vignette: 0.36 };
    },
    render(r, target) {
      r.setRenderTarget(target);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      if (w.surf > 0.001) { r.setRenderTarget(target); r.render(surfScene, surfCam); }
      if (w.bh > 0.001) bh.render(r, target, w.bh);
      if (w.info > 0.001) { r.setRenderTarget(target); r.render(infoScene, infoCam); }
    },
    dispose() {
      surfScene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); });
      lineMat.dispose(); bh.dispose(); tileMat.dispose(); hawkGeo.dispose(); horizon.geometry.dispose();
    },
  };
}

function drawClocks(d: D2, lt: number) {
  const radii = [1.5, 3, 10];
  radii.forEach((r, i) => {
    const rate = Math.sqrt(1 - 1 / r);
    const x = 0.66 + i * 0.1, y = 0.78, R = 30;
    d.circle(x, y, R, 'rgba(10,10,10,0.55)', '#bdb6a8', 1.3);
    const ang = (lt - 47) * rate * 1.6;
    d.line([[x, y], [x + (R * 0.8 * Math.sin(ang) * d.u) / d.W, y - (R * 0.8 * Math.cos(ang) * d.u) / d.H]], '#ffd6a0', 2.2);
    d.text(`r = ${r} rₛ`, x, y + 0.058, { size: 14, align: 'center', color: '#d8d1c3' });
    d.text(`${(rate * 100).toFixed(0)} %`, x, y + 0.085, { size: 14, align: 'center', color: '#ffd6a0' });
  });
  d.text('static clocks: rate relative to a distant clock', 0.76, 0.69, { size: 14, align: 'center', color: '#aaa394' });
}

// ingoing Eddington–Finkelstein cones: ingoing edge slope −1, outgoing slope (r+1)/(r−1) in (t*, r)
function drawCones(d: D2, t: number) {
  // equal pixel scale on both axes so that light rays really are drawn at 45°
  const x0 = 0.16, yb = 0.84, yt = 0.16;
  const tmax = 2.3;
  const k = ((yb - yt) * d.H) / tmax;            // pixels per unit (r in rₛ, t* in rₛ/c)
  const rmax = (0.72 * d.W) / k;
  const x1 = x0 + (rmax * k) / d.W;
  const X = (r: number) => x0 + (r * k) / d.W;
  const Y = (ts: number) => yb - (ts * k) / d.H;
  d.line([[x0, yb], [x1, yb]], '#6f6a60', 1);
  d.text('r (units of rₛ)', x1, yb + 0.04, { size: 14, align: 'right', color: '#8b857a' });
  d.text('time →', x0 - 0.01, yt, { size: 14, align: 'right', color: '#8b857a' });
  // horizon
  d.line([[X(1), yb], [X(1), yt]], '#ffd6a0', 1.6, [6, 6]);
  d.text('event horizon r = rₛ', X(1) + 0.008, yt - 0.015, { size: 15, color: '#ffd6a0' });
  // cones
  const grow = clamp(t / 2);
  for (let ri = 1; ri <= 8; ri++) {
    const r = ri * 0.5 - 0.25;
    if (r > rmax - 0.2) break;
    for (const ts of [0.35, 1.15, 1.95]) {
      const L = 0.3 * grow;
      const slopeOut = (r + 1) / (r - 1); // dt*/dr of the "outgoing" ray
      const ax = -L / Math.sqrt(2), ay = L / Math.sqrt(2);                 // ingoing edge (towards smaller r)
      const dirOut = r > 1 ? [1, slopeOut] : [-1, -slopeOut];              // inside: also toward smaller r
      const n = Math.hypot(dirOut[0], dirOut[1]);
      const bx = (dirOut[0] / n) * L * 1.2, by = (dirOut[1] / n) * L * 1.2;
      const px = X(r), py = Y(ts);
      d.g.fillStyle = 'rgba(255,214,160,0.14)';
      d.g.beginPath();
      d.g.moveTo(px * d.W, py * d.H);
      d.g.lineTo(px * d.W + ax * k, py * d.H - ay * k);
      d.g.lineTo(px * d.W + bx * k, py * d.H - by * k);
      d.g.closePath(); d.g.fill();
      d.line([[px, py], [px + (ax * k) / d.W, py - (ay * k) / d.H]], 'rgba(230,220,200,0.7)', 1);
      d.line([[px, py], [px + (bx * k) / d.W, py - (by * k) / d.H]], 'rgba(230,220,200,0.7)', 1);
    }
  }
  // infalling worldline (schematic, always inside the local cones)
  const kf = clamp((t - 1) / 5);
  const pts: [number, number][] = [];
  for (let i = 0; i <= 60 * kf; i++) {
    const s = i / 60;
    const r = 3 * Math.pow(1 - s, 1.25);
    pts.push([X(r), Y(0.1 + 2.1 * (1 - Math.pow(1 - s, 1.6)))]);
  }
  if (pts.length > 1) d.line(pts, '#9cc2ff', 2.4);
  // singularity: the grid itself breaks down
  const sgA = ramp(3, 4.5, t);
  d.alpha(sgA);
  for (let i = 0; i < 70; i++) {
    const yy = yt + ((yb - yt) * i) / 70;
    const j = Math.sin(i * 12.9898 + t * 3) * 0.006;
    d.line([[X(0) + j, yy], [X(0) - j * 1.5, yy + (yb - yt) / 70]], 'rgba(255,240,220,0.9)', 2);
  }
  d.text('r = 0: classical GR predicts infinite curvature —', X(0.05) + 0.01, 0.46, { size: 17, color: '#fff2dc' });
  d.text('a sign the theory fails here, not a known object', X(0.05) + 0.01, 0.495, { size: 17, color: '#fff2dc' });
  d.alpha(1);
  d.text('inside the horizon every future direction points to smaller r', 0.52, 0.1, { size: 16, align: 'center', color: '#bdb6a8', alpha: ramp(2, 3, t) });
}

function drawPage(d: D2, lt: number) {
  const box = { x: 0.07, y: 0.26, w: 0.36, h: 0.36 };
  d.line([[box.x, box.y + box.h], [box.x + box.w, box.y + box.h]], '#6f6a60', 1);
  d.line([[box.x, box.y], [box.x, box.y + box.h]], '#6f6a60', 1);
  d.text('entropy of the emitted radiation', box.x, box.y - 0.02, { size: 14, color: '#aaa394' });
  d.text('time → (evaporation)', box.x + box.w, box.y + box.h + 0.035, { size: 13, align: 'right', color: '#8b857a' });
  const k = clamp((lt - 76) / 5);
  d.plot(box, [0, 1], [0, 1.05], (x) => (x > k ? NaN : 1 - Math.pow(1 - x, 2 / 3) * 1.0), '#ffc98f', 2.2);
  d.text('Hawking’s calculation: keeps rising', box.x + box.w * 0.55, box.y + 0.02, { size: 13, color: '#ffc98f', alpha: ramp(79, 80, lt) });
  const pk = ramp(80.5, 82, lt);
  d.alpha(pk * 0.75);
  d.plot(box, [0, 1], [0, 1.05], (x) => (x > clamp((lt - 80.5) / 4) ? NaN : Math.min(1 - Math.pow(1 - x, 2 / 3), Math.pow(1 - x, 2 / 3) * 0.95)), '#9cc2ff', 2, 240, [6, 6]);
  d.text('Page curve — if information escapes (mechanism debated)', box.x + 0.01, box.y + box.h - 0.06, { size: 13, color: '#9cc2ff' });
  d.alpha(1);
}

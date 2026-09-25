// Nanoscale layers of Chapter 2: chromatin polymer (nm), nucleosome chain (nm), atomic B-DNA (Å)
// and an electron-density volume (Å). Every layer's zoom focus is its local origin.
import * as THREE from 'three';
import { Rng } from '../../engine/prng';
import { hdrTarget, FullscreenPass, shaderMat } from '../../engine/post';
import { COMMON } from '../../shaders/common';
import type { DNAModel, Elem } from '../../math/dna';

/** Solid layer rendered with depth into its own target, then composited additively with a weight. */
export class LayerRT {
  rt: THREE.WebGLRenderTarget;
  private comp: FullscreenPass;
  constructor(samples: number) {
    this.rt = hdrTarget(2, 2, samples, true);
    this.comp = new FullscreenPass(shaderMat(`precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D t; uniform float w;
      void main(){ o = vec4(texture(t, vUv).rgb * w, 1.0); }`, { t: { value: null }, w: { value: 1 } }, { blending: THREE.AdditiveBlending, transparent: true }));
  }
  setSize(w: number, h: number) { if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h); }
  draw(r: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.Camera, target: THREE.WebGLRenderTarget, weight: number) {
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, false);
    r.render(scene, cam);
    this.comp.material.uniforms.t.value = this.rt.texture;
    this.comp.material.uniforms.w.value = weight;
    this.comp.render(r, target);
  }
  dispose() { this.rt.dispose(); this.comp.material.dispose(); }
}

export function lights(scene: THREE.Scene, key = 2.6) {
  scene.add(new THREE.HemisphereLight(0xb9c6d6, 0x2a1f18, 0.55));
  const k = new THREE.DirectionalLight(0xffe7cc, key); k.position.set(0.6, 1.0, 0.8); scene.add(k);
  const f = new THREE.DirectionalLight(0x9fb8ff, key * 0.35); f.position.set(-1, -0.3, 0.4); scene.add(f);
  const rim = new THREE.DirectionalLight(0xffffff, key * 0.5); rim.position.set(-0.3, 0.2, -1); scene.add(rim);
}

// ── chromatin polymer (nm) ────────────────────────────────────────────────
export function makeChromatin(seed: number, total: number): THREE.Points {
  const rng = new Rng(seed, 808);
  const R = 1800;
  const pts: number[] = [];
  const walk = (start: THREE.Vector3, dir: THREE.Vector3, steps: number) => {
    const p = start.clone(), d = dir.clone().normalize();
    for (let i = 0; i < steps; i++) {
      for (let k = 0; k < 3; k++) { const q = p.clone().addScaledVector(d, (k / 3) * 10); pts.push(q.x, q.y, q.z); }
      // persistent random walk (persistence ~50 nm)
      const perturb = new THREE.Vector3(rng.normal(), rng.normal(), rng.normal()).multiplyScalar(0.28);
      d.add(perturb).normalize();
      p.addScaledVector(d, 10);
      if (p.length() > R) { d.addScaledVector(p.clone().normalize(), -1.2).normalize(); }
    }
  };
  // the chain through the focus runs along +x at the origin
  walk(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), 700);
  walk(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-1, 0, 0), 700);
  while (pts.length / 3 < total) {
    const s = new THREE.Vector3(rng.normal(), rng.normal(), rng.normal()).normalize().multiplyScalar(R * Math.cbrt(rng.float()));
    if (s.length() < 60) continue;
    walk(s, new THREE.Vector3(rng.normal(), rng.normal(), rng.normal()), 400);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts.slice(0, total * 3), 3));
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */ `uniform float uProj; uniform float uSize; out float vF;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
        float px = uSize*uProj/max(1e-3,-mv.z); vF = min(1.0, px/2.0) * smoothstep(5.0, 60.0, -mv.z);
        gl_PointSize = clamp(px, 1.0, 256.0); }`,
    fragmentShader: /* glsl */ `precision highp float; in float vF; uniform float uW; out vec4 o;
      void main(){ vec2 q=gl_PointCoord*2.0-1.0; float r2=dot(q,q); if(r2>1.0) discard;
        float a = exp(-r2*2.2)-exp(-2.2); o = vec4(vec3(0.55,0.54,0.74)*a*vF*uW*0.10, 1.0); }`,
    uniforms: { uProj: { value: 500 }, uSize: { value: 16 }, uW: { value: 1 } },
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  return p;
}

// ── nucleosome chain (nm) ─────────────────────────────────────────────────
const DNA_TUBE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv2; in vec3 vN; in vec3 vW;
uniform float uLen; uniform vec3 uLightDir;
out vec4 o;
void main(){
  float s = vUv2.x * uLen;              // nm along the DNA
  float th = vUv2.y * 6.28318530718;    // around the tube
  float a1 = 6.28318530718 * s / 3.57;  // right-handed double helix, ~10.5 bp per turn
  float r1 = pow(max(0.0, cos(th - a1)), 10.0);
  float r2 = pow(max(0.0, cos(th - a1 - 2.5)), 10.0); // minor groove ~140°
  float rung = 0.5 + 0.5*cos(6.28318530718 * s / 0.34);
  vec3 base = vec3(0.30, 0.34, 0.42) * (0.45 + 0.35*rung);
  vec3 bb = vec3(0.85, 0.72, 0.52);
  vec3 c = mix(base, bb, clamp(r1 + r2, 0.0, 1.0));
  vec3 n = normalize(vN);
  float lam = 0.25 + 0.9*max(0.0, dot(n, normalize(uLightDir)));
  float rim = pow(1.0 - abs(dot(n, normalize(cameraPosition - vW))), 3.0);
  o = vec4(c*lam + vec3(0.25,0.3,0.4)*rim*0.6, 1.0);
}`;
const DNA_TUBE_VERT = /* glsl */ `
out vec2 vUv2; out vec3 vN; out vec3 vW;
void main(){ vUv2 = uv; vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;

export function makeNucleosomes(seed: number): THREE.Group {
  const rng = new Rng(seed, 909);
  const group = new THREE.Group();
  const path: THREE.Vector3[] = [];
  const R = 4.18, pitch = 2.39, turns = 1.65;
  const octs: { c: THREE.Vector3; a: THREE.Vector3 }[] = [];
  for (let k = -4; k <= 3; k++) {
    const cx = (k + 0.5) * 19;
    const zig = k % 2 === 0 ? 1 : -1;
    const c = new THREE.Vector3(cx, zig * 6 + rng.normal() * 1.5, rng.normal() * 3 + (k === -1 || k === 0 ? 0 : 0));
    const a = new THREE.Vector3(rng.normal() * 0.4, rng.normal() * 0.3, 1).normalize();
    octs.push({ c, a });
  }
  for (let k = 0; k < octs.length; k++) {
    const { c, a } = octs[k];
    // u: from the centre toward where the DNA arrives (the −x side), orthogonalised
    const u = new THREE.Vector3(-1, 0, 0).addScaledVector(a, a.x).normalize();
    const v = new THREE.Vector3().crossVectors(a, u).normalize();
    const span = turns * Math.PI * 2;
    if (k === 4) { path.push(new THREE.Vector3(-3.5, 0, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(3.5, 0, 0)); }
    for (let i = 0; i <= 40; i++) {
      const ph = (i / 40) * span;
      const ang = -ph + Math.PI * 0.55; // left-handed: angle decreases while advancing along +a
      const q = c.clone().addScaledVector(u, R * Math.cos(ang)).addScaledVector(v, R * Math.sin(ang)).addScaledVector(a, -pitch * turns / 2 + pitch * (ph / (Math.PI * 2)));
      path.push(q);
    }
    // histone octamer: two tetramer layers of four blobs
    const cols = [0x6f86b8, 0x7fae7c, 0xc9b06e, 0xc47e6e];
    for (let layer = -1; layer <= 1; layer += 2) for (let j = 0; j < 4; j++) {
      const ang = (j / 4) * Math.PI * 2 + (layer > 0 ? Math.PI / 4 : 0);
      const pos = c.clone().addScaledVector(u, 1.6 * Math.cos(ang)).addScaledVector(v, 1.6 * Math.sin(ang)).addScaledVector(a, layer * 1.15);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.75, 24, 16), new THREE.MeshStandardMaterial({ color: cols[j], roughness: 0.65, metalness: 0 }));
      mesh.position.copy(pos);
      group.add(mesh);
    }
  }
  const curve = new THREE.CatmullRomCurve3(path, false, 'centripetal');
  const len = curve.getLength();
  const tube = new THREE.TubeGeometry(curve, Math.round(len * 5), 1.0, 12, false);
  const mat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: DNA_TUBE_VERT, fragmentShader: DNA_TUBE_FRAG, uniforms: { uLen: { value: len }, uLightDir: { value: new THREE.Vector3(0.6, 1, 0.8) } } });
  group.add(new THREE.Mesh(tube, mat));
  lights(group as unknown as THREE.Scene, 2.2);
  return group;
}

// ── atomic DNA (Å), ball-and-stick ───────────────────────────────────────
const ELEM_COL: Record<Elem, number> = { C: 0x8d877e, N: 0x5f79c2, O: 0xc4574a, P: 0xe39a3b, H: 0xd8d8d8 };
const ELEM_R: Record<Elem, number> = { C: 0.42, N: 0.42, O: 0.42, P: 0.58, H: 0.26 };

export class AtomLayer {
  group = new THREE.Group();
  spheres: THREE.InstancedMesh;
  sticks: THREE.InstancedMesh;
  hb: THREE.LineSegments;
  clip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 40);
  private baseCol: THREE.Color[] = [];
  constructor(public m: DNAModel) {
    const sg = new THREE.IcosahedronGeometry(1, 2);
    const sm = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.0, clippingPlanes: [this.clip] });
    this.spheres = new THREE.InstancedMesh(sg, sm, m.atoms.length);
    const mat4 = new THREE.Matrix4();
    m.atoms.forEach((a, i) => {
      mat4.makeScale(ELEM_R[a.e], ELEM_R[a.e], ELEM_R[a.e]).setPosition(a.x, a.y, a.z);
      this.spheres.setMatrixAt(i, mat4);
      const c = new THREE.Color(ELEM_COL[a.e]);
      this.baseCol.push(c.clone());
      this.spheres.setColorAt(i, c);
    });
    const cg = new THREE.CylinderGeometry(0.13, 0.13, 1, 8, 1);
    const cm = new THREE.MeshStandardMaterial({ roughness: 0.5, color: 0x9a948a, clippingPlanes: [this.clip] });
    this.sticks = new THREE.InstancedMesh(cg, cm, m.bonds.length);
    const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion();
    m.bonds.forEach(([u, v], i) => {
      const A = m.atoms[u], B = m.atoms[v];
      const d = new THREE.Vector3(B.x - A.x, B.y - A.y, B.z - A.z);
      const L = d.length();
      q.setFromUnitVectors(up, d.normalize());
      mat4.compose(new THREE.Vector3((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2), q, new THREE.Vector3(1, L, 1));
      this.sticks.setMatrixAt(i, mat4);
    });
    // hydrogen bonds: dashed segments
    const hp: number[] = [];
    for (const [u, v] of m.hbonds) {
      const A = m.atoms[u], B = m.atoms[v];
      for (let k = 0; k < 6; k++) {
        const t0 = (k + 0.15) / 6, t1 = (k + 0.6) / 6;
        hp.push(A.x + (B.x - A.x) * t0, A.y + (B.y - A.y) * t0, A.z + (B.z - A.z) * t0, A.x + (B.x - A.x) * t1, A.y + (B.y - A.y) * t1, A.z + (B.z - A.z) * t1);
      }
    }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
    this.hb = new THREE.LineSegments(hg, new THREE.LineBasicMaterial({ color: 0xf2e6c8, transparent: true, opacity: 0, clippingPlanes: [this.clip] }));
    this.group.add(this.spheres, this.sticks, this.hb);
    lights(this.group as unknown as THREE.Scene, 2.4);
  }
  /** dim everything outside the focus base pair */
  focus(k: number, hbOpacity: number) {
    const set = new Set(this.m.focusPair);
    const c = new THREE.Color();
    this.m.atoms.forEach((a, i) => {
      const f = set.has(i) || a.bp === this.m.atoms[this.m.focusH1].bp ? 1 : 1 - 0.94 * k;
      c.copy(this.baseCol[i]).multiplyScalar(f);
      this.spheres.setColorAt(i, c);
    });
    this.spheres.instanceColor!.needsUpdate = true;
    (this.hb.material as THREE.LineBasicMaterial).opacity = hbOpacity;
  }
  dispose() { this.spheres.geometry.dispose(); (this.spheres.material as THREE.Material).dispose(); this.sticks.geometry.dispose(); (this.sticks.material as THREE.Material).dispose(); this.hb.geometry.dispose(); (this.hb.material as THREE.Material).dispose(); }
}

// ── electron density volume (Å) ──────────────────────────────────────────
const DENS_FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;
in vec2 vUv; out vec4 o;
uniform vec3 camPos; uniform mat3 camRot; uniform float tanHalf; uniform float aspect;
uniform sampler3D tDens; uniform vec3 boxC; uniform float boxH; uniform float uIso; uniform float uW; uniform float uSteps;
uniform float uLevel;
${COMMON}
float dens(vec3 p){
  vec3 q = (p - boxC)/(2.0*boxH) + 0.5;
  float win = smoothstep(boxH*0.62, boxH*0.35, length(p - boxC));
  return texture(tDens, q).r * win;
}
vec3 grad(vec3 p){
  float e = boxH/60.0;
  return vec3(dens(p+vec3(e,0,0))-dens(p-vec3(e,0,0)), dens(p+vec3(0,e,0))-dens(p-vec3(0,e,0)), dens(p+vec3(0,0,e))-dens(p-vec3(0,0,e)));
}
void main(){
  vec2 ndc = vUv*2.0 - 1.0;
  vec3 rd = normalize(camRot * vec3(ndc.x*tanHalf*aspect, ndc.y*tanHalf, -1.0));
  vec3 ro = camPos;
  vec3 inv = 1.0/rd;
  vec3 t0 = (boxC - boxH - ro)*inv, t1 = (boxC + boxH - ro)*inv;
  vec3 tmin = min(t0,t1), tmax = max(t0,t1);
  float a = max(max(tmin.x, tmin.y), max(tmin.z, 0.0)), b = min(min(tmax.x, tmax.y), tmax.z);
  if (b <= a) { o = vec4(0,0,0,1); return; }
  float dt = (b - a)/uSteps;
  float j = float(uhash3(uvec3(uvec2(gl_FragCoord.xy), 3u)) & 0xffffu)/65535.0;
  vec3 acc = vec3(0.0); float tr = 1.0;
  vec3 surf = vec3(0.0); bool hit = false;
  float prev = 0.0;
  for (int i = 0; i < 160; i++) {
    if (float(i) >= uSteps) break;
    float t = a + (float(i)+j)*dt;
    vec3 p = ro + rd*t;
    float d = dens(p);
    // density cloud (dim, soft)
    acc += tr * vec3(0.50, 0.66, 1.0) * pow(d, 1.2) * dt * 0.35;
    tr *= exp(-pow(d, 1.2) * dt * 0.9);
    // isosurface: first crossing of the level, refined by one secant step
    if (!hit && d > uLevel && prev <= uLevel) {
      float f = (uLevel - prev)/max(1e-5, d - prev);
      vec3 ps = ro + rd*(t - dt*(1.0 - f));
      vec3 n = -normalize(grad(ps));
      vec3 L = normalize(vec3(0.5, 0.8, 0.6));
      float lam = 0.18 + 0.8*max(0.0, dot(n, L));
      float rim = pow(1.0 - abs(dot(n, -rd)), 2.5);
      surf = tr * (vec3(0.80, 0.72, 0.58)*lam*0.30 + vec3(0.55, 0.65, 0.9)*rim*0.25);
      hit = true;
    }
    prev = d;
    if (tr < 0.03) break;
  }
  vec3 c = mix(acc, surf + acc*0.25, uIso);
  o = vec4(c * uW, 1.0);
}`;

export class DensityLayer {
  tex: THREE.Data3DTexture;
  mat: THREE.ShaderMaterial;
  pass: FullscreenPass;
  constructor(data: Float32Array, N: number, center: THREE.Vector3, half: number) {
    const half16 = new Uint16Array(data.length);
    for (let i = 0; i < data.length; i++) half16[i] = THREE.DataUtils.toHalfFloat(data[i]);
    this.tex = new THREE.Data3DTexture(half16, N, N, N);
    this.tex.format = THREE.RedFormat;
    this.tex.type = THREE.HalfFloatType;
    this.tex.minFilter = this.tex.magFilter = THREE.LinearFilter;
    this.tex.wrapS = this.tex.wrapT = this.tex.wrapR = THREE.ClampToEdgeWrapping;
    this.tex.unpackAlignment = 1;
    this.tex.needsUpdate = true;
    this.mat = shaderMat(DENS_FRAG, {
      camPos: { value: new THREE.Vector3() }, camRot: { value: new THREE.Matrix3() }, tanHalf: { value: 0.4 }, aspect: { value: 16 / 9 },
      tDens: { value: this.tex }, boxC: { value: center.clone() }, boxH: { value: half }, uIso: { value: 0 }, uW: { value: 1 }, uSteps: { value: 72 }, uLevel: { value: 0.07 },
    }, { blending: THREE.AdditiveBlending, transparent: true });
    this.pass = new FullscreenPass(this.mat);
  }
  dispose() { this.tex.dispose(); this.mat.dispose(); }
}

// The cell in 3D (units: µm; world = (x_cell, height, −y_cell), y up). Two representations blend:
// uStruct = 0 → fluorescence image (the same colours the retina recorded); 1 → structural model
// with translucent membranes, crowded cytoplasm and physically motivated rim lighting.
import * as THREE from 'three';
import type { CellModel } from '../../content/cellModel';
import { Rng } from '../../engine/prng';

export const toWorld = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);

const SHELL_VERT = /* glsl */ `
out vec3 vN; out vec3 vV; out vec3 vP;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const SHELL_FRAG = /* glsl */ `
precision highp float;
in vec3 vN; in vec3 vV; in vec3 vP;
uniform vec3 uFluo; uniform vec3 uStructCol; uniform float uStruct; uniform float uWeight; uniform float uFluoGain; uniform float uRim;
uniform float uNear;
out vec4 o;
void main(){
  vec3 n = normalize(vN);
  float f = 1.0 - abs(dot(n, normalize(vV)));
  float rim = pow(f, 2.5);
  // fluorescence: flat emissive (projected thickness ~ 1/|n·v|), structural: rim-lit translucent shell
  float thick = 1.0 / max(0.25, abs(dot(n, normalize(vV))));
  vec3 fl = uFluo * uFluoGain * thick * 0.5;
  vec3 st = uStructCol * (0.025 + uRim*rim) ;
  float fade = smoothstep(0.0, uNear, length(cameraPosition - vP));
  o = vec4(mix(fl, st, uStruct) * uWeight * fade, 1.0);
}`;

function shellMaterial(fluo: THREE.ColorRepresentation, struct: THREE.ColorRepresentation, fluoGain: number, rim: number) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG,
    uniforms: { uFluo: { value: new THREE.Color(fluo) }, uStructCol: { value: new THREE.Color(struct) }, uStruct: { value: 0 }, uWeight: { value: 1 }, uFluoGain: { value: fluoGain }, uRim: { value: rim }, uNear: { value: 0.01 } },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

const MITO_FRAG = /* glsl */ `
precision highp float;
in vec3 vN; in vec3 vV; in vec3 vL;
uniform float uStruct; uniform float uWeight;
out vec4 o;
void main(){
  vec3 n = normalize(vN);
  float nv = abs(dot(n, normalize(vV)));
  float rim = pow(1.0 - nv, 2.0);
  vec3 fl = vec3(0.75, 0.30, 0.06) * 0.8 * (0.4 + 0.6/max(0.3, nv)) * 0.5;
  // cristae: folds across the long axis, visible in the structural view
  float cr = smoothstep(0.55, 1.0, sin(vL.y * 26.0 + sin(vL.x*9.0)*0.8));
  vec3 st = vec3(0.55, 0.20, 0.10) * (0.10 + 0.9*rim) + vec3(0.35, 0.12, 0.06) * cr * 0.25 * (1.0 - rim);
  o = vec4(mix(fl, st, uStruct) * uWeight, 1.0);
}`;
const MITO_VERT = /* glsl */ `
out vec3 vN; out vec3 vV; out vec3 vL;
void main(){
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  vL = position;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export class CellLayer {
  group = new THREE.Group();
  membrane: THREE.Mesh;
  nucleus: THREE.Mesh;
  nucleoli: THREE.Mesh[] = [];
  mitos: THREE.InstancedMesh;
  tubules: THREE.LineSegments;
  crowd: THREE.Points;
  mats: THREE.ShaderMaterial[] = [];

  constructor(public cell: CellModel, seed: number, particleScale: number) {
    // membrane dome
    const NR = 40, NT = 128;
    const pos: number[] = [], idx: number[] = [];
    for (const top of [1, -1]) {
      const base = pos.length / 3;
      for (let i = 0; i <= NR; i++) {
        const q = Math.sin((i / NR) * Math.PI / 2); // denser near the rim
        for (let j = 0; j < NT; j++) {
          const th = (j / NT) * Math.PI * 2;
          const R = cell.outline(th) * q;
          const x = R * Math.cos(th), y = R * Math.sin(th);
          const h = cell.thickness(x * 0.999, y * 0.999);
          const w = toWorld(x, y, top > 0 ? h : -0.3 * h);
          pos.push(w.x, w.y, w.z);
        }
      }
      for (let i = 0; i < NR; i++) for (let j = 0; j < NT; j++) {
        const a = base + i * NT + j, b = base + i * NT + ((j + 1) % NT), c = a + NT, d = b + NT;
        if (top > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
      }
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    mg.setIndex(idx);
    mg.computeVertexNormals();
    const memMat = shellMaterial(0x0d1216, 0xb8c4cc, 0.35, 0.55);
    this.membrane = new THREE.Mesh(mg, memMat);
    this.mats.push(memMat);

    // nucleus
    const n = cell.nucleus;
    const ng = new THREE.SphereGeometry(1, 64, 40);
    const nucMat = shellMaterial(0x14307a, 0x7d82b8, 0.4, 0.45);
    this.nucleus = new THREE.Mesh(ng, nucMat);
    this.nucleus.position.copy(toWorld(n.x, n.y, n.z));
    this.nucleus.scale.set(n.a, n.c, n.b);
    this.nucleus.rotation.y = n.ang;
    this.mats.push(nucMat);
    for (const nu of cell.nucleoli) {
      const m = shellMaterial(0x000000, 0x8b7fb8, 0, 0.5);
      const s = new THREE.Mesh(new THREE.SphereGeometry(nu.r, 32, 20), m);
      s.position.copy(toWorld(nu.x, nu.y, nu.z));
      this.nucleoli.push(s);
      this.mats.push(m);
    }

    // mitochondria (instanced capsules)
    const cap = new THREE.CapsuleGeometry(0.5, 1, 6, 16);
    const mitoMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: MITO_VERT, fragmentShader: MITO_FRAG,
      uniforms: { uStruct: { value: 0 }, uWeight: { value: 1 } },
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    this.mats.push(mitoMat);
    this.mitos = new THREE.InstancedMesh(cap, mitoMat, cell.mitos.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    cell.mitos.forEach((mt, i) => {
      // capsule axis is y; lay it in the cell plane along angle mt.ang
      e.set(0, 0, 0);
      q.setFromEuler(new THREE.Euler(Math.PI / 2 + mt.tilt, 0, 0));
      const qr = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), mt.ang + Math.PI / 2);
      const qq = qr.multiply(q);
      m4.compose(toWorld(mt.x, mt.y, mt.z), qq, new THREE.Vector3(mt.w, mt.len / 2, mt.w));
      this.mitos.setMatrixAt(i, m4);
    });
    this.mitos.instanceMatrix.needsUpdate = true;
    this.mitos.frustumCulled = false;

    // microtubules
    const lp: number[] = [];
    for (const f of cell.microtubules) {
      const p = f.pts;
      for (let i = 0; i + 5 < p.length; i += 3) {
        const a = toWorld(p[i], p[i + 1], p[i + 2]), b = toWorld(p[i + 3], p[i + 4], p[i + 5]);
        lp.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    const tubMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: `void main(){ gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `precision highp float; uniform float uStruct; uniform float uWeight; out vec4 o;
        void main(){ o = vec4(mix(vec3(0.06,0.32,0.09)*0.7, vec3(0.42,0.46,0.44)*0.35, uStruct)*uWeight, 1.0); }`,
      uniforms: { uStruct: { value: 0 }, uWeight: { value: 1 } },
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    this.mats.push(tubMat);
    this.tubules = new THREE.LineSegments(lg, tubMat);

    // crowded cytoplasm: macromolecules as small soft points
    const rng = new Rng(seed, 606);
    const N = Math.round(60000 * Math.min(2, particleScale));
    const cp = new Float32Array(N * 3), cc = new Float32Array(N * 3), ph = new Float32Array(N);
    const nuc = cell.nucleus;
    let k = 0, guard = 0;
    while (k < N && guard++ < N * 20) {
      const th = rng.range(0, Math.PI * 2);
      const rr = Math.sqrt(rng.float()) * cell.outline(th) * 0.97;
      const x = rr * Math.cos(th), y = rr * Math.sin(th);
      const h = cell.thickness(x, y);
      if (h < 0.1) continue;
      const z = rng.range(-0.3 * h, h) * 0.95;
      const cs = Math.cos(-nuc.ang), sn = Math.sin(-nuc.ang);
      const dx = x - nuc.x, dy = y - nuc.y;
      const u = (dx * cs - dy * sn) / (nuc.a + 0.15), v = (dx * sn + dy * cs) / (nuc.b + 0.15), w = (z - nuc.z) / (nuc.c + 0.15);
      if (u * u + v * v + w * w < 1) continue;
      const p = toWorld(x, y, z);
      cp[k * 3] = p.x; cp[k * 3 + 1] = p.y; cp[k * 3 + 2] = p.z;
      const hue = rng.float();
      const col = hue < 0.33 ? [0.62, 0.55, 0.45] : hue < 0.66 ? [0.45, 0.55, 0.62] : [0.60, 0.50, 0.58];
      cc[k * 3] = col[0]; cc[k * 3 + 1] = col[1]; cc[k * 3 + 2] = col[2];
      ph[k] = rng.float() * 100;
      k++;
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(cp.subarray(0, k * 3), 3));
    cg.setAttribute('aCol', new THREE.BufferAttribute(cc.subarray(0, k * 3), 3));
    cg.setAttribute('aPh', new THREE.BufferAttribute(ph.subarray(0, k), 1));
    const crowdMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: /* glsl */ `
        in vec3 aCol; in float aPh; uniform float uTime; uniform float uProj; uniform float uSize;
        out vec3 vC; out float vF;
        void main(){
          vec3 p = position + 0.035*vec3(sin(uTime*2.3+aPh), sin(uTime*1.9+aPh*1.7), sin(uTime*2.7+aPh*2.3));
          vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv;
          float px = uSize*uProj/max(1e-4,-mv.z);
          vF = smoothstep(0.5, 2.5, px) * smoothstep(0.02, 0.3, -mv.z);
          gl_PointSize = clamp(px, 1.0, 64.0); vC = aCol; }`,
      fragmentShader: /* glsl */ `precision highp float; in vec3 vC; in float vF; uniform float uWeight; out vec4 o;
        void main(){ vec2 q=gl_PointCoord*2.0-1.0; float r2=dot(q,q); if(r2>1.0) discard;
          float a = exp(-r2*3.0)-exp(-3.0); o = vec4(vC*a*vF*uWeight*0.18, 1.0); }`,
      uniforms: { uTime: { value: 0 }, uProj: { value: 500 }, uSize: { value: 0.07 }, uWeight: { value: 0 } },
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    this.mats.push(crowdMat);
    this.crowd = new THREE.Points(cg, crowdMat);
    this.crowd.frustumCulled = false;

    this.group.add(this.membrane, this.nucleus, ...this.nucleoli, this.mitos, this.tubules, this.crowd);
  }

  set(structMix: number, weight: number, crowdW: number, nucleusW: number, time: number, proj: number) {
    for (const m of this.mats) {
      if (m.uniforms.uStruct) m.uniforms.uStruct.value = structMix;
      if (m.uniforms.uWeight) m.uniforms.uWeight.value = weight;
    }
    (this.nucleus.material as THREE.ShaderMaterial).uniforms.uWeight.value = weight * nucleusW;
    for (const s of this.nucleoli) (s.material as THREE.ShaderMaterial).uniforms.uWeight.value = weight * nucleusW * structMix;
    const cu = (this.crowd.material as THREE.ShaderMaterial).uniforms;
    cu.uWeight.value = weight * crowdW;
    cu.uTime.value = time;
    cu.uProj.value = proj;
  }

  dispose() {
    this.group.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    for (const m of this.mats) m.dispose();
  }
}

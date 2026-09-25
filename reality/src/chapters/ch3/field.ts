// A scalar field on a lattice. φ(x,y,t) = small vacuum mode jitter (illustrative) + optionally one
// standing mode + a wavepacket that is literally a sum of Klein–Gordon modes
// cos(k·x − ω_k t) with ω_k = √(m² + k²), so its dispersion is exact.
import * as THREE from 'three';
import { Rng } from '../../engine/prng';

export const FIELD_MASS = 0.55;
const NM = 24;   // vacuum modes
const NP = 25;   // modes in the packet

const VERT = /* glsl */ `
uniform float t; uniform vec4 vac[${NM}]; uniform vec4 pk[${NP}]; uniform float uVac, uMode, uPacket, uX0, uSy, uModeK, uAmp;
out float vPhi; out float vEdge;
float phi(vec2 p){
  float s = 0.0;
  for (int i = 0; i < ${NM}; i++) { vec4 m = vac[i]; float w = sqrt(${(FIELD_MASS * FIELD_MASS).toFixed(4)} + dot(m.xy, m.xy)); s += m.z * cos(dot(m.xy, p) - w*t + m.w); }
  s *= uVac * 0.22;
  float wm = sqrt(${(FIELD_MASS * FIELD_MASS).toFixed(4)} + uModeK*uModeK);
  s += uMode * 1.1 * cos(uModeK * p.x) * cos(wm * t);
  float pack = 0.0;
  for (int j = 0; j < ${NP}; j++) { vec4 m = pk[j]; float w = sqrt(${(FIELD_MASS * FIELD_MASS).toFixed(4)} + m.x*m.x); pack += m.y * cos(m.x*(p.x - uX0) - w*t); }
  s += uPacket * pack * exp(-p.y*p.y/(2.0*uSy*uSy));
  return s * uAmp;
}
void main(){
  vec3 p = position;
  float f = phi(p.xz);
  vPhi = f;
  vEdge = smoothstep(58.0, 44.0, abs(p.x)) * smoothstep(38.0, 28.0, abs(p.z));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p.x, f, p.z, 1.0);
  gl_PointSize = 3.0;
}`;

const FRAG = /* glsl */ `
precision highp float;
in float vPhi; in float vEdge; uniform float uW; uniform float uPoints;
out vec4 o;
void main(){
  vec3 pos = vec3(1.0, 0.66, 0.40), neg = vec3(0.40, 0.62, 1.0);
  float a = clamp(abs(vPhi)*0.9, 0.0, 1.0);
  vec3 c = mix(vec3(0.34, 0.36, 0.40), vPhi > 0.0 ? pos : neg, a) * (0.25 + 1.4*a);
  if (uPoints > 0.5) { vec2 q = gl_PointCoord*2.0-1.0; if (dot(q,q) > 1.0) discard; c *= 1.6; }
  o = vec4(c * vEdge * uW, 1.0);
}`;

export class FieldLattice {
  group = new THREE.Group();
  lines: THREE.LineSegments;
  points: THREE.Points;
  mat: THREE.ShaderMaterial;
  pmat: THREE.ShaderMaterial;
  constructor(seed: number) {
    const rng = new Rng(seed, 1201);
    const nx = 116, nz = 76;
    const pos: number[] = [];
    const P = (i: number, j: number) => [i - nx / 2, 0, j - nz / 2];
    for (let j = 0; j <= nz; j++) for (let i = 0; i < nx; i++) pos.push(...P(i, j), ...P(i + 1, j));
    for (let i = 0; i <= nx; i++) for (let j = 0; j < nz; j++) pos.push(...P(i, j), ...P(i, j + 1));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const pp: number[] = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) pp.push(...P(i, j));
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
    const vac = Array.from({ length: NM }, () => {
      const k = rng.range(0.15, 1.2), a = rng.range(0, Math.PI * 2);
      const w = Math.sqrt(FIELD_MASS * FIELD_MASS + k * k);
      return new THREE.Vector4(k * Math.cos(a), k * Math.sin(a), 0.07 / Math.sqrt(w) * rng.range(0.6, 1.4), rng.range(0, Math.PI * 2));
    });
    const k0 = 0.9, sigma = 5.5;
    const pk = Array.from({ length: NP }, (_, j) => {
      const dk = ((j - (NP - 1) / 2) / ((NP - 1) / 2)) * (3 / sigma);
      const gw = Math.exp(-(dk * dk) * sigma * sigma / 2);
      return new THREE.Vector4(k0 + dk, gw, 0, 0);
    });
    const norm = pk.reduce((s, v) => s + v.y, 0);
    for (const v of pk) v.y /= norm;
    const uniforms = {
      t: { value: 0 }, vac: { value: vac }, pk: { value: pk }, uVac: { value: 1 }, uMode: { value: 0 }, uPacket: { value: 0 },
      uX0: { value: -40 }, uSy: { value: 5 }, uModeK: { value: (2 * Math.PI) / 23 }, uAmp: { value: 2.4 }, uW: { value: 1 }, uPoints: { value: 0 },
    };
    this.mat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
    this.pmat = this.mat.clone();
    this.pmat.uniforms = { ...THREE.UniformsUtils.clone(uniforms), vac: { value: vac }, pk: { value: pk } };
    this.pmat.uniforms.uPoints.value = 1;
    this.lines = new THREE.LineSegments(g, this.mat);
    this.points = new THREE.Points(pg, this.pmat);
    this.lines.frustumCulled = this.points.frustumCulled = false;
    this.group.add(this.lines, this.points);
  }
  set(t: number, vac: number, mode: number, packet: number, weight: number) {
    for (const m of [this.mat, this.pmat]) {
      const u = m.uniforms;
      u.t.value = t; u.uVac.value = vac; u.uMode.value = mode; u.uPacket.value = packet; u.uW.value = weight * (m === this.pmat ? 0.35 : 0.22);
    }
  }
  dispose() { this.lines.geometry.dispose(); this.points.geometry.dispose(); this.mat.dispose(); this.pmat.dispose(); }
}

// Volumetric hydrogen orbital: raymarched |ψ|² (emission), optionally phase-coloured, rendered
// at reduced resolution and composited additively. World units: Bohr radii (a0).
import * as THREE from 'three';
import { FullscreenPass, hdrTarget, shaderMat } from '../../engine/post';
import { COMMON } from '../../shaders/common';
import { HYDROGEN } from '../../shaders/hydrogen';
import { psi, energyEV } from '../../math/hydrogen';

export interface Term { n: number; l: number; m: number; c: number }
export type State = Term[]; // up to two terms

const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform vec3 camPos; uniform mat3 camRot; uniform float tanHalf; uniform float aspect;
uniform ivec3 qA0, qA1, qB0, qB1;   // (n,l,m) per term
uniform vec2 cA0, cA1, cB0, cB1;    // complex coefficients (time phase included)
uniform float normA, normB, uMix, uRadius, uExposure, uPhase, uSteps, uCut;
uniform vec3 uTint;
${COMMON}
${HYDROGEN}
vec2 psiState(ivec3 q0, ivec3 q1, vec2 c0, vec2 c1, vec3 p){
  vec2 s = cmul(c0, psiNLM(q0.x, q0.y, q0.z, p));
  if (q1.x > 0) s += cmul(c1, psiNLM(q1.x, q1.y, q1.z, p));
  return s;
}
void main(){
  vec2 ndc = vUv*2.0 - 1.0;
  vec3 rd = normalize(camRot * vec3(ndc.x*tanHalf*aspect, ndc.y*tanHalf, -1.0));
  vec3 ro = camPos;
  float b = dot(ro, rd); float c = dot(ro, ro) - uRadius*uRadius; float h = b*b - c;
  if (h <= 0.0) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  h = sqrt(h);
  float t0 = max(0.0, -b - h), t1 = -b + h;
  if (t1 <= 0.0) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  int N = int(uSteps);
  float dt = (t1 - t0) / uSteps;
  float jitter = float(uhash3(uvec3(uvec2(gl_FragCoord.xy), 7u)) & 0xffffu) / 65535.0;
  vec3 acc = vec3(0.0);
  float trans = 1.0;
  for (int i = 0; i < 160; i++) {
    if (i >= N) break;
    vec3 p = ro + rd*(t0 + (float(i) + jitter)*dt);
    if (uCut > 0.5 && p.x > 0.0 && p.z > 0.0) continue; // cut-away quadrant to show interior nodes
    vec3 col = vec3(0.0); float dens = 0.0;
    if (uMix < 0.999) {
      vec2 s = psiState(qA0, qA1, cA0, cA1, p);
      float d = dot(s, s) * normA;
      float ph = atan(s.y, s.x) / 6.28318530718 + 0.5;
      col += (1.0 - uMix) * d * mix(uTint, phaseColor(ph), uPhase);
      dens += (1.0 - uMix) * d;
    }
    if (uMix > 0.001) {
      vec2 s = psiState(qB0, qB1, cB0, cB1, p);
      float d = dot(s, s) * normB;
      float ph = atan(s.y, s.x) / 6.28318530718 + 0.5;
      col += uMix * d * mix(uTint, phaseColor(ph), uPhase);
      dens += uMix * d;
    }
    float k = pow(max(dens, 0.0), 0.75);
    float dl = dt / uRadius * 7.0; // emission per normalised path length: same brightness for any orbital size
    acc += trans * col / max(dens, 1e-9) * k * dl * uExposure;
    trans *= exp(-k * dl * 0.45 * uExposure);
    if (trans < 0.02) break;
  }
  o = vec4(acc, 1.0);
}`;

const COMP = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tSrc; uniform float weight;
void main(){ o = vec4(texture(tSrc, vUv).rgb * weight, 1.0); }`;

/** max of |ψ|² over a coarse grid (for display normalisation) */
const normCache = new Map<string, number>();
export function stateNorm(st: State): number {
  const key = st.map((t) => `${t.n}${t.l}${t.m}:${t.c.toFixed(3)}`).join('|');
  const hit = normCache.get(key);
  if (hit) return hit;
  const nmax = Math.max(...st.map((t) => t.n));
  const R = nmax * nmax * 2.6 + 4;
  let m = 1e-30;
  const N = 36;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const x = ((i + 0.5) / N * 2 - 1) * R, y = ((j + 0.5) / N * 2 - 1) * R, z = ((k + 0.5) / N * 2 - 1) * R;
    let re = 0, im = 0;
    for (const t of st) { const [a, b] = psi(t.n, t.l, t.m, x, y, z); re += t.c * a; im += t.c * b; }
    const d = re * re + im * im;
    if (d > m) m = d;
  }
  // points very near the nucleus for s states
  for (const t of st) if (t.l === 0) { const [a] = psi(t.n, 0, 0, 0.05, 0, 0); m = Math.max(m, (t.c * a) ** 2); }
  normCache.set(key, 1 / m);
  return 1 / m;
}

export function stateRadius(st: State) {
  const nmax = Math.max(...st.map((t) => t.n));
  return nmax * nmax * 2.4 + 5;
}

/** time-dependent coefficient c·e^{-i(E−E_ref)t/ħ}. The global phase is unobservable, so phases are
 *  measured relative to the first term (a gauge choice); `slow` = physical seconds per displayed second. */
export function phaseCoeff(t: Term, time: number, slow: number, eRef: number): [number, number] {
  const HBAR_EVS = 6.582119569e-16;
  const w = (energyEV(t.n) - eRef) / HBAR_EVS;
  const ph = -w * time * slow;
  return [t.c * Math.cos(ph), t.c * Math.sin(ph)];
}

export class OrbitalVolume {
  rt: THREE.WebGLRenderTarget;
  mat: THREE.ShaderMaterial;
  pass: FullscreenPass;
  comp: FullscreenPass;
  scale: number;
  constructor(scale = 0.5) {
    this.scale = scale;
    this.rt = hdrTarget(2, 2, 0, false);
    this.mat = shaderMat(FRAG, {
      camPos: { value: new THREE.Vector3() }, camRot: { value: new THREE.Matrix3() }, tanHalf: { value: 0.4 }, aspect: { value: 16 / 9 },
      qA0: { value: new THREE.Vector3(1, 0, 0) }, qA1: { value: new THREE.Vector3(0, 0, 0) },
      qB0: { value: new THREE.Vector3(1, 0, 0) }, qB1: { value: new THREE.Vector3(0, 0, 0) },
      cA0: { value: new THREE.Vector2(1, 0) }, cA1: { value: new THREE.Vector2() }, cB0: { value: new THREE.Vector2(1, 0) }, cB1: { value: new THREE.Vector2() },
      normA: { value: 1 }, normB: { value: 1 }, uMix: { value: 0 }, uRadius: { value: 10 }, uExposure: { value: 1 }, uPhase: { value: 0 }, uSteps: { value: 64 },
      uCut: { value: 0 }, uTint: { value: new THREE.Color(1.0, 0.86, 0.7) },
    });
    this.pass = new FullscreenPass(this.mat);
    this.comp = new FullscreenPass(shaderMat(COMP, { tSrc: { value: this.rt.texture }, weight: { value: 1 } }, { blending: THREE.AdditiveBlending, transparent: true }));
  }
  setSize(w: number, h: number) {
    const W = Math.max(2, Math.round(w * this.scale)), H = Math.max(2, Math.round(h * this.scale));
    if (this.rt.width !== W || this.rt.height !== H) this.rt.setSize(W, H);
  }
  setCamera(cam: THREE.PerspectiveCamera, aspect: number) {
    const u = this.mat.uniforms;
    u.camPos.value.copy(cam.position);
    u.camRot.value.setFromMatrix4(cam.matrixWorld);
    u.tanHalf.value = Math.tan((cam.fov * Math.PI) / 360);
    u.aspect.value = aspect;
  }
  private setState(prefix: 'A' | 'B', st: State, time: number, slow: number) {
    const u = this.mat.uniforms;
    const t0 = st[0], t1 = st[1];
    const eRef = energyEV(t0.n);
    u[`q${prefix}0`].value.set(t0.n, t0.l, t0.m);
    const c0 = phaseCoeff(t0, time, slow, eRef);
    u[`c${prefix}0`].value.set(c0[0], c0[1]);
    if (t1) {
      u[`q${prefix}1`].value.set(t1.n, t1.l, t1.m);
      const c1 = phaseCoeff(t1, time, slow, eRef);
      u[`c${prefix}1`].value.set(c1[0], c1[1]);
    } else u[`q${prefix}1`].value.set(0, 0, 0);
    u[`norm${prefix}`].value = stateNorm(st);
  }
  set(a: State, b: State | null, mix: number, time: number, slow: number) {
    this.setState('A', a, time, slow);
    this.setState('B', b ?? a, time, slow);
    this.mat.uniforms.uMix.value = b ? mix : 0;
    this.mat.uniforms.uRadius.value = Math.max(stateRadius(a), b ? stateRadius(b) : 0);
  }
  render(r: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, weight: number) {
    this.pass.render(r, this.rt);
    this.comp.material.uniforms.weight.value = weight;
    this.comp.render(r, target);
  }
  dispose() { this.rt.dispose(); this.mat.dispose(); this.comp.material.dispose(); }
}

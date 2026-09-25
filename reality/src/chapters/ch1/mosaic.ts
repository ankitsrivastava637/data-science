// Cone mosaic rendering (units: µm). Each cone is a soft spot (waveguided light, as in
// adaptive-optics images). Modes blend: plain → false colour by type → photon counts →
// reconstructed colour (the continuous image the visual system builds from the samples).
import * as THREE from 'three';
import type { MosaicJob } from '../../engine/jobs';

const VERT = /* glsl */ `
precision highp float;
in vec2 aPos; in float aSize; in float aType; in float aCount; in float aFlash; in vec3 aRecon; in float aExpect;
uniform float uProj; uniform float uFalse; uniform float uPhoton; uniform float uRecon; uniform float uSpread;
uniform float uGain;
out vec3 vCol; out float vSharp;
void main(){
  vec4 mv = modelViewMatrix * vec4(aPos, 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
  float spread = mix(0.62, 2.4, uSpread);
  float px = aSize * spread * uProj / max(1e-6, -mv.z);
  gl_PointSize = clamp(px, 1.0, 256.0);
  // brightness compensation when a sprite is sub-pixel
  float sub = min(1.0, px / 1.5);
  vec3 typeCol = aType < 0.5 ? vec3(1.0, 0.36, 0.22) : aType < 1.5 ? vec3(0.42, 0.95, 0.35) : vec3(0.28, 0.45, 1.0);
  vec3 plain = vec3(0.85, 0.82, 0.76);
  vec3 base = mix(plain, typeCol, uFalse);
  // photon mode: dim resting level + accumulated count + brief absorption flash
  float lvl = mix(1.0, 0.10 + min(1.0, aCount / 9.0) * 1.3, uPhoton);
  vec3 c = base * lvl + typeCol * aFlash * 2.4 * uPhoton;
  // reconstruction: local colour estimate (the source colour, weighted by this cone's noisy count)
  float est = aCount / max(0.5, aExpect);
  vec3 rec = aRecon * uGain * mix(1.0, est, 0.35);
  c = mix(c, rec, uRecon);
  vCol = c * sub;
  vSharp = mix(5.0, 2.2, uSpread);
}`;

const FRAG = /* glsl */ `
precision highp float;
in vec3 vCol; in float vSharp;
uniform float uWeight;
out vec4 o;
void main(){
  vec2 q = gl_PointCoord*2.0 - 1.0;
  float r2 = dot(q,q);
  if (r2 > 1.0) discard;
  float a = exp(-r2*vSharp) - exp(-vSharp);
  o = vec4(vCol * a * uWeight, 1.0);
}`;

export class MosaicLayer {
  points: THREE.Points;
  mat: THREE.ShaderMaterial;
  counts: Float32Array;
  flash: Float32Array;
  private countAttr: THREE.BufferAttribute;
  private flashAttr: THREE.BufferAttribute;
  constructor(private job: MosaicJob) {
    const m = job.mosaic;
    const g = new THREE.BufferGeometry();
    g.setAttribute('aPos', new THREE.BufferAttribute(m.pos, 2));
    g.setAttribute('aSize', new THREE.BufferAttribute(m.size, 1));
    g.setAttribute('aType', new THREE.BufferAttribute(new Float32Array(m.type), 1));
    g.setAttribute('aRecon', new THREE.BufferAttribute(job.recon, 3));
    g.setAttribute('aExpect', new THREE.BufferAttribute(job.expected, 1));
    this.counts = new Float32Array(m.count);
    this.flash = new Float32Array(m.count);
    this.countAttr = new THREE.BufferAttribute(this.counts, 1).setUsage(THREE.DynamicDrawUsage);
    this.flashAttr = new THREE.BufferAttribute(this.flash, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aCount', this.countAttr);
    g.setAttribute('aFlash', this.flashAttr);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(m.count * 3), 3));
    this.mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uProj: { value: 500 }, uFalse: { value: 0 }, uPhoton: { value: 0 }, uRecon: { value: 0 }, uSpread: { value: 0 }, uWeight: { value: 1 }, uGain: { value: 3.0 } },
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
  }

  /** photon counts/flashes at exposure τ; tauInv maps exposure back to seconds for flash ages */
  setExposure(tau: number, lt: number, tauInv: (x: number) => number, flashDur: number) {
    const { times, K } = this.job.events;
    const n = this.counts.length;
    for (let i = 0; i < n; i++) {
      const base = i * K;
      let lo = 0, hi = K; // count of events ≤ tau (binary search in a sorted, Inf-padded row)
      while (lo < hi) { const mid = (lo + hi) >> 1; if (times[base + mid] <= tau) lo = mid + 1; else hi = mid; }
      this.counts[i] = lo;
      let f = 0;
      if (lo > 0 && tau > 0) {
        const age = lt - tauInv(times[base + lo - 1]);
        if (age >= 0 && age < flashDur * 5) f = Math.exp(-age / flashDur);
      }
      this.flash[i] = f;
    }
    this.countAttr.needsUpdate = true;
    this.flashAttr.needsUpdate = true;
  }

  dispose() { this.points.geometry.dispose(); this.mat.dispose(); }
}

/** Translucent inner-retina neurons around the foveal pit (absent in the pit centre). */
export function makeInnerRetina(seed: number, count: number): THREE.Points {
  const pos = new Float32Array(count * 3), size = new Float32Array(count);
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < count; i++) {
    let r = 0;
    for (;;) { r = 90 + rnd() * 700; if (rnd() < Math.min(1, (r - 90) / 250) * Math.exp(-Math.max(0, r - 450) / 350)) break; }
    const a = rnd() * Math.PI * 2;
    const rim = Math.min(1, (r - 90) / 300);
    pos[i * 3] = r * Math.cos(a); pos[i * 3 + 1] = r * Math.sin(a);
    pos[i * 3 + 2] = 25 + rnd() * (40 + 180 * rim);
    size[i] = 9 + rnd() * 9;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */ `
      in float aSize; uniform float uProj; out float vA;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
        float px = aSize*uProj/max(1.0,-mv.z); gl_PointSize = clamp(px, 1.0, 512.0);
        vA = clamp(px/2.0, 0.0, 1.0) * smoothstep(2.0, 60.0, -mv.z); }`,
    fragmentShader: /* glsl */ `
      precision highp float; in float vA; uniform float uWeight; out vec4 o;
      void main(){ vec2 q = gl_PointCoord*2.0-1.0; float r = length(q); if (r>1.0) discard;
        float rim = smoothstep(0.6, 0.95, r) * smoothstep(1.0, 0.95, r) * 0.4;
        float body = 0.22*(1.0-r*r);
        float nuc = smoothstep(0.35, 0.25, length(q-vec2(0.1,0.05)))*0.25;
        o = vec4(vec3(0.62,0.66,0.72)*(rim*0.35+body+nuc)*0.07*vA*uWeight, 1.0); }`,
    uniforms: { uProj: { value: 500 }, uWeight: { value: 1 } },
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  return p;
}

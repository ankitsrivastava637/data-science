// Shared GPU particle system. Positions come from "target" float textures (xyz + attribute w);
// a representation change is a GPU morph between two targets. The same class and the same
// target registry are reused by Chapter 12 to cross-fade through every earlier representation.
import * as THREE from 'three';

export const TEX_W = 512;

export function makeTarget(count: number, fill: (i: number, out: Float32Array, o: number) => void): THREE.DataTexture {
  const h = Math.ceil(count / TEX_W);
  const data = new Float32Array(TEX_W * h * 4);
  for (let i = 0; i < count; i++) fill(i, data, i * 4);
  // unused texels: park far away with w = -1 (discarded in the shader)
  for (let i = count; i < TEX_W * h; i++) { data[i * 4 + 3] = -1; }
  const tex = new THREE.DataTexture(data, TEX_W, h, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

const VERT = /* glsl */ `
precision highp float;
uniform sampler2D tA, tB;
uniform float uMix, uStagger, uSwirl, uSize, uProj, uTime, uJitter;
uniform float uMinPx, uMaxPx;
uniform mat4 uModelA, uModelB;
in float aIndex;
out float vW;
out float vFade;
out float vPx;
float hash(float n){ return fract(sin(n*12.9898+78.233)*43758.5453); }
void main(){
  int i = int(aIndex);
  ivec2 tc = ivec2(i % ${TEX_W}, i / ${TEX_W});
  vec4 a = texelFetch(tA, tc, 0);
  vec4 b = texelFetch(tB, tc, 0);
  float h = hash(aIndex*0.61803);
  float m = smoothstep(0.0, 1.0, clamp(uMix*(1.0+uStagger) - h*uStagger, 0.0, 1.0));
  vec3 pa = (uModelA * vec4(a.xyz, 1.0)).xyz;
  vec3 pb = (uModelB * vec4(b.xyz, 1.0)).xyz;
  vec3 p = mix(pa, pb, m);
  vec3 sw = vec3(hash(aIndex*1.37), hash(aIndex*2.11), hash(aIndex*3.73)) - 0.5;
  p += uSwirl * sin(m*3.14159265) * sw;
  p += uJitter * vec3(sin(uTime*1.7 + h*40.0), sin(uTime*1.3 + h*73.0), sin(uTime*1.1 + h*19.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = uSize * uProj / max(1e-6, -mv.z);
  vFade = 1.0;
  if (px < uMinPx) { vFade = px / uMinPx; px = uMinPx; } // sub-pixel points dim instead of shimmering
  px = min(px, uMaxPx);
  gl_PointSize = px;
  vPx = px;
  vW = mix(a.w, b.w, m);
  if (a.w < -0.5 || b.w < -0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColA, uColB, uColC;
uniform float uIntensity, uSharp;
uniform int uPalette;
in float vW;
in float vFade;
in float vPx;
out vec4 o;
void main(){
  vec2 q = gl_PointCoord*2.0-1.0;
  float r2 = dot(q,q);
  if (r2 > 1.0) discard;
  float a = exp(-r2*uSharp) - exp(-uSharp);
  vec3 c;
  float w = clamp(vW, 0.0, 1.0);
  if (uPalette == 0) c = mix(uColA, uColB, w);
  else if (uPalette == 1) c = w < 0.5 ? mix(uColA, uColB, w*2.0) : mix(uColB, uColC, w*2.0-1.0);
  else c = uColA * (0.3 + 0.7*w);
  o = vec4(c * a * uIntensity * vFade, 1.0);
}`;

export interface ParticleOptions {
  count: number;
  size?: number;
  intensity?: number;
  sharp?: number;
  palette?: 0 | 1 | 2;
  colA?: THREE.ColorRepresentation;
  colB?: THREE.ColorRepresentation;
  colC?: THREE.ColorRepresentation;
}

export class MorphParticles {
  points: THREE.Points;
  material: THREE.ShaderMaterial;
  count: number;
  constructor(opts: ParticleOptions) {
    this.count = opts.count;
    const g = new THREE.BufferGeometry();
    const idx = new Float32Array(opts.count);
    for (let i = 0; i < opts.count; i++) idx[i] = i;
    g.setAttribute('aIndex', new THREE.BufferAttribute(idx, 1));
    // position attribute is required by three for bounding computations; not used by the shader
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(opts.count * 3), 3));
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        tA: { value: null }, tB: { value: null }, uMix: { value: 0 }, uStagger: { value: 0.4 }, uSwirl: { value: 0 },
        uSize: { value: opts.size ?? 0.01 }, uProj: { value: 500 }, uTime: { value: 0 }, uJitter: { value: 0 },
        uMinPx: { value: 1.5 }, uMaxPx: { value: 48 },
        uModelA: { value: new THREE.Matrix4() }, uModelB: { value: new THREE.Matrix4() },
        uColA: { value: new THREE.Color(opts.colA ?? 0xffffff) }, uColB: { value: new THREE.Color(opts.colB ?? 0xffffff) },
        uColC: { value: new THREE.Color(opts.colC ?? 0xffffff) },
        uIntensity: { value: opts.intensity ?? 1 }, uSharp: { value: opts.sharp ?? 4 }, uPalette: { value: opts.palette ?? 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
  }
  get u() { return this.material.uniforms; }
  set(a: THREE.Texture, b: THREE.Texture | null, mix = 0) {
    this.u.tA.value = a; this.u.tB.value = b ?? a; this.u.uMix.value = b ? mix : 0;
  }
  /** pixels-per-unit at distance 1 for the given camera and render height */
  setProjection(cam: THREE.PerspectiveCamera, heightPx: number) {
    this.u.uProj.value = heightPx / (2 * Math.tan((cam.fov * Math.PI) / 360));
  }
  setDrawCount(n: number) { this.points.geometry.setDrawRange(0, Math.max(0, Math.min(this.count, Math.floor(n)))); }
  dispose() { this.points.geometry.dispose(); this.material.dispose(); }
}

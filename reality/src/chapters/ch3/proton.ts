// Illustrative, lattice-QCD-inspired proton (units: fm). Not a lattice computation:
// • gluon "action density": evolving 3D lumps (cf. the lumpy vacuum action density seen in
//   lattice visualisations), confined by a soft envelope of radius ~ the charge radius;
// • three valence quarks with muted colour tints (colour charge is a label, not a hue);
// • a Y-shaped flux tube between them meeting at a junction (Bissey et al. 2007);
// • short-lived sea quark–antiquark pairs that appear and annihilate.
import * as THREE from 'three';
import { FullscreenPass, hdrTarget, shaderMat } from '../../engine/post';
import { COMMON } from '../../shaders/common';
import { hash01 } from '../../engine/prng';

const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform vec3 camPos; uniform mat3 camRot; uniform float tanHalf; uniform float aspect;
uniform float time; uniform vec3 q0, q1, q2, J; uniform vec4 sea[16]; uniform float uSteps; uniform float uExposure;
uniform float uTube; uniform float uLumps;
${COMMON}
float segDist(vec3 p, vec3 a, vec3 b){ vec3 ab = b - a; float t = clamp(dot(p - a, ab)/dot(ab, ab), 0.0, 1.0); return length(p - a - ab*t); }
void main(){
  vec2 ndc = vUv*2.0 - 1.0;
  vec3 rd = normalize(camRot * vec3(ndc.x*tanHalf*aspect, ndc.y*tanHalf, -1.0));
  vec3 ro = camPos;
  float R = 1.7;
  float b = dot(ro, rd), c = dot(ro, ro) - R*R, h = b*b - c;
  if (h <= 0.0) { o = vec4(0,0,0,1); return; }
  h = sqrt(h);
  float t0 = max(0.0, -b - h), t1 = -b + h;
  float dt = (t1 - t0)/uSteps;
  float jit = float(uhash3(uvec3(uvec2(gl_FragCoord.xy), 11u)) & 0xffffu)/65535.0;
  vec3 acc = vec3(0.0); float tr = 1.0;
  vec3 c0 = vec3(0.95, 0.52, 0.42), c1 = vec3(0.52, 0.86, 0.56), c2 = vec3(0.50, 0.60, 0.98);
  for (int i = 0; i < 96; i++) {
    if (float(i) >= uSteps) break;
    vec3 p = ro + rd*(t0 + (float(i) + jit)*dt);
    float r = length(p);
    float env = exp(-pow(r/0.86, 2.0)*1.6);
    // lumpy gluon action density, slowly evolving
    float n = fbm3(p*3.1 + vec3(0.0, 0.0, time*0.35) + vec3(sin(time*0.21), cos(time*0.17), 0.0));
    float lump = pow(max(0.0, n - 0.42)*3.2, 2.0) * env * uLumps;
    // Y-shaped flux tube
    float d = min(segDist(p, q0, J), min(segDist(p, q1, J), segDist(p, q2, J)));
    float tube = exp(-d*d/0.012) * uTube;
    // valence quark cores
    float k0 = exp(-dot(p-q0,p-q0)/0.0035), k1 = exp(-dot(p-q1,p-q1)/0.0035), k2 = exp(-dot(p-q2,p-q2)/0.0035);
    vec3 em = vec3(0.95, 0.66, 0.38) * lump * 0.9 + vec3(0.85, 0.80, 0.70) * tube * 0.9 + (c0*k0 + c1*k1 + c2*k2) * 5.0;
    // sea pairs
    for (int s = 0; s < 16; s++) {
      vec4 sp = sea[s];
      if (sp.w <= 0.0) continue;
      float e = exp(-dot(p - sp.xyz, p - sp.xyz)/0.0012) * sp.w;
      em += vec3(0.75, 0.8, 0.95) * e * 2.0;
    }
    float absb = lump * 0.6 + tube * 0.3;
    acc += tr * em * dt * uExposure;
    tr *= exp(-absb * dt * 2.0);
    if (tr < 0.03) break;
  }
  o = vec4(acc, 1.0);
}`;

export class ProtonVolume {
  rt: THREE.WebGLRenderTarget;
  mat: THREE.ShaderMaterial;
  pass: FullscreenPass;
  comp: FullscreenPass;
  constructor(public scale = 0.5) {
    this.rt = hdrTarget(2, 2, 0, false);
    const sea = Array.from({ length: 16 }, () => new THREE.Vector4());
    this.mat = shaderMat(FRAG, {
      camPos: { value: new THREE.Vector3() }, camRot: { value: new THREE.Matrix3() }, tanHalf: { value: 0.4 }, aspect: { value: 16 / 9 },
      time: { value: 0 }, q0: { value: new THREE.Vector3() }, q1: { value: new THREE.Vector3() }, q2: { value: new THREE.Vector3() }, J: { value: new THREE.Vector3() },
      sea: { value: sea }, uSteps: { value: 56 }, uExposure: { value: 1 }, uTube: { value: 1 }, uLumps: { value: 1 },
    });
    this.pass = new FullscreenPass(this.mat);
    this.comp = new FullscreenPass(shaderMat(`precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D t; uniform float w;
      void main(){ o = vec4(texture(t, vUv).rgb * w, 1.0); }`, { t: { value: this.rt.texture }, w: { value: 1 } }, { blending: THREE.AdditiveBlending, transparent: true }));
  }
  /** quark positions etc. as a pure function of the displayed time */
  update(time: number, slowMotion: boolean) {
    const u = this.mat.uniforms;
    u.time.value = time;
    const T = time;
    const q = (a: number, b: number, c: number, ph: number) => new THREE.Vector3(
      0.42 * Math.sin(T * a + ph), 0.42 * Math.sin(T * b + ph * 1.7 + 1.0), 0.42 * Math.sin(T * c + ph * 2.3 + 2.0));
    const a = q(0.61, 0.43, 0.37, 0.0), b = q(0.47, 0.59, 0.41, 2.1), c = q(0.39, 0.51, 0.63, 4.2);
    // keep them apart (Y needs separation) by pushing from the centroid
    const cen = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    for (const v of [a, b, c]) { const d = v.clone().sub(cen); const L = Math.max(0.28, d.length()); v.copy(cen).addScaledVector(d.normalize(), L); }
    u.q0.value.copy(a); u.q1.value.copy(b); u.q2.value.copy(c);
    u.J.value.copy(fermat(a, b, c));
    // sea pairs: deterministic birth/death per slot
    const sea = u.sea.value as THREE.Vector4[];
    for (let s = 0; s < 8; s++) {
      const period = 1.7 + hash01(s, 91) * 1.3;
      const cyc = Math.floor((T + hash01(s, 92) * period) / period);
      const ph = ((T + hash01(s, 92) * period) / period) - cyc;
      const life = ph < 0.55 ? Math.sin((ph / 0.55) * Math.PI) : 0;
      const r = 0.25 + 0.5 * Math.cbrt(hash01(s, cyc, 1));
      const th = Math.acos(2 * hash01(s, cyc, 2) - 1), phi = 2 * Math.PI * hash01(s, cyc, 3);
      const p = new THREE.Vector3(r * Math.sin(th) * Math.cos(phi), r * Math.sin(th) * Math.sin(phi), r * Math.cos(th));
      const dir = new THREE.Vector3(hash01(s, cyc, 4) - 0.5, hash01(s, cyc, 5) - 0.5, hash01(s, cyc, 6) - 0.5).normalize();
      const sep = 0.09 * Math.sin(Math.min(1, ph / 0.55) * Math.PI);
      sea[2 * s].set(p.x + dir.x * sep, p.y + dir.y * sep, p.z + dir.z * sep, life * (slowMotion ? 0.6 : 1));
      sea[2 * s + 1].set(p.x - dir.x * sep, p.y - dir.y * sep, p.z - dir.z * sep, life * (slowMotion ? 0.6 : 1));
    }
  }
  setCamera(cam: THREE.PerspectiveCamera, aspect: number, w: number, h: number) {
    const u = this.mat.uniforms;
    u.camPos.value.copy(cam.position);
    u.camRot.value.setFromMatrix4(cam.matrixWorld);
    u.tanHalf.value = Math.tan((cam.fov * Math.PI) / 360);
    u.aspect.value = aspect;
    const W = Math.max(2, Math.round(w * this.scale)), H = Math.max(2, Math.round(h * this.scale));
    if (this.rt.width !== W || this.rt.height !== H) this.rt.setSize(W, H);
  }
  quarkPositions() { const u = this.mat.uniforms; return [u.q0.value as THREE.Vector3, u.q1.value as THREE.Vector3, u.q2.value as THREE.Vector3]; }
  render(r: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, weight: number) {
    this.pass.render(r, this.rt);
    this.comp.material.uniforms.w.value = weight;
    this.comp.render(r, target);
  }
  dispose() { this.rt.dispose(); this.mat.dispose(); this.comp.material.dispose(); }
}

/** Fermat (Steiner) point of a triangle — where a minimal Y-shaped string network meets. */
export function fermat(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
  const p = a.clone().add(b).add(c).multiplyScalar(1 / 3);
  for (let i = 0; i < 40; i++) { // Weiszfeld iterations
    let wx = 0, wy = 0, wz = 0, ws = 0;
    for (const v of [a, b, c]) { const d = Math.max(1e-6, p.distanceTo(v)); wx += v.x / d; wy += v.y / d; wz += v.z / d; ws += 1 / d; }
    p.set(wx / ws, wy / ws, wz / ws);
  }
  return p;
}

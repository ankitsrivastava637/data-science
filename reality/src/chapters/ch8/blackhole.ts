// Per-pixel Schwarzschild null-geodesic ray tracing (units r_s = 1). For each pixel the photon's
// orbital plane is found from the camera position and ray direction; u = 1/r obeys
//   d²u/dφ² + u = (3/2) u²      (exact for Schwarzschild, r_s = 1)
// integrated with RK4 in φ. Rays falling below r = 1 are captured (the shadow); rays escaping sample a
// procedural star field; rays crossing the equatorial plane between 3 and 14 r_s hit a thin disk whose
// emission profile and Doppler beaming are schematic.
import * as THREE from 'three';
import { FullscreenPass, hdrTarget, shaderMat } from '../../engine/post';
import { COMMON } from '../../shaders/common';

const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform vec3 camPos; uniform mat3 camRot; uniform float tanHalf; uniform float aspect;
uniform float uSteps; uniform float uDisk; uniform float uTime; uniform float uStars; uniform float uExposure;
${COMMON}
vec2 deriv(vec2 s){ return vec2(s.y, -s.x + 1.5*s.x*s.x); } // (u, u')' = (u', −u + 1.5u²)
vec3 stars(vec3 d){
  // stars on the sphere: hashed cells in a cube-map-like parametrisation, plus a faint band
  vec3 a = abs(d);
  vec2 uv; float face;
  if (a.x > a.y && a.x > a.z) { uv = d.yz/a.x; face = d.x > 0.0 ? 0.0 : 1.0; }
  else if (a.y > a.z) { uv = d.xz/a.y; face = d.y > 0.0 ? 2.0 : 3.0; }
  else { uv = d.xy/a.z; face = d.z > 0.0 ? 4.0 : 5.0; }
  vec3 col = vec3(0.0);
  for (int layer = 0; layer < 3; layer++) {
    float sc = 60.0 * pow(2.2, float(layer));
    vec2 g = uv*sc; vec2 id = floor(g); vec2 f = fract(g);
    vec3 h = hash33(vec3(id, face*17.0 + float(layer)*101.0));
    vec2 c = 0.15 + 0.7*h.xy;
    float dd = length(f - c);
    float mag = pow(h.z, 30.0 - float(layer)*6.0);
    float star = exp(-dd*dd*sc*0.9) * mag;
    vec3 tint = mix(vec3(1.0, 0.78, 0.6), vec3(0.7, 0.8, 1.0), hash13(vec3(id, face + 7.0)));
    col += tint * star * 3.0;
  }
  float band = exp(-pow(dot(d, normalize(vec3(0.3, 1.0, 0.2)))*3.0, 2.0));
  col += vec3(0.05, 0.045, 0.04) * band * (0.5 + fbm(d.xz*4.0 + d.y*3.0));
  return col * uStars;
}
vec3 disk(float r, float phi3, float cosView, float side){
  float rin = 3.0, rout = 14.0;
  if (r < rin || r > rout) return vec3(0.0);
  // temperature-like profile ∝ r^{-3/4}(1 − √(rin/r))^{1/4} (thin-disk shape, schematic normalisation)
  float T = pow(r, -0.75) * pow(max(0.0, 1.0 - sqrt(rin/r)), 0.25);
  // Keplerian speed (r_s = 1 → v = √(1/(2(r−1)))) and a beaming factor (approximate)
  float v = sqrt(0.5/(r - 1.0));
  float g = sqrt(1.0 - 1.5/r) / (1.0 - v*cosView*side);
  float Tn = T / 0.215;                      // normalised to the profile's peak (near r ≈ 4 rₛ)
  float I = pow(Tn, 4.0) * pow(g, 3.5);
  float tex = 0.7 + 0.6*fbm(vec2(r*2.2, phi3*3.0 - uTime*0.5/pow(r,1.5)));
  vec3 hot = vec3(1.0, 0.92, 0.80), warm = vec3(1.0, 0.52, 0.20), deep = vec3(0.75, 0.22, 0.06);
  float k = clamp(Tn*g, 0.0, 1.6);
  vec3 c = k > 1.0 ? mix(hot, vec3(1.0), (k - 1.0)*0.6) : mix(mix(deep, warm, smoothstep(0.2, 0.6, k)), hot, smoothstep(0.6, 1.0, k));
  float edge = smoothstep(rin, rin + 0.35, r) * smoothstep(rout, rout - 4.0, r);
  return c * I * tex * edge * 3.2;
}
void main(){
  vec2 ndc = vUv*2.0 - 1.0;
  vec3 d = normalize(camRot * vec3(ndc.x*tanHalf*aspect, ndc.y*tanHalf, -1.0));
  vec3 C = camPos;
  float rc = length(C);
  vec3 e1 = C / rc;
  vec3 e2 = d - dot(d, e1)*e1;
  float l2 = length(e2);
  if (l2 < 1e-6) { e2 = normalize(cross(e1, vec3(0.0, 1.0, 0.1))); } else e2 /= l2;
  float dr = dot(d, e1), dt = dot(d, e2);
  vec2 s = vec2(1.0/rc, -(1.0/rc) * dr / max(dt, 1e-6));
  float phi = 0.0;
  vec3 col = vec3(0.0);
  vec3 prevP = C;
  bool done = false;
  float h = 0.035;
  for (int i = 0; i < 400; i++) {
    if (float(i) >= uSteps) break;
    // adaptive step: smaller close to the hole
    h = clamp(0.06 * (1.0/(1.0 + 6.0*s.x)) + 0.004, 0.006, 0.06);
    vec2 k1 = deriv(s), k2 = deriv(s + 0.5*h*k1), k3 = deriv(s + 0.5*h*k2), k4 = deriv(s + h*k3);
    s += h*(k1 + 2.0*k2 + 2.0*k3 + k4)/6.0;
    phi += h;
    if (s.x >= 1.0) { col = vec3(0.0); done = true; break; } // crossed the horizon r = 1
    float r = 1.0/max(s.x, 1e-6);
    vec3 P = r*(cos(phi)*e1 + sin(phi)*e2);
    // equatorial disk crossing
    if (uDisk > 0.0 && P.y*prevP.y < 0.0) {
      float f = prevP.y/(prevP.y - P.y);
      vec3 X = mix(prevP, P, f);
      float rx = length(X);
      if (rx > 3.0 && rx < 14.0) {
        vec3 tang = normalize(cross(vec3(0.0, 1.0, 0.0), X)); // disk rotation direction
        vec3 ray = normalize(P - prevP);
        float cosView = dot(tang, -ray);
        col = disk(rx, atan(X.z, X.x), cosView, 1.0) * uDisk;
        done = true; break;
      }
    }
    prevP = P;
    if (s.x < 0.0 || (r > 60.0 && s.y < 0.0)) break; // escaping
  }
  if (!done) {
    float r = 1.0/max(s.x, 1e-4);
    // tangent direction of the orbit at the end (dP/dφ)
    float drdphi = -s.y/(s.x*s.x);
    vec3 dir = normalize(drdphi*(cos(phi)*e1 + sin(phi)*e2) + r*(-sin(phi)*e1 + cos(phi)*e2));
    col = stars(dir);
  }
  o = vec4(col * uExposure, 1.0);
}`;

export class BlackHoleView {
  rt: THREE.WebGLRenderTarget;
  mat: THREE.ShaderMaterial;
  pass: FullscreenPass;
  comp: FullscreenPass;
  constructor(public scale = 0.5) {
    this.rt = hdrTarget(2, 2, 0, false);
    this.mat = shaderMat(FRAG, {
      camPos: { value: new THREE.Vector3(0, 2, 25) }, camRot: { value: new THREE.Matrix3() }, tanHalf: { value: 0.4 }, aspect: { value: 16 / 9 },
      uSteps: { value: 260 }, uDisk: { value: 1 }, uTime: { value: 0 }, uStars: { value: 1 }, uExposure: { value: 1 },
    });
    this.pass = new FullscreenPass(this.mat);
    this.comp = new FullscreenPass(shaderMat(`precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D t; uniform float w;
      void main(){ o = vec4(texture(t, vUv).rgb * w, 1.0); }`, { t: { value: this.rt.texture }, w: { value: 1 } }, { blending: THREE.AdditiveBlending, transparent: true }));
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
  render(r: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, weight: number) {
    this.pass.render(r, this.rt);
    this.comp.material.uniforms.w.value = weight;
    this.comp.render(r, target);
  }
  dispose() { this.rt.dispose(); this.mat.dispose(); this.comp.material.dispose(); }
}

/** apparent angular radius of the shadow for a static observer at r (r_s = 1): sin α = b_c √(1 − 1/r) / r */
export function shadowAngle(r: number) {
  const bc = (3 * Math.sqrt(3)) / 2;
  return Math.asin(Math.min(1, (bc * Math.sqrt(1 - 1 / r)) / r));
}

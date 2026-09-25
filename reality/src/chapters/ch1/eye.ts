// Procedural human eye, ray traced per pixel (units: mm, eye centre at origin, optical axis +z).
// Cornea: sphere R = 7.8 mm (refractive index 1.376) over an iris plane at z = 10.4 mm;
// sclera: sphere R = 12 mm. Iris texture is procedural (radial stroma fibres, crypts, collarette,
// contraction furrows, limbal ring). Not a photograph; anatomy proportions are typical adult values.
import * as THREE from 'three';
import { shaderMat } from '../../engine/post';
import { COMMON } from '../../shaders/common';

const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform vec3 camPos; uniform mat3 camRot; uniform float tanHalf; uniform float aspect;
uniform float pupilR; uniform float weight; uniform float time; uniform float lidOpen;
${COMMON}
const float Z_IRIS = 10.4;
const float R_LIMBUS = 5.95;
const vec3 C_CORNEA = vec3(0.0, 0.0, 5.2);
const float R_CORNEA = 7.8;
const float R_EYE = 12.0;

vec2 sph(vec3 ro, vec3 rd, vec3 c, float r){
  vec3 oc = ro - c; float b = dot(oc, rd); float cc = dot(oc,oc) - r*r; float h = b*b - cc;
  if (h < 0.0) return vec2(-1.0); h = sqrt(h); return vec2(-b-h, -b+h);
}

// studio environment: dark room, one large window (key) with mullions, a faint fill
vec3 env(vec3 d){
  vec3 c = vec3(0.012, 0.010, 0.009) * (0.6 + 0.4*d.y);
  vec3 wdir = normalize(vec3(-0.42, 0.38, 1.0));
  vec3 wx = normalize(cross(vec3(0,1,0), wdir)); vec3 wy = cross(wdir, wx);
  float fx = dot(d, wx), fy = dot(d, wy), fz = dot(d, wdir);
  if (fz > 0.0) {
    vec2 q = vec2(fx, fy) / fz;
    float win = smoothstep(0.125, 0.11, abs(q.x)) * smoothstep(0.165, 0.15, abs(q.y));
    float mull = smoothstep(0.006, 0.002, abs(q.x)) + smoothstep(0.006, 0.002, abs(q.y - 0.02));
    win *= 1.0 - 0.9*clamp(mull, 0.0, 1.0);
    c += vec3(1.0, 0.97, 0.92) * 7.0 * win;
    c += vec3(1.0, 0.95, 0.9) * 0.10 * exp(-dot(q,q)*6.0);
  }
  float fill = pow(max(0.0, dot(d, normalize(vec3(0.7, -0.1, 0.8)))), 12.0);
  c += vec3(0.55, 0.62, 0.75) * 0.35 * fill;
  return c;
}

// stroma height field (polar), used both for albedo and for bump shading
float stroma(float r, float th, float u){
  vec2 cs = vec2(cos(th), sin(th));
  float wav = 0.018*vnoise(vec2(r*2.0, 0.0) + cs*3.0);
  vec2 c2 = vec2(cos(th + wav), sin(th + wav));
  float f1 = ridge(vnoise3(vec3(c2*48.0, r*0.9)));
  float f2 = ridge(vnoise3(vec3(c2*110.0, r*1.8 + 5.0)));
  float f3 = vnoise3(vec3(c2*230.0, r*3.0 + 9.0));
  return pow(f1, 3.0)*0.55 + pow(f2, 4.0)*0.35 + f3*0.1;
}

vec3 iris(vec2 p, out float isPupil, out float relief){
  float r = length(p);
  float th = atan(p.y, p.x);
  isPupil = 0.0; relief = 0.0;
  float pr = pupilR * (1.0 + 0.012*sin(th*9.0 + 1.3) + 0.01*vnoise(vec2(th*6.0, 2.0)));
  if (r < pr) { isPupil = 1.0; return vec3(0.0); }
  float u = clamp((r - pr) / (R_LIMBUS - pr), 0.0, 1.0);
  vec2 cs = vec2(cos(th), sin(th));
  float uc = 0.36 + 0.05*sin(th*6.0 + 2.0*vnoise(cs*3.0)) + 0.025*vnoise(cs*11.0);
  float coll = exp(-pow((u - uc)/0.04, 2.0));
  float innerZ = smoothstep(uc + 0.02, uc - 0.06, u);
  float h = stroma(r, th, u);
  // bump shading from the stroma relief (lit from the window side)
  float e = 0.01;
  float hx = stroma(length(p + vec2(e,0.0)), atan(p.y, p.x + e), u) - h;
  float hy = stroma(length(p + vec2(0.0,e)), atan(p.y + e, p.x), u) - h;
  vec3 nb = normalize(vec3(-hx/e*0.035, -hy/e*0.035, 1.0));
  vec3 L = normalize(vec3(-0.42, 0.38, 1.0));
  relief = clamp(0.55 + 0.9*dot(nb, L) - 0.45, 0.2, 1.6);
  // albedo: warm brown pupillary zone, darker grey-brown ciliary zone with golden flecks
  vec3 cIn = vec3(0.080, 0.036, 0.016);
  vec3 cOut = mix(vec3(0.060, 0.045, 0.028), vec3(0.075, 0.066, 0.036), vnoise(cs*5.0 + u*3.0));
  vec3 c = mix(cOut, cIn, innerZ);
  c *= 0.55 + 1.1*h;
  float fleck = smoothstep(0.62, 0.8, vnoise3(vec3(cs*18.0, u*6.0))) * (1.0 - innerZ) * exp(-pow((u - uc - 0.12)/0.18, 2.0));
  c += vec3(0.16, 0.10, 0.035) * fleck * 0.6;
  c = mix(c, vec3(0.15, 0.085, 0.035), coll*0.5);
  // crypts: elongated dark lacunae just outside the collarette
  vec2 cq = vec2(th*7.0/6.2832*6.0, (u - uc)*9.0);
  float cr = vnoise(vec2(th*14.0, u*5.0)) * vnoise(vec2(th*31.0, u*9.0 + 3.0));
  float crypt = smoothstep(0.28, 0.40, cr) * exp(-pow((u - uc - 0.09)/0.09, 2.0));
  c *= 1.0 - 0.8*crypt; relief *= 1.0 - 0.5*crypt;
  // contraction furrows (concentric) in the periphery
  float fur = smoothstep(0.88, 1.0, sin((u + 0.03*vnoise(cs*5.0))*58.0)) * smoothstep(0.55, 0.8, u);
  c *= 1.0 - 0.4*fur;
  // pupillary ruff
  float ruff = smoothstep(0.045, 0.0, u);
  c = mix(c, vec3(0.03, 0.014, 0.007) * (0.7 + 0.6*vnoise(vec2(th*80.0, 1.0))), ruff);
  // limbal ring
  c *= mix(1.0, 0.25, smoothstep(0.82, 0.99, u));
  return c;
}

vec3 sclera(vec3 p, vec3 n){
  vec3 base = vec3(0.21, 0.19, 0.175);
  float ang = atan(p.y, p.x);
  float rr = length(p.xy);
  // vessels become visible away from the limbus
  float v1 = ridge(vnoise(vec2(ang*7.0, rr*0.9) + fbm(p.xy*0.6)*1.5));
  float v2 = ridge(vnoise(vec2(ang*16.0, rr*1.7) + fbm(p.xy*1.1)*1.2));
  float vess = pow(v1, 18.0)*0.8 + pow(v2, 26.0)*0.5;
  vess *= smoothstep(6.5, 9.0, rr);
  base = mix(base, vec3(0.16, 0.05, 0.04), clamp(vess*0.6, 0.0, 0.6));
  base *= 0.9 + 0.1*fbm(p.xy*2.0);
  return base;
}

void main(){
  vec2 ndc = vUv*2.0 - 1.0;
  vec3 rd = normalize(camRot * vec3(ndc.x*tanHalf*aspect, ndc.y*tanHalf, -1.0));
  vec3 ro = camPos;
  vec3 col = vec3(0.012, 0.006, 0.005); // skin in deep shadow
  vec3 keyDir = normalize(vec3(-0.42, 0.38, 1.0));
  vec2 hc = sph(ro, rd, C_CORNEA, R_CORNEA);
  vec2 hs = sph(ro, rd, vec3(0.0), R_EYE);
  bool done = false;
  if (hc.x > 0.0) {
    vec3 p = ro + rd*hc.x;
    if (p.z > Z_IRIS - 0.02 && length(p.xy) < R_LIMBUS + 0.05) {
      vec3 n = normalize(p - C_CORNEA);
      float cosi = clamp(dot(-rd, n), 0.0, 1.0);
      float fres = 0.025 + 0.975*pow(1.0 - cosi, 5.0);
      vec3 refl = env(reflect(rd, n));
      vec3 tr = refract(rd, n, 1.0/1.376);
      float tt = (Z_IRIS - p.z) / min(-1e-4, tr.z);
      vec3 q = p + tr*tt;
      float pup, relief;
      vec3 ic = iris(q.xy, pup, relief);
      // lighting of the iris: key through the cornea (bump shaded) + soft ambient
      vec3 inner = ic * (0.25 + 1.15*relief);
      // limbal transition into the sclera
      float lim = smoothstep(R_LIMBUS - 0.25, R_LIMBUS + 0.05, length(q.xy));
      inner = mix(inner, sclera(q, vec3(0,0,1)) * 0.5, lim*0.6);
      // inside the pupil: the crystalline lens gives a faint Purkinje reflection
      if (pup > 0.5) {
        vec3 lr = reflect(tr, normalize(vec3(q.xy*0.08, 1.0)));
        inner = env(lr) * 0.004;
      }
      col = mix(inner, refl, fres);
      done = true;
    }
  }
  if (!done && hs.x > 0.0) {
    vec3 p = ro + rd*hs.x;
    vec3 n = normalize(p);
    float cosi = clamp(dot(-rd, n), 0.0, 1.0);
    float fres = 0.03 + 0.97*pow(1.0 - cosi, 5.0);
    float diff = 0.12 + 0.95*pow(max(0.0, dot(n, keyDir)), 1.4);
    vec3 s = sclera(p, n) * diff;
    // spherical falloff toward the canthi and shadow under the lids
    s *= mix(1.0, 0.25, smoothstep(6.0, 11.5, length(p.xy)));
    s *= mix(1.0, 0.3, smoothstep(1.5, 5.0, p.y)) * mix(1.0, 0.55, smoothstep(-2.0, -5.0, p.y));
    col = mix(s, env(reflect(rd, n)), fres);
  }
  // lids: dark skin top and bottom with a soft lash fringe (out of focus)
  float y = (camPos + rd * ((Z_IRIS + 1.0 - camPos.z) / rd.z)).y;
  float x = (camPos + rd * ((Z_IRIS + 1.0 - camPos.z) / rd.z)).x;
  float lidTop = 4.6*lidOpen + 0.35*sin(x*0.35) - 0.018*x*x;
  float lidBot = -4.9*lidOpen - 0.2*sin(x*0.3+1.0) + 0.014*x*x;
  float lash = smoothstep(0.0, 1.0, vnoise(vec2(x*9.0, 0.5))) * 0.55;
  float top = smoothstep(lidTop - 0.6, lidTop + 1.0 + lash*0.6, y);
  float bot = smoothstep(lidBot + 0.5, lidBot - 0.9, y);
  vec3 skin = vec3(0.018, 0.008, 0.006) * (0.6 + 0.4*fbm(vec2(x,y)*1.4));
  col = mix(col, skin, clamp(top + bot, 0.0, 1.0));
  o = vec4(col * weight, 1.0);
}`;

export function makeEyeMaterial() {
  return shaderMat(FRAG, {
    camPos: { value: new THREE.Vector3() },
    camRot: { value: new THREE.Matrix3() },
    tanHalf: { value: 0.25 },
    aspect: { value: 16 / 9 },
    pupilR: { value: 2.2 },
    weight: { value: 1 },
    time: { value: 0 },
    lidOpen: { value: 1 },
  }, { blending: THREE.AdditiveBlending, transparent: true });
}

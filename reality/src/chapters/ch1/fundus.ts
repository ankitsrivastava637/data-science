// Fundus seen from inside the eye (sphere R = 12 mm). Retinal coordinates are azimuthal
// equidistant around the fovea (mm). Optic disc ~4.5 mm nasal to the fovea, ~1.8 mm across;
// arcades of arteries (lighter) and veins (darker, wider) grown procedurally from the disc,
// avoiding the foveal avascular zone. Illustrative, not traced from a real eye.
import * as THREE from 'three';
import { shaderMat } from '../../engine/post';
import { COMMON } from '../../shaders/common';
import { Rng } from '../../engine/prng';

export const FUNDUS_EXTENT_MM = 13; // texture covers ±13 mm around the fovea
export const DISC = { x: 4.5, y: 0.35, r: 0.9 };

export function makeFundusTexture(seed: number, size = 2048): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  const s = size / (2 * FUNDUS_EXTENT_MM); // px per mm
  const X = (mm: number) => size / 2 + mm * s;
  const Y = (mm: number) => size / 2 - mm * s;
  g.fillStyle = 'rgba(0,0,0,0)';
  g.clearRect(0, 0, size, size);
  const rng = new Rng(seed, 404);
  // vessels are drawn into the alpha-carrying layer: R = artery, G = vein, B = light reflex
  type V = { x: number; y: number; dir: number; w: number; artery: boolean; len: number; depth: number; bend: number };
  const vessels: V[] = [];
  const main = [
    { dir: Math.PI * 0.62, bend: -0.10 }, { dir: -Math.PI * 0.62, bend: 0.10 }, // temporal arcades (toward the fovea side, x < disc)
    { dir: Math.PI * 0.2, bend: 0.02 }, { dir: -Math.PI * 0.2, bend: -0.02 },   // nasal branches
  ];
  for (const m of main) for (const artery of [true, false]) {
    vessels.push({ x: DISC.x + rng.normal() * 0.08, y: DISC.y + rng.normal() * 0.08, dir: m.dir + (artery ? 0.05 : -0.05), w: artery ? 0.105 : 0.14, artery, len: 16, depth: 0, bend: m.bend });
  }
  const segs: { x0: number; y0: number; x1: number; y1: number; w: number; artery: boolean }[] = [];
  while (vessels.length) {
    const v = vessels.pop()!;
    let { x, y, dir, w } = v;
    const stepLen = 0.12;
    const n = Math.floor(v.len / stepLen);
    for (let i = 0; i < n; i++) {
      // avoid the fovea: steer away inside ~0.9 mm; arcades curve around the macula
      const df = Math.hypot(x, y);
      if (df < 1.6) {
        const away = Math.atan2(y, x);
        let dd = away - dir; while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI;
        dir += dd * 0.08;
      }
      dir += v.bend * (1 + 0.3 * rng.normal()) * 0.25 + rng.normal() * 0.05;
      const nx = x + Math.cos(dir) * stepLen, ny = y + Math.sin(dir) * stepLen;
      if (Math.hypot(nx, ny) < 0.3) break; // foveal avascular zone
      segs.push({ x0: x, y0: y, x1: nx, y1: ny, w, artery: v.artery });
      x = nx; y = ny;
      if (Math.abs(x) > FUNDUS_EXTENT_MM || Math.abs(y) > FUNDUS_EXTENT_MM) break;
      if (i > 6 && rng.float() < 0.028 * (v.depth < 4 ? 1 : 0.5) && w > 0.025) {
        const side = rng.float() < 0.5 ? -1 : 1;
        const bw = w * rng.range(0.55, 0.8);
        vessels.push({ x, y, dir: dir + side * rng.range(0.5, 1.1), w: bw, artery: v.artery, len: v.len * rng.range(0.25, 0.55), depth: v.depth + 1, bend: v.bend * 0.5 + side * 0.03 });
        w *= 0.88;
      }
      w *= 0.9985;
      if (w < 0.012) break;
    }
  }
  g.lineCap = 'round';
  // veins first (deeper), then arteries on top
  for (const pass of [false, true]) {
    for (const sg of segs) {
      if (sg.artery !== pass) continue;
      g.strokeStyle = pass ? 'rgba(255,0,0,1)' : 'rgba(0,255,0,1)';
      g.lineWidth = Math.max(1, sg.w * s);
      g.beginPath(); g.moveTo(X(sg.x0), Y(sg.y0)); g.lineTo(X(sg.x1), Y(sg.y1)); g.stroke();
    }
  }
  // central light reflex on the larger vessels
  g.globalCompositeOperation = 'lighter';
  for (const sg of segs) {
    if (sg.w < 0.05) continue;
    g.strokeStyle = 'rgba(0,0,255,0.9)';
    g.lineWidth = Math.max(1, sg.w * s * 0.22);
    g.beginPath(); g.moveTo(X(sg.x0), Y(sg.y0)); g.lineTo(X(sg.x1), Y(sg.y1)); g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  return tex;
}

const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform vec3 camPos; uniform mat3 camRot; uniform float tanHalf; uniform float aspect;
uniform sampler2D tVessels; uniform float weight; uniform float aperture; uniform float time;
${COMMON}
const float R = 12.0;
const float EXT = ${FUNDUS_EXTENT_MM.toFixed(1)};
const vec2 DISC = vec2(${DISC.x.toFixed(2)}, ${DISC.y.toFixed(2)});
const float DISC_R = ${DISC.r.toFixed(2)};

void main(){
  vec2 ndc = vUv*2.0 - 1.0;
  vec3 rd = normalize(camRot * vec3(ndc.x*tanHalf*aspect, ndc.y*tanHalf, -1.0));
  vec3 ro = camPos;
  // inside the sphere: far intersection
  float b = dot(ro, rd); float c = dot(ro, ro) - R*R; float h = sqrt(max(0.0, b*b - c));
  float t = -b + h;
  vec3 p = ro + rd*t;
  vec3 n = -normalize(p);
  // retinal map coordinates (mm), azimuthal equidistant about the posterior pole (fovea)
  float alpha = acos(clamp(-p.z / R, -1.0, 1.0));
  float phi = atan(p.y, p.x);
  vec2 q = R*alpha*vec2(cos(phi), sin(phi));
  float rf = length(q);
  // choroidal background: orange-red with fine choroidal vessel mottling
  float ch = fbm(q*1.8) ; float ch2 = fbm(q*6.0 + 7.0);
  vec3 col = mix(vec3(0.26, 0.050, 0.018), vec3(0.42, 0.10, 0.035), ch);
  col *= 0.8 + 0.35*ch2;
  // pigment darkens toward the posterior pole; macula darker and slightly yellow-brown
  col *= mix(0.62, 1.0, smoothstep(1.0, 6.0, rf));
  float mac = exp(-rf*rf/(2.0*1.1*1.1));
  col = mix(col, vec3(0.12, 0.035, 0.015), mac*0.7);
  // foveal reflex: a small bright ring at the pit slope (specular, depends on view)
  float refl = exp(-pow((rf - 0.22)/0.05, 2.0)) * 0.9 + exp(-rf*rf/0.003)*0.6;
  col += vec3(0.8, 0.75, 0.6) * refl * 0.025 * pow(max(0.0, dot(n, -rd)), 8.0);
  // optic disc: pale, with a brighter central cup
  float dd = length((q - DISC) * vec2(1.0, 0.94));
  float disc = smoothstep(DISC_R + 0.06, DISC_R - 0.08, dd);
  float cup = smoothstep(0.45, 0.2, dd);
  col = mix(col, vec3(0.50, 0.30, 0.17), disc);
  col = mix(col, vec3(0.66, 0.52, 0.38), cup*0.55);
  // vessels
  vec2 uv = q / (2.0*EXT) + 0.5;
  vec4 v = texture(tVessels, uv);
  vec3 art = vec3(0.40, 0.045, 0.022), vein = vec3(0.17, 0.015, 0.012);
  col = mix(col, vein, v.g*0.92);
  col = mix(col, art, v.r*0.9);
  col += vec3(0.5, 0.3, 0.22) * v.b * 0.12;
  // coaxial illumination (like an ophthalmoscope) with falloff
  float lit = 0.25 + 0.85*pow(max(0.0, dot(n, -rd)), 1.5);
  col *= lit * mix(1.0, 0.45, smoothstep(5.0, 12.0, rf));
  // pupil aperture vignette while we are still near the lens
  float ap = smoothstep(aperture, aperture*0.7, length(ndc*vec2(aspect, 1.0)));
  col *= mix(1.0, ap, step(0.0, aperture));
  o = vec4(col * weight, 1.0);
}`;

export function makeFundusMaterial(tex: THREE.Texture) {
  return shaderMat(FRAG, {
    camPos: { value: new THREE.Vector3() }, camRot: { value: new THREE.Matrix3() },
    tanHalf: { value: 0.45 }, aspect: { value: 16 / 9 }, tVessels: { value: tex },
    weight: { value: 1 }, aperture: { value: -1 }, time: { value: 0 },
  }, { blending: THREE.AdditiveBlending, transparent: true });
}

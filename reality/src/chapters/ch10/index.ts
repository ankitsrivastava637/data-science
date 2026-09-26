// Chapter 10 · Cosmos — a continuous zoom out: human → room → Earth → Moon → Solar System → stars →
// Milky Way → Local Group → cosmic web (grown with the Zel'dovich approximation) → the observable
// universe, where distance is look-back time. Each layer lives in its own units around its own
// origin (floating origin); one monotonic field-width track drives them all.
import * as THREE from 'three';
import { feature } from 'topojson-client';
import land50 from 'world-atlas/land-50m.json';
import type { ChapterInstance, ChapterOutput, EngineContext, Frame } from '../../engine/types';
import { ramp, clamp, trap, smooth } from '../../engine/ease';
import { track } from '../../engine/choreo';
import { projectToScreen } from '../util';
import { Rng } from '../../engine/prng';
import { COMMON } from '../../shaders/common';
import { comovingMpc, lookbackGyr, growth, particleHorizonMpc, hubbleRadiusMpc, zAtLookback } from '../../math/cosmology';
import { registerTarget } from '../../engine/targets';
import { makeTarget } from '../../engine/particles';
import type { Web } from '../../math/zeldovich';

const AU = 149597870700, PC = 3.0856775814913673e16, LY = 9.4607304725808e15, MPC = PC * 1e6, KPC = PC * 1e3, GLY = LY * 1e9;
const FOV = 40;
/** where the zoom leaves the ground: central India (lon, lat in degrees) */
const SITE: [number, number] = [78, 22];
const EARTH_ROT = -2.2;
// log10(field width / m) against local time; each segment eases in and out, so the zoom lingers at
// every rung of the ladder (room, land, Earth, Moon, planets, stars, Galaxy, Local Group, web, horizon).
export const sTrack = track([[0, 0.3], [4.2, 1.2], [8, 4.4], [11, 6.95], [12.5, 7.15], [15.5, 9.25], [16.5, 9.35], [19.5, 12.9], [20.5, 13.0], [23.5, 17.2], [24.5, 17.35], [27.5, 21.05], [28.8, 21.3], [31, 23.0], [31.8, 23.1], [34, 25.15], [40, 25.3], [46, 26.35], [52, 27.05], [61, 27.1]]);
const el = track([[0, 0.28], [3.4, 0.36], [5.6, 1.45], [9.4, 1.45], [12.2, 0.75], [15.5, 0.95], [19.5, 0.62], [23, 0.5], [26.5, 0.95], [29, 0.8], [31, 0.6], [33.5, 1.05], [40, 1.0], [45, 0.4], [61, 0.3]]);
const az = track([[0, 0.2], [61, 2.2]]);

function fadeS(s: number, a0: number, a1: number, b0: number, b1: number) {
  return Math.min(clamp((s - a0) / (a1 - a0)), 1 - clamp((s - b0) / (b1 - b0)));
}

// ── Earth texture from Natural Earth land polygons (world-atlas, public domain) ──
function earthTexture(): THREE.CanvasTexture {
  const W = 2048, H = 1024;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff';
  const topo = land50 as unknown as Parameters<typeof feature>[0];
  const geo = feature(topo, (topo as any).objects.land) as unknown as { features: { geometry: { type: string; coordinates: number[][][][] | number[][][] } }[] };
  const X = (lon: number) => ((lon + 180) / 360) * W, Y = (lat: number) => ((90 - lat) / 180) * H;
  for (const f of geo.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][]);
    for (const poly of polys) {
      g.beginPath();
      for (const ring of poly) {
        let prevLon = ring[0][0];
        ring.forEach(([lon, lat], i) => {
          // break segments that jump across the antimeridian
          if (i === 0 || Math.abs(lon - prevLon) > 180) g.moveTo(X(lon), Y(lat)); else g.lineTo(X(lon), Y(lat));
          prevLon = lon;
        });
        g.closePath();
      }
      g.fill('evenodd');
    }
  }
  // Antarctica: fill the polar cap robustly
  g.fillRect(0, Y(-85), W, H - Y(-85));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// mean-preserving land texture detail from 3 km to 110 km, evaluated on the sphere (units: 1000 km)
// so the globe and the tangent-plane close-up agree where they cross-fade. Procedural, illustrative.
const LAND_DETAIL = /* glsl */ `
float landDetail(vec3 w){
  float d1 = fbm3(w*9.0), d2 = fbm3(w*70.0 + 3.0), d3 = fbm3(w*330.0 + 7.0);
  float dr = 1.0 - abs(2.0*fbm3(w*140.0 + 11.0) - 0.94); // ridged: drainage-like lines
  return 0.66 + 0.72*(0.4*d1 + 0.3*d2 + 0.2*d3 + 0.1*dr*0.94) / 0.94;
}`;
const EARTH_FRAG = /* glsl */ `
precision highp float;
in vec3 vN; in vec3 vW; in vec2 vUv2;
uniform sampler2D tLand; uniform sampler2D tDay; uniform sampler2D tNight;
uniform vec3 sunDir; uniform vec3 uSite; uniform float uW; uniform float uT; uniform float uNear;
${COMMON}
${LAND_DETAIL}
out vec4 o;
void main(){
  vec3 n = normalize(vN);
  float land = texture(tLand, vUv2).r;
  vec3 alb = texture(tDay, vUv2).rgb;
  alb *= mix(1.0, landDetail(vW), uNear*land);
  // clouds (procedural, illustrative): denser near the equator and in the storm tracks; kept clear
  // over the site the camera descends to
  float lat = (vUv2.y - 0.5) * 3.14159;
  vec2 cuv = vUv2*vec2(10.0, 5.0) + vec2(uT*0.003, 0.0);
  float band = 0.35*exp(-pow(lat/0.14, 2.0)) + 0.3*smoothstep(0.55, 1.0, abs(lat));
  vec2 wv = vec2(fbm(cuv*1.7 + 3.0), fbm(cuv*1.7 + 8.0)) - 0.5;
  float cf = fbm(cuv + wv*vec2(1.6, 0.7));                  // large systems, sheared along latitude
  float fine = fbm(cuv*7.0 + wv*3.0) - 0.5;                   // eroded, cellular edges
  float cl = smoothstep(0.56 - band*0.22, 0.66, cf + fine*0.32);
  cl *= 0.55 + 0.45*smoothstep(0.3, 0.7, fbm(cuv*15.0 + 2.0)); // texture inside the decks
  cl *= smoothstep(0.04, 0.2, distance(normalize(vW), uSite));
  cl *= 1.0 - 0.9*uNear;
  alb = mix(alb, vec3(0.74), cl*0.85);
  float ndl = dot(n, normalize(sunDir));
  float day = smoothstep(-0.08, 0.2, ndl);
  vec3 col = alb * (0.015 + 1.35*max(0.0, ndl));
  // city lights on the night side (warm channel of the night-lights map)
  vec3 nl = texture(tNight, vUv2).rgb;
  float city = max(0.0, nl.r - 0.8*nl.b);
  col += vec3(1.0, 0.72, 0.42) * city * 3.0 * (1.0 - smoothstep(-0.2, 0.02, ndl)) * (1.0 - cl);
  // specular glint on water
  vec3 v = normalize(cameraPosition - vW);
  vec3 h = normalize(normalize(sunDir) + v);
  col += (1.0 - land) * (1.0 - cl) * vec3(1.0, 0.9, 0.75) * (pow(max(0.0, dot(n, h)), 700.0) * 0.4 + pow(max(0.0, dot(n, h)), 80.0) * 0.025) * day;
  // atmosphere rim
  float rim = pow(1.0 - max(0.0, dot(n, v)), 3.0);
  col += vec3(0.25, 0.45, 0.9) * rim * (0.08 + 0.9*smoothstep(-0.25, 0.4, ndl)) * 0.6 * (1.0 - 0.8*uNear);
  o = vec4(col * uW, 1.0);
}`;

// Land on a local tangent plane (metres). The colour comes from the same Blue Marble texel the globe
// shows at this site; procedural fields, trees, roofs and a river modulate it around that mean
// (illustrative), so the hand-over to the globe is seamless.
const GROUND_FRAG = /* glsl */ `
precision highp float;
in vec2 vP;
uniform sampler2D tDay;
uniform vec3 sunDir; uniform float uW; uniform float uR; uniform float uHole;
uniform vec2 uEast; uniform vec2 uNorth; uniform vec3 uUpW; uniform vec3 uEastW; uniform vec3 uNorthW; uniform float uRot;
${COMMON}
${LAND_DETAIL}
out vec4 o;
float lod(float size, float pw){ return smoothstep(1.2, 4.0, size / pw); }
void main(){
  vec2 p = vP;
  float pw = max(1e-4, length(fwidth(p)));
  float r = length(p);
  // the sphere point under this plane point (gnomonic), in the globe's world frame (1000 km units)
  vec3 wdir = normalize(uUpW + (dot(p, uEast)*uEastW + dot(p, uNorth)*uNorthW) / 6371000.0);
  vec3 w = wdir * 6.371;
  // back to the sphere's texture coordinates (undo the globe's rotation about y)
  float rc = cos(-uRot), rs = sin(-uRot);
  vec3 lo = vec3(rc*wdir.x + rs*wdir.z, wdir.y, -rs*wdir.x + rc*wdir.z);
  vec2 uv = vec2(fract(atan(lo.z, -lo.x) / 6.2831853), 1.0 - acos(clamp(lo.y, -1.0, 1.0)) / 3.1415927);
  vec3 base = texture(tDay, uv).rgb * landDetail(w);
  // district-scale variation (1–10 km), mean ≈ 1
  float dist = fbm(p/3800.0 + 2.0);
  vec3 m = mix(vec3(0.86,0.93,0.84), vec3(1.12,1.04,0.94), dist) * lod(1500.0, pw) + (1.0 - lod(1500.0, pw));
  // farmland parcels, 60–240 m, rotated and warped per district
  float farm = smoothstep(0.36, 0.5, fbm(p/14000.0 + 5.3));
  // one orientation and parcel size per ~2.6 km district (no spatially varying rotation, which swirls)
  vec2 dcell = floor(p/2600.0 + (vec2(vnoise(p/900.0), vnoise(p/900.0 + 5.0)) - 0.5)*0.35);
  float ang = (hash12(dcell + 31.0) - 0.5) * 1.4;
  mat2 R = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
  float size = mix(60.0, 220.0, hash12(dcell + 77.0));
  vec2 q = R * p / size;
  q += (vec2(vnoise(q*0.31), vnoise(q*0.31 + 9.1)) - 0.5) * 0.7;
  vec2 c = floor(q), f = fract(q);
  float h = hash12(c + 101.0), h2 = hash12(c + 7.0);
  vec3 tint = h < 0.3 ? vec3(0.62,0.95,0.6) : h < 0.52 ? vec3(1.22,1.06,0.86) : h < 0.72 ? vec3(0.9,0.92,0.82) : h < 0.88 ? vec3(1.35,1.2,1.05) : vec3(0.5,0.62,0.48);
  tint *= 0.85 + 0.3*h2;
  float fur = 0.93 + 0.07*sin((h2 > 0.5 ? f.x : f.y) * size * 1.3);
  tint *= mix(1.0, fur, lod(size/40.0, pw));
  float e = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) * size;
  float bund = (1.0 - smoothstep(0.6, 1.8, e)) * lod(2.5, pw);
  tint = mix(tint, vec3(1.15,1.05,0.92), bund*0.6);
  m *= mix(vec3(1.0), tint, farm * lod(size, pw));
  // scattered trees (~11 m cells): canopy with a sunlit side and a cast shadow
  vec2 sd = normalize(sunDir.xz + 1e-5);
  vec2 tc = floor(p/11.0); vec2 jit = (hash22(tc) - 0.5)*0.55;
  vec2 tf = fract(p/11.0) - 0.5 - jit;
  float has = step(0.55 + 0.35*farm, hash12(tc + 3.0));
  float cr = (0.17 + 0.08*hash12(tc + 5.0));
  float aa = pw/11.0;
  float lump = 0.025*sin(atan(tf.y, tf.x)*7.0 + hash12(tc)*6.28) + 0.02*sin(atan(tf.y, tf.x)*11.0);
  float canopy = (1.0 - smoothstep(cr + lump - aa, cr + lump + aa, length(tf))) * has;
  float shadow = (1.0 - smoothstep(cr - aa, cr + aa*2.0, length(tf + sd*0.12))) * has;
  float lit = (0.8 + 0.5*clamp(dot(tf/cr, sd), -1.0, 1.0)) * (0.8 + 0.4*vnoise(p*1.3 + 17.0));
  float tl = lod(4.0, pw);
  m *= mix(1.0, 0.55, shadow*tl*(1.0 - canopy));
  m = mix(m, vec3(0.42,0.58,0.36)*lit, canopy*tl);
  // villages: roofs in clusters
  float vil = smoothstep(0.66, 0.74, fbm(p/5000.0 + 21.0));
  vec2 bc = floor(p/14.0); vec2 bf = fract(p/14.0);
  float roof = step(0.35, hash12(bc + 55.0)) * step(0.18, bf.x) * step(bf.x, 0.82) * step(0.22, bf.y) * step(bf.y, 0.78);
  vec3 rt = hash12(bc + 9.0) < 0.6 ? vec3(1.8,1.05,0.8) : vec3(1.7,1.7,1.7);
  m *= mix(vec3(1.0), mix(vec3(1.0), rt, roof), vil * lod(8.0, pw));
  // a clearing around the house
  m = mix(m, vec3(1.25,1.12,0.95), 1.0 - smoothstep(6.0, 9.0, r));
  vec3 col = base * m;
  // a meandering river (~50 m), fading out once it is thinner than a pixel
  float rn = fbm(p/16000.0 + 1.7) - 0.5;
  float rw = 50.0/16000.0*0.6;
  float river = (1.0 - smoothstep(rw, rw + fwidth(rn)*1.2, abs(rn))) * lod(50.0, pw);
  float bank = (1.0 - smoothstep(rw*2.5, rw*5.0 + fwidth(rn), abs(rn))) * lod(150.0, pw);
  col *= mix(vec3(1.0), vec3(0.6,0.85,0.55), bank*0.6);
  col = mix(col, vec3(0.015,0.03,0.04), river);
  float ndl = max(0.0, normalize(sunDir).y);
  vec3 litc = col * (0.015 + 1.35*ndl);
  float inRoom = step(abs(p.x), 2.5) * step(abs(p.y), 2.0);
  float fade = (1.0 - smoothstep(0.35*uR, uR, r)) * (1.0 - inRoom*uHole);
  o = vec4(litc * uW * fade, 1.0);
}`;

const EARTH_VERT = /* glsl */ `out vec3 vN; out vec3 vW; out vec2 vUv2;
void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vUv2 = uv; gl_Position = projectionMatrix*viewMatrix*w; }`;

function pointsMat(size: number, maxPx = 40) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */ `in vec3 aCol; uniform float uProj; uniform float uSize; uniform float uMaxPx; out vec3 vC; out float vF;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
        float px = uSize*uProj/max(1e-6,-mv.z); vF = min(1.0, px/1.2); gl_PointSize = clamp(px, 1.2, uMaxPx); vC = aCol; }`,
    fragmentShader: /* glsl */ `precision highp float; in vec3 vC; in float vF; uniform float uW; uniform float uGain; out vec4 o;
      void main(){ vec2 q=gl_PointCoord*2.0-1.0; float r2=dot(q,q); if(r2>1.0) discard; o = vec4(vC*(exp(-r2*3.0)-exp(-3.0))*vF*uW*uGain, 1.0); }`,
    uniforms: { uProj: { value: 500 }, uSize: { value: size }, uMaxPx: { value: maxPx }, uW: { value: 1 }, uGain: { value: 1 } },
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}
function pointCloud(pos: Float32Array, col: Float32Array, size: number, maxPx = 40) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  const p = new THREE.Points(g, pointsMat(size, maxPx));
  p.frustumCulled = false;
  return p;
}

/** barred spiral particle model (kpc): bulge, bar, exponential disk, two major arms from the bar
 *  ends plus two weaker ones, young blue stars and HII knots concentrated in the arms. Illustrative. */
function makeGalaxy(n: number, seed: number, scale = 1) {
  const rng = new Rng(seed, 2101);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const pitch = 0.23, R0 = 3.6; // arms start near the bar ends
  for (let i = 0; i < n; i++) {
    const kind = rng.float();
    let x: number, y: number, z: number, c: [number, number, number];
    let b = 0.6 + 0.8 * rng.float();
    if (kind < 0.07) { // bulge
      const r = Math.abs(rng.normal()) * 0.55;
      const th = Math.acos(2 * rng.float() - 1), ph = rng.range(0, Math.PI * 2);
      x = r * Math.sin(th) * Math.cos(ph); y = r * Math.cos(th) * 0.7; z = r * Math.sin(th) * Math.sin(ph);
      c = [1.0, 0.8, 0.56]; b *= 0.8;
    } else if (kind < 0.17) { // bar, half-length ~4 kpc
      x = rng.normal() * 1.6; z = rng.normal() * 0.45; y = rng.normal() * 0.22;
      c = [1.0, 0.82, 0.6]; b *= 0.8;
    } else {
      const r = -2.6 * Math.log(1 - rng.float() * 0.99) + 0.5;
      const armSel = rng.float();
      const major = armSel < 0.75;
      const arm = (major ? 0 : Math.PI / 2) + (rng.float() < 0.5 ? 0 : Math.PI);
      const inArm = r > R0 * 0.85 && rng.float() < (major ? 0.62 : 0.45);
      const theta = arm + Math.log(Math.max(r, R0) / R0) / Math.tan(pitch) + rng.normal() * (0.12 + 0.1 * rng.float());
      const a = inArm ? theta : rng.range(0, Math.PI * 2);
      x = r * Math.cos(a); z = r * Math.sin(a); y = rng.normal() * 0.12 * (1 + r / 14);
      const young = inArm && rng.float() < 0.6;
      c = young ? [0.62, 0.74, 1.0] : [0.95, 0.85, 0.7];
      if (inArm && rng.float() < 0.07) { c = [1.0, 0.5, 0.52]; b *= 1.4; } // HII regions
      if (!inArm) b *= 0.75;
    }
    pos.set([x * scale, y * scale, z * scale], i * 3);
    col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
  }
  return { pos, col };
}

export default function create(ctx: EngineContext): ChapterInstance {
  const { quality } = ctx;
  const layers: { name: string; scene: THREE.Scene; unit: number; focus: (lt: number, s: number) => THREE.Vector3; w: (s: number) => number; weight: number; cam: THREE.PerspectiveCamera; points: THREE.Points[]; dir?: (d: THREE.Vector3, s: number) => THREE.Vector3 }[] = [];
  const mkLayer = (name: string, unit: number, w: (s: number) => number, focus: (lt: number, s: number) => THREE.Vector3) => {
    const L: (typeof layers)[number] = { name, scene: new THREE.Scene(), unit, focus, w, weight: 0, cam: new THREE.PerspectiveCamera(FOV, 16 / 9, 0.01, 1e6), points: [] as THREE.Points[] };
    layers.push(L);
    return L;
  };

  // 1 · human and room (m): a daylit room seen from behind a standing figure, walls single-sided so
  // the pull-back becomes a cut-away
  const room = mkLayer('room', 1, (s) => fadeS(s, -1, -0.5, 1.3, 1.9), (lt, s) => new THREE.Vector3(0, 0.95 * (1 - smooth(clamp((s - 0.9) / 1.2))), 0));
  {
    const skin = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.75 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.9 });
    const fig = new THREE.Group();
    // torso as a lathe profile (radius, height), flattened front-to-back
    const prof = [[0.0, 0.8], [0.15, 0.82], [0.165, 0.92], [0.15, 1.03], [0.14, 1.1], [0.16, 1.26], [0.2, 1.4], [0.19, 1.45], [0.07, 1.49], [0.052, 1.52], [0.05, 1.56], [0.0, 1.57]].map(([r, y]) => new THREE.Vector2(r, y));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), cloth); torso.scale.set(1, 1, 0.62);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 24), skin); head.scale.set(0.9, 1.15, 1.0); head.position.y = 1.67;
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.72, 6, 16), cloth);
    const legL = leg.clone(); legL.position.set(-0.085, 0.43, 0); legL.rotation.z = 0.02;
    const legR = leg.clone(); legR.position.set(0.085, 0.43, 0); legR.rotation.z = -0.02;
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.56, 6, 16), cloth);
    const armL = arm.clone(); armL.position.set(-0.225, 1.12, 0.01); armL.rotation.z = -0.07;
    const armR = arm.clone(); armR.position.set(0.225, 1.12, 0.01); armR.rotation.z = 0.07;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), skin);
    const handL = hand.clone(); handL.position.set(-0.245, 0.8, 0.01);
    const handR = hand.clone(); handR.position.set(0.245, 0.8, 0.01);
    fig.add(torso, head, legL, legR, armL, armR, handL, handR);
    fig.position.z = -0.6;
    room.scene.add(fig);
    const wallM = new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.95 });
    const RW = 5, RH = 2.7, RD = 4;
    const wall = (w: number, h: number, x: number, y: number, z: number, ry: number) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallM); m.position.set(x, y, z); m.rotation.y = ry; room.scene.add(m); };
    // back wall (z = −2) around a 1.6 × 1.2 m window at sill height 0.9 m
    wall(RW, 0.9, 0, 0.45, -RD / 2, 0); wall(RW, RH - 2.1, 0, (2.1 + RH) / 2, -RD / 2, 0);
    wall((RW - 1.6) / 2, 1.2, -(1.6 + (RW - 1.6) / 2) / 2, 1.5, -RD / 2, 0); wall((RW - 1.6) / 2, 1.2, (1.6 + (RW - 1.6) / 2) / 2, 1.5, -RD / 2, 0);
    wall(RD, RH, -RW / 2, RH / 2, 0, Math.PI / 2); wall(RD, RH, RW / 2, RH / 2, 0, -Math.PI / 2);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshBasicMaterial({ color: 0xd9e2ea }));
    win.position.set(0, 1.5, -RD / 2 - 0.01); room.scene.add(win);
    const mull = new THREE.MeshStandardMaterial({ color: 0x4a453e, roughness: 0.8 });
    const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.2, 0.04), mull); bar1.position.set(0, 1.5, -RD / 2); room.scene.add(bar1);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.04), mull); bar2.position.set(0, 1.5, -RD / 2); room.scene.add(bar2);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(RW, RH, RD)), new THREE.LineBasicMaterial({ color: 0x6f6a60 }));
    edges.position.y = RH / 2; room.scene.add(edges);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2; room.scene.add(floor);
    // daylight through the window, plus sky fill
    const sun = new THREE.DirectionalLight(0xfff0dc, 2.2); sun.position.set(0.6, 2.2, -3.5); room.scene.add(sun);
    const winLight = new THREE.PointLight(0xdfe8f2, 6, 7); winLight.position.set(0, 1.5, -1.6); room.scene.add(winLight);
    room.scene.add(new THREE.HemisphereLight(0x9aa8ba, 0x2a2420, 0.55));
  }
  // 1b · the land around the room (m): procedural, illustrative landscape on a local tangent plane,
  // carrying the zoom from metres to ~100 km until the globe takes over
  const ground = mkLayer('ground', 1, (s) => fadeS(s, 0.85, 1.35, 5.6, 6.2), () => new THREE.Vector3());
  const groundMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */ `out vec2 vP; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vP = w.xz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: GROUND_FRAG,
    uniforms: { tDay: { value: null as THREE.Texture | null }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, uW: { value: 1 }, uR: { value: 100 }, uHole: { value: 1 }, uEast: { value: new THREE.Vector2(1, 0) }, uNorth: { value: new THREE.Vector2(0, -1) }, uUpW: { value: new THREE.Vector3() }, uEastW: { value: new THREE.Vector3() }, uNorthW: { value: new THREE.Vector3() }, uRot: { value: EARTH_ROT } },
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 8, 8), groundMat); // scaled to the fade radius each frame
  groundMesh.rotation.x = -Math.PI / 2; groundMesh.frustumCulled = false;
  ground.scene.add(groundMesh);
  // 2 · Earth and Moon (units: 1000 km)
  const R_E = 6.371;
  const lonlat = (lon: number, lat: number) => { const ph = ((lon + 180) / 360) * Math.PI * 2, th = ((90 - lat) * Math.PI) / 180; return new THREE.Vector3(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)).multiplyScalar(R_E).applyAxisAngle(new THREE.Vector3(0, 1, 0), EARTH_ROT); };
  const surfacePoint = lonlat(SITE[0], SITE[1]);
  const earth = mkLayer('earth', 1e6, (s) => fadeS(s, 5.55, 6.15, 10.5, 11.2), (lt, s) => surfacePoint.clone().lerp(new THREE.Vector3(), smooth(clamp((s - 6.4) / 1.6))).lerp(new THREE.Vector3(160, 0, 0), smooth(clamp((s - 8.4) / 1.2))));
  // the tangent frame at the surface point: the ground layer's +y maps to the local vertical
  const toSurface = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), surfacePoint.clone().normalize());
  earth.dir = (d, s) => d.clone().applyQuaternion(toSurface).lerp(d, smooth(clamp((s - 6.6) / 1.6))).normalize();
  const landTex = earthTexture();
  const imgTex = (img: HTMLImageElement) => { const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping; t.needsUpdate = true; return t; };
  const dayTex = imgTex(ctx.shared.images.earthDay), nightTex = imgTex(ctx.shared.images.earthNight);
  const earthMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG, uniforms: { tLand: { value: landTex }, tDay: { value: dayTex }, tNight: { value: nightTex }, sunDir: { value: new THREE.Vector3(1, 0.25, 0.6).normalize() }, uSite: { value: surfacePoint.clone().normalize() }, uW: { value: 1 }, uT: { value: 0 }, uNear: { value: 1 } }, transparent: true, blending: THREE.AdditiveBlending });
  const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(R_E, 192, 128), earthMat);
  earthMesh.rotation.y = EARTH_ROT;
  const sunDirV = surfacePoint.clone().normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.75).add(new THREE.Vector3(0, 0.15, 0)).normalize();
  earthMat.uniforms.sunDir.value.copy(sunDirV);
  {
    const inv = toSurface.clone().invert();
    groundMat.uniforms.sunDir.value.copy(sunDirV).applyQuaternion(inv);
    const up = surfacePoint.clone().normalize();
    const east = new THREE.Vector3(0, 1, 0).cross(up).normalize(), north = up.clone().cross(east);
    groundMat.uniforms.uUpW.value.copy(up); groundMat.uniforms.uEastW.value.copy(east); groundMat.uniforms.uNorthW.value.copy(north);
    const eL = east.clone().applyQuaternion(inv), nL = north.clone().applyQuaternion(inv);
    groundMat.uniforms.uEast.value.set(eL.x, eL.z); groundMat.uniforms.uNorth.value.set(nL.x, nL.z);
    groundMat.uniforms.tDay.value = dayTex;
  }
  earth.scene.add(earthMesh);
  const moonMat = new THREE.MeshStandardMaterial({ color: 0x8c8780, roughness: 1 });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1.737, 64, 32), moonMat);
  moon.position.set(384.4 * Math.cos(0.5), 0, 384.4 * Math.sin(0.5));
  earth.scene.add(moon);
  const moonOrbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 257 }, (_, i) => new THREE.Vector3(384.4 * Math.cos((i / 256) * Math.PI * 2), 0, 384.4 * Math.sin((i / 256) * Math.PI * 2)))), new THREE.LineBasicMaterial({ color: 0x6f6a60, transparent: true, blending: THREE.AdditiveBlending, depthTest: false }));
  earth.scene.add(moonOrbit);
  const sunL = new THREE.DirectionalLight(0xfff4e4, 3); sunL.position.copy(sunDirV); earth.scene.add(sunL);
  earth.scene.add(new THREE.AmbientLight(0x202020, 0.3));
  // 3 · Solar System (au): orbits as circles, sizes not to scale
  const solar = mkLayer('solar', AU, (s) => fadeS(s, 10.3, 11.0, 15.0, 15.7), (lt, s) => new THREE.Vector3(Math.cos(0.9), 0, Math.sin(0.9)).multiplyScalar(1 - smooth(clamp((s - 11.2) / 1.2))));
  const planets: [string, number, number][] = [['Mercury', 0.387, 2.1], ['Venus', 0.723, 4.0], ['Earth', 1.0, 0.9], ['Mars', 1.524, 5.5], ['Jupiter', 5.203, 1.3], ['Saturn', 9.537, 3.3], ['Uranus', 19.19, 5.1], ['Neptune', 30.07, 0.4]];
  const orbitMat = new THREE.LineBasicMaterial({ color: 0x6f6a60, transparent: true, blending: THREE.AdditiveBlending, depthTest: false });
  const pp = new Float32Array(planets.length * 3), pc = new Float32Array(planets.length * 3);
  planets.forEach(([_, a, ang], i) => {
    solar.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 257 }, (_, k) => new THREE.Vector3(a * Math.cos((k / 256) * Math.PI * 2), 0, a * Math.sin((k / 256) * Math.PI * 2)))), orbitMat));
    pp.set([a * Math.cos(ang), 0, a * Math.sin(ang)], i * 3); pc.set([1, 0.92, 0.8], i * 3);
  });
  const planetPts = pointCloud(pp, pc, 0.001); solar.points.push(planetPts); solar.scene.add(planetPts);
  const sunPt = pointCloud(new Float32Array([0, 0, 0]), new Float32Array([6, 5, 3.6]), 0.001); solar.points.push(sunPt); solar.scene.add(sunPt);
  // 4 · stars within ~25 pc (procedural, realistic density ~0.1 per pc³); Proxima Centauri placed at 1.30 pc
  const stars = mkLayer('stars', PC, (s) => fadeS(s, 13.9, 14.7, 19.2, 19.9), () => new THREE.Vector3());
  {
    const rng = new Rng(ctx.seed, 2201);
    const N = 6500; const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 25 * Math.cbrt(rng.float()), th = Math.acos(2 * rng.float() - 1), ph = rng.range(0, Math.PI * 2);
      pos.set([r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)], i * 3);
      const L = Math.pow(rng.float(), 6) * 4 + 0.15; // mostly faint red dwarfs
      const warm = rng.float();
      col.set([L, L * (0.7 + 0.25 * warm), L * (0.45 + 0.5 * warm)], i * 3);
    }
    // Proxima Centauri: RA 14h29.7m, Dec −62°41′ (equatorial frame, y = celestial north)
    const ra = ((14 + 29.7 / 60) / 24) * Math.PI * 2, dec = (-62.68 * Math.PI) / 180;
    pos.set([1.30 * Math.cos(dec) * Math.cos(ra), 1.30 * Math.sin(dec), 1.30 * Math.cos(dec) * Math.sin(ra)], 0);
    col.set([1.2, 0.7, 0.45], 0);
    pos.set([0, 0, 0], 3); col.set([3, 2.8, 2.3], 3); // the Sun
    const sp = pointCloud(pos, col, 0.18, 6); stars.points.push(sp); stars.scene.add(sp);
  }
  // 5 · Milky Way (kpc) — illustrative particle model; the Sun 8.2 kpc from the centre
  const SUN_G = new THREE.Vector3(8.2, 0.02, 0);
  const galaxy = mkLayer('galaxy', KPC, (s) => fadeS(s, 18.9, 19.6, 22.7, 23.3), (lt, s) => SUN_G.clone().multiplyScalar(1 - smooth(clamp((s - 19.8) / 1.2))));
  const gN = Math.round(140000 * Math.min(1.5, quality.particles));
  const gm = makeGalaxy(gN, ctx.seed);
  const galPts = pointCloud(gm.pos, gm.col, 0.02, 2.5);
  (galPts.material as THREE.ShaderMaterial).uniforms.uGain = { value: 0.26 }; galaxy.points.push(galPts); galaxy.scene.add(galPts);
  registerTarget('galaxy', makeTarget(16384, (i, d, o) => { d[o] = gm.pos[i * 3] / 15; d[o + 1] = gm.pos[i * 3 + 1] / 15; d[o + 2] = gm.pos[i * 3 + 2] / 15; d[o + 3] = gm.col[i * 3 + 2] / 1.4; }), 'unit');
  // 6 · Local Group (Mpc)
  const lg = mkLayer('lg', MPC, (s) => fadeS(s, 22.3, 22.8, 24.1, 24.7), () => new THREE.Vector3(0.765, 0.05, 0.1).normalize().multiplyScalar(0.765 * 0.5));
  {
    const mw = makeGalaxy(25000, ctx.seed + 1, 0.001);
    const m31 = makeGalaxy(30000, ctx.seed + 2, 0.0013);
    const m33 = makeGalaxy(8000, ctx.seed + 3, 0.0006);
    const dir31 = new THREE.Vector3(0.765, 0.05, 0.1).normalize().multiplyScalar(0.765);
    const rot31 = new THREE.Matrix4().makeRotationX(1.1).multiply(new THREE.Matrix4().makeRotationZ(0.4));
    const rot33 = new THREE.Matrix4().makeRotationX(0.6);
    const add = (src: { pos: Float32Array; col: Float32Array }, m: THREE.Matrix4, off: THREE.Vector3) => {
      const v = new THREE.Vector3();
      for (let i = 0; i < src.pos.length / 3; i++) { v.set(src.pos[i * 3], src.pos[i * 3 + 1], src.pos[i * 3 + 2]).applyMatrix4(m).add(off); src.pos.set([v.x, v.y, v.z], i * 3); }
      const p = pointCloud(src.pos, src.col, 0.00022, 2.5); lg.points.push(p); lg.scene.add(p);
    };
    add(mw, new THREE.Matrix4(), new THREE.Vector3());
    add(m31, rot31, dir31);
    add(m33, rot33, dir31.clone().add(new THREE.Vector3(0.1, -0.12, 0.2)));
    const rng = new Rng(ctx.seed, 2301);
    const dn = 60; const dp = new Float32Array(dn * 3), dc = new Float32Array(dn * 3);
    for (let i = 0; i < dn; i++) { const host = rng.float() < 0.5 ? new THREE.Vector3() : dir31; const r = 0.03 + 0.25 * rng.float(); const d = new THREE.Vector3(rng.normal(), rng.normal(), rng.normal()).normalize().multiplyScalar(r).add(host); dp.set([d.x, d.y, d.z], i * 3); dc.set([0.6, 0.55, 0.5], i * 3); }
    const dw = pointCloud(dp, dc, 0.004); lg.points.push(dw); lg.scene.add(dw);
  }
  // 7 · cosmic web (Mpc), Zel'dovich: x = q + D ψ(q)
  const web = ctx.shared.extra.web as Web;
  const webLayer = mkLayer('web', MPC, (s) => fadeS(s, 23.9, 24.5, 26.2, 26.8), () => new THREE.Vector3());
  const webGeo = new THREE.BufferGeometry();
  webGeo.setAttribute('position', new THREE.BufferAttribute(web.q, 3));
  webGeo.setAttribute('aDisp', new THREE.BufferAttribute(web.disp, 3));
  const webMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */ `in vec3 aDisp; uniform float uD; uniform float uProj; uniform float uBox; out float vF; out float vEdge;
      void main(){ vec3 p = position + uD*aDisp; vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv;
        float px = 1.4*uProj/max(1e-3,-mv.z); vF = min(1.0, px/1.3); gl_PointSize = clamp(px, 1.2, 6.0);
        vEdge = smoothstep(uBox*0.5, uBox*0.36, max(abs(position.x), abs(position.z))) * smoothstep(uBox*0.09, uBox*0.05, abs(p.y)); }`,
    fragmentShader: /* glsl */ `precision highp float; in float vF; in float vEdge; uniform float uW; out vec4 o;
      void main(){ vec2 q=gl_PointCoord*2.0-1.0; float r2=dot(q,q); if(r2>1.0) discard; o = vec4(vec3(0.95,0.82,0.64)*(exp(-r2*2.5)-exp(-2.5))*vF*vEdge*uW*0.6, 1.0); }`,
    uniforms: { uD: { value: 0.02 }, uProj: { value: 500 }, uBox: { value: web.box }, uW: { value: 1 } },
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const webPts = new THREE.Points(webGeo, webMat); webPts.frustumCulled = false;
  webLayer.scene.add(webPts);
  registerTarget('web', makeTarget(Math.min(65536, web.q.length / 3), (i, d, o) => { const k = Math.floor((i * (web.q.length / 3)) / 65536); d[o] = (web.q[k * 3] + web.disp[k * 3]) / web.box * 2; d[o + 1] = (web.q[k * 3 + 1] + web.disp[k * 3 + 1]) / web.box * 2; d[o + 2] = (web.q[k * 3 + 2] + web.disp[k * 3 + 2]) / web.box * 2; d[o + 3] = 0.6; }), 'unit');
  // 8 · observable universe (Gly, comoving): galaxies coloured by look-back time; horizons as spheres
  const uni = mkLayer('universe', GLY, (s) => fadeS(s, 25.6, 26.2, 99, 100), () => new THREE.Vector3());
  const MPC_GLY = MPC / GLY;
  const Rph = particleHorizonMpc() * MPC_GLY, Rh = hubbleRadiusMpc() * MPC_GLY, Rcmb = comovingMpc(1090) * MPC_GLY;
  // table: comoving distance (Gly) → look-back time (Gyr)
  const zt: [number, number][] = [];
  for (let i = 0; i <= 300; i++) { const z = Math.expm1((i / 300) * Math.log1p(1100)); zt.push([comovingMpc(z) * MPC_GLY, lookbackGyr(z)]); }
  const lbOf = (d: number) => { for (let i = 1; i < zt.length; i++) if (zt[i][0] >= d) { const f = (d - zt[i - 1][0]) / (zt[i][0] - zt[i - 1][0]); return zt[i - 1][1] + f * (zt[i][1] - zt[i - 1][1]); } return 13.8; };
  {
    const rng = new Rng(ctx.seed, 2401);
    const N = Math.round(70000 * Math.min(1.5, quality.particles));
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    let k = 0;
    while (k < N) {
      const r = Rph * Math.cbrt(rng.float());
      const lb = lbOf(r);
      if (r > Rcmb * 0.995) continue;
      if (lb > 13.2 && rng.float() > 0.08) continue; // few galaxies in the first few hundred Myr
      const th = Math.acos(2 * rng.float() - 1), ph = rng.range(0, Math.PI * 2);
      // clustering: modulate acceptance with low-frequency noise
      const x = r * Math.sin(th) * Math.cos(ph), y = r * Math.cos(th), z = r * Math.sin(th) * Math.sin(ph);
      const cl = 0.5 + 0.5 * Math.sin(x * 0.9 + Math.sin(y * 0.7)) * Math.cos(z * 0.8 + Math.sin(x * 0.5));
      if (rng.float() > 0.35 + 0.65 * cl) continue;
      pos.set([x, y, z], k * 3);
      const age = lb / 13.8; // 0 = here and now, 1 = the beginning
      const c = [lerpN(1.0, 0.55, age), lerpN(0.82, 0.68, age), lerpN(0.6, 1.0, age)];
      const b = (0.5 + rng.float()) * (1 - 0.55 * age);
      col.set([c[0] * b, c[1] * b, c[2] * b], k * 3);
      k++;
    }
    const up = pointCloud(pos, col, 0.07, 3); uni.points.push(up); uni.scene.add(up);
    // CMB surface (anisotropy pattern illustrative, not the Planck map)
    const M = 60000; const cp = new Float32Array(M * 3), cc = new Float32Array(M * 3);
    for (let i = 0; i < M; i++) {
      const th = Math.acos(2 * rng.float() - 1), ph = rng.range(0, Math.PI * 2);
      const x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
      cp.set([x * Rcmb, y * Rcmb, z * Rcmb], i * 3);
      const n = Math.sin(x * 7 + Math.sin(y * 5) * 2) * Math.cos(z * 6 + Math.sin(x * 9)) * 0.5 + Math.sin(y * 13 + z * 11) * 0.25;
      cc.set([0.55 + 0.25 * n, 0.4 + 0.1 * n, 0.3 - 0.15 * n], i * 3);
    }
    const cmb = pointCloud(cp, cc, 0.15, 3); uni.points.push(cmb); uni.scene.add(cmb);
    const ring = (r: number, color: number, dashed = false) => {
      const pts = Array.from({ length: 257 }, (_, i) => new THREE.Vector3(r * Math.cos((i / 256) * Math.PI * 2), 0, r * Math.sin((i / 256) * Math.PI * 2)));
      const m = dashed ? new THREE.LineDashedMaterial({ color, dashSize: r * 0.03, gapSize: r * 0.03, transparent: true, depthTest: false }) : new THREE.LineBasicMaterial({ color, transparent: true, depthTest: false });
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m);
      if (dashed) l.computeLineDistances();
      uni.scene.add(l);
      return l;
    };
    ring(Rh, 0x9cc2ff, true); ring(Rph, 0xffc98f); ring(Rcmb, 0xd8a08a, true);
    for (const t of [1, 5, 10]) ring(comovingMpc(zAtLookback(t)) * MPC_GLY, 0x5f5a52, true);
  }
  let W = 1, H = 1;
  const dir = new THREE.Vector3();
  let webGrowth = 0;

  return {
    update(f: Frame, out: ChapterOutput) {
      const lt = f.lt;
      W = f.width; H = f.height;
      const s = sTrack(lt);
      const Wm = Math.pow(10, s);
      const e = el(lt), a = az(lt);
      dir.set(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
      const proj = f.height / (2 * Math.tan((FOV * Math.PI) / 360));
      for (const L of layers) {
        L.weight = L.w(s);
        if (L.weight <= 0.001) continue;
        const field = Wm / L.unit;
        const d = field / (2 * Math.tan((FOV * Math.PI) / 360) * f.aspect);
        const tgt = L.focus(lt, s);
        L.cam.aspect = f.aspect; L.cam.fov = FOV; L.cam.near = d * 0.01; L.cam.far = d * 1000; L.cam.updateProjectionMatrix();
        const dl = L.dir ? L.dir(dir, s) : dir;
        L.cam.up.set(0, 1, 0);
        if (L.dir) L.cam.up.applyQuaternion(toSurface).lerp(new THREE.Vector3(0, 1, 0), smooth(clamp((s - 6.6) / 1.6))).normalize();
        L.cam.position.copy(tgt).addScaledVector(dl, d); L.cam.lookAt(tgt); L.cam.updateMatrixWorld();
        for (const p of L.points) { const u = (p.material as THREE.ShaderMaterial).uniforms; u.uProj.value = proj; u.uW.value = L.weight; }
      }
      // lit materials fade through opacity
      room.scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material & { opacity: number } | undefined; if (m && 'opacity' in m) { m.transparent = true; m.opacity = room.weight; } });
      moonMat.transparent = true; moonMat.opacity = earth.weight;
      earthMat.uniforms.uW.value = earth.weight;
      groundMat.uniforms.uW.value = ground.weight;
      groundMat.uniforms.uR.value = Math.max(40, 4 * Wm);
      groundMesh.scale.set(groundMat.uniforms.uR.value, groundMat.uniforms.uR.value, 1);
      groundMat.uniforms.uHole.value = room.weight;
      earthMat.uniforms.uT.value = lt;
      earthMat.uniforms.uNear.value = 1 - clamp((s - 6.0) / 1.5);
      (moonOrbit.material as THREE.LineBasicMaterial).opacity = earth.weight * fadeS(s, 8.2, 8.8, 99, 100) * 0.7;
      orbitMat.opacity = 0.6 * solar.weight;
      // web growth: a from 1/100 to 1, displacement ∝ D(a)
      const gu = smooth(clamp((lt - 33) / 6.5));
      const aSc = Math.exp(Math.log(0.01) * (1 - gu));
      webGrowth = growth(aSc);
      webMat.uniforms.uD.value = webGrowth;
      webMat.uniforms.uProj.value = proj;
      webMat.uniforms.uW.value = webLayer.weight * (0.55 + 0.45 * gu); // the nearly uniform early field reads as glare at full gain
      uni.scene.traverse((o) => { const m = (o as THREE.Line).material as THREE.LineBasicMaterial | undefined; if (m && (o as THREE.Line).isLine) m.opacity = uni.weight * 0.8; });

      // labels
      const lab = (L: typeof layers[number], p: THREE.Vector3, text: string, alpha: number, opts: Partial<{ align: 'left' | 'right' | 'center'; dx: number; dy: number }> = {}) => {
        if (alpha * L.weight <= 0.01) return;
        const q = projectToScreen(L.cam, p);
        if (!q.visible) return;
        out.labels.push({ x: q.x + (opts.dx ?? 0.02), y: q.y + (opts.dy ?? -0.02), text, alpha: alpha * L.weight, align: opts.align ?? 'left', leader: { x: q.x, y: q.y } });
      };
      lab(room, new THREE.Vector3(0.1, 1.72, -0.6), 'you: ~1.7 m', trap(0.3, 3.5, lt, 0.5, 0.6));
      lab(earth, new THREE.Vector3(0, R_E, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.75), 'Earth: radius 6,371 km', fadeS(s, 6.8, 7.2, 8.3, 8.8));
      lab(earth, moon.position, 'the Moon, 384,400 km away', fadeS(s, 8.8, 9.2, 10.2, 10.6));
      lab(solar, new THREE.Vector3(1, 0, 0), '1 au = 149,597,870,700 m', fadeS(s, 11.2, 11.6, 12.1, 12.5));
      lab(solar, new THREE.Vector3(30.07 * Math.cos(0.4), 0, 30.07 * Math.sin(0.4)), 'Neptune’s orbit (planet sizes not to scale)', fadeS(s, 12.6, 13.0, 14.2, 14.7));
      const prox = new THREE.Vector3(...(() => { const ra = ((14 + 29.7 / 60) / 24) * Math.PI * 2, dec = (-62.68 * Math.PI) / 180; return [1.3 * Math.cos(dec) * Math.cos(ra), 1.3 * Math.sin(dec), 1.3 * Math.cos(dec) * Math.sin(ra)]; })());
      lab(stars, prox, 'Proxima Centauri, 1.30 pc (4.2 ly)', fadeS(s, 16.3, 16.7, 18.0, 18.6));
      lab(stars, new THREE.Vector3(), 'the Sun', fadeS(s, 15.8, 16.2, 17.0, 17.5), { align: 'right', dx: -0.02 });
      lab(galaxy, SUN_G, 'the Sun, ~8.2 kpc from the centre', fadeS(s, 20.2, 20.6, 21.8, 22.3));
      lab(lg, new THREE.Vector3(0.765, 0.05, 0.1).normalize().multiplyScalar(0.765), 'Andromeda, ~765 kpc', fadeS(s, 22.9, 23.2, 23.9, 24.3));
      lab(lg, new THREE.Vector3(), 'Milky Way', fadeS(s, 22.9, 23.2, 23.9, 24.3), { align: 'right', dx: -0.02 });
      if (galaxy.weight > 0.3) out.labels.push({ x: 0.95, y: 0.86, text: 'illustrative model of the Galaxy', align: 'right', alpha: galaxy.weight * 0.8, size: 0.9 });
      if (webLayer.weight > 0.05 && lt < 45) {
        const z = 1 / aSc - 1;
        out.labels.push({ x: 0.95, y: 0.86, text: `Zel'dovich approximation · redshift z = ${z.toFixed(z > 10 ? 0 : 1)}   ·   a slice through a 500 Mpc box`, align: 'right', alpha: webLayer.weight * trap(33, 45, lt, 0.8, 1), size: 0.92 });
      }
      if (uni.weight > 0.05) {
        const ua = uni.weight;
        lab(uni, new THREE.Vector3(Rph * 0.7071, 0, Rph * 0.7071), `particle horizon: ${Rph.toFixed(0)} billion ly (comoving)`, ua * ramp(45.5, 47.5, lt), { dx: 0.02 });
        lab(uni, new THREE.Vector3(-Rh, 0, 0), `Hubble radius c/H₀: ${Rh.toFixed(1)} billion ly`, ua * ramp(47, 49, lt), { align: 'right', dx: -0.02 });
        lab(uni, new THREE.Vector3(0, 0, -Rcmb), `CMB: light released ~380,000 years after the Big Bang — its source is now ${Rcmb.toFixed(0)} billion ly away`, ua * ramp(48.5, 50.5, lt), { align: 'center', dx: 0, dy: 0.05 });
        for (const t of [1, 5, 10]) lab(uni, new THREE.Vector3(comovingMpc(zAtLookback(t)) * MPC_GLY, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), 2.4 + t * 0.1), `light left ${t} billion years ago`, ua * ramp(41 + t * 0.4, 42.5 + t * 0.4, lt) * (1 - ramp(50, 52, lt)), { dx: 0.015 });
        out.labels.push({ x: 0.05, y: 0.2, text: 'farther = earlier: bluer, younger galaxies (colour schematic)\nlight from the CMB travelled 13.8 billion years — a time, not a place', alpha: ua * ramp(44, 46, lt), size: 0.95 });
      }
      out.hud = { s };
      out.post = { exposure: 1.0, bloom: 0.06, vignette: 0.32 };
    },
    render(r, target) {
      r.setRenderTarget(target);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, false);
      for (const L of layers) {
        if (L.weight <= 0.001) continue;
        r.setRenderTarget(target);
        if (L.name === 'room' || L.name === 'earth') r.clear(false, true, false); // fresh depth for lit layers
        if (L.name === 'ground') { r.clear(false, true, false); }
        r.render(L.scene, L.cam);
      }
    },
    dispose() {
      for (const L of layers) L.scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose?.(); });
      landTex.dispose(); dayTex.dispose(); nightTex.dispose();
    },
  };
}

function lerpN(a: number, b: number, t: number) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

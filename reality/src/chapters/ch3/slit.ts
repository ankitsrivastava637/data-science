// Double slit: the precomputed 2D Schrödinger evolution shown as an amplitude field (brightness
// |ψ|², hue = phase), plus a detector plate where Born-rule samples appear one at a time.
import * as THREE from 'three';
import type { SlitResult } from '../../math/schrodinger';
import type { Detections } from '../../engine/jobs';
import { COMMON } from '../../shaders/common';

const PLANE_FRAG = /* glsl */ `
precision highp float;
precision highp sampler2DArray;
in vec2 vUv; out vec4 o;
uniform sampler2DArray tPsi; uniform float fA, fB, fMix, sA, sB, uW, uPhase, uGain;
uniform vec4 wall; // x, sep, width, thick (grid units, relative to centre), grid size in uN
uniform float uN; uniform float uScreenX;
${COMMON}
void main(){
  vec2 g = (vUv - 0.5) * uN;     // grid coords relative to centre
  vec2 a = texture(tPsi, vec3(vUv, fA)).rg * sA;
  vec2 b = texture(tPsi, vec3(vUv, fB)).rg * sB;
  float da = dot(a,a), db = dot(b,b);
  float d = mix(da, db, fMix) * uGain;
  vec2 ph2 = fMix < 0.5 ? a : b;
  float ph = atan(ph2.y, ph2.x)/6.28318530718 + 0.5;
  vec3 col = mix(vec3(1.0, 0.9, 0.78), phaseColor(ph), uPhase) * pow(d, 0.7) * 0.9;
  // faint lattice so the plane reads as a space
  vec2 gl = abs(fract(g/8.0) - 0.5);
  col += vec3(0.05, 0.055, 0.065) * smoothstep(0.47, 0.5, max(gl.x, gl.y)) * 0.6;
  // wall with two slits
  float inWall = step(abs(g.x - wall.x), wall.w*0.5 + 0.6);
  float inSlit = step(abs(abs(g.y) - wall.y*0.5), wall.z*0.5);
  vec3 stone = vec3(0.16, 0.15, 0.14) * (0.8 + 0.4*vnoise(g*0.7));
  col = mix(col, stone, inWall * (1.0 - inSlit));
  // detector line
  col += vec3(0.25, 0.23, 0.2) * exp(-pow((g.x - uScreenX)/0.8, 2.0)) * 0.5;
  // fade the absorbing border
  float edge = smoothstep(0.5, 0.42, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)));
  o = vec4(col * edge * uW, 1.0);
}`;
const PLANE_VERT = /* glsl */ `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

export class SlitView {
  group = new THREE.Group();
  plane: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  tex: THREE.DataArrayTexture;
  dots: THREE.Points;
  dotMat: THREE.ShaderMaterial;
  plate: THREE.Mesh;
  N: number;
  constructor(public sim: SlitResult, public det: Detections, public plateH = 70) {
    this.N = sim.nx;
    this.tex = new THREE.DataArrayTexture(sim.psi, sim.nx, sim.ny, sim.frames);
    this.tex.format = THREE.RGFormat;
    this.tex.type = THREE.ByteType;
    this.tex.internalFormat = 'RG8_SNORM';
    this.tex.minFilter = this.tex.magFilter = THREE.LinearFilter;
    this.tex.unpackAlignment = 1;
    this.tex.needsUpdate = true;
    this.mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: PLANE_VERT, fragmentShader: PLANE_FRAG,
      uniforms: {
        tPsi: { value: this.tex }, fA: { value: 0 }, fB: { value: 0 }, fMix: { value: 0 }, sA: { value: 1 }, sB: { value: 1 }, uW: { value: 1 }, uPhase: { value: 1 }, uGain: { value: 1 },
        wall: { value: new THREE.Vector4(sim.wall.x, sim.wall.sep, sim.wall.width, sim.wall.thick) }, uN: { value: sim.nx }, uScreenX: { value: sim.screenX },
      },
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    // plane in xz, grid x → world x, grid y → world z
    const pg = new THREE.PlaneGeometry(sim.nx, sim.ny, 1, 1);
    pg.rotateX(-Math.PI / 2);
    // PlaneGeometry uv: u along x, v along −z after rotation; flip v so grid y maps to +z
    const uv = pg.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    this.plane = new THREE.Mesh(pg, this.mat);
    // detector plate: vertical at x = screenX, spanning z (the pattern) and y (along the slits)
    const plateMat = new THREE.MeshBasicMaterial({ color: 0x0b0b0c, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.plate = new THREE.Mesh(new THREE.PlaneGeometry(sim.ny, plateH), plateMat);
    this.plate.rotation.y = -Math.PI / 2;
    this.plate.position.set(sim.screenX + 0.5, plateH / 2, 0);
    const n = det.count;
    const dp = new Float32Array(n * 3), dt = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      dp[k * 3] = sim.screenX + 0.3;
      dp[k * 3 + 1] = 1.5 + (plateH - 3) * fract(Math.sin(k * 12.9898) * 43758.5453);
      dp[k * 3 + 2] = (det.y[k] - 0.5) * sim.ny;
      dt[k] = det.t[k];
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    dg.setAttribute('aT', new THREE.BufferAttribute(dt, 1));
    this.dotMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: /* glsl */ `in float aT; uniform float uTau; uniform float uProj; uniform float uFlash; out float vA;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
          float age = uTau - aT;
          if (age < 0.0) { gl_Position = vec4(2.0,2.0,2.0,1.0); vA = 0.0; return; }
          float fl = exp(-age/uFlash);
          vA = 0.5 + 2.8*fl;
          gl_PointSize = clamp(0.5*uProj/max(1.0,-mv.z)*(1.0+1.6*fl), 1.5, 10.0); }`,
      fragmentShader: /* glsl */ `precision highp float; in float vA; uniform float uW; out vec4 o;
        void main(){ vec2 q=gl_PointCoord*2.0-1.0; float r2=dot(q,q); if(r2>1.0) discard; o = vec4(vec3(0.95,0.92,0.84)*exp(-r2*2.5)*vA*uW, 1.0); }`,
      uniforms: { uTau: { value: -1 }, uProj: { value: 500 }, uFlash: { value: 0.004 }, uW: { value: 1 } },
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.dots = new THREE.Points(dg, this.dotMat);
    this.dots.frustumCulled = false;
    this.group.add(this.plane, this.plate, this.dots);
  }
  /** simulation playback position in [0,1] */
  setSim(u: number, weight: number, phase: number) {
    const f = Math.max(0, Math.min(1, u)) * (this.sim.frames - 1);
    const a = Math.floor(f), b = Math.min(this.sim.frames - 1, a + 1);
    const m = this.mat.uniforms;
    m.fA.value = a; m.fB.value = b; m.fMix.value = f - a;
    const s0 = this.sim.scale[0];
    m.sA.value = this.sim.scale[a] / s0; m.sB.value = this.sim.scale[b] / s0;
    m.uW.value = weight; m.uPhase.value = phase;
    m.uGain.value = 1.0;
  }
  /** detections visible for normalised accumulation parameter tau ∈ [0,1] */
  setDetections(tau: number, proj: number, weight: number, flashDur: number) {
    const u = this.dotMat.uniforms;
    u.uTau.value = tau; u.uProj.value = proj; u.uW.value = weight; u.uFlash.value = flashDur;
    this.dots.visible = weight > 0.001 && tau > 0;
  }
  count(tau: number) {
    let lo = 0, hi = this.det.count;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (this.det.t[mid] <= tau) lo = mid + 1; else hi = mid; }
    return lo;
  }
  dispose() { this.tex.dispose(); this.mat.dispose(); this.plane.geometry.dispose(); this.dots.geometry.dispose(); this.dotMat.dispose(); this.plate.geometry.dispose(); (this.plate.material as THREE.Material).dispose(); }
}

function fract(x: number) { return x - Math.floor(x); }

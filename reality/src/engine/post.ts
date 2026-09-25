// HDR post chain: sub-frame accumulation → transition blend → subtle bloom → filmic tonemap →
// vignette, deterministic grain, triangular dither → overlay text → canvas.
import * as THREE from 'three';

export const FS_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export class FullscreenPass {
  static geometry = (() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    return g;
  })();
  static camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  mesh: THREE.Mesh;
  scene = new THREE.Scene();
  constructor(public material: THREE.ShaderMaterial) {
    this.mesh = new THREE.Mesh(FullscreenPass.geometry, material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
  render(r: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    r.setRenderTarget(target);
    r.render(this.scene, FullscreenPass.camera);
  }
}

export function shaderMat(frag: string, uniforms: Record<string, THREE.IUniform>, opts: Partial<THREE.ShaderMaterialParameters> = {}) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FS_VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
    ...opts,
  });
}

export function hdrTarget(w: number, h: number, samples = 0, depth = true, type: THREE.TextureDataType = THREE.HalfFloatType) {
  const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type,
    format: THREE.RGBAFormat,
    colorSpace: THREE.LinearSRGBColorSpace,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
    samples,
    generateMipmaps: false,
  });
  return rt;
}

const DOWN_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tSrc; uniform vec2 texel; uniform float karis;
vec3 s(vec2 uv){ return texture(tSrc, uv).rgb; }
float w(vec3 c){ return 1.0 / (1.0 + dot(c, vec3(0.2126,0.7152,0.0722))); }
void main(){
  vec2 t = texel;
  vec3 a=s(vUv+t*vec2(-2,2)), b=s(vUv+t*vec2(0,2)), c=s(vUv+t*vec2(2,2));
  vec3 d=s(vUv+t*vec2(-2,0)), e=s(vUv), f=s(vUv+t*vec2(2,0));
  vec3 g=s(vUv+t*vec2(-2,-2)), h=s(vUv+t*vec2(0,-2)), i=s(vUv+t*vec2(2,-2));
  vec3 j=s(vUv+t*vec2(-1,1)), k=s(vUv+t*vec2(1,1)), l=s(vUv+t*vec2(-1,-1)), m=s(vUv+t*vec2(1,-1));
  vec3 col;
  if (karis > 0.5) {
    vec3 g0=(a+b+d+e)*0.25, g1=(b+c+e+f)*0.25, g2=(d+e+g+h)*0.25, g3=(e+f+h+i)*0.25, g4=(j+k+l+m)*0.25;
    float w0=w(g0),w1=w(g1),w2=w(g2),w3=w(g3),w4=w(g4);
    col = (g0*w0*0.125+g1*w1*0.125+g2*w2*0.125+g3*w3*0.125+g4*w4*0.5)/(w0*0.125+w1*0.125+w2*0.125+w3*0.125+w4*0.5);
  } else {
    col = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
  }
  o = vec4(max(col, 0.0), 1.0);
}`;

const UP_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tSrc; uniform sampler2D tBase; uniform vec2 texel; uniform float radius;
void main(){
  vec2 t = texel * radius;
  vec3 c = texture(tSrc, vUv).rgb*4.0;
  c += (texture(tSrc, vUv+vec2(-t.x,0)).rgb + texture(tSrc, vUv+vec2(t.x,0)).rgb + texture(tSrc, vUv+vec2(0,-t.y)).rgb + texture(tSrc, vUv+vec2(0,t.y)).rgb)*2.0;
  c += texture(tSrc, vUv+vec2(-t.x,-t.y)).rgb + texture(tSrc, vUv+vec2(t.x,-t.y)).rgb + texture(tSrc, vUv+vec2(-t.x,t.y)).rgb + texture(tSrc, vUv+vec2(t.x,t.y)).rgb;
  o = vec4(c/16.0 + texture(tBase, vUv).rgb, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tScene, tBloom, tOverlay;
uniform float exposure, bloomStrength, grain, vignette, grainFrame, overlayOn, fade;
uniform vec2 res;
uniform float lift; // raises blacks very slightly to avoid crushed H.264 blocks
vec3 aces(vec3 x){ // Narkowicz ACES fit, applied in linear space
  const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}
vec3 toSRGB(vec3 c){ return mix(12.92*c, 1.055*pow(c, vec3(1.0/2.4))-0.055, step(0.0031308, c)); }
uint hash(uvec3 v){ v = v*1664525u + 1013904223u; v.x += v.y*v.z; v.y += v.z*v.x; v.z += v.x*v.y; v ^= v>>16u; v.x += v.y*v.z; v.y += v.z*v.x; v.z += v.x*v.y; return v.x ^ v.y ^ v.z; }
float h01(uvec3 v){ return float(hash(v) & 0xffffffu) / 16777216.0; }
void main(){
  vec3 hdr = texture(tScene, vUv).rgb;
  vec3 bl = texture(tBloom, vUv).rgb;
  vec3 c = mix(hdr, bl, bloomStrength) * exposure;
  vec2 q = vUv - 0.5; q.x *= res.x/res.y;
  c *= mix(1.0, smoothstep(1.25, 0.25, length(q)), vignette);
  c = aces(c);
  c = toSRGB(c);
  c = c * (1.0 - lift) + lift;
  uvec3 p = uvec3(uvec2(gl_FragCoord.xy), uint(grainFrame));
  float lum = dot(c, vec3(0.299,0.587,0.114));
  float g = (h01(p) + h01(p+uvec3(7u,113u,5u)) - 1.0);
  c += g * grain * (0.35 + 0.65*4.0*lum*(1.0-lum));
  c *= fade;
  vec4 ov = texture(tOverlay, vUv);
  c = mix(c, c * (1.0 - ov.a) + ov.rgb, overlayOn); // premultiplied overlay
  // triangular-PDF dither at 1/255 to prevent banding in gradients and under H.264
  float d = h01(p+uvec3(31u,17u,3u)) + h01(p+uvec3(3u,71u,11u)) - 1.0;
  c += d / 255.0;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const BLEND_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tA, tB; uniform float progress; uniform float mode; uniform vec2 res;
float lum(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453), b=fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5453);
  float c=fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5453), d=fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5453);
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
void main(){
  vec3 a = texture(tA, vUv).rgb, b = texture(tB, vUv).rgb;
  float k = 0.22;
  float dl = clamp((log2(lum(b)+1e-3) - log2(lum(a)+1e-3))/6.0, -1.0, 1.0);
  float nz = n2(vUv*res/90.0)*2.0-1.0;
  float x = progress*(1.0+2.0*k) - k + k*mix(dl, nz, 0.35)*mode;
  float w = smoothstep(0.0, 1.0, clamp(x, 0.0, 1.0));
  o = vec4(mix(a, b, w), 1.0);
}`;

const COPY_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tSrc; uniform float scale;
void main(){ o = vec4(texture(tSrc, vUv).rgb * scale, 1.0); }`;

export interface PostParams {
  exposure: number;
  bloom: number;       // 0..~0.12  — subtle
  grain: number;       // ~0.01..0.03
  vignette: number;    // 0..1
  fade: number;        // global fade to black multiplier (1 = none)
}

export class PostChain {
  w = 1; h = 1;
  levels: number;
  down: THREE.WebGLRenderTarget[] = [];
  up: THREE.WebGLRenderTarget[] = [];
  accum: THREE.WebGLRenderTarget;
  mixRT: THREE.WebGLRenderTarget;
  private downPass = new FullscreenPass(shaderMat(DOWN_FRAG, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, karis: { value: 0 } }));
  private upPass = new FullscreenPass(shaderMat(UP_FRAG, { tSrc: { value: null }, tBase: { value: null }, texel: { value: new THREE.Vector2() }, radius: { value: 1 } }));
  private compPass = new FullscreenPass(shaderMat(COMPOSITE_FRAG, {
    tScene: { value: null }, tBloom: { value: null }, tOverlay: { value: null },
    exposure: { value: 1 }, bloomStrength: { value: 0.04 }, grain: { value: 0.012 }, vignette: { value: 0.35 },
    grainFrame: { value: 0 }, overlayOn: { value: 1 }, fade: { value: 1 }, res: { value: new THREE.Vector2(1, 1) }, lift: { value: 0.004 },
  }));
  blendPass = new FullscreenPass(shaderMat(BLEND_FRAG, { tA: { value: null }, tB: { value: null }, progress: { value: 0 }, mode: { value: 1 }, res: { value: new THREE.Vector2() } }));
  private accPass = new FullscreenPass(shaderMat(COPY_FRAG, { tSrc: { value: null }, scale: { value: 1 } }, { blending: THREE.AdditiveBlending, transparent: true }));
  copyPass = new FullscreenPass(shaderMat(COPY_FRAG, { tSrc: { value: null }, scale: { value: 1 } }));

  constructor(levels: number) {
    this.levels = levels;
    this.accum = hdrTarget(1, 1, 0, false, THREE.FloatType);
    this.mixRT = hdrTarget(1, 1, 0, false);
  }

  setSize(w: number, h: number, levels: number) {
    if (w === this.w && h === this.h && levels === this.levels && this.down.length) return;
    this.w = w; this.h = h; this.levels = levels;
    for (const rt of [...this.down, ...this.up]) rt.dispose();
    this.down = []; this.up = [];
    let lw = w, lh = h;
    for (let i = 0; i < levels; i++) {
      lw = Math.max(1, Math.floor(lw / 2)); lh = Math.max(1, Math.floor(lh / 2));
      this.down.push(hdrTarget(lw, lh, 0, false));
      this.up.push(hdrTarget(lw, lh, 0, false));
    }
    this.accum.setSize(w, h);
    this.mixRT.setSize(w, h);
  }

  /** begin/add/end for sub-frame accumulation */
  accumulate(r: THREE.WebGLRenderer, src: THREE.Texture, weight: number, first: boolean) {
    r.setRenderTarget(this.accum);
    if (first) { r.setClearColor(0x000000, 0); r.clear(true, false, false); }
    this.accPass.material.uniforms.tSrc.value = src;
    this.accPass.material.uniforms.scale.value = weight;
    this.accPass.render(r, this.accum);
  }

  blend(r: THREE.WebGLRenderer, a: THREE.Texture, b: THREE.Texture, progress: number, noisy: boolean, out: THREE.WebGLRenderTarget) {
    const u = this.blendPass.material.uniforms;
    u.tA.value = a; u.tB.value = b; u.progress.value = progress; u.mode.value = noisy ? 1 : 0;
    u.res.value.set(out.width, out.height);
    this.blendPass.render(r, out);
  }

  finish(r: THREE.WebGLRenderer, src: THREE.Texture, overlay: THREE.Texture | null, p: PostParams, t: number, outW: number, outH: number) {
    // bloom
    let prev: THREE.Texture = src;
    let pw = this.w, ph = this.h;
    for (let i = 0; i < this.levels; i++) {
      const u = this.downPass.material.uniforms;
      u.tSrc.value = prev; u.texel.value.set(1 / pw, 1 / ph); u.karis.value = i === 0 ? 1 : 0;
      this.downPass.render(r, this.down[i]);
      prev = this.down[i].texture; pw = this.down[i].width; ph = this.down[i].height;
    }
    let upSrc: THREE.Texture = this.down[this.levels - 1].texture;
    for (let i = this.levels - 2; i >= 0; i--) {
      const u = this.upPass.material.uniforms;
      u.tSrc.value = upSrc; u.tBase.value = this.down[i].texture;
      u.texel.value.set(1 / this.down[i + 1].width, 1 / this.down[i + 1].height); u.radius.value = 1;
      this.upPass.render(r, this.up[i]);
      upSrc = this.up[i].texture;
    }
    const c = this.compPass.material.uniforms;
    c.tScene.value = src; c.tBloom.value = upSrc; c.tOverlay.value = overlay;
    c.overlayOn.value = overlay ? 1 : 0;
    c.exposure.value = p.exposure; c.bloomStrength.value = p.bloom; c.grain.value = p.grain; c.vignette.value = p.vignette;
    c.fade.value = p.fade;
    c.grainFrame.value = Math.floor(t * 24) % 65536;
    c.res.value.set(outW, outH);
    r.setViewport(0, 0, outW, outH);
    this.compPass.render(r, null);
  }
}

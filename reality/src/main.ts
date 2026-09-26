// REALITY — entry point. Boot, precompute, then either play live or expose the offline
// render API (?render=1) used by scripts/render.mjs.
import * as THREE from 'three';
import { INTER_WOFF2 } from 'virtual:fonts';
import { DURATION, CHAPTERS } from './content/chapters';
import { Clock } from './engine/clock';
import { Director } from './engine/director';
import { Overlay } from './engine/overlay';
import { PostChain, type PostParams } from './engine/post';
import { Adaptive, detectTier, makeQuality, type Quality, type Tier } from './engine/quality';
import { precompute, setWebResolution, type Shared } from './engine/shared';
import { emptyOutput, type EngineContext, type Frame } from './engine/types';
import { UI } from './engine/ui';
import { freeCam } from './engine/choreo';
import { setGlobalSeed } from './engine/prng';
import { FACTORIES } from './chapters';
import { AudioEngine } from './audio/engine';
import { Recorder } from './engine/recorder';

const params = new URLSearchParams(location.search);
const RENDER = params.get('render') === '1';
const STILL = params.get('still') === '1';
const DEBUG = params.has('debug');
const SEED = parseInt(params.get('seed') ?? '1', 10) >>> 0 || 1;
const FPS = Math.max(1, parseFloat(params.get('fps') ?? '60'));
const OUT_W = parseInt(params.get('w') ?? '1920', 10);
const OUT_H = parseInt(params.get('h') ?? '1080', 10);
const SUB = Math.max(1, Math.min(64, parseInt(params.get('sub') ?? '8', 10)));
const START_T = params.has('t') ? parseFloat(params.get('t')!) : null;
const TIER_PARAM = params.get('tier') as Tier | null;
const reducedMotion = !RENDER && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
setGlobalSeed(SEED);

declare global {
  interface Window {
    __ready: Promise<unknown>;
    __renderFrame: (i: number, capture?: boolean) => Promise<string | null>;
    __renderFrameTo: (i: number, url: string) => Promise<[number, number]>;
    __renderAt: (t: number) => void;
    __renderAudio: (fromSample: number, count: number, sampleRate: number) => string;
    __audioInfo: () => unknown;
    __info: Record<string, unknown>;
    __stillDone?: boolean;
    __hdrCheck?: () => { samples: number; nonFinite: number; maxValue: number; size: number[] };
    __live?: Record<string, unknown>;
    __errors: string[];
    __pixelsAt?: (x: number, y: number, w: number, h: number) => number[];
  }
}
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push(String((e as PromiseRejectionEvent).reason)));

let readyResolve!: (v: unknown) => void;
window.__ready = new Promise((r) => (readyResolve = r));

async function boot() {
  const stage = document.getElementById('stage')!;
  const canvas = document.createElement('canvas');
  stage.appendChild(canvas);
  const glTest = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: RENDER || STILL, powerPreference: 'high-performance' });
  const ui = RENDER || STILL ? null : new UI(handlers(), { debug: DEBUG, tierLabel: "…" });
  if (!glTest) { ui?.fallback('This piece needs WebGL2, which this browser or device does not provide. Try a current Chrome or Edge.'); throw new Error('no webgl2'); }
  if (!glTest.getExtension('EXT_color_buffer_float') && !glTest.getExtension('EXT_color_buffer_half_float')) {
    ui?.fallback('This piece needs floating-point render targets (EXT_color_buffer_float), which this GPU/browser does not expose. Try a current Chrome or Edge on a desktop GPU.');
    throw new Error('no float render targets');
  }
  const detected = detectTier(glTest);
  // render mode is Ultra unless a tier is requested explicitly (CPU-only renders use High)
  const tier: Tier = RENDER ? TIER_PARAM ?? 'ultra' : TIER_PARAM ?? detected;
  const quality: Quality = makeQuality(tier, RENDER ? 1 : window.devicePixelRatio);
  if (RENDER) quality.pixelRatio = 1;
  if (params.has('scale')) quality.renderScale = Math.max(0.25, Math.min(1, Number(params.get('scale')) || 1)); // scene resolution (overlay stays native)
  if (params.has('msaa')) quality.msaa = Math.max(0, Math.min(8, Number(params.get('msaa')) || 0)); // override (e.g. software renders)
  if (ui) (ui.gate.querySelector('option[value=auto]') as HTMLOptionElement).textContent = `Auto (${detected})`;

  const renderer = new THREE.WebGLRenderer({ canvas, context: glTest, antialias: false, alpha: false, preserveDrawingBuffer: RENDER || STILL });
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.debug.checkShaderErrors = true;

  const font = new FontFace('Inter', `url(${INTER_WOFF2})`, { weight: '100 900', style: 'normal' });
  await font.load();
  document.fonts.add(font);

  const overlay = new Overlay();
  const post = new PostChain(quality.bloomLevels);
  const clock = new Clock();

  let shared: Shared;
  setWebResolution(quality.tier === 'low' ? 32 : 64); // FFT sizes must be powers of two
  try {
    shared = await precompute(SEED, quality.particles, (d, t, l) => ui?.setProgress(d, t, l));
  } catch (e) {
    ui?.fallback('Precomputation failed: ' + String(e));
    throw e;
  }

  const ctx: EngineContext = { renderer, quality, seed: SEED, shared, reducedMotion };
  const director = new Director(ctx, FACTORIES, post);
  const audio = new AudioEngine(SEED, shared);
  let captionsOn = params.get('captions') !== '0';

  // ── sizing ──
  let W = 0, H = 0, SW = 0, SH = 0;
  async function resize() {
    let cssW: number, cssH: number;
    if (RENDER) { cssW = OUT_W; cssH = OUT_H; }
    else {
      const vw = window.innerWidth, vh = window.innerHeight;
      if (vw / vh > 16 / 9) { cssH = vh; cssW = Math.round(vh * 16 / 9); } else { cssW = vw; cssH = Math.round(vw * 9 / 16); }
    }
    const pr = quality.pixelRatio;
    const nw = Math.round(cssW * pr), nh = Math.round(cssH * pr);
    canvas.style.width = `${cssW}px`; canvas.style.height = `${cssH}px`;
    renderer.setPixelRatio(1);
    renderer.setSize(nw, nh, false);
    W = nw; H = nh;
    applyScale();
    await overlay.resize(W, H);
  }
  function applyScale() {
    SW = Math.max(2, Math.round(W * quality.renderScale));
    SH = Math.max(2, Math.round(H * quality.renderScale));
    director.setSize(SW, SH, quality.msaa);
    post.setSize(SW, SH, quality.bloomLevels);
  }
  await resize();
  if (!RENDER) window.addEventListener('resize', () => { void resize(); });

  const baseFrame = (t: number, frameDt: number): Omit<Frame, 'lt'> => ({
    t, quality, seed: SEED, width: SW, height: SH, aspect: SW / SH, reducedMotion, renderMode: RENDER, frameDt,
  });

  const defaults: PostParams = { exposure: 1, bloom: 0.045, grain: 0.012, vignette: 0.32, fade: 1 };

  /** render one output frame at t, with `sub` sub-frames over a 180° shutter of 1/fps */
  function renderFrame(t: number, sub: number, fps: number) {
    director.housekeeping(t);
    const out = emptyOutput();
    let postP: Partial<PostParams> = {};
    let texture: THREE.Texture | null = null;
    if (sub <= 1) {
      const r = director.render(baseFrame(t, 1 / fps), out);
      texture = r.texture; postP = { ...r.post, fade: r.fade };
    } else {
      const shutter = 0.5 / fps;
      const mid = Math.floor(sub / 2);
      for (let k = 0; k < sub; k++) {
        const tk = Math.max(0, Math.min(DURATION, t + ((k + 0.5) / sub - 0.5) * shutter));
        const o = k === mid ? out : emptyOutput();
        const r = director.render(baseFrame(tk, 1 / fps), o);
        if (k === mid) postP = { ...r.post };
        post.accumulate(renderer, r.texture!, r.fade / sub, k === 0);
      }
      texture = post.accum.texture;
      postP.fade = 1;
    }
    overlay.render({ t, labels: out.labels, equations: out.equations, hud: out.hud, draw: out.draw, captionsEnabled: captionsOn || RENDER });
    const p: PostParams = { ...defaults, ...postP } as PostParams;
    if (reducedMotion) p.grain *= 0.5;
    post.finish(renderer, texture!, overlay.texture, p, t, W, H);
    return out;
  }

  if (RENDER || STILL) {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const buf = new Uint8Array(W * H * 4);
    window.__renderFrame = async (i: number, capture = true) => {
      renderFrame(i / FPS, SUB, FPS);
      if (!capture) { gl.finish(); return null; }
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return await toBase64(buf);
    };
    // binary hand-off for the offline renderer: POST raw RGBA (bottom-up rows) to a local endpoint
    window.__renderFrameTo = async (i: number, url: string) => {
      const t0 = performance.now();
      renderFrame(i / FPS, SUB, FPS);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const t1 = performance.now();
      const res = await fetch(url, { method: 'POST', body: buf });
      if (!res.ok) throw new Error('frame sink refused frame ' + i + ': ' + res.status);
      return [t1 - t0, performance.now() - t1];
    };
    window.__renderAt = (t: number) => { renderFrame(t, 1, FPS); gl.finish(); };
    window.__pixelsAt = (x, y, w, h) => { const b = new Uint8Array(w * h * 4); gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); return Array.from(b); };
    window.__renderAudio = (from: number, count: number, sr: number) => audio.renderOfflineBase64(from, count, sr);
    window.__hdrCheck = () => director.hdrCheck(renderer);
    window.__audioInfo = () => audio.info();
    window.__info = { duration: DURATION, fps: FPS, w: W, h: H, sub: SUB, frames: Math.ceil(DURATION * FPS), tier: quality.tier, seed: SEED, chapters: CHAPTERS.map((c) => ({ n: c.n, key: c.key, start: c.start, end: c.end })) };
    readyResolve(window.__info);
    if (STILL) {
      const t = START_T ?? 0;
      // warm-up render (lazy chapter creation, shader compilation), then the real frame
      renderFrame(t, 1, FPS);
      renderFrame(t, params.has('sub') ? SUB : 1, FPS);
      gl.finish();
      window.__stillDone = true;
    }
    return;
  }

  // ── live mode ──
  const adaptive = new Adaptive(quality);
  const recorder = new Recorder(canvas, audio);
  let begun = false;
  if (START_T != null) clock.seek(START_T);
  clock.audio = audio;
  clock.on((ev, t) => {
    if (ev === 'seek') audio.seek(t, clock.playing);
    if (ev === 'play') audio.play(t);
    if (ev === 'pause') audio.pause();
  });
  ui!.ready();
  readyResolve({ live: true });

  function handlers() {
    return {
      begin: () => {
        if (begun) return;
        begun = true;
        ui!.hideGate();
        clock.play();
        // the context is created inside this gesture; once it is running, join the clock where it is now
        audio.start().then(() => { if (clock.playing) audio.play(clock.t); }).catch((e) => console.warn('audio unavailable', e));
      },
      togglePlay: () => { if (!begun) return; clock.toggle(); },
      replay: () => { clock.seek(0); clock.play(); },
      seek: (t: number) => clock.seek(t),
      toggleFreeCam: () => { freeCam.enabled = !freeCam.enabled; if (!freeCam.enabled) { freeCam.yaw = freeCam.pitch = freeCam.dolly = 0; } return freeCam.enabled; },
      toggleCaptions: () => (captionsOn = !captionsOn),
      toggleMute: () => audio.toggleMute(),
      toggleRecord: async () => {
        if (recorder.active) { await recorder.stop(); return false; }
        ui!.toast('Recording in real time. Weak hardware can drop frames; for a clean master use the offline renderer (npm run render).', 8000);
        await recorder.start();
        return true;
      },
      setTier: (t: 'auto' | Tier) => {
        const nq = makeQuality(t === 'auto' ? detectTier(glTest!) : t, window.devicePixelRatio);
        Object.assign(quality, nq);
        director.setSize(SW, SH, quality.msaa);
        void resize();
      },
      fullscreen: () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); },
    };
  }

  // free camera input
  let dragging = false, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', (e) => { if (!freeCam.enabled) return; dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => (dragging = false));
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    freeCam.yaw -= (e.clientX - lx) * 0.005; freeCam.pitch += (e.clientY - ly) * 0.004;
    lx = e.clientX; ly = e.clientY;
  });
  canvas.addEventListener('wheel', (e) => { if (!freeCam.enabled) return; e.preventDefault(); freeCam.dolly = Math.max(-2.5, Math.min(2.5, freeCam.dolly + e.deltaY * -0.0012)); }, { passive: false });

  let last = performance.now();
  let fpsAcc = 0, fpsN = 0, fpsShow = 0;
  // verification probes (read-only)
  const frameMs: number[] = [];
  window.__live = { frameMs, t: () => clock.t, playing: () => clock.playing, audio: () => audio.state(), audioT: () => audio.timelineTime(), tier: () => quality.tier, scale: () => quality.renderScale };
  function loop(now: number) {
    const dt = now - last; last = now;
    frameMs.push(dt); if (frameMs.length > 600) frameMs.shift();
    freeCam.blend += ((freeCam.enabled ? 1 : 0) - freeCam.blend) * Math.min(1, dt / 400);
    clock.tick(now);
    renderFrame(clock.t, 1, 60);
    ui!.update(clock.t, clock.playing);
    if (clock.playing && adaptive.push(dt)) applyScale();
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 500) { fpsShow = (1000 * fpsN) / fpsAcc; fpsAcc = 0; fpsN = 0; }
    if (DEBUG) {
      const info = renderer.info;
      ui!.debug(`tier ${quality.tier}  scale ${quality.renderScale.toFixed(2)}\nfps ${fpsShow.toFixed(1)}  frame ${dt.toFixed(1)} ms\nt ${clock.t.toFixed(2)} s\nscene ${SW}×${SH}  out ${W}×${H}\ncalls ${info.render.calls}  tris ${info.render.triangles}\naudio ${audio.state()}`);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

function toBase64(buf: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => { const s = fr.result as string; resolve(s.slice(s.indexOf(',') + 1)); };
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(new Blob([buf.slice().buffer as ArrayBuffer]));
  });
}

boot().catch((e) => { console.error(e); window.__errors.push(String(e?.stack ?? e)); });

# ARCHITECTURE.md

REALITY is one deterministic function: **frame = F(t, seed, quality, viewport)**. Everything below exists to keep that
true while the piece plays live, while it is scrubbed, and while it is rendered offline frame by frame.

```
            ┌────────────── src/main.ts ──────────────┐
            │ boot → precompute (workers) → Begin gate │
            └───────┬──────────────────────┬───────────┘
                    │                      │
   Clock (live: audio clock │ render: i/fps)   AudioEngine (worker DSP ⇄ Web Audio)
                    │  t                   ▲  cues (same timeline)
                    ▼                      │
   Director ── chapterAt(t) ── ChapterInstance.update(frame) / render(target)
      │            ▲                             │
      │   Transition blender (morph/dissolve/cut) │  shared MorphParticles, ScaleLayers
      ▼                                           ▼
   PostChain (HDR → bloom → tonemap → grain/dither) ← Overlay (2D canvas: captions, KaTeX, HUD)
      ▼
   <canvas>  ──(render mode)── readPixels → scripts/render.mjs → ffmpeg
```

## 1. Timeline and chapter system (`src/content/chapters.ts`, `src/engine/director.ts`, `src/chapters/*`)

* Global time `t ∈ [0, 854] s`: title card 0–4 s, chapters 1–12 at the spec's times shifted by +4 s, end card 850–854 s.
* A chapter is a `ChapterMeta` entry with `start`, `end`, `validScaleRange` (log10 metres), `representation` (ordered list of
  representations it passes through, e.g. `surface → mosaic → photon-counts`), `epistemicLevel` (checked by a test to
  equal the highest level among the chapter's ledger claims), `transitionIn` (`dissolve | cut`) and a factory registered in `src/chapters/index.ts`.
* `ChapterInstance.update(frame)` must be a pure function of `frame.t` (plus seed and quality). No accumulated
  state, no `Math.random`, no wall clock. Anything history-dependent (Schrödinger evolution, gas diffusion, evolution
  tree, cosmic-web growth) is either closed-form in `t` or precomputed once at boot and then *sampled* at `t`.
* Instances are created lazily when first needed and disposed when far away, so memory stays bounded. Chapter 12
  rebuilds everything it re-uses from shared data, so seeking straight into it renders the same frames.
* Captions (the annotation track) live in `src/content/script.ts`. Each caption references a ledger claim id;
  equations reference ledger equation ids. `tests/content.test.ts` enforces this, plus caption hold time (≥ 3 s),
  reading rate (≤ 23 characters per second), no overlaps, and that each caption sits in its claim's chapter.
* Timing constants that both a picture and a sound depend on (photon exposure, slit detections, entangled pairs,
  codons, twin and static clocks) live in `src/content/cues.ts`.

## 2. Scale and floating origin (per chapter; HUD in `src/engine/overlay.ts`)

* One scale coordinate `s = log10(field-of-view width in metres)` from ≈ −15.5 (proton) to ≈ +27 (observable universe).
  Chapters publish `s(t)` from choreography tracks; the HUD scale bar and readout are derived from the same `s` that
  positions the geometry, so they cannot disagree.
* **Scale layers** (e.g. Chapter 10's `mkLayer`): geometry authored in local units with native scale `sL` (metres per unit, log10). For camera scale
  `s`, the field width in local units is `10^(s − sL)` and the camera distance follows from the FOV. Each layer is
  authored so its zoom focus is the **local origin** (floating origin): vertices near what the camera looks at have
  small coordinates and full float32 relative precision; matrices are composed in float64 on the CPU.
  A layer is only drawn inside its `s` window and cross-fades at the edges. Where a layer hands over to another
  (room → land → globe), both sample the same data (the land close-up reads the globe's own texel and shares its
  procedural detail function), so the cross-fade has nothing to disagree about.
* Nested zooms (cell → nucleus → chromatin → DNA → base pair → atom) are chains of layers whose child focus sits at
  the parent's focus. Monotonicity of `s(t)` inside each zoom segment is asserted by `tests/tracks.test.ts`.

## 3. Transition system (`src/engine/director.ts`, `src/engine/post.ts`)

* Within a chapter, representation changes are *morphs* (shared particle system targets, shader parameters such as
  density → isosurface → phase colouring).
* Between chapters the Director renders both chapters into two HDR targets and blends them (`dissolve`: a
  luminance-weighted noise dissolve centred on the chapter boundary; `cut`: none). The first chapter fades up from the
  title card; the last fades to black over 3 s, ending exactly where the end card begins.
* At most three hard cuts ("epistemic shocks") are allowed: into Spacetime, at the singularity inside Gravity, and
  into Frontier. The timeline declares them and a test counts them.

## 4. Camera choreography API (`src/engine/choreo.ts`)

* `track([[t, value, ease], …])` returns a pure function of `t` (numbers, vec3, quaternions); easing functions are
  standard (sine, cubic, quint, expo, smoothstep, linear, hold).
* Cameras are built from tracks (position/target/up/fov, or orbit radius/azimuth/elevation around a target).
* **Free camera**: every chapter camera calls `freeOrbit(cam, target)` right after it is aimed; user yaw/pitch/dolly
  offsets orbit it around the choreographed target. The timeline keeps running; toggling free camera off eases back.
  It is a strict no-op when off, so render mode and stills are unaffected. Flat diagrams (2D overlays) do not move.

## 5. Shader layout (`src/shaders/*.ts`, plus chapter-local shaders)

GLSL lives in TypeScript template strings so it bundles into the single file without loaders.
* `common`: hash/noise (integer-hash, deterministic), colour helpers (sRGB/linear, spectral → XYZ → sRGB),
  tonemapping, dithering.
* `hydrogen`: associated Laguerre / Legendre evaluation of ψ_nlm, used by the orbital ray-marcher.
* Chapter-local: the Schwarzschild ray tracer (RK4 of `u'' + u = 1.5 r_s u²` per pixel, `ch8/blackhole.ts`), the eye
  (`ch1/eye.ts`), the proton volume (`ch3/proton.ts`, gluon noise baked into a tileable 3D texture at boot), the
  density volume (`ch2/nano.ts`, half resolution), the globe (`ch10`), the ghost stipple (`ch11`).
* `src/engine/particles.ts`: morph-target vertex shader (two float textures + mix), soft point sprites.
* `src/engine/post.ts`: dual-filter bloom, composite (exposure, ACES-fitted tonemap, vignette, grain, triangular
  dither, overlay), transition blend, sub-frame accumulation.

## 6. Audio (`src/audio/*`)

* `score.ts` builds an event list from the same timeline data the pictures use: `detection` (photon absorptions in
  Chapter 1, one tick per Born-rule detection in Chapter 3, entangled pairs), `equation:reveal` (a bell at each
  equation cue), `transition:start` (a swell into every dissolve; silence and an impact at hard cuts),
  `horizon:crossed` (silence, then a falling tone, at the singularity cut), plus per-chapter motifs: hydrogen's Balmer
  ratios, the cone triad, water's normal modes transposed down 37 octaves, one note per codon, twin and static clocks
  ticking at their proper-time rates, zeta zeros as a chord, a tone redshifting as look-back grows.
* Every voice is closed-form in time (phase = 2π f τ). The two stateful stages — a 4-line FDN reverb and a
  look-ahead peak limiter — are re-run over a fixed 3 s warm-up before every 4 s block, so any block renders
  independently (tests: overlapping renders agree to −79 dBFS). A master gain puts the full mix at ≈ −14 LUFS
  (BS.1770 meter in `loudness.ts`; `npm run audio:check` renders the whole film in Node and reports it).
* **Live**: a Web Worker renders blocks ahead; the engine schedules `AudioBufferSourceNode`s back to back on the
  `AudioContext` clock, and the picture clock is *derived from the audio clock*. After a seek, the picture waits
  for the first block so both start together. Mute is a gain node; `MediaRecorder` taps a stream destination.
* **Offline**: `window.__renderAudio(from, count, rate)` renders the same blocks on the main thread and returns
  24-bit PCM; `scripts/render.mjs` writes a 48 kHz WAV. `verify.mjs` checks that the page's samples equal a Node
  render of the same range.

## 7. Performance tiers (`src/engine/quality.ts`)

| tier | pixel ratio | render scale | particles | raymarch steps | MSAA | bloom | sub-frames |
|---|---|---|---|---|---|---|---|
| Low | 1 | 0.75 (dynamic 0.5–1) | ×0.35 | ×0.5 | 0 | 3 levels | 1 |
| High | 1 | 1.0 (dynamic 0.7–1) | ×1 | ×1 | 4 | 5 levels | 1 |
| Ultra | ≤ 2 | 1.0 | ×2 | ×1.5 | 4 | 6 levels | N fixed sub-frames in render mode |

Auto-detection uses the WebGL renderer string (float render targets are required); a rolling frame-time monitor then
moves the render scale (and, if needed, the tier) up or down. Render mode defaults to Ultra, can be pinned to another
tier (`&tier=`, `&scale=`, `&msaa=` for CPU-only machines) and disables all adaptation. `?debug` shows tier, fps, frame time, `t`, chapter and `s`.

## 8. Render mode and video export

`?render=1&fps=60&w=3840&h=2160&sub=8`: the canvas is sized exactly `w×h` at pixel ratio 1, UI is hidden, adaptive
quality is off, and the page exposes

* `__ready` — resolves when fonts, KaTeX rasters and all precomputation are complete;
* `__renderFrame(i)` — sets `t = i/fps`, renders `sub` sub-frames spread over a 180° shutter
  (`t + (k + 0.5)/sub · 0.5/fps − 0.25/fps`), accumulates them in a float target, post-processes once, reads pixels
  back synchronously and returns them (base64 raw RGBA; measured faster than an HTTP upload of the same bytes);
* `__renderAudio(from, count, sampleRate)` — PCM chunks of the deterministic score;
* `__hdrCheck()` — NaN/Inf scan of the HDR scene buffer (used by `verify.mjs`).

`scripts/render.mjs` drives headless Chromium via Playwright, pipes raw frames into ffmpeg in resumable 20 s
segments (RGB→BT.709 limited-range YUV, vertical flip), concatenates them, renders the WAV, and muxes H.264 High /
yuv420p / BT.709 / faststart / CRF 16 + AAC 320k, plus the two-pass 1080p30 share encode.

## 9. Text and overlay (`src/engine/overlay.ts`, `src/engine/katexRaster.ts`)

All on-screen text is drawn into a 2D canvas that the composite pass samples, so the WebGL canvas contains *everything*
(needed for `MediaRecorder` capture and frame readback). KaTeX HTML is rasterised once at boot through an SVG
`foreignObject` with the KaTeX woff2 fonts embedded as data URIs, then cropped. Captions stay inside the 90 %
title-safe area (labels slide inward if they would overflow), hold ≥ 3 s and read at ≤ 23 characters per second;
tests enforce both.

## 10. Determinism rules

* PRNG: `sfc32` seeded from `?seed`; per-element randomness uses integer hashing of (index, seed).
* No `Math.random`, no `Date.now` / `performance.now` in anything that affects pixels or samples (lint test greps).
* Workers run pure numeric code with fixed iteration counts.
* Checks: same `t` and seed ⇒ identical pixels across two page loads (still mode) and twice within, and across,
  render-mode sessions (`verify.mjs`); the audio blocks are pure functions of the sample index (`tests/audio.test.ts`).

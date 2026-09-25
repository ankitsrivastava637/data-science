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

## 1. Timeline and chapter system (`src/engine/timeline.ts`, `src/chapters/*`)

* Global time `t ∈ [0, 854] s`: title card 0–4 s, chapters 1–12 at the spec's times shifted by +4 s, end card 850–854 s.
* A chapter is a `ChapterDef` with `start`, `end`, `validScaleRange` (log10 metres), `representation` (ordered list of
  representations it passes through, e.g. `surface → mosaic → photon-counts`), `epistemicLevel` (checked by a test to
  equal the highest level among the chapter's ledger claims), `transitionIn` (`morph | dissolve | cut`) and a factory.
* `ChapterInstance.update(frame)` must be a pure function of `frame.t` (plus seed and quality). No accumulated
  state, no `Math.random`, no wall clock. Anything history-dependent (Schrödinger evolution, gas diffusion, evolution
  tree, cosmic-web growth) is either closed-form in `t` or precomputed once at boot and then *sampled* at `t`.
* Instances are created lazily a few seconds before they are needed and disposed when far away, so memory stays
  bounded; the Director keeps at most two alive (outgoing and incoming).
* Captions (the annotation track) live in `src/content/script.ts`. Each caption references a ledger claim id;
  equations reference ledger equation ids. `tests/ledger.test.ts` enforces this.

## 2. Scale / LOD manager (`src/engine/scale.ts`)

* One scale coordinate `s = log10(field-of-view width in metres)` from ≈ −15.5 (proton) to ≈ +27 (observable universe).
  Chapters publish `s(t)` from choreography tracks; the HUD scale bar and readout are derived from the same `s` that
  positions the geometry, so they cannot disagree.
* **ScaleLayer**: geometry authored in local units with native scale `sL` (metres per unit, log10). For camera scale
  `s`, the field width in local units is `10^(s − sL)` and the camera distance follows from the FOV. Each layer is
  authored so its zoom focus is the **local origin** (floating origin): vertices near what the camera looks at have
  small coordinates and full float32 relative precision; matrices are composed in float64 on the CPU.
  A layer is only drawn inside its `[sMin, sMax]` window (≤ ~4 decades) and cross-fades at the edges.
* Nested zooms (cell → nucleus → chromatin → DNA → base pair → atom) are chains of layers whose child focus sits at
  the parent's focus. Monotonicity of `s(t)` inside each zoom segment is asserted by a test.

## 3. Transition system (`src/engine/director.ts`, `src/engine/post.ts`)

* Within a chapter, representation changes are *morphs* (shared particle system targets, shader parameters such as
  density → isosurface → phase colouring).
* Between chapters the Director renders both chapters into two HDR targets and blends with a transition shader
  (`dissolve`: luminance-weighted noise dissolve; `morph`: the shared particles carry over; `cut`: none).
* At most three hard cuts ("epistemic shocks") are allowed; the timeline declares them and a test counts them.

## 4. Camera choreography API (`src/engine/choreo.ts`)

* `track([[t, value, ease], …])` returns a pure function of `t` (numbers, vec3, quaternions); easing functions are
  standard (sine, cubic, quint, expo, smoothstep, linear, hold).
* `CameraRig` = tracks for position/target/up/fov (or orbit radius/azimuth/elevation around a target). Rigs are
  registered by name so Chapter 12 can re-sample earlier camera paths.
* **Free camera**: user yaw/pitch/dolly offsets are applied *after* the chapter's rig evaluates, around the rig's
  target. The timeline keeps running; toggling free camera off eases back to the rig.

## 5. Shader-module layout (`src/shaders/*.glsl.ts`)

GLSL lives in TypeScript template strings so it bundles into the single file without loaders.
* `common`: hash/noise (integer-hash, deterministic), colour helpers (sRGB/linear, spectral → XYZ → sRGB),
  tonemapping, dithering.
* `hydrogen`: associated Laguerre / Legendre evaluation of ψ_nlm, used by the orbital raymarcher.
* `schwarzschild`: RK4 integration of `u'' + u = 1.5 r_s u²` per pixel, disk and sky shading.
* `particles`: morph-target vertex shader (two float textures + mix), soft point sprites.
* `post`: bloom down/upsample, composite (exposure, ACES-fitted tonemap, vignette, grain, triangular dither),
  transition blend, sub-frame accumulation.

## 6. Audio-cue system (`src/audio/*`)

* `cues.ts` derives named cues from the same timeline data the visuals use (`detection` times come from the
  double-slit sample list, `equation:reveal` from the caption script, `transition:start` from chapter boundaries,
  `horizon:crossed` from the Chapter 8 infall track…).
* `score.ts` is a deterministic DSP program: `render(startSample, n, sampleRate)` produces stereo floats as a pure
  function of the absolute sample index, the cue list and a seed (seeded noise, phase computed from absolute time,
  filters/reverb warmed up with a fixed pre-roll). A limiter and a fixed master gain (tuned so the full mix measures
  ≈ −14 LUFS) sit at the end.
* **Live**: a Web Worker renders ahead in 0.5 s blocks; the main thread schedules `AudioBufferSourceNode`s exactly
  back-to-back on the `AudioContext` clock, and the visual clock is *derived from the audio clock*, so A/V sync is
  sample-accurate. Seek/pause flush and reschedule from `t`.
* **Offline**: `window.__renderAudio` runs the same code synchronously and returns PCM; `scripts/render.mjs` writes a
  48 kHz / 24-bit WAV. Same code, same seed ⇒ identical waveform to continuous live playback at 48 kHz.

## 7. Performance tiers (`src/engine/quality.ts`)

| tier | pixel ratio | render scale | particles | raymarch steps | MSAA | bloom | sub-frames |
|---|---|---|---|---|---|---|---|
| Low | 1 | 0.75 (dynamic 0.5–1) | ×0.35 | ×0.5 | 0 | 3 levels | 1 |
| High | 1 | 1.0 (dynamic 0.7–1) | ×1 | ×1 | 4 | 5 levels | 1 |
| Ultra | ≤ 2 | 1.0 | ×2 | ×1.5 | 4 | 6 levels | progressive accumulation when paused; N fixed sub-frames in render mode |

Auto-detection uses the WebGL renderer string, float render-target support and a short warm-up benchmark; a rolling
frame-time monitor then moves the render scale (and, if needed, the tier) up or down. Render mode pins Ultra and
disables all adaptation. `?debug` shows tier, fps, frame time, `t`, chapter and `s`.

## 8. Render mode and video export

`?render=1&fps=60&w=3840&h=2160&sub=8`: the canvas is sized exactly `w×h` at pixel ratio 1, UI is hidden, adaptive
quality is off, and the page exposes

* `__ready` — resolves when fonts, KaTeX rasters and all precomputation are complete;
* `__renderFrame(i)` — sets `t = i/fps`, renders `sub` sub-frames spread over a 180° shutter
  (`t + (k + 0.5)/sub · 0.5/fps − 0.25/fps`), accumulates them in a float target, post-processes once, reads pixels
  back synchronously and returns them (base64 raw RGBA);
* `__renderAudio(from, to, sampleRate)` — PCM chunks of the deterministic score.

`scripts/render.mjs` drives headless Chromium via Playwright, pipes raw frames into ffmpeg, renders the WAV, and
muxes H.264 High / yuv420p / BT.709 / faststart / CRF 16 + AAC 320k, plus the 1080p30 share encode.

## 9. Text and overlay (`src/engine/overlay.ts`, `src/engine/katexRaster.ts`)

All on-screen text is drawn into a 2D canvas that the composite pass samples, so the WebGL canvas contains *everything*
(needed for `MediaRecorder` capture and frame readback). KaTeX HTML is rasterised once at boot through an SVG
`foreignObject` with the KaTeX woff2 fonts embedded as data URIs, then cropped. Captions stay inside the 90 %
title-safe area and hold ≥ 3 s (≥ 6 s for long ones); a test enforces the hold times.

## 10. Determinism rules

* PRNG: `sfc32` seeded from `?seed`; per-element randomness uses integer hashing of (index, seed).
* No `Math.random`, no `Date.now` / `performance.now` in anything that affects pixels or samples (lint test greps).
* Workers run pure numeric code with fixed iteration counts.
* Test: same `t` and seed ⇒ identical pixels twice, in interactive and render modes.

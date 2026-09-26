# REALITY — From the Human Eye to the Structure of the Universe

A continuous, real-time scientific visualization of about 14 minutes, in twelve chapters: the observer,
inner scale, the quantum, the sensory filter, frequency and information, life as information, spacetime,
gravity, mathematics, the cosmos, the frontier, and a synthesis that ends in the mosaic of cones you are
looking with. Every on-screen claim carries an epistemic tag (**ESTABLISHED**, **INTERPRETATION**,
**SPECULATIVE**) and a ledger entry in [`SCIENCE.md`](SCIENCE.md). How the engine works is in
[`ARCHITECTURE.md`](ARCHITECTURE.md).

## Run it

```bash
npm install
npm run dev          # http://localhost:5173  (development)
npm run build        # dist/ (static site) and dist/reality.html (single file, no network)
npm test             # 37 tests (numerics, ledger and caption rules, determinism, audio)
npm run verify       # browser checks → verification/report.md (needs a build)
```

`dist/reality.html` is self-contained (≈ 5.5 MB): scripts, workers, fonts, KaTeX, Earth imagery and
coastlines are inlined. It opens from `file://` with the network off and makes no requests.
It needs WebGL2 with float render targets; without them it shows a message instead.

URL parameters: `?t=` start time in seconds · `?seed=` (default 1) · `?tier=low|high|ultra` ·
`?debug` (tier, fps, frame time, t, scene size, draw calls, audio state) · `?captions=0`.

## Controls

Sound starts only after **Begin**. The control bar hides itself after a few seconds; move the mouse or
press a key to bring it back.

| key | action |
|---|---|
| Space / K | play · pause (Begin on the start screen) |
| ← / → | seek −10 s / +10 s (the scrubber has chapter ticks) |
| Home | replay from the start |
| C | free camera: drag to orbit, wheel to dolly; the timeline keeps running; C again eases back |
| A | annotations (captions, labels) on/off |
| M | mute |
| F | fullscreen |

A record button captures the canvas and the soundtrack with `MediaRecorder` (a fallback: the offline
renderer below is deterministic and much better). Captions are also mirrored to a screen-reader live
region. With `prefers-reduced-motion`, grain is halved and brief flashes (photon absorptions,
particle detections) are lengthened and softened; the proton's gluon field slows down.

## Quality tiers

| tier | render scale | particles | ray-march steps | MSAA | bloom levels |
|---|---|---|---|---|---|
| Low | 0.75 (adaptive 0.5–1) | ×0.35 | ×0.5 | 0 | 3 |
| High | 1.0 (adaptive 0.7–1) | ×1 | ×1 | 4 | 5 |
| Ultra | 1.0 | ×2 | ×1.5 | 4 | 6 |

The tier is guessed from the GPU name (software rasterisers and most integrated GPUs start on Low), and
a rolling frame-time monitor then lowers or raises the render scale, and drops a tier if that is not
enough. Choose a tier on the start screen or with `?tier=`.

## Render the video

The renderer drives the page's deterministic render mode in headless Chromium and pipes frames to ffmpeg.
Requirements: Node 20+, ffmpeg with libx264 and AAC on `PATH`, a Chromium/Chrome (found automatically, or
set `CHROMIUM_PATH`). Always build first — the renderer renders `dist/reality.html`, the file that ships.

```bash
npm run build
npm run render            # 4K: 3840×2160, 60 fps, Ultra, 8 sub-frames (180° shutter) → reality.mp4 + reality_share.mp4
npm run render:share      # re-encode reality.mp4 → reality_share.mp4 (1080p30, ~34 MB)
npm run render:test       # three 10 s clips with automatic checks (frames, duration, A/V sync, colour tags, <video>)
```

The exact 4K command (what `npm run render` runs):

```bash
node scripts/render.mjs --w 3840 --h 2160 --fps 60 --sub 8 --tier ultra
```

Options: `--chapter N`, `--start S --end S` (seconds), `--seed`, `--crf` (default 16), `--preset`,
`--frames-only` (no audio/mux), `--software` (force SwiftShader), `--work DIR`, `--share-mb`, `--hevc` (an
extra H.265 share file). Output is written in 20 s segments under `render-work/`; an interrupted render
**resumes** where it stopped when you run the same command again. Progress and ETA are printed.

Output: H.264 High, yuv420p, BT.709 primaries/transfer/matrix, limited range, `+faststart`, CRF 16, and
AAC 320 kb/s from a 48 kHz / 24-bit WAV that the page renders offline with the same code as live
playback. The share file is a two-pass 1080p30 H.264 encode sized to about 34 MB.

**Time and disk.** Throughput depends almost entirely on the GPU. Measured here, with no GPU (SwiftShader
on 4 CPU cores), at 1920×1080, High tier, 1 sub-frame: about 0.5 s per frame for most chapters and 2.5–4 s
for the ray-marched and ray-traced scenes (the eye, the orbitals, the proton, the black hole) — roughly
an estimated 10–11 hours for the whole film in one process; measured 5.5 hours with two processes
sharing the work directory (run the same command twice; segments are claimed with lock files). 4K with 8 sub-frames is 32× the pixel work per frame, so it needs a real
GPU. Disk: the 1080p CRF 16 file is a few hundred MB; allow ~5 GB for a 4K render's segments.

What was delivered from this environment (no GPU): `reality.mp4` at 1920×1080, 30 fps, High tier, one sample per
frame, rendered in 5 h 27 min on 4 CPU cores with two cooperating render processes, and `reality_share.mp4`
(34.5 MB). Details and checks: [`REPORT.md`](REPORT.md) and [`verification/final-render.md`](verification/final-render.md).

## Project layout

```
src/main.ts               boot, precompute, live loop, render/still hooks
src/engine/               clock, director (transitions), post chain, overlay, particles, UI, quality, PRNG
src/chapters/chN/         one module per chapter (pure functions of time)
src/content/              ledger (claims, sources, equations), captions, chapter metadata, shared cue timings
src/math/                 FFT, Schrödinger, hydrogen, geodesics, number theory, cosmology, Zel'dovich, DNA…
src/audio/                deterministic score, engine, loudness meter
scripts/                  render.mjs, verify.mjs, gen-science.ts (SCIENCE.md), audio-check.ts
tests/                    vitest suites
```

## Dependencies, and why

| package | why |
|---|---|
| `three` | WebGL2 scene graph, render targets, materials; everything else is custom shaders |
| `katex` | typesetting the equations (rasterised once at boot; fonts inlined) |
| `inter-ui` | the single typeface (Inter, variable woff2, inlined) |
| `world-atlas`, `topojson-client` | Natural Earth 1:50m land polygons (public domain) for the globe's water mask |
| `vite`, `vite-plugin-singlefile`, `typescript` | build, and the single-file `dist/reality.html` |
| `playwright-core` | drives Chromium for `verify.mjs` and `render.mjs` (uses an installed browser; downloads nothing) |
| `vitest` | tests |

Earth imagery (`src/assets/earth/`) is vendored from the `three-globe` package's example assets; see the
provenance note there. ffmpeg is a system tool, not an npm dependency.

## Known limitations

* The science ledger was compiled with web search excerpts only; primary sources could not be opened
  from the build environment. `SCIENCE.md` says so at the top and marks each source's access level.
* Several depictions are illustrative by design and labelled as such: cell interior, chromatin, the
  proton's gluon field, the landscape and quantum-gravity images, the galaxy model, the land close-up
  and clouds, the CMB pattern. The ledger lists each simplification.
* Rendering is CPU-bound without a GPU (see above). Live playback on software rendering runs at a few
  frames per second on the Low tier.
* The audio is procedural and restrained; it was checked numerically (loudness, peaks, determinism,
  seam continuity), not by ear, because the build environment has no audio output.
* `MediaRecorder` capture depends on the browser's codecs and real-time performance; use the offline
  renderer for anything that matters.

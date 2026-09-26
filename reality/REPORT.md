# REALITY — build report

This report covers what was built, what was verified and how, and where the result falls short of the
spec. Numbers come from `npm test`, `scripts/verify.mjs` (→ `verification/report.md`) and the render
logs.

## What exists

* **All twelve chapters, 854 s in total**: a 4 s title card, then chapters 1–12 at the spec's times shifted
  by 4 s, then a 4 s end card. Each chapter is a pure function of time. Three hard cuts: into Spacetime,
  at the singularity inside Gravity, and into Frontier. Every other chapter boundary is a dissolve.
* **Epistemic tagging.** Every caption and equation cue references a ledger entry: 96 captions, 35 equation
  cues, 98 claims, 34 equations and 46 sources, all in [`SCIENCE.md`](SCIENCE.md), which is generated from
  `src/content/ledger.ts`. Chapter badges equal the highest level among the chapter's claims (tested).
  Spacetime is INTERPRETATION (the block universe). Gravity is SPECULATIVE (the information problem).
  Frontier is SPECULATIVE throughout.
* **Engine**:
  * deterministic timeline with `?t=` and `?seed=`; seeded PRNG only (tested: no `Math.random` / `Date.now`)
  * `s = log10(field width)` scale readout and scale bar
  * per-layer floating origins in the long zooms
  * HDR pipeline (bloom, ACES fit, grain, dither) with the overlay composited into the canvas
  * worker precomputation
  * Low/High/Ultra tiers with detection and adaptive render scale, plus `?debug`
  * controls: play/pause, replay, seek with chapter ticks, free camera, annotations, mute, record, fullscreen
  * keyboard shortcuts, a screen-reader caption mirror, and `prefers-reduced-motion` handling
* **Audio**: a deterministic procedural score, with cues taken from the same timing data as the pictures:
  * photon absorptions and Born-rule detections
  * entangled pairs, codons
  * twin and static clocks
  * the horizon cut, equation reveals, transitions

  It is limited, reverberated, and calibrated to −14.02 LUFS integrated (sample peak −1.65 dBFS) with a −1 dBFS ceiling. It runs
  from a worker in live mode (driving the picture clock) and from the main thread for the offline WAV.
* **Render mode and renderer**: `?render=1` with `__renderFrame`, fixed sub-frames over a 180° shutter, and
  offline audio. `scripts/render.mjs` produces resumable segments with a progress/ETA readout, then the
  H.264/AAC mux, the share encode, and test clips with automatic checks.
* **Deliverables**:
  * `dist/` (static site) and `dist/reality.html` (single file, 5.5 MB)
  * `reality_share.mp4` (committed)
  * `reality.mp4`: in the working directory, not committed, because it exceeds GitHub's 100 MB limit
  * `verification/`

## What was verified

* `npm test`: 37 tests pass, covering:
  * FFT round trips and Parseval
  * split-step Schrödinger norm conservation
  * the Schwarzschild first integral, perihelion precession and weak-field light bending
  * the first 10 zeta zeros to 10⁻⁶, and the explicit formula against ψ(x)
  * exact p(100) and p(200), and Hardy–Ramanujan
  * π convergents, Mādhava's series, and Ramanujan's series (8 digits per term)
  * hydrogen normalisation and levels; the genetic code (64/20/3)
  * ΛCDM: age 13.79 Gyr, particle horizon 46.1 Gly, Hubble radius 14.5 Gly
  * B-DNA bond and H-bond lengths; the metamer; the Fermat quintic identity; noise tiling
  * ledger integrity, chapter badges, caption hold (≥ 3 s) and reading rate (≤ 23 characters/s), no
    overlaps, ≤ 3 hard cuts, transition weights
  * monotonic zoom tracks
  * score determinism, block independence, ceiling, silence at the ends, and loudness

  A full-film loudness test is opt-in (`FULL_AUDIO=1`); `npm run audio:check` measured −14.02 LUFS integrated; per chapter −12.6 to −17.0 LUFS, Frontier quietest by design.
* `scripts/verify.mjs`, run against the built file (`verification/report.md`, with 27 screenshots and a
  contact sheet):
  * Every chapter start and transition midpoint, the singularity cut, and the title and end cards render
    with no page errors, no WebGL/shader messages, and no NaN/Inf in the HDR buffer.
  * Identical pixels across two page loads, and twice within and across render-mode sessions.
  * `file://` with networking disabled: 4 requests, all local, no errors.
  * Free camera changes the view.
  * Live audio clock: running; the picture follows it through seeks.
  * Mute works, and real-time recording produces a file.
  * The page's audio samples match a Node render of the same range within 1 LSB (24-bit).
* Test clips (`verification/clips/`, three 10 s encodes):
  * PASS: frame count, duration, A/V start and length within one frame, BT.709 tags, H.264 High yuv420p,
    AAC 48 kHz, strict full decode.
  * Stills were extracted from the MP4s.
  * **Not verified:** in-browser playback of the H.264 files. The only browser available (open-source
    Chromium) has no H.264/AAC decoder. The same `<video>` harness loads and plays an AV1/Opus transcode
    of each clip.
* The final `reality.mp4` passes the same file-level checks (see the numbers below).

## Deviations from the spec, and limitations

* **No 4K render.** There is no GPU here; SwiftShader on 4 CPU cores was the only renderer. The delivered
  `reality.mp4` is **1920×1080, 30 fps, High tier, one sample per frame (no motion blur)**, not
  3840×2160 / 60 fps / Ultra / 8 sub-frames. The exact 4K command is in the README
  (`node scripts/render.mjs --w 3840 --h 2160 --fps 60 --sub 8 --tier ultra`); the pipeline is the same.
  Render time here: see below.
* **Sources.** Web pages could not be fetched from the build environment; only search excerpts were
  available. `SCIENCE.md` says this at the top and marks every source's access level. Earth imagery
  provenance (NASA-style composites shipped with the `three-globe` package) is stated as unverified.
* **Illustrative depictions** are labelled on screen and in the ledger: cell interior, chromatin, the proton's
  gluon field, the land close-up and clouds, the galaxy model, the CMB pattern, and everything in Frontier.
* **Audio was not listened to** (no audio device). It was checked numerically: loudness, peaks, block
  seams, silence at the ends, and page/Node agreement.
* **Performance on this machine.** Live playback on Low tier runs at about 4–5 fps (median ~200 ms/frame)
  in SwiftShader. That was measured while two offline renders were running, so it says nothing about GPU
  performance, which could not be tested.
* **Cuts.** Two of the three hard cuts (into Frontier, and at the singularity) land on about 0.25 s of
  black before the new image fades in.
* **Ultra** has no progressive accumulation while paused (the architecture draft mentioned it; it was not
  built, and the docs were corrected).
* **Chapter 12** uses its own camera path; it does not re-sample earlier chapters' rigs. It rebuilds its
  particle targets from shared data so that seeking is deterministic.
* **Block independence** is −79 dBFS rather than exact, because the reverb tail extends beyond the 3 s
  warm-up.
* **Bugs found and fixed during verification:**
  * The single file could not start its workers from `file://` (module workers from blob URLs); fixed with
    classic workers.
  * Low tier could not boot (a non-power-of-two FFT); fixed.
  * After Begin, the soundtrack never started; fixed.

## Final render

RENDER_NUMBERS

# Final render

Rendered by `scripts/render.mjs` from `dist/reality.html` (frames: the build frozen at render start; soundtrack: the current build), 2026-09-26.

```
command (frames, two cooperating processes):
  node scripts/render.mjs --w 1920 --h 1080 --fps 30 --sub 1 --tier high --software --dist render-work/frozen --work render-work/r1080 --frames-only
command (assembly: concat, 48 kHz/24-bit soundtrack, mux, checks, share encode):
  node scripts/render.mjs --w 1920 --h 1080 --fps 30 --sub 1 --tier high --software --dist dist --work render-work/r1080

renderer: SwiftShader (no GPU), 4 CPU cores
frame render wall time: 5 h 27 min for 25,620 frames (two processes; ~0.77 s per frame overall)

reality.mp4 (1052 MB):
  PASS  frames: 25620  (expected 25620)
  PASS  duration: 854  (expected 854)
  PASS  A/V start offset (s): 0  (expected ±0.0333)
  PASS  A/V duration diff (s): 0  (expected ±0.0333)
  PASS  colour tags: bt709/bt709/bt709/tv  (expected bt709/bt709/bt709/tv)
  PASS  codec / profile / pix_fmt: h264/High/yuv420p  (expected h264/High/yuv420p)
  PASS  audio: aac 48000 Hz 2 ch 303 kb/s  (expected aac 48000 Hz 2 ch)
  PASS  full decode (ffmpeg -xerror): clean  (expected clean)

soundtrack (ffmpeg ebur128 on the AAC in reality.mp4): integrated -14.0 LUFS, true peak -1.3 dBTP, LRA 4.2 LU

reality_share.mp4: 34.5 MB, H.264 High 1920x1080 30 fps yuv420p BT.709, two-pass 230 kb/s video + AAC 96 kb/s, 25620 frames, full decode clean
```

Stills extracted from reality.mp4: `final-stills/`, contact sheet `final-contact-sheet.jpg`; from the share file: `share-stills/`.

The frames were rendered from the build frozen when the render started; later commits changed only live-mode
behaviour (audio start, free camera wiring, worker format for file://, Low tier). Eight frames across the film
(300, 4800, 5700, 13620, 18000, 22500, 24300, 25200) rendered at High tier by the frozen build and by the final
`dist/reality.html` have identical SHA-256 hashes.

# Verification report

Generated 2026-09-26T05:42:31.868Z by `scripts/verify.mjs` against `dist/reality.html`.

Renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)

## Checkpoints

| t (s) | checkpoint | page errors | WebGL/shader | non-finite HDR | screenshot |
|---|---|---|---|---|---|
| 2 | title card | 0 | 0 | 0 | [png](shots/00_title-card_t2.png) |
| 4 | ch1 transition midpoint | 0 | 0 | 0 | [png](shots/01_ch1-transition-midpoint_t4.png) |
| 6 | ch1 observer start | 0 | 0 | 0 | [png](shots/02_ch1-observer-start_t6.png) |
| 64 | ch2 transition midpoint | 0 | 0 | 0 | [png](shots/03_ch2-transition-midpoint_t64.png) |
| 66 | ch2 inner-scale start | 0 | 0 | 0 | [png](shots/04_ch2-inner-scale-start_t66.png) |
| 154 | ch3 transition midpoint | 0 | 0 | 0 | [png](shots/05_ch3-transition-midpoint_t154.png) |
| 156 | ch3 quantum start | 0 | 0 | 0 | [png](shots/06_ch3-quantum-start_t156.png) |
| 274 | ch4 transition midpoint | 0 | 0 | 0 | [png](shots/07_ch4-transition-midpoint_t274.png) |
| 276 | ch4 sensory-filter start | 0 | 0 | 0 | [png](shots/08_ch4-sensory-filter-start_t276.png) |
| 334 | ch5 transition midpoint | 0 | 0 | 0 | [png](shots/09_ch5-transition-midpoint_t334.png) |
| 336 | ch5 frequency start | 0 | 0 | 0 | [png](shots/10_ch5-frequency-start_t336.png) |
| 409 | ch6 transition midpoint | 0 | 0 | 0 | [png](shots/11_ch6-transition-midpoint_t409.png) |
| 411 | ch6 life start | 0 | 0 | 0 | [png](shots/12_ch6-life-start_t411.png) |
| 454 | ch7 transition midpoint | 0 | 0 | 0 | [png](shots/13_ch7-transition-midpoint_t454.png) |
| 456 | ch7 spacetime start | 0 | 0 | 0 | [png](shots/14_ch7-spacetime-start_t456.png) |
| 559 | ch8 transition midpoint | 0 | 0 | 0 | [png](shots/15_ch8-transition-midpoint_t559.png) |
| 561 | ch8 gravity start | 0 | 0 | 0 | [png](shots/16_ch8-gravity-start_t561.png) |
| 649 | ch9 transition midpoint | 0 | 0 | 0 | [png](shots/17_ch9-transition-midpoint_t649.png) |
| 651 | ch9 mathematics start | 0 | 0 | 0 | [png](shots/18_ch9-mathematics-start_t651.png) |
| 739 | ch10 transition midpoint | 0 | 0 | 0 | [png](shots/19_ch10-transition-midpoint_t739.png) |
| 741 | ch10 cosmos start | 0 | 0 | 0 | [png](shots/20_ch10-cosmos-start_t741.png) |
| 799 | ch11 transition midpoint | 0 | 0 | 0 | [png](shots/21_ch11-transition-midpoint_t799.png) |
| 801 | ch11 frontier start | 0 | 0 | 0 | [png](shots/22_ch11-frontier-start_t801.png) |
| 824 | ch12 transition midpoint | 0 | 0 | 0 | [png](shots/23_ch12-transition-midpoint_t824.png) |
| 826 | ch12 synthesis start | 0 | 0 | 0 | [png](shots/24_ch12-synthesis-start_t826.png) |
| 617.02 | ch8 singularity cut | 0 | 0 | 0 | [png](shots/25_ch8-singularity-cut_t617.02.png) |
| 852 | end card | 0 | 0 | 0 | [png](shots/26_end-card_t852.png) |

## Determinism

```json
{
  "stillAcrossLoads": {
    "a": "4b768434cd542c05",
    "b": "4b768434cd542c05",
    "identical": true
  },
  "renderMode": {
    "frames": [
      120,
      9012,
      18510
    ],
    "session1": [
      [
        "c281358861307e29",
        "c281358861307e29"
      ],
      [
        "1c432f091c784f1f",
        "1c432f091c784f1f"
      ],
      [
        "38902eb6f2d8077d",
        "38902eb6f2d8077d"
      ]
    ],
    "session2": [
      [
        "c281358861307e29",
        "c281358861307e29"
      ],
      [
        "1c432f091c784f1f",
        "1c432f091c784f1f"
      ],
      [
        "38902eb6f2d8077d",
        "38902eb6f2d8077d"
      ]
    ],
    "sameWithinSession": true,
    "sameAcrossSessions": true
  }
}
```

## file:// with networking disabled

```json
{
  "url": "file://…/dist/reality.html",
  "size": 5465084,
  "requests": 4,
  "nonLocalRequests": [],
  "pageErrors": [],
  "windowErrors": []
}
```

## Low tier, live mode

```json
{
  "tier": "low",
  "renderScale": 0.75,
  "frames": 54,
  "medianMs": 183.39999999999782,
  "p95Ms": 849.8999999999996,
  "note": "software rasteriser (SwiftShader) — no GPU in this environment"
}
```

## Free camera

```json
{
  "viewChanged": true,
  "before": "shots/zz_freecam_before.png",
  "after": "shots/zz_freecam_after.png"
}
```

## Audio

```json
{
  "live": {
    "stateBefore": "running",
    "stateAfter": "running",
    "clockAdvancedS": 3.433,
    "audioClock": [
      null,
      null
    ]
  },
  "pageVsNode": {
    "samples": 24000,
    "bytes": [
      144000,
      144000
    ],
    "maxLsbDifference": 1,
    "identical": false
  }
}
```

## Result: all checks passed


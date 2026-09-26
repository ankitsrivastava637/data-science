# Earth imagery

| file | size | what it is | where it came from |
|---|---|---|---|
| `blue-marble.jpg` | 4096 × 2048, equirectangular | cloud-free true-colour Earth with shaded relief and bathymetry, in the style of NASA's *Blue Marble* composites | copied unchanged from `example/img/earth-blue-marble.jpg` in the npm package `three-globe@2.45.2` (MIT-licensed package by Vasco Asturiano) |
| `night-lights.jpg` | 4096 × 2048, equirectangular | night-time city lights, in the style of NASA's *Black Marble / Earth at Night* | copied unchanged from `example/img/earth-night.jpg` in the same package |

NASA imagery is in the public domain. The upstream NASA pages could not be opened from the build
environment (web access was limited to search excerpts), so the exact NASA product and its version
are **not verified here**. The package ships these files as example assets. REALITY uses them only
as colour maps for the globe in Chapter 10. Coastlines for the water mask come separately from Natural
Earth (`world-atlas`, public domain).

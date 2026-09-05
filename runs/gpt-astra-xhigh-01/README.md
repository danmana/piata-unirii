# Piața Unirii — A living miniature

Open `index.html` directly in a browser with WebGL 2. Everything is bundled locally; no server, installation, network connection, external font, or image download is required.

| Control | Action |
| --- | --- |
| Left drag / one finger | Orbit the square |
| Right drag / shift-drag | Pan |
| Scroll | Zoom |
| Two fingers | Pan and pinch to zoom |
| R | Re-centre on the church and monument |
| F | Cinematic orbit, beginning near the rooftops and rising into an aerial view |
| T | Clear day / golden-hour sunset |
| V | Street-level / aerial preset |
| L | Floating landmark labels, hidden initially |

The architectural layout uses metres, with east along +X and north along −Z. The pedestrian square measures 160 × 220 metres. Named landmarks and all 24 perimeter frontages have fixed allocations. Secondary buildings pass an axis-aligned footprint check against buildings, the plaza, and reserved roads. A failed fixed frontage stops generation with an error; background placements have a maximum of ten attempts.

The church has its single 80-metre northern clock tower, stepped tile roof, pointed windows, buttresses, tracery, west portal, and polygonal choir. The monument includes the horse and rider and four accompanying bronze figures. The palace has an open courtyard and sculptural roofline; the paired Mirror Buildings frame Iuliu Maniu. The excavated Roman foundations sit below glass at paving level, above a continuous solid ground foundation.

Repeated geometry uses GPU instances grouped by material, spatial region, and detail tier. Stone, plaster, terracotta, bronze, vegetation, pavement, glass, and water have separate pools. A shared canvas-generated material atlas supplies surface variation. Large volumes and stepped surfaces use stretched, merged blocks; small voxels define architectural edges. Frustum culling and distance thresholds retain hero details nearby and reduce detail at longer distances. Static soft sunlight shadows, contact shading, sky fill, haze, and emissive evening lighting provide depth.

There are 116 animated or seated residents and visitors, including photographers, café patrons, cyclists, a delivery cyclist, and children. Twelve vehicles follow the perimeter and outer streets. Fountain jets and pigeons are animated with shared instance buffers. Random detail uses deterministic seeds; landmark placement never uses randomness.

`app-source.js` contains the renderer, controls, labels, and application lifecycle. `world.js` constructs and animates the model. `app.js` is the prebuilt browser bundle. The local Three.js 0.180.0 source and MIT license are in `vendor/`. The import map also points to the local module build. The classic bundle allows direct `file:` loading without module-origin restrictions.

To rebuild after editing the sources, with esbuild available:

```sh
esbuild app-source.js --bundle --format=iife --minify --outfile=app.js
```

Architectural reference checks included the [Cluj Tourism description of the Mirror Buildings](https://clujtourism.ro/en/portfolio/houses-of-roman-catholic-organization-mirror-buildings/) and the [Cluj County Library’s account of Piața Unirii](https://www.bjc.ro/wiki/index.php/Pia%C5%A3a_Libert%C4%83%C5%A3ii). These are documentation links only; the application does not access them.

This is a voxel architectural interpretation with approximate geographic proportions, rather than a surveyed digital twin. Frame rate depends on the browser, viewport, and GPU; validation measurements are recorded in `verification.json`.

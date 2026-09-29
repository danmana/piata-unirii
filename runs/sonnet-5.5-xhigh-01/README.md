# Piața Unirii, Cluj-Napoca — voxel miniature (Claude Sonnet 5.5, xhigh)

Open `index.html` (works from `file://` or any static server). No build step, no network requests, no external assets.

## Controls

| Input | Action |
| --- | --- |
| Left-drag | Rotate (orbit) |
| Right-drag | Pan |
| Scroll | Zoom (towards the cursor) |
| `R` | Re-centre on St. Michael's Church + the Matthias Corvinus monument (hero view) |
| `F` | Cinematic flyover: rooftop-height orbit of the square, then rises into an aerial pass |
| `T` | Clear day ⇄ Golden-hour sunset |
| `V` | Aerial ⇄ street-level camera presets |
| `L` | Floating landmark labels (occluded / off-screen / distant labels hide themselves) |
| `Shift+G` | Regenerate with a new seed (disposes all GPU resources first; also `PU.app.regenerate(seed)`, or `?seed=N`) |

## Architecture (all classic scripts, one `window.PU` namespace)

- `voxel.js` — `VoxelGrid`, authoring primitives, **greedy mesher with per-vertex AO**, LOD down-sampling. Only exposed faces are emitted.
- `renderer.js` — custom **WebGL2** renderer: merged static chunks split into nine material **pools**
  (stone, plaster, terracotta, bronze, vegetation, pavement, glass, water, misc), **GPU instancing** for trees, props,
  people, cyclists, pigeons, cars and fountain jets, two-cascade static shadow maps, procedural sky/clouds,
  frustum culling and distance LOD per chunk.
- `atlas.js` — the shared texture atlas (a WebGL2 texture array) generated procedurally with Canvas 2D.
- `layout.js` — fixed landmark positions, perimeter lots, street network, **occupancy grid**, ground classification.
- `church.js`, `monument.js`, `heroes.js` (Bánffy Palace, Mirror Buildings, Hotel Continental) — LOD 0 hero assets (0.25 m / 0.1 m voxels).
- `facades.js` — historic Cluj façade generator for the 29 perimeter lots; `blocks.js` — Zone D old-town fabric
  (reserve footprint → collision test → keep frontage → skip after 10 failed attempts); `suburbs.js` — hillside
  neighbourhoods, panel blocks and a Cetățuia-style fort; `city.js` — ground and hill terrain tiers.
- `props.js` — procedural trees with branching limbs and clustered crowns, furniture, café terraces, the Roman window and the fountain.
- `actors.js` — articulated voxel people (rigged in the vertex shader), pedestrian waypoint graph, tourists, café patrons,
  children, cyclists, pigeons, traffic with braking for cars and pedestrians.
- LOD tiers: LOD 0 hero (0.25 m, monument 0.1 m) · LOD 1 perimeter (0.5 m) · LOD 2 background (1–2 m, hills 8 m+),
  each with distance-selected coarser copies.

# Piața Unirii, Cluj-Napoca — voxel miniature

Self-contained Three.js (r185, vendored) scene of Piața Unirii: St. Michael's Church with its
single 80 m neo-Gothic tower, the Matthias Corvinus ensemble, the Roman archaeological window,
Bánffy Palace, the Mirror Buildings on Iuliu Maniu, the former Hotel Continental, the named
north/west/south façades, the surrounding old town, the Someș, and the hills around Cluj.

Open `index.html` over HTTP (ES modules; the comparison page does this). No network requests.

## Controls

- Left-drag rotate · right-drag pan · scroll zoom
- `R` re-centre on the church and monument · `F` cinematic flyover · `T` day / golden-hour
- `V` street level / aerial · `G` regenerate crowds, vehicles, café furniture and window lights

## Layout

- `src/voxel.js` — voxel grids, shape rasteriser, greedy mesher with baked vertex AO, geometry sink
- `src/ground.js` — heightmap ground (paving, roads, curbs, basins, pit, river)
- `src/church.js`, `src/monument.js` — LOD 0 landmarks (0.25 m / 0.125 m voxels)
- `src/buildings.js`, `src/perimeter.js` — parametric historic façades and the square's four sides
- `src/city.js` — outer blocks (LOD 1/2/3), hills, forests, distant blocks
- `src/props.js` — trees, benches, lamps, café terraces, bikes, fountain jets
- `src/agents.js` — pedestrians, cyclists, pigeons, vehicles
- `src/sky.js`, `src/materials.js`, `src/world.js`, `src/main.js`

// Vegetation and street furniture: organic voxel trees, benches, lamps, café terraces,
// bicycles, planters, bollards, signs and the animated fountain jets.
import * as THREE from 'three';
import { Model, meshModelToGeometries } from './voxel.js';
import { SQ, PLAZA, SIDEWALK, ROAD, CHURCH, MONUMENT, FOUNTAIN, ARCH, STREETS, OCC, polylineLength, polylineSample } from './layout.js';
import { hash3 } from './rng.js';

// ------------------------------------------------------------------ trees
export function treeModel(P, rng, kind, s) {
  const m = new Model(P);
  const cfg = {
    sycamore: { R: 6.2, H: 15.5, trunkH: 5.5, trunkR: 0.45, leaves: ['#78a04a', '#6b9440', '#86ad55'], branches: 5 },
    linden: { R: 3.9, H: 10.5, trunkH: 3.2, trunkR: 0.3, leaves: ['#5f8a3c', '#6e9a45', '#557f36'], branches: 5 },
    ornamental: { R: 2.1, H: 5.4, trunkH: 2.2, trunkR: 0.16, leaves: ['#6f9a4a', '#7fa855', '#5f8a3f'], branches: 4 },
    courtyard: { R: 3.2, H: 8.5, trunkH: 2.8, trunkR: 0.26, leaves: ['#4f7d3a', '#5e8a42', '#467236'], branches: 4 },
  }[kind];
  const bark = P.get(kind === 'sycamore' ? '#8d8470' : '#5e4a38', 'wood');
  const leafMats = cfg.leaves.map((c) => P.get(c, 'leaf'));
  const R = cfg.R, H = cfg.H;
  m.addGrid([-R - 1, 0, -R - 1], [R + 1, H + 1.5, R + 1], s).solidBelow = true;
  const leafAt = (x, y, z, d) => {
    if (d > 1) return false;
    if (d < 0.84) return true; // solid core: no hidden interior faces
    const h = hash3(Math.floor(x / s), Math.floor(y / s), Math.floor(z / s), 3);
    return h > 0.3 + (d - 0.84) * 3.2;
  };
  const blob = (cx, cy, cz, rx, ry, rz) => {
    const mat = leafMats[Math.floor(rng() * leafMats.length)];
    m.paint(cx - rx, cy - ry, cz - rz, cx + rx, cy + ry, cz + rz, (x, y, z, cur) => {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
      const d = dx * dx + dy * dy + dz * dz;
      if (!leafAt(x, y, z, d)) return 0;
      if (cur === bark) return 0;
      // colour variation clusters
      const h = hash3(Math.floor(x / (s * 4)), Math.floor(y / (s * 4)), Math.floor(z / (s * 4)), 9);
      return h < 0.3 ? leafMats[0] : h < 0.65 ? mat : leafMats[leafMats.length - 1];
    });
  };
  // trunk (slightly tapered) and root flare
  m.cone(0, 0, cfg.trunkR * 1.5, cfg.trunkR * 0.9, 0, cfg.trunkH, bark, 0);
  // recursive branches
  const branch = (x, y, z, dx, dy, dz, len, r, depth) => {
    const ex = x + dx * len, ey = y + dy * len, ez = z + dz * len;
    m.line(x, y, z, ex, ey, ez, r, bark);
    if (depth === 0) {
      const br = R * (0.42 + rng() * 0.2);
      blob(ex, ey + br * 0.2, ez, br, br * 0.85, br);
      return;
    }
    const n = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      const ang = rng() * Math.PI * 2;
      const spread = 0.55 + rng() * 0.35;
      let ndx = dx + Math.cos(ang) * spread, ndy = dy + 0.55 + rng() * 0.4, ndz = dz + Math.sin(ang) * spread;
      const L = Math.hypot(ndx, ndy, ndz);
      ndx /= L; ndy /= L; ndz /= L;
      branch(ex, ey, ez, ndx, ndy, ndz, len * 0.62, r * 0.6, depth - 1);
    }
  };
  for (let i = 0; i < cfg.branches; i++) {
    const ang = (i / cfg.branches) * Math.PI * 2 + rng() * 0.7;
    const tilt = 0.45 + rng() * 0.3;
    const dx = Math.cos(ang) * tilt, dz = Math.sin(ang) * tilt, dy = 1;
    const L = Math.hypot(dx, dy, dz);
    branch(0, cfg.trunkH - 0.3, 0, dx / L, dy / L, dz / L, (H - cfg.trunkH) * 0.42, cfg.trunkR * 0.7, kind === 'ornamental' ? 1 : 2);
  }
  // central crown mass
  blob(0, cfg.trunkH + (H - cfg.trunkH) * 0.55, 0, R * 0.82, (H - cfg.trunkH) * 0.5, R * 0.82);
  return m;
}

function geoWithMats(P, model) {
  return meshModelToGeometries(model);
}

// ------------------------------------------------------------------ furniture prototypes
function benchModel(P) {
  const m = new Model(P);
  const wood = P.get('#8a6240', 'wood'), metal = P.get('#2e3033', 'metal');
  m.addGrid([-1.0, 0, -0.4], [1.0, 1.0, 0.4], 0.0625).solidBelow = true;
  for (const sx of [-0.8, 0.8]) {
    m.box(sx - 0.05, 0, -0.3, sx + 0.05, 0.42, 0.3, metal);
    m.box(sx - 0.05, 0.42, -0.3, sx + 0.05, 0.5, -0.24, metal);
    m.box(sx - 0.05, 0.42, -0.32, sx + 0.05, 0.95, -0.26, metal);
  }
  for (const z of [-0.25, -0.12, 0.01, 0.14]) m.box(-0.95, 0.42, z, 0.95, 0.48, z + 0.1, wood);
  for (const y of [0.6, 0.75, 0.88]) m.box(-0.95, y, -0.33, 0.95, y + 0.09, -0.27, wood);
  return m;
}
function lampModel(P, twoArm) {
  const m = new Model(P);
  const metal = P.get('#2b2f33', 'metal'), lamp = P.get('#ffe9c4', 'lamp'), cap = P.get('#3a3f44', 'metal');
  m.addGrid([-1.2, 0, -0.4], [1.2, 7, 0.4], 0.1).solidBelow = true;
  m.box(-0.2, 0, -0.2, 0.2, 0.5, 0.2, metal);
  m.box(-0.08, 0.5, -0.08, 0.08, 5.8, 0.08, metal);
  const heads = twoArm ? [-0.9, 0.9] : [0.7];
  for (const hx of heads) {
    m.box(Math.min(0, hx), 5.6, -0.05, Math.max(0, hx), 5.7, 0.05, metal);
    m.box(hx - 0.3, 5.3, -0.2, hx + 0.3, 5.6, 0.2, lamp);
    m.box(hx - 0.35, 5.6, -0.25, hx + 0.35, 5.7, 0.25, cap);
  }
  return m;
}
function groundLightModel(P) {
  const m = new Model(P);
  const metal = P.get('#3a3f44', 'metal'), lamp = P.get('#ffdca8', 'lamp');
  m.addGrid([-0.2, 0, -0.2], [0.2, 0.8, 0.2], 0.05).solidBelow = true;
  m.box(-0.12, 0, -0.12, 0.12, 0.7, 0.12, metal);
  m.box(-0.1, 0.45, -0.1, 0.1, 0.65, 0.1, lamp);
  m.box(-0.14, 0.65, -0.14, 0.14, 0.72, 0.14, metal);
  return m;
}
function cafeSetModel(P) {
  const m = new Model(P);
  const metal = P.get('#2e3033', 'metal'), top = P.get('#e8e2d3', 'stone'), chair = P.get('#6b4a32', 'wood'), pole = P.get('#8b8f94', 'metal');
  m.addGrid([-1.4, 0, -1.4], [1.4, 2.6, 1.4], 0.0625).solidBelow = true;
  m.cylinder(0, 0, 0.06, 0.06, 0, 0.72, metal);
  m.cylinder(0, 0, 0.25, 0.25, 0, 0.04, metal);
  m.cylinder(0, 0, 0.42, 0.42, 0.72, 0.78, top);
  m.box(-0.035, 0.78, -0.035, 0.035, 2.35, 0.035, pole); // umbrella pole (canopy is a separate tinted prototype)
  const seats = [[0.85, 0], [-0.85, 0], [0, 0.85], [0, -0.85]];
  for (const [sx, sz] of seats) {
    m.box(sx - 0.22, 0.42, sz - 0.22, sx + 0.22, 0.48, sz + 0.22, chair);
    for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) m.box(sx + lx - 0.03, 0, sz + lz - 0.03, sx + lx + 0.03, 0.42, sz + lz + 0.03, metal);
    const bx = sx !== 0 ? Math.sign(sx) * 0.2 : 0, bz = sz !== 0 ? Math.sign(sz) * 0.2 : 0;
    m.box(sx + bx - (sx !== 0 ? 0.03 : 0.22), 0.48, sz + bz - (sz !== 0 ? 0.03 : 0.22), sx + bx + (sx !== 0 ? 0.03 : 0.22), 0.92, sz + bz + (sz !== 0 ? 0.03 : 0.22), chair);
  }
  return m;
}
function umbrellaModel(P) {
  const m = new Model(P);
  const white = P.get('#ffffff', 'cloth');
  m.addGrid([-1.5, 0, -1.5], [1.5, 0.75, 1.5], 0.125).solidBelow = false;
  m.cone(0, 0, 1.45, 0.1, 0, 0.62, white, 8, Math.PI / 8);
  return m;
}
function bikeModel(P) {
  const m = new Model(P);
  const dark = P.get('#25272a', 'dark'), frame = P.get('#3b5f8a', 'paint'), chrome = P.get('#b9bcc0', 'metal');
  m.addGrid([-1.0, 0, -0.3], [1.0, 1.2, 0.3], 0.05).solidBelow = true;
  for (const wx of [-0.55, 0.55]) {
    m.shape(wx - 0.36, 0, -0.04, wx + 0.36, 0.72, 0.04, (x, y, z) => { const d = Math.hypot(x - wx, y - 0.36); return d <= 0.36 && d > 0.28; }, dark);
    m.shape(wx - 0.36, 0, -0.03, wx + 0.36, 0.72, 0.03, (x, y, z) => { const d = Math.hypot(x - wx, y - 0.36); return d <= 0.28 && d > 0.24; }, chrome);
  }
  m.line(-0.55, 0.36, 0, -0.1, 0.9, 0, 0.035, frame);
  m.line(-0.1, 0.9, 0, 0.45, 0.85, 0, 0.035, frame);
  m.line(0.45, 0.85, 0, 0.55, 0.36, 0, 0.035, frame);
  m.line(-0.1, 0.9, 0, 0.1, 0.36, 0, 0.035, frame);
  m.line(0.1, 0.36, 0, 0.45, 0.85, 0, 0.035, frame);
  m.line(0.1, 0.36, 0, -0.55, 0.36, 0, 0.035, frame);
  m.box(-0.22, 0.92, -0.08, 0.02, 1.0, 0.08, dark); // saddle
  m.box(0.42, 0.85, -0.3, 0.5, 0.93, 0.3, chrome); // handlebar
  m.box(0.05, 0.3, -0.12, 0.15, 0.42, 0.12, dark); // crank
  return m;
}
function planterModel(P) {
  const m = new Model(P);
  const stone = P.get('#b8b0a0', 'stone'), soil = P.get('#4a3a2a', 'grass'), leaf = P.get('#5a8a3c', 'leaf'), leafB = P.get('#6f9a4a', 'leaf');
  m.addGrid([-0.9, 0, -0.5], [0.9, 1.6, 0.5], 0.0625).solidBelow = true;
  m.box(-0.8, 0, -0.4, 0.8, 0.6, 0.4, stone);
  m.box(-0.7, 0.55, -0.3, 0.7, 0.62, 0.3, soil);
  m.ellipsoid(0, 0.95, 0, 0.75, 0.45, 0.4, leaf, (x, y, z, d) => hash3(Math.floor(x * 16), Math.floor(y * 16), Math.floor(z * 16), 2) > 0.3);
  m.ellipsoid(0.2, 1.05, 0.05, 0.4, 0.35, 0.3, leafB, (x, y, z, d) => hash3(Math.floor(x * 16), Math.floor(y * 16), Math.floor(z * 16), 4) > 0.4);
  return m;
}
function bollardModel(P) {
  const m = new Model(P);
  const metal = P.get('#2b2f33', 'metal'), band = P.get('#d8d2c2', 'metal');
  m.addGrid([-0.15, 0, -0.15], [0.15, 1.0, 0.15], 0.05).solidBelow = true;
  m.cylinder(0, 0, 0.1, 0.1, 0, 0.9, metal);
  m.cylinder(0, 0, 0.11, 0.11, 0.7, 0.78, band);
  return m;
}
function signModel(P) {
  const m = new Model(P);
  const metal = P.get('#4a4f55', 'metal'), plate = P.get('#274a7a', 'cloth'), white = P.get('#f2f2ee', 'cloth');
  m.addGrid([-0.5, 0, -0.1], [0.5, 2.8, 0.1], 0.05).solidBelow = true;
  m.box(-0.05, 0, -0.05, 0.05, 2.5, 0.05, metal);
  m.box(-0.45, 1.9, -0.03, 0.45, 2.5, 0.03, plate);
  for (let i = 0; i < 3; i++) m.box(-0.35, 2.05 + i * 0.14, 0.03, 0.35 - (i === 2 ? 0.25 : 0), 2.1 + i * 0.14, 0.05, white);
  return m;
}
function infoPanelModel(P) {
  const m = new Model(P);
  const metal = P.get('#3a3f44', 'metal'), panel = P.get('#e8e0cc', 'cloth'), text = P.get('#3b3a36', 'cloth'), map = P.get('#b7c6a2', 'cloth');
  m.addGrid([-0.9, 0, -0.4], [0.9, 1.4, 0.4], 0.05).solidBelow = true;
  m.box(-0.6, 0, -0.06, -0.5, 0.9, 0.06, metal);
  m.box(0.5, 0, -0.06, 0.6, 0.9, 0.06, metal);
  m.shape(-0.85, 0.7, -0.35, 0.85, 1.3, 0.3, (x, y, z) => Math.abs(y - (0.9 + (z + 0.3) * 0.5)) < 0.05, panel);
  m.shape(-0.7, 0.7, -0.3, -0.1, 1.3, 0.25, (x, y, z) => Math.abs(y - (0.9 + (z + 0.3) * 0.5 + 0.05)) < 0.03 && hash3(Math.floor(x * 20), Math.floor(z * 20), 0, 1) > 0.45, text);
  m.shape(0.0, 0.7, -0.3, 0.7, 1.3, 0.25, (x, y, z) => Math.abs(y - (0.9 + (z + 0.3) * 0.5 + 0.05)) < 0.03, map);
  return m;
}

// ------------------------------------------------------------------ placement
export function buildProps(world) {
  const P = world.palette;
  const M = world.materials;
  const rng = world.rng.fork('props');
  const occ = world.occ;
  const gy = (x, z) => world.groundHeightAt(x, z);
  world.seats = [];      // { x, z, facing } sitting spots for agents
  world.cafeSeats = [];
  world.treeSpots = [];
  world.bikeRacks = [];

  const addProto = (model, items, { shadow = true } = {}) => {
    const geos = geoWithMats(P, model);
    const meshes = [];
    for (const cls of Object.keys(geos)) {
      const mesh = world.addInstanced(geos[cls], M[cls] || M.wall, items, { castShadow: shadow && !['lamp', 'glass', 'cloth'].includes(cls) });
      if (mesh) { meshes.push(mesh); world.disposables.push(geos[cls]); }
    }
    return meshes;
  };

  // ---- trees ----
  const kinds = { sycamore: [], linden: [], ornamental: [], courtyard: [], lindenFar: [], courtyardFar: [] };
  const tree = (kind, x, z, scale = 1) => {
    const y = gy(x, z);
    kinds[kind].push({ x, y, z, rot: rng() * Math.PI * 2, sx: scale * rng.range(0.92, 1.08), sy: scale * rng.range(0.9, 1.1), sz: scale * rng.range(0.92, 1.08) });
    world.treeSpots.push({ x, z });
    occ.markRect(x - 1, z - 1, x + 1, z + 1, OCC.TREE);
    world.markOccluder(x - 0.5, z - 0.5, x + 0.5, z + 0.5);
  };
  // rows of lindens defining the southern part of the plaza and the east/west margins
  for (let x = -92; x <= 92; x += 9.2) if (Math.abs(x - MONUMENT.cx) > 6) tree('linden', x + rng.range(-0.3, 0.3), 62 + rng.range(-0.3, 0.3));
  for (let z = -40; z <= 54; z += 9.5) tree('linden', 88, z + rng.range(-0.3, 0.3));
  for (let z = -30; z <= 54; z += 9.5) tree('linden', -88, z + rng.range(-0.3, 0.3));
  // large sycamores in the church grounds (north & east lawns) and by the fountain
  for (const [x, z] of [[-30, -58], [10, -60], [44, -58], [52, -36], [56, -20], [50, -8], [-52, -60]]) tree('sycamore', x, z, rng.range(0.9, 1.1));
  for (const [x, z] of [[76, 32], [80, 52], [30, 56], [66, 24]]) tree('sycamore', x, z, 0.85);
  // small ornamentals near the café corners
  for (const [x, z] of [[-80, 40], [-72, 32], [-64, 24], [70, -46], [78, -58], [-70, -30]]) tree('ornamental', x, z);
  // street trees along the boulevards (Eroilor, 21 Decembrie, Memorandumului, Napoca) and courtyards
  for (const st of STREETS) {
    if (st.width < 14) continue;
    const L = polylineLength(st.pts);
    for (let s = 12; s < L - 6; s += 13) {
      const p = polylineSample(st.pts, s);
      const nx = -p.dir[1], nz = p.dir[0];
      for (const side of [1, -1]) {
        const x = p.x + nx * side * (st.width / 2 - 1.3), z = p.z + nz * side * (st.width / 2 - 1.3);
        if (Math.abs(x) > 540 || Math.abs(z) > 540) continue;
        if (x > SQ.x0 - 2 && x < SQ.x1 + 2 && z > SQ.z0 - 2 && z < SQ.z1 + 2) continue;
        const near = Math.abs(x) < 240 && Math.abs(z) < 200;
        const y = gy(x, z);
        kinds[near ? 'linden' : 'lindenFar'].push({ x, y, z, rot: rng() * 6.28, sx: 0.9, sy: 0.9, sz: 0.9 });
        occ.markRect(x - 1, z - 1, x + 1, z + 1, OCC.TREE);
      }
    }
  }
  // courtyard trees on free block-interior cells
  let ct = 0;
  for (let k = 0; k < 3000 && ct < 210; k++) {
    const x = rng.range(-520, 520), z = rng.range(-520, 520);
    if (x > SQ.x0 - 6 && x < SQ.x1 + 6 && z > SQ.z0 - 6 && z < SQ.z1 + 6) continue;
    if (occ.get(x, z) !== OCC.FREE) continue;
    let free = true;
    for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, -2], [2, -2], [-2, 2]]) if (occ.get(x + dx, z + dz) !== OCC.FREE) { free = false; break; }
    if (!free) continue;
    const near = Math.abs(x) < 240 && Math.abs(z) < 200;
    const y = gy(x, z);
    kinds[near ? 'courtyard' : 'courtyardFar'].push({ x, y, z, rot: rng() * 6.28, sx: rng.range(0.8, 1.15), sy: rng.range(0.85, 1.15), sz: rng.range(0.8, 1.15) });
    occ.markRect(x - 1.5, z - 1.5, x + 1.5, z + 1.5, OCC.TREE);
    // green patch under the tree
    world.outerGround.setDisc(x, z, rng.range(2.5, 5), { mat: world.groundIds.grass, fn: (px, pz) => occ.get(px, pz) === OCC.FREE || occ.get(px, pz) === OCC.TREE });
    ct++;
  }
  const protoTree = (kind, s) => treeModel(P, rng.fork('tree' + kind + s), kind, s);
  addProto(protoTree('sycamore', 0.45), kinds.sycamore);
  addProto(protoTree('linden', 0.35), kinds.linden.filter((_, i) => i % 2 === 0));
  addProto(protoTree('linden', 0.35), kinds.linden.filter((_, i) => i % 2 === 1));
  addProto(protoTree('ornamental', 0.25), kinds.ornamental);
  addProto(protoTree('courtyard', 0.6), kinds.courtyard, { shadow: false });
  addProto(protoTree('linden', 1.0), kinds.lindenFar, { shadow: false });
  addProto(protoTree('courtyard', 1.0), kinds.courtyardFar, { shadow: false });
  world.stats.trees = Object.values(kinds).reduce((a, b) => a + b.length, 0);

  // ---- benches ----
  const benches = [];
  const bench = (x, z, facing) => {
    benches.push({ x, y: gy(x, z), z, rot: facing });
    // two seats per bench, facing direction is where the sitter looks
    for (const off of [-0.5, 0.5]) world.seats.push({ x: x + Math.cos(facing) * off, z: z - Math.sin(facing) * off, facing });
    occ.markRect(x - 1.2, z - 0.6, x + 1.2, z + 0.6, OCC.RESERVED);
  };
  // along the church ring path facing the church, and along the tree rows facing the plaza
  for (let x = -40; x <= 30; x += 12) bench(x, CHURCH.z0 - 6.5, 0);            // north path, facing south (church)
  for (let x = -30; x <= 20; x += 12) bench(x, CHURCH.z1 + 5.5, Math.PI);       // south side, facing north
  for (let x = -84; x <= 84; x += 12) if (Math.abs(x - MONUMENT.cx) > 8) bench(x, 64.5, Math.PI); // linden row, facing north into the plaza
  for (let z = -30; z <= 50; z += 12) bench(85.5, z, Math.PI / 2);              // east row facing west
  for (let z = -20; z <= 50; z += 12) bench(-85.5, z, -Math.PI / 2);            // west row facing east
  for (let x = FOUNTAIN.cx - 12; x <= FOUNTAIN.cx + 12; x += 8) bench(x, FOUNTAIN.cz - 11, 0);
  addProto(benchModel(P), benches);

  // ---- lamps ----
  const lamps = [], lamps2 = [], glows = [];
  const lamp = (x, z, rot, two = false) => (two ? lamps2 : lamps).push({ x, y: gy(x, z), z, rot });
  for (let x = PLAZA.x0 + 8; x < PLAZA.x1; x += 18) { lamp(x, PLAZA.z0 + 1.2, Math.PI / 2); lamp(x, PLAZA.z1 - 1.2, -Math.PI / 2); }
  for (let z = PLAZA.z0 + 12; z < PLAZA.z1 - 6; z += 18) { lamp(PLAZA.x0 + 1.2, z, 0); lamp(PLAZA.x1 - 1.2, z, Math.PI); }
  // lamps along the sidewalks of the surrounding streets
  for (const st of STREETS) {
    const L = polylineLength(st.pts);
    for (let s = 6; s < L; s += 26) {
      const p = polylineSample(st.pts, s);
      const nx = -p.dir[1], nz = p.dir[0];
      const side = Math.floor(s / 26) % 2 === 0 ? 1 : -1;
      const x = p.x + nx * side * (st.width / 2 - 0.9), z = p.z + nz * side * (st.width / 2 - 0.9);
      if (Math.abs(x) > 540 || Math.abs(z) > 540) continue;
      if (x > SQ.x0 - 1 && x < SQ.x1 + 1 && z > SQ.z0 - 1 && z < SQ.z1 + 1) continue;
      lamp(x, z, Math.atan2(-nz * side, -nx * side) + Math.PI, st.width >= 14);
    }
  }
  // ground lights around the church
  for (let x = CHURCH.towerX0 - 4; x <= CHURCH.x1 + CHURCH.apseLen + 6; x += 7) { glows.push({ x, y: gy(x, CHURCH.z0 - 4.2), z: CHURCH.z0 - 4.2 }); glows.push({ x, y: gy(x, CHURCH.z1 + 4.2), z: CHURCH.z1 + 4.2 }); }
  for (let z = CHURCH.z0 - 2; z <= CHURCH.z1 + 2; z += 6) glows.push({ x: CHURCH.x1 + CHURCH.apseLen + 6, y: gy(CHURCH.x1 + CHURCH.apseLen + 6, z), z });
  addProto(lampModel(P, false), lamps);
  addProto(lampModel(P, true), lamps2);
  addProto(groundLightModel(P), glows, { shadow: false });
  world.lampSpots = [...lamps, ...lamps2];
  // a handful of warm point lights around the square for the evening mood
  for (const [x, z] of [[-50, 52], [40, 50], [70, -20]]) {
    const l = new THREE.PointLight(0xffb870, 0, 70, 1.6);
    l.position.set(x, 6, z);
    l.visible = false;
    world.dynamic.add(l);
    world.nightLights.push({ light: l, intensity: 520 });
  }

  // ---- café terraces along the south and west frontages and the SW plaza corner ----
  const sets = [], umbrellas = [];
  const umbrellaCols = ['#e9e2d0', '#c8523a', '#3d6b4a', '#c9a24a', '#f0ede6', '#7a3e3e'];
  const cafe = (x, z, rot) => {
    const y = gy(x, z);
    sets.push({ x, y, z, rot });
    if (rng() < 0.85) umbrellas.push({ x, y: y + 2.35, z, rot: rng() * 0.3, color: rng.pick(umbrellaCols) });
    for (const [sx, sz] of [[0.85, 0], [-0.85, 0], [0, 0.85], [0, -0.85]]) {
      const wx = x + sx * Math.cos(rot) + sz * Math.sin(rot), wz = z - sx * Math.sin(rot) + sz * Math.cos(rot);
      world.cafeSeats.push({ x: wx, z: wz, facing: Math.atan2(x - wx, z - wz) });
    }
    occ.markRect(x - 1.4, z - 1.4, x + 1.4, z + 1.4, OCC.RESERVED);
  };
  // terraces on the sidewalk in front of the south-side and west-side cafés (between frontage and road)
  for (let x = -54; x <= -10; x += 3.2) cafe(x, SQ.z1 - 2.2, rng() * 0.4);
  for (let x = 12; x <= 46; x += 3.2) cafe(x, SQ.z1 - 2.2, rng() * 0.4);
  for (let z = 10; z <= 60; z += 3.2) cafe(SQ.x0 + 2.2, z, rng() * 0.4);
  for (let z = -70; z <= -30; z += 3.4) cafe(SQ.x1 - 2.2, z, rng() * 0.4);
  // terrace on the plaza's south-west corner under the lindens
  for (let x = -84; x <= -66; x += 3.4) for (let z = 46; z <= 56; z += 3.4) cafe(x + rng.range(-0.2, 0.2), z + rng.range(-0.2, 0.2), rng() * 0.6);
  addProto(cafeSetModel(P), sets);
  const umbGeo = geoWithMats(P, umbrellaModel(P)).cloth;
  world.addInstanced(umbGeo, M.cloth, umbrellas, { castShadow: true });
  world.disposables.push(umbGeo);

  // ---- bicycles at racks, planters, bollards, signs ----
  const bikes = [];
  const rack = (x, z, rot, n) => {
    for (let i = 0; i < n; i++) {
      const bx = x + Math.cos(rot) * i * 0.8, bz = z - Math.sin(rot) * i * 0.8;
      bikes.push({ x: bx, y: gy(bx, bz), z: bz, rot: rot + Math.PI / 2 + rng.range(-0.15, 0.15) });
    }
    world.bikeRacks.push({ x, z });
    occ.markRect(x - 1, z - 1, x + n * 0.8 + 1, z + 1, OCC.RESERVED);
  };
  rack(PLAZA.x0 + 4, PLAZA.z1 - 10, 0, 6);
  rack(PLAZA.x1 - 9, PLAZA.z1 - 10, 0, 5);
  rack(PLAZA.x0 + 4, PLAZA.z0 + 14, 0, 4);
  rack(PLAZA.x1 - 8, PLAZA.z0 + 14, 0, 5);
  rack(MONUMENT.cx + 22, MONUMENT.cz + 10, Math.PI / 2, 4);
  world.bikeGeo = geoWithMats(P, bikeModel(P));
  addProto(bikeModel(P), bikes);
  const planters = [];
  for (let x = -54; x <= -10; x += 6.4) planters.push({ x: x + 1.6, y: gy(x, SQ.z1 - 4.4), z: SQ.z1 - 4.4, rot: 0 });
  for (let x = 12; x <= 46; x += 6.4) planters.push({ x: x + 1.6, y: gy(x, SQ.z1 - 4.4), z: SQ.z1 - 4.4, rot: 0 });
  for (let z = 10; z <= 60; z += 6.4) planters.push({ x: SQ.x0 + 4.4, y: gy(SQ.x0 + 4.4, z), z: z + 1.6, rot: Math.PI / 2 });
  addProto(planterModel(P), planters);
  const bollards = [];
  for (const cx of [-70, -14, 40, 88]) for (const dx of [-3.5, 3.5]) bollards.push({ x: cx + dx, y: gy(cx + dx, PLAZA.z1 - 0.6), z: PLAZA.z1 - 0.6 });
  for (const cx of [-90, -30, 30, 90]) for (const dx of [-3.5, 3.5]) bollards.push({ x: cx + dx, y: gy(cx + dx, PLAZA.z0 + 0.6), z: PLAZA.z0 + 0.6 });
  for (const cz of [-50, 0, 50]) for (const dz of [-3.5, 3.5]) { bollards.push({ x: PLAZA.x1 - 0.6, y: gy(PLAZA.x1 - 0.6, cz + dz), z: cz + dz }); bollards.push({ x: PLAZA.x0 + 0.6, y: gy(PLAZA.x0 + 0.6, cz + dz), z: cz + dz }); }
  addProto(bollardModel(P), bollards, { shadow: false });
  const signs = [], panels = [];
  for (const [x, z, rot] of [[PLAZA.x0 + 2, 6, Math.PI / 2], [PLAZA.x1 - 2, -6, -Math.PI / 2], [-40, PLAZA.z1 - 2, 0], [60, PLAZA.z0 + 2, Math.PI], [-60, PLAZA.z0 + 2, Math.PI]]) signs.push({ x, y: gy(x, z), z, rot });
  for (const [x, z, rot] of [[MONUMENT.cx - 10, MONUMENT.cz + 12, Math.PI], [ARCH.cx + 7, ARCH.cz + 3.5, Math.PI], [CHURCH.x0 - 6, CHURCH.z1 + 9, Math.PI]]) panels.push({ x, y: gy(x, z), z, rot });
  addProto(signModel(P), signs, { shadow: false });
  addProto(infoPanelModel(P), panels, { shadow: false });

  // ---- fountain jets (animated) ----
  const jetGeo = new THREE.BoxGeometry(0.22, 1, 0.22);
  jetGeo.translate(0, 0.5, 0);
  const jetMat = new THREE.MeshStandardMaterial({ color: 0xdff2fa, transparent: true, opacity: 0.62, roughness: 0.1, metalness: 0.2, emissive: 0x88aabb, emissiveIntensity: 0.15, depthWrite: false });
  const jets = [];
  for (const [bx0, bz0, bx1, bz1] of world.fountainBasins) {
    for (let x = bx0 + 1.5; x < bx1 - 0.5; x += 2.4) for (let z = bz0 + 1.2; z < bz1 - 0.5; z += 2.4) jets.push({ x, z, y: gy(x, z) + 0.02, phase: rng() * 6.28, h: rng.range(1.2, 3.2), speed: rng.range(0.6, 1.3) });
  }
  const jetMesh = new THREE.InstancedMesh(jetGeo, jetMat, jets.length);
  jetMesh.frustumCulled = false;
  jetMesh.renderOrder = 4;
  world.dynamic.add(jetMesh);
  world.disposables.push(jetGeo, jetMat);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  world.updaters.push((dt, t) => {
    for (let i = 0; i < jets.length; i++) {
      const j = jets[i];
      const cycle = (Math.sin(t * j.speed + j.phase) + 1) / 2;
      const h = 0.2 + j.h * Math.pow(cycle, 1.5);
      m4.compose(new THREE.Vector3(j.x, j.y, j.z), q, new THREE.Vector3(1 + cycle * 0.4, h, 1 + cycle * 0.4));
      jetMesh.setMatrixAt(i, m4);
    }
    jetMesh.instanceMatrix.needsUpdate = true;
  });
  world.fountainJets = jets;
}

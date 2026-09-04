// Outer old-town fabric (LOD 1/2/3 buildings along the street network), the Someș river,
// the coarse hill terrain with forests and hillside neighbourhoods, and distant blocks.
import { Model } from './voxel.js';
import { Ground } from './ground.js';
import { STREETS, SQ, OCC, polylineLength, polylineSample, polylineDistance, elevation } from './layout.js';
import { fbm2, hash2 } from './rng.js';

const WALLS = ['#e6d9b8', '#e9dfa6', '#d9b56a', '#e2c9a0', '#d8a9a2', '#cfd0cb', '#b9c4ab', '#efe8d6', '#dccbb0', '#e3cf92', '#d6d2c8', '#c9cdb9', '#e0c0b4', '#e8dcc2', '#cdb891'];
const TRIMS = ['#f4eee2', '#f7f2e8', '#efeee6', '#f6f1e4'];
const ROOFS = ['#b5532f', '#a94a2b', '#c0603a', '#8f4a30', '#9c4a2c', '#b95a38', '#7f3d29', '#a3502f'];
const STYLES = ['baroque', 'baroque', 'neoclassical', 'historicist', 'historicist', 'secession', 'renaissance'];

const inSquareZone = (x, z, pad) => x > SQ.x0 - pad && x < SQ.x1 + pad && z > SQ.z0 - pad && z < SQ.z1 + pad;

export function buildCity(world) {
  const rng = world.rng.fork('city');
  const occ = world.occ;
  let placed = 0, skipped = 0;
  for (const st of STREETS) {
    const L = polylineLength(st.pts);
    const sw = st.sidewalk ?? 2.5;
    for (const side of [1, -1]) {
      let s = 2;
      let guard = 0;
      while (s < L - 6 && guard++ < 400) {
        const probe = polylineSample(st.pts, s + 6);
        const distSq = Math.hypot(probe.x, probe.z);
        const tier = inSquareZone(probe.x, probe.z, 165) ? 1 : distSq < 400 ? 2 : 3;
        const w = tier === 1 ? rng.range(9, 20) : tier === 2 ? rng.range(12, 26) : rng.range(16, 34);
        const p0 = polylineSample(st.pts, s);
        const p1 = polylineSample(st.pts, Math.min(L, s + w));
        const dx = p1.x - p0.x, dz = p1.z - p0.z;
        const len = Math.hypot(dx, dz) || 1;
        const dir = [dx / len, dz / len];
        const nR = [-dir[1], dir[0]];
        const off = st.width / 2 + 0.3;
        let ok = false;
        for (let attempt = 0; attempt < 10 && !ok; attempt++) {
          const shrink = 1 - attempt * 0.08;
          const ww = Math.max(6, len * shrink);
          const d = (tier === 1 ? rng.range(12, 18) : rng.range(12, 22)) * shrink;
          let ox, oz, rot;
          if (side > 0) {
            ox = p0.x + nR[0] * off; oz = p0.z + nR[1] * off;
            rot = Math.atan2(-dir[1], dir[0]);
          } else {
            ox = p1.x - nR[0] * off; oz = p1.z - nR[1] * off;
            rot = Math.atan2(dir[1], -dir[0]);
          }
          // keep clear of the square block ring and the map edge
          if (inSquareZone(ox, oz, 0)) break;
          if (Math.abs(ox) > 540 || Math.abs(oz) > 540) break;
          if (!occ.rectFree(ox, oz, rot, ww, d)) continue;
          const spec = makeSpec(rng, tier, ww, d);
          const info = world.placeBuilding(spec, ox, oz, rot, rng.fork(`b${placed}`), { coarse: tier === 3 });
          if (info) { ok = true; placed++; }
        }
        if (!ok) skipped++;
        s += w + (tier === 1 ? 0.0 : rng.range(0, 3));
      }
    }
  }
  // ---- block interiors: lower back-buildings and wings aligned to the nearest street ----
  let fill = 0;
  for (let k = 0; k < 4200; k++) {
    const x = rng.range(-540, 540), z = rng.range(-540, 540);
    if (inSquareZone(x, z, 2)) continue;
    if (occ.get(x, z) !== OCC.FREE) continue;
    const tier = inSquareZone(x, z, 165) ? 1 : Math.hypot(x, z) < 400 ? 2 : 3;
    let best = null;
    for (const st of STREETS) {
      const r = polylineDistance(st.pts, x, z);
      if (!best || r.dist < best.dist) best = r;
    }
    if (!best || best.dist > 70) continue;
    const rot = Math.atan2(-best.dir[1], best.dir[0]) + (rng() < 0.5 ? 0 : Math.PI / 2);
    let done = false;
    for (let attempt = 0; attempt < 10 && !done; attempt++) {
      const w = rng.range(8, 16) * (1 - attempt * 0.06), d = rng.range(7, 12) * (1 - attempt * 0.06);
      const cr = Math.cos(rot), sr = Math.sin(rot);
      // 1.5 m clearance around the footprint
      const ox = x - 1.5 * cr - 1.5 * sr, oz = z + 1.5 * sr - 1.5 * cr;
      if (!occ.rectFree(ox, oz, rot, w + 3, d + 3)) continue;
      const spec = makeSpec(rng, tier, w, d);
      spec.floors = tier === 1 ? rng.int(1, 2) : 1;
      spec.ground = 'plain';
      spec.balconies = 'none';
      spec.dormers = 0;
      spec.courtyard = false;
      const info = world.placeBuilding(spec, x, z, rot, rng.fork(`f${fill}`), { coarse: tier === 3 });
      if (info) { done = true; fill++; }
    }
  }
  console.info(`[city] placed ${placed} street buildings + ${fill} infill, skipped ${skipped}`);
  world.stats.buildings = placed;
}

function makeSpec(rng, tier, w, d) {
  const style = rng.pick(STYLES);
  const floors = tier === 1 ? rng.int(1, 3) : rng.int(1, 3);
  const base = {
    w, d, floors,
    groundH: rng.range(4.0, 4.8), floorH: rng.range(3.3, 3.9),
    wall: rng.pick(WALLS), trim: rng.pick(TRIMS), roof: rng.pick(ROOFS),
    style, s: tier === 1 ? 0.5 : tier === 2 ? 1.0 : 2.0,
    simple: tier > 1,
    pitch: rng.range(0.8, 1.05),
    hip: rng() < 0.35,
    chimneys: rng.int(1, 3),
    litChance: 0.35,
    lamps: false,
  };
  if (tier === 1) {
    base.ground = rng.pick(['shops', 'shops', 'arcade', 'plain', 'gate']);
    base.balconies = rng.pick(['none', 'none', 'center', 'alternate']);
    base.pilasters = style === 'neoclassical' && rng() < 0.7;
    base.dormers = rng() < 0.5 ? rng.int(1, 3) : 0;
    base.rustication = rng() < 0.3;
    if (rng() < 0.25) base.attic = true;
    if (w >= 22 && d >= 24 && rng() < 0.5) base.courtyard = true;
  } else {
    base.dormers = 0;
    base.bayW = 3.6;
    base.singleRoof = d < 22;
  }
  return base;
}

// ---------------------------------------------------------------- terrain
const RIVER_Z = (x) => -452 + 22 * Math.sin(x / 260) + 8 * Math.sin(x / 90 + 1.2);

export function paintRiver(world) {
  const g = world.outerGround;
  const ids = world.groundIds;
  const P = world.palette;
  const bank = P.get('#6f7a55', 'grass');
  const bed = P.get('#5d6660', 'stone');
  const wall = P.get('#8b8677', 'stone');
  g.forRect(-560, -560, 560, -320, (i, cx, cz) => {
    const dz = cz - RIVER_Z(cx);
    const a = Math.abs(dz);
    const m = g.mat[i];
    const isRoad = m === ids.road || m === ids.roadOuter || m === ids.sidewalk;
    if (a < 24) {
      if (isRoad) { g.wallMat[i] = wall; return; } // bridges carry the streets over
      g.h[i] = Math.round((elevation(cx, cz) - 3.5) / g.hq);
      g.mat[i] = bed;
      g.wallMat[i] = wall;
      g.water[i] = Math.round((elevation(cx, cz) - 1.0) / g.hq);
    } else if (a < 34 && !isRoad && world.occ.get(cx, cz) === OCC.FREE) {
      g.mat[i] = bank;
      world.occ.set(cx, cz, OCC.GREEN);
    }
  });
  // reserve the river in occupancy so nothing is built across it
  for (let x = -560; x < 560; x += 1) for (let z = RIVER_Z(x) - 26; z < RIVER_Z(x) + 26; z += 1) if (world.occ.get(x, z) !== OCC.ROAD) world.occ.set(x, z, OCC.RESERVED);
}

/** Hill height (m) at world position, beyond the flat valley floor. */
export function hillHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = elevation(x, z);
  // valley floor stays flat-ish, hills rise with distance
  const south = smooth(700, 2500, z);            // Feleac ridge to the south
  const north = smooth(-900, -2300, z);          // hills north of the Someș
  const east = smooth(1300, 2500, x) * 0.5;
  const west = smooth(-1200, -2500, x) * 0.6;
  h += 260 * south + 150 * north + 90 * east + 110 * west;
  // Cetățuia: the near hill NW of the centre across the river
  const cx = -330, cz = -760;
  h += 62 * Math.exp(-(((x - cx) / 300) ** 2 + ((z - cz) / 170) ** 2));
  // Hoia / Sf. Gheorghe hills further north-west
  h += 80 * Math.exp(-(((x + 1400) / 900) ** 2 + ((z + 1300) / 500) ** 2));
  const n = fbm2(x / 520, z / 520, 4, 77) * 22 + fbm2(x / 130, z / 130, 3, 91) * 5;
  const hillAmount = Math.min(1, (south + north + east + west) * 1.6 + 0.15);
  h += n * hillAmount;
  if (r < 620) h = elevation(x, z);
  return h;
}
function smooth(a, b, t) {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

export function buildHills(world) {
  const P = world.palette;
  const M = {
    urban: P.get('#b4ad9e', 'pave'),
    field: P.get('#93a05e', 'grass'),
    fieldB: P.get('#a9ad68', 'grass'),
    meadow: P.get('#7f9a55', 'grass'),
    forest: P.get('#3e6238', 'leaf'),
    forestB: P.get('#4a7042', 'leaf'),
    resid: P.get('#c9bfa8', 'pave'),
    rock: P.get('#8d8779', 'stone'),
    water: P.get('#5f7a8a', 'water'),
  };
  const cell = 12;
  const half = 2400;
  const g = new Ground({ cell, hq: 1.0, x0: -half, z0: -half, nx: (2 * half) / cell, nz: (2 * half) / cell, defaultMat: M.field });
  g.hole = { x0: -560, z0: -560, x1: 560, z1: 560 };
  const zone = new Uint8Array(g.nx * g.nz); // 0 field, 1 urban, 2 forest, 3 residential
  for (let ix = 0; ix < g.nx; ix++) {
    for (let iz = 0; iz < g.nz; iz++) {
      const cx = g.x0 + (ix + 0.5) * cell, cz = g.z0 + (iz + 0.5) * cell;
      const i = g.idx(ix, iz);
      const h = hillHeight(cx, cz);
      g.h[i] = Math.round(h / g.hq);
      const r = Math.hypot(cx, cz * 1.15);
      const n = fbm2(cx / 380 + 3, cz / 380 - 2, 3, 5);
      const hillness = Math.max(0, h - elevation(cx, cz)) / 120;
      let mat = M.field, zn = 0;
      if (r < 900) { mat = M.urban; zn = 1; }
      else if (hillness > 0.35 && n > -0.1) { mat = n > 0.35 ? M.forestB : M.forest; zn = 2; }
      else if (r < 1700 && n < 0.15 && hillness < 0.6) { mat = M.resid; zn = 3; }
      else if (n > 0.2) mat = M.meadow;
      else if (n < -0.4) mat = M.fieldB;
      if (hillness > 1.6) mat = M.rock;
      // river continues beyond the inner zone
      if (Math.abs(cz - RIVER_Z(cx)) < 26 && Math.abs(cz) > 560 - 30 && Math.abs(cx) < 2300) { mat = M.rock; g.h[i] = Math.round((elevation(cx, cz) - 3.5) / g.hq); g.water[i] = Math.round((elevation(cx, cz) - 1) / g.hq); zn = 0; }
      if (Math.abs(cz - RIVER_Z(cx)) < 26 && Math.abs(cx) > 560 && Math.abs(cx) < 2300 && Math.abs(cz) < 560 + 40) { mat = M.rock; g.h[i] = Math.round((elevation(cx, cz) - 3.5) / g.hq); g.water[i] = Math.round((elevation(cx, cz) - 1) / g.hq); zn = 0; }
      g.mat[i] = mat;
      g.wallMat[i] = mat === M.rock ? M.rock : mat;
      zone[i] = zn;
    }
  }
  g.mesh(P, world.coarseSink, (cls, x, z) => `${cls}|far`);
  world.hillGround = g;

  // ---- scatter: dense urban ring, hillside neighbourhoods, forest clumps (instanced unit prototypes) ----
  const rng = world.rng.fork('hills');
  const houses = [], roofs = [], hips = [], blobs = [], trunks = [];
  const wallCols = ['#dccbb0', '#e6d9b8', '#d9c7a6', '#cfc4b0', '#e2d0b0', '#d3c3a4', '#c9c0ad'];
  const roofCols = ['#a94a2b', '#8f4a30', '#b5532f', '#9c4a2c', '#7f3d29', '#c0603a'];
  const leafCols = ['#3a5c34', '#456b3c', '#5a7f44', '#3f6a3a'];
  const heightAt = (x, z) => {
    const ix = g.toIx(x), iz = g.toIz(z);
    if (!g.inBounds(ix, iz)) return null;
    return { y: g.h[g.idx(ix, iz)] * g.hq, zn: zone[g.idx(ix, iz)] };
  };
  // urban ring 560..980 m: contiguous rows of 3-5 storey houses along jittered axes
  for (let k = 0; k < 6500; k++) {
    const ang = rng() * Math.PI * 2;
    const r = 572 + rng() * 430;
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r * 0.95;
    if (Math.abs(x) < 560 && Math.abs(z) < 560) continue;
    const t = heightAt(x, z);
    if (!t || t.zn === 0 && r > 900) continue;
    if (Math.abs(z - RIVER_Z(x)) < 40) continue;
    const w = rng.range(14, 34), d = rng.range(11, 18), h = rng.range(9, 16);
    const rot = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2) + rng.range(-0.25, 0.25);
    houses.push({ x, y: t.y - 1, z, rot, sx: w, sy: h + 1, sz: d, color: rng.pick(wallCols) });
    (rng() < 0.7 ? roofs : hips).push({ x, y: t.y + h, z, rot, sx: w + 1, sy: d * 0.32, sz: d + 1, color: rng.pick(roofCols) });
  }
  // hillside neighbourhoods and forest
  for (let k = 0; k < 14000; k++) {
    const x = rng.range(-half, half), z = rng.range(-half, half);
    if (Math.abs(x) < 560 && Math.abs(z) < 560) continue;
    const t = heightAt(x, z);
    if (!t) continue;
    if (t.zn === 3 && rng() < 0.6) {
      const w = rng.range(8, 14), d = rng.range(7, 11), h = rng.range(5, 8);
      const rot = rng() * Math.PI;
      houses.push({ x, y: t.y - 1, z, rot, sx: w, sy: h + 1, sz: d, color: rng.pick(wallCols) });
      (rng() < 0.6 ? roofs : hips).push({ x, y: t.y + h, z, rot, sx: w + 1, sy: d * 0.35, sz: d + 1, color: rng.pick(roofCols) });
    } else if (t.zn === 2 && rng() < 0.55) {
      const r = rng.range(7, 13);
      blobs.push({ x, y: t.y + r * 0.55, z, rot: rng() * 3, sx: r * 1.3, sy: r, sz: r * 1.3, color: rng.pick(leafCols) });
    } else if (t.zn === 0 && rng() < 0.04) {
      const r = rng.range(6, 10);
      blobs.push({ x, y: t.y + r * 0.55, z, rot: rng() * 3, sx: r * 1.2, sy: r, sz: r * 1.2, color: rng.pick(leafCols) });
    }
  }
  const proto = world.protos;
  const MM = world.materials;
  world.addInstanced(proto.cube, MM.wall, houses, { castShadow: false });
  world.addInstanced(proto.wedge, MM.roof, roofs, { castShadow: false });
  world.addInstanced(proto.hip, MM.roof, hips, { castShadow: false });
  world.addInstanced(proto.blob, MM.leaf, blobs, { castShadow: false });
  // distant modern apartment blocks in clusters (never near the square)
  const clusters = [
    { x: 1250, z: 520, n: 14, spread: 260 },   // Gheorgheni
    { x: 900, z: -720, n: 12, spread: 220 },  // Mărăști
    { x: -1350, z: 460, n: 16, spread: 300 }, // Mănăștur
    { x: -1250, z: -260, n: 8, spread: 200 }, // Grigorescu
    { x: 350, z: 1150, n: 7, spread: 180 },   // Zorilor
  ];
  const blocks = [], bands = [];
  for (const c of clusters) {
    for (let k = 0; k < c.n; k++) {
      const bx = c.x + rng.range(-c.spread, c.spread), bz = c.z + rng.range(-c.spread, c.spread);
      const t = heightAt(bx, bz);
      if (!t) continue;
      const long = rng() < 0.5;
      const w = long ? rng.range(40, 70) : rng.range(18, 26), d = long ? rng.range(12, 16) : rng.range(18, 26);
      const h = rng.range(28, 44);
      const rot = rng.range(-0.3, 0.3);
      blocks.push({ x: bx, y: t.y - 2, z: bz, rot, sx: w, sy: h + 2, sz: d, color: rng.pick(['#c9c6bf', '#b7b4ad', '#d6d2c8', '#e0dcd0']) });
      for (let fy = t.y + 4; fy < t.y + h - 3; fy += 6) bands.push({ x: bx, y: fy, z: bz, rot, sx: w + 0.3, sy: 2, sz: d + 0.3, color: '#3b4048' });
    }
  }
  world.addInstanced(proto.cube, MM.wall, blocks, { castShadow: false });
  world.addInstanced(proto.cube, MM.dark, bands, { castShadow: false });
  const trees = blobs.length;
  console.info(`[hills] ${houses.length} far houses, ${trees} forest clumps, ${blocks.length} blocks`);
}

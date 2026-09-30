// Ground tiles: continuous solid voxel ground. City tiers rasterise the plan's
// ground features (plaza, roads, curbs, grass...); outer tiers generate the
// Transylvanian basin terrain (Someș valley, hills, forests, suburbs).

import { MatTable, POOL, LAYER } from '../core/mat.js';
import { GROUND } from '../core/palette.js';
import { meshHeightfield } from '../core/hfmesher.js';
import { fbm2, noise2, hash01, smoothstep } from '../core/rng.js';

export function groundMats(mats) {
  const G = GROUND;
  const t = {
    plaza: mats.pave(G.plaza, LAYER.plaza),
    plaza2: mats.pave(G.plaza2, LAYER.plaza),
    band: mats.pave(G.plazaBand, LAYER.plaza),
    road: mats.pave(G.road, LAYER.road),
    asphalt: mats.pave(G.asphalt, LAYER.asphalt),
    curb: mats.stone(G.curb, LAYER.curb),
    walk: mats.pave(G.sidewalk, LAYER.sidewalk),
    grass: mats.veg(G.grass, LAYER.grass),
    grass2: mats.veg(G.grassDark, LAYER.grass),
    path: mats.pave(G.path, LAYER.path),
    yard: mats.pave(G.yard, LAYER.yard),
    soil: mats.stone(G.soil, LAYER.soil),
    basin: mats.pave(G.basin, LAYER.basin),
    zebraX: mats.pave('#dedbd4', LAYER.zebraX),
    zebraZ: mats.pave('#dedbd4', LAYER.zebraZ),
    step: mats.stone('#d8d1c2', LAYER.stone),
    wet: mats.pave('#aaa498', LAYER.plaza),
    pit: mats.stone('#7a705f', LAYER.stone),
    gravel: mats.pave('#756b5c', LAYER.gravel),
    // terrain
    meadow: mats.veg('#7f9152', LAYER.grass),
    meadow2: mats.veg('#8d9a5c', LAYER.grass),
    field: mats.veg('#a39b64', LAYER.grass),
    forest: mats.veg('#4a6334', LAYER.forest),
    forest2: mats.veg('#566f3a', LAYER.forest),
    roofA: mats.roof('#b25a38', LAYER.roof),
    roofB: mats.roof('#9d4f33', LAYER.roof),
    roofC: mats.roof('#c06a43', LAYER.roof),
    roofG: mats.metal('#6f7174', LAYER.metalroof),
    wallT: mats.plaster('#d9ccb0'),
    roofAs: mats.roof('#8a4a33', LAYER.roof),
    roofBs: mats.roof('#7d4330', LAYER.roof),
    roofCs: mats.roof('#955638', LAYER.roof),
    roofGs: mats.metal('#57595c', LAYER.metalroof),
    river: mats.water('#5a7682'),
    bank: mats.stone('#8f8a78', LAYER.stone),
    rail: mats.pave('#7a7064', LAYER.gravel),
    yardT: mats.pave('#8d887c', LAYER.yard),
  };
  return t;
}

// ---------------------------------------------------------------- city tiles
export function buildGroundTile(job) {
  const { x0, z0, nx, nz, res, hres } = job;
  const mats = new MatTable();
  const T = groundMats(mats);
  const W = nx + 2, N = W * (nz + 2);
  const H = new Int16Array(N), M = new Uint16Array(N), V = new Uint8Array(N), O = new Uint8Array(N);
  const hq = (m) => Math.round(m / hres);
  // base fill
  M.fill(T[job.baseMat || 'yard']);
  H.fill(hq(job.baseH ?? 0.25));
  // column centre coordinates (with margin)
  const cxA = new Float32Array(W), czA = new Float32Array(nz + 2);
  for (let i = 0; i < W; i++) cxA[i] = x0 + (i - 1 + 0.5) * res;
  for (let j = 0; j < nz + 2; j++) czA[j] = z0 + (j - 1 + 0.5) * res;
  const xmin = x0 - res, xmax = x0 + (nx + 1) * res, zmin = z0 - res, zmax = z0 + (nz + 1) * res;
  const iRange = (a, b) => [Math.max(0, Math.floor((a - xmin) / res)), Math.min(W - 1, Math.ceil((b - xmin) / res))];
  const jRange = (a, b) => [Math.max(0, Math.floor((a - zmin) / res)), Math.min(nz + 1, Math.ceil((b - zmin) / res))];
  const dist = new Float32Array(N);

  for (const f of job.features) {
    switch (f.t) {
      case 'rect': {
        if (f.x1 < xmin || f.x0 > xmax || f.z1 < zmin || f.z0 > zmax) break;
        const [ia, ib] = iRange(f.x0, f.x1), [ja, jb] = jRange(f.z0, f.z1);
        const m = f.mat ? T[f.mat] : 0, h = f.h !== undefined ? hq(f.h) : null;
        for (let j = ja; j <= jb; j++) {
          const z = czA[j];
          if (z < f.z0 || z >= f.z1) continue;
          for (let i = ia; i <= ib; i++) {
            const x = cxA[i];
            if (x < f.x0 || x >= f.x1) continue;
            const c = j * W + i;
            if (f.void) { V[c] = 1; continue; }
            if (f.occ) { O[c] = 1; continue; }
            if (f.onlyMat && M[c] !== T[f.onlyMat]) continue;
            if (m) M[c] = f.alt && ((Math.floor(x / f.alt) + Math.floor(z / f.alt)) & 1) ? T[f.altMat] : m;
            if (h !== null) H[c] = f.add ? H[c] + h : h;
          }
        }
        break;
      }
      case 'orect': {
        // oriented rectangle: centre (cx,cz), unit axis (ux,uz), half extents hw (along u), hd (along v)
        const r = Math.hypot(f.hw, f.hd);
        if (f.cx + r < xmin || f.cx - r > xmax || f.cz + r < zmin || f.cz - r > zmax) break;
        const [ia, ib] = iRange(f.cx - r, f.cx + r), [ja, jb] = jRange(f.cz - r, f.cz + r);
        const m = f.mat ? T[f.mat] : 0, h = f.h !== undefined ? hq(f.h) : null;
        for (let j = ja; j <= jb; j++) {
          for (let i = ia; i <= ib; i++) {
            const dx = cxA[i] - f.cx, dz = czA[j] - f.cz;
            const a = dx * f.ux + dz * f.uz, b = -dx * f.uz + dz * f.ux;
            if (Math.abs(a) > f.hw || Math.abs(b) > f.hd) continue;
            const c = j * W + i;
            if (f.occ) { O[c] = 1; continue; }
            if (m) M[c] = m;
            if (h !== null) H[c] = h;
          }
        }
        break;
      }
      case 'circle': {
        const [ia, ib] = iRange(f.x - f.r, f.x + f.r), [ja, jb] = jRange(f.z - f.r, f.z + f.r);
        const m = T[f.mat], h = f.h !== undefined ? hq(f.h) : null;
        for (let j = ja; j <= jb; j++) for (let i = ia; i <= ib; i++) {
          if ((cxA[i] - f.x) ** 2 + (czA[j] - f.z) ** 2 > f.r * f.r) continue;
          const c = j * W + i;
          M[c] = m;
          if (h !== null) H[c] = h;
        }
        break;
      }
      case 'street': {
        const hw = f.w / 2;
        let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
        for (const [px, pz] of f.pts) { bx0 = Math.min(bx0, px); bx1 = Math.max(bx1, px); bz0 = Math.min(bz0, pz); bz1 = Math.max(bz1, pz); }
        if (bx1 + hw < xmin || bx0 - hw > xmax || bz1 + hw < zmin || bz0 - hw > zmax) break;
        const [ia, ib] = iRange(bx0 - hw, bx1 + hw), [ja, jb] = jRange(bz0 - hw, bz1 + hw);
        for (let j = ja; j <= jb; j++) dist.fill(1e9, j * W + ia, j * W + ib + 1);
        for (let s = 0; s < f.pts.length - 1; s++) {
          const [ax, az] = f.pts[s], [bx, bz] = f.pts[s + 1];
          const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
          const [sa, sb] = iRange(Math.min(ax, bx) - hw, Math.max(ax, bx) + hw);
          const [ta, tb] = jRange(Math.min(az, bz) - hw, Math.max(az, bz) + hw);
          for (let j = ta; j <= tb; j++) for (let i = sa; i <= sb; i++) {
            const px = cxA[i] - ax, pz = czA[j] - az;
            let t = (px * dx + pz * dz) / L2;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const ex = px - dx * t, ez = pz - dz * t;
            const d = Math.sqrt(ex * ex + ez * ez);
            const c = j * W + i;
            if (d < dist[c]) dist[c] = d;
          }
        }
        const walk = f.walk ?? 3;
        const roadHalf = hw - walk;
        const curbW = res <= 0.26 ? 0.25 : res;
        const wl = hq(0.25);
        for (let j = ja; j <= jb; j++) for (let i = ia; i <= ib; i++) {
          const c = j * W + i;
          const d = dist[c];
          if (d > hw) continue;
          if (f.kind === 'ped') {
            M[c] = d > hw - curbW * 2 ? T.band : T.walk;
            H[c] = wl;
            continue;
          }
          if (f.kind === 'boulevard') {
            // central promenade | roadway | curb | sidewalk
            const prom = f.prom ?? 4.5;
            if (d < prom) { M[c] = d > prom - curbW ? T.curb : ((Math.floor(cxA[i] / 2.4) + Math.floor(czA[j] / 2.4)) & 1 ? T.plaza : T.plaza2); H[c] = wl; }
            else if (d < hw - walk) { M[c] = T.asphalt; H[c] = 0; }
            else if (d < hw - walk + curbW) { M[c] = T.curb; H[c] = wl; }
            else { M[c] = T.walk; H[c] = wl; }
            continue;
          }
          if (d < roadHalf) { M[c] = f.asphalt ? T.asphalt : T.road; H[c] = 0; }
          else if (d < roadHalf + curbW) { M[c] = T.curb; H[c] = wl; }
          else { M[c] = T.walk; H[c] = wl; }
        }
        break;
      }
      case 'gardens': {
        // courtyard gardens and trees' lawns inside the blocks
        for (let j = 0; j < nz + 2; j++) for (let i = 0; i < W; i++) {
          const c = j * W + i;
          if (M[c] !== T.yard || O[c]) continue;
          const x = cxA[i], z = czA[j];
          const n = fbm2(x / 34, z / 34, 5, 2);
          if (n > 0.55) M[c] = T.grass2;
        }
        break;
      }
      default: break;
    }
  }
  const side = new Uint16Array(mats.pool.length + 8);
  side[T.grass] = T.curb; side[T.grass2] = T.curb;
  side[T.plaza] = T.step; side[T.plaza2] = T.step; side[T.band] = T.step;
  side[T.walk] = T.curb; side[T.yard] = T.curb; side[T.basin] = T.curb; side[T.wet] = T.curb;
  side[T.pit] = T.pit; side[T.gravel] = T.pit;
  const geo = meshHeightfield({ nx, nz, x0, z0, res, hres, H, M, V, O, mats, side, gx0: Math.round(x0 / res), gz0: Math.round(z0 / res), base: hq(-6) });
  return { geo };
}

// ---------------------------------------------------------------- terrain
// Heights (m) of the broader Cluj basin. City core is flat at 0.
export function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  const ang = Math.atan2(z, x); // 0 = east, +pi/2 = south
  // directional hill strength: Feleac (south) highest, Hoia (west) and northern hills, flatter east valley
  const south = Math.max(0, Math.sin(ang));
  const north = Math.max(0, -Math.sin(ang));
  const west = Math.max(0, -Math.cos(ang));
  const strength = 0.35 + 1.5 * south * south + 0.75 * north + 0.6 * west * west;
  let h = smoothstep(650, 3200, r) * 140 * strength;
  h += smoothstep(700, 2600, r) * (fbm2(x / 900, z / 900, 7, 4) - 0.45) * 90;
  // Cetățuia hill (north-west, across the river)
  const cd = Math.hypot(x + 380, z + 760);
  h += 72 * Math.exp(-(cd * cd) / (2 * 170 * 170));
  // Someș valley
  const rz = riverZ(x);
  const dv = Math.abs(z - rz);
  const valley = 1 - smoothstep(30, 380, dv);
  h = h * (1 - 0.8 * valley) - 3 * valley;
  return h;
}

export function riverZ(x) { return -560 + 40 * Math.sin(x / 330) + 25 * Math.sin(x / 120 + 1.3); }

const DISTRICTS = [
  { x: -1900, z: 1250, r: 900, blocks: 0.55 },  // Mănăștur
  { x: 1700, z: 450, r: 700, blocks: 0.5 },     // Gheorgheni
  { x: 1450, z: -950, r: 650, blocks: 0.45 },   // Mărăști
  { x: -1700, z: -250, r: 550, blocks: 0.35 },  // Grigorescu
  { x: 100, z: 1650, r: 700, blocks: 0.4 },     // Zorilor
];
export const APARTMENT_DISTRICTS = DISTRICTS;

// Kind of land at (x,z): returns {m, add} where add is extra structure height (m)
function landAt(x, z, h, T, res = 4) {
  const r = Math.hypot(x, z);
  const rz = riverZ(x);
  const dv = Math.abs(z - rz);
  if (res <= 10) {
    if (dv < 18) return { m: T.river, add: 0, water: true };
    if (dv < 24) return { m: T.bank, add: 0 };
  }
  // urban density falls off with distance, suburbs climb the lower hill slopes
  let urban = 1 - smoothstep(900, 2300, r);
  for (const d of DISTRICTS) urban = Math.max(urban, 0.85 * (1 - smoothstep(d.r * 0.5, d.r, Math.hypot(x - d.x, z - d.z))));
  urban *= 1 - smoothstep(120, 210, h);
  urban *= 1 - Math.exp(-((x + 380) ** 2 + (z + 760) ** 2) / (2 * 190 * 190)) * 0.95;
  const n = fbm2(x / 420, z / 420, 21, 3);
  // forest on the higher slopes and in the west (Hoia) / south (Făget)
  let forest = smoothstep(70, 130, h + (n - 0.5) * 60);
  forest = Math.max(forest, (1 - smoothstep(500, 900, Math.hypot(x + 2600, z + 700))) * 0.95);
  forest = Math.max(forest, (1 - smoothstep(600, 1100, Math.hypot(x - 300, z - 3200))) * 0.9);
  // Cetățuia slopes are wooded
  forest = Math.max(forest, Math.exp(-((x + 380) ** 2 + (z + 760) ** 2) / (2 * 170 * 170)));
  const hsh = hash01(Math.floor(x / 24), Math.floor(z / 24), 3);
  if (urban > 0.25 && urban + (n - 0.5) * 0.6 > 0.35) {
    // warped street grid so the distant fabric is irregular
    const wx = x + (fbm2(x / 260, z / 260, 31, 2) - 0.5) * 70, wz = z + (fbm2(x / 260 + 9, z / 260, 37, 2) - 0.5) * 70;
    const gx = ((wx % 70) + 70) % 70, gz = ((wz % 62) + 62) % 62;
    if (gx < 8 || gz < 8) return { m: T.asphalt, add: 0 };
    const bx = Math.floor(wx / 23), bz = Math.floor(wz / 20.6);
    const park = fbm2(x / 180, z / 180, 41, 2);
    if (park > 0.64) return { m: park > 0.7 ? T.forest2 : T.meadow, add: park > 0.7 ? 7 : 0 };
    // courtyards inside blocks
    if (gx > 26 && gx < 52 && gz > 24 && gz < 46 && hash01(bx, bz, 17) < 0.7) return { m: hash01(bx, bz, 3) < 0.5 ? T.meadow2 : T.yardT, add: 0 };
    const bh = 5 + Math.floor(hash01(bx, bz, 9) * 4) * 2.6 * (1 - smoothstep(1200, 2400, r) * 0.5);
    const rs = hash01(bx, bz, 5);
    return { m: rs < 0.38 ? T.roofA : rs < 0.64 ? T.roofB : rs < 0.88 ? T.roofC : T.roofG, add: bh, roof: true };
  }
  if (forest > 0.5 && (n > 0.3 || forest > 0.8)) return { m: n > 0.55 ? T.forest : T.forest2, add: 8 + Math.round(fbm2(x / 90, z / 90, 13, 2) * 3) * 2 };
  if (n > 0.62) return { m: T.field, add: 0 };
  return { m: hsh < 0.5 ? T.meadow : T.meadow2, add: 0 };
}

export function buildTerrainTile(job) {
  const { x0, z0, nx, nz, res, hres, hole } = job;
  const mats = new MatTable();
  const T = groundMats(mats);
  const W = nx + 2, N = W * (nz + 2);
  const H = new Int16Array(N), M = new Uint16Array(N), V = new Uint8Array(N), O = new Uint8Array(N);
  for (let j = 0; j < nz + 2; j++) {
    const z = z0 + (j - 1 + 0.5) * res;
    for (let i = 0; i < W; i++) {
      const x = x0 + (i - 1 + 0.5) * res;
      const c = j * W + i;
      if (hole && x > hole.x0 && x < hole.x1 && z > hole.z0 && z < hole.z1) { V[c] = 1; continue; }
      const h = terrainHeight(x, z);
      const L = landAt(x, z, h, T, res);
      M[c] = L.m;
      H[c] = Math.round((h + (L.water ? -1.5 : 0) + L.add) / hres);
    }
  }
  const side = new Uint16Array(mats.pool.length + 8);
  side[T.roofA] = T.roofAs; side[T.roofB] = T.roofBs; side[T.roofC] = T.roofCs; side[T.roofG] = T.roofGs;
  side[T.meadow] = T.soil; side[T.meadow2] = T.soil; side[T.field] = T.soil;
  const geo = meshHeightfield({ nx, nz, x0, z0, res, hres, H, M, V, O, mats, side, gx0: Math.round(x0 / res), gz0: Math.round(z0 / res), base: Math.round(-40 / hres) });
  return { geo };
}

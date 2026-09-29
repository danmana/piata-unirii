/* Piata Unirii — Zone D: the old-town street fabric. Street-aligned lots are allocated on the occupancy grid
   (reserve footprint -> collision test -> keep street frontage -> skip after 10 failed attempts), then meshed into
   spatial tiles with three distance LODs (0.5 m, 1 m, 2 m voxels). */
(function () {
  'use strict';
  const PU = window.PU;
  const L = PU.L, M = PU.M, B = PU.B, VG = PU.VoxelGrid;

  const WALLS = ['cream', 'cream', 'paleYellow', 'paleYellow', 'beige', 'beige', 'dustyPink', 'palePink', 'paleGreen', 'softGrey', 'ochre', 'lightOchre', 'sand', 'mint', 'paleBlueGrey', 'salmon', 'fadedGreen', 'darkCream', 'whitePlaster', 'lilacGrey'];
  const ROOFS = ['roofOrange', 'roofOrange', 'roofTerra', 'roofTerra', 'roofRed', 'roofRust', 'roofLight', 'roofBrown', 'roofOrange', 'roofTerra', 'slateRoof'];
  const GLASSES = [M.glassDay, M.glassDay2, M.glassDay3, M.glassDay, M.glassLit];

  /* light-weight building at voxel size vs (>= 1) */
  function simpleBuilding(o, vs) {
    const rng = new PU.RNG(o.seed);
    const w = Math.max(vs * 3, Math.round(o.w / vs) * vs), d = Math.max(vs * 3, Math.round(o.d / vs) * vs);
    const fh = 3.2;
    const H = Math.max(vs * 2, Math.round((o.floors * fh + 0.6) / vs) * vs);
    const found = o.found || 4;
    const g = VG.box(-vs, -found, -vs, w + vs, H + 12, d + vs, vs);
    const wall = M[o.wall], roofMats = PU.roofSet(o.roofMat);
    g.fill(0, -found, 0, w, H, d, wall);
    if (vs <= 1) {
      g.fill(0, 0, 0, w, vs, d, M.basement, 2);
      // window rows on all four faces
      for (let f = 0; f < o.floors; f++) {
        const yv = Math.round((f * fh + 1.0) / vs) * vs;
        if (yv + vs > H - vs) continue;
        for (let x = vs; x + vs <= w - vs + 0.01; x += vs * 3) {
          const gl = GLASSES[Math.floor(rng.f() * GLASSES.length)];
          g.fill(x, yv, 0, x + vs, yv + vs, vs, gl, 0);
          if (f === 0 || o.floors > 1) g.fill(x, yv, d - vs, x + vs, yv + vs, d, GLASSES[Math.floor(rng.f() * GLASSES.length)], 0);
        }
        for (let z = vs * 2; z + vs <= d - vs + 0.01; z += vs * 3) {
          g.fill(0, yv, z, vs, yv + vs, z + vs, GLASSES[Math.floor(rng.f() * GLASSES.length)], 0);
          g.fill(w - vs, yv, z, w, yv + vs, z + vs, GLASSES[Math.floor(rng.f() * GLASSES.length)], 0);
        }
      }
      if (o.shop) g.fill(vs, vs, 0, w - vs, vs * 2, vs, rng.pick([M.signCream, M.awnRed, M.awnGreen, M.signBlue]), 0);
    }
    // roof
    const kind = o.roofKind;
    const zA = -0.5 * vs, zB = d + 0.5 * vs, xA = -0.5 * vs, xB = w + 0.5 * vs;
    const nr = d > 15 && kind === 'gable' ? 2 : 1;
    const sub = (zB - zA) / nr;
    const ry = (x, z) => {
      if (kind === 'gable') {
        const zz = (z - zA) % sub;
        return H + Math.min(6, 0.85 * Math.min(zz, sub - zz));
      }
      if (kind === 'gablePerp') return H + Math.min(6.5, 0.9 * Math.min(x - xA, xB - x));
      return H + Math.min(6.5, 0.75 * Math.min(z - zA, zB - z, x - xA, xB - x));
    };
    const seedB = o.seed & 255;
    B.columns(g, xA, zA, xB, zB, H - vs, (x, z, oo) => {
      const yt = ry(x, z);
      oo.top = yt;
      const band = Math.floor((yt - H) / Math.max(0.5, vs * 0.5));
      oo.mat = B.bandMat(roofMats, band, kind === 'gablePerp' ? z : x, seedB);
      if (kind === 'gable' && (x < vs * 0.5 || x > w - vs * 0.5)) oo.mat = wall;
      if (kind === 'gablePerp' && z < vs * 0.5) oo.mat = wall;
      return true;
    });
    if (vs <= 1 && o.chimney) {
      const cx = Math.round((w * (0.25 + rng.f() * 0.5)) / vs) * vs, cz = Math.round((d * 0.5) / vs) * vs;
      const y = ry(cx, cz);
      g.fill(cx, y - vs, cz, cx + vs, y + vs * 2.5, cz + vs, M.brick, 0);
    }
    return g;
  }

  PU.simpleBuilding = simpleBuilding;

  PU.buildCity = function (renderer, emit) {
    const g = L.grid;
    const rng = new PU.RNG((PU.SEED | 0) + 7);
    const list = [];
    const T = L.T;
    const R = (x, z) => Math.hypot(x, z);

    /* ---- nearest-street tangent lookup (for infill orientation) ---- */
    const samples = [];
    const hash = new Map();
    const HK = 48;
    for (const s of L.streets) {
      for (let i = 0; i < s.pts.length - 1; i++) {
        const a = s.pts[i], b = s.pts[i + 1];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(1, Math.round(len / 8));
        for (let k = 0; k < n; k++) {
          const t = k / n;
          const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
          const rec = [x, z, (b[0] - a[0]) / len, (b[1] - a[1]) / len, s];
          samples.push(rec);
          const key = Math.floor(x / HK) + ',' + Math.floor(z / HK);
          let arr = hash.get(key);
          if (!arr) hash.set(key, (arr = []));
          arr.push(rec);
        }
      }
    }
    const nearest = (x, z) => {
      let best = null, bd = 1e9;
      const cx = Math.floor(x / HK), cz = Math.floor(z / HK);
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) {
          const arr = hash.get(cx + dx + ',' + (cz + dz));
          if (!arr) continue;
          for (const r of arr) {
            const d2 = (r[0] - x) * (r[0] - x) + (r[1] - z) * (r[1] - z);
            if (d2 < bd) { bd = d2; best = r; }
          }
        }
      return best;
    };

    const floorsFor = (x, z) => {
      const r = R(x, z);
      if (r < 190) return rng.pick([3, 3, 4, 4, 4, 5]);
      if (r < 340) return rng.pick([2, 3, 3, 3, 4]);
      if (r < 480) return rng.pick([2, 2, 3, 3]);
      return rng.pick([1, 2, 2, 3]);
    };
    const specFor = (cx, cz, hw, hd, yaw, frontage) => {
      const roofKind = rng.chance(0.22) ? 'gablePerp' : rng.chance(0.18) ? 'hip' : 'gable';
      return {
        cx, cz, hw, hd, yaw, frontage,
        floors: floorsFor(cx, cz),
        wall: rng.pick(WALLS),
        roofKind,
        roofMat: rng.pick(ROOFS),
        seed: (rng.f() * 1e9) | 0,
        shop: frontage && R(cx, cz) < 170 && rng.chance(0.6),
        chimney: rng.chance(0.75),
      };
    };
    let attempts = 0, skipped = 0;
    const tryPlace = (cx, cz, hw, hd, yaw, frontage) => {
      attempts++;
      if (!g.rectFree(cx, cz, hw, hd, yaw)) return false;
      g.mark(cx, cz, hw, hd, yaw, T.BUILD);
      list.push(specFor(cx, cz, hw, hd, yaw, frontage));
      return true;
    };

    /* ---- pass 1: street frontage ---- */
    for (const s of L.streets) {
      const pts = [];
      // resample at ~1 m
      for (let i = 0; i < s.pts.length - 1; i++) {
        const a = s.pts[i], b = s.pts[i + 1];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(1, Math.round(len));
        for (let k = 0; k < n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
      }
      pts.push(s.pts[s.pts.length - 1]);
      const N = pts.length;
      const hwStreet = s.w / 2;
      for (const side of [1, -1]) {
        let u = 0;
        let guard = 0;
        while (u < N - 4 && guard++ < 4000) {
          let placed = false;
          let wl = rng.range(8, 17), dl = rng.range(11, 21);
          for (let tr = 0; tr < 10 && !placed; tr++) {
            const um = Math.min(N - 2, Math.floor(u + wl / 2));
            const p = pts[um], q = pts[Math.min(N - 1, um + 2)], p0 = pts[Math.max(0, um - 2)];
            let tx = q[0] - p0[0], tz = q[1] - p0[1];
            const tl = Math.hypot(tx, tz) || 1;
            tx /= tl; tz /= tl;
            const nx = side > 0 ? -tz : tz, nz = side > 0 ? tx : -tx;
            const off = hwStreet + 0.3 + dl / 2;
            const cx = p[0] + nx * off, cz = p[1] + nz * off;
            const yaw = Math.atan2(nx, nz);
            if (tryPlace(cx, cz, wl / 2, dl / 2, yaw, true)) {
              placed = true;
              u += wl + rng.range(0, 0.7);
            } else {
              wl *= 0.86;
              dl *= 0.92;
              if (wl < 5) break;
            }
          }
          if (!placed) {
            skipped++;
            u += 4;
          }
        }
      }
    }
    /* ---- pass 2: infill inside blocks (courtyard buildings) ---- */
    const RMAX = 560;
    for (let i = 0; i < 9000; i++) {
      const a = rng.f() * Math.PI * 2, r = Math.sqrt(rng.f()) * RMAX;
      const x = Math.cos(a) * r * 1.05, z = Math.sin(a) * r * 0.95;
      const cell = g.get(x, z);
      if (cell !== T.FREE && cell !== T.YARD && cell !== T.PARK) continue;
      const nn = nearest(x, z);
      const yaw = nn ? Math.atan2(-nn[3], nn[2]) : 0; // aligned with the nearest street
      let ok = false;
      let hw = rng.range(3.5, 6.5), hd = rng.range(4, 8);
      for (let tr = 0; tr < 10 && !ok; tr++) {
        ok = tryPlace(x, z, hw, hd, yaw, false);
        hw *= 0.88;
        hd *= 0.9;
        if (hw < 2.2) break;
      }
    }
    console.log('[city] buildings ' + list.length + ', placement attempts ' + attempts + ', skipped ' + skipped);

    /* ---- meshing into tiles ---- */
    const TILE = 128;
    const tiles = new Map();
    const getTile = (cx, cz) => {
      const key = Math.floor(cx / TILE) + ',' + Math.floor(cz / TILE);
      let t = tiles.get(key);
      if (!t) {
        t = { key, b: [new PU.GeoBuilder(), new PU.GeoBuilder(), new PU.GeoBuilder()], x0: Math.floor(cx / TILE) * TILE, z0: Math.floor(cz / TILE) * TILE };
        tiles.set(key, t);
      }
      return t;
    };
    const skip = [0, 0, 1, 0, 0, 0];
    let idx = 0;
    for (const s of list) {
      const t = getTile(s.cx, s.cz);
      const y0 = L.baseHeightAt(s.cx, s.cz) + 0.15;
      // local frame: front at z=0 (toward the street), local z away from the street
      const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
      const w = s.hw * 2, d = s.hd * 2;
      // local +x maps to (cos, -sin), local +z to (sin, cos)
      const ox = s.cx - (w / 2) * c - (d / 2) * sn;
      const oz = s.cz + (w / 2) * sn - (d / 2) * c;
      const xf = { x: ox, y: y0, z: oz, yaw: s.yaw };
      const r = R(s.cx, s.cz);
      const spec = { w, d, floors: s.floors, wall: s.wall, roofKind: s.roofKind, roofMat: s.roofMat, seed: s.seed, shop: s.shop, chimney: s.chimney };
      // LOD0: 0.5 m facade for the nearest ring, 1 m elsewhere
      if (r < 170 && s.frontage) {
        const roof = s.roofKind === 'hip' ? 'hip' : s.roofKind === 'gablePerp' ? 'gablePerp' : 'gable';
        const fs = { id: 'c' + idx, w, depth: d, floors: Math.min(s.floors, 5), fh: 3.4, style: rng.pick(['baroque', 'neoclassical', 'eclectic', 'historicist', 'secession']), wall: s.wall, trim: rng.pick(['whiteStone', 'cream', 'ivory']), roof, roofMat: s.roofMat, chimneys: s.chimney ? 1 : 0, dormers: s.floors < 4 && w > 10 ? rng.pick([0, 0, 1, 2]) : 0, shop: s.shop, sideWinL: false, sideWinR: false };
        const fac = PU.buildFacade(fs, { vs: 0.5 });
        PU.meshGrid(fac.grid, t.b[0], { xf, skip });
      } else {
        PU.meshGrid(simpleBuilding(spec, 1), t.b[0], { xf, skip });
      }
      PU.meshGrid(simpleBuilding(spec, 1), t.b[1], { xf, skip });
      PU.meshGrid(simpleBuilding(spec, 2), t.b[2], { xf, skip });
      idx++;
    }
    let ch = 0;
    for (const t of tiles.values()) {
      const lods = [];
      if (!t.b[0].isEmpty()) lods.push({ maxDist: 190, builder: t.b[0] });
      lods.push({ maxDist: 520, builder: t.b[1] });
      lods.push({ maxDist: Infinity, builder: t.b[2] });
      renderer.addChunk({ name: 'city-' + t.key, lods, cast: true });
      ch++;
    }
    PU.cityBuildings = list;
    console.log('[city] tiles ' + ch);
  };
})();

/* Piata Unirii — the wider Cluj basin: land cover, residential neighbourhoods climbing the hills, distant panel-block
   apartments and towers, and a Cetatuia-style hilltop fort. Coarse voxels (LOD 2) merged into large tiles. */
(function () {
  'use strict';
  const PU = window.PU;
  const L = PU.L, M = PU.M, VG = PU.VoxelGrid;

  /* land cover shared by the terrain mesher and the suburb placement */
  PU.landCover = function (x, z) {
    const r = Math.hypot(x, z);
    const n1 = PU.fbm2(x * 0.0019 + 3.1, z * 0.0019 - 7.7, 3, 41);
    const n2 = PU.fbm2(x * 0.0065 - 9.3, z * 0.0065 + 2.2, 3, 43);
    const n3 = PU.hash2(Math.floor(x / 48), Math.floor(z / 48), 51);
    const un = PU.fbm2(x * 0.0014 + 40, z * 0.0014 - 13, 3, 61);
    const h = L.terrainBase(x, z) + L.hillHeight(x, z);
    const thr = 0.4 + 0.24 * PU.smoothstep(700, 2300, r);
    let kind;
    if (r > 500 && r < 2500 && (un > thr || (r < 780 && un > 0.3))) kind = 'urban';
    else {
      const forestBias = PU.smoothstep(900, 2600, r) * 0.3 + (h > 110 ? 0.15 : 0);
      if (n1 + forestBias > 0.66 && r > 800) kind = 'forest';
      else if (n2 > 0.62 && r > 1100) kind = 'field';
      else kind = 'grass';
    }
    let mat, canopy = 0;
    if (kind === 'urban') mat = n3 < 0.45 ? M.grassDk : n3 < 0.8 ? M.courtyard : M.farGrass;
    else if (kind === 'forest') { mat = n2 > 0.6 ? M.forestC : n2 > 0.35 ? M.forestA : M.forestB; canopy = 5 + n2 * 4; }
    else if (kind === 'field') mat = n3 < 0.33 ? M.fieldA : n3 < 0.66 ? M.fieldB : M.fieldC;
    else mat = r < 1500 ? (n3 < 0.4 ? M.grassDk : n3 < 0.75 ? M.farGrass : M.grass) : n3 < 0.5 ? M.farGrass : M.grassDk;
    return { kind, mat, canopy, h };
  };

  /* terrain top height as the hill meshes quantise it (so buildings can sit on the highest column) */
  function terrainTop(x, z) {
    const r = Math.hypot(x, z);
    const h = L.terrainBase(x, z) + L.hillHeight(x, z);
    if (r < 640) return L.baseHeightAt(x, z);
    const ax = Math.abs(x), az = Math.abs(z);
    const q = ax < 1392 && az < 1248 ? 2.5 : ax < 3648 && az < 3456 ? 6 : 14;
    return Math.round(h / q) * q;
  }

  function panelBlock(len, wid, floors) {
    const vs = 1.5;
    const H = floors * 3;
    const g = VG.box(-vs, -12, -vs, len + vs, H + 3, wid + vs, vs);
    g.fill(0, -12, 0, len, H, wid, M.aptWall);
    g.fill(0, H, 0, len, H + 1.5, wid, M.concrete);
    for (let f = 0; f < floors; f++) {
      const y = f * 3 + 1.5;
      for (let x = vs; x < len - vs; x += vs * 4) {
        g.fill(x, y, 0, x + vs * 3, y + vs, vs, M.aptBand, 0);
        g.fill(x, y, wid - vs, x + vs * 3, y + vs, wid, M.aptBand, 0);
      }
    }
    return g;
  }
  function tower(w, d, floors) {
    const vs = 2;
    const H = floors * 4;
    const g = VG.box(-vs, -12, -vs, w + vs, H + 6, d + vs, vs);
    g.fill(0, -12, 0, w, H, d, M.towerGlass);
    for (let f = 0; f < floors; f++) g.fill(0, f * 4 + 3, 0, w, f * 4 + 4, d, M.concrete, 0);
    g.fill(0, H, 0, w, H + 2, d, M.concrete);
    g.fill(w / 2 - 1, H + 2, d / 2 - 1, w / 2 + 1, H + 6, d / 2 + 1, M.iron);
    return g;
  }

  PU.buildSuburbs = function (renderer) {
    const rng = new PU.RNG((PU.SEED | 0) + 909);
    const WALLS = ['cream', 'cream', 'paleYellow', 'beige', 'whitePlaster', 'whitePlaster', 'dustyPink', 'palePink', 'softGrey', 'sand', 'mint', 'paleBlueGrey', 'darkCream', 'lightOchre'];
    const ROOFS = ['roofOrange', 'roofTerra', 'roofRed', 'roofRust', 'roofLight', 'roofBrown', 'roofOrange', 'roofTerra', 'slateRoof'];
    // house template variants
    const tpl = [];
    for (let i = 0; i < 30; i++) {
      const fl = rng.pick([1, 1, 2, 2, 2, 3]);
      const g = PU.simpleBuilding({ w: rng.range(8, 14), d: rng.range(7, 11), floors: fl, wall: rng.pick(WALLS), roofKind: rng.pick(['gable', 'gable', 'hip', 'gablePerp']), roofMat: rng.pick(ROOFS), seed: (rng.f() * 1e9) | 0, chimney: rng.chance(0.5), found: 8 }, 2);
      tpl.push({ b: PU.meshOne(g, { skip: [0, 0, 1, 0, 0, 0] }), w: g.nx * 2, d: g.nz * 2 });
    }
    const TILE = 320;
    const tiles = new Map();
    const tileFor = (x, z) => {
      const key = Math.floor(x / TILE) + ',' + Math.floor(z / TILE);
      let t = tiles.get(key);
      if (!t) { t = { b: new PU.GeoBuilder() }; tiles.set(key, t); }
      return t.b;
    };
    let houses = 0;
    const R0 = 500, R1 = 2450;
    const placeAt = (x, z) => {
      const lc = PU.landCover(x, z);
      if (lc.kind !== 'urban') return false;
      const t = tpl[Math.floor(rng.f() * tpl.length)];
      const cx = Math.floor(x / 190), cz = Math.floor(z / 190);
      const yaw = Math.floor(PU.hash2(cx, cz, 7) * 4) * (Math.PI / 4) * 0.6 + PU.hash2(cx, cz, 8) * 0.25;
      // sit on the highest terrain column under the footprint
      let y = -1e9;
      for (const [ox, oz] of [[0, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) y = Math.max(y, terrainTop(x + ox * t.w * 0.5, z + oz * t.d * 0.5));
      tileFor(x, z).append(t.b, { x: x - t.w / 2 * Math.cos(yaw) - t.d / 2 * Math.sin(yaw), y, z: z + t.w / 2 * Math.sin(yaw) - t.d / 2 * Math.cos(yaw), yaw });
      houses++;
      return true;
    };
    for (let r = R0; r < R1; ) {
      const step = r < 1000 ? 20 : r < 1600 ? 27 : 38;
      // ring of jittered samples at this radius (angular spacing ~ step)
      const n = Math.max(8, Math.floor((Math.PI * 2 * r) / step));
      const rows = r;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3) / n * 2;
        const rr = r + rng.range(-step * 0.4, step * 0.4);
        const x = Math.cos(a) * rr * 1.06, z = Math.sin(a) * rr * 0.96;
        if (Math.abs(x) < 640 && Math.abs(z) < 580 && Math.hypot(x, z) < 600) continue;
        if (rng.chance(r < 1000 ? 0.16 : r < 1600 ? 0.3 : 0.45)) continue;
        placeAt(x, z);
      }
      r += step * 0.9;
    }
    // panel-block clusters (a few, kept far from the square) and towers
    let blocks = 0;
    const clusters = [];
    for (let tries = 0; tries < 600 && clusters.length < 9; tries++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(950, 2000);
      const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.9;
      const lc = PU.landCover(x, z);
      if (lc.kind !== 'urban' && lc.kind !== 'grass') continue;
      if (clusters.some((c) => Math.hypot(c[0] - x, c[1] - z) < 420)) continue;
      clusters.push([x, z]);
    }
    for (const [cx, cz] of clusters) {
      const yaw = Math.floor(rng.f() * 6) * (Math.PI / 6);
      const nb = rng.int(3, 6);
      for (let i = 0; i < nb; i++) {
        const len = rng.range(48, 66), wid = rng.range(11, 13), fl = rng.pick([9, 10, 11]);
        const g = panelBlock(len, wid, fl);
        const lx = (i % 3) * 46 - 46, lz = Math.floor(i / 3) * 82 - 30;
        const wx = cx + lx * Math.cos(yaw) + lz * Math.sin(yaw), wz = cz - lx * Math.sin(yaw) + lz * Math.cos(yaw);
        const y = terrainTop(wx, wz);
        const b = PU.meshOne(g, { skip: [0, 0, 1, 0, 0, 0], xf: { x: wx - (len / 2) * Math.cos(yaw), y, z: wz + (len / 2) * Math.sin(yaw), yaw } });
        tileFor(wx, wz).append(b, {});
        blocks++;
      }
    }
    for (let i = 0; i < 4; i++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(1500, 2100);
      const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.9;
      const g = tower(rng.pick([26, 30, 34]), rng.pick([26, 30]), rng.int(14, 22));
      const b = PU.meshOne(g, { skip: [0, 0, 1, 0, 0, 0], xf: { x, y: terrainTop(x, z), z, yaw: rng.range(0, 3) } });
      tileFor(x, z).append(b, {});
    }
    // Cetatuia fort on the north-north-east ridge: a star-shaped rampart with a small keep
    {
      const th = -1.2, r = 1180;
      const fx = Math.cos(th) * r, fz = Math.sin(th) * r;
      const base = terrainTop(fx, fz) + 2;
      const vs = 2;
      const g = VG.box(-52, -20, -52, 52, 30, 52, vs);
      const star = [];
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 26 : 44; star.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      const inner = star.map(([x, z]) => [x * 0.82, z * 0.82]);
      g.prism(star, -20, 9, M.stoneWeather);
      g.prism(inner, 0, 9.5, 0);
      g.prism(inner, -20, 0, M.grassDk);
      g.fill(-8, 0, -6, 8, 8, 6, M.cream);
      g.fill(-10, 8, -8, 10, 12, 8, M.roofTerra);
      g.fill(-1, 12, -1, 1, 16, 1, M.iron);
      const b = PU.meshOne(g, { skip: [0, 0, 1, 0, 0, 0], xf: { x: fx, y: base, z: fz, yaw: 0.3 } });
      tileFor(fx, fz).append(b, {});
    }
    for (const [key, t] of tiles) {
      if (t.b.isEmpty()) continue;
      renderer.addChunk({ name: 'suburb-' + key, lods: [{ maxDist: Infinity, builder: t.b }], cast: false });
    }
    console.log('[suburbs] houses ' + houses + ', panel blocks ' + blocks + ', clusters ' + clusters.length + ', tiles ' + tiles.size);
  };
})();

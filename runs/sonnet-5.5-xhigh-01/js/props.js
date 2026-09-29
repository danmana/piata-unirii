/* Piata Unirii — GPU-instanced props: procedural trees (lindens, sycamores, ornamentals), benches, lamps, café terraces,
   bikes, bollards, planters; plus the Roman Napoca archaeological window and the southern fountain (nozzles + jets). */
(function () {
  'use strict';
  const PU = window.PU;
  const L = PU.L, M = PU.M, B = PU.B, VG = PU.VoxelGrid;
  const hash3 = PU.hash3;
  const info = (PU.plaza = { seats: [], benchSeats: [], glows: [], photoSpots: [], obstacles: [], kidZone: null, bikeRacks: [] });

  /* ---------------- procedural trees ---------------- */
  const SPECIES = {
    linden: { H: 12.5, crownR: 3.7, trunkH: 4.6, r0: 0.34, trunk: 'trunk', leaf: ['lindenA', 'lindenB', 'leafC', 'lindenA'], top: 'lindenB', low: 'leafDark', crownH: 8.6, nblob: 11, limbs: 5 },
    plane: { H: 15.5, crownR: 6.2, trunkH: 5.2, r0: 0.55, trunk: 'trunkPlane', leaf: ['planeA', 'planeB', 'leafA', 'planeA'], top: 'leafD', low: 'leafC', crownH: 11, nblob: 15, limbs: 6 },
    orn: { H: 5.6, crownR: 2.4, trunkH: 2.0, r0: 0.16, trunk: 'trunk', leaf: ['blossom', 'lindenB', 'blossom', 'leafE'], top: 'blossom', low: 'leafB', crownH: 4.0, nblob: 6, limbs: 3 },
    ornR: { H: 5.4, crownR: 2.3, trunkH: 1.9, r0: 0.16, trunk: 'trunk', leaf: ['redLeaf', 'leafC', 'redLeaf', 'leafB'], top: 'redLeaf', low: 'leafDark', crownH: 3.8, nblob: 6, limbs: 3 },
    small: { H: 8.5, crownR: 3.0, trunkH: 3.0, r0: 0.22, trunk: 'trunk', leaf: ['leafA', 'leafB', 'leafC', 'leafD'], top: 'leafD', low: 'leafDark', crownH: 6.0, nblob: 8, limbs: 4 },
  };
  function makeTree(kind, seed, vs) {
    const sp = SPECIES[kind];
    const rng = new PU.RNG(seed);
    const H = sp.H * rng.range(0.9, 1.1), cr = sp.crownR * rng.range(0.9, 1.12), th = sp.trunkH * rng.range(0.9, 1.1);
    const pad = cr + 1.4;
    const g = VG.box(-pad, 0, -pad, pad, H + 1.2, pad, vs);
    const trunkM = M[sp.trunk];
    const lean = [rng.range(-0.25, 0.25), rng.range(-0.25, 0.25)];
    // trunk (slight lean, tapering, root flare)
    for (let y = 0; y < th; y += vs * 0.5) {
      const t = y / th;
      const r = sp.r0 * (1 - 0.35 * t) * (t < 0.08 ? 1.3 : 1);
      g.cylY(lean[0] * t * t, lean[1] * t * t, Math.max(r, vs * 0.55), y, y + vs * 0.5, y < 0.5 && kind === 'plane' && hash3(Math.floor(y * 4), 1, 1, seed) < 0.4 ? M.trunkLt : trunkM);
    }
    const fork = [lean[0], th * 0.92, lean[1]];
    // crown blobs distributed in an ellipsoid volume above the fork
    const blobs = [];
    const cy0 = th + sp.crownH * 0.5;
    for (let i = 0; i < sp.nblob; i++) {
      const a = rng.range(0, Math.PI * 2), rr = Math.sqrt(rng.f()) * cr * 0.62;
      const y = cy0 + rng.range(-0.34, 0.3) * sp.crownH;
      blobs.push([Math.cos(a) * rr, y, Math.sin(a) * rr, cr * rng.range(0.42, 0.56) * (1 - 0.15 * Math.abs(y - cy0) / sp.crownH)]);
    }
    blobs.push([0, cy0 + sp.crownH * 0.28, 0, cr * 0.55]);
    // limbs from the fork to the crown
    const nl = sp.limbs;
    for (let i = 0; i < nl; i++) {
      const a = (i / nl) * Math.PI * 2 + rng.range(-0.4, 0.4);
      const len = cr * rng.range(0.55, 0.85), rise = sp.crownH * rng.range(0.28, 0.5);
      const tip = [fork[0] + Math.cos(a) * len, fork[1] + rise, fork[2] + Math.sin(a) * len];
      g.line(fork[0], fork[1], fork[2], tip[0], tip[1], tip[2], Math.max(sp.r0 * 0.5, vs * 0.6), trunkM, Math.max(sp.r0 * 0.2, vs * 0.5));
      // sub-branches
      for (let k = 0; k < 2; k++) {
        const f = rng.range(0.45, 0.8);
        const bx = fork[0] + (tip[0] - fork[0]) * f, by = fork[1] + (tip[1] - fork[1]) * f, bz = fork[2] + (tip[2] - fork[2]) * f;
        const a2 = a + rng.range(-0.9, 0.9);
        g.line(bx, by, bz, bx + Math.cos(a2) * len * 0.45, by + rise * 0.4, bz + Math.sin(a2) * len * 0.45, Math.max(vs * 0.6, sp.r0 * 0.14), trunkM);
      }
      blobs.push([tip[0] * 0.95, tip[1] + cr * 0.15, tip[2] * 0.95, cr * rng.range(0.4, 0.55)]);
    }
    // foliage: hollow-ish clumps with organic holes
    const leaf = sp.leaf.map((n) => M[n]);
    const topM = M[sp.top], lowM = M[sp.low];
    for (const [bx, by, bz, br] of blobs) {
      const ry = br * 0.85;
      g.fillFn(bx - br, by - ry, bz - br, bx + br, by + ry, bz + br, (x, y, z, i, j, k) => {
        const dx = (x - bx) / br, dy = (y - by) / ry, dz = (z - bz) / br;
        const d = dx * dx + dy * dy + dz * dz;
        if (d > 1) return undefined;
        const hole = hash3(i, j, k, seed + 5);
        if (hole < 0.05 + (d > 0.72 ? 0.13 : 0) + (y < th + sp.crownH * 0.18 ? 0.12 : 0)) return undefined;
        const n = hash3(Math.floor(x / 0.85), Math.floor(y / 0.7), Math.floor(z / 0.85), seed);
        if (y > H * 0.86 && n < 0.6) return topM;
        if (y < th + sp.crownH * 0.28 && n < 0.55) return lowM;
        return leaf[Math.min(leaf.length - 1, Math.floor(n * leaf.length))];
      });
    }
    return g;
  }
  const skipB = [0, 0, 1, 0, 0, 0];
  function treeModel(r, name, kind, seed, vsList, distList, max, hero) {
    const lods = vsList.map((vs, i) => ({ builder: PU.meshOne(makeTree(kind, seed, vs), { skip: skipB }), maxDist: distList[i] }));
    const sp = SPECIES[kind];
    const m = new PU.InstModel(r, name, lods, max, { sway: true, cast: true, radius: sp.crownR * 1.4 + sp.H * 0.4, shadowLod: Math.min(1, lods.length - 1) });
    return m;
  }

  /* ---------------- small furniture templates ---------------- */
  function bench() {
    const g = VG.box(-1.0, 0, -0.5, 1.0, 1.0, 0.5, 0.1);
    for (let z = -0.22; z < 0.2; z += 0.14) g.fill(-0.9, 0.42, z, 0.9, 0.48, z + 0.1, M.woodMid);
    g.fill(-0.9, 0.55, 0.2, 0.9, 0.62, 0.26, M.woodLt);
    g.fill(-0.9, 0.7, 0.2, 0.9, 0.77, 0.26, M.woodLt);
    for (const x of [-0.75, 0.75]) {
      g.fill(x - 0.05, 0, -0.2, x + 0.05, 0.42, -0.1, M.iron);
      g.fill(x - 0.05, 0, 0.14, x + 0.05, 0.85, 0.24, M.iron);
      g.fill(x - 0.05, 0.42, -0.24, x + 0.05, 0.62, -0.2, M.iron);
    }
    return g;
  }
  function lamp() {
    const g = VG.box(-0.5, 0, -0.5, 0.5, 5.0, 1.0, 0.1);
    g.fill(-0.15, 0, -0.15, 0.15, 0.2, 0.15, M.ironLt);
    g.fill(-0.05, 0.2, -0.05, 0.05, 4.5, 0.05, M.iron);
    g.fill(-0.05, 4.45, -0.05, 0.05, 4.55, 0.75, M.iron);
    g.fill(-0.2, 4.35, 0.5, 0.2, 4.5, 0.9, M.iron);
    g.fill(-0.15, 4.3, 0.55, 0.15, 4.36, 0.85, M.lampGlow);
    return g;
  }
  function bollard() {
    const g = VG.box(-0.2, 0, -0.2, 0.2, 0.95, 0.2, 0.1);
    g.fill(-0.11, 0, -0.11, 0.11, 0.85, 0.11, M.ironLt);
    g.fill(-0.13, 0.85, -0.13, 0.13, 0.95, 0.13, M.iron);
    g.fill(-0.11, 0.7, -0.11, 0.11, 0.75, 0.11, M.tailLamp);
    return g;
  }
  function planter() {
    const g = VG.box(-0.7, 0, -0.7, 0.7, 1.5, 0.7, 0.1);
    g.fill(-0.6, 0, -0.6, 0.6, 0.55, 0.6, M.greyStoneLt);
    g.fill(-0.66, 0.5, -0.66, 0.66, 0.6, 0.66, M.greyStone);
    g.ellipsoid(0, 0.9, 0, 0.55, 0.42, 0.55, M.hedge);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      g.sphere(Math.cos(a) * 0.35, 1.15 + (i % 3) * 0.05, Math.sin(a) * 0.35, 0.09, i % 3 === 0 ? M.flowerRed : i % 3 === 1 ? M.flowerYel : M.flowerWhite);
    }
    return g;
  }
  function bin() {
    const g = VG.box(-0.3, 0, -0.3, 0.3, 1.0, 0.3, 0.1);
    g.fill(-0.22, 0, -0.22, 0.22, 0.85, 0.22, M.ironLt);
    g.fill(-0.26, 0.85, -0.26, 0.26, 0.95, 0.26, M.iron);
    return g;
  }
  function signpost() {
    const g = VG.box(-0.6, 0, -0.2, 0.6, 2.8, 0.2, 0.1);
    g.fill(-0.04, 0, -0.04, 0.06, 2.6, 0.06, M.iron);
    g.fill(-0.55, 2.2, -0.06, 0.5, 2.6, 0.06, M.signBlue);
    g.fill(-0.5, 2.28, -0.08, 0.45, 2.34, 0.08, M.signCream);
    g.fill(-0.5, 2.44, -0.08, 0.35, 2.5, 0.08, M.signCream);
    return g;
  }
  function bikeRack() {
    const g = VG.box(-1.6, 0, -0.3, 1.6, 0.9, 0.3, 0.1);
    for (let x = -1.3; x <= 1.3; x += 0.6) {
      g.fill(x - 0.03, 0, -0.03, x + 0.03, 0.75, 0.03, M.ironLt);
      g.fill(x - 0.03, 0.7, -0.03, x + 0.03, 0.78, 0.03, M.ironLt);
    }
    g.fill(-1.5, 0.0, -0.06, 1.5, 0.06, 0.06, M.ironLt);
    return g;
  }
  function jetDrop() {
    const g = VG.box(-0.05, -0.05, -0.05, 0.05, 0.05, 0.05, 0.1);
    g.fill(-0.05, -0.05, -0.05, 0.05, 0.05, 0.05, M.white);
    return g;
  }
  function nozzle() {
    const g = VG.box(-0.3, 0, -0.3, 0.3, 0.14, 0.3, 0.1);
    g.fill(-0.3, 0, -0.3, 0.3, 0.1, 0.3, M.greyStoneDk);
    g.fill(-0.1, 0.1, -0.1, 0.1, 0.14, 0.1, M.iron);
    return g;
  }
  function cafeSet(umb) {
    const g = VG.box(-1.7, 0, -1.7, 1.7, 3.0, 1.7, 0.1);
    // table
    g.cylY(0, 0, 0.42, 0.72, 0.78, M.woodLt);
    g.cylY(0, 0, 0.05, 0.1, 0.72, M.iron);
    g.cylY(0, 0, 0.22, 0.0, 0.1, M.iron);
    // chairs
    for (const [cx, cz, fx, fz] of [[0.66, 0, -1, 0], [-0.66, 0, 1, 0], [0, 0.66, 0, -1], [0, -0.66, 0, 1]]) {
      g.fill(cx - 0.2, 0.44, cz - 0.2, cx + 0.2, 0.5, cz + 0.2, M.woodDk);
      for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) g.fill(cx + lx - 0.03, 0, cz + lz - 0.03, cx + lx + 0.03, 0.44, cz + lz + 0.03, M.iron);
      const bx = cx - fx * 0.19, bz = cz - fz * 0.19;
      g.fill(bx - (fz ? 0.2 : 0.03), 0.5, bz - (fx ? 0.2 : 0.03), bx + (fz ? 0.2 : 0.03), 0.92, bz + (fx ? 0.2 : 0.03), M.woodDk);
    }
    if (umb) {
      g.fill(-0.03, 0.1, -0.03, 0.03, 2.55, 0.03, M.iron);
      const c1 = umb, c2 = M.umbCream;
      g.fillFn(-1.6, 2.25, -1.6, 1.6, 2.85, 1.6, (x, y, z) => {
        const r = Math.hypot(x, z);
        const t = (y - 2.25) / 0.6;
        const rr = 1.55 * (1 - t) ;
        if (r > rr || t < 0) return undefined;
        const a = Math.atan2(z, x);
        return Math.floor(((a + Math.PI) / (Math.PI * 2)) * 10) % 2 ? c1 : c2;
      });
      g.fill(-0.05, 2.85, -0.05, 0.05, 2.95, 0.05, M.iron);
    }
    return g;
  }
  function bikeGrid(tintFrame) {
    const g = VG.box(-0.95, 0, -0.35, 0.95, 1.15, 0.35, 0.05);
    const wheel = (cx) => {
      for (let a = 0; a < 40; a++) {
        const t = (a / 40) * Math.PI * 2;
        g.fill(cx + Math.cos(t) * 0.34 - 0.03, 0.34 + Math.sin(t) * 0.34 - 0.03, -0.025, cx + Math.cos(t) * 0.34 + 0.03, 0.34 + Math.sin(t) * 0.34 + 0.03, 0.025, M.tyre);
      }
      g.fill(cx - 0.02, 0.32, -0.02, cx + 0.02, 0.36, 0.02, M.ironLt);
    };
    wheel(-0.5);
    wheel(0.5);
    const fr = tintFrame ? M.carBody : M.bikeFrame;
    const L2 = (a, b, r, m) => g.line(a[0], a[1], 0, b[0], b[1], 0, r, m || fr);
    L2([-0.5, 0.34], [-0.05, 0.36], 0.025);
    L2([-0.05, 0.36], [-0.12, 0.78], 0.025);
    L2([-0.5, 0.34], [-0.12, 0.78], 0.02);
    L2([-0.12, 0.78], [0.35, 0.8], 0.025);
    L2([0.35, 0.8], [0.5, 0.34], 0.025);
    L2([-0.05, 0.36], [0.35, 0.8], 0.025);
    L2([0.35, 0.8], [0.4, 0.98], 0.02, M.iron);
    g.fill(0.3, 0.98, -0.2, 0.42, 1.02, 0.2, M.iron);
    g.fill(-0.2, 0.8, -0.06, -0.02, 0.86, 0.06, M.woodDk);
    return g;
  }

  /* ---------------- Roman Napoca archaeological window ---------------- */
  PU.buildRoman = function () {
    const vs = 0.125, hw = L.roman.hw, hd = L.roman.hd;
    const g = VG.box(-hw - 0.2, -2.0, -hd - 0.2, hw + 0.2, 0.7, hd + 0.2, vs);
    const rng = new PU.RNG(77);
    // slab surround at plaza level (y 0 = pavement level)
    g.fill(-hw, -2.0, -hd, hw, 0.0, hd, M.pedestalDk);
    // pit
    const px0 = -4.7, px1 = 4.7, pz0 = -1.35, pz1 = 0.75;
    g.carve(px0, -1.85, pz0, px1, 0.0, pz1);
    g.fill(px0, -2.0, pz0, px1, -1.85, pz1, M.earth);
    // Roman masonry: long walls, cross walls and hypocaust pillars
    const wallM = () => (rng.chance(0.5) ? M.romanStone : rng.chance(0.5) ? M.romanStoneDk : M.brick);
    const wall = (x0, z0, x1, z1, h) => {
      for (let y = -1.85; y < -1.85 + h; y += 0.25) {
        for (let x = x0; x < x1; x += 0.5) for (let z = z0; z < z1; z += 0.5) g.fill(x, y, z, Math.min(x + 0.5, x1), y + 0.25, Math.min(z + 0.5, z1), wallM(), 0);
      }
    };
    wall(-4.3, -1.0, 4.3, -0.55, 1.1);
    wall(-4.3, 0.15, 4.3, 0.6, 0.8);
    wall(-4.3, -1.0, -3.85, 0.6, 1.0);
    wall(3.85, -1.0, 4.3, 0.6, 1.2);
    wall(-0.5, -0.55, -0.05, 0.15, 0.7);
    for (let x = -3.2; x < 3.4; x += 0.9) for (const z of [-0.3, -0.05 + 0.0]) g.fill(x, -1.85, z, x + 0.3, -1.1, z + 0.3, M.brickDk, 0);
    // warm lights beneath the glass
    for (let x = -4.0; x <= 4.0; x += 2.0) g.fill(x, -1.0, -1.25, x + 0.3, -0.85, -1.05, M.warmGlow, 0);
    for (let x = -3.0; x <= 3.0; x += 2.0) g.fill(x, -1.0, 0.6, x + 0.3, -0.85, 0.72, M.warmGlow, 0);
    // dark frame with glazing bars and stippled glass panes
    g.fill(px0 - 0.35, -0.3, pz0 - 0.35, px1 + 0.35, 0.05, pz0, M.bronzeDark, 0);
    g.fill(px0 - 0.35, -0.3, pz1, px1 + 0.35, 0.05, pz1 + 0.35, M.bronzeDark, 0);
    g.fill(px0 - 0.35, -0.3, pz0, px0, 0.05, pz1, M.bronzeDark, 0);
    g.fill(px1, -0.3, pz0, px1 + 0.35, 0.05, pz1, M.bronzeDark, 0);
    for (let x = px0 + 1.4; x < px1 - 0.5; x += 1.55) g.fill(x, -0.12, pz0, x + 0.14, 0.03, pz1, M.bronzeDark, 0);
    g.fill(px0, -0.12, (pz0 + pz1) / 2 - 0.05, px1, 0.03, (pz0 + pz1) / 2 + 0.05, M.bronzeDark, 0);
    g.fill(px0, -0.14, pz0, px1, -0.02, pz1, M.glassRomanPane, 1);
    // bench along the south edge
    g.fill(-5.0, 0.0, 1.05, 5.0, 0.45, 1.7, M.pedestal);
    g.fill(-5.0, 0.45, 1.0, 5.0, 0.55, 1.78, M.limestoneLt);
    return { name: 'roman', items: [{ grid: g, skip: skipB, thr: 0.3 }], xf: { x: L.roman.x, y: L.H_PLAZA + 0.02, z: L.roman.z, yaw: 0 } };
  };

  /* ---------------- assemble all props ---------------- */
  PU.buildProps = function (renderer) {
    const rng = new PU.RNG((PU.SEED | 0) + 101);
    const app = PU.app;
    // Roman window
    app.addHero(PU.buildRoman(), [120, 400], [2, 4]);

    const ins = (arr, x, z, opt) => {
      opt = opt || {};
      const y = opt.y !== undefined ? opt.y : L.groundH(x, z);
      const s = opt.s || 1;
      arr.push(x, y, z, opt.yaw || 0, s, opt.r === undefined ? 1 : opt.r, opt.g === undefined ? 1 : opt.g, opt.b === undefined ? 1 : opt.b, 0, 0, 0, 0);
    };
    const obs = info.obstacles;
    const blocked = (x, z, r) => {
      for (const o of obs) if ((o[0] - x) * (o[0] - x) + (o[1] - z) * (o[1] - z) < (o[2] + r) * (o[2] + r)) return true;
      return false;
    };
    const rect = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
    const nearChurch = (x, z, m) => L.churchDist(x, z) < m;
    const mon = L.monument, rom = L.roman, fo = L.fountain;
    const inMonument = (x, z, m) => Math.abs(x - mon.x) < mon.hw + m && Math.abs(z - mon.z) < mon.hd + m;
    const inRoman = (x, z, m) => Math.abs(x - rom.x) < rom.hw + m && Math.abs(z - rom.z) < rom.hd + m;
    const inFountain = (x, z, m) => Math.abs(x - fo.x) < fo.hw + m && Math.abs(z - fo.z) < fo.hd + m;
    const gapNear = (x, z, m) => {
      for (const k in L.gaps) {
        const g = L.gaps[k], c = (g.a + g.b) / 2;
        if ((g.side === 'N' || g.side === 'S') && Math.abs(x - c) < 7 + m && Math.abs(Math.abs(z) - 67) < 14) return true;
        if ((g.side === 'E' || g.side === 'W') && Math.abs(z - c) < 7 + m && Math.abs(Math.abs(x) - 97) < 14) return true;
      }
      return false;
    };
    const plazaFree = (x, z, m) => !nearChurch(x, z, 1.5 + m) && !inMonument(x, z, 1 + m) && !inRoman(x, z, 1 + m) && !inFountain(x, z, m) && !blocked(x, z, m);
    obs.push([mon.x, mon.z, 9], [rom.x, rom.z, 6.5]);

    /* ---- tree models ---- */
    const T = {};
    const heroLods = [0.25, 0.5, 1.0], heroD = [55, 170, 1e9];
    const stdLods = [0.25, 0.4, 0.8, 1.6], stdD = [42, 230, 540, 1e9];
    T.heroPlane = treeModel(renderer, 'heroPlane', 'plane', 11, heroLods, heroD, 40);
    T.heroLinden = treeModel(renderer, 'heroLinden', 'linden', 12, heroLods, heroD, 40);
    T.linden1 = treeModel(renderer, 'linden1', 'linden', 21, stdLods, stdD, 500);
    T.linden2 = treeModel(renderer, 'linden2', 'linden', 22, stdLods, stdD, 500);
    T.plane1 = treeModel(renderer, 'plane1', 'plane', 31, stdLods, stdD, 200);
    T.plane2 = treeModel(renderer, 'plane2', 'plane', 32, stdLods, stdD, 200);
    T.orn = treeModel(renderer, 'orn', 'orn', 41, stdLods, stdD, 120);
    T.ornR = treeModel(renderer, 'ornR', 'ornR', 42, stdLods, stdD, 60);
    T.small1 = treeModel(renderer, 'small1', 'small', 51, stdLods, stdD, 800);
    T.small2 = treeModel(renderer, 'small2', 'small', 52, stdLods, stdD, 800);
    const TA = {};
    for (const k in T) TA[k] = [];
    const addTree = (model, x, z, s) => {
      ins(TA[model], x, z, { s: s || rng.range(0.9, 1.15), yaw: rng.range(0, 6.28) });
    };
    const treeAt = (kind, x, z, r, s) => {
      obs.push([x, z, r]);
      if (kind === 'linden') addTree(rng.chance(0.5) ? 'linden1' : 'linden2', x, z, s);
      else if (kind === 'plane') addTree(rng.chance(0.5) ? 'plane1' : 'plane2', x, z, s);
      else if (kind === 'heroPlane') addTree('heroPlane', x, z, s);
      else if (kind === 'heroLinden') addTree('heroLinden', x, z, s);
      else if (kind === 'orn') addTree(rng.chance(0.65) ? 'orn' : 'ornR', x, z, s);
    };
    // church grounds: a few mature deciduous trees, restrained so the Gothic architecture stays visible
    const churchTrees = [[-47, -27, 'heroPlane'], [-25, -38, 'heroLinden'], [-6, -40, 'heroPlane'], [14, -38, 'heroLinden'], [33, -33, 'heroPlane'], [42, -14, 'heroLinden'], [-46, -8, 'heroLinden'], [-49, -19, 'heroPlane'], [39, -25, 'heroLinden'], [-33, -37, 'heroPlane']];
    for (const [x, z, k] of churchTrees) if (L.groundCell(x, z, 0.5).kind === 'lawn') treeAt(k, x, z, 3.2);
    // linden rows defining the edges of the square
    const rowPts = [];
    for (let x = -86; x <= 86; x += 9) rowPts.push([x, -64.5]);
    for (let z = -55; z <= 57; z += 9) rowPts.push([-94.5, z]);
    for (let x = -84; x <= -6; x += 9) rowPts.push([x, 64.5]);
    for (let x = 12; x <= 84; x += 9) if (Math.abs(x - fo.x) > 26) rowPts.push([x, 64.5]);
    // (the east side in front of the Banffy Palace stays open so its forecourt and portal read clearly)
    for (let z = 32; z <= 62; z += 9) rowPts.push([94.5, z]);
    for (const [x, z] of rowPts) {
      if (gapNear(x, z, 2)) continue;
      treeAt('linden', x, z, 1.4, rng.range(0.92, 1.08));
    }
    // larger sycamores in sections of the square
    for (const [x, z] of [[66, -41], [-68, -40], [60, 36], [-66, 46], [-48, 28], [72, 8]]) if (plazaFree(x, z, 5)) treeAt('plane', x, z, 4.5);
    // ornamental trees around the fountain
    for (let i = 0; i < 10; i++) {
      const x = fo.x - fo.hw - 2.5 + (i % 5) * ((fo.hw * 2 + 5) / 4), z = fo.z + (i < 5 ? -fo.hd - 2.6 : fo.hd + 2.6);
      if (plazaFree(x, z, 1)) treeAt('orn', x, z, 1.3);
    }
    // trees in courtyards and along the boulevard (outer city)
    const g = L.grid;
    let nYard = 0;
    for (let i = 0; i < 4200 && nYard < 1200; i++) {
      const a = rng.range(0, 6.283), r = Math.sqrt(rng.f()) * 560;
      const x = Math.cos(a) * r * 1.08, z = Math.sin(a) * r * 0.95;
      if (Math.abs(x) < 118 && Math.abs(z) < 88) continue;
      const c = g.get(x, z);
      if (c !== L.T.FREE && c !== L.T.YARD && c !== L.T.PARK) continue;
      // keep a clear neighbourhood
      if (g.get(x + 1.5, z) !== c || g.get(x, z + 1.5) !== c || g.get(x - 1.5, z) !== c || g.get(x, z - 1.5) !== c) continue;
      addTree(rng.chance(0.5) ? 'small1' : 'small2', x, z, rng.range(0.75, 1.25));
      nYard++;
    }
    const D = L.streets.find((s) => s.id === 'D');
    {
      const pts = D.pts;
      let acc = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len;
        for (let d = 0; d < len; d += 1) {
          acc += 1;
          if (acc < 11) continue;
          acc = 0;
          const x0 = a[0] + tx * d, z0 = a[1] + tz * d;
          for (const sd of [1, -1]) {
            const x = x0 + -tz * sd * (D.w / 2 - 1.8), z = z0 + tx * sd * (D.w / 2 - 1.8);
            if (Math.abs(x) < 112 && Math.abs(z) < 84) continue;
            if (g.get(x, z) === L.T.SIDEWALK) addTree('linden1', x, z, rng.range(0.8, 1.0));
          }
        }
      }
    }
    for (const k in T) {
      const arr = new Float32Array(TA[k]);
      T[k].setAll(arr, arr.length / 12);
      renderer.addInst(T[k]);
    }

    /* ---- furniture ---- */
    const F = {
      bench: new PU.InstModel(renderer, 'bench', [{ builder: PU.meshOne(bench(), { skip: skipB }), maxDist: 1e9 }], 200, { cast: true, radius: 1.4 }),
      lamp: new PU.InstModel(renderer, 'lamp', [{ builder: PU.meshOne(lamp(), { skip: skipB }), maxDist: 1e9 }], 300, { cast: true, radius: 3 }),
      bollard: new PU.InstModel(renderer, 'bollard', [{ builder: PU.meshOne(bollard(), { skip: skipB }), maxDist: 320 }, { builder: PU.meshOne(bollard(), { skip: skipB }), maxDist: 1e9 }], 400, { cast: false, radius: 1 }),
      planter: new PU.InstModel(renderer, 'planter', [{ builder: PU.meshOne(planter(), { skip: skipB }), maxDist: 1e9 }], 150, { cast: true, radius: 1.4 }),
      bin: new PU.InstModel(renderer, 'bin', [{ builder: PU.meshOne(bin(), { skip: skipB }), maxDist: 1e9 }], 60, { cast: false, radius: 1 }),
      sign: new PU.InstModel(renderer, 'sign', [{ builder: PU.meshOne(signpost(), { skip: skipB }), maxDist: 1e9 }], 40, { cast: true, radius: 2 }),
      rack: new PU.InstModel(renderer, 'rack', [{ builder: PU.meshOne(bikeRack(), { skip: skipB }), maxDist: 1e9 }], 40, { cast: false, radius: 2 }),
      bike: new PU.InstModel(renderer, 'bike', [{ builder: PU.meshOne(bikeGrid(true), { skip: skipB }), maxDist: 1e9 }], 300, { cast: false, radius: 1.2 }),
      nozzle: new PU.InstModel(renderer, 'nozzle', [{ builder: PU.meshOne(nozzle(), { skip: skipB }), maxDist: 1e9 }], 200, { cast: false, radius: 1 }),
    };
    const cafeMats = [M.umbCream, M.umbRed, M.umbGreen, M.umbBlue, M.umbOchre];
    const CF = cafeMats.map((m, i) => new PU.InstModel(renderer, 'cafe' + i, [{ builder: PU.meshOne(cafeSet(m), { skip: skipB }), maxDist: 1e9 }], 120, { cast: true, radius: 2.2 }));
    const FA = {};
    for (const k in F) FA[k] = [];
    const CA = cafeMats.map(() => []);
    const glows = [];
    const addGlow = (x, y, z, size, r, g2, b, a) => glows.push(x, y, z, size, r, g2, b, a);

    // lamps: along the edge of the square, around the church paths, fountain, monument
    const lampAt = (x, z, faceX, faceZ) => {
      const yaw = Math.atan2(faceX - x, faceZ - z);
      ins(FA.lamp, x, z, { yaw });
      obs.push([x, z, 0.5]);
      const y = L.groundH(x, z) + 4.4;
      addGlow(x + Math.sin(yaw) * 0.7, y - 0.1, z + Math.cos(yaw) * 0.7, 2.6, 1.0, 0.8, 0.5, 1.0);
    };
    for (let x = -80; x <= 80; x += 18) { if (!gapNear(x, -66, 3)) lampAt(x, -66, x, 0); if (x < -6 || x > 30) if (!gapNear(x, 66, 3)) lampAt(x, 66, x, 0); }
    for (let z = -50; z <= 50; z += 18) { lampAt(-96, z, 0, z); lampAt(96, z, 0, z); }
    {
      // lamps on the church path ring (perimeter of the inflated bounding box, kept where the ground is path)
      const bx0 = -43.5, bx1 = 35.6, bz0 = -30.6, bz1 = 6.6;
      const ring = [];
      for (let x = bx0; x <= bx1; x += 13) { ring.push([x, bz0]); ring.push([x, bz1]); }
      for (let z = bz0 + 13; z < bz1; z += 12) { ring.push([bx0, z]); ring.push([bx1, z]); }
      for (const [x, z] of ring) {
        const dc = L.churchDist(x, z);
        if (dc < 1.8 || dc > 4.0 || gapNear(x, z, 1)) continue;
        lampAt(x, z, -4, -12);
      }
    }
    for (const [x, z] of [[-14, 14], [2, 14], [-14, 28], [2, 28], [-14, 40], [2, 40], [16, 44], [40, 44], [16, 66], [40, 66]]) if (plazaFree(x, z, 0.6)) lampAt(x, z, x, z + 10);
    // benches around the church path ring, along tree rows and around the fountain
    const benchAt = (x, z, tx, tz) => {
      // bench faces the target point (tx, tz); local +z of the model is the sitting direction
      const yaw = Math.atan2(tx - x, tz - z);
      ins(FA.bench, x, z, { yaw });
      obs.push([x, z, 1.1]);
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      info.benchSeats.push({ x: x + Math.cos(yaw) * 0.45 - fz * 0.0, z: z - Math.sin(yaw) * 0.45, fx, fz });
      info.benchSeats.push({ x: x - Math.cos(yaw) * 0.45, z: z + Math.sin(yaw) * 0.45, fx, fz });
    };
    // church ring
    for (let x = -34; x <= 26; x += 15) { benchAt(x, -30.6, x, -40); }
    for (let x = -34; x <= 24; x += 15) { const zz = 6.8; if (plazaFree(x, zz, 1)) benchAt(x, zz, x, zz + 5); }
    for (let z = -22; z <= -2; z += 10) { benchAt(-44.6, z, -55, z); benchAt(37.6, z, 47, z); }
    for (let x = -80; x <= 80; x += 18) { if (!gapNear(x, -63, 3) && plazaFree(x + 9, -62.6, 1)) benchAt(x + 9, -62.6, x + 9, -40); }
    for (let z = -46; z <= 46; z += 18) { if (plazaFree(-92.8, z + 9, 1)) benchAt(-92.8, z + 9, 0, z + 9); }
    for (let i = 0; i < 5; i++) {
      const x = fo.x - fo.hw + 3 + i * 8;
      if (plazaFree(x, fo.z - fo.hd - 1.8, 1)) benchAt(x, fo.z - fo.hd - 1.8, x, fo.z);
      if (plazaFree(x, fo.z + fo.hd + 1.8, 1)) benchAt(x, fo.z + fo.hd + 1.8, x, fo.z);
    }
    // bollards along the pedestrian edge of the ring road, planters, bins, sign posts
    for (let x = -96; x <= 96; x += 6) {
      if (!gapNear(x, 67.5, 1)) FA.bollard.push(...bollardRec(x, 67.5));
      if (!gapNear(x, -67.5, 1)) FA.bollard.push(...bollardRec(x, -67.5));
    }
    for (let z = -64; z <= 64; z += 6) {
      if (!gapNear(97.5, z, 1)) FA.bollard.push(...bollardRec(97.5, z));
      if (!gapNear(-97.5, z, 1)) FA.bollard.push(...bollardRec(-97.5, z));
    }
    function bollardRec(x, z) {
      const a = [];
      ins(a, x, z, {});
      return a;
    }
    for (const [x, z] of [[-30, -63.5], [-8, -63.5], [16, -63.5], [44, -63.5], [-92.5, -20], [-92.5, 20], [92.5, 46], [92.5, -40], [-60, 63.5]]) if (!gapNear(x, z, 3)) { ins(FA.planter, x, z, { yaw: 0.3 }); obs.push([x, z, 1]); }
    for (const [x, z] of [[-20, 18], [8, 18], [20, 50], [-40, 58], [55, -20], [-60, -20], [30, -58], [-30, -58]]) if (plazaFree(x, z, 1)) { ins(FA.bin, x, z, {}); obs.push([x, z, 0.5]); }
    for (const [x, z, yaw] of [[-30, 12, 0.5], [18, 14, -0.4], [-6, 46, 0.2], [-46, -33, 0.7], [30, -40, 3.4]]) if (plazaFree(x, z, 1)) { ins(FA.sign, x, z, { yaw }); obs.push([x, z, 0.8]); }
    // fountain: nozzles + jets, plus benches on the coping (added above)
    const jets = [];
    let jc = 0;
    for (const bc of L.basinCx) {
      for (let iu = -3; iu <= 3; iu++) for (let iv = -2; iv <= 2; iv++) {
        if ((iu + iv) % 2) continue;
        const x = fo.x + bc + iu * 1.32, z = fo.z + iv * 2.25;
        ins(FA.nozzle, x, z, { y: -0.08 });
        const h = 0.7 + 0.9 * (0.5 + 0.5 * Math.sin(jc * 1.7)) + (Math.abs(iu) < 2 && Math.abs(iv) < 1 ? 0.5 : 0);
        for (let k = 0; k < 7; k++) jets.push(x, -0.06, z, k / 7 + (jc % 5) * 0.11, h, 0.9 + 0.35 * ((jc * 7) % 4) / 3, 1.0, jc * 0.37 + k);
        jc++;
      }
    }
    // café terraces on the sidewalks in front of shops
    info.cafeTables = [];
    const cafeLots = ['N3', 'N5', 'N7', 'N8', 'N10', 'N11', 'S3', 'S6', 'S7', 'W2', 'W5', 'W6', 'E2', 'N9', 'S8'];
    for (const lot of L.lots) {
      if (cafeLots.indexOf(lot.id) < 0) continue;
      const fr = L.sideFrame(lot.side, lot.a, lot.b);
      const c = Math.cos(fr.yaw), s = Math.sin(fr.yaw);
      const w = fr.w;
      const nT = Math.max(1, Math.floor((w - 2.5) / 3.6));
      for (let i = 0; i < nT; i++) {
        const xl = 1.5 + ((w - 3.0) * (i + 0.5)) / nT, zl = -3.1;
        const wx = fr.x + xl * c + zl * s, wz = fr.z - xl * s + zl * c;
        if (gapNear(wx, wz, 0.5)) continue;
        const mi = (PU.strHash(lot.id) + i) % CA.length;
        ins(CA[mi], wx, wz, { yaw: rng.range(0, 6.28) });
        obs.push([wx, wz, 1.3]);
        // four seats around the table (the sim seats patrons here)
        for (const [dx, dz] of [[0.66, 0], [-0.66, 0], [0, 0.66], [0, -0.66]]) info.seats.push({ x: wx + dx, z: wz + dz, fx: -dx / 0.66, fz: -dz / 0.66, tx: wx, tz: wz });
        info.cafeTables.push([wx, wz]);
      }
      // a planter strip at each terrace end
      const xl0 = 0.8, xl1 = w - 0.8;
      for (const xl of [xl0, xl1]) {
        const wx = fr.x + xl * c + (-4.9) * s, wz = fr.z - xl * s + (-4.9) * c;
        if (!gapNear(wx, wz, 0.5)) ins(FA.planter, wx, wz, {});
      }
    }
    // bike racks with parked bicycles
    const bikeCol = [[0.55, 0.62, 0.72], [0.72, 0.3, 0.27], [0.32, 0.5, 0.36], [0.85, 0.78, 0.5], [0.25, 0.3, 0.4], [0.8, 0.8, 0.78]];
    for (const [x, z, yaw] of [[-52, -60.4, 0], [44, -60.4, 0], [-90.4, 34, Math.PI / 2], [90.4, -30, Math.PI / 2], [-20, 61, 0], [24, 61, 0], [-70, 61, 0]]) {
      if (gapNear(x, z, 3)) continue;
      ins(FA.rack, x, z, { yaw });
      info.bikeRacks.push([x, z]);
      const n = rng.int(3, 5);
      for (let i = 0; i < n; i++) {
        const off = -1.2 + (i * 2.4) / Math.max(1, n - 1);
        const bx = x + Math.cos(yaw) * off, bz = z - Math.sin(yaw) * off;
        const col = rng.pick(bikeCol);
        ins(FA.bike, bx, bz + (yaw ? 0 : 0.0), { yaw: yaw + Math.PI / 2, r: col[0], g: col[1], b: col[2] });
      }
    }
    // upload furniture / cafe instances
    const up = (model, arr) => {
      const f = new Float32Array(arr);
      model.setAll(f, f.length / 12);
      renderer.addInst(model);
    };
    for (const k in F) up(F[k], FA[k]);
    CF.forEach((m, i) => up(m, CA[i]));
    // jets: droplets
    const jetModel = new PU.InstModel(renderer, 'jets', [{ builder: PU.meshOne(jetDrop(), { skip: skipB }), maxDist: 1e9 }], 3000, { dynamic: true });
    jetModel.jet = true;
    const jf = new Float32Array(jets);
    // jets use a0=(x,y,z,phase), a1=(height,speed,size,seed)
    const jd = new Float32Array((jf.length / 8) * 12);
    for (let i = 0; i < jf.length / 8; i++) {
      jd.set([jf[i * 8], jf[i * 8 + 1], jf[i * 8 + 2], jf[i * 8 + 3], jf[i * 8 + 4], jf[i * 8 + 5], 1.7, jf[i * 8 + 7], 0, 0, 0, 0], i * 12);
    }
    jetModel.setAll(jd, jd.length / 12);
    renderer.addInst(jetModel);
    // church floodlights (glow sprites)
    for (let k = 0; k < 5; k++) {
      if (k === 2) continue;
      const x = L.church.ox + (-26 + 8.8 * k) + 4.4, z = L.church.oz + 18.2;
      addGlow(x, L.church.y0 + 0.5, z, 3.2, 1.0, 0.86, 0.6, 1.2);
    }
    renderer.glowData.set(new Float32Array(glows).subarray(0, Math.min(glows.length, renderer.glowData.length)));
    renderer.glowN = Math.min(glows.length / 8, renderer.glowData.length / 8);
    info.tables = info.cafeTables;
    console.log('[props] trees ' + Object.values(TA).reduce((a, b) => a + b.length / 12, 0) + ', benches ' + FA.bench.length / 12 + ', lamps ' + FA.lamp.length / 12 + ', cafe tables ' + info.cafeTables.length + ', glows ' + renderer.glowN);
  };
})();

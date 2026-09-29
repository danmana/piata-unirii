/* Piata Unirii — living square: articulated voxel people (walkers, tourists, café patrons, bench sitters, children),
   cyclists, pigeons, and cars / taxis / vans / buses following the street geometry. Everything is GPU-instanced. */
(function () {
  'use strict';
  const PU = window.PU;
  const L = PU.L, M = PU.M, VG = PU.VoxelGrid;
  const info = PU.plaza;
  const TAU = Math.PI * 2;

  /* ---------------- actor colour palette (sRGB 0..1) ---------------- */
  const rgb = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const SHIRTS = [0x2f3f5c, 0x8a3a3a, 0xc19a3a, 0x6b7448, 0xe9e5da, 0xd8cfb4, 0x8c9096, 0x5b7fa6, 0xd9a0a6, 0x3d7f80, 0x7b5a3f, 0x25262a, 0x3d6a48, 0x6e2f3d, 0x9fc0d8, 0xc47b3a, 0xa694c4, 0x476a94, 0xc9b591, 0x3f4247, 0xd77c66, 0x9db38c, 0x7fb1d0, 0x6a3f5e];
  const PANTS = [0x3a5a86, 0x26354d, 0x1f1f22, 0xa39274, 0x6c6f74, 0x1e2a44, 0xc8bda3, 0x5a4331];
  const HAIR = [0x141210, 0x33231a, 0x5a3d26, 0xc6a25a, 0x9a4a26, 0x8f8f8f, 0xdedad0, 0x4a2c22];
  const SKIN = [0xf1c9a5, 0xe3b48f, 0xcd9a76, 0xb27f5b, 0x8f5f42, 0x6b4630, 0xf5d6bb, 0xdca884];
  const CONST = { 5: 0x2a2724, 7: 0x161616, 8: 0x4d5b66, 9: 0xb9bcc2, 10: 0x8c6a45, 11: 0x8b8e96, 12: 0x4c5a62, 13: 0xc07c78, 14: 0xc9c2a0, 15: 0x2a8a83 };
  function buildPalette() {
    const a = new Float32Array(64 * 3);
    const put = (i, h) => { const c = rgb(h); a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; };
    for (const k in CONST) put(+k, CONST[k]);
    SHIRTS.forEach((h, i) => put(16 + i, h));
    PANTS.forEach((h, i) => put(40 + i, h));
    HAIR.forEach((h, i) => put(48 + i, h));
    SKIN.forEach((h, i) => put(56 + i, h));
    return a;
  }

  /* ---------------- voxel templates ---------------- */
  const S = { shirt: M.slot1, pants: M.slot2, hair: M.slot3, skin: M.slot4, shoe: M.slot5, acc: M.slot6, rubber: M.slot7, frame: M.slot8, metal: M.slot9, cargo: M.slot10, pg: M.slot11, pgd: M.slot12, pgn: M.slot13, beak: M.slot14, box: M.slot15 };

  function personBuilder() {
    const vs = 0.08, b = new PU.GeoBuilder();
    const mk = () => VG.box(-0.5, -0.02, -0.5, 0.5, 1.94, 0.5, vs);
    const add = (g, part) => PU.meshGrid(g, b, { flags: part, ao: 0.55 });
    let g = mk();
    g.fill(-0.1, 0.92, -0.2, 0.1, 1.47, 0.2, S.shirt);
    g.fill(-0.105, 0.88, -0.205, 0.105, 1.0, 0.205, S.pants);
    g.fill(-0.035, 1.47, -0.05, 0.05, 1.53, 0.05, S.skin);
    g.fill(-0.09, 1.53, -0.09, 0.1, 1.75, 0.09, S.skin);
    g.fill(-0.1, 1.68, -0.1, 0.09, 1.78, 0.1, S.hair);
    g.fill(-0.11, 1.53, -0.1, -0.03, 1.7, 0.1, S.hair);
    add(g, 0);
    for (const [part, zc] of [[1, 0.09], [2, -0.09]]) {
      g = mk();
      g.fill(-0.07, 0.5, zc - 0.08, 0.07, 0.94, zc + 0.08, S.pants);
      add(g, part);
    }
    for (const [part, zc] of [[5, 0.09], [6, -0.09]]) {
      g = mk();
      g.fill(-0.06, 0.09, zc - 0.07, 0.06, 0.5, zc + 0.07, S.pants);
      g.fill(-0.07, 0.0, zc - 0.08, 0.17, 0.09, zc + 0.08, S.shoe);
      add(g, part);
    }
    for (const [part, zc] of [[3, 0.26], [4, -0.26]]) {
      g = mk();
      g.fill(-0.05, 1.13, zc - 0.05, 0.05, 1.47, zc + 0.05, S.shirt);
      g.fill(-0.04, 0.9, zc - 0.045, 0.04, 1.13, zc + 0.045, S.skin);
      if (part === 4) g.fill(0.0, 0.9, zc - 0.04, 0.05, 1.02, zc + 0.04, S.shoe); // phone
      add(g, part);
    }
    return b;
  }
  function cyclistBuilder(delivery) {
    const vs = 0.08, b = new PU.GeoBuilder();
    const mk = () => VG.box(-0.75, -0.02, -0.4, 0.75, 1.9, 0.4, vs);
    const add = (g, part) => PU.meshGrid(g, b, { flags: part, ao: 0.55 });
    let g = mk();
    const Ln = (a, c, r, m) => g.line(a[0], a[1], 0, c[0], c[1], 0, r, m || S.frame);
    Ln([-0.44, 0.34], [0.0, 0.3], 0.04);
    Ln([0.0, 0.3], [-0.06, 0.94], 0.04);
    Ln([-0.44, 0.34], [-0.06, 0.94], 0.035);
    Ln([-0.06, 0.94], [0.36, 0.9], 0.04);
    Ln([0.36, 0.9], [0.44, 0.34], 0.04);
    Ln([0.0, 0.3], [0.36, 0.9], 0.04);
    Ln([0.36, 0.9], [0.4, 1.06], 0.04, S.shoe);
    g.fill(0.34, 1.05, -0.24, 0.44, 1.1, 0.24, S.shoe);
    g.fill(-0.2, 0.94, -0.06, 0.04, 1.0, 0.06, S.shoe);
    // rider
    g.fill(0.08, 0.98, -0.19, 0.25, 1.22, 0.19, S.pants);
    g.fill(0.1, 1.2, -0.19, 0.3, 1.46, 0.19, S.shirt);
    g.fill(0.24, 1.46, -0.05, 0.32, 1.52, 0.05, S.skin);
    g.fill(0.22, 1.52, -0.09, 0.42, 1.74, 0.09, S.skin);
    g.fill(0.2, 1.68, -0.1, 0.41, 1.78, 0.1, S.hair);
    for (const zs of [-1, 1]) {
      g.line(0.24, 1.4, zs * 0.25, 0.4, 1.06, zs * 0.25, 0.04, S.shirt);
      g.fill(0.36, 1.03, zs * 0.25 - 0.04, 0.44, 1.09, zs * 0.25 + 0.04, S.skin);
    }
    if (delivery) g.fill(-0.66, 1.0, -0.26, -0.16, 1.55, 0.26, S.box);
    else g.fill(-0.58, 0.55, -0.1, -0.34, 0.78, 0.1, S.cargo);
    add(g, 0);
    for (const [part, cx] of [[7, -0.44], [8, 0.44]]) {
      g = mk();
      for (let a = 0; a < 56; a++) g.set(cx + Math.cos((a / 56) * TAU) * 0.34, 0.34 + Math.sin((a / 56) * TAU) * 0.34, 0, S.rubber);
      for (let a = 0; a < 4; a++) g.line(cx, 0.34, 0, cx + Math.cos((a / 4) * TAU + 0.4) * 0.3, 0.34 + Math.sin((a / 4) * TAU + 0.4) * 0.3, 0, 0.03, S.metal);
      add(g, part);
    }
    for (const [part, zc] of [[1, 0.11], [2, -0.11]]) {
      g = mk();
      g.fill(0.1, 0.5, zc - 0.075, 0.22, 0.98, zc + 0.075, S.pants);
      add(g, part);
    }
    for (const [part, zc] of [[5, 0.11], [6, -0.11]]) {
      g = mk();
      g.fill(0.11, 0.1, zc - 0.065, 0.21, 0.5, zc + 0.065, S.pants);
      g.fill(0.09, 0.02, zc - 0.075, 0.3, 0.1, zc + 0.075, S.shoe);
      add(g, part);
    }
    return b;
  }
  function pigeonBuilder() {
    const vs = 0.03, b = new PU.GeoBuilder();
    const mk = () => VG.box(-0.3, -0.01, -0.2, 0.3, 0.4, 0.2, vs);
    const add = (g, part) => PU.meshGrid(g, b, { flags: part, ao: 0.5 });
    let g = mk();
    g.ellipsoid(-0.01, 0.12, 0, 0.13, 0.075, 0.065, S.pg);
    g.fill(-0.22, 0.11, -0.035, -0.11, 0.14, 0.035, S.pg);
    g.ellipsoid(0.08, 0.16, 0, 0.06, 0.05, 0.05, S.pgd);
    add(g, 0);
    g = mk();
    g.sphere(0.14, 0.2, 0, 0.042, S.pg);
    g.fill(0.17, 0.19, -0.008, 0.21, 0.205, 0.008, S.beak);
    g.fill(0.11, 0.2, -0.03, 0.135, 0.225, 0.03, S.pgd);
    add(g, 1);
    for (const [part, zs] of [[3, 1], [4, -1]]) {
      g = mk();
      g.fill(-0.1, 0.12, zs > 0 ? 0.045 : -0.14, 0.06, 0.16, zs > 0 ? 0.14 : -0.045, S.pgd);
      add(g, part);
    }
    for (const [part, zc] of [[5, 0.03], [6, -0.03]]) {
      g = mk();
      g.fill(-0.01, 0.0, zc - 0.012, 0.03, 0.07, zc + 0.012, S.pgn);
      g.fill(-0.01, 0.0, zc - 0.012, 0.06, 0.02, zc + 0.012, S.pgn);
      add(g, part);
    }
    return b;
  }

  /* ---------------- vehicles ---------------- */
  function interp(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const t = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]); return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t; }
    return pts[pts.length - 1][1];
  }
  function vehicleBuilder(p) {
    const vs = 0.1;
    const g = VG.box(-p.L / 2 - 0.1, 0, -p.W / 2 - 0.1, p.L / 2 + 0.1, p.H + 0.2, p.W / 2 + 0.1, vs);
    const body = p.body || M.carBody;
    const prof = [[-p.L / 2, p.trunkH], [p.cabin0 - 0.28, p.trunkH + 0.03], [p.cabin0, p.cabinH], [p.cabin1, p.cabinH], [p.cabin1 + p.slope, p.hoodH], [p.L / 2 - 0.06, p.hoodH - 0.04], [p.L / 2, p.hoodH - 0.22]];
    const cw = p.W / 2 - 0.09;
    g.fillFn(-p.L / 2, 0.26, -p.W / 2, p.L / 2, p.H, p.W / 2, (x, y, z) => {
      const top = interp(prof, x);
      if (y > top) return undefined;
      const az = Math.abs(z);
      if (y > p.belt && az > cw + 0.03 && x > p.cabin0 - 0.3 && x < p.cabin1 + p.slope) return undefined;
      if (az > p.W / 2 - 0.02 && y > p.belt - 0.18 && y < p.belt + 0.02) return undefined;
      if (y > p.belt && x > p.cabin0 + 0.12 && x < p.cabin1 - 0.08 && az > cw - 0.1 && y < top - 0.09 && y > p.belt + 0.06 && (p.pillar === undefined || Math.abs(x - p.pillar) > 0.09)) return M.glassDay2;
      if (y > p.hoodH - 0.02 && x > p.cabin1 - 0.02 && x < p.cabin1 + p.slope + 0.05 && y < p.cabinH - 0.04 && az < cw - 0.05) return M.glassDay;
      if (x < p.cabin0 + 0.02 && x > p.cabin0 - 0.32 && y > p.trunkH + 0.03 && y < p.cabinH - 0.04 && az < cw - 0.05) return M.glassDay;
      if (p.busWindows && y > 1.2 && y < 2.45 && az > p.W / 2 - 0.12 && x > -p.L / 2 + 0.7 && x < p.L / 2 - 1.0 && (Math.floor((x + p.L) / 1.4) % 1 === 0) && ((x + p.L) % 1.4) > 0.16) return M.glassDay3;
      if (p.stripe && y > 0.8 && y < 1.05) return p.stripe;
      return body;
    });
    // wheels (axle along z) and lights
    for (const wx of p.wheels) {
      for (const sz of [-1, 1]) {
        const wz = sz * (p.W / 2 - 0.13);
        g.fillFn(wx - 0.36, 0, wz - 0.13, wx + 0.36, 0.72, wz + 0.13, (x, y, z) => {
          const d = Math.hypot(x - wx, y - p.wr);
          if (d > p.wr) return undefined;
          return d < 0.13 ? M.ironLt : M.tyre;
        });
      }
    }
    for (const sz of [-1, 1]) {
      g.fill(p.L / 2 - 0.12, p.hoodH - 0.36, sz * (p.W / 2 - 0.5) - 0.15, p.L / 2, p.hoodH - 0.2, sz * (p.W / 2 - 0.5) + 0.15, M.headlamp, 0);
      g.fill(-p.L / 2, p.trunkH - 0.34, sz * (p.W / 2 - 0.35) - 0.15, -p.L / 2 + 0.1, p.trunkH - 0.14, sz * (p.W / 2 - 0.35) + 0.15, M.tailLamp, 0);
    }
    if (p.sign) g.fill(-0.1, p.cabinH, -0.2, 0.25, p.cabinH + 0.16, 0.2, M.lampGlow, 0);
    const b = new PU.GeoBuilder();
    PU.meshGrid(g, b, { skip: [0, 0, 0, 0, 0, 0], ao: 0.7 });
    return b;
  }
  const VEH = {
    hatch: { L: 3.9, W: 1.72, H: 1.5, trunkH: 0.9, cabin0: -1.05, cabin1: 0.55, cabinH: 1.44, hoodH: 0.84, slope: 0.5, belt: 0.92, wheels: [1.2, -1.2], wr: 0.3 },
    sedan: { L: 4.5, W: 1.78, H: 1.45, trunkH: 0.95, cabin0: -0.95, cabin1: 0.55, cabinH: 1.4, hoodH: 0.86, slope: 0.6, belt: 0.93, wheels: [1.4, -1.35], wr: 0.31, pillar: -0.15 },
    taxi: { L: 4.5, W: 1.78, H: 1.62, trunkH: 0.95, cabin0: -0.95, cabin1: 0.55, cabinH: 1.4, hoodH: 0.86, slope: 0.6, belt: 0.93, wheels: [1.4, -1.35], wr: 0.31, pillar: -0.15, body: M.carTaxi, sign: true },
    van: { L: 5.2, W: 1.98, H: 2.4, trunkH: 2.25, cabin0: -2.6, cabin1: 1.25, cabinH: 2.25, hoodH: 1.15, slope: 0.55, belt: 1.15, wheels: [1.65, -1.55], wr: 0.34, body: M.vanBody },
    bus: { L: 11.4, W: 2.5, H: 3.15, trunkH: 3.05, cabin0: -5.7, cabin1: 5.0, cabinH: 3.05, hoodH: 2.4, slope: 0.7, belt: 2.4, wheels: [3.6, -3.4, -4.6], wr: 0.5, body: M.busWhite, stripe: M.busStripe, busWindows: true },
  };
  const CAR_COLS = [[0.88, 0.88, 0.86], [0.7, 0.72, 0.75], [0.35, 0.36, 0.4], [0.2, 0.2, 0.22], [0.3, 0.42, 0.6], [0.62, 0.22, 0.2], [0.34, 0.5, 0.4], [0.78, 0.72, 0.58], [0.5, 0.36, 0.28], [0.92, 0.92, 0.9]];

  /* ---------------- simulation ---------------- */
  const Sim = (PU.Sim = {});
  Sim.init = function (renderer) {
    const rng = new PU.RNG((PU.SEED | 0) + 555);
    Sim.rng = rng;
    Sim.renderer = renderer;
    renderer.setPalette(buildPalette());
    const mkInst = (name, builder, max, rig, radius, opts) => {
      const m = new PU.InstModel(renderer, name, [{ builder, maxDist: 1e9 }], max, Object.assign({ dynamic: true, rig, radius: radius || 2 }, opts || {}));
      renderer.addInst(m);
      return m;
    };
    Sim.mPerson = mkInst('person', personBuilder(), 420, 0, 1.2);
    Sim.mCyc = mkInst('cyclist', cyclistBuilder(false), 24, 1, 1.4);
    Sim.mDel = mkInst('delivery', cyclistBuilder(true), 8, 1, 1.4);
    Sim.mPig = mkInst('pigeon', pigeonBuilder(), 48, 2, 0.4);
    Sim.buf = { person: new Float32Array(420 * 12), cyc: new Float32Array(24 * 12), del: new Float32Array(8 * 12), pig: new Float32Array(48 * 12) };
    // vehicles (dynamic)
    Sim.vm = {};
    for (const k of ['hatch', 'sedan', 'taxi', 'van', 'bus']) {
      const m = new PU.InstModel(renderer, 'car-' + k, [{ builder: vehicleBuilder(VEH[k]), maxDist: 1e9 }], 60, { dynamic: true, radius: 6 });
      renderer.addInst(m);
      Sim.vm[k] = { model: m, buf: new Float32Array(60 * 12), n: 0 };
    }
    buildWalkGraph();
    spawnPeople(rng);
    buildRoutes();
    spawnCars(rng);
    parkedCars(renderer, rng);
    Sim.lastSun = null;
    Sim.blobAlpha = 0.34;
    console.log('[sim] people ' + Sim.people.length + ', cars ' + Sim.cars.length + ', graph nodes ' + Sim.nodes.length);
  };

  /* ---------- walkability + waypoint graph ---------- */
  function buildWalkGraph() {
    const res = 0.5, x0 = -110, z0 = -80, nx = 440, nz = 320;
    const ok = new Uint8Array(nx * nz);
    const kid = new Uint8Array(nx * nz);
    const mon = L.monument, rom = L.roman, fo = L.fountain;
    const circles = info.obstacles.filter((o) => o[2] < 8);
    for (let j = 0; j < nz; j++) {
      const z = z0 + (j + 0.5) * res;
      for (let i = 0; i < nx; i++) {
        const x = x0 + (i + 0.5) * res;
        const ax = Math.abs(x), az = Math.abs(z);
        let good = ax < 109.3 && az < 79.3;
        if (good) {
          const d = Math.min(110 - ax, 80 - az);
          if (d > 6.0 && d < 12.5 && !L.crossing(x, z)) good = false;
        }
        if (good) {
          const c = L.groundCell(x, z, 0.5);
          if (c.skip || c.kind === 'lawn' || c.kind === 'rim' || c.kind === 'water') {
            if (c.kind === 'water' || c.kind === 'rim') {
              if (Math.abs(x - fo.x) < fo.hw + 0.5 && Math.abs(z - fo.z) < fo.hd + 0.5) kid[i + j * nx] = c.kind === 'water' && Math.abs(c.h) < 0.2 ? 1 : 0;
            }
            good = false;
          }
        }
        if (good && L.churchDist(x, z) < 0.9) good = false;
        if (good && Math.abs(x - mon.x) < mon.hw + 0.6 && Math.abs(z - mon.z) < mon.hd + 0.6) good = false;
        if (good && Math.abs(x - rom.x) < rom.hw + 0.5 && Math.abs(z - rom.z) < rom.hd + 0.5) good = false;
        if (good) for (const o of circles) { const r = Math.min(o[2], 2.0) * 0.72; if ((o[0] - x) * (o[0] - x) + (o[1] - z) * (o[1] - z) < r * r) { good = false; break; } }
        ok[i + j * nx] = good ? 1 : 0;
      }
    }
    const W = (Sim.wg = { ok, kid, res, x0, z0, nx, nz });
    W.at = (x, z) => {
      const i = Math.floor((x - x0) / res), j = Math.floor((z - z0) / res);
      return i < 0 || j < 0 || i >= nx || j >= nz ? 0 : ok[i + j * nx];
    };
    W.clear = (ax, az, bx, bz, m) => {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(len / 0.5));
      const px = -(bz - az) / (len || 1), pz = (bx - ax) / (len || 1);
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        if (!W.at(x, z) || !W.at(x + px * m, z + pz * m) || !W.at(x - px * m, z - pz * m)) return false;
      }
      return true;
    };
    // nodes: jittered grid over the walkable area
    const nodes = [];
    const step = 6.5;
    const rng = new PU.RNG(4321);
    for (let z = -78; z <= 78; z += step)
      for (let x = -108; x <= 108; x += step) {
        const jx = x + rng.range(-1.6, 1.6), jz = z + rng.range(-1.6, 1.6);
        let good = true;
        for (const [ox, oz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7]]) if (!W.at(jx + ox * 1.1, jz + oz * 1.1)) { good = false; break; }
        if (good) nodes.push({ x: jx, z: jz, adj: [] });
      }
    // crossing nodes on both sides of the ring road
    for (const side of ['N', 'S', 'E', 'W']) for (const c of L.crossCenters[side]) {
      const pts = side === 'N' ? [[c, -66.4], [c, -73.6]] : side === 'S' ? [[c, 66.4], [c, 73.6]] : side === 'E' ? [[96.4, c], [103.6, c]] : [[-96.4, c], [-103.6, c]];
      for (const [x, z] of pts) if (W.at(x, z)) nodes.push({ x, z, adj: [] });
    }
    // edges
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const dx = nodes[b].x - nodes[a].x, dz = nodes[b].z - nodes[a].z;
        const d = Math.hypot(dx, dz);
        if (d > 15) continue;
        if (W.clear(nodes[a].x, nodes[a].z, nodes[b].x, nodes[b].z, 0.55)) { nodes[a].adj.push(b); nodes[b].adj.push(a); }
      }
    }
    // keep the largest connected component
    const comp = new Int32Array(nodes.length).fill(-1);
    let best = -1, bestN = 0;
    for (let s = 0; s < nodes.length; s++) {
      if (comp[s] >= 0) continue;
      const q = [s]; comp[s] = s; let n = 0;
      while (q.length) { const u = q.pop(); n++; for (const v of nodes[u].adj) if (comp[v] < 0) { comp[v] = s; q.push(v); } }
      if (n > bestN) { bestN = n; best = s; }
    }
    Sim.nodes = nodes.filter((n, i) => comp[i] === best);
    const remap = new Map();
    nodes.forEach((n, i) => { if (comp[i] === best) remap.set(i, Sim.nodes.indexOf(n)); });
    Sim.nodes.forEach((n) => { n.adj = n.adj.filter((v) => remap.has(v)).map((v) => remap.get(v)); });
    // special nodes
    const nearestNode = (x, z) => { let bi = 0, bd = 1e9; Sim.nodes.forEach((n, i) => { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; };
    Sim.nearestNode = nearestNode;
    // photo spots: around the church and the monument
    Sim.photo = [];
    Sim.nodes.forEach((n, i) => {
      const dc = L.churchDist(n.x, n.z);
      const dm = Math.hypot(n.x - L.monument.x, n.z - L.monument.z);
      if ((dc > 5 && dc < 22 && n.z > -12) || (dm > 8 && dm < 26)) Sim.photo.push(i);
    });
  }

  function spawnPeople(rng) {
    const P = (Sim.people = []);
    const pick = (a) => a[Math.floor(rng.f() * a.length)];
    const look = (kid) => ({ shirt: 16 + Math.floor(rng.f() * 24), pants: 40 + Math.floor(rng.f() * 8), hair: 48 + Math.floor(rng.f() * 8), skin: 56 + Math.floor(rng.f() * 8), s: kid ? rng.range(0.62, 0.74) : rng.range(0.93, 1.07) });
    const nodes = Sim.nodes;
    const focusChurch = [L.hallCenterX, 8, L.church.oz + 2];
    // walkers: individuals and small groups
    const nW = 78;
    for (let i = 0; i < nW; i++) {
      const start = Math.floor(rng.f() * nodes.length);
      const gsize = rng.chance(0.28) ? rng.int(2, 3) : 1;
      let leader = null;
      for (let k = 0; k < gsize; k++) {
        const p = Object.assign(look(false), {
          kind: 'walk', x: nodes[start].x + rng.range(-1, 1), z: nodes[start].z + rng.range(-1, 1), yaw: rng.range(0, TAU), node: start, target: start, prev: -1,
          speed: rng.range(1.0, 1.5), phase: rng.range(0, TAU), idle: 0, walk: 1, pose: 0, leader, off: [rng.range(-0.8, 0.8), rng.range(-0.8, 0.8)], tx: nodes[start].x, tz: nodes[start].z,
        });
        if (k === 0) leader = p;
        P.push(p);
      }
    }
    // tourists photographing the church / monument
    for (let i = 0; i < 26; i++) {
      const sp = Sim.photo[Math.floor(rng.f() * Sim.photo.length)];
      const n = nodes[sp];
      const mon = rng.chance(0.5);
      P.push(Object.assign(look(false), {
        kind: 'tourist', x: n.x, z: n.z, yaw: 0, node: sp, target: sp, prev: -1, speed: rng.range(0.9, 1.3), phase: rng.range(0, TAU), idle: rng.range(2, 12), walk: 0, pose: 2, leader: null, off: [0, 0], tx: n.x, tz: n.z,
        focus: mon ? [L.monument.x, 6, L.monument.z] : [focusChurch[0] + rng.range(-10, 10), 12, focusChurch[2]],
      }));
    }
    // bench sitters and café patrons
    const seatPick = (arr, frac) => arr.filter(() => rng.chance(frac));
    for (const s of seatPick(info.benchSeats, 0.4)) P.push(Object.assign(look(false), { kind: 'sit', x: s.x, z: s.z, yaw: Math.atan2(-s.fz, s.fx) + rng.range(-0.15, 0.15), phase: rng.range(0, TAU), walk: 0, pose: 1 }));
    for (const s of seatPick(info.seats, 0.5)) P.push(Object.assign(look(false), { kind: 'sit', x: s.x, z: s.z, yaw: Math.atan2(-s.fz, s.fx), phase: rng.range(0, TAU), walk: 0, pose: 1 }));
    // children playing at the fountain
    const fo = L.fountain;
    for (let i = 0; i < 9; i++) {
      const p = Object.assign(look(true), { kind: 'kid', x: fo.x + rng.range(-14, 14), z: fo.z + rng.range(-5, 5), yaw: rng.range(0, TAU), speed: rng.range(1.5, 2.4), phase: rng.range(0, TAU), walk: 1, pose: 0, change: 0, hx: 0, hz: 0 });
      p.hx = Math.cos(p.yaw); p.hz = -Math.sin(p.yaw);
      P.push(p);
    }
    // parents watching near the fountain
    for (let i = 0; i < 4; i++) {
      const sp = Sim.nearestNode(fo.x + rng.range(-16, 16), fo.z + (rng.chance(0.5) ? -1 : 1) * (fo.hd + 2.8));
      const n = nodes[sp];
      P.push(Object.assign(look(false), { kind: 'tourist', x: n.x, z: n.z, yaw: 0, node: sp, target: sp, prev: -1, speed: 1.1, phase: 0, idle: rng.range(4, 20), walk: 0, pose: 0, leader: null, off: [0, 0], tx: n.x, tz: n.z, focus: [fo.x, 0.5, fo.z] }));
    }
    // cyclists on loops crossing the square, delivery bikes on the ring road
    Sim.cyc = [];
    const loops = [
      [[-88, -57], [88, -57], [88, 57], [-88, 57]],
      [[-62, -46], [62, -46], [62, 40], [-62, 40]],
    ];
    Sim.loops = loops.map((pts) => {
      const q = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(1, Math.round(len / 2));
        for (let k = 0; k < n; k++) q.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
      }
      return q;
    });
    for (let i = 0; i < 9; i++) {
      const loop = Sim.loops[i % 2];
      Sim.cyc.push(Object.assign(look(false), { loop, idx: rng.range(0, loop.length), speed: rng.range(3.6, 5.0), phase: 0, delivery: false, dir: i % 3 === 0 ? -1 : 1 }));
    }
    Sim.ringLoop = null; // set when routes are built
  }

  /* ---------- roads: ring polyline and routes ---------- */
  function buildRoutes() {
    // one-way counter-clockwise ring centre line (right-hand traffic), rounded corners
    const cx = 110 - 9.25, cz = 80 - 9.25, R = 9;
    const ring = [];
    const arc = (ox, oz, a0, a1, n) => { for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; ring.push([ox + Math.cos(a) * R, oz + Math.sin(a) * R]); } };
    const line = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0); const n = Math.max(1, Math.round(len / 2)); for (let i = 0; i < n; i++) ring.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n]); };
    line(cx, cz - R, cx, -cz + R);
    arc(cx - R, -cz + R, 0, -Math.PI / 2, 8);
    line(cx - R, -cz, -cx + R, -cz);
    arc(-cx + R, -cz + R, -Math.PI / 2, -Math.PI, 8);
    line(-cx, -cz + R, -cx, cz - R);
    arc(-cx + R, cz - R, Math.PI, Math.PI / 2, 8);
    line(-cx + R, cz, cx - R, cz);
    arc(cx - R, cz - R, Math.PI / 2, 0, 8);
    Sim.ring = ring;
    const near = (x, z) => { let bi = 0, bd = 1e9; ring.forEach((p, i) => { const d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; };
    const spokes = ['B', 'C', 'D', 'E'].map((id) => L.streets.find((s) => s.id === id));
    const resample = (pts, maxLen) => {
      const q = [];
      let acc = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(1, Math.round(len / 2));
        for (let k = 0; k < n; k++) { acc += len / n; if (acc > maxLen) return q; q.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); }
      }
      return q;
    };
    // offset a centre line to the right of travel; `offs` is a per-point offset (metres), blurred so lane changes are smooth
    const offsetLine = (pts, offs) => {
      const sm = offs.map((_, i) => {
        let s = 0, n = 0;
        for (let k = -6; k <= 6; k++) { const j = i + k; if (j >= 0 && j < offs.length) { s += offs[j]; n++; } }
        return s / n;
      });
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let tx = b[0] - a[0], tz = b[1] - a[1];
        const l = Math.hypot(tx, tz) || 1;
        tx /= l; tz /= l;
        // right-hand normal of the heading (tx,tz) on a north-up (z down) map is (-tz, tx)
        out.push([pts[i][0] - tz * sm[i], pts[i][1] + tx * sm[i]]);
      }
      return out;
    };
    Sim.routes = [];
    const lanes = [-1.4, 1.4];
    for (const sIn of spokes) {
      for (const sOut of spokes) {
        if (sIn === sOut) continue;
        const inPts = resample(sIn.pts, 520).reverse();
        const outPts = resample(sOut.pts, 520);
        const iIn = near(sIn.pts[0][0], sIn.pts[0][1]), iOut = near(sOut.pts[0][0], sOut.pts[0][1]);
        const arcPts = [];
        for (let i = iIn; i !== iOut; i = (i + 1) % ring.length) arcPts.push(ring[i]);
        arcPts.push(ring[iOut]);
        for (const lane of lanes) {
          const base = inPts.concat(arcPts, outPts);
          const offs = inPts.map(() => 1.8).concat(arcPts.map(() => lane), outPts.map(() => 1.8));
          const pts = offsetLine(base, offs);
          const cum = new Float32Array(pts.length);
          for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          Sim.routes.push({ pts, cum, len: cum[pts.length - 1], ids: sIn.id + sOut.id });
        }
      }
    }
    // delivery riders on the ring road
    Sim.ringCum = new Float32Array(ring.length);
    for (let i = 1; i < ring.length; i++) Sim.ringCum[i] = Sim.ringCum[i - 1] + Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]);
    Sim.ringLen = Sim.ringCum[ring.length - 1] + Math.hypot(ring[0][0] - ring[ring.length - 1][0], ring[0][1] - ring[ring.length - 1][1]);
  }

  function spawnCars(rng) {
    const cars = (Sim.cars = []);
    const types = ['hatch', 'hatch', 'sedan', 'sedan', 'taxi', 'hatch', 'van', 'sedan', 'taxi', 'hatch', 'sedan', 'van', 'hatch', 'sedan', 'hatch', 'taxi', 'hatch', 'sedan', 'hatch', 'van', 'sedan', 'hatch', 'sedan', 'hatch', 'taxi', 'hatch'];
    types.forEach((t, i) => {
      const route = Sim.routes[Math.floor(rng.f() * Sim.routes.length)];
      cars.push({ type: t, route, s: rng.range(0, route.len), v: 0, vmax: rng.range(5.5, 9), col: CAR_COLS[Math.floor(rng.f() * CAR_COLS.length)], x: 0, z: 0, yaw: 0, wait: 0 });
    });
    // two buses on the outer boulevard
    for (let i = 0; i < 3; i++) {
      const route = Sim.routes.filter((r) => r.ids[0] === 'D' || r.ids[1] === 'D')[i % 3];
      cars.push({ type: 'bus', route, s: rng.range(0, route.len * 0.8), v: 0, vmax: rng.range(5, 6.5), col: [1, 1, 1], x: 0, z: 0, yaw: 0, wait: 0 });
    }
    // delivery cyclists on the ring
    for (let i = 0; i < 3; i++) {
      Sim.cyc.push({ loop: Sim.ring, idx: rng.range(0, Sim.ring.length), speed: rng.range(4.2, 5.4), phase: 0, delivery: true, dir: 1, shirt: 16 + 9, pants: 42, hair: 49, skin: 58, s: 1, lane: 3.0 });
    }
  }

  function parkedCars(renderer, rng) {
    const g = L.grid;
    const lists = { hatch: [], sedan: [], van: [] };
    const seen = [];
    for (const st of L.streets) {
      if (st.ped || st.boulevard === undefined && st.id[0] === 'L') continue;
      const half = st.w / 2 - st.sw - 1.15;
      for (let i = 0; i < st.pts.length - 1; i++) {
        const a = st.pts[i], b = st.pts[i + 1];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len;
        for (let d = 3; d < len - 2; d += rng.range(5.5, 9)) {
          for (const sd of [1, -1]) {
            if (!rng.chance(0.36)) continue;
            const x = a[0] + tx * d - tz * sd * half, z = a[1] + tz * d + tx * sd * half;
            if (Math.abs(x) < 115 && Math.abs(z) < 86) continue;
            if (Math.hypot(x, z) > 470) continue;
            if (g.get(x, z) !== L.T.ROAD) continue;
            const yaw = Math.atan2(-tz, tx) + (sd > 0 ? 0 : Math.PI);
            const type = rng.chance(0.08) ? 'van' : rng.chance(0.4) ? 'sedan' : 'hatch';
            const col = CAR_COLS[Math.floor(rng.f() * CAR_COLS.length)];
            lists[type].push(x, L.baseHeightAt(x, z), z, yaw, 1, col[0], col[1], col[2], 0, 0, 0, 0);
          }
        }
      }
    }
    for (const k in lists) {
      const m = new PU.InstModel(renderer, 'parked-' + k, [{ builder: vehicleBuilder(VEH[k]), maxDist: 1e9 }], Math.max(4, lists[k].length / 12 + 4), { cast: true, radius: 4, shadowLod: 0 });
      const f = new Float32Array(lists[k]);
      m.setAll(f, f.length / 12);
      renderer.addInst(m);
    }
  }

  /* ---------- per-frame update ---------- */
  const wrapAngle = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const turnTo = (cur, target, rate) => cur + Math.max(-rate, Math.min(rate, wrapAngle(target - cur)));

  Sim.update = function (dt, time, env, cam, renderer) {
    if (!Sim.people) return;
    dt = Math.min(dt, 0.05);
    const rng = Sim.rng, nodes = Sim.nodes;
    const B = Sim.buf;
    let np = 0, nc = 0, nd = 0, npg = 0;
    const pb = B.person;
    const put = (arr, n, x, y, z, yaw, s, ph, walk, pose, a, b, c, d) => {
      const o = n * 12;
      arr[o] = x; arr[o + 1] = y; arr[o + 2] = z; arr[o + 3] = yaw; arr[o + 4] = s; arr[o + 5] = ph; arr[o + 6] = walk; arr[o + 7] = pose; arr[o + 8] = a; arr[o + 9] = b; arr[o + 10] = c; arr[o + 11] = d;
    };
    // blob shadows
    const sd = env.sunDir;
    const hl = Math.hypot(sd[0], sd[2]) || 1;
    const dirx = -sd[0] / hl, dirz = -sd[2] / hl;
    const el = Math.max(0.18, Math.atan2(sd[1], hl));
    const cot = Math.min(6, 1 / Math.tan(el));
    const blobYaw = Math.atan2(-dirz, dirx);
    const bd = renderer.blobData;
    let nb = 0;
    const blob = (x, y, z, h, w, a) => {
      if (nb >= 1000) return;
      const len = h * cot * 0.5 + 0.18;
      const o = nb * 8;
      bd[o] = x + dirx * len; bd[o + 1] = y; bd[o + 2] = z + dirz * len; bd[o + 3] = blobYaw;
      bd[o + 4] = len + 0.1; bd[o + 5] = w; bd[o + 6] = a; bd[o + 7] = 0;
      nb++;
    };
    const wantShadow = (x, z) => { const dx = x - cam.pos[0], dz = z - cam.pos[2]; return dx * dx + dz * dz < 520 * 520; };
    const alpha = 0.3 + 0.1 * env.night;
    const W = Sim.wg;

    // pedestrians
    for (const p of Sim.people) {
      if (p.kind === 'walk' || p.kind === 'tourist') {
        if (p.kind === 'walk' && p.leader) {
          // group followers trail the leader
          const dx = p.leader.x + p.off[0] - p.x, dz = p.leader.z + p.off[1] - p.z;
          const d = Math.hypot(dx, dz);
          const sp = Math.min(p.leader.speed * 1.15 * (p.leader.walk ? 1 : 0) + (d > 1.5 ? 0.6 : 0), 2.2);
          if (d > 0.9 && p.leader.walk) { p.x += (dx / d) * sp * dt; p.z += (dz / d) * sp * dt; p.yaw = turnTo(p.yaw, Math.atan2(-dz, dx), 6 * dt); p.walk = 1; p.phase += sp * dt * 5.2; }
          else { p.walk = Math.max(0, p.walk - dt * 4); if (p.leader.idle > 0) p.yaw = turnTo(p.yaw, p.leader.yaw + 0.5, 2 * dt); }
        } else if (p.idle > 0) {
          p.idle -= dt;
          p.walk = Math.max(0, p.walk - dt * 5);
          if (p.kind === 'tourist' && p.focus) p.yaw = turnTo(p.yaw, Math.atan2(-(p.focus[2] - p.z), p.focus[0] - p.x), 3 * dt);
          else p.yaw += Math.sin(time * 0.7 + p.phase) * 0.3 * dt;
          p.pose = p.kind === 'tourist' && p.focus && p.focus[1] > 1 ? 2 : 0;
        } else {
          p.pose = 0;
          if (p.target === p.node || Math.hypot(p.tx - p.x, p.tz - p.z) < 0.5) {
            // arrived: choose the next node
            p.prev = p.node;
            p.node = p.target;
            const nn = nodes[p.node];
            const adj = nn.adj;
            if (p.kind === 'tourist' && Sim.photo.length && rng.chance(0.5) && !(p.focus && p.focus[1] > 1 && p.idle === 0 && rng.chance(0.4))) {
              // wander toward another photo spot
              let best = adj[Math.floor(rng.f() * adj.length)];
              p.target = best;
            } else {
              let cand = adj[Math.floor(rng.f() * adj.length)];
              // prefer not to go back
              if (adj.length > 1 && cand === p.prev) cand = adj[Math.floor(rng.f() * adj.length)];
              p.target = cand === undefined ? p.node : cand;
            }
            const tn = nodes[p.target];
            p.tx = tn.x + rng.range(-0.35, 0.35);
            p.tz = tn.z + rng.range(-0.35, 0.35);
            if (p.kind === 'tourist' && Sim.photo.indexOf(p.node) >= 0 && rng.chance(0.55)) {
              p.idle = rng.range(5, 13);
              const mon = rng.chance(0.5);
              p.focus = mon ? [L.monument.x, 6, L.monument.z] : [L.hallCenterX + rng.range(-12, 12), 14, L.church.oz + 2];
            } else if (p.kind === 'walk' && rng.chance(0.07)) p.idle = rng.range(1.5, 5);
          }
          const dx = p.tx - p.x, dz = p.tz - p.z;
          const d = Math.hypot(dx, dz) || 1;
          const nx2 = p.x + (dx / d) * p.speed * dt, nz2 = p.z + (dz / d) * p.speed * dt;
          if (W.at(nx2, nz2) || !W.at(p.x, p.z)) { p.x = nx2; p.z = nz2; }
          else { p.tx = p.x; p.tz = p.z; p.target = p.node; }
          p.yaw = turnTo(p.yaw, Math.atan2(-dz, dx), 7 * dt);
          p.walk = Math.min(1, p.walk + dt * 5);
          p.phase += p.speed * dt * 5.4;
        }
      } else if (p.kind === 'kid') {
        p.change -= dt;
        if (p.change <= 0) {
          p.change = rng.range(0.8, 2.6);
          const a = rng.range(0, TAU);
          p.hx = Math.cos(a); p.hz = Math.sin(a);
          const fo = L.fountain;
          // steer back towards the fountain if wandering off
          const ox = p.x - fo.x, oz = p.z - fo.z;
          if (Math.abs(ox) > fo.hw + 2 || Math.abs(oz) > fo.hd + 2) { const l = Math.hypot(ox, oz) || 1; p.hx = -ox / l + p.hx * 0.3; p.hz = -oz / l + p.hz * 0.3; }
        }
        const nx2 = p.x + p.hx * p.speed * dt, nz2 = p.z + p.hz * p.speed * dt;
        const fo = L.fountain;
        const inZone = Math.abs(nx2 - fo.x) < fo.hw + 2.2 && Math.abs(nz2 - fo.z) < fo.hd + 2.2;
        const ok = inZone && (W.at(nx2, nz2) || (() => { const i = Math.floor((nx2 - W.x0) / W.res), j = Math.floor((nz2 - W.z0) / W.res); return W.kid[i + j * W.nx] === 1; })());
        if (ok) { p.x = nx2; p.z = nz2; } else { p.change = 0; }
        p.yaw = turnTo(p.yaw, Math.atan2(-p.hz, p.hx), 8 * dt);
        p.phase += p.speed * dt * 6.5;
        p.walk = 1;
      }
      const y = p.kind === 'kid' && Math.abs(p.x - L.fountain.x) < L.fountain.hw ? Math.min(L.groundH(p.x, p.z), 0.15) : L.groundH(p.x, p.z);
      // people sit on seats slightly above the ground line: the shader lowers the pelvis for pose 1
      if (np < 420) {
        put(pb, np++, p.x, y, p.z, p.yaw, p.s, p.phase, p.walk, p.pose, 16 + (p.shirt - 16), p.pants, p.hair, p.skin);
        if (wantShadow(p.x, p.z)) blob(p.x, y, p.z, 1.7 * p.s, 0.3 * p.s + 0.06, alpha);
      }
    }
    // cyclists
    const cb = B.cyc, db = B.del;
    for (const c of Sim.cyc) {
      const loop = c.loop;
      c.idx = (c.idx + c.dir * (c.speed * dt) / 2) % loop.length;
      if (c.idx < 0) c.idx += loop.length;
      const i0 = Math.floor(c.idx), i1 = (i0 + c.dir + loop.length) % loop.length;
      const a = loop[i0], b = loop[(i0 + 1) % loop.length];
      const f = c.idx - i0;
      let x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f;
      let tx = b[0] - a[0], tz = b[1] - a[1];
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl; tz /= tl;
      if (c.dir < 0) { tx = -tx; tz = -tz; }
      if (c.lane) { x += -tz * c.lane; z += tx * c.lane; }
      c.x = x; c.z = z;
      c.yaw = turnTo(c.yaw === undefined ? 0 : c.yaw, Math.atan2(-tz, tx), 4 * dt);
      c.phase += c.speed * dt / 0.34;
      const y = L.groundH(x, z);
      if (c.delivery) { if (nd < 8) put(db, nd++, x, y, z, c.yaw, 1, c.phase, 1, 0, 25, 42, 49, 58); }
      else if (nc < 24) put(cb, nc++, x, y, z, c.yaw, 1, c.phase, 1, 0, c.shirt, c.pants, c.hair, c.skin);
      if (wantShadow(x, z)) blob(x, y, z, 1.7, 0.5, alpha);
    }
    // pigeons: ground flocks near the church and monument, plus a few circling the tower
    if (!Sim.pig) {
      Sim.pig = [];
      const spots = [[-30, 10], [-16, 12], [10, 12], [-6, 30], [-6, 39], [22, -34], [-38, -36], [38, 14], [-60, 20], [50, 30]];
      let i = 0;
      for (const [sx, sz] of spots) for (let k = 0; k < 2; k++) Sim.pig.push({ x: sx + rng.range(-2, 2), z: sz + rng.range(-2, 2), yaw: rng.range(0, TAU), phase: rng.range(0, 30), fly: 0, cx: sx, cz: sz, hop: rng.range(3, 12), ang: 0 });
      for (let k = 0; k < 7; k++) Sim.pig.push({ x: 0, z: 0, yaw: 0, phase: rng.range(0, 30), fly: 1, orbit: true, r: rng.range(10, 20), ang: rng.range(0, TAU), h: rng.range(34, 60), spd: rng.range(0.28, 0.42) * (rng.chance(0.5) ? 1 : -1) });
    }
    const pgb = B.pig;
    for (const g of Sim.pig) {
      if (g.orbit) {
        g.ang += g.spd * dt;
        const cx = L.church.ox - 32, cz = L.church.oz;
        g.x = cx + Math.cos(g.ang) * g.r; g.z = cz + Math.sin(g.ang) * g.r;
        const sg = g.spd > 0 ? 1 : -1;
        const hx = -Math.sin(g.ang) * sg, hz = Math.cos(g.ang) * sg; // tangent of the circle
        g.yaw = Math.atan2(-hz, hx);
        g.phase += dt * 11;
        if (npg < 48) put(pgb, npg++, g.x, g.h + Math.sin(g.ang * 3) * 1.5, g.z, g.yaw, 1.0, g.phase, 0, 2, 0, 0, 0, 0);
        continue;
      }
      // scatter when a person comes close
      if (g.fly === 0) {
        g.phase += dt * 3.2;
        g.hop -= dt;
        if (g.hop <= 0) { g.hop = rng.range(4, 14); g.yaw += rng.range(-1.2, 1.2); }
        let near = false;
        if (Sim.people.length) for (let k = 0; k < Sim.people.length; k += 3) { const p = Sim.people[k]; if ((p.x - g.x) ** 2 + (p.z - g.z) ** 2 < 6 && p.walk > 0.5) { near = true; break; } }
        if (near) { g.fly = 1.2; g.tx = g.cx + rng.range(-7, 7); g.tz = g.cz + rng.range(-7, 7); g.yaw = Math.atan2(-(g.tz - g.z), g.tx - g.x); }
        if (npg < 48) put(pgb, npg++, g.x, L.groundH(g.x, g.z), g.z, g.yaw, 1.0, g.phase, 0, 0, 0, 0, 0, 0);
      } else {
        g.fly -= dt;
        const dx = g.tx - g.x, dz = g.tz - g.z, d = Math.hypot(dx, dz) || 1;
        g.x += (dx / d) * 4.5 * dt; g.z += (dz / d) * 4.5 * dt;
        g.phase += dt * 14;
        const h = Math.sin(Math.max(0, Math.min(1, 1 - g.fly / 1.2)) * Math.PI) * 2.2;
        if (g.fly <= 0) { g.fly = 0; }
        if (npg < 48) put(pgb, npg++, g.x, L.groundH(g.x, g.z) + h, g.z, g.yaw, 1.0, g.phase, 0, g.fly > 0 ? 2 : 0, 0, 0, 0, 0);
      }
    }

    // cars
    for (const k in Sim.vm) Sim.vm[k].n = 0;
    const cars = Sim.cars;
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      const r = c.route;
      // locate segment
      let s = c.s;
      if (s >= r.len - 1) { c.route = Sim.routes[Math.floor(rng.f() * Sim.routes.length)]; c.s = 0; c.wait = rng.range(0, 6); s = 0; if (c.type === 'bus') c.route = Sim.routes.filter((q) => q.ids[0] === 'D' || q.ids[1] === 'D')[Math.floor(rng.f() * 3)]; }
      const R2 = c.route;
      let lo = 0, hi = R2.pts.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (R2.cum[m] <= c.s) lo = m; else hi = m; }
      const a = R2.pts[lo], b = R2.pts[hi];
      const seg = R2.cum[hi] - R2.cum[lo] || 1;
      const f = (c.s - R2.cum[lo]) / seg;
      c.x = a[0] + (b[0] - a[0]) * f; c.z = a[1] + (b[1] - a[1]) * f;
      const hx = (b[0] - a[0]) / seg, hz = (b[1] - a[1]) / seg;
      c.hx = hx; c.hz = hz;
      const ty = Math.atan2(-hz, hx);
      c.yaw = c.yaw === 0 ? ty : turnTo(c.yaw, ty, 4 * dt);
      // braking: cars and pedestrians ahead
      let gap = 1e9;
      for (let j = 0; j < cars.length; j++) {
        if (j === i) continue;
        const o = cars[j];
        const dx = o.x - c.x, dz = o.z - c.z;
        const along = dx * hx + dz * hz;
        if (along > 0 && along < 16 && Math.abs(-dx * hz + dz * hx) < 2.2) gap = Math.min(gap, along - (c.type === 'bus' || o.type === 'bus' ? 8 : 5));
      }
      let ped = 1e9;
      if (Math.abs(c.x) < 112 && Math.abs(c.z) < 82) {
        for (let k = 0; k < Sim.people.length; k += 1) {
          const p = Sim.people[k];
          if (p.kind === 'sit') continue;
          const dx = p.x - c.x, dz = p.z - c.z;
          const along = dx * hx + dz * hz;
          if (along > 0 && along < 9 && Math.abs(-dx * hz + dz * hx) < 2.6) ped = Math.min(ped, along - 3.0);
        }
      }
      const room = Math.min(gap, ped);
      let target = c.vmax;
      if (room < 12) target = Math.max(0, Math.min(target, room * 0.8));
      if (c.wait > 0) { c.wait -= dt; target = 0; }
      c.v += Math.max(-9 * dt, Math.min(2.6 * dt, target - c.v));
      c.s += c.v * dt;
      const y = L.groundH(c.x, c.z);
      const vm = Sim.vm[c.type];
      if (vm.n < 60) {
        put(vm.buf, vm.n++, c.x, y, c.z, c.yaw, 1, c.col[0], c.col[1], c.col[2], 0, 0, 0, 0);
        if (wantShadow(c.x, c.z)) blob(c.x + 0, y, c.z, c.type === 'bus' ? 3.1 : 1.5, c.type === 'bus' ? 1.3 : 0.95, alpha * 1.1);
      }
    }
    // upload
    Sim.mPerson.setAll(B.person, np);
    Sim.mCyc.setAll(B.cyc, nc);
    Sim.mDel.setAll(B.del, nd);
    Sim.mPig.setAll(B.pig, npg);
    for (const k in Sim.vm) Sim.vm[k].model.setAll(Sim.vm[k].buf, Sim.vm[k].n);
    renderer.blobN = nb;
  };
})();

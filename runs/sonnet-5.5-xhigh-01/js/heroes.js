/* Piata Unirii — LOD0 hero buildings: Banffy Palace, the Mirror Buildings (+ Iuliu Maniu continuation), Hotel Continental. 0.25 m voxels. */
(function () {
  'use strict';
  const PU = window.PU;
  const M = PU.M, B = PU.B, Wall = B.Wall, VG = PU.VoxelGrid;
  const P = () => PU.facadePainters;

  /* ---------------- helpers ---------------- */
  function flipX(g) {
    const o = new VG(g.nx, g.ny, g.nz, g.vs, g.ox, g.oy, g.oz);
    for (let k = 0; k < g.nz; k++)
      for (let j = 0; j < g.ny; j++) {
        const row = g.nx * (j + g.ny * k);
        for (let i = 0; i < g.nx; i++) o.data[row + i] = g.data[row + (g.nx - 1 - i)];
      }
    return o;
  }
  /* window on a plane through (px,pz) with outward normal (nx,nz) — works for any horizontal orientation */
  function rotWin(g, px, pz, nx, nz, y0, wid, hgt, o) {
    const tx = -nz, tz = nx;
    const vs = g.vs;
    const r = wid / 2 + 0.7 + 0.5;
    g.fillFn(px - r, y0 - 0.9, pz - r, px + r, y0 + hgt + 1.0, pz + r, (x, y, z) => {
      const d = (x - px) * nx + (z - pz) * nz;
      const s = (x - px) * tx + (z - pz) * tz;
      if (d < -0.9 || d > 0.55) return undefined;
      const inX = Math.abs(s) <= wid / 2 && y >= y0 && y <= y0 + hgt;
      if (inX) {
        if (d < -0.7) return o.glass;
        return 0;
      }
      const fx = Math.abs(s) <= wid / 2 + 0.5 && y >= y0 - 0.5 && y <= y0 + hgt + 0.5;
      if (fx && d >= -0.05) return o.frame;
      return undefined;
    });
  }
  function statue(g, x, y, z, m, sc) {
    sc = sc || 1;
    const v = g.vs;
    g.fill(x - 0.5 * sc, y, z - 0.5 * sc, x + 0.5 * sc, y + 0.7, z + 0.5 * sc, M.limestoneLt, 0); // plinth
    const yy = y + 0.7;
    g.fill(x - 0.22 * sc, yy, z - 0.14 * sc, x + 0.22 * sc, yy + 0.9 * sc, z + 0.14 * sc, m, 0); // legs / robe
    g.fill(x - 0.3 * sc, yy + 0.9 * sc, z - 0.16 * sc, x + 0.3 * sc, yy + 1.6 * sc, z + 0.16 * sc, m, 0); // torso
    g.sphere(x, yy + 1.85 * sc, z, 0.2 * sc, m);
    g.fill(x + 0.28 * sc, yy + 1.1 * sc, z - 0.08 * sc, x + 0.44 * sc, yy + 2.3 * sc, z + 0.08 * sc, m, 0); // raised arm
    g.fill(x - 0.44 * sc, yy + 0.6 * sc, z - 0.08 * sc, x - 0.28 * sc, yy + 1.5 * sc, z + 0.08 * sc, m, 0);
  }
  function dome(g, cx, cz, y0, r, hd, matDome, matBand, matTop) {
    g.cylY(cx, cz, r + 0.3, y0 - 0.5, y0 + 0.5, matBand);
    g.fillFn(cx - r, y0 + 0.5, cz - r, cx + r, y0 + 0.5 + hd + 2.5, cz + r, (x, y, z) => {
      const t = (y - y0 - 0.5) / hd;
      if (t > 1.0) return undefined;
      const rr = r * Math.sqrt(Math.max(0, 1 - t * t)) * (1 + 0.1 * Math.sin(t * 3.0));
      const d = Math.hypot(x - cx, z - cz);
      return d <= rr ? matDome : undefined;
    });
    g.fill(cx - 0.12, y0 + 0.5 + hd - 0.3, cz - 0.12, cx + 0.12, y0 + 0.5 + hd + 1.6, cz + 0.12, matTop, 0);
    g.sphere(cx, y0 + 0.5 + hd + 0.5, cz, 0.35, matTop);
  }
  const glassSet = [M.glassDay, M.glassDay2, M.glassDay3];

  /* ---------------- Banffy Palace ---------------- */
  PU.buildBanffy = function () {
    const vs = 0.25, W = 74, D = 34, MB = 14;
    const rng = new PU.RNG(PU.strHash('banffy') ^ (PU.SEED | 0));
    const gl = () => (rng.chance(0.3) ? M.glassLit : rng.pick(glassSet));
    const g = VG.box(-2, -1.5, -4.5, W + 2, 32, D + 2, vs);
    const F = new Wall(g, 0, 0, 'front');
    const wall = M.cream, trim = M.whiteStone, base = M.greyStone, rust = M.greyStoneLt;
    const G = 5.2, Pn = 11.8, A = 15.0, C = 16.4;
    const roofMats = PU.roofSet('roofTerra');
    const { win, doorArch } = P();
    // body: main block + two wings, courtyard between
    g.fill(0, -1.5, 0, W, C, MB, wall);
    g.fill(0, -1.5, 0, 22, C, D, wall);
    g.fill(52, -1.5, 0, W, C, D, wall);
    g.carve(22, 0, MB, 52, 30, D + 1);
    g.fill(22, -0.75, MB, 52, 0, D + 1, M.courtyard, 0);
    // plinth, rusticated ground floor with joints
    F.fill(0, -1.5, 0, W, 1.2, 0.5, base, 0);
    F.fill(0, 1.2, 0, W, G, 0.25, rust, 0);
    for (let y = 1.7; y < G - 0.3; y += 0.75) F.carve(0, y, 0, W, y + vs, 0.26);
    for (let s = 0.5; s < W; s += 1.5) for (let y = 1.2; y < G - 0.3; y += 1.5) F.carve(s, y + 0.75, 0, s + vs, y + 1.5, 0.26);
    // string courses
    F.fill(0, G - 0.5, 0, W, G, 0.6, trim, 0);
    F.fill(0, Pn - 0.5, 0, W, Pn, 0.6, trim, 0);
    // cornice + balustrade
    F.fill(-0.5, A, 0, W + 0.5, A + 0.5, 1.2, trim, 0);
    F.fill(-0.5, A + 0.5, 0, W + 0.5, C, 1.9, trim, 0);
    for (let s = 0; s < W; s += vs * 3) F.carve(s, A + 0.5, 0.9, s + vs * 2, A + 0.75, 1.9);
    F.fill(-0.5, C, 0, W + 0.5, C + 0.4, 1.3, trim, 0);
    for (let s = 0; s < W; s += vs * 2) F.fill(s, C + 0.4, 0.4, s + vs, C + 1.3, 0.9, trim, 0);
    F.fill(-0.5, C + 1.3, 0, W + 0.5, C + 1.7, 1.3, trim, 0);
    for (let s = 0; s <= W; s += 4.5) F.fill(s - 0.3, C + 0.4, 0.2, s + 0.3, C + 1.3, 1.0, trim, 0);
    // side sections: bays of 3.5 m
    const secs = [6, 47];
    for (const s0 of secs) {
      for (let i = 0; i < 6; i++) {
        const c = s0 + 1.75 + 3.5 * i;
        win(F, c, 1.4, 1.6, 3.0, { frame: rust, glass: gl(), arch: true, fw: 0.5 });
        win(F, c, 6.4, 1.7, 4.6, { frame: trim, glass: gl(), hood: i % 2 ? 'triangle' : 'segment', fw: 0.5, mullion: true, transom: true });
        win(F, c, 12.6, 1.2, 1.5, { frame: trim, glass: gl(), fw: 0.5, sill: false });
      }
      for (let i = 0; i <= 6; i++) {
        const s = s0 + 3.5 * i;
        F.fill(s - 0.4, G, 0, s + 0.4, Pn - 0.5, 0.75, trim, 0);
        F.fill(s - 0.65, G, 0, s + 0.65, G + 0.6, 1.0, trim, 0);
        F.fill(s - 0.65, Pn - 1.3, 0, s + 0.65, Pn - 0.5, 1.0, trim, 0);
      }
    }
    // end pavilions: quoins + a taller window each
    for (const s0 of [0, 68]) {
      const c = s0 + 3;
      win(F, c, 1.4, 1.6, 3.0, { frame: rust, glass: gl(), arch: true });
      win(F, c, 6.4, 1.7, 4.6, { frame: trim, glass: gl(), hood: 'triangle', mullion: true, transom: true });
      win(F, c, 12.6, 1.2, 1.5, { frame: trim, glass: gl(), sill: false });
      for (let y = 1.2, alt = 0; y < A; y += 1.0, alt++) {
        F.fill(s0 === 0 ? 0 : 73, y, 0, s0 === 0 ? 1.0 : 74, y + 1.0, alt & 1 ? 0.75 : 0.5, trim, 0);
        F.fill(s0 === 0 ? 5 : 68, y, 0, s0 === 0 ? 6 : 69, y + 1.0, alt & 1 ? 0.5 : 0.75, trim, 0);
      }
    }
    // central pavilion
    const sc = 37;
    F.fill(27, -1.5, 0, 47, A, 2.0, wall, 0);
    F.fill(27, -1.5, 0, 47, 1.2, 2.3, base, 0);
    F.fill(27, 1.2, 1.75, 47, G, 2.0, rust, 0);
    for (let y = 1.7; y < G - 0.3; y += 0.75) F.carve(27, y, 1.74, 47, y + vs, 2.01);
    // grand arched entrance and carriage passage to the courtyard
    const sL = 34.4, sR = 39.6, yTop = 7.6;
    F.shape(sL - 1.0, sR + 1.0, 0, yTop + 1.1, 2.0, 2.7, trim, B.roundArch(sL, sR, 0, yTop, 1.0), 1);
    F.shape(sL, sR, 0, yTop + 0.01, -MB - 0.5, 2.8, 0, B.roundArch(sL, sR, 0, yTop, 0), 0);
    F.fill(sc - 0.5, yTop + 0.5, 2.0, sc + 0.5, yTop + 1.9, 3.1, trim, 0);
    F.fill(sc - 0.3, 0, -MB + 0.2, sc + 0.3, 0.001, -0.5, M.greyStone, 0);
    // lamp inside the passage
    F.fill(sc - 0.2, 4.6, -3.2, sc + 0.2, 5.0, -2.8, M.lampGlow, 0);
    // engaged columns either side of the portal
    for (const cx of [29.4, 31.7, 42.3, 44.6]) {
      g.cylY(cx, -2.35, 0.52, 1.2, G - 0.5, trim);
      F.fill(cx - 0.8, 1.2, 2.0, cx + 0.8, 1.7, 2.8, trim, 0);
      F.fill(cx - 0.8, G - 1.0, 2.0, cx + 0.8, G - 0.5, 2.8, trim, 0);
    }
    F.fill(27, G - 0.5, 0, 47, G, 3.0, trim, 0);
    F.fill(26.5, G, 0, 47.5, G + 0.4, 3.2, trim, 0);
    // piano nobile loggia: three arches with balustrade
    for (const c of [sc - 4.8, sc, sc + 4.8]) {
      const a = c - 1.7, b = c + 1.7;
      F.shape(a - 0.5, b + 0.5, 6.3, 11.75, 2.0, 2.6, trim, B.roundArch(a, b, 6.3, 11.25, 0.5), 1);
      F.shape(a, b, 6.3, 11.26, -2.6, 2.7, 0, B.roundArch(a, b, 6.3, 11.25, 0), 0);
      F.shape(a, b, 6.3, 11.26, -3.0, -2.6, M.recessDk, B.roundArch(a, b, 6.3, 11.25, 0), 0);
      F.shape(a + 0.5, b - 0.5, 7.0, 10.6, -2.9, -2.6, gl(), B.roundArch(a + 0.5, b - 0.5, 7.0, 10.6, 0), 0);
      F.fill(a, G + 0.05, 2.0, b, 7.3, 2.4, trim, 0);
      for (let s = a + 0.1; s < b - 0.1; s += vs * 2) F.carve(s, G + 0.55, 2.0, s + vs, 6.75, 2.45);
      F.fill(a, 7.3, 1.9, b, 7.65, 2.6, trim, 0);
    }
    for (const cx of [sc - 2.4, sc + 2.4, sc - 7.2, sc + 7.2]) {
      g.cylY(cx, -2.3, 0.42, 7.6, 11.2, trim);
      F.fill(cx - 0.6, 11.0, 2.0, cx + 0.6, 11.4, 2.6, trim, 0);
    }
    F.fill(27, Pn - 0.7, 0, 47, Pn, 3.0, trim, 0);
    F.fill(26.5, Pn, 0, 47.5, Pn + 0.6, 3.3, trim, 0);
    // attic + cartouche + pediment
    F.fill(28.5, Pn + 0.6, 0, 45.5, A + 2.0, 2.6, wall, 0);
    F.shape(sc - 2.0, sc + 2.0, 12.6, 16.6, 2.6, 3.1, M.gold, (s, y) => Math.abs(Math.hypot(s - sc, (y - 14.6) * 1.0) - 1.7) < 0.35, 1);
    F.shape(sc - 2.0, sc + 2.0, 12.6, 16.6, 2.6, 3.0, M.greyStoneDk, (s, y) => Math.hypot(s - sc, y - 14.6) <= 1.35, 1);
    const pw = 19, ph = 3.9, py = A + 2.0;
    for (let r = 0; r < Math.round(ph / vs); r++) {
      const half = pw / 2 - (r * pw) / 2 / Math.round(ph / vs);
      F.fill(sc - half, py + r * vs, 0, sc + half, py + (r + 1) * vs, 3.4, trim, 0);
      if (half > 1.4) F.fill(sc - half + 0.9, py + r * vs, 0.5, sc + half - 0.9, py + (r + 1) * vs, 3.0, wall, 0);
    }
    F.fill(sc - 9.8, py - 0.5, 0, sc + 9.8, py, 3.6, trim, 0);
    // statues along the roof-line
    const statX = [3, 10, 17, 24, 50, 57, 64, 71, 29.3, 44.7, sc - 8.6, sc + 8.6];
    for (const s of statX) statue(g, F.x(s, 0.7), C + 1.7, F.z(s, 0.7), M.whiteStone, 1.0);
    statue(g, F.x(sc, 1.6), py + ph, F.z(sc, 1.6), M.whiteStone, 1.4);
    statue(g, F.x(sc - 9.2, 1.6), py, F.z(sc - 9.2, 1.6), M.whiteStone, 1.1);
    statue(g, F.x(sc + 9.2, 1.6), py, F.z(sc + 9.2, 1.6), M.whiteStone, 1.1);
    // roofs: hipped main block + gabled wings, courtyard open
    const roofY = (x, z) => {
      let h = -1;
      if (z <= MB + 0.6) h = Math.max(h, 0.78 * Math.min(z + 0.6, MB + 0.6 - z, x + 0.6, W + 0.6 - x));
      if (x <= 22.6) h = Math.max(h, 0.78 * Math.min(x + 0.6, 22.6 - x, D + 0.6 - z, z + 0.6));
      else if (x >= 51.4) h = Math.max(h, 0.78 * Math.min(x - 51.4, W + 0.6 - x, D + 0.6 - z, z + 0.6) + 0.0);
      return h;
    };
    B.columns(g, -0.6, -0.6, W + 0.6, D + 0.6, C - 0.5, (x, z, o) => {
      const h = roofY(x, z);
      if (h < 0) return false;
      o.top = C + h;
      o.mat = B.bandMat(roofMats, Math.floor(h / 0.5), x + z, 3);
      return true;
    });
    // dormers on the front slope
    for (let k = 0; k < 9; k++) {
      const xd = 4.0 + k * 8.25;
      const zd = 2.4;
      const yb = C + roofY(xd, zd) - 0.9;
      g.fill(xd - 1.0, yb, zd - 1.0, xd + 1.0, yb + 2.6, zd + 1.5, trim, 1);
      g.carve(xd - 0.5, yb + 0.5, zd - 1.0, xd + 0.5, yb + 2.1, zd - 0.5);
      g.fill(xd - 0.5, yb + 0.5, zd - 0.5, xd + 0.5, yb + 2.1, zd, gl(), 0);
      g.fill(xd - 1.25, yb + 2.6, zd - 1.25, xd + 1.25, yb + 3.1, zd + 2, roofMats[0], 0);
      g.fill(xd - 0.75, yb + 3.1, zd - 0.9, xd + 0.75, yb + 3.6, zd + 1.5, roofMats[1], 0);
    }
    // chimneys
    for (const [x, z] of [[8, 9], [24, 22], [66, 22], [50, 9], [15, 30], [59, 30]]) {
      const ry = C + roofY(x, z);
      if (ry < C) continue;
      g.fill(x - 0.6, ry - 0.5, z - 0.6, x + 0.6, ry + 3, z + 0.6, M.brick, 0);
      g.fill(x - 0.85, ry + 3, z - 0.85, x + 0.85, ry + 3.5, z + 0.85, M.brickDk, 0);
    }
    // courtyard + rear + side walls
    const courtWin = (Wl, len, sOff, noGround) => {
      const nn = Math.max(1, Math.round(len / 3.5));
      for (let i = 0; i < nn; i++) {
        const c = sOff + ((i + 0.5) * (len - sOff)) / nn;
        if (!noGround) win(Wl, c, 1.4, 1.2, 2.6, { frame: trim, glass: gl(), fw: 0.5 });
        win(Wl, c, 6.2, 1.4, 3.6, { frame: trim, glass: gl(), fw: 0.5, hood: 'flat' });
        win(Wl, c, 12.4, 1.2, 1.5, { frame: trim, glass: gl(), fw: 0.5, sill: false });
      }
    };
    courtWin(new Wall(g, 52, MB, 'back'), 30, 0, true); // main block rear (arcade below)
    for (let i = 0; i < 5; i++) {
      const c = 3 + i * 6;
      doorArch(new Wall(g, 52, MB, 'back'), c, 2.6, 2.6, { frame: trim, door: M.recessDk, fan: M.glassLit });
    }
    courtWin(new Wall(g, 22, D, 'east'), D - MB, 0); // inner face of the west wing (x=22, faces +x)
    courtWin(new Wall(g, 52, MB, 'west'), D - MB, 0); // inner face of the east wing (x=52, faces -x)
    courtWin(new Wall(g, 0, 0, 'west'), D, 0); // outer ends
    courtWin(new Wall(g, W, D, 'east'), D, 0);
    courtWin(new Wall(g, 22, D, 'back'), 22, 0); // rear of the wings
    courtWin(new Wall(g, W, D, 'back'), 22, 0);
    return { name: 'banffy', grid: g, frame: PU.L.sideFrame('E', -50, 24) };
  };

  /* ---------------- Mirror Buildings ---------------- */
  PU.buildMirror = function () {
    const vs = 0.25, w = 22, d = 22, R = 5.5;
    const spec = { id: 'mirror', w, depth: d, floors: 4, fh: 3.9, style: 'historicist', wall: 'cream', wall2: 'lightOchre', trim: 'whiteStone', roof: 'mansard', roofMat: 'slateRoof', dormers: 5, chimneys: 2, balcony: [1, 2], hoods: 'segment', shop: true, litP: 0.3, skipBelow: R + 1.2 };
    const A = PU.buildFacade(Object.assign({}, spec, { sideWinL: false }), { vs });
    const Bg = PU.buildFacade(Object.assign({}, spec, { id: 'mirror2', sideWinL: false }), { vs });
    const g = A.grid;
    // overlay the street facade (grid B is the same building, with its front along the street): rotate B into A's slab
    // B's front plane sits at local z=0 facing -z; we need it on the x=0 plane facing -x: map (x,z) -> (-z, x)
    const gb = Bg.grid;
    const slab = 5.0;
    for (let k = 0; k < gb.nz; k++)
      for (let j = 0; j < gb.ny; j++)
        for (let i = 0; i < gb.nx; i++) {
          const v = gb.data[i + gb.nx * (j + gb.ny * k)];
          // B local coords
          const bx = gb.ox + (i + 0.5) * vs, bz = gb.oz + (k + 0.5) * vs;
          // target: street face on the x=0 plane facing -x: depth (bz>0) -> +x, relief (bz<0) -> -x
          const tx = bz, tz = bx;
          if (tx > 1.5 || tx < -3.5) continue;
          if (tz < -0.1 || tz > d + 0.1) continue;
          g.set(tx, gb.oy + (j + 0.5) * vs, tz, v);
        }
    // trim the corner: remove everything outside the rounded corner quarter
    g.fillFn(-4, -1.5, -4, R, 40, R, (x, y, z) => {
      if (x < R && z < R) {
        const dd = Math.hypot(x - R, z - R);
        if (dd > R) return 0;
      }
      return undefined;
    });
    // corner tower: cornice rings and arc windows
    const floorY = A.floorY, fh = spec.fh, Ht = A.H;
    const wh = 2.5;
    // deterministic pseudo-random for the arc windows
    const rr = new PU.RNG(4711);
    const gf = () => (rr.chance(0.3) ? M.glassLit : rr.pick(glassSet));
    const arcBand = (y0, y1, out, mat) => g.fillFn(-1, y0, -1, R + 0.1, y1, R + 0.1, (x, y, z) => {
      if (x >= R || z >= R) return undefined;
      const dd = Math.hypot(x - R, z - R);
      return dd > R - 0.01 && dd <= R + out ? mat : undefined;
    });
    for (let k = 1; k < 4; k++) arcBand(floorY[k] - 0.5, floorY[k], 0.5, M.whiteStone);
    arcBand(Ht - 1.0, Ht - 0.5, 0.5, M.whiteStone);
    arcBand(Ht - 0.5, Ht, 1.2, M.whiteStone);
    arcBand(-1.5, 1.0, 0.4, M.basement);
    for (let k = 0; k < 4; k++) {
      const yy = k === 0 ? 1.5 : floorY[k] + (fh - wh) * 0.5 + 0.2;
      for (const ang of [Math.PI * 1.17, Math.PI * 1.5 - (Math.PI * 0.17)]) {
        const px = R + R * Math.cos(ang), pz = R + R * Math.sin(ang);
        const nx = Math.cos(ang), nz = Math.sin(ang);
        rotWin(g, px, pz, nx, nz, yy, k === 0 ? 1.6 : 1.5, k === 0 ? 2.2 : wh, { frame: M.whiteStone, glass: gf() });
      }
    }
    // pilaster-like piers on the arc
    for (const ang of [Math.PI * 1.0, Math.PI * 1.335, Math.PI * 1.5]) {
      const px = R + (R + 0.15) * Math.cos(ang), pz = R + (R + 0.15) * Math.sin(ang);
      g.fill(px - 0.3, 1.0, pz - 0.3, px + 0.3, Ht - 1.0, pz + 0.3, M.whiteStone, 1);
    }
    // clear the mansard where the corner tower rises, then set a domed helmet roof on it
    g.fillFn(-1, Ht + 0.05, -1, 2 * R + 1, Ht + 24, 2 * R + 1, (x, y, z) => (Math.hypot(x - R, z - R) <= R + 0.7 ? 0 : undefined));
    g.cylY(R, R, R + 0.05, Ht - 1.0, Ht + 0.3, M.limestoneLt);
    dome(g, R, R, Ht + 0.2, R + 0.6, R * 1.0 + 1.0, M.copperGreen, M.darkSlate, M.gold);
    return { name: 'mirror', grid: g, w, depth: d };
  };

  /* ---------------- Hotel Continental ---------------- */
  PU.buildContinental = function () {
    const vs = 0.25;
    const base = { floors: 4, fh: 4.0, style: 'historicist', wall: 'lightOchre', wall2: 'cream', trim: 'ivory', roof: 'mansard', roofMat: 'slateRoof', balcony: [1, 2], hoods: 'segment', shop: true, litP: 0.32, chimneys: 3, portal: true, noRear: false };
    const west = PU.buildFacade(Object.assign({ id: 'contW', w: 26, depth: 22, dormers: 4, sideWinL: true }, base), { vs });
    const south = PU.buildFacade(Object.assign({ id: 'contS', w: 28, depth: 22, dormers: 4, sideWinL: false }, base, { portal: false }), { vs });
    const corner = PU.buildFacade(Object.assign({ id: 'contC', w: 22, depth: 22, dormers: 3, sideWinL: true }, base, { portal: false, shop: false }), { vs });
    // rotunda at the re-entrant corner (world coords)
    const rot = VG.box(-118, -1.5, 66, -100, 40, 88, vs);
    const cx = -107.6, cz = 77.6, r = 4.6;
    const Ht = west.H;
    rot.cylY(cx, cz, r, -1.5, Ht, M.lightOchre);
    rot.cylY(cx, cz, r + 0.4, -1.5, 1.0, M.basement);
    const rr = new PU.RNG(99);
    const gf = () => (rr.chance(0.35) ? M.glassLit : rr.pick(glassSet));
    const inWings = (x, z) => (x < -110 && z > 54 && z < 80) || (z > 80 && x > -110 && x < -82) || (x < -110 && z >= 80);
    const floorY = west.floorY, wh = 2.6;
    for (let k = 0; k < 4; k++) {
      const yy = k === 0 ? 1.5 : floorY[k] + (4.0 - wh) * 0.5 + 0.2;
      for (let a = -160; a <= 40; a += 24) {
        const ang = (a * Math.PI) / 180;
        const nx = Math.cos(ang), nz = Math.sin(ang);
        const px = cx + r * nx, pz = cz + r * nz;
        if (inWings(px + nx * 0.6, pz + nz * 0.6)) continue;
        rotWin(rot, px, pz, nx, nz, yy, k === 0 ? 1.6 : 1.4, k === 0 ? 2.4 : wh, { frame: M.ivory, glass: gf() });
      }
      if (k > 0) rot.fillFn(cx - r - 1, floorY[k] - 0.5, cz - r - 1, cx + r + 1, floorY[k], cz + r + 1, (x, y, z) => (Math.hypot(x - cx, z - cz) <= r + 0.45 ? M.ivory : undefined));
    }
    rot.fillFn(cx - r - 1.5, Ht - 1.0, cz - r - 1.5, cx + r + 1.5, Ht, cz + r + 1.5, (x, y, z) => (Math.hypot(x - cx, z - cz) <= r + (y > Ht - 0.5 ? 1.1 : 0.6) ? M.ivory : undefined));
    // balcony ring on the first floor
    rot.fillFn(cx - r - 1.2, floorY[1] - 1.0, cz - r - 1.2, cx + r + 1.2, floorY[1] - 0.5, cz + r + 1.2, (x, y, z) => (Math.hypot(x - cx, z - cz) <= r + 0.9 ? M.ivory : undefined));
    dome(rot, cx, cz, Ht + 0.2, r + 0.8, r + 1.6, M.slateRoof, M.darkSlate, M.gold);
    return { west, south, corner, rot, fw: PU.L.sideFrame('W', 54, 80), fs: PU.L.sideFrame('S', -110, -82) };
  };

  /* ---------------- assemble ---------------- */
  PU.buildHeroes = function (renderer, emit, addHero) {
    const L = PU.L;
    const y0 = L.H_PLAZA;
    const skip = [0, 0, 1, 0, 0, 0];
    // Banffy
    {
      const b = PU.buildBanffy();
      const fr = b.frame;
      addHero({ name: 'banffy', items: [{ grid: b.grid, skip, thr: 0.3 }], xf: { x: fr.x, y: y0, z: fr.z, yaw: fr.yaw } }, [300, 800], [2, 4]);
    }
    // Mirror Buildings (north one built, south is its mirror image)
    {
      const m = PU.buildMirror();
      const frN = L.sideFrame('E', 24, 46), frS = L.sideFrame('E', 58, 80);
      addHero({ name: 'mirrorN', items: [{ grid: m.grid, skip, thr: 0.3 }], xf: { x: frN.x, y: y0, z: frN.z, yaw: frN.yaw } }, [300, 800], [2, 4]);
      addHero({ name: 'mirrorS', items: [{ grid: flipX(m.grid), skip, thr: 0.3 }], xf: { x: frS.x, y: y0, z: frS.z, yaw: frS.yaw } }, [300, 800], [2, 4]);
    }
    // Continental
    {
      const c = PU.buildContinental();
      const fw = c.fw, fs = c.fs;
      addHero({ name: 'contW', items: [{ grid: c.west.grid, skip, thr: 0.3 }], xf: { x: fw.x, y: y0, z: fw.z, yaw: fw.yaw } }, [300, 800], [2, 4]);
      addHero({ name: 'contS', items: [{ grid: c.south.grid, skip, thr: 0.3 }], xf: { x: fs.x, y: y0, z: fs.z, yaw: fs.yaw } }, [300, 800], [2, 4]);
      addHero({ name: 'contC', items: [{ grid: c.corner.grid, skip, thr: 0.3 }], xf: { x: -132, y: y0, z: 80, yaw: 0 } }, [300, 800], [2, 4]);
      addHero({ name: 'contRot', items: [{ grid: c.rot, skip, thr: 0.3 }], xf: { x: 0, y: y0, z: 0, yaw: 0 } }, [300, 800], [2, 4]);
    }
    // Iuliu Maniu Street: mirrored rows of matching buildings beyond the Mirror Buildings
    {
      const widths = [[132, 145.5], [154.5, 170], [170, 186], [186, 202], [202, 218], [218, 234]];
      const styles = [
        { floors: 4, fh: 3.8, wall: 'cream', wall2: 'lightOchre', trim: 'whiteStone', roof: 'mansard', roofMat: 'slateRoof', balcony: [1, 2], hoods: 'segment', dormers: 3, chimneys: 1, shop: true },
        { floors: 4, fh: 3.8, wall: 'paleYellow', trim: 'whiteStone', roof: 'mansard', roofMat: 'slateRoof', balcony: [1], hoods: 'triangle', dormers: 3, chimneys: 1, shop: true },
        { floors: 4, fh: 3.7, wall: 'cream', wall2: 'dustyPink', trim: 'ivory', roof: 'mansard', roofMat: 'zincRoof', balcony: [1, 2], hoods: 'segment', dormers: 3, chimneys: 2, shop: true },
        { floors: 3, fh: 3.9, wall: 'palePink', trim: 'whiteStone', roof: 'gable', roofMat: 'roofOrange', balcony: [1], hoods: 'flat', dormers: 2, chimneys: 2, shop: true },
        { floors: 4, fh: 3.8, wall: 'beige', wall2: 'lightOchre', trim: 'whiteStone', roof: 'mansard', roofMat: 'slateRoof', balcony: [1, 2], hoods: 'segment', dormers: 3, chimneys: 1, shop: true },
        { floors: 3, fh: 3.9, wall: 'lightOchre', trim: 'cream', roof: 'hip', roofMat: 'roofTerra', balcony: [1], hoods: 'triangle', dormers: 2, chimneys: 2, shop: true },
      ];
      widths.forEach(([xa, xb], i) => {
        const st = styles[i % styles.length];
        const spec = Object.assign({ id: 'maniu' + i, style: 'historicist', w: xb - xa, depth: 21, litP: 0.28 }, st);
        // north side: front on z=46 facing +z (south)
        const yb = L.baseHeightAt((xa + xb) / 2, 52) + 0.15;
        const rN = PU.buildFacade(Object.assign({}, spec, { sideWinL: false, sideWinR: i === widths.length - 1 }), { vs: 0.5 });
        addHero({ name: 'maniuN' + i, items: [{ grid: rN.grid, skip, thr: 0.34 }], xf: { x: xb, y: yb, z: 46, yaw: Math.PI } }, [340, 900], [2, 4]);
        // south side: front on z=58 facing -z (north)
        const rS = PU.buildFacade(Object.assign({}, spec, { sideWinL: false, sideWinR: i === widths.length - 1 }), { vs: 0.5 });
        addHero({ name: 'maniuS' + i, items: [{ grid: rS.grid, skip, thr: 0.34 }], xf: { x: xa, y: yb, z: 58, yaw: 0 } }, [340, 900], [2, 4]);
      });
    }
  };
})();

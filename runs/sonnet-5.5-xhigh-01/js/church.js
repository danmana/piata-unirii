/* Piata Unirii — St. Michael's Church (Biserica Sfantul Mihail), the hero asset. 0.25 m voxels.
   Church-local frame: x east, z south, y up; origin at the church reference point (world -2, y0, -12).
   Hall church: 44 m x 30 m nave under one huge steep tiled roof, polygonal apse to the east,
   single neo-Gothic tower (~80 m with spire and cross) on the west front. */
(function () {
  'use strict';
  const PU = window.PU;
  const M = PU.M, B = PU.B, Wall = B.Wall, VG = PU.VoxelGrid;
  const hash3 = PU.hash3;

  function stoneMat(x, y, z) {
    const h = hash3(Math.floor(x / 1.7), Math.floor(y / 1.2), Math.floor(z / 1.7), 3);
    if (y < 1.0) return h < 0.5 ? M.limestoneWeather : M.limestoneDk;
    if (y < 3.6) return h < 0.35 ? M.limestoneDk : M.limestone;
    if (h < 0.1) return M.limestoneDk;
    if (h > 0.9) return M.limestoneLt;
    if (h > 0.83) return M.limestoneWeather;
    return M.limestone;
  }
  const tileMats = [M.churchRoofA, M.churchRoofB, M.churchRoofC, M.churchRoofA, M.churchRoofB];

  PU.buildChurch = function () {
    const VS = 0.25;
    const rng = new PU.RNG(90210);
    const lit = () => (rng.chance(0.5) ? M.glassChurchLit : M.glassChurch);
    const g = VG.box(-27, -1.5, -25, 35, 41, 22, VS);
    const HX0 = -26, HX1 = 18, HZ = 15, HW = 21, SL = 1.2;
    const PW = 17.5;
    const stone = (x0, y0, z0, x1, y1, z1) => B.patchBox(g, x0, y0, z0, x1, y1, z1, stoneMat, 1.7, 1.2, 1.7);

    /* ---------------- hall body ---------------- */
    stone(HX0, -1.5, -HZ, HX1, HW, HZ);
    g.fill(HX0 - 0.3, -1.5, -HZ - 0.3, HX1 + 0.3, 0.9, HZ + 0.3, M.limestoneDk);

    /* ---------------- presbytery / polygonal apse ---------------- */
    const AP = [[18, -7.5], [26, -7.5], [31.3, -5.3], [33.5, 0], [31.3, 5.3], [26, 7.5], [18, 7.5]];
    g.prism(AP, -1.5, PW, (x, y, z) => stoneMat(x, y, z));
    const exp = AP.map(([x, z], i) => (x <= 18 ? [x, z + Math.sign(z) * 0.3] : [x + (x - 24) * 0.05 + 0.15, z + Math.sign(z) * 0.3]));
    g.prism(exp, -1.5, 0.9, M.limestoneDk);
    // presbytery eave cornice
    g.prism(AP.map(([x, z]) => [x <= 18 ? x : x + (x - 24) * 0.04 + 0.12, z + Math.sign(z) * 0.4]), PW - 0.8, PW, M.limestoneLt);

    /* ---------------- roofs ---------------- */
    // hall: one enormous gable, ridge along x
    const ridgeH = HW + SL * HZ;
    B.columns(g, HX0, -HZ - 1, HX1, HZ + 1, HW - 0.25, (x, z, o) => {
      const az = Math.abs(z);
      if (az > HZ + 0.95) return false;
      const yt = HW + SL * (HZ - az);
      const band = Math.floor((HZ - az) / 0.4);
      const endWall = x < HX0 + 0.8 || x > HX1 - 0.8;
      o.top = yt;
      o.mat = endWall && az <= HZ ? stoneMat(x, yt, z) : B.bandMat(tileMats, band, x, 0);
      if (az > HZ) o.low = yt - 0.85;
      if (az < 0.32 && !endWall) o.mat = M.ridgeCap;
      return true;
    });
    // ridge crest: slightly raised cap
    g.fill(HX0 + 0.8, ridgeH, -0.3, HX1 - 0.8, ridgeH + 0.5, 0.3, M.ridgeCap);
    // apse roof: hip roof over the polygon (west edge excluded)
    const edges = [];
    for (let i = 0; i < AP.length - 1; i++) edges.push([AP[i], AP[i + 1]]);
    B.columns(g, 17, -9, 35, 9, PW - 0.25, (x, z, o) => {
      let d = 1e9;
      for (const [a, b] of edges) {
        const ex = b[0] - a[0], ez = b[1] - a[1];
        const l = Math.hypot(ex, ez);
        // inward normal: polygon is clockwise in (x,z) -> inward is to the right of travel
        const nx = -ez / l, nz = ex / l;
        const dd = (x - a[0]) * nx + (z - a[1]) * nz;
        // choose sign so that the centre (26,0) is positive
        const sgn = (26 - a[0]) * nx + (0 - a[1]) * nz > 0 ? 1 : -1;
        const dv = dd * sgn;
        if (dv < d) d = dv;
      }
      if (d < -0.7) return false;
      if (x < 18) return false;
      const yt = PW + SL * d;
      o.top = yt;
      o.mat = B.bandMat(tileMats, Math.floor(d / 0.4), x + z * 0.3, 7);
      if (d < 0) o.low = yt - 0.85;
      return true;
    });
    // hall east gable pinnacle + apse ridge finial
    g.fill(HX1 - 0.9, ridgeH, -0.3, HX1, ridgeH + 1.2, 0.3, M.limestoneLt);

    /* ---------------- buttresses ---------------- */
    const buttress = (wall, s, w, proj, hTop, pinn) => {
      wall.fill(s - w / 2, -1.5, 0, s + w / 2, 1.2, proj, M.limestoneDk);
      wall.fill(s - w / 2, 1.2, 0, s + w / 2, 8.6, proj, M.limestoneLt);
      wall.fill(s - w * 0.4, 8.6, 0, s + w * 0.4, 9.0, proj - 0.5, M.limestoneLt);
      wall.fill(s - w * 0.4, 8.6, 0, s + w * 0.4, 15.6, proj - 0.5, M.limestoneLt);
      wall.fill(s - w * 0.32, 15.6, 0, s + w * 0.32, hTop + 0.3, proj - 1.0, M.limestoneLt);
      if (pinn) {
        const t1 = proj - 1.0, t0 = Math.max(0, t1 - 1.0);
        let y = hTop + 0.3;
        const layers = [[0.34, 1.2], [0.27, 1.0], [0.2, 0.7], [0.12, 0.6]];
        for (const [hw, h] of layers) {
          wall.fill(s - hw, y, t1 - hw * 2 - 0.05 > 0 ? t1 - hw * 2 : 0.1, s + hw, y + h, t1, M.limestoneLt);
          y += h;
        }
        wall.fill(s - 0.07, y, t1 - 0.14, s + 0.07, y + 0.5, t1, M.limestoneLt);
      }
    };
    const bayX = (k) => HX0 + 8.8 * k;
    const wS = new Wall(g, HX1, HZ, 'back'); // s = 18 - x, faces +z
    const wN = new Wall(g, HX0, -HZ, 'front'); // s = x + 26, faces -z
    for (let k = 0; k <= 5; k++) {
      buttress(wS, HX1 - bayX(k), 1.7, 2.6, HW, true);
      buttress(wN, bayX(k) - HX0, 1.7, 2.6, HW, true);
    }
    // west and east end corner buttresses
    const wW = new Wall(g, HX0, -HZ, 'west'); // s = z + 15
    const wE = new Wall(g, HX1, HZ, 'east'); // s = 15 - z
    for (const s of [0, 30]) {
      buttress(wW, s, 1.7, 2.6, HW, true);
      buttress(wE, s, 1.7, 2.6, HW, true);
    }

    /* ---------------- hall windows ---------------- */
    for (let k = 0; k < 5; k++) {
      const xc = HX0 + 8.8 * (k + 0.5);
      const porch = k === 2;
      for (const side of ['S', 'N']) {
        const wall = side === 'S' ? wS : wN;
        const sc = side === 'S' ? HX1 - xc : xc - HX0;
        // string course under the sills
        wall.fill(sc - 4.4 + 0.85, 4.0, 0, sc + 4.4 - 0.85, 4.35, 0.32, M.limestoneLt);
        if (porch && side === 'S') {
          B.gothicWindow(wall, sc - 1.5, 11.6, 3.0, 18.2, { glass: lit(), mullions: 1, recess: 1.0 });
        } else {
          B.gothicWindow(wall, sc - 1.95, 4.7, 3.9, 18.0, { glass: lit(), mullions: 2, recess: 1.1 });
        }
      }
    }
    // corbel table + cornice
    for (const wall of [wS, wN]) {
      wall.fill(0, HW - 0.8, 0, 44, HW, 0.8, M.limestoneLt);
      for (let s = 0.4; s < 44; s += 1.0) wall.fill(s, HW - 1.5, 0, s + 0.5, HW - 0.8, 0.5, M.limestoneDk);
      wall.fill(0, 3.6, 0, 44, 4.0, 0.3, M.limestoneDk);
    }
    // west flanks (either side of the tower)
    for (const sc of [3.6, 26.4]) {
      B.gothicWindow(wW, sc - 1.5, 5.0, 3.0, 19.4, { glass: lit(), mullions: 1, recess: 1.0 });
    }
    // east gable window above the apse roof
    B.gothicWindow(wE, 15 - 1.5, 28.2, 3.0, 35.6, { glass: lit(), mullions: 1, recess: 0.9 });
    wE.fill(0, HW - 0.8, 0, 30, HW, 0.8, M.limestoneLt);
    wW.fill(0, HW - 0.8, 0, 30, HW, 0.8, M.limestoneLt);

    /* ---------------- apse windows + buttresses ---------------- */
    const faceWin = (x0, z0, x1, z1, sc, sill, apex, w) => {
      // window in a planar facet defined by two vertices
      const ex = x1 - x0, ez = z1 - z0;
      const l = Math.hypot(ex, ez);
      const tx = ex / l, tz = ez / l;
      let nx = -tz, nz = tx; // outward normal: away from (26,0)
      if ((x0 - 26) * nx + (z0 - 0) * nz < 0) { nx = -nx; nz = -nz; }
      const pIn = B.lancet(sc - w / 2, sc + w / 2, sill, apex, 0);
      const pOut = B.lancet(sc - w / 2, sc + w / 2, sill, apex, 0.5);
      const rec = 1.0;
      const glass = lit();
      const bx0 = Math.min(x0, x1) - 2, bx1 = Math.max(x0, x1) + 2, bz0 = Math.min(z0, z1) - 2, bz1 = Math.max(z0, z1) + 2;
      for (let iy = 0; iy < Math.round((apex + 1 - (sill - 0.6)) / VS); iy++) {
        const y = sill - 0.6 + (iy + 0.5) * VS;
        g.fillFn(bx0, y - VS / 2 + 0.001, bz0, bx1, y + VS / 2 - 0.001, bz1, (x, yy, z) => {
          const d = (x - x0) * nx + (z - z0) * nz;
          const s = (x - x0) * tx + (z - z0) * tz;
          if (d < -rec - VS || d > 0.45) return undefined;
          if (!pOut(s, y)) return undefined;
          if (!pIn(s, y)) return d >= -0.05 ? M.limestoneLt : undefined; // surround
          if (d > -rec + VS * 0.6) {
            const mm = Math.abs(s - sc) < 0.2 || Math.abs(y - (sill + (apex - sill) * 0.56)) < 0.2;
            return mm ? M.limestoneLt : 0;
          }
          if (d > -rec - VS * 0.4) return glass;
          return M.recessDk;
        });
      }
    };
    // straight presbytery walls (x 18..26) — windows at x=22
    const wPS = new Wall(g, 26, 7.5, 'back'); // south straight wall, s = 26 - x
    const wPN = new Wall(g, 18, -7.5, 'front'); // north straight wall, s = x - 18
    B.gothicWindow(wPS, 4 - 1.5, 4.3, 3.0, 15.4, { glass: lit(), mullions: 1, recess: 1.0 });
    B.gothicWindow(wPN, 4 - 1.5, 4.3, 3.0, 15.4, { glass: lit(), mullions: 1, recess: 1.0 });
    for (let i = 1; i < AP.length - 2; i++) {
      const a = AP[i], b = AP[i + 1];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      faceWin(a[0], a[1], b[0], b[1], l / 2, 4.3, 15.4, 2.8);
    }
    // presbytery buttresses (axis-aligned blocks at vertices + stepped tops)
    const pButt = (cx, cz, dx, dz) => {
      const box = (hw, y0, y1, push) => g.fill(cx + dx * push - hw, y0, cz + dz * push - hw, cx + dx * push + hw, y1, cz + dz * push + hw, M.limestoneLt);
      box(0.95, -1.5, 8.6, 0.8);
      box(0.75, 8.6, 14.8, 0.65);
      box(0.6, 14.8, PW + 0.3, 0.5);
      let y = PW + 0.3;
      for (const [hw, h] of [[0.4, 1.2], [0.32, 1.0], [0.22, 0.8], [0.12, 0.6]]) { box(hw, y, y + h, 0.4); y += h; }
    };
    pButt(22, -7.5, 0, -1); pButt(22, 7.5, 0, 1);
    for (let i = 1; i < AP.length - 1; i++) {
      const a = AP[i];
      const dx = a[0] - 26, dz = a[1];
      const l = Math.hypot(dx, dz) || 1;
      pButt(a[0], a[1], dx / l, dz / l);
    }

    /* ---------------- south porch (behind the monument) ---------------- */
    {
      const cx = -4, pw = 3.9, pz = 20.0, ph = 10.5;
      // porch walls
      stone(cx - pw, -1.5, HZ, cx + pw, ph, pz);
      g.fill(cx - pw - 0.3, -1.5, HZ, cx + pw + 0.3, 0.9, pz + 0.3, M.limestoneDk);
      // gable roof, ridge along z
      B.columns(g, cx - pw - 0.8, HZ, cx + pw + 0.8, pz + 0.9, ph - 0.25, (x, z, o) => {
        const ax = Math.abs(x - cx);
        if (ax > pw + 0.75) return false;
        const yt = ph + 1.35 * (pw - ax);
        o.top = yt;
        o.mat = B.bandMat(tileMats, Math.floor((pw - ax) / 0.4), z, 9);
        if (ax > pw) o.low = yt - 0.8;
        if (z > pz - 0.02) { o.mat = stoneMat(x, yt, z); }
        return true;
      });
      // front gable face (stone triangle already from roof). portal on the +z face
      const wf = new Wall(g, cx + pw, pz, 'back'); // s = (cx+pw) - x, faces +z
      const sc = pw;
      // stepped archivolts
      const orders = [[2.6, 0.9, M.limestoneLt], [2.05, 0.7, M.limestone], [1.55, 0.5, M.limestoneLt]];
      for (const [hw, proud, m] of orders) wf.shape(sc - hw, sc + hw, 0, 8.6 + (hw - 1.55) * 0.9, 0, proud, m, B.lancet(sc - hw, sc + hw, 0, 8.6 + (hw - 1.55) * 0.9, 0), 1);
      // opening (deep recess) + dark interior + doors
      wf.shape(sc - 1.2, sc + 1.2, 0, 7.0, -2.2, 1.0, 0, B.lancet(sc - 1.2, sc + 1.2, 0, 7.0, 0), 0);
      wf.shape(sc - 1.2, sc + 1.2, 0, 7.0, -2.6, -2.2, M.voidDark, B.lancet(sc - 1.2, sc + 1.2, 0, 7.0, 0), 0);
      wf.fill(sc - 1.1, 0, -2.3, sc + 1.1, 3.4, -1.9, M.doorWood, 0);
      wf.shape(sc - 1.1, sc + 1.1, 3.4, 6.9, -2.3, -2.0, M.glassChurchLit, B.lancet(sc - 1.1, sc + 1.1, 0, 7.0, 0), 0);
      // upper wall window above porch is already added on the hall wall
      // pinnacles at the porch corners
      for (const sx of [-1, 1]) {
        let y = ph;
        for (const [hw, h] of [[0.45, 1.6], [0.35, 1.2], [0.24, 0.9], [0.12, 0.7]]) {
          g.fill(cx + sx * (pw - 0.1) - hw, y, pz - 0.1 - hw * 2, cx + sx * (pw - 0.1) + hw, y + h, pz - 0.1, M.limestoneLt);
          y += h;
        }
      }
    }

    /* ---------------- sacristy (north side) ---------------- */
    {
      stone(6, -1.5, -HZ - 8, 17, 8.6, -HZ);
      B.columns(g, 5.2, -HZ - 8.8, 17.8, -HZ + 0.4, 8.35, (x, z, o) => {
        const yt = 8.6 + 0.9 * (z + HZ + 8.8) * 0.8;
        o.top = Math.min(yt, 14.4);
        o.mat = B.bandMat(tileMats, Math.floor((z + HZ + 8.8) / 0.4), x, 3);
        return true;
      });
      const wsN = new Wall(g, 6, -HZ - 8, 'front');
      B.gothicWindow(wsN, 3.5, 3.0, 2.2, 7.4, { glass: lit(), mullions: 1, recess: 0.8 });
      B.gothicWindow(wsN, 7.4, 3.0, 2.2, 7.4, { glass: lit(), mullions: 1, recess: 0.8 });
    }

    /* ---------------- ground floodlights (evening) ---------------- */
    for (let k = 0; k < 5; k++) {
      if (k === 2) continue;
      const x = bayX(k) + 4.4;
      g.fill(x - 0.25, 0.0, HZ + 2.9, x + 0.25, 0.45, HZ + 3.4, M.ironLt);
      g.fill(x - 0.2, 0.45, HZ + 2.95, x + 0.2, 0.7, HZ + 3.35, M.floodGlow);
    }

    /* ================= TOWER ================= */
    const TX = -32, TZ = 0;
    const tg = VG.box(TX - 9, -1.5, TZ - 9.5, TX + 9, 82, TZ + 9.5, VS);
    const tstone = (x0, y0, z0, x1, y1, z1) => B.patchBox(tg, x0, y0, z0, x1, y1, z1, stoneMat, 1.7, 1.2, 1.7);
    const faces = (hw) => ({
      W: new Wall(tg, TX - hw, TZ - hw, 'west'),
      N: new Wall(tg, TX - hw, TZ - hw, 'front'),
      S: new Wall(tg, TX + hw, TZ + hw, 'back'),
      E: new Wall(tg, TX + hw, TZ + hw, 'east'),
    });
    // stage 0 : 0..27
    tstone(TX - 6, -1.5, TZ - 6, TX + 6, 27, TZ + 6);
    tg.fill(TX - 6.3, -1.5, TZ - 6.3, TX + 6.3, 0.9, TZ + 6.3, M.limestoneDk);
    let f0 = faces(6);
    // west corner buttresses (L-shaped, stepped)
    for (const zs of [-1, 1]) {
      const cz = TZ + zs * 6, cx = TX - 6;
      const zo = zs * 1.6;
      const bx = (x0, x1, z0, z1, y0, y1) => tg.fill(x0, y0, Math.min(z0, z1), x1, y1, Math.max(z0, z1), M.limestoneLt);
      bx(cx - 1.7, cx + 0.6, cz - 0.0, cz + zo * 0.95, -1.5, 10.5);
      bx(cx - 1.35, cx + 0.6, cz, cz + zo * 0.8, 10.5, 19.5);
      bx(cx - 1.0, cx + 0.6, cz, cz + zo * 0.65, 19.5, 27.2);
      // perpendicular leg on the west face
      bx(cx - 1.6 * 0.95, cx, cz - zo * 0.55, cz + zo * 0.05, -1.5, 10.5);
      bx(cx - 1.25, cx, cz - zo * 0.45, cz + zo * 0.05, 10.5, 19.5);
      bx(cx - 0.9, cx, cz - zo * 0.35, cz + zo * 0.05, 19.5, 27.2);
      // pinnacle
      let y = 27.2;
      for (const [hw, h] of [[0.7, 1.4], [0.55, 1.1], [0.4, 0.9], [0.26, 0.9], [0.14, 0.8]]) {
        tg.fill(cx - 0.5 - hw, y, cz + zs * 0.7 - hw, cx - 0.5 + hw, y + h, cz + zs * 0.7 + hw, M.limestoneLt);
        y += h;
      }
    }
    // west portal: 3 orders, deep recess, doors
    {
      const w = f0.W, sc = 6;
      const orders = [[3.1, 0.9, M.limestoneLt], [2.6, 0.7, M.limestone], [2.1, 0.5, M.limestoneLt], [1.7, 0.3, M.limestone]];
      for (const [hw, proud, m] of orders) {
        const top = 9.2 + (hw - 1.7) * 1.0;
        w.shape(sc - hw, sc + hw, 0, top + 0.2, 0, proud, m, B.lancet(sc - hw, sc + hw, 0, top, 0), 1);
      }
      w.shape(sc - 1.5, sc + 1.5, 0, 8.6, -2.6, 1.0, 0, B.lancet(sc - 1.5, sc + 1.5, 0, 8.6, 0), 0);
      w.shape(sc - 1.5, sc + 1.5, 0, 8.6, -3.0, -2.6, M.voidDark, B.lancet(sc - 1.5, sc + 1.5, 0, 8.6, 0), 0);
      w.fill(sc - 1.4, 0, -2.75, sc + 1.4, 4.4, -2.35, M.doorWood, 0);
      w.fill(sc - 0.08, 0, -2.4, sc + 0.08, 4.4, -2.2, M.woodDk, 0);
      w.shape(sc - 1.4, sc + 1.4, 4.4, 8.4, -2.75, -2.4, M.glassChurchLit, B.lancet(sc - 1.5, sc + 1.5, 0, 8.6, 0), 0);
      // big window above the portal
      B.gothicWindow(w, sc - 1.9, 13.4, 3.8, 25.2, { glass: lit(), mullions: 2, recess: 1.3, frame: 0.6 });
      // string courses
      w.fill(0.2, 11.6, 0, 11.8, 12.0, 0.4, M.limestoneLt);
    }
    // north/south faces of stage 0
    for (const k of ['N', 'S']) {
      B.gothicWindow(f0[k], 6 - 1.0, 12.5, 2.0, 23.5, { glass: lit(), mullions: 0, recess: 1.0 });
      B.gothicWindow(f0[k], 6 - 1.0, 3.8, 2.0, 8.4, { glass: lit(), mullions: 0, recess: 0.9, transom: false });
    }
    // eastern filler between the tower shaft and the hall gable (lives in the body grid)
    B.columns(g, -26.45, -5.7, -25.9, 5.7, HW - 0.2, (x, z, o) => {
      o.top = HW + SL * (HZ - Math.abs(z));
      o.mat = stoneMat(x, o.top, z);
      return true;
    });
    // string course at 27
    tg.fill(TX - 6.7, 26.6, TZ - 6.7, TX + 6.7, 27.2, TZ + 6.7, M.limestoneLt);

    // stage 1 : 27..46 shaft (hw 5.6)
    const H1 = 5.6;
    tstone(TX - H1, 27, TZ - H1, TX + H1, 46, TZ + H1);
    f0 = faces(H1);
    for (const k of ['W', 'N', 'S', 'E']) {
      const w = f0[k];
      // two blind panels + central lancet
      for (const s0 of [1.2, 7.0]) {
        w.shape(s0 - 0.5, s0 + 3.5, 28.5, 44.2, 0, 0.5, M.limestoneLt, B.lancet(s0 - 0.5, s0 + 3.5, 28.5, 44.0, 0), 1);
        w.shape(s0, s0 + 3.0, 29.0, 43.2, -0.6, 0.55, 0, B.lancet(s0, s0 + 3.0, 29.0, 43.0, 0), 0);
        w.shape(s0, s0 + 3.0, 29.0, 43.2, -0.85, -0.6, M.recess, B.lancet(s0, s0 + 3.0, 29.0, 43.0, 0), 0);
      }
      B.gothicWindow(w, 5.1, 32.0, 1.0, 42.0, { glass: lit(), mullions: 0, recess: 0.9, transom: false, frame: 0.4 });
      w.fill(-0.5, 45.4, 0, 11.7, 46.0, 0.7, M.limestoneLt);
    }
    // stage 2 : 46..52.8 clock stage (hw 5.6)
    tstone(TX - H1, 46, TZ - H1, TX + H1, 52.8, TZ + H1);
    const clock = (w, sc, yc, r) => {
      w.shape(sc - r - 0.7, sc + r + 0.7, yc - r - 0.7, yc + r + 0.7, 0, 0.6, M.limestoneLt, (s, y) => Math.hypot(s - sc, y - yc) <= r + 0.6, 1);
      w.shape(sc - r, sc + r, yc - r, yc + r, -0.1, 0.35, M.clockFace, (s, y) => Math.hypot(s - sc, y - yc) <= r, 0);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const big = i % 3 === 0;
        const rr = r - (big ? 0.45 : 0.35), hh = big ? 0.2 : 0.11;
        w.fill(sc + Math.sin(a) * rr - hh, yc + Math.cos(a) * rr - hh, 0.3, sc + Math.sin(a) * rr + hh, yc + Math.cos(a) * rr + hh, 0.5, M.bronzeDark, 0);
      }
      const hand = (ang, len, wd) => {
        const n = Math.round(len / 0.12);
        for (let i = 0; i <= n; i++) {
          const rr = (i / n) * len;
          w.fill(sc + Math.sin(ang) * rr - wd, yc + Math.cos(ang) * rr - wd, 0.3, sc + Math.sin(ang) * rr + wd, yc + Math.cos(ang) * rr + wd, 0.5, M.bronzeDark, 0);
        }
      };
      hand(-Math.PI / 3, r * 0.55, 0.12);
      hand(Math.PI / 3, r * 0.82, 0.09);
      w.fill(sc - 0.16, yc - 0.16, 0.3, sc + 0.16, yc + 0.16, 0.6, M.gold, 0);
    };
    for (const k of ['W', 'N', 'S', 'E']) {
      const w = f0[k];
      clock(w, H1, 49.4, 2.5);
      for (const s0 of [0.9, 9.9]) B.gothicWindow(w, s0, 47.0, 0.8, 51.6, { glass: lit(), mullions: 0, recess: 0.8, transom: false, frame: 0.35 });
    }
    tg.fill(TX - 6.4, 52.0, TZ - 6.4, TX + 6.4, 52.9, TZ + 6.4, M.limestoneLt);
    for (let a = -6.2; a <= 6.2; a += 1.0) {
      tg.fill(TX + a - 0.25, 51.2, TZ - 6.35, TX + a + 0.25, 52.0, TZ - 5.9, M.limestoneDk);
      tg.fill(TX + a - 0.25, 51.2, TZ + 5.9, TX + a + 0.25, 52.0, TZ + 6.35, M.limestoneDk);
      tg.fill(TX - 6.35, 51.2, TZ + a - 0.25, TX - 5.9, 52.0, TZ + a + 0.25, M.limestoneDk);
      tg.fill(TX + 5.9, 51.2, TZ + a - 0.25, TX + 6.35, 52.0, TZ + a + 0.25, M.limestoneDk);
    }
    // stage 3 : 52.9..64 belfry (hw 5.2)
    const H3 = 5.2;
    tstone(TX - H3, 52.9, TZ - H3, TX + H3, 64, TZ + H3);
    f0 = faces(H3);
    for (const k of ['W', 'N', 'S', 'E']) {
      const w = f0[k];
      for (const s0 of [1.3, 6.9]) {
        w.shape(s0 - 0.45, s0 + 2.2 + 0.45, 53.6, 63.2, 0, 0.5, M.limestoneLt, B.lancet(s0 - 0.45, s0 + 2.2 + 0.45, 53.6, 63.2, 0), 1);
        w.shape(s0, s0 + 2.2, 54.3, 62.3, -1.8, 0.6, 0, B.lancet(s0, s0 + 2.2, 54.3, 62.3, 0), 0);
        w.shape(s0, s0 + 2.2, 54.3, 62.3, -2.2, -1.8, M.voidDark, B.lancet(s0, s0 + 2.2, 54.3, 62.3, 0), 0);
        // louvres
        for (let y = 55.0; y < 60.6; y += 0.9) w.shape(s0, s0 + 2.2, y, y + 0.28, -1.5, -1.1, M.woodDk, B.lancet(s0, s0 + 2.2, 54.3, 62.3, 0), 1);
        w.fill(s0 + 1.05, 54.3, -1.5, s0 + 1.15, 60.6, -1.1, M.woodDk, 1);
      }
      w.fill(4.9, 54.3, 0, 5.5, 62.2, 0.6, M.limestoneLt, 1); // centre mullion pier
      w.fill(-0.4, 63.2, 0, 10.8, 64.0, 0.9, M.limestoneLt, 1);
    }
    // corner pinnacles (4)
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const cx = TX + sx * (H3 - 0.15), cz = TZ + sz * (H3 - 0.15);
        tg.fill(cx - 0.75, 52.9, cz - 0.75, cx + 0.75, 64.4, cz + 0.75, M.limestoneLt);
        let y = 64.4;
        for (const [hw, h] of [[0.75, 0.6], [0.62, 1.2], [0.5, 1.2], [0.4, 1.1], [0.3, 1.0], [0.2, 0.9], [0.12, 0.8]]) {
          tg.fill(cx - hw, y, cz - hw, cx + hw, y + h, cz + hw, M.limestoneLt);
          // crocket nubs
          if (hw > 0.25) {
            tg.fill(cx - hw - 0.2, y + h * 0.5, cz - 0.12, cx - hw, y + h * 0.5 + 0.3, cz + 0.12, M.limestoneLt);
            tg.fill(cx + hw, y + h * 0.5, cz - 0.12, cx + hw + 0.2, y + h * 0.5 + 0.3, cz + 0.12, M.limestoneLt);
          }
          y += h;
        }
        tg.fill(cx - 0.06, y, cz - 0.06, cx + 0.06, y + 0.6, cz + 0.06, M.gold);
      }
    // stage 4: gables on each face (y 64..70.6) around the spire drum
    for (const k of ['W', 'N', 'S', 'E']) {
      const w = f0[k];
      const sc = H3;
      w.shape(sc - 3.7, sc + 3.7, 63.8, 71.0, -0.6, 0.7, M.limestone, (s, y) => Math.abs(s - sc) <= 3.6 * (1 - (y - 64.0) / 7.2) + 0.15 && y >= 63.8, 1);
      w.shape(sc - 3.7, sc + 3.7, 64.6, 70.0, -0.9, 0.9, M.limestoneLt, (s, y) => {
        const half = 3.6 * (1 - (y - 64.0) / 7.2);
        return Math.abs(Math.abs(s - sc) - half) < 0.3 && y > 64.0 && half > 0;
      }, 1);
      B.gothicWindow(w, sc - 0.65, 65.0, 1.3, 69.0, { glass: lit(), mullions: 0, recess: 0.7, transom: false, frame: 0.3 });
      // crockets along the rake
      for (let i = 1; i < 6; i++) {
        const y = 64.0 + i * 1.1, half = 3.6 * (1 - (y - 64.0) / 7.2);
        w.fill(sc - half - 0.35, y, 0.7, sc - half + 0.1, y + 0.4, 1.1, M.limestoneLt, 1);
        w.fill(sc + half - 0.1, y, 0.7, sc + half + 0.35, y + 0.4, 1.1, M.limestoneLt, 1);
      }
      w.fill(sc - 0.2, 71.0, 0.2, sc + 0.2, 71.7, 0.7, M.limestoneLt, 1);
    }
    // octagonal spire (64..76)
    {
      const a0 = 4.3, y0 = 64, y1 = 76.2;
      tg.fillFn(TX - a0 - 0.2, y0, TZ - a0 - 0.2, TX + a0 + 0.2, y1, TZ + a0 + 0.2, (x, y, z) => {
        const t = (y - y0) / (y1 - y0);
        const a = a0 * Math.pow(1 - t, 1.12) + 0.2;
        const ax = Math.abs(x - TX), az = Math.abs(z - TZ);
        if (Math.max(ax, az) > a || (ax + az) * 0.70711 > a) return undefined;
        const rib = Math.max(ax, az) > a - 0.34 && (ax + az) * 0.70711 > a - 0.34;
        return rib ? M.spireLt : M.spireSlate;
      });
      // lucarnes (small gabled openings) on the four cardinal faces
      const yy = 66.8;
      const a = a0 * Math.pow(1 - (yy - y0) / (y1 - y0), 1.12) + 0.2;
      const sp = {
        W: new Wall(tg, TX - a, TZ - a, 'west'),
        N: new Wall(tg, TX - a, TZ - a, 'front'),
        S: new Wall(tg, TX + a, TZ + a, 'back'),
        E: new Wall(tg, TX + a, TZ + a, 'east'),
      };
      for (const k of ['W', 'N', 'S', 'E']) {
        const w = sp[k], sc = a;
        w.fill(sc - 0.5, yy, -0.15, sc + 0.5, yy + 1.7, 0.65, M.limestoneLt, 0);
        w.fill(sc - 0.2, yy + 0.4, 0.4, sc + 0.2, yy + 1.3, 0.7, M.recessDk, 0);
        w.fill(sc - 0.1, yy + 1.7, 0.1, sc + 0.1, yy + 2.1, 0.5, M.limestoneLt, 0);
      }
      // finial ball and cross
      tg.sphere(TX, 76.6, TZ, 0.42, M.gold);
      tg.fill(TX - 0.2, 76.9, TZ - 0.2, TX + 0.2, 80.4, TZ + 0.2, M.gold);
      tg.fill(TX - 1.05, 78.6, TZ - 0.2, TX + 1.05, 79.1, TZ + 0.2, M.gold);
      tg.fill(TX - 0.5, 80.3, TZ - 0.2, TX + 0.5, 80.7, TZ + 0.2, M.gold);
    }

    const skip = [0, 0, 1, 0, 0, 0];
    return {
      name: 'church',
      items: [
        { grid: g, skip, thr: 0.34 },
        { grid: tg, skip, thr: 0.16 },
      ],
      xf: { x: PU.L.church.ox, y: PU.L.church.y0, z: PU.L.church.oz, yaw: 0 },
    };
  };
})();

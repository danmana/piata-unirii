/* Piata Unirii — shared building toolkit: wall frames, arches, Gothic windows, roof column fills */
(function () {
  'use strict';
  const PU = window.PU;
  const M = PU.M;
  const B = (PU.B = {});

  /* A Wall maps (s along the wall, y up, t outward from the wall plane) into grid metres.
     front: faces -z, s=+x | back: faces +z, s=-x | west: faces -x, s=+z | east: faces +x, s=-z */
  class Wall {
    constructor(g, ox, oz, kind) {
      this.g = g;
      this.ox = ox;
      this.oz = oz;
      this.kind = kind;
      if (kind === 'front') { this.sx = 1; this.sz = 0; this.nx = 0; this.nz = -1; }
      else if (kind === 'back') { this.sx = -1; this.sz = 0; this.nx = 0; this.nz = 1; }
      else if (kind === 'west') { this.sx = 0; this.sz = 1; this.nx = -1; this.nz = 0; }
      else { this.sx = 0; this.sz = -1; this.nx = 1; this.nz = 0; }
    }
    x(s, t) { return this.ox + this.sx * s + this.nx * t; }
    z(s, t) { return this.oz + this.sz * s + this.nz * t; }
    fill(s0, y0, t0, s1, y1, t1, m, mode) {
      const xa = this.x(s0, t0), xb = this.x(s1, t1), za = this.z(s0, t0), zb = this.z(s1, t1);
      this.g.fill(Math.min(xa, xb), y0, Math.min(za, zb), Math.max(xa, xb), y1, Math.max(za, zb), m, mode);
    }
    carve(s0, y0, t0, s1, y1, t1) { this.fill(s0, y0, t0, s1, y1, t1, 0, 0); }
    get(s, y, t) { return this.g.get(this.x(s, t), y, this.z(s, t)); }
    set(s, y, t, m) { this.g.set(this.x(s, t), y, this.z(s, t), m); }
    put(s, y, t, m) { this.g.put(this.x(s, t), y, this.z(s, t), m); }
    /* fill a t-range for every cell centre (s,y) in the box where pred(s,y) is true; matFn optional (s,y)->material */
    shape(s0, s1, y0, y1, t0, t1, m, pred, mode) {
      const vs = this.g.vs;
      const ns = Math.max(1, Math.round((s1 - s0) / vs)), ny = Math.max(1, Math.round((y1 - y0) / vs));
      for (let i = 0; i < ns; i++) {
        const s = s0 + (i + 0.5) * vs;
        let runStart = -1;
        for (let j = 0; j <= ny; j++) {
          const y = y0 + (j + 0.5) * vs;
          const on = j < ny && pred(s, y);
          if (on && runStart < 0) runStart = j;
          else if (!on && runStart >= 0) {
            const mm = typeof m === 'function' ? m(s, y0 + (runStart + 0.5) * vs) : m;
            this.fill(s0 + i * vs, y0 + runStart * vs, t0, s0 + (i + 1) * vs, y0 + j * vs, t1, mm, mode);
            runStart = -1;
          }
        }
      }
    }
  }
  B.Wall = Wall;

  /* ----- shape predicates ----- */
  /* lancet (pointed) arch: rectangle sL..sR from yb, apex at yTop; grow expands outline by g */
  B.lancet = function (sL, sR, yb, yTop, grow) {
    grow = grow || 0;
    const W = sR - sL;
    const rise = Math.min(W * 0.866, yTop - yb);
    const ys = yTop - rise;
    const r = W + grow;
    return (s, y) => {
      if (y < yb - grow) return false;
      if (y <= ys) return s >= sL - grow && s <= sR + grow;
      const d1 = Math.hypot(s - sR, y - ys), d2 = Math.hypot(s - sL, y - ys);
      return d1 <= r && d2 <= r;
    };
  };
  B.roundArch = function (sL, sR, yb, yTop, grow) {
    grow = grow || 0;
    const r = (sR - sL) / 2 + grow;
    const sc = (sL + sR) / 2;
    const ys = yTop - (sR - sL) / 2;
    return (s, y) => {
      if (y < yb - grow) return false;
      if (y <= ys) return s >= sL - grow && s <= sR + grow;
      return Math.hypot(s - sc, y - ys) <= r;
    };
  };
  B.rectPred = (sL, sR, yb, yt) => (s, y) => s >= sL && s <= sR && y >= yb && y <= yt;

  /* Gothic window with stone surround, recess, mullions, transom and head tracery.
     w = opening width, sillY = bottom y, topY = apex y. opts: recess, frame, mullions, glass, frameMat, glassLitP */
  B.gothicWindow = function (wall, s0, sillY, w, topY, o) {
    o = o || {};
    const vs = wall.g.vs;
    const fw = o.frame === undefined ? 0.5 : o.frame;
    const rec = o.recess === undefined ? 1.0 : o.recess;
    const fmat = o.frameMat || M.limestoneLt;
    const inner = o.inner || M.recessDk;
    const glass = o.glass || M.glassChurch;
    const pOuter = B.lancet(s0, s0 + w, sillY, topY, fw);
    const pIn = B.lancet(s0, s0 + w, sillY, topY, 0);
    const proud = o.proud === undefined ? 0.4 : o.proud;
    // surround proud of the wall
    wall.shape(s0 - fw, s0 + w + fw, sillY - fw, topY + fw + 0.2, 0, proud, fmat, pOuter, 1);
    // recess (carves through the surround too)
    wall.shape(s0 - fw, s0 + w + fw, sillY - fw, topY + fw + 0.2, -rec, proud + 0.02, 0, pIn, 0);
    // reveal lining (darker stone) at depth
    wall.shape(s0 - fw, s0 + w + fw, sillY - fw, topY + fw + 0.2, -rec - vs, -rec, inner, pIn, 0);
    // glass a little in front of the lining
    wall.shape(s0, s0 + w, sillY, topY, -rec, -rec + vs, glass, pIn, 0);
    // mullions
    const nm = o.mullions === undefined ? 1 : o.mullions;
    const mw = o.mullionW || Math.max(vs * 1.5, 0.35);
    for (let k = 1; k <= nm; k++) {
      const sc = s0 + (w * k) / (nm + 1);
      wall.shape(sc - mw / 2, sc + mw / 2, sillY, topY, -rec + vs, 0.05, fmat, pIn, 1);
    }
    // transom
    if (o.transom !== false) {
      const ty = sillY + (topY - sillY) * (o.transomAt || 0.56);
      wall.shape(s0, s0 + w, ty - mw / 2, ty + mw / 2, -rec + vs, 0.05, fmat, pIn, 1);
      // head tracery: a ring above the transom
      const rise = Math.min(w * 0.866, topY - sillY);
      const ys = topY - rise;
      const cy = (ty + ys) / 2 + rise * 0.55;
      const rr = Math.min(w * 0.2, rise * 0.22);
      if (rr > vs * 1.2 && cy + rr < topY - 0.3) {
        const sc = s0 + w / 2;
        wall.shape(sc - rr - mw, sc + rr + mw, cy - rr - mw, cy + rr + mw, -rec + vs, 0.05, fmat, (s, y) => {
          const d = Math.hypot(s - sc, y - cy);
          return d <= rr + mw * 0.5 && d >= rr - mw * 0.5;
        }, 1);
        wall.shape(sc - mw / 2, sc + mw / 2, cy - rr, cy + rr, -rec + vs, 0.05, fmat, pIn, 1);
      }
    }
    // window sill
    wall.fill(s0 - fw - vs, sillY - fw - vs, 0, s0 + w + fw + vs, sillY - fw, 0.5, fmat, 0);
  };

  /* fill columns: fn(x,z,out) sets out.top (absolute y) and out.mat, returns false to skip */
  B.columns = function (g, x0, z0, x1, z1, yLow, fn) {
    const vs = g.vs, nx = g.nx, ny = g.ny;
    const rx = g._rng(x0, x1, g.ox, g.nx), rz = g._rng(z0, z1, g.oz, g.nz);
    const out = { top: 0, mat: 0, low: yLow };
    const d = g.data;
    for (let k = rz[0]; k <= rz[1]; k++) {
      const z = g.oz + (k + 0.5) * vs;
      for (let i = rx[0]; i <= rx[1]; i++) {
        const x = g.ox + (i + 0.5) * vs;
        out.low = yLow;
        if (fn(x, z, out) === false) continue;
        const j0 = Math.max(0, Math.ceil((out.low - g.oy) / vs - 0.5 - 1e-4));
        const j1 = Math.min(ny - 1, Math.ceil((out.top - g.oy) / vs - 0.5 - 1e-4) - 1);
        let ix = i + nx * (j0 + ny * k);
        for (let j = j0; j <= j1; j++, ix += nx) d[ix] = out.mat;
      }
    }
  };

  /* roof tile shade variants: banded along the ridge so greedy meshing keeps long strips */
  B.roofMats = function (base, variants) {
    return variants;
  };
  B.bandMat = function (mats, band, x, seedBase) {
    const h = PU.hash2(Math.floor(x / 3.1) + (seedBase | 0), band, 5);
    return mats[Math.min(mats.length - 1, Math.floor(h * mats.length))];
  };

  /* Build distance LODs for a set of grids: level 0 = full grid, then downsampled copies.
     items: [{grid, skip, thr}], xf: transform, opts: {d: [maxDist per level], ds: [factor per extra level]} */
  B.makeLods = function (items, xf, opts) {
    const lods = [];
    const b0 = new PU.GeoBuilder();
    for (const it of items) PU.meshGrid(it.grid, b0, { xf, skip: it.skip, texVar: it.texVar });
    lods.push({ maxDist: opts.d[0], builder: b0 });
    for (let k = 0; k < opts.ds.length; k++) {
      const b = new PU.GeoBuilder();
      for (const it of items) {
        const g2 = it.grid.downsample(opts.ds[k], it.thr === undefined ? 0.34 : it.thr);
        PU.meshGrid(g2, b, { xf, skip: it.skip, texVar: it.texVar });
      }
      lods.push({ maxDist: opts.d[k + 1] === undefined ? Infinity : opts.d[k + 1], builder: b });
    }
    return lods;
  };

  /* box filled in world-aligned material patches (for weathered stone variation) */
  B.patchBox = function (g, x0, y0, z0, x1, y1, z1, fn, px, py, pz) {
    for (let ix = Math.floor(x0 / px); ix * px < x1; ix++)
      for (let iy = Math.floor(y0 / py); iy * py < y1; iy++)
        for (let iz = Math.floor(z0 / pz); iz * pz < z1; iz++) {
          g.fill(Math.max(x0, ix * px), Math.max(y0, iy * py), Math.max(z0, iz * pz), Math.min(x1, (ix + 1) * px), Math.min(y1, (iy + 1) * py), Math.min(z1, (iz + 1) * pz), fn(ix * px + px / 2, iy * py + py / 2, iz * pz + pz / 2));
        }
  };

  /* simple deterministic per-building RNG */
  B.rngFor = (seed) => new PU.RNG(seed);

  /* rectangle helpers */
  B.dist2 = (a, b, c, d) => (a - c) * (a - c) + (b - d) * (b - d);
})();

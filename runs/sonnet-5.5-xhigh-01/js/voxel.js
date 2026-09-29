/* Piata Unirii — voxel grids, authoring primitives, greedy mesher with vertex AO, LOD downsampling */
(function () {
  'use strict';
  const PU = window.PU;
  const PAL = PU.PAL;

  const AO_TABLE = [0.4, 0.62, 0.82, 1.0];
  const VS_TABLE = [0.05, 0.1, 0.125, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];
  function vsCode(vs) {
    let best = 0, bd = 1e9;
    for (let i = 0; i < VS_TABLE.length; i++) {
      const d = Math.abs(Math.log(vs / VS_TABLE[i]));
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  PU.vsCode = vsCode;

  const packN = (nx, ny, nz) => ((Math.round(nx * 127) & 255) | ((Math.round(ny * 127) & 255) << 8) | ((Math.round(nz * 127) & 255) << 16)) >>> 0;
  const packC = (r, g, b, a) => (r | (g << 8) | (b << 16) | (a << 24)) >>> 0;
  const packM = (t, v, e, f) => (t | (v << 8) | (e << 16) | (f << 24)) >>> 0;
  PU.packN = packN;
  PU.packC = packC;
  PU.packM = packM;

  /* ------------------------------------------------------------------ */
  class VoxelGrid {
    constructor(nx, ny, nz, vs, ox, oy, oz) {
      this.nx = nx | 0;
      this.ny = ny | 0;
      this.nz = nz | 0;
      this.vs = vs;
      this.ox = ox || 0;
      this.oy = oy || 0;
      this.oz = oz || 0;
      this.data = new Uint8Array(this.nx * this.ny * this.nz);
    }
    static box(x0, y0, z0, x1, y1, z1, vs) {
      return new VoxelGrid(Math.ceil((x1 - x0) / vs - 1e-6), Math.ceil((y1 - y0) / vs - 1e-6), Math.ceil((z1 - z0) / vs - 1e-6), vs, x0, y0, z0);
    }
    getC(i, j, k) {
      if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return 0;
      return this.data[i + this.nx * (j + this.ny * k)];
    }
    setC(i, j, k, m) {
      if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return;
      this.data[i + this.nx * (j + this.ny * k)] = m;
    }
    get(x, y, z) {
      const vs = this.vs;
      return this.getC(Math.floor((x - this.ox) / vs), Math.floor((y - this.oy) / vs), Math.floor((z - this.oz) / vs));
    }
    set(x, y, z, m) {
      const vs = this.vs;
      this.setC(Math.floor((x - this.ox) / vs), Math.floor((y - this.oy) / vs), Math.floor((z - this.oz) / vs), m);
    }
    /* set only if currently air */
    put(x, y, z, m) {
      const vs = this.vs;
      const i = Math.floor((x - this.ox) / vs), j = Math.floor((y - this.oy) / vs), k = Math.floor((z - this.oz) / vs);
      if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return;
      const ix = i + this.nx * (j + this.ny * k);
      if (!this.data[ix]) this.data[ix] = m;
    }
    _rng(a0, a1, o, n) {
      const vs = this.vs;
      let i0 = Math.ceil((a0 - o) / vs - 0.5 - 1e-4);
      let i1 = Math.ceil((a1 - o) / vs - 0.5 - 1e-4) - 1;
      if (i0 < 0) i0 = 0;
      if (i1 > n - 1) i1 = n - 1;
      return [i0, i1];
    }
    /* metre-space box; mode 0 set, 1 only-air, 2 only-solid */
    fill(x0, y0, z0, x1, y1, z1, m, mode) {
      const rx = this._rng(x0, x1, this.ox, this.nx),
        ry = this._rng(y0, y1, this.oy, this.ny),
        rz = this._rng(z0, z1, this.oz, this.nz);
      const nx = this.nx, ny = this.ny, d = this.data;
      mode = mode | 0;
      for (let k = rz[0]; k <= rz[1]; k++)
        for (let j = ry[0]; j <= ry[1]; j++) {
          let ix = rx[0] + nx * (j + ny * k);
          if (mode === 0) for (let i = rx[0]; i <= rx[1]; i++) d[ix++] = m;
          else if (mode === 1) for (let i = rx[0]; i <= rx[1]; i++, ix++) { if (!d[ix]) d[ix] = m; }
          else for (let i = rx[0]; i <= rx[1]; i++, ix++) { if (d[ix]) d[ix] = m; }
        }
    }
    carve(x0, y0, z0, x1, y1, z1) {
      this.fill(x0, y0, z0, x1, y1, z1, 0, 0);
    }
    /* iterate cell centres in a metre box; fn(x,y,z,i,j,k) returns material (number) or undefined to skip */
    fillFn(x0, y0, z0, x1, y1, z1, fn) {
      const rx = this._rng(x0, x1, this.ox, this.nx),
        ry = this._rng(y0, y1, this.oy, this.ny),
        rz = this._rng(z0, z1, this.oz, this.nz);
      const vs = this.vs, nx = this.nx, ny = this.ny, d = this.data;
      for (let k = rz[0]; k <= rz[1]; k++) {
        const z = this.oz + (k + 0.5) * vs;
        for (let j = ry[0]; j <= ry[1]; j++) {
          const y = this.oy + (j + 0.5) * vs;
          for (let i = rx[0]; i <= rx[1]; i++) {
            const m = fn(this.ox + (i + 0.5) * vs, y, z, i, j, k);
            if (m !== undefined && m !== false && m !== null) d[i + nx * (j + ny * k)] = m;
          }
        }
      }
    }
    ellipsoid(cx, cy, cz, rx, ry, rz, m, mode) {
      const fn = (x, y, z) => {
        const a = (x - cx) / rx, b = (y - cy) / ry, c = (z - cz) / rz;
        return a * a + b * b + c * c <= 1 ? m : undefined;
      };
      if (mode === 1) {
        this.fillFn(cx - rx, cy - ry, cz - rz, cx + rx, cy + ry, cz + rz, (x, y, z) => {
          const a = (x - cx) / rx, b = (y - cy) / ry, c = (z - cz) / rz;
          return a * a + b * b + c * c <= 1 && !this.get(x, y, z) ? m : undefined;
        });
      } else this.fillFn(cx - rx, cy - ry, cz - rz, cx + rx, cy + ry, cz + rz, fn);
    }
    sphere(cx, cy, cz, r, m, mode) {
      this.ellipsoid(cx, cy, cz, r, r, r, m, mode);
    }
    cylY(cx, cz, r, y0, y1, m) {
      this.fillFn(cx - r, y0, cz - r, cx + r, y1, cz + r, (x, y, z) => ((x - cx) * (x - cx) + (z - cz) * (z - cz) <= r * r ? m : undefined));
    }
    /* thick line (capsule) between two points */
    line(x0, y0, z0, x1, y1, z1, r, m, r1) {
      const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
      const n = Math.max(1, Math.ceil(len / (this.vs * 0.5)));
      r1 = r1 === undefined ? r : r1;
      for (let s = 0; s <= n; s++) {
        const t = s / n;
        const rr = r + (r1 - r) * t;
        const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t;
        if (rr <= this.vs * 0.55) this.set(x, y, z, m);
        else this.sphere(x, y, z, rr, m);
      }
    }
    /* polygon in xz (array of [x,z]) extruded in y */
    prism(pts, y0, y1, m, mode) {
      let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
      for (const p of pts) {
        if (p[0] < minx) minx = p[0];
        if (p[0] > maxx) maxx = p[0];
        if (p[1] < minz) minz = p[1];
        if (p[1] > maxz) maxz = p[1];
      }
      const n = pts.length;
      this.fillFn(minx, y0, minz, maxx, y1, maxz, (x, y, z) => {
        let inside = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
          if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
        }
        if (!inside) return undefined;
        if (mode === 1 && this.get(x, y, z)) return undefined;
        return typeof m === 'function' ? m(x, y, z) : m;
      });
    }
    countSolid() {
      let c = 0;
      const d = this.data;
      for (let i = 0; i < d.length; i++) if (d[i]) c++;
      return c;
    }
    /* coarser copy for distance LOD. thr = fraction of block that must be solid */
    downsample(k, thr) {
      const nx2 = Math.ceil(this.nx / k), ny2 = Math.ceil(this.ny / k), nz2 = Math.ceil(this.nz / k);
      const g = new VoxelGrid(nx2, ny2, nz2, this.vs * k, this.ox, this.oy, this.oz);
      const minCount = Math.max(1, Math.round((thr === undefined ? 0.34 : thr) * k * k * k));
      const hist = new Uint16Array(256);
      const touched = new Uint8Array(k * k * k);
      const { nx, ny, nz, data } = this;
      for (let K = 0; K < nz2; K++)
        for (let J = 0; J < ny2; J++)
          for (let I = 0; I < nx2; I++) {
            let cnt = 0, nt = 0;
            const i1 = Math.min(nx, (I + 1) * k), j1 = Math.min(ny, (J + 1) * k), k1 = Math.min(nz, (K + 1) * k);
            for (let kk = K * k; kk < k1; kk++)
              for (let jj = J * k; jj < j1; jj++) {
                let ix = I * k + nx * (jj + ny * kk);
                for (let ii = I * k; ii < i1; ii++, ix++) {
                  const m = data[ix];
                  if (m) {
                    if (hist[m] === 0) touched[nt++] = m;
                    hist[m]++;
                    cnt++;
                  }
                }
              }
            if (cnt >= minCount) {
              let best = 0, bc = 0;
              for (let t = 0; t < nt; t++) {
                const m = touched[t];
                if (hist[m] > bc) { bc = hist[m]; best = m; }
              }
              g.data[I + nx2 * (J + ny2 * K)] = best;
            }
            for (let t = 0; t < nt; t++) hist[touched[t]] = 0;
          }
      return g;
    }
  }
  PU.VoxelGrid = VoxelGrid;

  /* ------------------------------------------------------------------ */
  /* Geometry accumulation: interleaved 6-word vertices (pos f32x3, normal i8x4, colour u8x4, misc u8x4) */
  class GeoBuilder {
    constructor() {
      this.pools = new Array(9).fill(null);
      this.min = [1e9, 1e9, 1e9];
      this.max = [-1e9, -1e9, -1e9];
    }
    pool(i) {
      let b = this.pools[i];
      if (!b) {
        b = { vcap: 2048, vn: 0, icap: 3072, in: 0, buf: new ArrayBuffer(2048 * 24), f: null, u: null, idx: new Uint32Array(3072) };
        b.f = new Float32Array(b.buf);
        b.u = new Uint32Array(b.buf);
        this.pools[i] = b;
      }
      return b;
    }
    ensure(b, av, ai) {
      if (b.vn + av > b.vcap) {
        let nc = b.vcap * 2;
        while (b.vn + av > nc) nc *= 2;
        const nb = new ArrayBuffer(nc * 24);
        new Uint8Array(nb).set(new Uint8Array(b.buf, 0, b.vn * 24));
        b.buf = nb;
        b.f = new Float32Array(nb);
        b.u = new Uint32Array(nb);
        b.vcap = nc;
      }
      if (b.in + ai > b.icap) {
        let nc = b.icap * 2;
        while (b.in + ai > nc) nc *= 2;
        const ni = new Uint32Array(nc);
        ni.set(b.idx.subarray(0, b.in));
        b.idx = ni;
        b.icap = nc;
      }
    }
    bound(x, y, z) {
      const mn = this.min, mx = this.max;
      if (x < mn[0]) mn[0] = x;
      if (y < mn[1]) mn[1] = y;
      if (z < mn[2]) mn[2] = z;
      if (x > mx[0]) mx[0] = x;
      if (y > mx[1]) mx[1] = y;
      if (z > mx[2]) mx[2] = z;
    }
    /* generic 4-corner quad. c = [x0,y0,z0, x1..., x2..., x3...] CCW seen from outside. cols: 4 packed colours */
    quad(pool, c, nrm, c0, c1, c2, c3, misc, flip) {
      const b = this.pool(pool);
      this.ensure(b, 4, 6);
      const base = b.vn;
      const cols = [c0, c1, c2, c3];
      for (let q = 0; q < 4; q++) {
        const o = (base + q) * 6;
        b.f[o] = c[q * 3];
        b.f[o + 1] = c[q * 3 + 1];
        b.f[o + 2] = c[q * 3 + 2];
        b.u[o + 3] = nrm;
        b.u[o + 4] = cols[q];
        b.u[o + 5] = misc;
        this.bound(c[q * 3], c[q * 3 + 1], c[q * 3 + 2]);
      }
      b.vn += 4;
      const ix = b.idx;
      let n = b.in;
      if (!flip) {
        ix[n++] = base; ix[n++] = base + 1; ix[n++] = base + 2;
        ix[n++] = base; ix[n++] = base + 2; ix[n++] = base + 3;
      } else {
        ix[n++] = base + 1; ix[n++] = base + 2; ix[n++] = base + 3;
        ix[n++] = base + 1; ix[n++] = base + 3; ix[n++] = base;
      }
      b.in = n;
    }
    triangleCount() {
      let t = 0;
      for (const b of this.pools) if (b) t += b.in / 3;
      return t;
    }
    vertexCount() {
      let t = 0;
      for (const b of this.pools) if (b) t += b.vn;
      return t;
    }
    isEmpty() {
      return this.pools.every((b) => !b || b.vn === 0);
    }
    /* copy another builder's geometry with a transform (yaw about Y, uniform scale, translation) and optional tint */
    append(other, xf, tint) {
      xf = xf || {};
      const yaw = xf.yaw || 0, s = xf.s === undefined ? 1 : xf.s;
      const cs = Math.cos(yaw), sn = Math.sin(yaw);
      const tx = xf.x || 0, ty = xf.y || 0, tz = xf.z || 0;
      for (let p = 0; p < 9; p++) {
        const ob = other.pools[p];
        if (!ob || !ob.vn) continue;
        const b = this.pool(p);
        this.ensure(b, ob.vn, ob.in);
        const base = b.vn;
        for (let v = 0; v < ob.vn; v++) {
          const o = v * 6, d = (base + v) * 6;
          const lx = ob.f[o], ly = ob.f[o + 1], lz = ob.f[o + 2];
          const wx = tx + s * (cs * lx + sn * lz), wy = ty + s * ly, wz = tz + s * (-sn * lx + cs * lz);
          b.f[d] = wx;
          b.f[d + 1] = wy;
          b.f[d + 2] = wz;
          const np = ob.u[o + 3];
          let nx = (np & 255) << 24 >> 24, ny = ((np >> 8) & 255) << 24 >> 24, nz = ((np >> 16) & 255) << 24 >> 24;
          nx /= 127; ny /= 127; nz /= 127;
          b.u[d + 3] = yaw === 0 ? np : packN(cs * nx + sn * nz, ny, -sn * nx + cs * nz);
          let col = ob.u[o + 4];
          const misc = ob.u[o + 5];
          if (tint && (misc >>> 24) & 1) {
            let r = col & 255, g = (col >> 8) & 255, bl = (col >> 16) & 255;
            r = Math.min(255, r * tint[0]); g = Math.min(255, g * tint[1]); bl = Math.min(255, bl * tint[2]);
            col = ((col & 0xff000000) | (Math.round(bl) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
          }
          b.u[d + 4] = col;
          b.u[d + 5] = misc;
          this.bound(wx, wy, wz);
        }
        for (let i = 0; i < ob.in; i++) b.idx[b.in + i] = ob.idx[i] + base;
        b.vn += ob.vn;
        b.in += ob.in;
      }
    }
  }
  PU.GeoBuilder = GeoBuilder;

  /* ------------------------------------------------------------------ */
  /* Greedy mesher with vertex ambient occlusion. Emits only exposed surface faces. */
  function meshGrid(grid, B, opt) {
    opt = opt || {};
    const xf = opt.xf || {};
    const yaw = xf.yaw || 0, S = xf.s === undefined ? 1 : xf.s;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const tx = xf.x || 0, ty = xf.y || 0, tz = xf.z || 0;
    const skip = opt.skip || null;
    const aoStrength = opt.ao === undefined ? 1 : opt.ao;
    const texVar = opt.texVar || 0;
    const flagsOverride = opt.flags; // e.g. rig part id for actor templates
    const { nx, ny, nz, vs, data } = grid;
    const dims = [nx, ny, nz], org = [grid.ox, grid.oy, grid.oz], str = [1, nx, nx * ny];
    const vc = vsCode(vs * S);
    const aoByte = [0, 1, 2, 3].map((a) => Math.round(255 * (1 - (1 - AO_TABLE[a]) * aoStrength)));
    const R = PAL.r, G = PAL.g, Bl = PAL.b, PLL = PAL.pool, EMI = PAL.em, TN = PAL.tint;
    const lp = [0, 0, 0];

    for (let d = 0; d < 3; d++) {
      const u = (d + 1) % 3, v = (d + 2) % 3;
      const nd = dims[d], nu = dims[u], nv = dims[v];
      const sd = str[d], su = str[u], sv = str[v];
      const mp = new Int32Array(nu * nv), mn = new Int32Array(nu * nv);

      const occ = (l, i, j) => {
        if (l < 0 || l >= nd || i < 0 || i >= nu || j < 0 || j >= nv) return 0;
        return data[i * su + j * sv + l * sd] !== 0 ? 1 : 0;
      };
      const vao = (s1, s2, c) => (s1 && s2 ? 0 : 3 - (s1 + s2 + c));
      const faceKey = (mat, l, i, j) => {
        const a0 = vao(occ(l, i - 1, j), occ(l, i, j - 1), occ(l, i - 1, j - 1));
        const a1 = vao(occ(l, i + 1, j), occ(l, i, j - 1), occ(l, i + 1, j - 1));
        const a2 = vao(occ(l, i + 1, j), occ(l, i, j + 1), occ(l, i + 1, j + 1));
        const a3 = vao(occ(l, i - 1, j), occ(l, i, j + 1), occ(l, i - 1, j + 1));
        return mat | ((a0 | (a1 << 2) | (a2 << 4) | (a3 << 6)) << 8);
      };

      const emit = (i, j, w, h, positive, plane, key) => {
        const mat = key & 255, aoK = (key >> 8) & 255;
        const a0 = aoK & 3, a1 = (aoK >> 2) & 3, a2 = (aoK >> 4) & 3, a3 = (aoK >> 6) & 3;
        const b = B.pool(PLL[mat]);
        B.ensure(b, 4, 6);
        const base = b.vn;
        const pd = plane * vs + org[d];
        const uu0 = i * vs + org[u], uu1 = (i + w) * vs + org[u], vv0 = j * vs + org[v], vv1 = (j + h) * vs + org[v];
        const nl = positive ? 1 : -1;
        // local normal
        let lnx = 0, lny = 0, lnz = 0;
        if (d === 0) lnx = nl; else if (d === 1) lny = nl; else lnz = nl;
        const wnx = cs * lnx + sn * lnz, wny = lny, wnz = -sn * lnx + cs * lnz;
        const np = packN(wnx, wny, wnz);
        const r = R[mat], g = G[mat], bb = Bl[mat];
        const misc = packM(texVar, vc, EMI[mat], flagsOverride !== undefined ? flagsOverride : TN[mat]);
        const cu = [uu0, uu1, uu1, uu0], cv = [vv0, vv0, vv1, vv1], ao = [a0, a1, a2, a3];
        for (let q = 0; q < 4; q++) {
          lp[d] = pd;
          lp[u] = cu[q];
          lp[v] = cv[q];
          const lx = lp[0], ly = lp[1], lz = lp[2];
          const wx = tx + S * (cs * lx + sn * lz), wy = ty + S * ly, wz = tz + S * (-sn * lx + cs * lz);
          const o = (base + q) * 6;
          b.f[o] = wx;
          b.f[o + 1] = wy;
          b.f[o + 2] = wz;
          b.u[o + 3] = np;
          b.u[o + 4] = packC(r, g, bb, aoByte[ao[q]]);
          b.u[o + 5] = misc;
          B.bound(wx, wy, wz);
        }
        b.vn += 4;
        const ix = b.idx;
        let n = b.in;
        const diag02 = a0 + a2 >= a1 + a3;
        if (positive) {
          if (diag02) {
            ix[n++] = base; ix[n++] = base + 1; ix[n++] = base + 2;
            ix[n++] = base; ix[n++] = base + 2; ix[n++] = base + 3;
          } else {
            ix[n++] = base + 1; ix[n++] = base + 2; ix[n++] = base + 3;
            ix[n++] = base + 1; ix[n++] = base + 3; ix[n++] = base;
          }
        } else {
          if (diag02) {
            ix[n++] = base; ix[n++] = base + 2; ix[n++] = base + 1;
            ix[n++] = base; ix[n++] = base + 3; ix[n++] = base + 2;
          } else {
            ix[n++] = base + 1; ix[n++] = base + 3; ix[n++] = base + 2;
            ix[n++] = base + 1; ix[n++] = base; ix[n++] = base + 3;
          }
        }
        b.in = n;
      };

      const greedy = (mask, positive, plane) => {
        for (let j = 0; j < nv; j++) {
          for (let i = 0; i < nu; ) {
            const k = mask[j * nu + i];
            if (!k) { i++; continue; }
            const ao = (k >> 8) & 255;
            const uni = (ao & 3) === ((ao >> 2) & 3) && (ao & 3) === ((ao >> 4) & 3) && (ao & 3) === ((ao >> 6) & 3);
            let w = 1, h = 1;
            if (uni) {
              while (i + w < nu && mask[j * nu + i + w] === k) w++;
              outer: while (j + h < nv) {
                for (let x = 0; x < w; x++) if (mask[(j + h) * nu + i + x] !== k) break outer;
                h++;
              }
            }
            emit(i, j, w, h, positive, plane, k);
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[(j + y) * nu + i + x] = 0;
            i += w;
          }
        }
      };

      for (let s = -1; s < nd; s++) {
        let cp = 0, cn = 0;
        for (let j = 0; j < nv; j++) {
          const rowBase = j * sv;
          for (let i = 0; i < nu; i++) {
            const base = rowBase + i * su;
            const a = s >= 0 ? data[base + s * sd] : 0;
            const b = s + 1 < nd ? data[base + (s + 1) * sd] : 0;
            const mi = j * nu + i;
            mp[mi] = 0;
            mn[mi] = 0;
            if ((a !== 0) === (b !== 0)) continue;
            if (a) {
              if (s + 1 === nd && skip && skip[d * 2 + 1]) continue;
              mp[mi] = faceKey(a, s + 1, i, j);
              cp++;
            } else {
              if (s === -1 && skip && skip[d * 2]) continue;
              mn[mi] = faceKey(b, s, i, j);
              cn++;
            }
          }
        }
        if (cp) greedy(mp, true, s + 1);
        if (cn) greedy(mn, false, s + 1);
      }
    }
    return B;
  }
  PU.meshGrid = meshGrid;

  /* convenience: mesh a grid into a new builder */
  PU.meshOne = function (grid, opt) {
    const B = new GeoBuilder();
    meshGrid(grid, B, opt);
    return B;
  };
})();

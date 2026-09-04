// Continuous solid voxel ground: a heightmap of stone columns with per-cell
// material, optional water surface, and occluder flags for contact AO.
const AO_NONE = 0b11111111;

export class Ground {
  /**
   * cell: horizontal cell size (m); hq: vertical quantum (m).
   * Covers x in [x0, x0 + nx*cell), z in [z0, z0 + nz*cell).
   */
  constructor({ cell = 0.5, hq = 0.25, x0, z0, nx, nz, defaultMat }) {
    this.cell = cell;
    this.hq = hq;
    this.x0 = x0;
    this.z0 = z0;
    this.nx = nx;
    this.nz = nz;
    this.h = new Int16Array(nx * nz);
    this.mat = new Uint16Array(nx * nz).fill(defaultMat);
    this.wallMat = new Uint16Array(nx * nz).fill(defaultMat);
    this.water = new Int16Array(nx * nz).fill(-32768);
    this.occl = new Uint8Array(nx * nz);
    this.hole = null; // { x0, z0, x1, z1 } world rect excluded from meshing
  }
  inHole(ix, iz) {
    const h = this.hole;
    if (!h) return false;
    const cx = this.x0 + (ix + 0.5) * this.cell;
    const cz = this.z0 + (iz + 0.5) * this.cell;
    return cx >= h.x0 && cx < h.x1 && cz >= h.z0 && cz < h.z1;
  }
  idx(ix, iz) { return ix * this.nz + iz; }
  toIx(x) { return Math.floor((x - this.x0) / this.cell); }
  toIz(z) { return Math.floor((z - this.z0) / this.cell); }
  inBounds(ix, iz) { return ix >= 0 && iz >= 0 && ix < this.nx && iz < this.nz; }
  heightAt(x, z) {
    const ix = this.toIx(x), iz = this.toIz(z);
    if (!this.inBounds(ix, iz)) return 0;
    return this.h[this.idx(ix, iz)] * this.hq;
  }
  /** Iterate cells within a world rect [x0,x1) x [z0,z1). */
  forRect(x0, z0, x1, z1, fn) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    const ix0 = Math.max(0, this.toIx(x0));
    const ix1 = Math.min(this.nx - 1, this.toIx(x1 - 1e-6));
    const iz0 = Math.max(0, this.toIz(z0));
    const iz1 = Math.min(this.nz - 1, this.toIz(z1 - 1e-6));
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const cx = this.x0 + (ix + 0.5) * this.cell;
        const cz = this.z0 + (iz + 0.5) * this.cell;
        fn(this.idx(ix, iz), cx, cz, ix, iz);
      }
    }
  }
  setRect(x0, z0, x1, z1, { mat, wallMat, height, water, occl, fn } = {}) {
    this.forRect(x0, z0, x1, z1, (i, cx, cz) => {
      if (fn && !fn(cx, cz)) return;
      if (mat !== undefined) this.mat[i] = mat;
      if (wallMat !== undefined) this.wallMat[i] = wallMat;
      else if (mat !== undefined) this.wallMat[i] = mat;
      if (height !== undefined) this.h[i] = Math.round(height / this.hq);
      if (water !== undefined) this.water[i] = water === null ? -32768 : Math.round(water / this.hq);
      if (occl !== undefined) this.occl[i] = occl ? 1 : 0;
    });
  }
  /** Circle helper. */
  setDisc(cx, cz, r, opts) {
    this.setRect(cx - r, cz - r, cx + r, cz + r, Object.assign({}, opts, {
      fn: (x, z) => (x - cx) * (x - cx) + (z - cz) * (z - cz) <= r * r && (!opts.fn || opts.fn(x, z)),
    }));
  }
  /** Set height everywhere from a function of world position (metres). */
  setHeightFn(fn) {
    for (let ix = 0; ix < this.nx; ix++) {
      const cx = this.x0 + (ix + 0.5) * this.cell;
      for (let iz = 0; iz < this.nz; iz++) {
        const cz = this.z0 + (iz + 0.5) * this.cell;
        this.h[this.idx(ix, iz)] = Math.round(fn(cx, cz) / this.hq);
      }
    }
  }
  hAt(ix, iz) {
    if (!this.inBounds(ix, iz)) return this.h[this.idx(Math.max(0, Math.min(this.nx - 1, ix)), Math.max(0, Math.min(this.nz - 1, iz)))];
    return this.h[this.idx(ix, iz)];
  }
  occAt(ix, iz, hRef) {
    if (!this.inBounds(ix, iz)) return 0;
    const i = this.idx(ix, iz);
    return this.h[i] > hRef || this.occl[i] ? 1 : 0;
  }
  cornerAo(ix, iz, hRef, su, sv) {
    const s1 = this.occAt(ix + su, iz, hRef);
    const s2 = this.occAt(ix, iz + sv, hRef);
    if (s1 && s2) return 0;
    return 3 - (s1 + s2 + this.occAt(ix + su, iz + sv, hRef));
  }

  /**
   * Emit merged quads into sink. keyFn(cls, x, z) -> group key.
   */
  mesh(palette, sink, keyFn) {
    const { nx, nz, cell, hq, x0, z0 } = this;
    const mask = new Float64Array(nx * nz);
    const codeByKey = new Map();
    const codes = new Map();
    let codeN = 1;
    const codeOf = (h, mat, ao) => {
      const k = h * 4000000 + mat * 300 + ao;
      let c = codeByKey.get(k);
      if (!c) { c = codeN++; codeByKey.set(k, c); codes.set(c, [c, h, mat, ao]); }
      return c;
    };
    // --- top faces ---
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const i = ix * nz + iz;
        if (this.inHole(ix, iz)) { mask[i] = 0; continue; }
        const h = this.h[i];
        const ao = this.cornerAo(ix, iz, h, -1, -1) | (this.cornerAo(ix, iz, h, 1, -1) << 2) | (this.cornerAo(ix, iz, h, 1, 1) << 4) | (this.cornerAo(ix, iz, h, -1, 1) << 6);
        mask[i] = codeOf(h, this.mat[i], ao);
      }
    }
    this.greedy2D(mask, (ix, iz, w, d, code) => {
      const [, h, mat, ao] = codes.get(code);
      const e = palette.entries[mat];
      const y = h * hq;
      const xa = x0 + ix * cell, xb = x0 + (ix + w) * cell;
      const za = z0 + iz * cell, zb = z0 + (iz + d) * cell;
      // corners: c0(-,-) c1(+,-) c2(+,+) c3(-,+) in (x,z); top normal +Y => CCW order seen from above is (x,z): (xa,za),(xa,zb),(xb,zb),(xb,za)
      const aos = [ao & 3, (ao >> 2) & 3, (ao >> 4) & 3, (ao >> 6) & 3];
      sink.quad(keyFn(e.cls, (xa + xb) / 2, (za + zb) / 2),
        [[xa, y, za], [xa, y, zb], [xb, y, zb], [xb, y, za]], [0, 1, 0], e.r, e.g, e.b,
        [aos[0], aos[3], aos[2], aos[1]], [[xa, za], [xa, zb], [xb, zb], [xb, za]]);
    });
    // --- water surfaces ---
    mask.fill(0);
    let any = false;
    for (let i = 0; i < nx * nz; i++) {
      if (this.water[i] !== -32768 && this.water[i] > this.h[i] && !this.inHole(Math.floor(i / nz), i % nz)) { mask[i] = codeOf(this.water[i], this.mat[i], 255); any = true; }
    }
    if (any) {
      this.greedy2D(mask, (ix, iz, w, d, code) => {
        const [, h] = codes.get(code);
        const y = h * hq;
        const xa = x0 + ix * cell, xb = x0 + (ix + w) * cell;
        const za = z0 + iz * cell, zb = z0 + (iz + d) * cell;
        sink.quad(keyFn('water', (xa + xb) / 2, (za + zb) / 2),
          [[xa, y, za], [xa, y, zb], [xb, y, zb], [xb, y, za]], [0, 1, 0], 0.42, 0.5, 0.55,
          [3, 3, 3, 3], [[xa, za], [xa, zb], [xb, zb], [xb, za]]);
      });
    }
    // --- side faces (curbs, steps, pits) merged along rows ---
    const emitSide = (dir) => {
      // dir: 0 => +x face of cells whose +x neighbour is lower; 1 => -x; 2 => +z; 3 => -z
      const alongX = dir >= 2; // faces perpendicular to z run along x
      const outer = alongX ? nz : nx;
      const inner = alongX ? nx : nz;
      for (let a = 0; a < outer; a++) {
        let run = null;
        const flush = () => {
          if (!run) return;
          const { start, end, hTop, hBot, mat } = run;
          const e = palette.entries[mat];
          const yT = hTop * hq, yB = hBot * hq;
          let verts, normal, uvs;
          if (alongX) {
            const iz = a;
            const xa = x0 + start * cell, xb = x0 + (end + 1) * cell;
            const z = dir === 2 ? z0 + (iz + 1) * cell : z0 + iz * cell;
            if (dir === 2) { // +z normal
              verts = [[xa, yB, z], [xb, yB, z], [xb, yT, z], [xa, yT, z]];
              normal = [0, 0, 1];
            } else {
              verts = [[xb, yB, z], [xa, yB, z], [xa, yT, z], [xb, yT, z]];
              normal = [0, 0, -1];
            }
            uvs = [[xa, yB], [xb, yB], [xb, yT], [xa, yT]];
          } else {
            const ix = a;
            const za = z0 + start * cell, zb = z0 + (end + 1) * cell;
            const x = dir === 0 ? x0 + (ix + 1) * cell : x0 + ix * cell;
            if (dir === 0) { // +x normal: CCW seen from +x: (z increasing at bottom then up)
              verts = [[x, yB, zb], [x, yB, za], [x, yT, za], [x, yT, zb]];
              normal = [1, 0, 0];
            } else {
              verts = [[x, yB, za], [x, yB, zb], [x, yT, zb], [x, yT, za]];
              normal = [-1, 0, 0];
            }
            uvs = [[za, yB], [zb, yB], [zb, yT], [za, yT]];
          }
          const cx = (verts[0][0] + verts[2][0]) / 2, cz = (verts[0][2] + verts[2][2]) / 2;
          sink.quad(keyFn(e.cls, cx, cz), verts, normal, e.r, e.g, e.b, [2, 2, 3, 3], uvs);
          run = null;
        };
        for (let b = 0; b < inner; b++) {
          const ix = alongX ? b : a;
          const iz = alongX ? a : b;
          const i = ix * nz + iz;
          if (this.inHole(ix, iz)) { flush(); continue; }
          const h = this.h[i];
          let nix = ix, niz = iz;
          if (dir === 0) nix++; else if (dir === 1) nix--; else if (dir === 2) niz++; else niz--;
          let nh;
          if (!this.inBounds(nix, niz)) nh = h - Math.round(2 / hq); // skirt at map edge
          else if (this.inHole(nix, niz)) nh = h;
          else nh = this.h[nix * nz + niz];
          if (nh < h) {
            const mat = this.wallMat[i];
            if (run && run.hTop === h && run.hBot === nh && run.mat === mat && run.end === b - 1) {
              run.end = b;
            } else {
              flush();
              run = { start: b, end: b, hTop: h, hBot: nh, mat };
            }
          } else {
            flush();
          }
        }
        flush();
      }
    };
    for (let dir = 0; dir < 4; dir++) emitSide(dir);
  }

  greedy2D(mask, emit) {
    const { nx, nz } = this;
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; ) {
        const c = mask[ix * nz + iz];
        if (c === 0) { iz++; continue; }
        let d = 1;
        while (iz + d < nz && mask[ix * nz + iz + d] === c) d++;
        let w = 1;
        let ok = true;
        while (ix + w < nx && ok) {
          for (let k = 0; k < d; k++) {
            if (mask[(ix + w) * nz + iz + k] !== c) { ok = false; break; }
          }
          if (ok) w++;
        }
        emit(ix, iz, w, d, c);
        for (let a = 0; a < w; a++) for (let k = 0; k < d; k++) mask[(ix + a) * nz + iz + k] = 0;
        iz += d;
      }
    }
  }
}

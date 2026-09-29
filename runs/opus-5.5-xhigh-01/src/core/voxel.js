// Dense voxel grid with a one-voxel padding shell. Builders work in metres;
// the grid snaps shapes to voxel centres. The padding shell encodes boundary
// conditions for the mesher (ground below, party walls against neighbours).

import { AIR, HIDDEN } from './mat.js';

const EPS = 1e-7;

export class VoxelGrid {
  // bounds in metres (local asset frame); vs = voxel edge length in metres
  constructor(x0, y0, z0, x1, y1, z1, vs) {
    this.vs = vs;
    this.ox = x0; this.oy = y0; this.oz = z0;
    this.NX = Math.max(1, Math.ceil((x1 - x0) / vs - 1e-6));
    this.NY = Math.max(1, Math.ceil((y1 - y0) / vs - 1e-6));
    this.NZ = Math.max(1, Math.ceil((z1 - z0) / vs - 1e-6));
    this.nx = this.NX + 2; this.ny = this.NY + 2; this.nz = this.NZ + 2;
    const cells = this.nx * this.ny * this.nz;
    if (cells > 60e6) throw new Error('VoxelGrid too large: ' + cells);
    this.data = new Uint16Array(cells);
    this.sz = this.nx;
    this.sy = this.nx * this.nz;
    this.boundary = { ground: true, party: null };
  }

  // interior index range of voxel centres inside [a, b)
  i0(a) { return clampI(Math.ceil((a - this.ox) / this.vs - 0.5 - EPS), this.NX); }
  j0(a) { return clampI(Math.ceil((a - this.oy) / this.vs - 0.5 - EPS), this.NY); }
  k0(a) { return clampI(Math.ceil((a - this.oz) / this.vs - 0.5 - EPS), this.NZ); }
  cx(i) { return this.ox + (i + 0.5) * this.vs; }
  cy(j) { return this.oy + (j + 0.5) * this.vs; }
  cz(k) { return this.oz + (k + 0.5) * this.vs; }
  // voxel index containing a point
  pi(x) { return Math.floor((x - this.ox) / this.vs); }
  pj(y) { return Math.floor((y - this.oy) / this.vs); }
  pk(z) { return Math.floor((z - this.oz) / this.vs); }

  index(i, j, k) { return (j + 1) * this.sy + (k + 1) * this.sz + (i + 1); }
  inside(i, j, k) { return i >= 0 && j >= 0 && k >= 0 && i < this.NX && j < this.NY && k < this.NZ; }
  getV(i, j, k) { return this.inside(i, j, k) ? this.data[this.index(i, j, k)] : AIR; }
  setV(i, j, k, m) { if (this.inside(i, j, k)) this.data[this.index(i, j, k)] = m; }
  get(x, y, z) { return this.getV(this.pi(x), this.pj(y), this.pk(z)); }
  set(x, y, z, m) { this.setV(this.pi(x), this.pj(y), this.pk(z), m); }

  // Axis-aligned box fill in metres. mode: 0 = overwrite, 1 = only empty, 2 = only solid (repaint)
  box(x0, y0, z0, x1, y1, z1, m, mode = 0) {
    if (x1 < x0) { const t = x0; x0 = x1; x1 = t; }
    if (y1 < y0) { const t = y0; y0 = y1; y1 = t; }
    if (z1 < z0) { const t = z0; z0 = z1; z1 = t; }
    const ia = this.i0(x0), ib = this.i0(x1);
    const ja = this.j0(y0), jb = this.j0(y1);
    const ka = this.k0(z0), kb = this.k0(z1);
    const d = this.data;
    for (let j = ja; j < jb; j++) {
      for (let k = ka; k < kb; k++) {
        const base = (j + 1) * this.sy + (k + 1) * this.sz + 1;
        if (mode === 0) {
          d.fill(m, base + ia, base + ib);
        } else if (mode === 1) {
          for (let i = ia; i < ib; i++) if (d[base + i] === AIR) d[base + i] = m;
        } else {
          for (let i = ia; i < ib; i++) if (d[base + i] !== AIR) d[base + i] = m;
        }
      }
    }
  }
  fill(x0, y0, z0, x1, y1, z1, m) { this.box(x0, y0, z0, x1, y1, z1, m, 1); }
  paint(x0, y0, z0, x1, y1, z1, m) { this.box(x0, y0, z0, x1, y1, z1, m, 2); }
  carve(x0, y0, z0, x1, y1, z1) { this.box(x0, y0, z0, x1, y1, z1, AIR, 0); }

  // Generic per-voxel function over a metre-space bounding box.
  // f(x, y, z, current) -> new id, or -1 to keep current.
  fn(x0, y0, z0, x1, y1, z1, f) {
    const ia = this.i0(Math.min(x0, x1)), ib = this.i0(Math.max(x0, x1));
    const ja = this.j0(Math.min(y0, y1)), jb = this.j0(Math.max(y0, y1));
    const ka = this.k0(Math.min(z0, z1)), kb = this.k0(Math.max(z0, z1));
    const d = this.data, vs = this.vs;
    for (let j = ja; j < jb; j++) {
      const y = this.oy + (j + 0.5) * vs;
      for (let k = ka; k < kb; k++) {
        const z = this.oz + (k + 0.5) * vs;
        const base = (j + 1) * this.sy + (k + 1) * this.sz + 1;
        for (let i = ia; i < ib; i++) {
          const x = this.ox + (i + 0.5) * vs;
          const r = f(x, y, z, d[base + i]);
          if (r >= 0) d[base + i] = r;
        }
      }
    }
  }

  sphere(cx, cy, cz, r, m, mode = 0) {
    const r2 = r * r;
    this.fn(cx - r, cy - r, cz - r, cx + r, cy + r, cz + r, (x, y, z, c) => {
      const dx = x - cx, dy = y - cy, dz = z - cz;
      if (dx * dx + dy * dy + dz * dz > r2) return -1;
      if (mode === 1 && c !== AIR) return -1;
      if (mode === 2 && c === AIR) return -1;
      return m;
    });
  }

  ellipsoid(cx, cy, cz, rx, ry, rz, m, mode = 0) {
    this.fn(cx - rx, cy - ry, cz - rz, cx + rx, cy + ry, cz + rz, (x, y, z, c) => {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
      if (dx * dx + dy * dy + dz * dz > 1) return -1;
      if (mode === 1 && c !== AIR) return -1;
      return m;
    });
  }

  cylY(cx, cz, r, y0, y1, m, mode = 0) {
    const r2 = r * r;
    this.fn(cx - r, y0, cz - r, cx + r, y1, cz + r, (x, y, z, c) => {
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz > r2) return -1;
      if (mode === 1 && c !== AIR) return -1;
      return m;
    });
  }

  // Thick line segment (capsule) with radius tapering r0 -> r1
  line(ax, ay, az, bx, by, bz, r0, r1, m, mode = 0) {
    const rm = Math.max(r0, r1);
    const minx = Math.min(ax, bx) - rm, maxx = Math.max(ax, bx) + rm;
    const miny = Math.min(ay, by) - rm, maxy = Math.max(ay, by) + rm;
    const minz = Math.min(az, bz) - rm, maxz = Math.max(az, bz) + rm;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const L2 = dx * dx + dy * dy + dz * dz || 1e-9;
    this.fn(minx, miny, minz, maxx, maxy, maxz, (x, y, z, c) => {
      let t = ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / L2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = ax + dx * t - x, py = ay + dy * t - y, pz = az + dz * t - z;
      const r = r0 + (r1 - r0) * t;
      if (px * px + py * py + pz * pz > r * r) return -1;
      if (mode === 1 && c !== AIR) return -1;
      return m;
    });
  }

  // Fill padding shell according to boundary conditions.
  prepareBoundary() {
    const { nx, ny, nz, sy, sz, data } = this;
    const b = this.boundary;
    // clear shell
    for (let j = 0; j < ny; j++) {
      for (let k = 0; k < nz; k++) {
        const base = j * sy + k * sz;
        if (j === 0 || j === ny - 1 || k === 0 || k === nz - 1) {
          data.fill(AIR, base, base + nx);
        } else {
          data[base] = AIR;
          data[base + nx - 1] = AIR;
        }
      }
    }
    if (b.ground) {
      data.fill(HIDDEN, 0, sy);
    }
    if (b.party) {
      // party walls: {x0, x1, z0, z1} heights in metres (solid from grid bottom to that height)
      const p = b.party;
      const hj = (h) => (h ? clampI(Math.ceil((h - this.oy) / this.vs - EPS), this.NY) : 0);
      const setWallX = (i, h, za = -Infinity, zb = Infinity) => {
        const top = hj(h);
        const ka = za === -Infinity ? 0 : clampI(this.k0(za), this.NZ);
        const kb = zb === Infinity ? this.NZ : clampI(this.k0(zb), this.NZ);
        for (let j = 0; j < top; j++) for (let k = ka; k < kb; k++) data[(j + 1) * sy + (k + 1) * sz + i] = HIDDEN;
      };
      const setWallZ = (k, h, xa = -Infinity, xb = Infinity) => {
        const top = hj(h);
        const ia = xa === -Infinity ? 0 : clampI(this.i0(xa), this.NX);
        const ib = xb === Infinity ? this.NX : clampI(this.i0(xb), this.NX);
        for (let j = 0; j < top; j++) for (let i = ia; i < ib; i++) data[(j + 1) * sy + k * sz + i + 1] = HIDDEN;
      };
      if (p.x0) setWallX(0, p.x0, p.x0z0, p.x0z1);
      if (p.x1) setWallX(nx - 1, p.x1, p.x1z0, p.x1z1);
      if (p.z0) setWallZ(0, p.z0, p.z0x0, p.z0x1);
      if (p.z1) setWallZ(nz - 1, p.z1, p.z1x0, p.z1x1);
    }
  }

  // Half-resolution copy for LOD. Solid if >= half the children are solid;
  // material voted by children, favouring children exposed to air.
  downsample() {
    const g = new VoxelGrid(this.ox, this.oy, this.oz,
      this.ox + this.NX * this.vs, this.oy + this.NY * this.vs, this.oz + this.NZ * this.vs, this.vs * 2);
    g.boundary = this.boundary;
    const src = this.data, dst = g.data;
    const { NX, NY, NZ, sy, sz } = this;
    const ids = new Uint16Array(8), wts = new Float32Array(8);
    for (let cj = 0; cj < g.NY; cj++) {
      for (let ck = 0; ck < g.NZ; ck++) {
        for (let ci = 0; ci < g.NX; ci++) {
          let exist = 0, solid = 0, n = 0;
          for (let b = 0; b < 2; b++) {
            const j = cj * 2 + b; if (j >= NY) continue;
            for (let c = 0; c < 2; c++) {
              const k = ck * 2 + c; if (k >= NZ) continue;
              for (let a = 0; a < 2; a++) {
                const i = ci * 2 + a; if (i >= NX) continue;
                exist++;
                const idx = (j + 1) * sy + (k + 1) * sz + (i + 1);
                const m = src[idx];
                if (m === AIR) continue;
                solid++;
                const exposed = src[idx + 1] === AIR || src[idx - 1] === AIR || src[idx + sz] === AIR ||
                  src[idx - sz] === AIR || src[idx + sy] === AIR || src[idx - sy] === AIR;
                const w = exposed ? 4 : 1;
                let found = -1;
                for (let q = 0; q < n; q++) if (ids[q] === m) { found = q; break; }
                if (found >= 0) wts[found] += w; else { ids[n] = m; wts[n] = w; n++; }
              }
            }
          }
          if (solid === 0 || solid * 2 < exist) continue;
          let best = 0;
          for (let q = 1; q < n; q++) if (wts[q] > wts[best]) best = q;
          dst[(cj + 1) * g.sy + (ck + 1) * g.sz + (ci + 1)] = ids[best];
        }
      }
    }
    return g;
  }

  // Mirror the grid along z (z -> -z); keeps voxel data consistent.
  flipZ() {
    const { nx, ny, nz, sy, sz, data } = this;
    const row = new Uint16Array(nx);
    for (let j = 0; j < ny; j++) {
      for (let k = 0; k < (nz >> 1); k++) {
        const a = j * sy + k * sz, b = j * sy + (nz - 1 - k) * sz;
        row.set(data.subarray(a, a + nx));
        data.copyWithin(a, b, b + nx);
        data.set(row, b);
      }
    }
    this.oz = -(this.oz + this.NZ * this.vs);
    const p = this.boundary.party;
    if (p) {
      const q = { ...p };
      q.z0 = p.z1; q.z0x0 = p.z1x0; q.z0x1 = p.z1x1;
      q.z1 = p.z0; q.z1x0 = p.z0x0; q.z1x1 = p.z0x1;
      if (p.x0z0 !== undefined) { q.x0z0 = -p.x0z1; q.x0z1 = -p.x0z0; }
      if (p.x1z0 !== undefined) { q.x1z0 = -p.x1z1; q.x1z1 = -p.x1z0; }
      this.boundary.party = q;
    }
  }

  countSolid() {
    let c = 0;
    const d = this.data;
    for (let i = 0; i < d.length; i++) if (d[i] > HIDDEN) c++;
    return c;
  }
}

function clampI(v, n) { return v < 0 ? 0 : v > n ? n : v; }

// Chunked voxel storage + a face-culling / greedy mesher with baked ambient occlusion.
//
// Design notes
//  * Voxels live in fixed 32^3 chunks of Uint8 material ids, allocated lazily, so an
//    empty world costs nothing and only touched regions are ever visited.
//  * Large building masses are written as *shells* and register an interior "occluder"
//    box. Occluders are stamped into the mesher's scratch buffer as solid-but-invisible,
//    which culls the inward-facing shell quads without ever allocating interior chunks.
//  * Meshing emits only exposed faces, merges coplanar runs greedily, and bakes
//    per-corner AO into vertex colours. Output is grouped by material group (one draw
//    pool each) and optionally by spatial sector so frustum culling has something to do.

import * as THREE from 'three';
import { M, EMPTY, HIDDEN, GROUPS } from './palette.js';

const CH = 32;
const CH2 = CH * CH;
const CH3 = CH2 * CH;
const PD = CH + 2;
const PD2 = PD * PD;
const PD3 = PD2 * PD;

const pidx = (x, y, z) => (x + 1) + (y + 1) * PD + (z + 1) * PD2;

export class VoxelWorld {
  constructor(voxelSize, name = 'world') {
    this.vs = voxelSize;
    this.name = name;
    this.chunks = new Map();
    this.occluders = [];
    this.voids = [];
    this.written = 0;
  }

  static key(cx, cy, cz) {
    return ((cx + 512) * 1024 + (cy + 512)) * 1024 + (cz + 512);
  }

  chunk(cx, cy, cz, create) {
    const k = VoxelWorld.key(cx, cy, cz);
    let c = this.chunks.get(k);
    if (!c && create) {
      c = { cx, cy, cz, data: new Uint8Array(CH3) };
      this.chunks.set(k, c);
    }
    return c;
  }

  set(x, y, z, m) {
    const c = this.chunk(x >> 5, y >> 5, z >> 5, true);
    c.data[(x & 31) + (y & 31) * CH + (z & 31) * CH2] = m;
    this.written++;
  }

  get(x, y, z) {
    const c = this.chunk(x >> 5, y >> 5, z >> 5, false);
    return c ? c.data[(x & 31) + (y & 31) * CH + (z & 31) * CH2] : 0;
  }

  // Inclusive integer voxel box.
  fill(x0, y0, z0, x1, y1, z1, m) {
    if (x1 < x0 || y1 < y0 || z1 < z0) return;
    for (let z = z0; z <= z1; z++) {
      for (let y = y0; y <= y1; y++) {
        const cy = y >> 5, cz = z >> 5, ly = (y & 31) * CH, lz = (z & 31) * CH2;
        let x = x0;
        while (x <= x1) {
          const cx = x >> 5;
          const xEnd = Math.min(x1, ((cx + 1) << 5) - 1);
          const c = this.chunk(cx, cy, cz, true);
          const base = ly + lz;
          for (let xi = x; xi <= xEnd; xi++) c.data[base + (xi & 31)] = m;
          this.written += xEnd - x + 1;
          x = xEnd + 1;
        }
      }
    }
  }

  addOccluder(x0, y0, z0, x1, y1, z1) {
    if (x1 < x0 || y1 < y0 || z1 < z0) return;
    this.occluders.push([x0, y0, z0, x1, y1, z1]);
  }

  addVoid(x0, y0, z0, x1, y1, z1) {
    if (x1 < x0 || y1 < y0 || z1 < z0) return;
    this.voids.push([x0, y0, z0, x1, y1, z1]);
  }

  stats() {
    return { chunks: this.chunks.size, written: this.written, occluders: this.occluders.length };
  }

  dispose() { this.chunks.clear(); this.occluders.length = 0; this.voids.length = 0; }
}

// ---------------------------------------------------------------------------
// Metre-space authoring wrapper. All scene code works in metres; boxes are
// half-open [a,b) so adjacent calls tile without seams or double-writes.
// ---------------------------------------------------------------------------
export class Builder {
  constructor(world) {
    this.w = world;
    this.vs = world.vs;
  }
  lo(v) { return Math.round(v / this.vs); }
  hi(v) { return Math.round(v / this.vs) - 1; }
  u(v) { return v * this.vs; }

  // Solid box, metres, half-open.
  box(x0, y0, z0, x1, y1, z1, m) {
    this.w.fill(this.lo(x0), this.lo(y0), this.lo(z0), this.hi(x1), this.hi(y1), this.hi(z1), m);
    return this;
  }

  // Carve to empty.
  carve(x0, y0, z0, x1, y1, z1) {
    this.w.fill(this.lo(x0), this.lo(y0), this.lo(z0), this.hi(x1), this.hi(y1), this.hi(z1), EMPTY);
    this.w.addVoid(this.lo(x0), this.lo(y0), this.lo(z0), this.hi(x1), this.hi(y1), this.hi(z1));
    return this;
  }

  // Hollow mass: shell of thickness t (metres) plus an interior occluder, so the
  // interior is treated as solid for face culling but never allocated or drawn.
  shell(x0, y0, z0, x1, y1, z1, m, t = 1.0, opts = {}) {
    const a = [this.lo(x0), this.lo(y0), this.lo(z0)];
    const b = [this.hi(x1), this.hi(y1), this.hi(z1)];
    if (b[0] < a[0] || b[1] < a[1] || b[2] < a[2]) return this;
    const tv = Math.max(1, Math.round(t / this.vs));
    const ia = [a[0] + tv, a[1] + (opts.openBottom ? 0 : tv), a[2] + tv];
    const ib = [b[0] - tv, b[1] - (opts.openTop ? 0 : tv), b[2] - tv];
    if (ia[0] > ib[0] || ia[1] > ib[1] || ia[2] > ib[2]) {
      this.w.fill(a[0], a[1], a[2], b[0], b[1], b[2], m);
      return this;
    }
    // six slabs
    this.w.fill(a[0], a[1], a[2], ia[0] - 1, b[1], b[2], m);
    this.w.fill(ib[0] + 1, a[1], a[2], b[0], b[1], b[2], m);
    this.w.fill(ia[0], a[1], a[2], ib[0], b[1], ia[2] - 1, m);
    this.w.fill(ia[0], a[1], ib[2] + 1, ib[0], b[1], b[2], m);
    if (!opts.openBottom) this.w.fill(ia[0], a[1], ia[2], ib[0], ia[1] - 1, ib[2], m);
    if (!opts.openTop) this.w.fill(ia[0], ib[1] + 1, ia[2], ib[0], b[1], ib[2], m);
    this.w.addOccluder(ia[0], ia[1], ia[2], ib[0], ib[1], ib[2]);
    return this;
  }

  // Vertical cylinder (metres), optionally hollow.
  cylY(cx, cz, r, y0, y1, m, wall = 0) {
    const vs = this.vs;
    const rv = r / vs, iv = wall > 0 ? (r - wall) / vs : -1;
    const cxv = cx / vs, czv = cz / vs;
    const x0 = Math.floor(cxv - rv), x1 = Math.ceil(cxv + rv);
    const z0 = Math.floor(czv - rv), z1 = Math.ceil(czv + rv);
    const yy0 = this.lo(y0), yy1 = this.hi(y1);
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cxv, dz = z + 0.5 - czv;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > rv) continue;
        if (iv > 0 && d < iv) continue;
        this.w.fill(x, yy0, z, x, yy1, z, m);
      }
    }
    return this;
  }

  // Regular n-gon prism, flat-topped orientation controlled by rot (radians).
  polyPrism(cx, cz, r, sides, rot, y0, y1, m, taperTop = null) {
    const yy0 = this.lo(y0), yy1 = this.hi(y1);
    const vs = this.vs;
    const inside = (px, pz, rad) => {
      for (let s = 0; s < sides; s++) {
        const a = rot + (s + 0.5) * Math.PI * 2 / sides;
        if (px * Math.cos(a) + pz * Math.sin(a) > rad * Math.cos(Math.PI / sides)) return false;
      }
      return true;
    };
    for (let y = yy0; y <= yy1; y++) {
      const t = yy1 > yy0 ? (y - yy0) / (yy1 - yy0) : 0;
      const rad = (taperTop === null ? r : r + (taperTop - r) * t) / vs;
      const x0 = Math.floor(cx / vs - rad) - 1, x1 = Math.ceil(cx / vs + rad) + 1;
      const z0 = Math.floor(cz / vs - rad) - 1, z1 = Math.ceil(cz / vs + rad) + 1;
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (inside(x + 0.5 - cx / vs, z + 0.5 - cz / vs, rad)) this.w.set(x, y, z, m);
        }
      }
    }
    return this;
  }

  ellipsoid(cx, cy, cz, rx, ry, rz, m, shellOnly = 0) {
    const vs = this.vs;
    const x0 = Math.floor((cx - rx) / vs), x1 = Math.ceil((cx + rx) / vs);
    const y0 = Math.floor((cy - ry) / vs), y1 = Math.ceil((cy + ry) / vs);
    const z0 = Math.floor((cz - rz) / vs), z1 = Math.ceil((cz + rz) / vs);
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = ((x + 0.5) * vs - cx) / rx, dy = ((y + 0.5) * vs - cy) / ry, dz = ((z + 0.5) * vs - cz) / rz;
      const d = dx * dx + dy * dy + dz * dz;
      if (d > 1) continue;
      if (shellOnly > 0 && d < (1 - shellOnly) * (1 - shellOnly)) continue;
      this.w.set(x, y, z, m);
    }
    return this;
  }

  // Gable roof whose ridge runs along X. Slopes fall in +/-Z.
  gableX(x0, z0, x1, z1, yEave, yRidge, m, thick = 0.5, capMat = null) {
    const vs = this.vs;
    const fn = typeof m === 'function';
    const zc = (z0 + z1) / 2, half = (z1 - z0) / 2;
    const zi0 = this.lo(z0), zi1 = this.hi(z1);
    const xi0 = this.lo(x0), xi1 = this.hi(x1);
    const tv = Math.max(1, Math.round(thick / vs));
    for (let z = zi0; z <= zi1; z++) {
      const dz = Math.abs((z + 0.5) * vs - zc);
      const h = yEave + (yRidge - yEave) * Math.max(0, 1 - dz / half);
      const top = this.hi(h);
      const bot = Math.max(this.lo(yEave) - 1, top - tv + 1);
      if (fn) {
        for (let x = xi0; x <= xi1; x++) this.w.fill(x, bot, z, x, top, z, m((x + 0.5) * vs, (z + 0.5) * vs, top * vs));
      } else {
        this.w.fill(xi0, bot, z, xi1, top, z, m);
      }
      if (capMat !== null && dz < vs) this.w.fill(xi0, top, z, xi1, top, z, capMat);
    }
    return this;
  }

  // Gable roof whose ridge runs along Z. Slopes fall in +/-X.
  gableZ(x0, z0, x1, z1, yEave, yRidge, m, thick = 0.5, capMat = null) {
    const vs = this.vs;
    const fn = typeof m === 'function';
    const xc = (x0 + x1) / 2, half = (x1 - x0) / 2;
    const zi0 = this.lo(z0), zi1 = this.hi(z1);
    const xi0 = this.lo(x0), xi1 = this.hi(x1);
    const tv = Math.max(1, Math.round(thick / vs));
    for (let x = xi0; x <= xi1; x++) {
      const dx = Math.abs((x + 0.5) * vs - xc);
      const h = yEave + (yRidge - yEave) * Math.max(0, 1 - dx / half);
      const top = this.hi(h);
      const bot = Math.max(this.lo(yEave) - 1, top - tv + 1);
      if (fn) {
        for (let z = zi0; z <= zi1; z++) this.w.fill(x, bot, z, x, top, z, m((x + 0.5) * vs, (z + 0.5) * vs, top * vs));
      } else {
        this.w.fill(x, bot, zi0, x, top, zi1, m);
      }
      if (capMat !== null && dx < vs) this.w.fill(x, top, zi0, x, top, zi1, capMat);
    }
    return this;
  }

  // Hipped roof: slopes on all four sides at a constant pitch.
  hipRoof(x0, z0, x1, z1, yEave, yPeak, m, thick = 0.6) {
    const vs = this.vs;
    const xc = (x0 + x1) / 2, zc = (z0 + z1) / 2;
    const hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
    const halfMin = Math.min(hx, hz);
    const xi0 = this.lo(x0), xi1 = this.hi(x1), zi0 = this.lo(z0), zi1 = this.hi(z1);
    const tv = Math.max(1, Math.round(thick / vs));
    for (let z = zi0; z <= zi1; z++) {
      for (let x = xi0; x <= xi1; x++) {
        const dx = Math.abs((x + 0.5) * vs - xc), dz = Math.abs((z + 0.5) * vs - zc);
        const inset = Math.min(hx - dx, hz - dz);
        const h = yEave + (yPeak - yEave) * Math.min(1, Math.max(0, inset / halfMin));
        const top = this.hi(h);
        const bot = Math.max(this.lo(yEave) - 1, top - tv + 1);
        this.w.fill(x, bot, z, x, top, z, typeof m === 'function' ? m((x + 0.5) * vs, (z + 0.5) * vs, top * vs) : m);
      }
    }
    return this;
  }

  // Mansard: steep lower skirt then a shallow deck.
  mansard(x0, z0, x1, z1, yEave, yBreak, yTop, inset, m, deckMat = null) {
    const vs = this.vs;
    const xi0 = this.lo(x0), xi1 = this.hi(x1), zi0 = this.lo(z0), zi1 = this.hi(z1);
    const xc = (x0 + x1) / 2, zc = (z0 + z1) / 2;
    const hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
    for (let z = zi0; z <= zi1; z++) {
      for (let x = xi0; x <= xi1; x++) {
        const dx = Math.abs((x + 0.5) * vs - xc), dz = Math.abs((z + 0.5) * vs - zc);
        const edge = Math.min(hx - dx, hz - dz);
        if (edge < inset) {
          const t = edge / inset;
          const top = this.hi(yEave + (yBreak - yEave) * t);
          this.w.fill(x, this.lo(yEave) - 1, z, x, top, z, m);
        } else {
          const rem = Math.min(hx, hz) - inset;
          const t = rem > 0 ? Math.min(1, (edge - inset) / rem) : 1;
          const top = this.hi(yBreak + (yTop - yBreak) * t);
          this.w.fill(x, top - Math.max(1, Math.round(0.6 / vs)) + 1, z, x, top, z, deckMat === null ? m : deckMat);
        }
      }
    }
    return this;
  }

  pyramid(x0, z0, x1, z1, y0, y1, m, hollow = false) {
    const vs = this.vs;
    const xc = (x0 + x1) / 2, zc = (z0 + z1) / 2;
    const hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
    const yy0 = this.lo(y0), yy1 = this.hi(y1);
    for (let y = yy0; y <= yy1; y++) {
      const t = yy1 > yy0 ? (y - yy0) / (yy1 - yy0 + 1) : 0;
      const rx = hx * (1 - t), rz = hz * (1 - t);
      const a = this.lo(xc - rx), b = this.hi(xc + rx);
      const c = this.lo(zc - rz), d = this.hi(zc + rz);
      if (hollow && b - a > 2 && d - c > 2) {
        this.w.fill(a, y, c, b, y, c, m); this.w.fill(a, y, d, b, y, d, m);
        this.w.fill(a, y, c, a, y, d, m); this.w.fill(b, y, c, b, y, d, m);
      } else {
        this.w.fill(a, y, c, b, y, d, m);
      }
    }
    return this;
  }

  // Octagonal spire (the church tower cap).
  octSpire(cx, cz, r, y0, y1, m, rTop = 0.0, hollow = true) {
    const vs = this.vs;
    const yy0 = this.lo(y0), yy1 = this.hi(y1);
    const c = Math.cos(Math.PI / 8);
    for (let y = yy0; y <= yy1; y++) {
      const t = yy1 > yy0 ? (y - yy0) / (yy1 - yy0) : 0;
      const rad = (r + (rTop - r) * t) / vs;
      if (rad < 0.4) { this.w.set(Math.round(cx / vs), y, Math.round(cz / vs), m); continue; }
      const x0 = Math.floor(cx / vs - rad) - 1, x1 = Math.ceil(cx / vs + rad) + 1;
      const z0 = Math.floor(cz / vs - rad) - 1, z1 = Math.ceil(cz / vs + rad) + 1;
      const inner = rad - Math.max(1.0, 0.35 / vs);
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5 - cx / vs, pz = z + 0.5 - cz / vs;
          let inOuter = true, inInner = true;
          for (let s = 0; s < 8; s++) {
            const a = (s + 0.5) * Math.PI / 4;
            const p = px * Math.cos(a) + pz * Math.sin(a);
            if (p > rad * c) inOuter = false;
            if (p > inner * c) inInner = false;
          }
          if (!inOuter) continue;
          if (hollow && inInner && rad > 2.5) continue;
          this.w.set(x, y, z, m);
        }
      }
    }
    return this;
  }

  // A pointed (lancet) arch opening cut through a wall plane.
  // axis: 'x' -> wall lies in the YZ plane at x in [x0,x1]; opening spans z.
  lancet(axis, a0, a1, u0, u1, yBase, ySpring, yApex, fn) {
    const vs = this.vs;
    const uc = (u0 + u1) / 2, hw = (u1 - u0) / 2;
    const iu0 = this.lo(u0), iu1 = this.hi(u1);
    for (let iu = iu0; iu <= iu1; iu++) {
      const du = Math.abs((iu + 0.5) * vs - uc);
      let top = ySpring;
      if (du <= hw) {
        // two-centred pointed arch
        const k = du / hw;
        top = ySpring + (yApex - ySpring) * Math.sqrt(Math.max(0, 1 - k * k * k * 1.0)) * (1 - k * 0.15);
      }
      fn(iu, this.lo(yBase), this.hi(top));
    }
    return this;
  }

  // Convenience: place a single voxel at metre coords.
  put(x, y, z, m) { this.w.set(Math.floor(x / this.vs), Math.floor(y / this.vs), Math.floor(z / this.vs), m); }
}

// ---------------------------------------------------------------------------
// Mesher
// ---------------------------------------------------------------------------

const AO_LEVELS = [0.44, 0.63, 0.82, 1.0];

// sRGB -> linear, matching three.js colour management for vertex colours.
const SRGB = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

class Accum {
  constructor() {
    this.cap = 4096;
    this.n = 0;
    this.pos = new Float32Array(this.cap * 3);
    this.nrm = new Int8Array(this.cap * 3);
    this.col = new Uint8Array(this.cap * 3);
    this.uv = new Float32Array(this.cap * 2);
    this.idx = [];
  }
  grow() {
    this.cap *= 2;
    const p = new Float32Array(this.cap * 3); p.set(this.pos); this.pos = p;
    const nn = new Int8Array(this.cap * 3); nn.set(this.nrm); this.nrm = nn;
    const c = new Uint8Array(this.cap * 3); c.set(this.col); this.col = c;
    const u = new Float32Array(this.cap * 2); u.set(this.uv); this.uv = u;
  }
  vert(px, py, pz, nx, ny, nz, r, g, b, uu, vv) {
    if (this.n >= this.cap) this.grow();
    const i3 = this.n * 3, i2 = this.n * 2;
    this.pos[i3] = px; this.pos[i3 + 1] = py; this.pos[i3 + 2] = pz;
    this.nrm[i3] = nx; this.nrm[i3 + 1] = ny; this.nrm[i3 + 2] = nz;
    this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b;
    this.uv[i2] = uu; this.uv[i2 + 1] = vv;
    return this.n++;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.subarray(0, this.n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm.subarray(0, this.n * 3), 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(this.col.subarray(0, this.n * 3), 3, true));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.subarray(0, this.n * 2), 2));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// Per-direction axis tables: [normal, uAxis, vAxis] as component indices/signs.
const DIRS = [
  { n: [1, 0, 0], u: 2, v: 1, a: 0, s: 1 },   // +X : plane at x+1, u=z, v=y
  { n: [-1, 0, 0], u: 2, v: 1, a: 0, s: 0 },  // -X
  { n: [0, 1, 0], u: 0, v: 2, a: 1, s: 1 },   // +Y : u=x, v=z
  { n: [0, -1, 0], u: 0, v: 2, a: 1, s: 0 },  // -Y
  { n: [0, 0, 1], u: 0, v: 1, a: 2, s: 1 },   // +Z : u=x, v=y
  { n: [0, 0, -1], u: 0, v: 1, a: 2, s: 0 },  // -Z
];
for (const d of DIRS) {
  const U = [0, 0, 0], V = [0, 0, 0];
  U[d.u] = 1; V[d.v] = 1;
  const cr = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]];
  d.flip = (cr[0] * d.n[0] + cr[1] * d.n[1] + cr[2] * d.n[2]) < 0;
  d.U = U; d.V = V;
}

const scratchMask = [];
const scratchUsed = [];
for (let i = 0; i < 6; i++) { scratchMask.push(new Int32Array(CH3)); scratchUsed.push(new Uint8Array(CH)); }
const padBuf = new Uint8Array(PD3);
const rowTmp = new Uint8Array(CH);

function fillPad(world, ck) {
  padBuf.fill(0);
  const bx = ck.cx * CH, by = ck.cy * CH, bz = ck.cz * CH;
  // interior: contiguous rows along x
  for (let z = 0; z < CH; z++) {
    for (let y = 0; y < CH; y++) {
      const src = ck.data.subarray(y * CH + z * CH2, y * CH + z * CH2 + CH);
      padBuf.set(src, pidx(0, y, z));
    }
  }
  // the 1-voxel skin: sample the world (cheap - only 6 faces + edges + corners)
  for (let z = -1; z <= CH; z++) {
    for (let y = -1; y <= CH; y++) {
      const edge = (z === -1 || z === CH || y === -1 || y === CH);
      if (edge) {
        for (let x = -1; x <= CH; x++) padBuf[pidx(x, y, z)] = world.get(bx + x, by + y, bz + z);
      } else {
        padBuf[pidx(-1, y, z)] = world.get(bx - 1, by + y, bz + z);
        padBuf[pidx(CH, y, z)] = world.get(bx + CH, by + y, bz + z);
      }
    }
  }
  // occluders: solid but invisible, stamped only into empty cells
  const ax0 = bx - 1, ay0 = by - 1, az0 = bz - 1, ax1 = bx + CH, ay1 = by + CH, az1 = bz + CH;
  for (const o of world.occluders) {
    if (o[3] < ax0 || o[0] > ax1 || o[4] < ay0 || o[1] > ay1 || o[5] < az0 || o[2] > az1) continue;
    const x0 = Math.max(o[0], ax0) - bx, x1 = Math.min(o[3], ax1) - bx;
    const y0 = Math.max(o[1], ay0) - by, y1 = Math.min(o[4], ay1) - by;
    const z0 = Math.max(o[2], az0) - bz, z1 = Math.min(o[5], az1) - bz;
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) {
      const base = pidx(0, y, z);
      for (let x = x0; x <= x1; x++) if (padBuf[base + x] === 0) padBuf[base + x] = HIDDEN;
    }
  }
  for (const o of world.voids) {
    if (o[3] < ax0 || o[0] > ax1 || o[4] < ay0 || o[1] > ay1 || o[5] < az0 || o[2] > az1) continue;
    const x0 = Math.max(o[0], ax0) - bx, x1 = Math.min(o[3], ax1) - bx;
    const y0 = Math.max(o[1], ay0) - by, y1 = Math.min(o[4], ay1) - by;
    const z0 = Math.max(o[2], az0) - bz, z1 = Math.min(o[5], az1) - bz;
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) {
      const base = pidx(0, y, z);
      for (let x = x0; x <= x1; x++) if (padBuf[base + x] === HIDDEN) padBuf[base + x] = 0;
    }
  }
}

const OP = M.opaque;

function aoAt(p, n0, du, dv) {
  const s1 = OP[padBuf[n0 + du]] ? 1 : 0;
  const s2 = OP[padBuf[n0 + dv]] ? 1 : 0;
  if (s1 && s2) return 0;
  const cr = OP[padBuf[n0 + du + dv]] ? 1 : 0;
  return 3 - (s1 + s2 + cr);
}

/**
 * Mesh a world into { sectorKey -> { groupIndex -> BufferGeometry } }.
 * sectorSize is in metres; 0 disables spatial splitting.
 */
export function meshWorld(world, sectorSize = 0) {
  const out = new Map();
  const vs = world.vs;
  const strideX = 1, strideY = PD, strideZ = PD2;
  const strides = [strideX, strideY, strideZ];

  const getAcc = (sx, sz, grp) => {
    const key = sx + '|' + sz;
    let sec = out.get(key);
    if (!sec) { sec = { sx, sz, groups: new Map() }; out.set(key, sec); }
    let a = sec.groups.get(grp);
    if (!a) { a = new Accum(); sec.groups.set(grp, a); }
    return a;
  };

  for (const ck of world.chunks.values()) {
    fillPad(world, ck);
    const bx = ck.cx * CH, by = ck.cy * CH, bz = ck.cz * CH;

    for (let d = 0; d < 6; d++) { scratchUsed[d].fill(0); }

    // Pass 1: classify exposed faces into per-direction slice masks.
    for (let z = 0; z < CH; z++) {
      for (let y = 0; y < CH; y++) {
        const rowBase = pidx(0, y, z);
        for (let x = 0; x < CH; x++) {
          const m = padBuf[rowBase + x];
          if (m === 0 || m === HIDDEN) continue;
          const p = rowBase + x;
          for (let d = 0; d < 6; d++) {
            const dd = DIRS[d];
            const step = (dd.s ? 1 : -1) * strides[dd.a];
            const nm = padBuf[p + step];
            if (OP[nm] || nm === m) continue;
            const n0 = p + step;
            const su = strides[dd.u], sv = strides[dd.v];
            const a0 = aoAt(p, n0, -su, -sv);
            const a1 = aoAt(p, n0, su, -sv);
            const a2 = aoAt(p, n0, su, sv);
            const a3 = aoAt(p, n0, -su, sv);
            const coord = [x, y, z];
            const s = coord[dd.a], iu = coord[dd.u], iv = coord[dd.v];
            scratchMask[d][s * CH2 + iv * CH + iu] = m | (a0 << 8) | (a1 << 10) | (a2 << 12) | (a3 << 14);
            scratchUsed[d][s] = 1;
          }
        }
      }
    }

    // Pass 2: greedy-merge each populated slice and emit quads.
    for (let d = 0; d < 6; d++) {
      const dd = DIRS[d];
      const mask = scratchMask[d];
      const nx = dd.n[0], ny = dd.n[1], nz = dd.n[2];
      for (let s = 0; s < CH; s++) {
        if (!scratchUsed[d][s]) continue;
        const base = s * CH2;
        for (let jv = 0; jv < CH; jv++) {
          for (let iu = 0; iu < CH;) {
            const code = mask[base + jv * CH + iu];
            if (code === 0) { iu++; continue; }
            let w = 1;
            while (iu + w < CH && mask[base + jv * CH + iu + w] === code) w++;
            let h = 1;
            outer: while (jv + h < CH) {
              for (let k = 0; k < w; k++) {
                if (mask[base + (jv + h) * CH + iu + k] !== code) break outer;
              }
              h++;
            }
            for (let b = 0; b < h; b++) for (let k = 0; k < w; k++) mask[base + (jv + b) * CH + iu + k] = 0;

            const mat = code & 255;
            const ao = [(code >> 8) & 3, (code >> 10) & 3, (code >> 12) & 3, (code >> 14) & 3];

            // world voxel-space origin of the quad
            const org = [0, 0, 0];
            org[dd.a] = s + (dd.s ? 1 : 0);
            org[dd.u] = iu;
            org[dd.v] = jv;
            org[0] += bx; org[1] += by; org[2] += bz;

            const grp = M.group[mat];
            const cx = (org[0] + (dd.a === 0 ? 0 : w * dd.U[0] + h * dd.V[0]) * 0.5) * vs;
            const sxk = sectorSize > 0 ? Math.floor(((org[0] + 0.5) * vs) / sectorSize) : 0;
            const szk = sectorSize > 0 ? Math.floor(((org[2] + 0.5) * vs) / sectorSize) : 0;
            const acc = getAcc(sxk, szk, grp);

            const cr = SRGB[M.r[mat]], cg = SRGB[M.g[mat]], cb = SRGB[M.b[mat]];
            const U = dd.U, V = dd.V;
            const verts = [];
            for (let c = 0; c < 4; c++) {
              const uu = (c === 1 || c === 2) ? w : 0;
              const vvv = (c === 2 || c === 3) ? h : 0;
              const px = (org[0] + U[0] * uu + V[0] * vvv) * vs;
              const py = (org[1] + U[1] * uu + V[1] * vvv) * vs;
              const pz = (org[2] + U[2] * uu + V[2] * vvv) * vs;
              const f = AO_LEVELS[ao[c]];
              const tu = (dd.u === 0 ? px : dd.u === 1 ? py : pz);
              const tv2 = (dd.v === 0 ? px : dd.v === 1 ? py : pz);
              verts.push(acc.vert(px, py, pz, nx * 127, ny * 127, nz * 127,
                Math.min(255, (cr * f * 255) | 0), Math.min(255, (cg * f * 255) | 0), Math.min(255, (cb * f * 255) | 0),
                tu, tv2));
            }
            const flipDiag = (ao[0] + ao[2]) < (ao[1] + ao[3]);
            let tri;
            if (!flipDiag) tri = [verts[0], verts[1], verts[2], verts[0], verts[2], verts[3]];
            else tri = [verts[1], verts[2], verts[3], verts[1], verts[3], verts[0]];
            if (dd.flip) { tri = [tri[2], tri[1], tri[0], tri[5], tri[4], tri[3]]; }
            acc.idx.push(tri[0], tri[1], tri[2], tri[3], tri[4], tri[5]);
            iu += w;
          }
        }
      }
    }
  }

  const result = [];
  for (const sec of out.values()) {
    for (const [grp, acc] of sec.groups) {
      if (acc.n === 0) continue;
      result.push({ sx: sec.sx, sz: sec.sz, group: GROUPS[grp], geometry: acc.geometry() });
    }
  }
  return result;
}

/** Merge a Builder-authored world into a standalone geometry (used for instanced props). */
export function bakeGeometry(world) {
  const parts = meshWorld(world, 0);
  return parts; // [{group, geometry}]
}

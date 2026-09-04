// Voxel grid, shape rasterizer, greedy mesher with baked ambient occlusion,
// and a geometry sink that merges quads into per-material buffers.
import * as THREE from 'three';

export const GROUND_ID = 65535; // virtual solid below y=0 (culls bottom faces, darkens contact AO)

const TRANSPARENT_CLASSES = new Set(['glass', 'glassLit', 'water', 'glassDark']);

export class Palette {
  constructor() {
    this.entries = [null];
    this.map = new Map();
    this.color = new THREE.Color();
  }
  /** Register (or fetch) a material id for a colour + surface class. */
  get(hex, cls = 'wall') {
    const key = hex + '|' + cls;
    let id = this.map.get(key);
    if (id !== undefined) return id;
    id = this.entries.length;
    if (id >= 65000) throw new Error('Palette overflow');
    this.color.set(hex);
    this.entries.push({
      id,
      cls,
      r: this.color.r,
      g: this.color.g,
      b: this.color.b,
      transparent: TRANSPARENT_CLASSES.has(cls),
    });
    this.map.set(key, id);
    return id;
  }
  isTransparent(id) {
    if (id === 0 || id === GROUND_ID) return false;
    return this.entries[id].transparent;
  }
}

export class Grid {
  constructor(nx, ny, nz, size, origin) {
    this.nx = nx;
    this.ny = ny;
    this.nz = nz;
    this.s = size;
    this.o = origin; // [x, y, z] of the min corner in model metres
    this.data = new Uint16Array(nx * ny * nz);
    this.solidBelow = true;
    this.count = 0;
  }
  get(x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= this.nx || y >= this.ny || z >= this.nz) {
      return y < 0 && this.solidBelow ? GROUND_ID : 0;
    }
    return this.data[(x * this.ny + y) * this.nz + z];
  }
  set(x, y, z, v) {
    if (x < 0 || y < 0 || z < 0 || x >= this.nx || y >= this.ny || z >= this.nz) return;
    this.data[(x * this.ny + y) * this.nz + z] = v;
  }
}

/**
 * A Model is a set of grids sharing one model-space coordinate frame.
 * Shapes are given in metres; they are rasterised into every grid they touch.
 */
export class Model {
  constructor(palette) {
    this.palette = palette;
    this.grids = [];
  }
  addGrid(min, max, size) {
    const nx = Math.max(1, Math.round((max[0] - min[0]) / size));
    const ny = Math.max(1, Math.round((max[1] - min[1]) / size));
    const nz = Math.max(1, Math.round((max[2] - min[2]) / size));
    const g = new Grid(nx, ny, nz, size, [min[0], min[1], min[2]]);
    this.grids.push(g);
    return g;
  }
  /** Fill an axis-aligned box [x0,x1)x[y0,y1)x[z0,z1) in metres. */
  box(x0, y0, z0, x1, y1, z1, mat) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    for (const g of this.grids) {
      const s = g.s;
      const ix0 = Math.max(0, Math.round((x0 - g.o[0]) / s));
      const ix1 = Math.min(g.nx, Math.round((x1 - g.o[0]) / s));
      const iy0 = Math.max(0, Math.round((y0 - g.o[1]) / s));
      const iy1 = Math.min(g.ny, Math.round((y1 - g.o[1]) / s));
      const iz0 = Math.max(0, Math.round((z0 - g.o[2]) / s));
      const iz1 = Math.min(g.nz, Math.round((z1 - g.o[2]) / s));
      if (ix0 >= ix1 || iy0 >= iy1 || iz0 >= iz1) continue;
      const d = g.data;
      const ny = g.ny;
      const nz = g.nz;
      for (let x = ix0; x < ix1; x++) {
        for (let y = iy0; y < iy1; y++) {
          const base = (x * ny + y) * nz;
          d.fill(mat, base + iz0, base + iz1);
        }
      }
    }
  }
  /** Fill cells inside the bbox whose centres satisfy fn(cx, cy, cz). */
  shape(x0, y0, z0, x1, y1, z1, fn, mat) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    for (const g of this.grids) {
      const s = g.s;
      const ix0 = Math.max(0, Math.floor((x0 - g.o[0]) / s));
      const ix1 = Math.min(g.nx, Math.ceil((x1 - g.o[0]) / s));
      const iy0 = Math.max(0, Math.floor((y0 - g.o[1]) / s));
      const iy1 = Math.min(g.ny, Math.ceil((y1 - g.o[1]) / s));
      const iz0 = Math.max(0, Math.floor((z0 - g.o[2]) / s));
      const iz1 = Math.min(g.nz, Math.ceil((z1 - g.o[2]) / s));
      if (ix0 >= ix1 || iy0 >= iy1 || iz0 >= iz1) continue;
      const d = g.data;
      const ny = g.ny;
      const nz = g.nz;
      for (let x = ix0; x < ix1; x++) {
        const cx = g.o[0] + (x + 0.5) * s;
        for (let y = iy0; y < iy1; y++) {
          const cy = g.o[1] + (y + 0.5) * s;
          const base = (x * ny + y) * nz;
          for (let z = iz0; z < iz1; z++) {
            const cz = g.o[2] + (z + 0.5) * s;
            if (fn(cx, cy, cz)) d[base + z] = mat;
          }
        }
      }
    }
  }
  /** Like shape() but fn returns a material id (0 = leave untouched). */
  paint(x0, y0, z0, x1, y1, z1, fn) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    for (const g of this.grids) {
      const s = g.s;
      const ix0 = Math.max(0, Math.floor((x0 - g.o[0]) / s));
      const ix1 = Math.min(g.nx, Math.ceil((x1 - g.o[0]) / s));
      const iy0 = Math.max(0, Math.floor((y0 - g.o[1]) / s));
      const iy1 = Math.min(g.ny, Math.ceil((y1 - g.o[1]) / s));
      const iz0 = Math.max(0, Math.floor((z0 - g.o[2]) / s));
      const iz1 = Math.min(g.nz, Math.ceil((z1 - g.o[2]) / s));
      if (ix0 >= ix1 || iy0 >= iy1 || iz0 >= iz1) continue;
      const d = g.data;
      const ny = g.ny;
      const nz = g.nz;
      for (let x = ix0; x < ix1; x++) {
        const cx = g.o[0] + (x + 0.5) * s;
        for (let y = iy0; y < iy1; y++) {
          const cy = g.o[1] + (y + 0.5) * s;
          const base = (x * ny + y) * nz;
          for (let z = iz0; z < iz1; z++) {
            const cz = g.o[2] + (z + 0.5) * s;
            const m = fn(cx, cy, cz, d[base + z]);
            if (m) d[base + z] = m;
          }
        }
      }
    }
  }
  carve(x0, y0, z0, x1, y1, z1) {
    this.box(x0, y0, z0, x1, y1, z1, 0);
  }
  /** Vertical cylinder (elliptical) between y0..y1. */
  cylinder(cx, cz, rx, rz, y0, y1, mat) {
    this.shape(cx - rx, y0, cz - rz, cx + rx, y1, cz + rz, (x, y, z) => {
      const dx = (x - cx) / rx;
      const dz = (z - cz) / rz;
      return dx * dx + dz * dz <= 1;
    }, mat);
  }
  /** Sphere/ellipsoid. */
  ellipsoid(cx, cy, cz, rx, ry, rz, mat, fn) {
    this.shape(cx - rx, cy - ry, cz - rz, cx + rx, cy + ry, cz + rz, (x, y, z) => {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const dz = (z - cz) / rz;
      const d = dx * dx + dy * dy + dz * dz;
      return d <= 1 && (!fn || fn(x, y, z, d));
    }, mat);
  }
  /** Cone / pyramid frustum: radius r0 at y0 shrinking to r1 at y1; sides = 0 for round, N for polygon. */
  cone(cx, cz, r0, r1, y0, y1, mat, sides = 0, rot = 0) {
    const R = Math.max(r0, r1);
    this.shape(cx - R, y0, cz - R, cx + R, y1, cz + R, (x, y, z) => {
      const t = (y - y0) / Math.max(1e-6, y1 - y0);
      const r = r0 + (r1 - r0) * t;
      const dx = x - cx;
      const dz = z - cz;
      if (sides === 0) return dx * dx + dz * dz <= r * r;
      // polygon: inscribed radius r
      let ang = Math.atan2(dz, dx) - rot;
      const sector = (Math.PI * 2) / sides;
      ang = ((ang % sector) + sector) % sector;
      const dist = Math.hypot(dx, dz) * Math.cos(ang - sector / 2);
      return dist <= r;
    }, mat);
  }
  /**
   * Thick line of voxels between two points (used for branches, poles).
   */
  line(ax, ay, az, bx, by, bz, radius, mat) {
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    const minX = Math.min(ax, bx) - radius, maxX = Math.max(ax, bx) + radius;
    const minY = Math.min(ay, by) - radius, maxY = Math.max(ay, by) + radius;
    const minZ = Math.min(az, bz) - radius, maxZ = Math.max(az, bz) + radius;
    const dx = (bx - ax) / (len || 1), dy = (by - ay) / (len || 1), dz = (bz - az) / (len || 1);
    this.shape(minX, minY, minZ, maxX, maxY, maxZ, (x, y, z) => {
      const px = x - ax, py = y - ay, pz = z - az;
      let t = px * dx + py * dy + pz * dz;
      t = Math.max(0, Math.min(len, t));
      const qx = px - dx * t, qy = py - dy * t, qz = pz - dz * t;
      return qx * qx + qy * qy + qz * qz <= radius * radius;
    }, mat);
  }
}

const AO_FACTOR = [0.42, 0.62, 0.82, 1.0];

/**
 * Greedy-mesh one grid. Calls emit(d, sign, i, j, plane, w, h, mat, ao) in cell units.
 */
function meshGrid(grid, palette, emit) {
  const dims = [grid.nx, grid.ny, grid.nz];
  const x = [0, 0, 0];
  const q = [0, 0, 0];
  const f = [0, 0, 0];
  const maxDim = Math.max(dims[0], dims[1], dims[2]);
  const mask = new Int32Array(maxDim * maxDim);
  const isTrans = (id) => palette.isTransparent(id);
  const occ = (id) => id !== 0 && !isTrans(id);

  const occAt = (fx, fy, fz, axisA, da, axisB, db) => {
    let x = fx, y = fy, z = fz;
    if (axisA === 0) x += da; else if (axisA === 1) y += da; else z += da;
    if (axisB >= 0) { if (axisB === 0) x += db; else if (axisB === 1) y += db; else z += db; }
    return occ(grid.get(x, y, z)) ? 1 : 0;
  };
  const aoAt = (px, py, pz, nd, sign, u, v) => {
    f[0] = px; f[1] = py; f[2] = pz;
    f[nd] += sign;
    const fx = f[0], fy = f[1], fz = f[2];
    let ao = 0;
    let shift = 0;
    for (let c = 0; c < 4; c++) {
      const su = c === 0 || c === 3 ? -1 : 1;
      const sv = c < 2 ? -1 : 1;
      const s1 = occAt(fx, fy, fz, u, su, -1, 0);
      const s2 = occAt(fx, fy, fz, v, sv, -1, 0);
      let val;
      if (s1 && s2) val = 0;
      else val = 3 - (s1 + s2 + occAt(fx, fy, fz, u, su, v, sv));
      ao |= val << shift;
      shift += 2;
    }
    return ao;
  };

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    q[0] = q[1] = q[2] = 0;
    q[d] = 1;
    const nu = dims[u];
    const nv = dims[v];
    for (x[d] = -1; x[d] < dims[d]; x[d]++) {
      let n = 0;
      for (x[v] = 0; x[v] < nv; x[v]++) {
        for (x[u] = 0; x[u] < nu; x[u]++) {
          const a = grid.get(x[0], x[1], x[2]);
          const b = grid.get(x[0] + q[0], x[1] + q[1], x[2] + q[2]);
          let entry = 0;
          if (a !== b) {
            if (a !== 0 && a !== GROUND_ID && (b === 0 || (isTrans(b) && !isTrans(a)))) {
              const ao = aoAt(x[0], x[1], x[2], d, 1, u, v);
              entry = a | (1 << 16) | (ao << 17);
            } else if (b !== 0 && b !== GROUND_ID && (a === 0 || (isTrans(a) && !isTrans(b)))) {
              const ao = aoAt(x[0] + q[0], x[1] + q[1], x[2] + q[2], d, -1, u, v);
              entry = b | (0 << 16) | (ao << 17);
            }
          }
          mask[n++] = entry;
        }
      }
      n = 0;
      for (let j = 0; j < nv; j++) {
        for (let i = 0; i < nu; ) {
          const c = mask[n];
          if (c !== 0) {
            let w = 1;
            while (i + w < nu && mask[n + w] === c) w++;
            let h = 1;
            let done = false;
            for (; j + h < nv && !done; ) {
              for (let k = 0; k < w; k++) {
                if (mask[n + k + h * nu] !== c) { done = true; break; }
              }
              if (!done) h++;
            }
            const mat = c & 0xffff;
            const sign = (c >> 16) & 1 ? 1 : -1;
            const ao = (c >>> 17) & 0xff;
            emit(d, sign, i, j, x[d] + 1, w, h, mat, ao);
            for (let l = 0; l < h; l++) {
              const row = n + l * nu;
              for (let k = 0; k < w; k++) mask[row + k] = 0;
            }
            i += w;
            n += w;
          } else {
            i++;
            n++;
          }
        }
      }
    }
  }
}

class F32 {
  constructor(cap = 1 << 16) {
    this.a = new Float32Array(cap);
    this.n = 0;
  }
  ensure(k) {
    if (this.n + k > this.a.length) {
      let cap = this.a.length * 2;
      while (cap < this.n + k) cap *= 2;
      const b = new Float32Array(cap);
      b.set(this.a.subarray(0, this.n));
      this.a = b;
    }
  }
  push3(x, y, z) {
    this.ensure(3);
    this.a[this.n++] = x; this.a[this.n++] = y; this.a[this.n++] = z;
  }
  push2(x, y) {
    this.ensure(2);
    this.a[this.n++] = x; this.a[this.n++] = y;
  }
  result() { return this.a.slice(0, this.n); }
}
class U32 {
  constructor(cap = 1 << 16) {
    this.a = new Uint32Array(cap);
    this.n = 0;
  }
  push(v) {
    if (this.n >= this.a.length) {
      const b = new Uint32Array(this.a.length * 2);
      b.set(this.a);
      this.a = b;
    }
    this.a[this.n++] = v;
  }
  result() { return this.a.slice(0, this.n); }
}

/**
 * Collects quads per material class (and optional spatial chunk key) and builds
 * merged BufferGeometries.
 */
export class Sink {
  constructor(palette) {
    this.palette = palette;
    this.groups = new Map();
    this.quadCount = 0;
  }
  group(key) {
    let g = this.groups.get(key);
    if (!g) {
      g = { pos: new F32(), nor: new F32(), col: new F32(), uv: new F32(), idx: new U32(), verts: 0 };
      this.groups.set(key, g);
    }
    return g;
  }
  /**
   * verts: 4 x [x,y,z] in CCW order for the normal; ao: 4 ints 0..3; uv: 4 x [u,v].
   */
  quad(key, verts, normal, r, g, b, ao, uvs) {
    const grp = this.group(key);
    const base = grp.verts;
    for (let k = 0; k < 4; k++) {
      const p = verts[k];
      grp.pos.push3(p[0], p[1], p[2]);
      grp.nor.push3(normal[0], normal[1], normal[2]);
      const f = AO_FACTOR[ao[k]];
      grp.col.push3(r * f, g * f, b * f);
      grp.uv.push2(uvs[k][0], uvs[k][1]);
    }
    if (ao[0] + ao[2] >= ao[1] + ao[3]) {
      grp.idx.push(base); grp.idx.push(base + 1); grp.idx.push(base + 2);
      grp.idx.push(base); grp.idx.push(base + 2); grp.idx.push(base + 3);
    } else {
      grp.idx.push(base + 1); grp.idx.push(base + 2); grp.idx.push(base + 3);
      grp.idx.push(base + 1); grp.idx.push(base + 3); grp.idx.push(base);
    }
    grp.verts += 4;
    this.quadCount++;
  }
  /** Build geometries: returns [{ key, geometry }]. */
  build() {
    const out = [];
    for (const [key, g] of this.groups) {
      if (g.verts === 0) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(g.pos.result(), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(g.nor.result(), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(g.col.result(), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(g.uv.result(), 2));
      geo.setIndex(new THREE.BufferAttribute(g.idx.result(), 1));
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      out.push({ key, geometry: geo });
    }
    return out;
  }
}

const _v = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
const _uv = [[0, 0], [0, 0], [0, 0], [0, 0]];
const _ao = [0, 0, 0, 0];
const _n = [0, 0, 0];

/**
 * Mesh a model into the sink. transform = { x, y, z, rot } (rotation about Y, radians).
 * keyFn(cls, worldX, worldZ) -> group key (lets callers chunk spatially).
 */
export function meshModel(model, sink, transform, keyFn) {
  const { x: tx = 0, y: ty = 0, z: tz = 0, rot = 0 } = transform || {};
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  const palette = model.palette;
  for (const grid of model.grids) {
    const s = grid.s;
    const o = grid.o;
    meshGrid(grid, palette, (d, sign, i, j, plane, w, h, mat, aoPacked) => {
      const u = (d + 1) % 3;
      const v = (d + 2) % 3;
      const entry = palette.entries[mat];
      const pd = o[d] + plane * s;
      const u0 = o[u] + i * s;
      const u1 = o[u] + (i + w) * s;
      const v0 = o[v] + j * s;
      const v1 = o[v] + (j + h) * s;
      // corners in (u,v): c0(-,-) c1(+,-) c2(+,+) c3(-,+)
      const cu = [u0, u1, u1, u0];
      const cv = [v0, v0, v1, v1];
      for (let k = 0; k < 4; k++) {
        const p = _v[k];
        p[d] = pd; p[u] = cu[k]; p[v] = cv[k];
        _uv[k][0] = cu[k];
        _uv[k][1] = cv[k];
        _ao[k] = (aoPacked >> (k * 2)) & 3;
      }
      if (sign < 0) {
        // reverse winding: swap corners 1 and 3
        const t = _v[1]; _v[1] = _v[3]; _v[3] = t;
        const tu = _uv[1]; _uv[1] = _uv[3]; _uv[3] = tu;
        const ta = _ao[1]; _ao[1] = _ao[3]; _ao[3] = ta;
      }
      _n[0] = _n[1] = _n[2] = 0;
      _n[d] = sign;
      // rotate normal
      const nx = _n[0] * cr + _n[2] * sr;
      const nz = -_n[0] * sr + _n[2] * cr;
      const normal = [nx, _n[1], nz];
      const verts = [];
      let cx = 0, cz = 0;
      for (let k = 0; k < 4; k++) {
        const p = _v[k];
        const wx = tx + p[0] * cr + p[2] * sr;
        const wz = tz - p[0] * sr + p[2] * cr;
        verts.push([wx, ty + p[1], wz]);
        cx += wx; cz += wz;
      }
      const key = keyFn ? keyFn(entry.cls, cx / 4, cz / 4) : entry.cls;
      sink.quad(key, verts, normal, entry.r, entry.g, entry.b, [_ao[0], _ao[1], _ao[2], _ao[3]], [
        [_uv[0][0], _uv[0][1]], [_uv[1][0], _uv[1][1]], [_uv[2][0], _uv[2][1]], [_uv[3][0], _uv[3][1]],
      ]);
      if (sign < 0) {
        // restore scratch order for next quad
        const t = _v[1]; _v[1] = _v[3]; _v[3] = t;
        const tu = _uv[1]; _uv[1] = _uv[3]; _uv[3] = tu;
      }
    });
  }
}

/** Mesh a model into a standalone geometry map { cls -> BufferGeometry } (for instanced prototypes). */
export function meshModelToGeometries(model) {
  const sink = new Sink(model.palette);
  meshModel(model, sink, { x: 0, y: 0, z: 0, rot: 0 }, (cls) => cls);
  const out = {};
  for (const { key, geometry } of sink.build()) out[key] = geometry;
  return out;
}

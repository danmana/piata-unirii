// Architectural voxel kit: wall frames, openings, mouldings and roofs.
// All dimensions are metres; the grid snaps them to its voxel size.

import { AIR } from '../core/mat.js';
import { noise2 } from '../core/rng.js';

// A wall frame maps façade coordinates (a along the wall, y up, n outward
// from the wall plane; n < 0 goes into the wall) to grid coordinates.
export class Frame {
  constructor(grid, side, plane) {
    this.g = grid;
    this.side = side; // 'front' (-z outward), 'rear' (+z), 'left' (-x), 'right' (+x)
    this.p = plane;
    this.vs = grid.vs;
  }
  at(plane) { return new Frame(this.g, this.side, plane); }
  // convert a,n box to grid box
  _box(a0, n0, a1, n1) {
    const p = this.p;
    switch (this.side) {
      case 'front': return [a0, p - n1, a1, p - n0, 'xz'];
      case 'rear': return [a0, p + n0, a1, p + n1, 'xz'];
      case 'left': return [p - n1, a0, p - n0, a1, 'xz'];
      case 'right': return [p + n0, a0, p + n1, a1, 'xz'];
    }
    throw new Error('bad frame side');
  }
  box(a0, y0, n0, a1, y1, n1, m, mode = 0) {
    if (a1 < a0) { const t = a0; a0 = a1; a1 = t; }
    if (n1 < n0) { const t = n0; n0 = n1; n1 = t; }
    const [x0, z0, x1, z1] = this._box(a0, n0, a1, n1);
    this.g.box(x0, y0, z0, x1, y1, z1, m, mode);
  }
  // f(a, y, n, cur) -> id | -1
  fn(a0, y0, n0, a1, y1, n1, f) {
    if (a1 < a0) { const t = a0; a0 = a1; a1 = t; }
    if (n1 < n0) { const t = n0; n0 = n1; n1 = t; }
    const [x0, z0, x1, z1] = this._box(a0, n0, a1, n1);
    const p = this.p, side = this.side;
    this.g.fn(x0, y0, z0, x1, y1, z1, (x, y, z, c) => {
      let a, n;
      if (side === 'front') { a = x; n = p - z; }
      else if (side === 'rear') { a = x; n = z - p; }
      else if (side === 'left') { a = z; n = p - x; }
      else { a = z; n = x - p; }
      return f(a, y, n, c);
    });
  }
}

// ----------------------------------------------------------------- openings
// Window with surround, sill and head ornament.
export function windowAt(F, M, a, y0, w, h, o = {}) {
  const vs = F.vs;
  const a0 = a - w / 2, a1 = a + w / 2, y1 = y0 + h;
  const recess = o.recess ?? vs;
  const head = o.head || 'flat';
  const arched = head === 'arch' || head === 'pointed';
  const glass = o.lit ? M.glassLit : M.glass;
  const trim = o.trim ?? M.trim;
  const surround = o.surround !== false;
  // opening + glass
  if (arched) {
    const r = w / 2, sy = y1 - r;
    F.fn(a0, y0, -recess - vs, a1, y1, 0.001, (A, Y, N) => {
      if (Y > sy) {
        const dx = A - a, dy = Y - sy;
        if (head === 'arch' && dx * dx + dy * dy > r * r) return -1;
        if (head === 'pointed') {
          const R = w * 0.95;
          const l = (A - (a0 + R)) ** 2 + dy * dy, rr = (A - (a1 - R)) ** 2 + dy * dy;
          if (l > R * R || rr > R * R) return -1;
        }
      }
      return N > -recess ? AIR : glass;
    });
    if (surround) {
      const t = vs;
      F.fn(a0 - t, y0, 0, a1 + t, y1 + t, t, (A, Y, N, c) => {
        if (c !== AIR) return -1;
        const inside = (rr) => {
          if (Y <= sy) return A >= a - rr && A <= a + rr && Y >= y0;
          const dx = A - a, dy = Y - sy;
          return dx * dx + dy * dy <= rr * rr;
        };
        if (inside(r + t) && !inside(r)) return trim;
        return -1;
      });
      // keystone
      F.box(a - t * 0.6, y1 - t * 0.2, 0, a + t * 0.6, y1 + t * 1.6, t * 1.5, trim);
    }
  } else {
    F.box(a0, y0, -recess, a1, y1, 0.001, AIR);
    F.box(a0, y0, -recess - vs, a1, y1, -recess, glass);
    if (surround) {
      const t = vs;
      F.box(a0 - t, y0, 0, a0, y1 + t, t, trim, 1);
      F.box(a1, y0, 0, a1 + t, y1 + t, t, trim, 1);
      F.box(a0 - t, y1, 0, a1 + t, y1 + t, t, trim, 1);
    }
  }
  // glazing bars (only where voxels are fine enough)
  if (o.mullion && vs <= 0.26 && w >= 1.0) {
    const fr = o.frame ?? M.frame;
    F.box(a - vs / 2, y0, -recess - 0.001, a + vs / 2, arched ? y1 - w / 2 : y1, -recess + vs * 0.5, fr);
    const ty = y0 + h * 0.68;
    if (!arched) F.box(a0, ty, -recess - 0.001, a1, ty + vs, -recess + vs * 0.5, fr);
  }
  // sill
  if (o.sill !== false) {
    F.box(a0 - vs, y0 - vs, 0, a1 + vs, y0, vs * 2, trim);
  }
  // head ornaments
  const t = vs;
  switch (head) {
    case 'cornice':
      F.box(a0 - t, y1 + t, 0, a1 + t, y1 + 2 * t, t, M.trim2 ?? trim);
      F.box(a0 - 2 * t, y1 + 2 * t, 0, a1 + 2 * t, y1 + 3 * t, 2 * t, trim);
      break;
    case 'triangle': {
      const base = y1 + t;
      F.box(a0 - 2 * t, base, 0, a1 + 2 * t, base + t, 2 * t, trim);
      const half = w / 2 + 2 * t;
      const hh = half * 0.42;
      F.fn(a0 - 2 * t, base + t, 0, a1 + 2 * t, base + t + hh, 2 * t, (A, Y) => {
        const lim = half * (1 - (Y - base - t) / hh);
        return Math.abs(A - a) <= lim ? trim : -1;
      });
      break;
    }
    case 'segment': {
      const base = y1 + t;
      const half = w / 2 + 2 * t;
      const R = half * 1.6, cy = base - (R - half * 0.45);
      F.fn(a0 - 2 * t, base, 0, a1 + 2 * t, base + half * 0.6 + t, 2 * t, (A, Y) => {
        const d = Math.hypot(A - a, Y - cy);
        return d <= R && d >= R - 1.6 * t ? trim : -1;
      });
      break;
    }
    case 'ears':
      F.box(a0 - 2 * t, y1 - t, 0, a0, y1 + t, t, trim);
      F.box(a1, y1 - t, 0, a1 + 2 * t, y1 + t, t, trim);
      F.box(a - t, y1, 0, a + t, y1 + 2.5 * t, 2 * t, trim);
      F.box(a0 - t, y1 + t, 0, a1 + t, y1 + 2 * t, t, trim);
      break;
    case 'flat':
      F.box(a - t * 0.6, y1, 0, a + t * 0.6, y1 + t * 1.5, t * 1.5, trim);
      break;
    default:
      break;
  }
  if (o.apron) {
    F.box(a0, y0 - 3 * t, 0, a1, y0 - t, t, M.trim2 ?? trim);
  }
}

// Round-arched carriage gateway / portal
export function gateAt(F, M, a, y0, w, h, o = {}) {
  const vs = F.vs;
  const r = w / 2, sy = y0 + h - r;
  const depth = o.depth ?? Math.max(0.6, vs * 2);
  F.fn(a - r, y0, -depth - vs, a + r, y0 + h, 0.001, (A, Y, N) => {
    if (Y > sy && (A - a) ** 2 + (Y - sy) ** 2 > r * r) return -1;
    return N > -depth ? AIR : (o.door ?? M.door);
  });
  const t = o.ring ?? Math.max(vs, 0.3);
  const ringMat = o.ringMat ?? M.trim;
  F.fn(a - r - t, y0, 0, a + r + t, y0 + h + t, vs, (A, Y, N, c) => {
    const inArch = (R) => (Y <= sy ? Math.abs(A - a) <= R : (A - a) ** 2 + (Y - sy) ** 2 <= R * R);
    if (inArch(r + t) && !inArch(r)) {
      // voussoir joints
      if (o.voussoirs && Y > sy) {
        const ang = Math.atan2(Y - sy, A - a);
        if (Math.abs(Math.sin(ang * 9)) < 0.18) return -1;
      }
      return ringMat;
    }
    return -1;
  });
  F.box(a - vs, y0 + h - vs, 0, a + vs, y0 + h + t + vs, vs * 2, ringMat);
}

// Shopfront: large glazed opening with fascia sign and optional awning
export function shopfrontAt(F, M, a, y0, w, h, o = {}) {
  const vs = F.vs;
  const a0 = a - w / 2, a1 = a + w / 2, y1 = y0 + h;
  const rec = Math.max(0.3, vs);
  F.box(a0, y0, -rec - vs, a1, y1, 0.001, AIR);
  F.box(a0, y0 + 0.4, -rec - vs, a1, y1, -rec, o.lit ? M.shopLit : M.shopGlass);
  F.box(a0, y0, -rec - vs, a1, y0 + 0.4, -rec, M.frame);
  // door in the middle
  const dw = Math.min(1.1, w * 0.35);
  F.box(a - dw / 2, y0, -rec - vs, a + dw / 2, y1 - 0.4, -rec, M.frame);
  F.box(a - dw / 2 + vs, y0 + vs, -rec - vs - 0.01, a + dw / 2 - vs, y1 - 0.4 - vs, -rec + 0.01, o.lit ? M.shopLit : M.shopGlass);
  // frame posts
  F.box(a0, y0, -rec, a0 + vs, y1, 0, M.frame);
  F.box(a1 - vs, y0, -rec, a1, y1, 0, M.frame);
  // fascia sign
  if (o.sign) {
    F.box(a0 - vs, y1 + 0.05, 0, a1 + vs, y1 + 0.6, vs, o.sign);
  }
  if (o.awning) {
    const d = o.awningDepth ?? 1.3;
    const top = y1 + 0.02, drop = 0.75;
    F.fn(a0 - vs, top - drop - 0.35, 0, a1 + vs, top + vs, d, (A, Y, N) => {
      const t = N / d; // 0 at wall .. 1 at front
      const yy = top - t * drop;
      if (Math.abs(Y - yy) <= vs * 0.75) return o.awning;
      if (N >= d - vs && Y < yy && Y > yy - 0.3) return o.awning; // valance
      return -1;
    });
  }
}

// ---------------------------------------------------------------- mouldings
export function stringCourse(F, M, a0, a1, y, deep = 1, mat = null) {
  const vs = F.vs;
  F.box(a0, y - vs, 0, a1, y, vs * deep, mat ?? M.trim);
}

export function cornice(F, M, a0, a1, y, style = 'simple', mat = null) {
  const vs = F.vs, t = vs;
  const m = mat ?? M.trim;
  switch (style) {
    case 'rich':
      F.box(a0, y - 5 * t, 0, a1, y - 4 * t, t, M.trim2 ?? m);   // frieze fillet
      F.box(a0, y - 3 * t, 0, a1, y - 2 * t, t, m);
      // dentils
      F.fn(a0, y - 2 * t, 0, a1, y - t, 2 * t, (A) => (Math.floor(A / t) % 2 === 0 ? m : -1));
      F.box(a0, y - 2 * t, 0, a1, y - t, t, m, 1);
      F.box(a0 - t, y - t, 0, a1 + t, y, 3 * t, m);
      break;
    case 'bracket':
      F.box(a0, y - 3 * t, 0, a1, y - 2 * t, t, m);
      F.fn(a0, y - 2 * t, 0, a1, y - t, 2 * t, (A) => (Math.floor(A / (3 * t)) % 2 === 0 ? m : -1));
      F.box(a0, y - 2 * t, 0, a1, y - t, t, m, 1);
      F.box(a0 - t, y - t, 0, a1 + t, y, 3 * t, m);
      break;
    case 'heavy':
      F.box(a0, y - 4 * t, 0, a1, y - 3 * t, t, m);
      F.box(a0, y - 3 * t, 0, a1, y - 2 * t, 2 * t, m);
      F.box(a0, y - 2 * t, 0, a1, y - t, 3 * t, m);
      F.box(a0 - t, y - t, 0, a1 + t, y, 4 * t, m);
      break;
    default:
      F.box(a0, y - 2 * t, 0, a1, y - t, t, m);
      F.box(a0, y - t, 0, a1, y, 2 * t, m);
  }
}

export function pilaster(F, M, a, y0, y1, w = 0.6, mat = null, capital = true) {
  const vs = F.vs;
  const m = mat ?? M.trim;
  F.box(a - w / 2, y0, 0, a + w / 2, y1, vs, m);
  if (capital) {
    F.box(a - w / 2 - vs * 0.5, y1 - vs * 1.5, 0, a + w / 2 + vs * 0.5, y1, vs * 2, m);
    F.box(a - w / 2 - vs * 0.5, y0, 0, a + w / 2 + vs * 0.5, y0 + vs, vs * 2, m);
  }
}

export function rusticate(F, M, a0, a1, y0, y1, mat, course = 0.5) {
  const vs = F.vs;
  F.box(a0, y0, 0, a1, y1, vs, mat);
  const step = Math.max(course, vs * 2);
  for (let y = y0 + step; y < y1 - vs * 0.5; y += step) {
    F.box(a0, y - vs * 0.5, 0, a1, y + vs * 0.5, vs, AIR);
  }
}

export function quoins(F, M, a, y0, y1, dir, mat) {
  const vs = F.vs;
  const step = Math.max(0.55, vs * 2);
  let k = 0;
  for (let y = y0; y < y1 - vs * 0.5; y += step, k++) {
    const wq = k % 2 ? 0.55 : 0.85;
    const aa = dir > 0 ? a : a - wq;
    F.box(aa, y, 0, aa + wq, Math.min(y1, y + step - vs * 0.5), vs, mat);
  }
}

export function balcony(F, M, a0, a1, y, depth, o = {}) {
  const vs = F.vs;
  const slab = o.slab ?? M.trim;
  F.box(a0, y - vs, 0, a1, y, depth, slab);
  // consoles
  const nC = Math.max(2, Math.round((a1 - a0) / 1.4) + 1);
  for (let i = 0; i < nC; i++) {
    const a = a0 + vs + (a1 - a0 - 2 * vs) * (i / (nC - 1));
    F.box(a - vs / 2, y - 3 * vs, 0, a + vs / 2, y - vs, depth * 0.7, slab);
    F.box(a - vs / 2, y - 4 * vs, 0, a + vs / 2, y - 3 * vs, depth * 0.35, slab);
  }
  // railing
  const rail = o.rail ?? M.rail;
  const h = o.h ?? 1.0;
  if (o.balustrade) {
    F.fn(a0, y, depth - vs * 1.5, a1, y + h, depth, (A) => (Math.floor(A / vs) % 2 === 0 ? slab : -1));
    F.box(a0, y + h - vs, 0, a1, y + h, depth, slab, 1);
    F.box(a0, y + h - vs, depth - vs * 1.5, a1, y + h, depth, slab);
    F.box(a0, y, 0, a0 + vs, y + h, depth, slab);
    F.box(a1 - vs, y, 0, a1, y + h, depth, slab);
  } else {
    F.fn(a0, y, depth - vs, a1, y + h, depth, (A) => (Math.floor(A / vs) % 2 === 0 ? rail : -1));
    F.box(a0, y + h - vs, depth - vs, a1, y + h, depth, rail);
    F.box(a0, y, 0, a0 + vs, y + h, depth, rail, 1);
    F.box(a1 - vs, y, 0, a1, y + h, depth, rail, 1);
    F.box(a0, y + h - vs, 0, a0 + vs, y + h, depth, rail);
    F.box(a1 - vs, y + h - vs, 0, a1, y + h, depth, rail);
  }
}

export function balustrade(F, M, a0, a1, y, h, mat, n = 0) {
  const vs = F.vs;
  F.box(a0, y, n, a1, y + vs, n + vs * 2, mat);
  F.fn(a0, y + vs, n, a1, y + h - vs, n + vs * 1.5, (A) => (Math.floor(A / vs) % 2 === 0 ? mat : -1));
  F.box(a0, y + h - vs, n - vs * 0.5, a1, y + h, n + vs * 2, mat);
  // posts every ~2.4 m
  const nP = Math.max(2, Math.round((a1 - a0) / 2.4) + 1);
  for (let i = 0; i < nP; i++) {
    const a = a0 + (a1 - a0) * (i / (nP - 1));
    F.box(a - vs, y, n, a + vs, y + h + vs, n + vs * 2, mat);
  }
}

// ------------------------------------------------------------------- roofs
// Roof over rectangle [x0,x1]x[z0,z1] at eave height y.
// type: 'gable-x' (ridge along x), 'gable-z', 'hip', 'mansard' (along x), 'mansard-hip', 'shed-z' (low at z0 edge... high at z1), 'flat'
export function roof(g, r) {
  const { x0, x1, z0, z1, y } = r;
  const type = r.type || 'gable-x';
  const tanP = Math.tan(((r.pitch ?? 45) * Math.PI) / 180);
  const ov = r.ov ?? g.vs;
  const ovx = r.ovx ?? ov;
  const mat = r.mat, mat2 = r.mat2 ?? mat;
  const gm = r.gableMat;
  const vs = g.vs;
  const vary = r.vary;
  let hMax;
  if (type === 'gable-x' || type === 'hip') hMax = ((z1 - z0) / 2 + ov) * tanP;
  else if (type === 'gable-z') hMax = ((x1 - x0) / 2 + ov) * tanP;
  else if (type === 'mansard' || type === 'mansard-hip') {
    const mh = r.breakH ?? 2.8;
    const tanL = Math.tan(((r.lowerPitch ?? 74) * Math.PI) / 180), tanU = Math.tan(((r.upperPitch ?? 26) * Math.PI) / 180);
    const inset = mh / tanL;
    hMax = mh + Math.max(0, ((Math.min(x1 - x0, z1 - z0) / 2) - inset) * tanU);
    if (r.capH) hMax = Math.min(hMax, r.capH);
  } else if (type === 'shed-z') hMax = (z1 - z0 + ov) * tanP;
  else hMax = vs;
  if (r.maxH) hMax = Math.min(hMax, r.maxH);
  const mh = r.breakH ?? 2.8;
  const tanL = Math.tan(((r.lowerPitch ?? 74) * Math.PI) / 180), tanU = Math.tan(((r.upperPitch ?? 26) * Math.PI) / 180);
  const inset = (dy) => (dy < mh ? dy / tanL : mh / tanL + (dy - mh) / tanU);
  g.fn(x0 - ovx, y, z0 - ov, x1 + ovx, y + hMax + vs, z1 + ov, (x, yy, z, c) => {
    if (r.onlyEmpty && c !== AIR) return -1;
    const dy = yy - y;
    let inside = false, upper = false;
    switch (type) {
      case 'gable-x': {
        const d = dy / tanP;
        inside = z >= z0 - ov + d && z <= z1 + ov - d && x >= x0 - ovx && x <= x1 + ovx;
        break;
      }
      case 'gable-z': {
        const d = dy / tanP;
        inside = x >= x0 - ov + d && x <= x1 + ov - d && z >= z0 - ovx && z <= z1 + ovx;
        break;
      }
      case 'hip': {
        const d = dy / tanP;
        inside = z >= z0 - ov + d && z <= z1 + ov - d && x >= x0 - ov + d && x <= x1 + ov - d;
        break;
      }
      case 'mansard': case 'mansard-hip': {
        const d = inset(dy);
        inside = z >= z0 - ov + d && z <= z1 + ov - d;
        if (type === 'mansard-hip') inside = inside && x >= x0 - ov + d && x <= x1 + ov - d;
        else inside = inside && x >= x0 - ovx && x <= x1 + ovx;
        upper = dy >= mh;
        break;
      }
      case 'shed-z': {
        inside = x >= x0 - ovx && x <= x1 + ovx && z >= z0 - ov && z <= z1 + ov && dy <= (z - z0 + ov) * tanP;
        break;
      }
      default:
        inside = x >= x0 && x <= x1 && z >= z0 && z <= z1 && dy < vs;
    }
    if (!inside) return -1;
    if (gm !== undefined && type === 'gable-x' && (x < x0 + vs || x > x1 - vs)) return gm;
    if (gm !== undefined && type === 'gable-z' && (z < z0 + vs || z > z1 - vs)) return gm;
    let m = upper ? mat2 : mat;
    if (vary && !upper) {
      const nz = noise2(x * 0.55 + r.seed * 0.1, z * 0.55 + yy * 0.8, r.seed | 0);
      if (nz > 0.72) m = vary[0];
      else if (nz < 0.22 && vary[1] !== undefined) m = vary[1];
    }
    return m;
  });
  return y + hMax;
}

// Roof height helper for gable/hip roofs
export function ridgeY(y, depth, pitch, ov = 0) {
  return y + (depth / 2 + ov) * Math.tan((pitch * Math.PI) / 180);
}

// Chimney stack on a roof
export function chimney(g, x, z, yBase, yTop, mat, cap) {
  const vs = g.vs;
  const w = Math.max(0.6, vs * 2);
  g.box(x - w / 2, yBase, z - w / 2, x + w / 2, yTop, z + w / 2, mat);
  g.box(x - w / 2 - vs * 0.5, yTop - vs, z - w / 2 - vs * 0.5, x + w / 2 + vs * 0.5, yTop, z + w / 2 + vs * 0.5, cap);
}

// Dormer on a slope facing -z (front) with its face at z = zf; roof pitch for the little gable.
export function dormer(g, M, x, zf, yBase, w, h, dir, o = {}) {
  const vs = g.vs;
  const depth = o.depth ?? 2.2;
  // box body
  const zA = dir < 0 ? zf : zf - depth, zB = dir < 0 ? zf + depth : zf;
  g.box(x - w / 2, yBase, zA, x + w / 2, yBase + h, zB, o.wall ?? M.wall);
  // window
  const ww = w - 2 * vs * 1.2, wh = h - 0.5;
  const zg0 = dir < 0 ? zf : zf - vs, zg1 = dir < 0 ? zf + vs : zf;
  g.box(x - ww / 2, yBase + 0.25, zg0, x + ww / 2, yBase + 0.25 + wh, zg1, o.lit ? M.glassLit : M.glass);
  // little gable roof (ridge along z)
  roof(g, { x0: x - w / 2, x1: x + w / 2, z0: zA, z1: zB, y: yBase + h, type: 'gable-z', pitch: 42, ov: vs, ovx: 0, mat: o.roof ?? M.roof });
}

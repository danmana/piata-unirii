// Small sculptural elements: robed stone statues, vases, cartouches, domes.

import { sdSphere, sdCap, sdEllipsoid, smin, voxelizeSDF } from '../core/sdf.js';
import { AIR } from '../core/mat.js';

// Robed classical statue standing at (x, y, z), height h, facing direction angle `face` (radians, 0 = -z)
export function statue(g, x, y, z, h, face, mat, pose = 0) {
  const s = h / 1.85;
  const c = Math.cos(face), sn = Math.sin(face);
  voxelizeSDF(g, x - 0.8 * s, y, z - 0.8 * s, x + 0.8 * s, y + h + 0.5 * s, z + 0.8 * s, (X, Y, Z) => {
    const lx = X - x, lz = Z - z;
    // local: forward = -z
    const rx = (c * lx - sn * lz) / s, rz = (sn * lx + c * lz) / s, ry = (Y - y) / s;
    return robed(rx, ry, rz, pose) * s;
  }, mat);
}

function robed(x, y, z, pose) {
  // flowing robe: tapered cone from shoulders to feet
  let d = sdCap(x, y, z, 0, 0.12, 0, 0, 1.35, 0, 0.26, 0.19);
  d = smin(d, sdCap(x, y, z, 0, 1.38, 0, 0, 1.46, 0, 0.21, 0.18), 0.06);
  d = Math.min(d, sdSphere(x, y, z, 0, 1.62, -0.01, 0.12));
  d = Math.min(d, sdCap(x, y, z, 0, 0.0, 0, 0, 0.1, 0, 0.3, 0.28));
  // arms
  if (pose === 0) {
    d = Math.min(d, sdCap(x, y, z, 0.2, 1.4, 0, 0.26, 1.0, -0.12, 0.07, 0.06));
    d = Math.min(d, sdCap(x, y, z, -0.2, 1.4, 0, -0.35, 1.75, -0.1, 0.07, 0.06));
  } else if (pose === 1) {
    d = Math.min(d, sdCap(x, y, z, 0.2, 1.4, 0, 0.22, 1.02, -0.18, 0.07, 0.06));
    d = Math.min(d, sdCap(x, y, z, -0.2, 1.4, 0, -0.24, 1.02, -0.2, 0.07, 0.06));
    d = Math.min(d, sdEllipsoid(x, y, z, 0, 1.0, -0.26, 0.2, 0.14, 0.08));
  } else {
    d = Math.min(d, sdCap(x, y, z, 0.2, 1.4, 0, 0.3, 1.1, -0.05, 0.07, 0.06));
    d = Math.min(d, sdCap(x, y, z, -0.2, 1.4, 0, -0.3, 1.55, -0.2, 0.07, 0.06));
    d = Math.min(d, sdCap(x, y, z, -0.3, 0.2, -0.2, -0.3, 2.0, -0.2, 0.03, 0.03));
  }
  // drapery folds
  d += Math.sin(Math.atan2(z, x) * 7 + y * 3) * 0.012;
  return d;
}

export function vase(g, x, y, z, h, mat) {
  const r = h * 0.3;
  g.fn(x - r, y, z - r, x + r, y + h, z + r, (X, Y, Z) => {
    const t = (Y - y) / h;
    let rr;
    if (t < 0.15) rr = r * 0.55;
    else if (t < 0.25) rr = r * 0.3;
    else if (t < 0.8) rr = r * (0.55 + 0.45 * Math.sin(((t - 0.25) / 0.55) * Math.PI));
    else if (t < 0.9) rr = r * 0.45;
    else rr = r * 0.2;
    return (X - x) ** 2 + (Z - z) ** 2 <= rr * rr ? mat : -1;
  });
}

// Helmet / bell dome with ribs and lantern over (cx, cz)
export function helmetDome(g, cx, cz, y0, rb, h, mat, rib, o = {}) {
  const lanternH = o.lanternH ?? h * 0.28;
  g.fn(cx - rb - 0.3, y0, cz - rb - 0.3, cx + rb + 0.3, y0 + h, cz + rb + 0.3, (x, y, z) => {
    const t = (y - y0) / h;
    let r = rb * Math.pow(Math.max(0, Math.cos((t * Math.PI) / 2)), 0.75) * (1 + 0.16 * Math.sin(t * Math.PI));
    if (o.flare) r *= 1 + 0.12 * Math.max(0, 0.25 - t) * 4;
    const dx = x - cx, dz = z - cz;
    const d = Math.hypot(dx, dz);
    if (d > r) return -1;
    if (rib !== undefined && d > r - g.vs * 1.2) {
      const ang = Math.atan2(dz, dx);
      if (Math.abs(Math.sin(ang * (o.ribs ?? 4))) < 0.12) return rib;
    }
    return mat;
  });
  // lantern
  const top = y0 + h * 0.92;
  const lr = Math.max(g.vs * 1.5, rb * 0.22);
  g.cylY(cx, cz, lr, top - 0.2, top + lanternH, o.lanternMat ?? mat);
  g.cylY(cx, cz, lr + g.vs, top + lanternH, top + lanternH + g.vs, rib ?? mat);
  g.fn(cx - lr, top + lanternH + g.vs, cz - lr, cx + lr, top + lanternH + lr * 2.2, cz + lr, (x, y, z) => {
    const t = (y - top - lanternH - g.vs) / (lr * 2.2);
    return Math.hypot(x - cx, z - cz) <= lr * (1 - t) ? (rib ?? mat) : -1;
  });
  const fy = top + lanternH + lr * 2.2;
  g.box(cx - g.vs * 0.5, fy, cz - g.vs * 0.5, cx + g.vs * 0.5, fy + (o.finialH ?? 1.2), cz + g.vs * 0.5, o.finial ?? rib ?? mat);
  return fy;
}

// Height-field roof over an arbitrary footprint given its inside-distance function
// profile(d) -> height above eave for horizontal distance d from the eave line.
export function heightRoof(g, x0, z0, x1, z1, y, dist, profile, matFn, maxH = 30, ov = 0.3) {
  g.fn(x0 - ov, y, z0 - ov, x1 + ov, y + maxH, z1 + ov, (x, yy, z, c) => {
    if (c !== AIR) return -1;
    const d = dist(x, z) + ov;
    if (d <= 0) return -1;
    const h = profile(d);
    const dy = yy - y;
    if (dy > h) return -1;
    return matFn(dy, x, z, h);
  });
}

export function mansardProfile(breakH = 3.0, lower = 74, upper = 24, cap = 5.2) {
  const tL = Math.tan((lower * Math.PI) / 180), tU = Math.tan((upper * Math.PI) / 180);
  const dB = breakH / tL;
  return (d) => Math.min(cap, d < dB ? d * tL : breakH + (d - dB) * tU);
}

export function hipProfile(pitch = 42, cap = 99) {
  const t = Math.tan((pitch * Math.PI) / 180);
  return (d) => Math.min(cap, d * t);
}

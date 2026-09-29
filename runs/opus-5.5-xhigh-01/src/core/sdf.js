// Tiny signed-distance toolkit used to sculpt statues, horses and ornaments
// before voxelising them at fine resolution.

export function sdSphere(x, y, z, cx, cy, cz, r) {
  const dx = x - cx, dy = y - cy, dz = z - cz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

export function sdEllipsoid(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
  const k0 = Math.sqrt(px * px + py * py + pz * pz);
  const qx = (x - cx) / (rx * rx), qy = (y - cy) / (ry * ry), qz = (z - cz) / (rz * rz);
  const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1e-6;
  return k0 * (k0 - 1) / k1;
}

// Capsule / tapered cone between a and b with radii ra, rb
export function sdCap(x, y, z, ax, ay, az, bx, by, bz, ra, rb = ra) {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const pax = x - ax, pay = y - ay, paz = z - az;
  const L2 = bax * bax + bay * bay + baz * baz || 1e-9;
  let t = (pax * bax + pay * bay + paz * baz) / L2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = pax - bax * t, dy = pay - bay * t, dz = paz - baz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * t);
}

export function sdBox(x, y, z, cx, cy, cz, hx, hy, hz, r = 0) {
  const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r, qz = Math.abs(z - cz) - hz + r;
  const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0);
  return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
}

export function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// Rotate point around Y axis about a pivot (returns [x,z])
export function rotY(x, z, cx, cz, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const dx = x - cx, dz = z - cz;
  return [cx + c * dx + s * dz, cz - s * dx + c * dz];
}

// Voxelise an SDF into the grid. sdf(x,y,z,out) returns distance and may write
// out.m (material id). Only voxels with d <= 0 are written.
export function voxelizeSDF(grid, x0, y0, z0, x1, y1, z1, sdf, defMat, mode = 0) {
  const out = { m: defMat };
  const half = grid.vs * 0.5;
  grid.fn(x0, y0, z0, x1, y1, z1, (x, y, z, cur) => {
    out.m = defMat;
    const d = sdf(x, y, z, out);
    if (d > half * 0.35) return -1;
    if (mode === 1 && cur !== 0) return -1;
    return out.m;
  });
}

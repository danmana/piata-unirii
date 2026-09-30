// Gothic vocabulary: rotated wall frames, pointed-arch windows with tracery,
// buttresses, pinnacles and crockets.

import { AIR } from '../core/mat.js';

// Arbitrary vertical wall frame: origin (ox, oz), unit tangent t, outward normal n (xz plane)
export class RFrame {
  constructor(g, ox, oz, tx, tz, nx, nz) {
    this.g = g; this.vs = g.vs;
    this.ox = ox; this.oz = oz;
    this.tx = tx; this.tz = tz; this.nx = nx; this.nz = nz;
  }
  static axis(g, side, plane) {
    // side: 'N' wall facing -z at z = plane, 'S' facing +z, 'W' facing -x, 'E' facing +x
    switch (side) {
      case 'N': return new RFrame(g, 0, plane, 1, 0, 0, -1);
      case 'S': return new RFrame(g, 0, plane, 1, 0, 0, 1);
      case 'W': return new RFrame(g, plane, 0, 0, 1, -1, 0);
      case 'E': return new RFrame(g, plane, 0, 0, 1, 1, 0);
    }
    throw new Error('side');
  }
  fn(a0, y0, n0, a1, y1, n1, f) {
    if (a1 < a0) { const t = a0; a0 = a1; a1 = t; }
    if (n1 < n0) { const t = n0; n0 = n1; n1 = t; }
    const xs = [], zs = [];
    for (const a of [a0, a1]) for (const n of [n0, n1]) {
      xs.push(this.ox + this.tx * a + this.nx * n);
      zs.push(this.oz + this.tz * a + this.nz * n);
    }
    const e = this.vs;
    const { ox, oz, tx, tz, nx, nz } = this;
    this.g.fn(Math.min(...xs) - e, y0, Math.min(...zs) - e, Math.max(...xs) + e, y1, Math.max(...zs) + e, (x, y, z, c) => {
      const dx = x - ox, dz = z - oz;
      const a = dx * tx + dz * tz, n = dx * nx + dz * nz;
      if (a < a0 || a > a1 || n < n0 || n > n1) return -1;
      return f(a, y, n, c);
    });
  }
  box(a0, y0, n0, a1, y1, n1, m, mode = 0) {
    this.fn(a0, y0, n0, a1, y1, n1, (a, y, n, c) => {
      if (mode === 1 && c !== AIR) return -1;
      if (mode === 2 && c === AIR) return -1;
      return m;
    });
  }
}

// Pointed (two-centred) arch membership. h = half-span, R = radius (>= h), e = offset
export function inPointed(a, y, spring, h, R, e = 0) {
  if (y <= spring) return Math.abs(a) <= h + e;
  const c = h - R; // left circle centre for right side
  const dy = y - spring;
  const d1 = (a - c) * (a - c) + dy * dy, d2 = (a + c) * (a + c) + dy * dy;
  const rr = (R + e) * (R + e);
  return d1 <= rr && d2 <= rr;
}

export function pointedApex(spring, h, R) {
  const c = R - h;
  return spring + Math.sqrt(Math.max(0, R * R - c * c));
}

// Gothic window with splayed reveals, glass and tracery.
// o: { lights, depth, splay, glass: fn(a,y)->id, stone, dark, rose: bool, rho }
export function gothicWindow(F, a, y0, w, spring, o) {
  const vs = F.vs;
  const h = w / 2;
  const R = (o.rho ?? 1.0) * w;
  const apex = pointedApex(spring, h, R);
  const depth = o.depth ?? 0.75;
  const splay = o.splay ?? 2; // number of stepped reveal orders
  const t = vs;
  const L = o.lights ?? 3;
  const stone = o.tracery ?? o.stone;
  const reveal = o.reveal ?? o.stone;
  const maxE = splay * vs;
  // carve reveals: layers from the surface inward
  F.fn(a - h - maxE - vs, y0 - vs, -depth - vs * 1.01, a + h + maxE + vs, apex + maxE + vs, 0.01, (A, Y, N, c) => {
    const aa = A - a;
    if (N < -depth - 0.001) {
      // glass plane
      if (!inPointed(aa, Y, spring, h, R) || Y < y0) return -1;
      return traceryAt(aa, Y) ? stone : o.glass(aa, Y);
    }
    // reveal depth layer index: 0 at surface
    const k = Math.floor(-N / vs);
    const e = Math.max(0, (splay - k)) * vs * 0.9;
    if (Y < y0 - (e > 0 ? 0 : 0)) return -1;
    if (inPointed(aa, Y, spring, h, R, e) && Y >= y0 - e * 0.25) {
      if (N > -depth + vs * 0.999 || !traceryAt(aa, Y)) return AIR;
      return stone;
    }
    if (c !== AIR && inPointed(aa, Y, spring, h, R, e + vs * 1.2)) return reveal;
    return -1;
  });
  function traceryAt(aa, Y) {
    if (L <= 1 && !o.rose) return false;
    const lw = (2 * h) / L;
    // mullions
    for (let k = 1; k < L; k++) {
      const m = -h + k * lw;
      if (Math.abs(aa - m) <= t * 0.5 && Y <= spring + lw * 0.9) return true;
    }
    if (Y > spring - lw * 0.1) {
      // sub-arches of each light
      for (let i = 0; i < L; i++) {
        const c = -h + (i + 0.5) * lw;
        const hl = lw / 2;
        const inO = inPointed(aa - c, Y, spring, hl, lw * 0.95, 0);
        const inI = inPointed(aa - c, Y, spring, hl - t, lw * 0.95 - t, 0);
        if (inO && !inI && Y > spring) return true;
      }
      // head circle(s)
      const top = pointedApex(spring, h, R);
      const lightApex = pointedApex(spring, lw / 2, lw * 0.95);
      const space = top - lightApex;
      if (space > 1.0) {
        const rc = Math.min(space * 0.42, h * 0.62);
        const yc = lightApex + space * 0.46;
        const d = Math.hypot(aa, Y - yc);
        if (Math.abs(d - rc) <= t * 0.55) return true;
        if (d < rc) {
          // quatrefoil / radial tracery
          if (o.rose || rc > 1.1) {
            const ang = Math.atan2(Y - yc, aa);
            const spokes = o.rose ? 8 : 4;
            if (Math.abs(Math.sin(ang * spokes * 0.5)) * d < t * 0.55 && d > rc * 0.3) return true;
            if (Math.abs(d - rc * 0.3) < t * 0.5) return true;
          } else {
            const q = rc * 0.5;
            let inLobe = false;
            for (const [px, py] of [[q, 0], [-q, 0], [0, q], [0, -q]]) {
              if (Math.hypot(aa - px, Y - yc - py) < q * 0.92) { inLobe = true; break; }
            }
            if (!inLobe) return true;
          }
        }
        // spandrel trefoils between circle and lights: keep open glass
      }
    }
    return false;
  }
  return apex;
}

// Stepped buttress on a wall. proj axis: outward normal of frame; a centred at ac
// stages: [[yTop, projection], ...] with sloped weatherings; final slope back to wall
export function buttress(F, ac, w, stages, mat, o = {}) {
  const slope = o.slope ?? 0.9;
  const top = stages[stages.length - 1][0];
  const topSlope = o.topSlope ?? 1.4;
  const Pmax = stages[0][1];
  const projAt = (y) => {
    for (let i = 0; i < stages.length; i++) {
      const [yt, p] = stages[i];
      const last = i === stages.length - 1;
      const s = last ? topSlope : slope;
      if (y <= yt - s) return p;
      if (y <= yt) {
        const next = last ? (o.endP ?? 0.25) : stages[i + 1][1];
        return p + (next - p) * ((y - (yt - s)) / s);
      }
    }
    return -1;
  };
  const socle = o.socle ?? 0;
  F.fn(ac - w / 2 - 0.3, o.y0 ?? 0, -0.3, ac + w / 2 + 0.3, top + 0.01, Pmax + 0.3, (a, y, n, c) => {
    let hw = w / 2, P = projAt(y);
    let grow = y < socle;
    if (!grow && o.bands) for (const b of o.bands) if (y >= b[0] && y < b[1]) grow = true;
    if (grow) { hw += 0.25; P += 0.25; }
    if (P < 0) return -1;
    if (Math.abs(a - ac) > hw || n > P) return -1;
    if (n < -0.2) return -1;
    return mat;
  });
  return { projAt };
}

// Square pinnacle with pyramidal spirelet, crockets and finial
export function pinnacle(g, cx, cz, y0, shaftH, w, spireH, mat, o = {}) {
  const vs = g.vs;
  const hw = w / 2;
  g.box(cx - hw, y0, cz - hw, cx + hw, y0 + shaftH, cz + hw, mat);
  // little gablets on each face
  if (o.gablets !== false && w >= 0.9) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const bx = cx + dx * (hw + vs * 0.5), bz = cz + dz * (hw + vs * 0.5);
      for (let k = 0; k < 3; k++) {
        const yy = y0 + shaftH - vs * (3 - k);
        const half = (hw - k * vs);
        if (half <= 0) break;
        if (dx !== 0) g.box(bx - vs * 0.5, yy, cz - half, bx + vs * 0.5, yy + vs, cz + half, mat);
        else g.box(cx - half, yy, bz - vs * 0.5, cx + half, yy + vs, bz + vs * 0.5, mat);
      }
    }
  }
  const ys = y0 + shaftH;
  g.fn(cx - hw, ys, cz - hw, cx + hw, ys + spireH, cz + hw, (x, y, z) => {
    const t = (y - ys) / spireH;
    const r = hw * (1 - t) + vs * 0.5 * t;
    return Math.abs(x - cx) <= r && Math.abs(z - cz) <= r ? mat : -1;
  });
  // crockets along the edges
  const nC = Math.max(1, Math.floor(spireH / 0.8));
  for (let i = 1; i <= nC; i++) {
    const y = ys + (spireH * i) / (nC + 1);
    const t = (y - ys) / spireH;
    const r = hw * (1 - t) + vs * 0.5;
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      g.set(cx + sx * (r + vs * 0.5), y, cz + sz * (r + vs * 0.5), mat);
    }
  }
  // finial
  const fy = ys + spireH;
  g.box(cx - vs * 0.5, fy, cz - vs * 0.5, cx + vs * 0.5, fy + vs * 3, cz + vs * 0.5, mat);
  g.set(cx + vs, fy + vs * 1.5, cz, mat); g.set(cx - vs, fy + vs * 1.5, cz, mat);
  g.set(cx, fy + vs * 1.5, cz + vs, mat); g.set(cx, fy + vs * 1.5, cz - vs, mat);
}

// Crockets along a sloped edge line (from p0 to p1), every step metres
export function crocketLine(g, x0, y0, z0, x1, y1, z1, step, mat) {
  const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
  const n = Math.max(1, Math.floor(L / step));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    g.set(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + g.vs, z0 + (z1 - z0) * t, mat);
  }
}

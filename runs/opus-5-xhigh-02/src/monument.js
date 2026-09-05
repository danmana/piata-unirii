// Zone B - the Matthias Corvinus / Matei Corvin monumental ensemble and the small
// Roman Napoca archaeological window sunk into the paving beside it.
// Both are built on the 0.15 m grid, the finest tier in the scene.

import { MONUMENT, ROMAN_WINDOW } from './layout.js';
import { P } from './palette.js';
import { hash3, Rng } from './rng.js';

// Aged bronze with patina drift, keyed off position so it never flickers.
function bronzeAt(x, y, z) {
  const h = hash3(Math.round(x * 3), Math.round(y * 3), Math.round(z * 3));
  if (h > 0.955) return P.bronzePatina2;
  if (h > 0.875) return P.bronzePatina;
  if (h > 0.46) return P.bronzeMid;
  if (h > 0.17) return P.bronzeDark;
  return P.bronzeWarm;
}

function bbox(b, x0, y0, z0, x1, y1, z1) {
  const vs = b.vs;
  for (let y = y0; y < y1 - 1e-6; y += vs) {
    for (let z = z0; z < z1 - 1e-6; z += vs) {
      b.box(x0, y, z, x1, y + vs, z + vs, bronzeAt(x0, y, z));
    }
  }
}

const FONT = {
  M: ['101', '111', '111', '101', '101'],
  A: ['010', '101', '111', '101', '101'],
  T: ['111', '010', '010', '010', '010'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  S: ['111', '100', '111', '001', '111'],
  R: ['110', '101', '110', '101', '101'],
  E: ['111', '100', '111', '100', '111'],
  X: ['101', '101', '010', '101', '101'],
  ' ': ['000', '000', '000', '000', '000'],
};

/** Blocky incised lettering on a south-facing (+Z) pedestal panel. */
function inscribe(b, text, cx, y0, z, cell, mat) {
  const w = text.length * 4 * cell - cell;
  let x = cx - w / 2;
  for (const ch of text) {
    const g = FONT[ch] || FONT[' '];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (g[r][c] !== '1') continue;
        b.box(x + c * cell, y0 + (4 - r) * cell, z, x + (c + 1) * cell, y0 + (5 - r) * cell, z + cell * 0.9, mat);
      }
    }
    x += 4 * cell;
  }
}

/** A standing bronze retainer: articulated legs, torso, arms, head, and a weapon. */
function figure(b, o) {
  const { x, z } = o;
  const face = o.face ?? 0;            // yaw: 0 = facing -X (west)
  const s = o.scale ?? 1;
  const y = o.y ?? 0;
  const fx = Math.cos(face), fz = Math.sin(face);
  const rx = -fz, rz = fx;             // right vector
  const at = (fwd, side, y0, y1, hw, hd) => {
    const px = x + fx * fwd + rx * side, pz = z + fz * fwd + rz * side;
    bbox(b, px - hw, y + y0 * s, pz - hd, px + hw, y + y1 * s, pz + hd);
  };
  // legs (slightly apart, one advanced)
  at(0.10 * s, -0.20 * s, 0.00, 0.95, 0.15 * s, 0.15 * s);
  at(-0.08 * s, 0.20 * s, 0.00, 0.95, 0.15 * s, 0.15 * s);
  // boots
  at(0.20 * s, -0.20 * s, 0.00, 0.16, 0.19 * s, 0.19 * s);
  at(0.02 * s, 0.20 * s, 0.00, 0.16, 0.19 * s, 0.19 * s);
  // torso and shoulders
  at(0, 0, 0.95, 1.60, 0.26 * s, 0.38 * s);
  at(0, 0, 1.52, 1.68, 0.28 * s, 0.48 * s);
  // arms
  at(0.06 * s, -0.44 * s, 0.95, 1.58, 0.12 * s, 0.12 * s);
  at(0.06 * s, 0.44 * s, 0.95, 1.58, 0.12 * s, 0.12 * s);
  // head + helm
  at(0, 0, 1.68, 1.98, 0.16 * s, 0.16 * s);
  at(0, 0, 1.96, 2.12, 0.20 * s, 0.20 * s);
  if (o.plume) at(0, 0, 2.12, 2.34, 0.07 * s, 0.07 * s);

  const px = (fwd, side) => [x + fx * fwd + rx * side, z + fz * fwd + rz * side];
  if (o.weapon === 'spear') {
    const [ax, az] = px(0.10 * s, -0.56 * s);
    bbox(b, ax - 0.06, y, az - 0.06, ax + 0.06, y + 3.05 * s, az + 0.06);
    bbox(b, ax - 0.10, y + 3.05 * s, az - 0.06, ax + 0.10, y + 3.42 * s, az + 0.06);
  } else if (o.weapon === 'banner') {
    const [ax, az] = px(0.14 * s, -0.56 * s);
    bbox(b, ax - 0.06, y, az - 0.06, ax + 0.06, y + 3.3 * s, az + 0.06);
    // cloth hanging from the pole
    for (let k = 0; k < 9; k++) {
      const yy = y + (2.30 + k * 0.11) * s;
      const wgt = 0.9 - Math.abs(k - 4) * 0.06;
      bbox(b, ax + 0.06, yy, az - 0.05, ax + 0.06 + wgt * s, yy + 0.11 * s, az + 0.05);
    }
  } else if (o.weapon === 'axe') {
    const [ax, az] = px(0.16 * s, 0.56 * s);
    bbox(b, ax - 0.06, y + 0.35 * s, az - 0.06, ax + 0.06, y + 2.15 * s, az + 0.06);
    bbox(b, ax - 0.30, y + 1.75 * s, az - 0.05, ax + 0.06, y + 2.15 * s, az + 0.05);
  } else if (o.weapon === 'shield') {
    const [ax, az] = px(0.34 * s, -0.46 * s);
    for (let yy = 0.55; yy < 1.75; yy += b.vs) {
      const t = (yy - 0.55) / 1.2;
      const hw = 0.36 * s * Math.sqrt(Math.max(0.05, 1 - Math.pow(t * 2 - 1, 4)));
      bbox(b, ax - 0.07, y + yy * s, az - hw, ax + 0.07, y + (yy + b.vs) * s, az + hw);
    }
  }
  if (o.cloak) {
    at(-0.32 * s, 0, 0.55, 1.66, 0.10 * s, 0.44 * s);
  }
}

export function buildMonument(b) {
  const M = MONUMENT;
  const S = P.ashlar, SD = P.plinth, SL = P.whiteStone;
  const cx = M.centre[0], cz = M.centre[1];

  // ---- stepped stone base ---------------------------------------------------
  const steps = [
    { g: 3.0, y0: 0.0, y1: 0.34, m: SD },
    { g: 2.0, y0: 0.34, y1: 0.68, m: S },
    { g: 1.0, y0: 0.68, y1: 1.02, m: SD },
  ];
  for (const s of steps) {
    b.box(M.pedestal.x0 - s.g, s.y0, M.pedestal.z0 - s.g, M.pedestal.x1 + s.g, s.y1, M.pedestal.z1 + s.g, s.m);
  }

  // ---- pedestal -------------------------------------------------------------
  b.box(M.pedestal.x0, 1.02, M.pedestal.z0, M.pedestal.x1, 1.72, M.pedestal.z1, S);
  b.box(M.pedestal.x0 + 0.3, 1.72, M.pedestal.z0 + 0.3, M.pedestal.x1 - 0.3, 2.05, M.pedestal.z1 - 0.3, SL);
  // main die, faintly battered
  const dieY0 = 2.05, dieY1 = 4.85;
  for (let y = dieY0; y < dieY1; y += 0.15) {
    const t = (y - dieY0) / (dieY1 - dieY0);
    const inset = 0.75 + t * 0.22;
    b.box(M.pedestal.x0 + inset, y, M.pedestal.z0 + inset, M.pedestal.x1 - inset, y + 0.15, M.pedestal.z1 - inset,
      ((y * 6.6) | 0) % 4 === 0 ? P.ashlarDark : S);
  }
  // recessed panels on all four faces
  const dx0 = M.pedestal.x0 + 0.95, dx1 = M.pedestal.x1 - 0.95;
  const dz0 = M.pedestal.z0 + 0.95, dz1 = M.pedestal.z1 - 0.95;
  b.carve(dx0 + 1.1, 2.5, dz1 - 0.22, dx1 - 1.1, 4.4, dz1 + 0.02);
  b.carve(dx0 + 1.1, 2.5, dz0 - 0.02, dx1 - 1.1, 4.4, dz0 + 0.22);
  b.carve(dx0 - 0.02, 2.5, dz0 + 0.8, dx0 + 0.22, 4.4, dz1 - 0.8);
  b.carve(dx1 - 0.22, 2.5, dz0 + 0.8, dx1 + 0.02, 4.4, dz1 - 0.8);
  inscribe(b, 'MATHIAS REX', cx, 3.05, dz1 - 0.24, 0.21, P.bronzeWarm);
  inscribe(b, 'MATHIAS REX', cx, 3.05, dz0 - 0.02, 0.21, P.bronzeWarm);

  // cornice and the top plinth the horse stands on
  b.box(M.pedestal.x0 + 0.4, 4.85, M.pedestal.z0 + 0.4, M.pedestal.x1 - 0.4, 5.20, M.pedestal.z1 - 0.4, SL);
  b.box(M.pedestal.x0 + 0.15, 5.20, M.pedestal.z0 + 0.15, M.pedestal.x1 - 0.15, 5.45, M.pedestal.z1 - 0.15, SD);
  b.box(M.pedestal.x0 + 1.6, 5.45, M.pedestal.z0 + 1.5, M.pedestal.x1 - 1.6, M.pedestalTop, M.pedestal.z1 - 1.5, S);

  // ---- the horse ------------------------------------------------------------
  const py = M.pedestalTop;         // top of pedestal
  const hz = cz;                    // horse centreline
  const legTop = py + 1.62;
  // legs: near fore advanced, off hind trailing - a standing, weight-bearing pose
  const legs = [
    [cx - 3.9, hz - 0.55, 0.24], [cx - 3.7, hz + 0.55, 0.24],
    [cx + 1.5, hz - 0.55, 0.26], [cx + 1.85, hz + 0.55, 0.26],
  ];
  for (const [lx, lz, r] of legs) {
    bbox(b, lx - r, py, lz - r, lx + r, py + 0.24, lz + r);       // hoof
    bbox(b, lx - r * 0.72, py + 0.2, lz - r * 0.72, lx + r * 0.72, legTop, lz + r * 0.72);
  }
  // barrel
  bbox(b, cx - 4.3, legTop - 0.15, hz - 0.72, cx + 2.3, py + 3.05, hz + 0.72);
  bbox(b, cx - 4.5, legTop + 0.35, hz - 0.62, cx - 3.6, py + 3.0, hz + 0.62);   // chest
  bbox(b, cx + 1.9, legTop + 0.2, hz - 0.66, cx + 2.65, py + 2.95, hz + 0.66);  // haunch
  // neck rising forward
  for (let k = 0; k < 9; k++) {
    const t = k / 8;
    const nx = cx - 4.35 - t * 1.25;
    const ny = py + 2.55 + t * 1.55;
    const hw = 0.52 - t * 0.16;
    bbox(b, nx - 0.42, ny, hz - hw, nx + 0.42, ny + 0.42, hz + hw);
  }
  // head and muzzle
  bbox(b, cx - 6.35, py + 3.95, hz - 0.34, cx - 5.35, py + 4.72, hz + 0.34);
  bbox(b, cx - 6.95, py + 3.72, hz - 0.28, cx - 5.9, py + 4.22, hz + 0.28);
  bbox(b, cx - 5.85, py + 4.72, hz - 0.30, cx - 5.5, py + 5.02, hz - 0.06);   // ears
  bbox(b, cx - 5.85, py + 4.72, hz + 0.06, cx - 5.5, py + 5.02, hz + 0.30);
  // mane
  for (let k = 0; k < 10; k++) {
    const t = k / 9;
    const nx = cx - 4.4 - t * 1.6, ny = py + 2.95 + t * 1.5;
    bbox(b, nx - 0.22, ny, hz - 0.18, nx + 0.22, ny + 0.55, hz + 0.18);
  }
  // tail
  for (let k = 0; k < 8; k++) {
    const t = k / 7;
    bbox(b, cx + 2.5 + t * 0.5, py + 2.75 - t * 1.9, hz - 0.22, cx + 2.9 + t * 0.5, py + 3.05 - t * 1.7, hz + 0.22);
  }
  // saddle cloth
  bbox(b, cx - 2.6, py + 2.85, hz - 0.86, cx + 0.7, py + 3.15, hz + 0.86);
  bbox(b, cx - 2.2, py + 2.05, hz - 0.90, cx + 0.4, py + 2.95, hz - 0.72);
  bbox(b, cx - 2.2, py + 2.05, hz + 0.72, cx + 0.4, py + 2.95, hz + 0.90);

  // ---- the king -------------------------------------------------------------
  const kx = cx - 1.35, ky = py + 3.15;
  bbox(b, kx - 0.45, ky, hz - 0.36, kx + 0.45, ky + 1.05, hz + 0.36);          // torso
  bbox(b, kx - 0.55, ky + 0.95, hz - 0.52, kx + 0.55, ky + 1.20, hz + 0.52);   // pauldrons
  bbox(b, kx - 0.24, ky + 1.20, hz - 0.24, kx + 0.24, ky + 1.62, hz + 0.24);   // head
  bbox(b, kx - 0.32, ky + 1.58, hz - 0.32, kx + 0.32, ky + 1.80, hz + 0.32);   // crown band
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    bbox(b, kx + Math.cos(a) * 0.24 - 0.08, ky + 1.80, hz + Math.sin(a) * 0.24 - 0.08,
      kx + Math.cos(a) * 0.24 + 0.08, ky + 2.02, hz + Math.sin(a) * 0.24 + 0.08);
  }
  // thighs down the horse's flanks
  bbox(b, kx - 0.55, ky - 0.85, hz - 0.98, kx + 0.35, ky + 0.10, hz - 0.70);
  bbox(b, kx - 0.55, ky - 0.85, hz + 0.70, kx + 0.35, ky + 0.10, hz + 0.98);
  bbox(b, kx - 0.85, ky - 1.15, hz - 1.02, kx - 0.35, ky - 0.75, hz - 0.66);   // boots in stirrups
  bbox(b, kx - 0.85, ky - 1.15, hz + 0.66, kx - 0.35, ky - 0.75, hz + 1.02);
  // reins arm forward, sword arm raised behind
  bbox(b, kx - 1.35, ky + 0.55, hz - 0.62, kx - 0.35, ky + 0.90, hz - 0.36);
  bbox(b, kx + 0.20, ky + 0.70, hz + 0.40, kx + 0.62, ky + 1.35, hz + 0.72);
  // upheld sword
  for (let k = 0; k < 22; k++) {
    const t = k / 21;
    const sx = kx + 0.45 + t * 0.95, sy = ky + 1.35 + t * 2.15;
    bbox(b, sx - 0.09, sy, hz + 0.46, sx + 0.09, sy + 0.14, hz + 0.66);
  }
  bbox(b, kx + 0.28, ky + 1.28, hz + 0.36, kx + 0.72, ky + 1.44, hz + 0.78);  // guard
  // cloak over the rump
  for (let k = 0; k < 12; k++) {
    const t = k / 11;
    bbox(b, kx + 0.55 + t * 1.5, ky + 1.0 - t * 2.6, hz - 0.72, kx + 0.95 + t * 1.5, ky + 1.15 - t * 2.4, hz + 0.72);
  }

  // ---- four bronze retainers around the base --------------------------------
  const bx0 = M.pedestal.x0, bx1 = M.pedestal.x1;
  figure(b, { x: bx0 - 2.05, z: cz - 2.9, y: 1.02, face: Math.PI, scale: 1.06, weapon: 'shield', plume: true, cloak: true });
  figure(b, { x: bx0 - 2.05, z: cz + 2.9, y: 1.02, face: Math.PI, scale: 1.06, weapon: 'banner', cloak: true });
  figure(b, { x: cx + 1.5, z: M.pedestal.z1 + 2.05, y: 1.02, face: -Math.PI / 2, scale: 1.02, weapon: 'spear', plume: true });
  figure(b, { x: cx + 1.5, z: M.pedestal.z0 - 2.05, y: 1.02, face: Math.PI / 2, scale: 1.02, weapon: 'axe' });

  // trophies of arms leaning on the pedestal corners
  const rng = new Rng('monument-props');
  for (const [tx, tz] of [[bx0 - 0.6, M.pedestal.z0 - 0.6], [bx0 - 0.6, M.pedestal.z1 + 0.6],
                          [bx1 + 0.6, M.pedestal.z0 - 0.6], [bx1 + 0.6, M.pedestal.z1 + 0.6]]) {
    bbox(b, tx - 0.5, 1.02, tz - 0.5, tx + 0.5, 1.35, tz + 0.5);
    for (let k = 0; k < 3; k++) {
      const a = rng.range(0, Math.PI * 2), lean = rng.range(0.25, 0.5);
      for (let s = 0; s < 10; s++) {
        const t = s / 9;
        bbox(b, tx + Math.cos(a) * lean * t - 0.07, 1.3 + t * 1.5, tz + Math.sin(a) * lean * t - 0.07,
          tx + Math.cos(a) * lean * t + 0.07, 1.3 + t * 1.5 + 0.2, tz + Math.sin(a) * lean * t + 0.07);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Roman Napoca archaeological window
// ---------------------------------------------------------------------------
export function buildRomanWindow(b) {
  const R = ROMAN_WINDOW;
  const d = -R.depth;
  const rng = new Rng('napoca');

  // dark metal frame flush with the paving
  b.box(R.x0 - 0.55, -0.1, R.z0 - 0.55, R.x1 + 0.55, 0.16, R.z0, P.ironDark);
  b.box(R.x0 - 0.55, -0.1, R.z1, R.x1 + 0.55, 0.16, R.z1 + 0.55, P.ironDark);
  b.box(R.x0 - 0.55, -0.1, R.z0, R.x0, 0.16, R.z1, P.ironDark);
  b.box(R.x1, -0.1, R.z0, R.x1 + 0.55, 0.16, R.z1, P.ironDark);
  // cross mullions in the glazing
  for (let x = R.x0 + 2.7; x < R.x1 - 0.5; x += 2.7) {
    b.box(x - 0.09, -0.05, R.z0, x + 0.09, 0.12, R.z1, P.ironDark);
  }
  // seating kerb around the rim
  b.box(R.x0 - 1.5, 0, R.z1 + 0.55, R.x1 + 1.5, 0.48, R.z1 + 1.5, P.greyStone);
  b.box(R.x0 - 1.5, 0.48, R.z1 + 0.55, R.x1 + 1.5, 0.56, R.z1 + 1.5, P.whiteStone);
  b.box(R.x0 - 1.5, 0, R.z0 - 1.5, R.x1 + 1.5, 0.48, R.z0 - 0.55, P.greyStone);
  b.box(R.x0 - 1.5, 0.48, R.z0 - 1.5, R.x1 + 1.5, 0.56, R.z0 - 0.55, P.whiteStone);

  // Roman masonry below: wall stubs, a hypocaust corner and a stretch of paving
  for (let x = R.x0 + 0.4; x < R.x1 - 0.4; x += 0.45) {
    for (let z = R.z0 + 0.4; z < R.z1 - 0.4; z += 0.45) {
      const t = rng.f();
      const m = t > 0.66 ? P.ashlarDark : (t > 0.33 ? P.greyStoneDark : P.plinth);
      b.box(x, d, z, x + 0.42, d + 0.16, z + 0.42, m);
    }
  }
  const wall = (x0, z0, x1, z1, h) => {
    for (let y = d + 0.16; y < d + h; y += 0.22) {
      const off = ((y * 5) | 0) % 2 ? 0.11 : 0;
      for (let x = x0 + off; x < x1; x += 0.44) {
        b.box(x, y, z0, Math.min(x + 0.40, x1), y + 0.20, z1, rng.f() > 0.5 ? P.ashlarDark : P.greyStoneDark);
      }
    }
  };
  wall(R.x0 + 1.1, R.z0 + 1.4, R.x1 - 3.6, R.z0 + 1.9, 1.0);
  wall(R.x0 + 1.1, R.z1 - 2.0, R.x1 - 5.0, R.z1 - 1.5, 0.85);
  for (let z = R.z0 + 1.9; z < R.z1 - 2.0; z += 0.44) {
    b.box(R.x0 + 1.1, d + 0.16, z, R.x0 + 1.6, d + 1.0, z + 0.40, P.greyStoneDark);
  }
  // column stubs
  for (const [ox, oz] of [[R.x1 - 2.6, R.z0 + 2.4], [R.x1 - 2.6, R.z1 - 2.6], [R.x1 - 5.2, R.z0 + 2.4]]) {
    b.cylY(ox, oz, 0.42, d + 0.16, d + 1.25, P.whiteStone);
    b.box(ox - 0.55, d + 0.16, oz - 0.55, ox + 0.55, d + 0.34, oz + 0.55, P.ashlar);
  }
  // warm under-glass lighting along the rim
  b.box(R.x0 + 0.1, d + 0.05, R.z0 + 0.1, R.x1 - 0.1, d + 0.22, R.z0 + 0.28, P.romanGlow);
  b.box(R.x0 + 0.1, d + 0.05, R.z1 - 0.28, R.x1 - 0.1, d + 0.22, R.z1 - 0.1, P.romanGlow);
  b.box(R.x0 + 0.05, -0.6, R.z0 + 0.05, R.x0 + 0.2, -0.4, R.z1 - 0.05, P.romanGlow);
  b.box(R.x1 - 0.2, -0.6, R.z0 + 0.05, R.x1 - 0.05, -0.4, R.z1 - 0.05, P.romanGlow);

  // the glass deck itself
  b.box(R.x0, 0.0, R.z0, R.x1, 0.1, R.z1, P.romanGlass);
}

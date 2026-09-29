// Matthias Corvinus Monumental Ensemble (János Fadrusz, 1902) — hero asset.
// Local frame: x along the church axis (horse faces -x, i.e. west), z = +south
// (the front, facing the square), y up from the plaza. Voxels of 8 cm.
// Stepped terrace, massive pale pedestal with "MATHIAS REX", bronze equestrian
// king in armour with crown, cloak and mace, and four bronze figures in front
// holding banners, sword, shield and spear.

import { VoxelGrid } from '../core/voxel.js';
import { MatTable, LAYER, FLAG, AIR } from '../core/mat.js';
import { noise3, hash01 } from '../core/rng.js';
import { BRONZE } from '../core/palette.js';
import { sdSphere, sdEllipsoid, sdCap, sdBox, smin, voxelizeSDF } from '../core/sdf.js';

export const MON = { vs: 0.08, pedTop: 6.35, horseZ: -1.1, hs: 1.28 };

const FONT = {
  M: ['101', '111', '101', '101', '101'], A: ['010', '101', '111', '101', '101'],
  T: ['111', '010', '010', '010', '010'], H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'], S: ['011', '100', '010', '001', '110'],
  R: ['110', '101', '110', '101', '101'], E: ['111', '100', '110', '100', '111'],
  X: ['101', '101', '010', '101', '101'], ' ': ['000', '000', '000', '000', '000'],
};

export function buildMonument() {
  const vs = MON.vs;
  const mats = new MatTable();
  const F = FLAG.FLOOD;
  const M = {
    granite: mats.stone('#b8b3a9', LAYER.stone, 0),
    granite2: mats.stone('#aca79d', LAYER.stone, 0),
    ped: mats.stone('#dcd5c6', LAYER.marble, F),
    ped2: mats.stone('#d0c8b7', LAYER.marble, F),
    pedDark: mats.stone('#b5ad9c', LAYER.marble, F),
    b: mats.bronze(BRONZE.dark, F),
    b2: mats.bronze(BRONZE.mid, F),
    pat: mats.bronze(BRONZE.patina, F),
    pat2: mats.bronze(BRONZE.patinaLight, F),
    hi: mats.bronze(BRONZE.highlight, F),
  };
  const g = new VoxelGrid(-6.9, 0, -4.3, 6.9, 12.4, 4.3, vs);
  g.boundary.ground = true;

  // ---- terrace steps
  g.box(-6.6, 0, -4.1, 6.6, 0.3, 4.1, M.granite);
  g.box(-6.2, 0.3, -3.7, 6.2, 0.6, 3.7, M.granite2);
  g.box(-5.8, 0.6, -3.3, 5.8, 0.9, 3.3, M.granite);
  // ---- pedestal
  const P = { x0: -3.2, x1: 3.2, z0: -2.9, z1: 0.7 };
  g.box(P.x0 - 0.35, 0.9, P.z0 - 0.35, P.x1 + 0.35, 1.25, P.z1 + 0.35, M.pedDark);
  g.box(P.x0 - 0.2, 1.25, P.z0 - 0.2, P.x1 + 0.2, 1.6, P.z1 + 0.2, M.ped2);
  g.box(P.x0, 1.6, P.z0, P.x1, 5.6, P.z1, M.ped);
  // recessed panels on the long faces
  for (const [za, zb] of [[P.z1 - 0.08, P.z1 + 0.01], [P.z0 - 0.01, P.z0 + 0.08]]) {
    g.box(P.x0 + 0.45, 2.1, za, P.x1 - 0.45, 5.1, zb, AIR);
  }
  g.box(P.x0 + 0.45, 2.1, P.z1 - 0.16, P.x1 - 0.45, 5.1, P.z1 - 0.08, M.ped2, 0);
  g.box(P.x0 + 0.45, 2.1, P.z0 + 0.08, P.x1 - 0.45, 5.1, P.z0 + 0.16, M.ped2, 0);
  // cornice
  g.box(P.x0 - 0.1, 5.6, P.z0 - 0.1, P.x1 + 0.1, 5.75, P.z1 + 0.1, M.pedDark);
  g.box(P.x0 - 0.2, 5.75, P.z0 - 0.2, P.x1 + 0.2, 5.9, P.z1 + 0.2, M.ped2);
  g.box(P.x0 - 0.35, 5.9, P.z0 - 0.35, P.x1 + 0.35, 6.1, P.z1 + 0.35, M.ped);
  g.box(P.x0 + 0.2, 6.1, P.z0 + 0.2, P.x1 - 0.2, MON.pedTop, P.z1 - 0.2, M.ped2);
  // inscription MATHIAS REX in bronze letters on the south face
  {
    const text = 'MATHIAS REX';
    const cw = 4 * vs * 1.25; // glyph cell (3 px + gap)
    const px = vs * 1.25;
    const total = text.length * cw - vs * 1.25;
    let x = -total / 2;
    const y0 = 4.05;
    for (const ch of text) {
      const gl = FONT[ch] || FONT[' '];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
        if (gl[r][c] !== '1') continue;
        const xx = x + c * px, yy = y0 - r * px;
        g.box(xx, yy, P.z1 - 0.16, xx + px, yy + px, P.z1 - 0.06, M.b);
      }
      x += cw;
    }
    // bronze wreath / raven cartouche above
    g.ellipsoid(0, 4.72, P.z1 - 0.12, 0.42, 0.3, 0.08, M.b2);
    g.box(-0.05, 4.62, P.z1 - 0.08, 0.05, 4.85, P.z1 + 0.02, M.hi);
  }
  // corner blocks at terrace front
  for (const s of [-1, 1]) {
    g.box(s * 5.8 - 0.35, 0.9, 2.2, s * 5.8 + 0.35, 1.5, 3.3, M.granite2);
  }

  // ---- equestrian group
  const hz = MON.horseZ, hy = MON.pedTop, hs = MON.hs;
  voxelizeSDF(g, -2.9 * hs, hy, hz - 0.9 * hs, 2.5 * hs, hy + 4.6 * hs, hz + 0.9 * hs, (x, y, z, out) => {
    out.m = M.b;
    return horseAndRider(x / hs, (y - hy) / hs, (z - hz) / hs, out, M) * hs;
  }, M.b);

  // ---- four figures in front
  const figs = [
    { x: -4.5, z: 1.6, turn: 0.25, kind: 'banner' },
    { x: -1.9, z: 1.75, turn: 0.05, kind: 'sword' },
    { x: 1.9, z: 1.75, turn: -0.05, kind: 'shield' },
    { x: 4.5, z: 1.6, turn: -0.25, kind: 'spear' },
  ];
  for (const f of figs) {
    g.box(f.x - 0.55, 0.9, f.z - 0.5, f.x + 0.55, 1.05, f.z + 0.5, M.b2);
    const s = 1.4;
    const c = Math.cos(f.turn), sn = Math.sin(f.turn);
    voxelizeSDF(g, f.x - 1.2, 1.05, f.z - 1.1, f.x + 1.2, 1.05 + 4.8, f.z + 1.1, (x, y, z, out) => {
      out.m = M.b;
      const lx = (x - f.x), lz = (z - f.z);
      const rx = c * lx - sn * lz, rz = sn * lx + c * lz;
      return figure(rx / s, (y - 1.05) / s, rz / s, f.kind, out, M) * s;
    }, M.b);
    if (f.kind === 'banner' || f.kind === 'spear') flag(g, M, f, s);
  }

  // ---- patina pass: green on upward faces and streaks
  g.fn(-6.9, 0.9, -4.3, 6.9, 12.4, 4.3, (x, y, z, cur) => {
    if (cur !== M.b && cur !== M.b2) return -1;
    const above = g.get(x, y + vs, z);
    const n = noise3(x * 1.7, y * 0.5, z * 1.7, 11);
    if (above === AIR && n > 0.55) return n > 0.72 ? M.pat2 : M.pat;
    if (n > 0.8) return M.pat;
    if (hash01(Math.floor(x / vs), Math.floor(y / vs), Math.floor(z / vs)) > 0.985) return M.hi;
    return -1;
  });
  return { grid: g, mats };
}

// Horse facing -x, hooves at y = 0, rider seated on top.
function horseAndRider(x, y, z, out, M) {
  // body
  let d = sdEllipsoid(x, y, z, 0.1, 1.95, 0, 1.2, 0.58, 0.47);
  d = smin(d, sdSphere(x, y, z, -0.92, 2.0, 0, 0.55), 0.3);
  d = smin(d, sdSphere(x, y, z, 1.02, 2.05, 0, 0.58), 0.3);
  // neck & head (head lowered, powerful arched neck)
  d = smin(d, sdCap(x, y, z, -1.0, 2.25, 0, -1.55, 3.1, 0, 0.36, 0.25), 0.2);
  d = smin(d, sdCap(x, y, z, -1.62, 3.25, 0, -2.1, 2.72, 0, 0.21, 0.14), 0.12);
  d = Math.min(d, sdCap(x, y, z, -1.6, 3.4, 0.09, -1.56, 3.62, 0.11, 0.05, 0.03));
  d = Math.min(d, sdCap(x, y, z, -1.6, 3.4, -0.09, -1.56, 3.62, -0.11, 0.05, 0.03));
  // mane
  const dm = sdCap(x, y, z, -0.95, 2.62, 0, -1.5, 3.36, 0, 0.12, 0.1);
  if (dm < d) { d = dm; out.m = M.b2; }
  // legs
  const leg = (ax, ay, az, kx, ky, kz, hx, hy, hz, r0, r1) => Math.min(
    sdCap(x, y, z, ax, ay, az, kx, ky, kz, r0, r1 * 1.2),
    sdCap(x, y, z, kx, ky, kz, hx, hy, hz, r1, r1 * 0.9),
    sdCap(x, y, z, hx, hy, hz, hx - 0.06, 0.02, hz, 0.12, 0.12));
  let dl = leg(-0.9, 1.7, 0.23, -1.32, 1.05, 0.25, -1.12, 0.55, 0.25, 0.2, 0.1); // raised foreleg (pawing)
  dl = Math.min(dl, leg(-0.88, 1.7, -0.23, -0.95, 0.85, -0.24, -0.95, 0.1, -0.24, 0.2, 0.1));
  dl = Math.min(dl, leg(1.05, 1.85, 0.24, 1.3, 0.95, 0.25, 1.14, 0.1, 0.25, 0.26, 0.11));
  dl = Math.min(dl, leg(1.05, 1.85, -0.24, 1.28, 0.95, -0.25, 1.16, 0.1, -0.25, 0.26, 0.11));
  d = smin(d, dl, 0.12);
  // tail
  const dt = Math.min(sdCap(x, y, z, 1.55, 2.25, 0, 1.85, 1.55, 0.05, 0.15, 0.12), sdCap(x, y, z, 1.85, 1.55, 0.05, 1.78, 0.75, 0.02, 0.12, 0.08));
  if (dt < d) { d = dt; out.m = M.b2; }
  // caparison / saddle cloth
  const dc = sdEllipsoid(x, y, z, 0.05, 1.98, 0, 0.75, 0.66, 0.53);
  if (dc < 0.02 && dc > -0.1 && y > 1.62 && d > -0.05) { out.m = M.b2; d = Math.min(d, dc); }

  // ---- rider
  let r = sdEllipsoid(x, y, z, 0.02, 2.68, 0, 0.32, 0.22, 0.3);
  r = smin(r, sdCap(x, y, z, 0.02, 2.75, 0, -0.04, 3.42, 0, 0.26, 0.3), 0.1);
  r = smin(r, sdCap(x, y, z, -0.05, 3.45, -0.3, -0.05, 3.45, 0.3, 0.15, 0.15), 0.08);
  r = Math.min(r, sdSphere(x, y, z, -0.05, 3.47, 0.33, 0.14), sdSphere(x, y, z, -0.05, 3.47, -0.33, 0.14));
  r = smin(r, sdCap(x, y, z, -0.05, 3.5, 0, -0.07, 3.7, 0, 0.1, 0.09), 0.05);
  r = Math.min(r, sdSphere(x, y, z, -0.08, 3.84, 0, 0.17));
  // legs astride
  for (const s of [-1, 1]) {
    r = Math.min(r, sdCap(x, y, z, 0.02, 2.62, s * 0.2, -0.36, 2.35, s * 0.47, 0.14, 0.12));
    r = Math.min(r, sdCap(x, y, z, -0.36, 2.35, s * 0.47, -0.26, 1.78, s * 0.47, 0.11, 0.09));
    r = Math.min(r, sdCap(x, y, z, -0.24, 1.74, s * 0.47, -0.42, 1.72, s * 0.47, 0.07, 0.06));
  }
  // left arm (south side) holding the reins
  r = Math.min(r, sdCap(x, y, z, -0.05, 3.4, 0.33, -0.2, 3.05, 0.4, 0.1, 0.09));
  r = Math.min(r, sdCap(x, y, z, -0.2, 3.05, 0.4, -0.55, 2.95, 0.18, 0.08, 0.07));
  // right arm resting the mace on the hip
  r = Math.min(r, sdCap(x, y, z, -0.05, 3.4, -0.33, 0.08, 3.05, -0.44, 0.1, 0.09));
  r = Math.min(r, sdCap(x, y, z, 0.08, 3.05, -0.44, -0.18, 2.88, -0.42, 0.08, 0.07));
  const mace = Math.min(sdCap(x, y, z, -0.18, 2.88, -0.42, 0.1, 3.72, -0.46, 0.04, 0.04), sdSphere(x, y, z, 0.12, 3.8, -0.46, 0.11));
  // reins
  const reins = sdCap(x, y, z, -0.55, 2.95, 0.18, -1.9, 3.0, 0.14, 0.025, 0.025);
  // cloak over the horse's rump
  const cl = sdEllipsoid(x, y, z, 0.38, 3.0, 0, 0.55, 0.7, 0.44);
  let cloak = Math.abs(cl) - 0.05;
  if (x < 0.06 || y < 2.45) cloak = 1;
  // crown
  let crown = 1;
  if (y > 3.95 && y < 4.12) {
    const rr = Math.hypot(x + 0.08, z);
    if (rr < 0.19 && rr > 0.1) crown = 0;
    if (y > 4.04) {
      const ang = Math.atan2(z, x + 0.08);
      if (Math.cos(ang * 5) < 0.4) crown = 1;
    }
  }
  if (crown <= 0) { out.m = M.hi; return -0.01; }
  let best = d;
  if (r < best) { best = r; out.m = M.b; }
  if (cloak < best) { best = cloak; out.m = M.b2; }
  if (mace < best) { best = mace; out.m = M.hi; }
  if (reins < best) { best = reins; out.m = M.b2; }
  return best;
}

// Standing figure, facing +z, feet at y=0, ~1.8 m tall (scaled by caller)
function figure(x, y, z, kind, out, M) {
  let d = 1e9;
  // legs
  const stance = kind === 'sword' ? 0.13 : 0.1;
  const fwd = kind === 'banner' ? 0.12 : 0.04;
  d = Math.min(d, sdCap(x, y, z, stance, 0.95, 0, stance + 0.02, 0.5, fwd, 0.085, 0.07));
  d = Math.min(d, sdCap(x, y, z, stance + 0.02, 0.5, fwd, stance, 0.07, fwd * 1.4, 0.07, 0.055));
  d = Math.min(d, sdCap(x, y, z, -stance, 0.95, 0, -stance, 0.5, -0.02, 0.085, 0.07));
  d = Math.min(d, sdCap(x, y, z, -stance, 0.5, -0.02, -stance, 0.07, -0.03, 0.07, 0.055));
  d = Math.min(d, sdCap(x, y, z, stance, 0.04, fwd * 1.4, stance, 0.04, fwd * 1.4 + 0.15, 0.05, 0.045));
  d = Math.min(d, sdCap(x, y, z, -stance, 0.04, -0.03, -stance, 0.04, 0.12, 0.05, 0.045));
  // armoured skirt + torso
  d = smin(d, sdCap(x, y, z, 0, 1.02, 0, 0, 0.72, 0, 0.19, 0.25), 0.05);
  d = smin(d, sdCap(x, y, z, 0, 1.0, 0, 0, 1.44, 0.01, 0.17, 0.2), 0.06);
  d = smin(d, sdCap(x, y, z, -0.21, 1.46, 0, 0.21, 1.46, 0, 0.09, 0.09), 0.05);
  d = Math.min(d, sdSphere(x, y, z, 0.24, 1.47, 0, 0.1), sdSphere(x, y, z, -0.24, 1.47, 0, 0.1));
  // head + helmet / cap
  d = smin(d, sdCap(x, y, z, 0, 1.5, 0, 0, 1.6, 0.01, 0.07, 0.065), 0.03);
  d = Math.min(d, sdSphere(x, y, z, 0, 1.69, 0.02, 0.105));
  let hat = sdSphere(x, y, z, 0, 1.73, 0.0, 0.12);
  if (y < 1.72) hat = 1;
  if (kind === 'spear' || kind === 'shield') hat = Math.min(hat, sdCap(x, y, z, 0, 1.82, -0.02, 0, 1.98, -0.12, 0.035, 0.02));
  // cloak behind
  let cloak = sdBox(x, y, z, 0, 1.0, -0.2, 0.26, 0.48, 0.03, 0.02);
  if (kind === 'sword') cloak = Math.min(cloak, sdBox(x, y, z, 0, 0.9, -0.24, 0.3, 0.55, 0.03, 0.02));
  // arms & held items
  let item = 1e9;
  const arm = (sx, ex, ey, ez, hx, hy, hz) => Math.min(
    sdCap(x, y, z, sx * 0.24, 1.44, 0, ex, ey, ez, 0.07, 0.06),
    sdCap(x, y, z, ex, ey, ez, hx, hy, hz, 0.06, 0.05));
  switch (kind) {
    case 'banner':
      d = Math.min(d, arm(1, 0.3, 1.2, 0.1, 0.12, 1.38, 0.24));
      d = Math.min(d, arm(-1, -0.28, 1.12, 0.12, -0.02, 1.05, 0.25));
      item = sdCap(x, y, z, 0.1, 0.05, 0.3, -0.35, 2.55, 0.18, 0.03, 0.03);
      break;
    case 'sword':
      d = Math.min(d, arm(1, 0.2, 1.15, 0.12, 0.03, 0.95, 0.24));
      d = Math.min(d, arm(-1, -0.2, 1.15, 0.12, -0.03, 0.95, 0.24));
      item = Math.min(sdCap(x, y, z, 0, 0.95, 0.26, 0, 0.1, 0.34, 0.03, 0.02), sdCap(x, y, z, -0.14, 0.85, 0.27, 0.14, 0.85, 0.27, 0.025, 0.025), sdCap(x, y, z, 0, 0.96, 0.26, 0, 1.08, 0.25, 0.025, 0.025));
      break;
    case 'shield':
      d = Math.min(d, arm(1, 0.34, 1.18, 0.12, 0.3, 1.0, 0.3));
      d = Math.min(d, arm(-1, -0.32, 1.2, 0.05, -0.36, 1.55, 0.12));
      item = Math.min(sdEllipsoid(x, y, z, 0.36, 0.92, 0.34, 0.06, 0.38, 0.27), sdCap(x, y, z, -0.36, 1.2, 0.12, -0.36, 2.05, 0.1, 0.028, 0.028), sdSphere(x, y, z, -0.36, 2.1, 0.1, 0.08));
      break;
    default: // spear
      d = Math.min(d, arm(1, 0.3, 1.18, 0.1, 0.3, 1.3, 0.2));
      d = Math.min(d, arm(-1, -0.28, 1.15, 0.12, -0.12, 1.02, 0.2));
      item = Math.min(sdCap(x, y, z, 0.3, 0.02, 0.22, 0.3, 2.75, 0.22, 0.03, 0.03), sdCap(x, y, z, 0.3, 2.75, 0.22, 0.3, 2.95, 0.22, 0.05, 0.01));
  }
  let best = d;
  out.m = M.b;
  if (cloak < best) { best = cloak; out.m = M.b2; }
  if (hat < best) { best = hat; out.m = M.hi; }
  if (item < best) { best = item; out.m = M.hi; }
  return best;
}

// Hanging banner cloth on the banner / spear figures (rasterised sheet)
function flag(g, M, f, s) {
  const c = Math.cos(f.turn), sn = Math.sin(f.turn);
  const toW = (lx, ly, lz) => {
    const X = lx * s, Z = lz * s;
    return [f.x + c * X + sn * Z, 1.05 + ly * s, f.z - sn * X + c * Z];
  };
  const big = f.kind === 'banner';
  const top = big ? [-0.33, 2.5, 0.18] : [0.3, 2.62, 0.22];
  const W = big ? 0.85 : 0.5, H = big ? 0.75 : 0.28;
  const step = g.vs * 0.45 / s;
  for (let u = 0; u <= W; u += step) {
    for (let v = 0; v <= H; v += step) {
      const wave = Math.sin(u * 7) * 0.05 + u * 0.12;
      const lx = top[0] + (big ? -u * 0.2 : -u * 0.9);
      const ly = top[1] - v - u * (big ? 0.18 : 0.05);
      const lz = top[2] + (big ? u * 0.95 : u * 0.1) + wave;
      if (!big && v > H * (1 - u / W)) continue; // pennant triangle
      const [X, Y, Z] = toW(lx, ly, lz);
      g.set(X, Y, Z, hash01(Math.floor(u * 40), Math.floor(v * 40)) > 0.8 ? M.pat : M.b2);
    }
  }
}

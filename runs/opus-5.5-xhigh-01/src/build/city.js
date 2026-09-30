// Simplified background houses for the outer historic centre (LOD 2 tier:
// larger voxels, simplified façades, pitched tiled roofs).

import { VoxelGrid } from '../core/voxel.js';
import { MatTable, POOL, LAYER, FLAG, shade } from '../core/mat.js';
import { RNG } from '../core/rng.js';
import { GLASS, GLASS_LIT } from '../core/palette.js';
import { Frame, roof, chimney } from './kit.js';

export function buildCityHouse(s) {
  const vs = s.vs;
  const mats = new MatTable();
  const rng = new RNG(s.seed >>> 0);
  const lr = new RNG(((s.varSeed ?? s.seed) ^ 0x5bd1e995) >>> 0);
  const wall = mats.plaster(s.wall);
  const trim = mats.stone(s.trim, LAYER.stone);
  const glass = mats.glass(GLASS);
  const glassLit = mats.glass(GLASS_LIT, FLAG.LIT);
  const shop = mats.glass('#34424c', FLAG.LIT);
  const roofM = s.roofMetal ? mats.metal(s.roof, LAYER.metalroof) : mats.roof(s.roof, LAYER.roof);
  const roofV = null;
  const chim = mats.plaster(shade(s.wall, 0.8));
  const cap = mats.stone('#86807a');
  const W = s.W, D = s.D;
  const n = s.floorsN;
  const g0 = s.g0 ?? 4.2, fh = s.fh ?? 3.6;
  const H = g0 + (n - 1) * fh;
  const pitch = s.pitch ?? 42;
  const tanP = Math.tan((pitch * Math.PI) / 180);
  const roofH = (D / 2 + vs) * tanP;
  const pad = vs;
  const g = new VoxelGrid(s.partyL ? 0 : -pad, 0, -pad, s.partyR ? W : W + pad, H + roofH + 2.5, D + pad, vs);
  g.boundary.party = { x0: s.partyL || 0, x0z0: 0, x0z1: D, x1: s.partyR || 0, x1z0: 0, x1z1: D };
  g.box(0, 0, 0, W, H, D, wall);
  const F = new Frame(g, 'front', 0);
  const Fr = new Frame(g, 'rear', D);
  const bays = Math.max(1, Math.round(W / (s.bayW ?? 3.3)));
  const bw = W / bays;
  const ww = Math.max(vs, Math.min(1.2, bw * 0.4));
  const lit = s.lit ?? 0.3;
  const win = (Fm, a, y0, h, l) => {
    const a0 = a - ww / 2, a1 = a + ww / 2;
    if (vs <= 0.5) {
      Fm.box(a0, y0, -vs, a1, y0 + h, 0.001, 0);
      Fm.box(a0, y0, -2 * vs, a1, y0 + h, -vs, l ? glassLit : glass);
      Fm.box(a0 - vs * 0.5, y0 - vs, 0, a1 + vs * 0.5, y0, vs, trim);
    } else {
      Fm.box(a0, y0, -vs, a1, y0 + h, 0.001, l ? glassLit : glass);
    }
  };
  // ground floor
  F.box(0, 0, 0, W, 0.8, vs, trim);
  for (let b = 0; b < bays; b++) {
    const a = (b + 0.5) * bw;
    if (s.shops && b % 2 === 0 && vs <= 0.5) {
      F.box(a - bw * 0.36, 0.5, -vs, a + bw * 0.36, g0 - 1.1, 0.001, 0);
      F.box(a - bw * 0.36, 0.5, -2 * vs, a + bw * 0.36, g0 - 1.1, -vs, shop);
    } else {
      win(F, a, 1.2, Math.min(2.0, g0 - 2.0), lr.chance(lit * 0.6));
    }
  }
  for (let f = 1; f < n; f++) {
    const y = g0 + (f - 1) * fh;
    for (let b = 0; b < bays; b++) {
      win(F, (b + 0.5) * bw, y + 0.9, Math.min(2.0, fh - 1.4), lr.chance(lit));
      if (vs <= 0.5 && rng.chance(0.6)) win(Fr, (b + 0.5) * bw, y + 1.0, Math.min(1.6, fh - 1.6), lr.chance(lit * 0.6));
    }
    if (vs <= 0.5 && s.strings) F.box(0, y, 0, W, y + vs, vs, trim);
  }
  // cornice
  F.box(0, H - vs, 0, W, H, vs * (vs <= 0.5 ? 2 : 1), trim);
  if (vs <= 0.5) F.box(0, H - 2 * vs, 0, W, H - vs, vs, trim);
  // corner side windows
  if (s.corner) {
    const Fs = new Frame(g, s.corner === 'L' ? 'left' : 'right', s.corner === 'L' ? 0 : W);
    const sb = Math.max(1, Math.round(D / 3.4));
    for (let f = 1; f < n; f++) {
      const y = g0 + (f - 1) * fh;
      for (let b = 0; b < sb; b++) win(Fs, (b + 0.5) * (D / sb), y + 0.9, Math.min(2.0, fh - 1.4), lr.chance(lit));
    }
  }
  const type = s.roofType || ((s.partyL && s.partyR) ? 'gable-x' : 'hip');
  const r = { x0: 0, x1: W, z0: 0, z1: D, y: H, pitch, type, ov: vs, ovx: (s.partyL || s.partyR) ? 0 : vs, mat: roofM, vary: roofV, seed: s.seed & 511 };
  if (type === 'gable-x') r.gableMat = wall;
  roof(g, r);
  const vr = new RNG((s.varSeed ?? s.seed) >>> 0);
  if (vr.chance(0.7)) {
    const cx = vr.range(1, W - 1), cz = vr.range(D * 0.35, D * 0.65);
    const surf = H + Math.min(cz, D - cz) * tanP;
    chimney(g, cx, cz, H, surf + 1.0, chim, cap);
  }
  return { grid: g, mats, height: H };
}

// Modern apartment block (distant background only)
export function buildBlock(s) {
  const vs = s.vs;
  const mats = new MatTable();
  const rng = new RNG(s.seed >>> 0);
  const wall = mats.plaster(s.wall, LAYER.plaster);
  const band = mats.plaster(shade(s.wall, 0.8));
  const glass = mats.glass('#3b4550');
  const glassLit = mats.glass('#3b4550', FLAG.LIT);
  const W = s.W, D = s.D, H = s.H;
  const g = new VoxelGrid(0, 0, 0, W, H + vs, D, vs);
  g.box(0, 0, 0, W, H, D, wall);
  const fl = 2.8;
  for (let y = 1.4; y < H - 1; y += fl) {
    for (const side of ['front', 'rear']) {
      const F = new Frame(g, side, side === 'front' ? 0 : D);
      for (let a = 1; a < W - 1; a += 2 * vs) {
        F.box(a, y, -vs, a + vs, y + 1.4, 0.001, rng.chance(s.lit ?? 0.25) ? glassLit : glass);
      }
      F.box(0, y - vs, -vs, W, y, 0.001, band, 2);
    }
  }
  g.box(0, H - vs, 0, W, H, D, band);
  return { grid: g, mats, height: H };
}

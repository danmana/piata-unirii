// Parametric historic townhouse / palace builder for the square's perimeter
// and the old-town streets. Local frame: u (=x) along the frontage, y up,
// d (=z) into the building; the street façade is the plane d = 0 facing -z.

import { VoxelGrid } from '../core/voxel.js';
import { MatTable, POOL, LAYER, FLAG, shade, AIR } from '../core/mat.js';
import { RNG } from '../core/rng.js';
import { GLASS, GLASS_LIT, ROOF } from '../core/palette.js';
import {
  Frame, windowAt, gateAt, shopfrontAt, stringCourse, cornice, pilaster, rusticate,
  quoins, balcony, balustrade, roof, chimney, dormer,
} from './kit.js';

export function facadeMats(mats, s) {
  const M = {
    wall: mats.plaster(s.wall),
    wallRear: mats.plaster(shade(s.wall, 0.92)),
    trim: mats.stone(s.trim, LAYER.stone),
    trim2: mats.stone(shade(s.trim, 0.93), LAYER.stone),
    base: mats.stone(s.base || shade(s.trim, 0.86), LAYER.rustic),
    glass: mats.glass(GLASS),
    glassLit: mats.glass(GLASS_LIT, FLAG.LIT),
    shopGlass: mats.glass('#34424c'),
    shopLit: mats.glass('#38454f', FLAG.LIT),
    frame: mats.get(POOL.paint, '#3a342e', LAYER.wood),
    door: mats.get(POOL.paint, s.door || '#4b3627', LAYER.wood),
    rail: mats.metal('#2a2a2a', LAYER.plain),
    roof: s.roofMetal ? mats.metal(s.roof, LAYER.metalroof) : mats.roof(s.roof, LAYER.roof),
    roofVar: s.roofMetal ? null : [mats.roof(shade(s.roof, 0.86), LAYER.roof), mats.roof(shade(s.roof, 1.08), LAYER.roof)],
    metal: mats.metal(s.metalRoof || ROOF.slate, LAYER.metalroof),
    chimney: mats.plaster(shade(s.wall, 0.82)),
    chimCap: mats.stone('#8b857c'),
    brick: mats.get(POOL.terracotta, '#9a5a44', LAYER.brick),
    sign: [],
  };
  const signCols = s.signs || ['#3d4a3c', '#5a2e2a', '#2f3b4c', '#6b5a3a', '#2d2d2d', '#7a3e2c'];
  for (const c of signCols) M.sign.push(mats.get(POOL.paint, c, LAYER.paint));
  M.awnings = (s.awnings || ['#7a2f2a', '#3f5a45', '#cfc6b0', '#5b4a3c', '#2f4058']).map((c) => mats.fabric(c));
  return M;
}

function sum(a) { let s = 0; for (const v of a) s += v; return s; }

export function buildFacade(s) {
  const vs = s.vs;
  const mats = new MatTable();
  const M = facadeMats(mats, s);
  const rng = new RNG(s.seed >>> 0);
  const lr = new RNG(((s.varSeed ?? s.seed) ^ 0x5bd1e995) >>> 0);
  const W = s.W, D = s.D;
  const floors = s.floors;
  const H = sum(floors);
  const pitch = s.pitch ?? 45;
  const tanP = Math.tan((pitch * Math.PI) / 180);
  const mansard = s.roofType === 'mansard' || s.roofType === 'mansard-hip';
  const roofH = mansard ? 5.2 : (D / 2 + vs) * tanP;
  const rear = s.rear || null;
  const Dtot = D + (rear ? rear.d : 0);
  const extraTop = (s.attic === 'secession' || s.attic === 'gable' || (s.risalit && s.risalit.top === 'attic')) ? 3.5 : 0;
  const xMin = s.partyL ? 0 : (s.corner === 'L' ? -1.6 : -0.7);
  const xMax = s.partyR ? W : (s.corner === 'R' ? W + 1.6 : W + 0.7);
  const g = new VoxelGrid(xMin, 0, -2.2, xMax, H + Math.max(roofH, extraTop) + 3.2, Dtot + 0.7, vs);
  g.boundary.ground = true;
  g.boundary.party = {
    x0: s.partyL || 0, x0z0: 0, x0z1: s.partyLD ?? D,
    x1: s.partyR || 0, x1z0: 0, x1z1: s.partyRD ?? D,
  };

  const bays = Math.max(1, s.bays);
  const bayW = W / bays;
  const ris = s.risalit || null;
  const rA0 = ris ? ris.b0 * bayW : 0, rA1 = ris ? (ris.b1 + 1) * bayW : 0;
  const plane = (a) => (ris && a >= rA0 && a < rA1 ? -ris.proj : 0);

  // ---- massing
  g.box(0, 0, 0, W, H, D, M.wall);
  if (rear) g.box(rear.a0, 0, D, rear.a1, rear.h, D + rear.d, M.wallRear);
  if (ris) g.box(rA0, 0, -ris.proj, rA1, H, 0, M.wall);

  const F0 = new Frame(g, 'front', 0);
  const segs = ris ? [[0, rA0, 0], [rA0, rA1, -ris.proj], [rA1, W, 0]].filter((q) => q[1] - q[0] > 0.01) : [[0, W, 0]];
  const FR = (p) => F0.at(p);

  const plinth = s.plinth ?? 0.6;
  const g0 = floors[0];
  // ---- ground floor
  const gtype = s.ground || 'shops';
  for (const [a0, a1, p] of segs) {
    const F = FR(p);
    F.box(a0, 0, 0, a1, plinth, vs, M.base);
    if (gtype === 'rustic' || s.rusticGround) rusticate(F, M, a0, a1, plinth, g0 - 0.35, M.base, 0.55);
  }
  const gateBay = s.gateBay ?? -1;
  const shopSigns = M.sign, awn = M.awnings;
  for (let b = 0; b < bays; b++) {
    const a = (b + 0.5) * bayW;
    const F = FR(plane(a));
    if (b === gateBay) {
      const gw = Math.min(bayW - 0.7, s.gateW || 3.2);
      gateAt(F, M, a, 0, gw, Math.min(g0 - 0.4, s.gateH || 4.2), { voussoirs: s.style !== 'renaissance', ringMat: M.trim });
      continue;
    }
    if (gtype === 'shops') {
      const w = Math.max(1.2, bayW - (s.pier ?? 0.9));
      shopfrontAt(F, M, a, plinth * 0.4, w, g0 - plinth * 0.4 - 1.25, {
        sign: rng.chance(0.75) ? rng.pick(shopSigns) : null,
        awning: s.awning && rng.chance(0.55) ? rng.pick(awn) : null,
        lit: lr.chance(0.8),
      });
    } else if (gtype === 'arcade') {
      // handled below
    } else {
      const wh = Math.min(2.0, g0 - plinth - 1.3);
      windowAt(F, M, a, plinth + 0.5, Math.min(s.winW ?? 1.2, bayW - 0.6), wh, {
        head: gtype === 'rustic' ? 'arch' : (s.style === 'renaissance' ? 'flat' : 'cornice'), lit: lr.chance(s.lit ?? 0.3),
        surround: gtype !== 'rustic',
      });
    }
  }
  if (gtype === 'arcade') {
    const ad = s.arcadeDepth ?? 3.2;
    g.box(0.01, 0, 0, W - 0.01, g0 - 0.05, ad, AIR);
    // back wall with doors
    const Fb = FR(ad);
    for (let b = 0; b < bays; b++) {
      const a = (b + 0.5) * bayW;
      if (b % 2 === 0) shopfrontAt(Fb, M, a, 0, bayW - 1.1, g0 - 1.6, { lit: lr.chance(0.7) });
      else windowAt(Fb, M, a, 0.9, 1.2, 2.0, { head: 'flat', lit: lr.chance(0.4) });
    }
    // columns ("the house with legs")
    const colR = s.colR ?? 0.42;
    for (let b = 0; b <= bays; b++) {
      const a = Math.min(W - colR - 0.05, Math.max(colR + 0.05, b * bayW));
      g.cylY(a, colR + 0.1, colR, 0.3, g0 - 0.55, M.trim);
      g.box(a - colR - 0.12, 0, 0.1 - 0.12, a + colR + 0.12, 0.35, 2 * colR + 0.22, M.trim);
      g.box(a - colR - 0.18, g0 - 0.6, 0.1 - 0.18, a + colR + 0.18, g0 - 0.3, 2 * colR + 0.28, M.trim);
    }
    // architrave
    g.box(0, g0 - 0.3, -vs, W, g0, 1.4, M.trim);
    g.box(0, 0, 0, W, 0.12, ad, M.base, 1);
  }

  // ---- upper floors
  let y = g0;
  const lit = s.lit ?? 0.3;
  for (let f = 1; f < floors.length; f++) {
    const fh = floors[f];
    const head = (s.heads && s.heads[f]) || s.head || 'flat';
    const wh = (s.winH && s.winH[f]) || Math.min(fh - 1.4, 2.3);
    const sill = y + (s.sillH ?? 0.85);
    for (let b = 0; b < bays; b++) {
      const a = (b + 0.5) * bayW;
      const p = plane(a);
      const F = FR(p);
      if (s.blankBays && s.blankBays.includes(b)) continue;
      const inRis = ris && a >= rA0 && a < rA1;
      const hh = inRis && ris.head && f === 1 ? ris.head : head;
      const onBalc = s.balcony && s.balcony.floor === f && b >= s.balcony.b0 && b <= s.balcony.b1;
      windowAt(F, M, a, onBalc ? y + 0.05 : sill, Math.min(s.winW ?? 1.25, bayW - 0.55), onBalc ? wh + sill - y - 0.05 : wh, {
        head: hh, lit: lr.chance(lit), mullion: s.mullions !== false, apron: s.aprons && f === 1,
      });
    }
    // string course at floor line
    if (s.strings !== false) for (const [a0, a1, p] of segs) stringCourse(FR(p), M, a0, a1, y + (f === 1 ? 0.05 : 0), f === 1 ? 2 : 1);
    y += fh;
  }

  // ---- pilasters / quoins
  const topY = H - (s.cornice === 'rich' ? 1.7 : 0.9);
  if (s.pilasters === 'bays') {
    for (let b = 1; b < bays; b++) {
      const a = b * bayW;
      pilaster(FR(plane(a + 0.01)), M, a, g0, topY, Math.min(0.6, bayW * 0.18));
    }
  } else if (s.pilasters === 'giant' && ris) {
    for (let b = ris.b0; b <= ris.b1 + 1; b++) {
      const a = Math.min(rA1 - 0.3, Math.max(rA0 + 0.3, b * bayW));
      pilaster(FR(-ris.proj), M, a, g0, topY, 0.7);
    }
  }
  if (s.quoins) {
    if (!s.partyL || s.corner === 'L') quoins(FR(0), M, 0, g0, topY, 1, M.trim);
    if (!s.partyR || s.corner === 'R') quoins(FR(0), M, W, g0, topY, -1, M.trim);
    if (ris) {
      quoins(FR(-ris.proj), M, rA0, g0, topY, 1, M.trim);
      quoins(FR(-ris.proj), M, rA1, g0, topY, -1, M.trim);
    }
  }

  // ---- balconies
  if (s.balcony) {
    const bc = s.balcony;
    let yb = g0;
    for (let f = 1; f < bc.floor; f++) yb += floors[f];
    const a0 = bc.b0 * bayW + 0.25, a1 = (bc.b1 + 1) * bayW - 0.25;
    balcony(FR(plane((a0 + a1) / 2)), M, a0, a1, yb + 0.05, bc.depth ?? 1.0, { balustrade: bc.stone });
  }
  if (s.balconies) {
    // small iron balconies on individual windows of a given floor
    let yb = g0;
    for (let f = 1; f < s.balconies.floor; f++) yb += floors[f];
    for (const b of s.balconies.bays) {
      const a = (b + 0.5) * bayW;
      const w = Math.min(s.winW ?? 1.25, bayW - 0.55) + 0.7;
      balcony(FR(plane(a)), M, a - w / 2, a + w / 2, yb + 0.05, 0.7, {});
    }
  }

  // ---- cornice and roofline
  const cst = s.cornice || 'simple';
  for (const [a0, a1, p] of segs) cornice(FR(p), M, a0, a1, H, cst);
  if (ris && ris.top === 'pediment') {
    const F = FR(-ris.proj);
    const half = (rA1 - rA0) / 2, ac = (rA0 + rA1) / 2;
    const ph = half * Math.tan((ris.pitch ?? 24) * Math.PI / 180);
    F.fn(rA0 - vs, H, -0.001, rA1 + vs, H + ph + vs, 2 * vs, (A, Y, N) => {
      const lim = half * (1 - (Y - H) / ph);
      const d = Math.abs(A - ac);
      if (d > lim + vs) return -1;
      if (N < vs) return d > lim - vs * 1.2 ? M.trim : M.wall;
      return d > lim - vs * 1.2 ? M.trim : -1;
    });
    // oculus / cartouche
    F.box(ac - 0.5, H + ph * 0.25, 0, ac + 0.5, H + ph * 0.25 + 0.8, vs, M.trim2);
  } else if (ris && (ris.top === 'attic' || ris.top === 'segment')) {
    const F = FR(-ris.proj);
    const ah = ris.top === 'attic' ? 1.6 : 2.4;
    const ac = (rA0 + rA1) / 2, half = (rA1 - rA0) / 2;
    F.fn(rA0, H, -0.001, rA1, H + ah, vs, (A, Y) => {
      if (ris.top === 'segment') {
        const t = (A - ac) / half;
        if (Y - H > ah * Math.sqrt(Math.max(0, 1 - t * t)) + 0.4) return -1;
      }
      return M.wall;
    });
    g.box(rA0, H, -ris.proj, rA1, H + ah - 0.2, 1.4, M.wall, 1);
    F.box(rA0 - vs, H + ah - vs, 0, rA1 + vs, H + ah, vs * 2, M.trim, 0);
    if (ris.top === 'segment') {
      F.fn(rA0 - vs, H, 0, rA1 + vs, H + ah + 0.4 + vs, 2 * vs, (A, Y) => {
        const t = (A - ac) / (half + vs);
        const top = H + ah * Math.sqrt(Math.max(0, 1 - t * t)) + 0.4;
        return Y <= top && Y > top - vs * 1.2 ? M.trim : -1;
      });
    }
    F.box(ac - 0.7, H + 0.3, 0, ac + 0.7, H + ah - 0.4, vs, M.trim2);
  }
  if (s.attic === 'balustrade') {
    for (const [a0, a1, p] of segs) balustrade(FR(p), M, a0 + 0.1, a1 - 0.1, H, 0.9, M.trim, -2 * vs);
  } else if (s.attic === 'parapet') {
    for (const [a0, a1, p] of segs) {
      FR(p).box(a0, H, -vs, a1, H + 0.8, 1.0, M.wall);
      FR(p).box(a0 - vs, H + 0.8, -vs, a1 + vs, H + 0.8 + vs, 1.0, M.trim);
    }
  } else if (s.attic === 'secession' || s.attic === 'gable') {
    // curved central gable (Secession / Baroque volute gable)
    const gw = Math.min(W * 0.55, 9), ac = W / 2, gh = s.attic === 'gable' ? 3.2 : 2.6;
    const F = FR(plane(ac));
    F.fn(ac - gw / 2, H, -0.001, ac + gw / 2, H + gh + 0.5, 0.9, (A, Y) => {
      const t = (A - ac) / (gw / 2);
      let top;
      if (s.attic === 'secession') top = H + gh * Math.sqrt(Math.max(0, 1 - t * t));
      else top = H + gh * (1 - Math.abs(t) ** 1.6) + (Math.abs(t) > 0.55 ? 0.35 * Math.sin((Math.abs(t) - 0.55) * 14) : 0);
      return Y <= top ? M.wall : -1;
    });
    F.fn(ac - gw / 2 - vs, H, 0, ac + gw / 2 + vs, H + gh + 0.8, vs, (A, Y, N, c) => {
      if (c !== AIR) return -1;
      const t = (A - ac) / (gw / 2 + vs);
      let top;
      if (s.attic === 'secession') top = H + (gh + vs) * Math.sqrt(Math.max(0, 1 - t * t));
      else top = H + (gh + vs) * (1 - Math.abs(t) ** 1.6) + (Math.abs(t) > 0.55 ? 0.35 * Math.sin((Math.abs(t) - 0.55) * 14) : 0);
      return Y <= top && Y > top - vs * 1.5 ? M.trim : -1;
    });
    // round window
    F.fn(ac - 0.6, H + 0.4, -vs, ac + 0.6, H + 1.6, 0.001, (A, Y) => ((A - ac) ** 2 + (Y - H - 1.0) ** 2 < 0.36 ? M.glass : -1));
  }

  // ---- side façade for corner buildings
  for (const side of ['L', 'R']) {
    if (s.corner !== side) continue;
    const Fs = new Frame(g, side === 'L' ? 'left' : 'right', side === 'L' ? 0 : W);
    const sb = Math.max(1, Math.round(D / (bayW > 2.5 ? bayW : 3.4)));
    const sw = D / sb;
    Fs.box(0, 0, 0, D, plinth, vs, M.base);
    let yy = g0;
    for (let f = 1; f < floors.length; f++) {
      for (let b = 0; b < sb; b++) {
        windowAt(Fs, M, (b + 0.5) * sw, yy + 0.85, Math.min(1.2, sw - 0.6), Math.min(floors[f] - 1.4, 2.2), {
          head: s.head || 'flat', lit: lr.chance(lit), mullion: s.mullions !== false,
        });
      }
      if (s.strings !== false) stringCourse(Fs, M, 0, D, yy, 1);
      yy += floors[f];
    }
    for (let b = 0; b < sb; b++) {
      if (gtype === 'shops' && b < 2) shopfrontAt(Fs, M, (b + 0.5) * sw, plinth * 0.4, sw - 1.0, g0 - plinth * 0.4 - 1.25, { sign: rng.pick(shopSigns), lit: true });
      else windowAt(Fs, M, (b + 0.5) * sw, plinth + 0.6, 1.1, Math.min(1.9, g0 - plinth - 1.4), { head: 'flat', lit: lr.chance(0.3) });
    }
    cornice(Fs, M, 0, D, H, cst);
    if (s.quoins) quoins(Fs, M, D, g0, topY, -1, M.trim);
  }

  // ---- rear façade (courtyard side) – simple
  const Fr = new Frame(g, 'rear', D);
  {
    const rb = Math.max(1, Math.round(W / 3.2));
    const rw = W / rb;
    let yy = g0;
    for (let f = 1; f < floors.length; f++) {
      for (let b = 0; b < rb; b++) {
        const a = (b + 0.5) * rw;
        if (rear && a > rear.a0 - 0.6 && a < rear.a1 + 0.6) continue;
        windowAt(Fr, M, a, yy + 0.9, 1.0, Math.min(1.8, floors[f] - 1.5), { head: 'none', surround: false, sill: false, lit: lr.chance(lit * 0.8) });
      }
      yy += floors[f];
    }
  }
  if (rear) {
    // windows on the rear wing's open side and end
    const wingSide = rear.a0 < W / 2 ? 'right' : 'left';
    const Fw = new Frame(g, wingSide, wingSide === 'right' ? rear.a1 : rear.a0);
    const nb = Math.max(1, Math.round(rear.d / 3.3));
    let yy = 0;
    const rf = rear.floors || [rear.h];
    for (let f = 0; f < rf.length; f++) {
      for (let b = 0; b < nb; b++) {
        windowAt(Fw, M, D + (b + 0.5) * (rear.d / nb), yy + (f === 0 ? 0.9 : 0.85), 1.0, Math.min(1.7, rf[f] - 1.5), {
          head: 'none', surround: false, sill: false, lit: lr.chance(lit * 0.7),
        });
      }
      yy += rf[f];
    }
  }

  // ---- roof
  const ptype = s.roofType || ((s.partyL && s.partyR) ? 'gable-x' : 'hip');
  let ridge;
  const roofSpec = {
    x0: 0, x1: W, z0: 0, z1: D, y: H, pitch, ov: vs, ovx: (s.partyL || s.partyR) ? 0 : vs,
    mat: mansard ? M.metal : M.roof, mat2: mansard ? (s.mansardTopTiles ? M.roof : M.metal) : M.roof,
    vary: M.roofVar, seed: s.seed & 1023,
  };
  if (ptype === 'gable-x') roofSpec.gableMat = M.wall;
  roofSpec.type = ptype;
  if (mansard) { roofSpec.breakH = s.breakH ?? 3.0; roofSpec.capH = 5.0; }
  ridge = roof(g, roofSpec);
  if (ris && ris.proj > 0.05) {
    // the projecting centre gets its own roof piece
    roof(g, { x0: rA0, x1: rA1, z0: -ris.proj, z1: D * 0.5, y: H, pitch, type: 'gable-z', ov: vs, mat: roofSpec.mat, onlyEmpty: true, maxH: ridge - H });
  }
  if (rear) {
    roof(g, { x0: rear.a0, x1: rear.a1, z0: D - 0.5, z1: D + rear.d, y: rear.h, pitch: 38, type: 'gable-z', ov: vs, ovx: vs, mat: M.roof, vary: M.roofVar, seed: 7, onlyEmpty: true });
  }

  // ---- dormers & chimneys (rooftop detail; varies with the variation seed)
  const vr = new RNG((s.varSeed ?? s.seed) >>> 0);
  const nd = s.dormers ?? 0;
  if (nd > 0) {
    const used = new Set();
    for (let i = 0; i < nd; i++) {
      let b = vr.int(0, bays - 1);
      if (used.has(b)) continue;
      used.add(b);
      const a = (b + 0.5) * bayW;
      if (mansard) {
        dormer(g, M, a, 0.2, H + 0.3, 1.2, 1.9, -1, { wall: M.trim, roof: M.metal, lit: vr.chance(lit) });
      } else {
        const yb = H + 0.9;
        const zf = (yb - H) / tanP + 0.1;
        if (zf < D / 2 - 1.5) dormer(g, M, a, zf, yb, 1.3, 1.6, -1, { wall: M.wall, roof: M.roof, lit: vr.chance(lit) });
      }
    }
  }
  const nc = s.chimneys ?? vr.int(1, 3);
  for (let i = 0; i < nc; i++) {
    const cx = vr.range(0.8, W - 0.8);
    const cz = vr.range(D * 0.3, D * 0.7);
    const surf = mansard ? H + 5.0 : H + Math.min(cz, D - cz) * tanP;
    if (surf - H < 0.8) continue;
    chimney(g, cx, cz, H, surf + vr.range(0.7, 1.5), vr.chance(0.4) ? M.brick : M.chimney, M.chimCap);
  }
  return { grid: g, mats, height: H, ridge };
}

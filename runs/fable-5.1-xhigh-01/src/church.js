// St. Michael's Church (Biserica Sfântul Mihail) — LOD 0 hero asset at 0.25 m voxels.
// Hall church with an enormous steep tile roof, articulated buttresses, pointed windows,
// polygonal 5/8 choir, monumental west portal and the single 80 m neo-Gothic NW tower.
import { Model } from './voxel.js';
import { CHURCH } from './layout.js';

const SQRT3 = Math.sqrt(3);

/** Point-in-pointed-arch test (equilateral arch). */
export function pointedArch(cx, hw, ys) {
  const r = 2 * hw;
  return (x, y) => {
    const dx = x - cx;
    if (Math.abs(dx) > hw) return false;
    if (y <= ys) return true;
    const dy = y - ys;
    const a = dx - hw, b = dx + hw;
    return a * a + dy * dy <= r * r && b * b + dy * dy <= r * r;
  };
}
export const archApex = (hw, ys) => ys + hw * SQRT3;

export function roundArch(cx, hw, ys) {
  return (x, y) => {
    const dx = x - cx;
    if (Math.abs(dx) > hw) return false;
    if (y <= ys) return true;
    const dy = y - ys;
    return dx * dx + dy * dy <= hw * hw;
  };
}

/**
 * Gothic window cut into a wall.
 * axis: 'z' for walls running east-west (face normal along z), 'x' for north-south walls.
 * face: coordinate of the outer wall plane; sign: outward normal (+1/-1).
 * c: centre along the wall; hw: half width; y0: sill; ys: springing height.
 */
export function gothicWindow(model, M, axis, face, sign, c, hw, y0, ys, opts = {}) {
  const depth = opts.depth ?? 1.0;
  const glassDepth = opts.glassDepth ?? 0.75;
  const frame = opts.frame ?? 0.25;
  const apex = archApex(hw, ys);
  const inner = pointedArch(c, hw, ys);
  const outer = pointedArch(c, hw + frame, ys);
  const along = (x, z) => (axis === 'z' ? x : z);
  const perp = (x, z) => (axis === 'z' ? z : x);
  const inDepth = (p, d0, d1) => {
    const t = (face - p) * sign; // distance inward from the face
    return t >= d0 && t < d1;
  };
  const bbox = (d0, d1) => {
    const lo = Math.min(face - sign * d0, face - sign * d1);
    const hi = Math.max(face - sign * d0, face - sign * d1);
    return axis === 'z'
      ? [c - hw - frame - 0.3, y0 - frame - 0.3, lo, c + hw + frame + 0.3, apex + frame + 0.6, hi]
      : [lo, y0 - frame - 0.3, c - hw - frame - 0.3, hi, apex + frame + 0.6, c + hw + frame + 0.3];
  };
  // dark jamb stone lining the recess
  let b = bbox(-0.01, depth + 0.01);
  model.shape(...b, (x, y, z) => outer(along(x, z), y) && inDepth(perp(x, z), 0, depth), M.jamb);
  // opening
  b = bbox(-0.3, glassDepth);
  model.shape(...b, (x, y, z) => inner(along(x, z), y) && inDepth(perp(x, z), -0.3, glassDepth), 0);
  // glass
  b = bbox(glassDepth - 0.01, glassDepth + 0.26);
  model.shape(...b, (x, y, z) => inner(along(x, z), y) && inDepth(perp(x, z), glassDepth, glassDepth + 0.25), opts.glass ?? M.glass);
  // tracery in the glass plane: mullion(s), transom, Y-branches
  const gp0 = face - sign * glassDepth;
  const gp1 = face - sign * (glassDepth + 0.25);
  const lo = Math.min(gp0, gp1), hi = Math.max(gp0, gp1);
  const mullions = opts.mullions ?? (hw > 1.2 ? [c - hw / 2, c + hw / 2] : [c]);
  const boxA = (a0, y0b, a1, y1b, mat) => {
    if (axis === 'z') model.box(a0, y0b, lo, a1, y1b, hi, mat);
    else model.box(lo, y0b, a0, hi, y1b, a1, mat);
  };
  for (const m of mullions) boxA(m - 0.125, y0, m + 0.125, ys + hw * 0.45, M.tracery);
  if (opts.transom !== false) boxA(c - hw, y0 + (ys - y0) * 0.5, c + hw, y0 + (ys - y0) * 0.5 + 0.25, M.tracery);
  // arch head: cusped circle suggestion
  const headY = ys + hw * 0.95;
  model.shape(...bbox(glassDepth - 0.01, glassDepth + 0.26), (x, y, z) => {
    if (!inDepth(perp(x, z), glassDepth, glassDepth + 0.25)) return false;
    const a = along(x, z);
    const d = Math.hypot(a - c, y - headY);
    const ring = Math.abs(d - hw * 0.42) < 0.14;
    const spokes = d < hw * 0.42 && (Math.abs(a - c) < 0.13 || Math.abs(y - headY) < 0.13);
    return inner(a, y) && (ring || spokes);
  }, M.tracery);
  // hood mould above the arch (thin protruding stone)
  model.shape(...bbox(-0.26, 0.01), (x, y, z) => {
    if (!inDepth(perp(x, z), -0.25, 0)) return false;
    const a = along(x, z);
    return pointedArch(c, hw + frame + 0.25, ys)(a, y) && !pointedArch(c, hw + frame, ys)(a, y) && y > ys - 0.5;
  }, M.trim);
  // sill
  model.shape(...bbox(-0.3, 0.01), (x, y, z) => inDepth(perp(x, z), -0.3, 0) && Math.abs(along(x, z) - c) <= hw + frame + 0.25 && y >= y0 - 0.5 && y < y0 - 0.25 + 0.01, M.trim);
}

/** Stepped Gothic buttress against a wall face. */
export function buttress(model, M, axis, face, sign, c, w, stages, opts = {}) {
  // stages: [{ y1, proj }] from the ground upward; each stage ends with a sloped cap.
  let y0 = opts.y0 ?? -1;
  const along = (a0, a1, y0b, y1b, d0, d1) => {
    const lo = Math.min(face + sign * d0, face + sign * d1);
    const hi = Math.max(face + sign * d0, face + sign * d1);
    if (axis === 'z') model.box(a0, y0b, lo, a1, y1b, hi, M.stone);
    else model.box(lo, y0b, a0, hi, y1b, a1, M.stone);
  };
  for (let i = 0; i < stages.length; i++) {
    const { y1, proj } = stages[i];
    const nextProj = i + 1 < stages.length ? stages[i + 1].proj : 0;
    along(c - w / 2, c + w / 2, y0, y1, -0.5, proj);
    // sloped cap from proj down to nextProj, rising 45 degrees
    const capH = Math.max(0.5, proj - nextProj);
    for (let k = 0; k * 0.25 < capH; k++) {
      const yk = y1 + k * 0.25;
      const pk = proj - k * 0.25;
      if (pk <= nextProj) break;
      along(c - w / 2, c + w / 2, yk, yk + 0.25, nextProj - 0.01, pk);
    }
    y0 = y1;
  }
  if (opts.pinnacle) {
    const top = stages[stages.length - 1].y1;
    const p = opts.pinnacle;
    const cxz = face + sign * (stages[stages.length - 1].proj / 2 - 0.1);
    const cx = axis === 'z' ? c : cxz;
    const cz = axis === 'z' ? cxz : c;
    model.box(cx - 0.5, top, cz - 0.5, cx + 0.5, top + p * 0.45, cz + 0.5, M.stone);
    model.cone(cx, cz, 0.62, 0.05, top + p * 0.45, top + p, M.stone, 4, Math.PI / 4);
  }
}

export function buildChurch(world) {
  const P = world.palette;
  const M = {
    stone: P.get('#d4cab4', 'stone'),
    stoneLow: P.get('#bfb39b', 'stone'),
    tower: P.get('#cdc4ae', 'stone'),
    trim: P.get('#e4dcc9', 'stone'),
    tracery: P.get('#e9e2d2', 'stone'),
    jamb: P.get('#8f8674', 'stone'),
    dark: P.get('#3a352e', 'dark'),
    glass: P.get('#20262e', 'glassDark'),
    roof: P.get('#b04a2a', 'roof'),
    roofA: P.get('#a4442a', 'roof'),
    roofB: P.get('#bc5432', 'roof'),
    ridge: P.get('#6f2f1c', 'roof'),
    spire: P.get('#cbc2ac', 'stone'),
    spireRib: P.get('#5d554a', 'stone'),
    clockFace: P.get('#f4efe3', 'stone'),
    clockDark: P.get('#25221e', 'dark'),
    gold: P.get('#d0a84e', 'metal'),
    door: P.get('#4a3320', 'wood'),
    lead: P.get('#5a5f66', 'metal'),
  };
  const C = CHURCH;
  const baseY = Math.round(world.groundHeightAt((C.x0 + C.x1) / 2, (C.z0 + C.z1) / 2) / 0.25) * 0.25;
  world.flattenGround(C.towerX0 - 2, C.z0 - 2, C.x1 + C.apseLen + 3, C.z1 + 2, baseY);

  const model = new Model(P);
  const body = model.addGrid([C.x0 - 2.5, -1.5, C.z0 - 3.5], [C.x1 + C.apseLen + 4.5, C.ridgeH + 3.5, C.z1 + 5], 0.25);
  const tower = model.addGrid([C.towerX0 - 1.5, -1.5, C.towerZ0 - 1.5], [C.towerX1 + 1.5, C.towerH + 3, C.towerZ1 + 1.5], 0.25);
  body.solidBelow = tower.solidBelow = true;

  const cz = (C.z0 + C.z1) / 2;
  const halfW = (C.z1 - C.z0) / 2;
  const wallH = C.wallH;
  const ridgeH = C.ridgeH;

  // ---- hall body ----
  model.box(C.x0, -1.5, C.z0, C.x1, wallH, C.z1, M.stone);
  // plinth
  model.box(C.x0 - 0.5, -1.5, C.z0 - 0.5, C.x1 + 0.5, 1.25, C.z1 + 0.5, M.stoneLow);
  // cornice under eaves
  model.box(C.x0 - 0.5, wallH - 0.75, C.z0 - 0.5, C.x1 + 0.5, wallH, C.z1 + 0.5, M.trim);

  // ---- main roof: steep gable, ridge along x ----
  const overhang = 0.75;
  const roofHalf = halfW + overhang;
  const slope = (ridgeH - wallH) / roofHalf;
  const roofSurface = (z) => wallH - 0.25 + (roofHalf - Math.abs(z - cz)) * slope;
  const roofX0 = C.x0 + 1.25; // behind the west gable wall
  const roofX1 = C.x1 + 0.5;
  model.shape(roofX0, wallH - 0.5, cz - roofHalf, roofX1, ridgeH + 0.5, cz + roofHalf, (x, y, z) => {
    const top = roofSurface(z);
    return y <= top && y > top - 6; // thick shell; interior stays hidden
  }, M.roof);
  // tile course variation (rows along the slope) and ridge
  model.paint(roofX0, wallH - 0.5, cz - roofHalf, roofX1, ridgeH + 0.5, cz + roofHalf, (x, y, z, cur) => {
    if (cur !== M.roof) return 0;
    const row = Math.floor(y / 0.5);
    const v = ((row * 7919 + 13) % 11);
    if (y > ridgeH - 0.5) return M.ridge;
    return v < 3 ? M.roofA : v > 8 ? M.roofB : 0;
  });
  // small roof dormers (ventilation) along both slopes
  for (let i = 0; i < 4; i++) {
    const dx = C.x0 + 12 + i * 15;
    for (const s of [-1, 1]) {
      const dzc = cz + s * (roofHalf * 0.45);
      const yb = roofSurface(dzc) - 0.5;
      model.box(dx - 0.9, yb, dzc - 0.9, dx + 0.9, yb + 1.6, dzc + 0.9, M.stone);
      model.box(dx - 0.5, yb + 0.4, dzc + s * 0.9 - 0.2, dx + 0.5, yb + 1.2, dzc + s * 0.9 + 0.3, M.dark);
      model.cone(dx, dzc, 1.2, 0.1, yb + 1.6, yb + 2.7, M.roofA, 4, Math.PI / 4);
    }
  }

  // ---- west gable wall + monumental portal ----
  model.shape(C.x0 - 0.5, wallH - 0.5, C.z0 - 0.5, C.x0 + 1.25, ridgeH + 0.6, C.z1 + 0.5, (x, y, z) => y <= roofSurface(z) + 0.6, M.stone);
  // gable pinnacle at the apex and rose window in the gable field
  model.cone(C.x0 + 0.4, cz, 0.7, 0.05, ridgeH + 0.5, ridgeH + 3.2, M.stone, 4, Math.PI / 4);
  model.shape(C.x0 - 0.6, 28, cz - 2.2, C.x0 + 1.0, 32.6, cz + 2.2, (x, y, z) => Math.hypot(y - 30.3, z - cz) <= 2.0, M.jamb);
  model.shape(C.x0 - 0.6, 28, cz - 2.2, C.x0 + 0.75, 32.6, cz + 2.2, (x, y, z) => {
    const d = Math.hypot(y - 30.3, z - cz);
    if (d > 1.7) return false;
    const ang = Math.atan2(y - 30.3, z - cz);
    const spoke = Math.abs(Math.sin(ang * 4)) < 0.22;
    return !(spoke || Math.abs(d - 0.9) < 0.15);
  }, M.glass);
  // great west window above the portal
  gothicWindow(model, M, 'x', C.x0, -1, cz, 2.6, 12.5, 20.5, { depth: 1.25, glassDepth: 1.0, mullions: [cz - 1.7, cz - 0.55, cz + 0.55, cz + 1.7] });
  // portal: projecting gabled porch with deep pointed doorway
  const porchD = 2.25;
  model.box(C.x0 - porchD, -1.5, cz - 5.5, C.x0 + 0.5, 11.5, cz + 5.5, M.stone);
  model.shape(C.x0 - porchD - 0.25, 11.5, cz - 6, C.x0 + 0.5, 17.5, cz + 6, (x, y, z) => y - 11.5 <= (6 - Math.abs(z - cz)) * 1.0, M.stone);
  model.shape(C.x0 - porchD - 0.5, 11.25, cz - 6.2, C.x0 + 0.5, 18, cz + 6.2, (x, y, z) => {
    const g = (6.2 - Math.abs(z - cz)) * 1.0;
    return y - 11.25 <= g && y - 11.25 > g - 0.55 && y > 11.25;
  }, M.trim);
  // stepped jambs into the doorway
  for (let k = 0; k < 4; k++) {
    const hw = 2.6 - k * 0.45;
    const ys = 6.5 - k * 0.3;
    const arch = pointedArch(cz, hw, ys);
    const d0 = k * 0.5;
    model.shape(C.x0 - porchD - 0.3 + d0, -0.5, cz - 3, C.x0 - porchD + d0 + 0.5, archApex(hw, ys) + 0.5, cz + 3, (x, y, z) => arch(z, y), k === 3 ? M.door : M.jamb);
  }
  // door leaf detail and gable niche statue
  model.box(C.x0 - porchD + 1.75, 0, cz - 0.15, C.x0 - porchD + 2.05, 5.5, cz + 0.15, M.dark);
  figure(model, M.trim, C.x0 - porchD + 0.6, 12.6, cz, 2.2, Math.PI);

  // ---- south portal (mid nave) ----
  const spx = -14;
  model.box(spx - 3.5, -1.5, C.z1 - 0.5, spx + 3.5, 8.5, C.z1 + 2.0, M.stone);
  model.shape(spx - 3.75, 8.5, C.z1 - 0.5, spx + 3.75, 13.5, C.z1 + 2.25, (x, y, z) => y - 8.5 <= (3.75 - Math.abs(x - spx)) * 1.15, M.stone);
  model.shape(spx - 3.9, 8.25, C.z1 - 0.5, spx + 3.9, 13.75, C.z1 + 2.4, (x, y, z) => {
    const g = (3.9 - Math.abs(x - spx)) * 1.15;
    return y - 8.25 <= g && y - 8.25 > g - 0.5 && y > 8.25;
  }, M.trim);
  for (let k = 0; k < 3; k++) {
    const hw = 1.8 - k * 0.4;
    const ys = 4.6 - k * 0.25;
    const arch = pointedArch(spx, hw, ys);
    model.shape(spx - 2.2, -0.5, C.z1 + 2.0 - k * 0.5 - 0.5, spx + 2.2, archApex(hw, ys) + 0.5, C.z1 + 2.3 - k * 0.5, (x, y, z) => arch(x, y), k === 2 ? M.door : M.jamb);
  }
  model.box(spx - 0.15, 0, C.z1 + 0.55, spx + 0.15, 4.2, C.z1 + 0.85, M.dark);

  // ---- buttresses & windows along north and south walls ----
  const bays = 9;
  const bayW = (C.x1 - C.x0) / bays;
  const stages = [{ y1: 6.5, proj: 2.5 }, { y1: 12.5, proj: 1.75 }, { y1: wallH - 0.5, proj: 1.0 }];
  for (let k = 0; k <= bays; k++) {
    const bx = C.x0 + k * bayW;
    const w = k === 0 || k === bays ? 2.0 : 1.75;
    const px = Math.min(Math.max(bx, C.x0 + w / 2), C.x1 - w / 2);
    // south
    buttress(model, M, 'z', C.z1, 1, px, w, stages, { pinnacle: 3.2 });
    // north (skip where the tower stands)
    if (px > C.towerX1 + 1.5) buttress(model, M, 'z', C.z0, -1, px, w, stages, { pinnacle: 3.2 });
  }
  for (let k = 0; k < bays; k++) {
    const wx = C.x0 + (k + 0.5) * bayW;
    if (Math.abs(wx - spx) > 4.5) gothicWindow(model, M, 'z', C.z1, 1, wx, 1.4, 5.0, 13.0, { glass: M.glass });
    else gothicWindow(model, M, 'z', C.z1, 1, wx, 1.4, 9.5, 13.6, { glass: M.glass, transom: false });
    if (wx > C.towerX1 + 4) gothicWindow(model, M, 'z', C.z0, -1, wx, 1.4, 5.0, 13.0, { glass: M.glass });
  }
  // corner buttresses on the west face
  buttress(model, M, 'x', C.x0, -1, C.z1 - 1.0, 2.0, stages, { pinnacle: 3.2 });

  // ---- choir / apse (5/8 polygon) with lower roof ----
  const ax0 = C.x1;
  const apseC = ax0 + 3.0;
  const aHalf = C.apseHalfW;
  const apseWallH = 16.0;
  model.box(ax0 - 0.5, -1.5, cz - aHalf, apseC, apseWallH, cz + aHalf, M.stone);
  model.cone(apseC, cz, aHalf - 0.15, aHalf - 0.15, -1.5, apseWallH, M.stone, 8, 0);
  model.cone(apseC, cz, aHalf + 0.35, aHalf + 0.35, -1.5, 1.25, M.stoneLow, 8, 0);
  model.box(ax0 - 0.5, -1.5, cz - aHalf - 0.5, apseC, 1.25, cz + aHalf + 0.5, M.stoneLow);
  model.cone(apseC, cz, aHalf + 0.35, aHalf + 0.35, apseWallH - 0.75, apseWallH, M.trim, 8, 0);
  model.box(ax0 - 0.5, apseWallH - 0.75, cz - aHalf - 0.5, apseC, apseWallH, cz + aHalf + 0.5, M.trim);
  // apse roof: pyramid over the octagon plus wedge to the nave
  model.cone(apseC, cz, aHalf + 0.9, 0.3, apseWallH - 0.25, apseWallH + 12.5, M.roof, 8, 0);
  model.shape(ax0 - 0.75, apseWallH - 0.5, cz - aHalf - 0.9, apseC + 0.1, apseWallH + 13, cz + aHalf + 0.9, (x, y, z) => {
    const s = 12.75 / (aHalf + 0.9);
    return y <= apseWallH - 0.25 + (aHalf + 0.9 - Math.abs(z - cz)) * s;
  }, M.roof);
  model.paint(ax0 - 1, apseWallH - 0.5, cz - aHalf - 1, apseC + aHalf + 1.5, apseWallH + 13, cz + aHalf + 1, (x, y, z, cur) => {
    if (cur !== M.roof) return 0;
    const row = Math.floor(y / 0.5);
    const v = ((row * 7919 + 13) % 11);
    return v < 3 ? M.roofA : v > 8 ? M.roofB : 0;
  });
  // east gable of the nave above the choir roof
  model.shape(C.x1 - 1.25, wallH - 0.5, C.z0 - 0.5, C.x1 + 0.5, ridgeH + 0.6, C.z1 + 0.5, (x, y, z) => y <= roofSurface(z) + 0.6, M.stone);
  model.cone(C.x1 - 0.4, cz, 0.7, 0.05, ridgeH + 0.5, ridgeH + 3.2, M.stone, 4, Math.PI / 4);
  // apse buttresses at the polygon corners and windows in each facet
  const facetR = aHalf - 0.15; // inscribed radius
  for (let k = -2; k <= 2; k++) {
    const angCorner = ((k + 0.5) * 45) * Math.PI / 180; // corner directions at 22.5 + n*45
    const angFacet = (k * 45) * Math.PI / 180;
    if (k > -2) {
      // corner buttress: radial stepped box at the polygon vertex
      const R = facetR / Math.cos(Math.PI / 8);
      const dirx = Math.cos(angCorner), dirz = Math.sin(angCorner);
      for (const [y0b, y1b, len] of [[-1.5, 6.5, 2.4], [6.5, 12.5, 1.7], [12.5, apseWallH - 0.5, 1.0]]) {
        radialBox(model, apseC, cz, angCorner, R - 1.0, R + len, 0.8, y0b, y1b, M.stone);
        // sloped cap
        for (let q = 0; q < 6; q++) {
          const p = len - q * 0.25;
          if (p <= 0.3) break;
          radialBox(model, apseC, cz, angCorner, R - 1.0, R + p, 0.8, y1b + q * 0.25, y1b + (q + 1) * 0.25, M.stone);
        }
      }
      const px = apseC + dirx * (R + 0.2), pz = cz + dirz * (R + 0.2);
      model.box(px - 0.45, apseWallH - 0.5, pz - 0.45, px + 0.45, apseWallH + 1.0, pz + 0.45, M.stone);
      model.cone(px, pz, 0.6, 0.05, apseWallH + 1.0, apseWallH + 3.2, M.stone, 4, angCorner);
    }
    // window on the facet
    const fx = apseC + Math.cos(angFacet) * facetR;
    const fz = cz + Math.sin(angFacet) * facetR;
    apseWindow(model, M, fx, fz, angFacet, 1.1, 4.5, 11.5);
  }
  // sacristy annex on the north side of the choir
  model.box(C.x1 - 3, -1.5, C.z0 - 6, C.x1 + 6.5, 8.5, C.z0 + 1, M.stone);
  model.shape(C.x1 - 3.5, 8.25, C.z0 - 6.5, C.x1 + 7, 12.5, C.z0 + 0.5, (x, y, z) => y - 8.25 <= (C.z0 + 0.5 - z) * 0.62, M.roofA);
  for (const wx of [C.x1 - 1, C.x1 + 2.5]) gothicWindow(model, M, 'z', C.z0 - 6, -1, wx, 0.7, 2.5, 5.5, { depth: 0.75, glassDepth: 0.5, transom: false, mullions: [wx] });

  // ---- the great NW tower ----
  buildTower(model, M, C);

  // register the model with world (transform: identity + base height)
  world.addModel(model, { x: 0, y: baseY, z: 0, rot: 0 }, { hero: true });
  world.landmarks.church = { baseY };
}

/** Box aligned with a radial direction from (cx,cz): radial extent r0..r1, tangential half-width hw. */
function radialBox(model, cx, cz, ang, r0, r1, hw, y0, y1, mat) {
  const nx = Math.cos(ang), nz = Math.sin(ang);
  const R = Math.max(Math.abs(r0), Math.abs(r1)) + hw + 0.5;
  model.shape(cx - R, y0, cz - R, cx + R, y1, cz + R, (x, y, z) => {
    const dx = x - cx, dz = z - cz;
    const r = dx * nx + dz * nz;
    const t = -dx * nz + dz * nx;
    return r >= r0 && r <= r1 && Math.abs(t) <= hw;
  }, mat);
}

/** Window in an angled apse facet (normal at angle `ang` in the xz plane). */
function apseWindow(model, M, fx, fz, ang, hw, y0, ys) {
  const nx = Math.cos(ang), nz = Math.sin(ang); // outward normal
  const tx = -nz, tz = nx; // tangent
  const apex = archApex(hw, ys);
  const arch = pointedArch(0, hw, ys);
  const archO = pointedArch(0, hw + 0.25, ys);
  const bb = [fx - hw - 1.5, y0 - 0.6, fz - hw - 1.5, fx + hw + 1.5, apex + 0.8, fz + hw + 1.5];
  const local = (x, z) => [(x - fx) * tx + (z - fz) * tz, (x - fx) * nx + (z - fz) * nz]; // [along, outward]
  model.shape(...bb, (x, y, z) => { const [a, d] = local(x, z); return d <= 0.05 && d > -1.0 && archO(a, y); }, M.jamb);
  model.shape(...bb, (x, y, z) => { const [a, d] = local(x, z); return d <= 0.3 && d > -0.75 && arch(a, y); }, 0);
  model.shape(...bb, (x, y, z) => { const [a, d] = local(x, z); return d <= -0.75 && d > -1.0 && arch(a, y); }, M.glass);
  model.shape(...bb, (x, y, z) => { const [a, d] = local(x, z); return d <= -0.75 && d > -1.0 && arch(a, y) && (Math.abs(a) < 0.13 || Math.abs(y - (y0 + (ys - y0) * 0.5)) < 0.13); }, M.tracery);
}

/** Small standing figure (statue) of height h facing direction `facing` (radians about Y). */
export function figure(model, mat, x, y, z, h, facing = 0, opts = {}) {
  const s = h / 1.8;
  const cx = x, cz = z;
  const dx = Math.sin(facing), dz = Math.cos(facing);
  // legs
  model.box(cx - 0.22 * s, y, cz - 0.14 * s, cx - 0.02 * s, y + 0.85 * s, cz + 0.14 * s, mat);
  model.box(cx + 0.02 * s, y, cz - 0.14 * s, cx + 0.22 * s, y + 0.85 * s, cz + 0.14 * s, mat);
  // torso / robe
  model.box(cx - 0.3 * s, y + 0.8 * s, cz - 0.2 * s, cx + 0.3 * s, y + 1.45 * s, cz + 0.2 * s, mat);
  // arms
  model.box(cx - 0.42 * s, y + 0.85 * s, cz - 0.12 * s, cx - 0.3 * s, y + 1.4 * s, cz + 0.12 * s, mat);
  model.box(cx + 0.3 * s, y + 0.85 * s, cz - 0.12 * s, cx + 0.42 * s, y + 1.4 * s, cz + 0.12 * s, mat);
  // head
  model.box(cx - 0.14 * s, y + 1.47 * s, cz - 0.14 * s, cx + 0.14 * s, y + 1.78 * s, cz + 0.14 * s, opts.head ?? mat);
  if (opts.staff) {
    model.box(cx + 0.44 * s - 0.06, y, cz + dz * 0.1 - 0.06, cx + 0.44 * s + 0.06, y + 2.2 * s, cz + dz * 0.1 + 0.06, opts.staff);
  }
}

function buildTower(model, M, C) {
  const x0 = C.towerX0, x1 = C.towerX1, z0 = C.towerZ0, z1 = C.towerZ1;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const half = (x1 - x0) / 2;
  const shaftTop = 46;
  // shaft with slight batter suggested through three setbacks
  model.box(x0, -1.5, z0, x1, shaftTop, z1, M.tower);
  model.box(x0 - 0.5, -1.5, z0 - 0.5, x1 + 0.5, 1.5, z1 + 0.5, M.stoneLow);
  // corner buttresses
  const cb = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]];
  const cbStages = [[-1.5, 14, 1.25], [14, 28, 0.9], [28, 41, 0.55]];
  for (const [bx, bz] of cb) {
    const sx = bx === x0 ? -1 : 1;
    const sz = bz === z0 ? -1 : 1;
    for (const [ya, yb, proj] of cbStages) {
      // two wings of the corner buttress
      model.box(bx + (sx < 0 ? -proj : 0), ya, bz + (sz < 0 ? -0.25 : -1.75), bx + (sx < 0 ? 0.25 : proj), yb, bz + (sz < 0 ? 1.75 : 0.25), M.tower);
      model.box(bx + (sx < 0 ? -0.25 : -1.75), ya, bz + (sz < 0 ? -proj : 0), bx + (sx < 0 ? 1.75 : 0.25), yb, bz + (sz < 0 ? 0.25 : proj), M.tower);
      // sloped cap
      for (let k = 0; k < 4; k++) {
        const p = proj - k * 0.25;
        if (p <= 0.3) break;
        model.box(bx + (sx < 0 ? -p : 0), yb + k * 0.25, bz + (sz < 0 ? -0.25 : -1.75), bx + (sx < 0 ? 0.25 : p), yb + (k + 1) * 0.25, bz + (sz < 0 ? 1.75 : 0.25), M.tower);
        model.box(bx + (sx < 0 ? -0.25 : -1.75), yb + k * 0.25, bz + (sz < 0 ? -p : 0), bx + (sx < 0 ? 1.75 : 0.25), yb + (k + 1) * 0.25, bz + (sz < 0 ? 0.25 : p), M.tower);
      }
    }
  }
  // string courses
  for (const y of [14, 28, 41]) model.box(x0 - 0.35, y - 0.5, z0 - 0.35, x1 + 0.35, y, z1 + 0.35, M.trim);
  // west door and lancet windows on the three free faces (west, north, south)
  const faces = [
    { axis: 'x', face: x0, sign: -1, c: cz },
    { axis: 'z', face: z0, sign: -1, c: cx },
    { axis: 'z', face: z1, sign: 1, c: cx },
    { axis: 'x', face: x1, sign: 1, c: cz },
  ];
  // door on the west face
  for (let k = 0; k < 3; k++) {
    const hw = 1.5 - k * 0.35, ys = 3.6 - k * 0.2;
    const arch = pointedArch(cz, hw, ys);
    model.shape(x0 - 0.5 + k * 0.4, -0.5, cz - 2, x0 + 0.5 + k * 0.4, archApex(hw, ys) + 0.4, cz + 2, (x, y, z) => arch(z, y), k === 2 ? M.door : M.jamb);
  }
  for (const f of faces) {
    const west = f.axis === 'x' && f.sign < 0;
    if (!west) gothicWindow(model, M, f.axis, f.face, f.sign, f.c, 0.75, 6.5, 10.0, { transom: false, mullions: [f.c] });
    gothicWindow(model, M, f.axis, f.face, f.sign, f.c, 1.0, 17, 24.5, { transom: true, mullions: [f.c] });
    gothicWindow(model, M, f.axis, f.face, f.sign, f.c - 1.35, 0.7, 31, 37.5, { transom: false, mullions: [f.c - 1.35] });
    gothicWindow(model, M, f.axis, f.face, f.sign, f.c + 1.35, 0.7, 31, 37.5, { transom: false, mullions: [f.c + 1.35] });
  }
  // ---- clock stage 46..53 ----
  model.box(x0 - 0.25, shaftTop, z0 - 0.25, x1 + 0.25, shaftTop + 7, z1 + 0.25, M.tower);
  model.box(x0 - 0.5, shaftTop - 0.5, z0 - 0.5, x1 + 0.5, shaftTop, z1 + 0.5, M.trim);
  const clockY = shaftTop + 3.6;
  for (const f of faces) {
    const R = 2.0;
    const ringTest = (a, y) => Math.hypot(a - f.c, y - clockY) <= R;
    const handTest = (a, y) => {
      const da = a - f.c, dy = y - clockY;
      const d = Math.hypot(da, dy);
      if (d > R * 0.85) return false;
      // hour hand toward 10, minute hand toward 2
      const h1 = Math.abs(da * Math.cos(2.1) + dy * Math.sin(2.1)) < 0.14 && (da * -Math.sin(2.1) + dy * Math.cos(2.1)) > -0.1 && d < R * 0.55;
      const h2 = Math.abs(da * Math.cos(0.55) + dy * Math.sin(0.55)) < 0.12 && (da * -Math.sin(0.55) + dy * Math.cos(0.55)) > -0.1;
      const centre = d < 0.28;
      const ticks = Math.abs(d - R * 0.72) < 0.14 && Math.abs(Math.sin(Math.atan2(dy, da) * 6)) < 0.18;
      return h1 || h2 || centre || ticks;
    };
    const along = (x, z) => (f.axis === 'z' ? x : z);
    const perp = (x, z) => (f.axis === 'z' ? z : x);
    const inD = (p, d0, d1) => { const t = (f.face - p) * f.sign; return t >= d0 && t < d1; };
    const bb = f.axis === 'z'
      ? [f.c - R - 0.6, clockY - R - 0.6, Math.min(f.face, f.face + f.sign * 0.5) - 0.75, f.c + R + 0.6, clockY + R + 0.6, Math.max(f.face, f.face + f.sign * 0.5) + 0.75]
      : [Math.min(f.face, f.face + f.sign * 0.5) - 0.75, clockY - R - 0.6, f.c - R - 0.6, Math.max(f.face, f.face + f.sign * 0.5) + 0.75, clockY + R + 0.6, f.c + R + 0.6];
    // dark surround ring, face disc (proud of the wall), hands
    model.shape(...bb, (x, y, z) => inD(perp(x, z), -0.5, 0) && Math.hypot(along(x, z) - f.c, y - clockY) <= R + 0.4, M.clockDark);
    model.shape(...bb, (x, y, z) => inD(perp(x, z), -0.5, -0.25) && ringTest(along(x, z), y), M.clockFace);
    model.shape(...bb, (x, y, z) => inD(perp(x, z), -0.75, -0.5) && handTest(along(x, z), y), M.clockDark);
  }
  // ---- belfry 53..63 with tall louvred openings and gables ----
  const belY0 = shaftTop + 7, belY1 = shaftTop + 17;
  model.box(x0 - 0.5, belY0 - 0.5, z0 - 0.5, x1 + 0.5, belY0, z1 + 0.5, M.trim);
  model.box(x0, belY0, z0, x1, belY1, z1, M.tower);
  for (const f of faces) {
    for (const off of [-1.6, 1.6]) {
      const c = f.c + off;
      const hw = 0.8, ys = belY0 + 6.2;
      const arch = pointedArch(c, hw, ys);
      const archO = pointedArch(c, hw + 0.25, ys);
      const along = (x, z) => (f.axis === 'z' ? x : z);
      const perp = (x, z) => (f.axis === 'z' ? z : x);
      const inD = (p, d0, d1) => { const t = (f.face - p) * f.sign; return t >= d0 && t < d1; };
      const lo = Math.min(f.face, f.face - f.sign * 1.5) - 0.3, hi = Math.max(f.face, f.face - f.sign * 1.5) + 0.3;
      const bb = f.axis === 'z' ? [c - 1.5, belY0 + 0.5, lo, c + 1.5, belY1, hi] : [lo, belY0 + 0.5, c - 1.5, hi, belY1, c + 1.5];
      model.shape(...bb, (x, y, z) => inD(perp(x, z), 0, 1.25) && archO(along(x, z), y) && y > belY0 + 1.0, M.jamb);
      model.shape(...bb, (x, y, z) => inD(perp(x, z), -0.3, 1.0) && arch(along(x, z), y) && y > belY0 + 1.25, M.dark);
      // louvres
      model.shape(...bb, (x, y, z) => inD(perp(x, z), 0.25, 0.75) && arch(along(x, z), y) && y > belY0 + 1.25 && Math.abs(((y - belY0) % 1.0) - 0.5) < 0.13, M.trim);
    }
  }
  // gables on each face
  for (const f of faces) {
    const gh = 4.2;
    if (f.axis === 'z') {
      model.shape(x0 - 0.5, belY1 - 0.25, f.face + (f.sign > 0 ? -0.75 : 0.0), x1 + 0.5, belY1 + gh + 0.3, f.face + (f.sign > 0 ? 0.0 : 0.75) + 0.0, (x, y, z) => y - belY1 <= (half + 0.5 - Math.abs(x - cx)) * (gh / (half + 0.5)), M.tower);
    } else {
      model.shape(f.face + (f.sign > 0 ? -0.75 : 0.0), belY1 - 0.25, z0 - 0.5, f.face + (f.sign > 0 ? 0.0 : 0.75), belY1 + gh + 0.3, z1 + 0.5, (x, y, z) => y - belY1 <= (half + 0.5 - Math.abs(z - cz)) * (gh / (half + 0.5)), M.tower);
    }
  }
  // small round openings in the gables
  for (const f of faces) {
    const yG = belY1 + 1.4;
    if (f.axis === 'z') model.shape(cx - 0.8, yG - 0.8, f.face - 1, cx + 0.8, yG + 0.8, f.face + 1, (x, y, z) => Math.hypot(x - cx, y - yG) <= 0.6, M.dark);
    else model.shape(f.face - 1, yG - 0.8, cz - 0.8, f.face + 1, yG + 0.8, cz + 0.8, (x, y, z) => Math.hypot(z - cz, y - yG) <= 0.6, M.dark);
  }
  // corner pinnacles
  for (const [bx, bz] of cb) {
    const px = bx + (bx === x0 ? -0.1 : 0.1), pz = bz + (bz === z0 ? -0.1 : 0.1);
    model.box(px - 0.7, belY1 - 0.5, pz - 0.7, px + 0.7, belY1 + 2.6, pz + 0.7, M.tower);
    model.cone(px, pz, 0.85, 0.05, belY1 + 2.6, belY1 + 6.8, M.spire, 4, Math.PI / 4);
    model.box(px - 0.08, belY1 + 6.6, pz - 0.08, px + 0.08, belY1 + 7.4, pz + 0.08, M.gold);
  }
  // ---- spire: slender octagonal pyramid with dark ribs, cross on top ----
  const spireY0 = belY1 + 0.5, spireY1 = C.towerH - 1.5;
  model.cone(cx, cz, half - 0.4, 0.25, spireY0, spireY1, M.spire, 8, Math.PI / 8);
  model.paint(cx - half, spireY0, cz - half, cx + half, spireY1, cz + half, (x, y, z, cur) => {
    if (cur !== M.spire) return 0;
    const ang = Math.atan2(z - cz, x - cx) - Math.PI / 8;
    const sector = Math.PI / 4;
    const frac = ((ang % sector) + sector) % sector;
    const t = (y - spireY0) / (spireY1 - spireY0);
    const rHere = (half - 0.4) * (1 - t) + 0.25 * t;
    return Math.min(frac, sector - frac) * rHere < 0.24 ? M.spireRib : 0;
  });
  // small spire lucarnes
  for (const f of faces) {
    const y = spireY0 + 3.0;
    const dx = f.axis === 'x' ? f.sign : 0, dz = f.axis === 'z' ? f.sign : 0;
    const t = (y - spireY0) / (spireY1 - spireY0);
    const r = (half - 0.4) * (1 - t) + 0.25 * t;
    const px = cx + dx * (r - 0.2), pz = cz + dz * (r - 0.2);
    model.box(px - 0.6, y, pz - 0.6, px + 0.6, y + 1.6, pz + 0.6, M.spire);
    model.box(px + dx * 0.45 - 0.25, y + 0.3, pz + dz * 0.45 - 0.25, px + dx * 0.45 + 0.25, y + 1.2, pz + dz * 0.45 + 0.25, M.dark);
    model.cone(px, pz, 0.8, 0.05, y + 1.6, y + 2.6, M.spire, 4, Math.PI / 4);
  }
  // cross
  model.box(cx - 0.15, spireY1 - 0.5, cz - 0.15, cx + 0.15, C.towerH + 1.0, cz + 0.15, M.gold);
  model.box(cx - 0.9, C.towerH - 0.1, cz - 0.15, cx + 0.9, C.towerH + 0.2, cz + 0.15, M.gold);
  model.box(cx - 0.15, C.towerH - 0.1, cz - 0.9, cx + 0.15, C.towerH + 0.2, cz + 0.9, M.gold);
}

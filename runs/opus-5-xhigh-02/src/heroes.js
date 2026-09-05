// LOD 0 landmark buildings around the square, built on the 0.25 m grid:
// Banffy Palace (east), the Mirror Buildings framing Iuliu Maniu (south-east),
// the former Hotel Continental (south-west corner), Casa Sfatului and the
// National Bank (south side).

import { P } from './palette.js';
import { Rng } from './rng.js';
import { windowUnit, archUnit, shopUnit, cornice, addChimneys, roofTone } from './facade.js';

// --- small shared pieces -----------------------------------------------------

/** Stone balustrade run along one edge. */
function balustrade(b, x0, z0, x1, z1, y, h, mat, cap) {
  b.box(x0, y, z0, x1, y + 0.22, z1, cap);
  const along = (x1 - x0) > (z1 - z0);
  const len = along ? x1 - x0 : z1 - z0;
  const n = Math.max(2, Math.round(len / 0.75));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    if (along) {
      const x = x0 + t * len;
      b.box(x - 0.16, y + 0.22, z0 + 0.05, x + 0.16, y + h - 0.22, z1 - 0.05, mat);
    } else {
      const z = z0 + t * len;
      b.box(x0 + 0.05, y + 0.22, z - 0.16, x1 - 0.05, y + h - 0.22, z + 0.16, mat);
    }
  }
  b.box(x0 - 0.1, y + h - 0.22, z0 - 0.1, x1 + 0.1, y + h, z1 + 0.1, cap);
}

/** A roofline statue: coarse but unmistakably a standing figure. */
function statue(b, x, y, z, h, mat, pose = 0) {
  const s = h / 2.1;
  b.box(x - 0.42, y, z - 0.42, x + 0.42, y + 0.30 * s, z + 0.42, mat);          // socle
  b.box(x - 0.17, y + 0.28 * s, z - 0.15, x - 0.01, y + 1.05 * s, z + 0.15, mat);
  b.box(x + 0.01, y + 0.28 * s, z - 0.15, x + 0.17, y + 1.05 * s, z + 0.15, mat);
  b.box(x - 0.26, y + 1.00 * s, z - 0.19, x + 0.26, y + 1.62 * s, z + 0.19, mat);
  b.box(x - 0.13, y + 1.62 * s, z - 0.13, x + 0.13, y + 1.94 * s, z + 0.13, mat);
  if (pose === 0) {
    b.box(x - 0.44, y + 1.05 * s, z - 0.13, x - 0.22, y + 1.58 * s, z + 0.13, mat);
    b.box(x + 0.22, y + 1.10 * s, z - 0.13, x + 0.48, y + 1.75 * s, z + 0.13, mat);
  } else {
    b.box(x - 0.48, y + 1.30 * s, z - 0.13, x - 0.22, y + 1.52 * s, z + 0.13, mat);
    b.box(x + 0.22, y + 1.05 * s, z - 0.13, x + 0.44, y + 1.58 * s, z + 0.13, mat);
  }
  b.box(x - 0.30, y + 0.55 * s, z - 0.24, x + 0.30, y + 1.62 * s, z - 0.14, mat); // drapery
}

/** Quarter-round corner: carves the square corner away and rebuilds it as a shell. */
function roundedCorner(b, cx, cz, R, y0, y1, sx, sz, mat, wallT) {
  const vs = b.vs;
  const x0 = Math.min(cx, cx + sx * R), x1 = Math.max(cx, cx + sx * R);
  const z0 = Math.min(cz, cz + sz * R), z1 = Math.max(cz, cz + sz * R);
  b.carve(x0, y0, z0, x1, y1, z1);
  for (let x = x0; x < x1 - 1e-6; x += vs) {
    for (let z = z0; z < z1 - 1e-6; z += vs) {
      const d = Math.hypot(x + vs / 2 - cx, z + vs / 2 - cz);
      if (d > R || d < R - wallT) continue;
      b.box(x, y0, z, x + vs, y1, z + vs, mat);
    }
  }
}

/** Window cut into a rounded corner, following the curve. */
function curvedWindow(b, cx, cz, R, aC, aHalf, y0, h, glass, trim) {
  const vs = b.vs;
  const steps = Math.max(3, Math.round((2 * aHalf * R) / vs));
  for (let i = 0; i <= steps; i++) {
    const a = aC - aHalf + (2 * aHalf * i) / steps;
    const x = cx + Math.cos(a) * (R - 0.2), z = cz + Math.sin(a) * (R - 0.2);
    b.carve(x - vs, y0, z - vs, x + vs, y0 + h, z + vs);
    const gx = cx + Math.cos(a) * (R - 0.75), gz = cz + Math.sin(a) * (R - 0.75);
    b.box(gx - vs, y0, gz - vs, gx + vs, y0 + h, gz + vs, glass);
  }
  for (const s of [-1, 1]) {
    const a = aC + s * (aHalf + 0.055);
    const x = cx + Math.cos(a) * (R - 0.1), z = cz + Math.sin(a) * (R - 0.1);
    b.box(x - 0.22, y0 - 0.3, z - 0.22, x + 0.22, y0 + h + 0.35, z + 0.22, trim);
  }
  for (let i = 0; i <= steps; i++) {
    const a = aC - aHalf + (2 * aHalf * i) / steps;
    const x = cx + Math.cos(a) * (R + 0.05), z = cz + Math.sin(a) * (R + 0.05);
    b.box(x - 0.2, y0 + h, z - 0.2, x + 0.2, y0 + h + 0.3, z + 0.2, trim);
    b.box(x - 0.2, y0 - 0.3, z - 0.2, x + 0.2, y0 - 0.05, z + 0.2, trim);
  }
}

/** Bulbous helmet dome with lantern and finial - the Mirror Buildings' signature. */
function helmetDome(b, cx, cz, r, y0, h, mat, trim) {
  const vs = b.vs;
  const n = Math.max(6, Math.round(h / vs));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // ogee profile: swells low, pinches, then rises to a point
    const rr = r * (Math.sin(Math.PI * (0.18 + t * 0.74)) * (1 - t * 0.55) + 0.06 * (1 - t));
    b.polyPrism(cx, cz, Math.max(vs, rr), 8, Math.PI / 8, y0 + t * h * 0.86, y0 + (t + 1 / n) * h * 0.86 + vs, mat);
  }
  b.polyPrism(cx, cz, r * 0.30, 8, Math.PI / 8, y0 + h * 0.84, y0 + h * 1.02, trim);
  b.polyPrism(cx, cz, r * 0.20, 8, Math.PI / 8, y0 + h * 1.02, y0 + h * 1.16, mat);
  b.box(cx - 0.12, y0 + h * 1.16, cz - 0.12, cx + 0.12, y0 + h * 1.42, cz + 0.12, P.gold);
  b.box(cx - 0.34, y0 + h * 1.30, cz - 0.10, cx + 0.34, y0 + h * 1.36, cz + 0.10, P.gold);
}

/** Plain window rhythm for a rear or side elevation nobody planned to decorate. */
function elevation(b, o) {
  const { axis, dir, plane, u0, u1, base, gH, fH, floors } = o;
  const trim = o.trim ?? P.whiteStone;
  const rng = o.rng ?? new Rng('elev');
  const step = o.step ?? 4.2;
  const n = Math.max(1, Math.floor((u1 - u0) / step));
  const gap = (u1 - u0) / n;
  for (let i = 0; i < n; i++) {
    const uc = u0 + (i + 0.5) * gap;
    if (uc < u0 + 1.6 || uc > u1 - 1.6) continue;
    if (o.ground !== false) {
      windowUnit(b, {
        axis, dir, plane, uc, w: 1.3, y0: base + 1.9, h: 2.2, trim,
        glass: P.windowGlassDark, depth: 0.5,
      });
    }
    for (let f = 0; f < floors; f++) {
      windowUnit(b, {
        axis, dir, plane, uc, w: 1.35, y0: base + gH + f * fH + 1.0, h: Math.min(fH - 1.3, 2.5), trim,
        glass: rng.chance(o.litChance ?? 0.3) ? P.litWindow : P.windowGlassDark, depth: 0.5,
      });
    }
  }
  for (let f = 0; f <= floors; f++) {
    const y = base + gH + f * fH - 0.5;
    if (axis === 'z') b.box(u0, y, plane - (dir > 0 ? 0 : 0.2), u1, y + 0.26, plane + (dir > 0 ? 0.2 : 0), trim);
    else b.box(plane - (dir > 0 ? 0 : 0.2), y, u0, plane + (dir > 0 ? 0.2 : 0), y + 0.26, u1, trim);
  }
}

// ---------------------------------------------------------------------------
// East side: Banffy Palace
// ---------------------------------------------------------------------------
export function buildBanffy(b) {
  const rng = new Rng('banffy');
  const x0 = 110, x1 = 146, z0 = -60, z1 = -8;
  const wall = P.ivory, trim = P.whiteStone, stone = P.ashlar;
  const gH = 5.2, fH = 4.6, floors = 2;
  const eave = gH + floors * fH + 0.6;   // ~19.5 m
  const plane = x0, dir = -1;

  // U-plan around an inner courtyard, open to the east
  const m = 11;
  b.shell(x0, -1.5, z0, x1, eave, z0 + m, wall, 1.2);
  b.shell(x0, -1.5, z1 - m, x1, eave, z1, wall, 1.2);
  b.shell(x0, -1.5, z0 + m, x0 + 13, eave, z1 - m, wall, 1.2);
  b.shell(x1 - 8, -1.5, z0 + m, x1, eave - 5, z1 - m, wall, 1.2);
  // arcaded courtyard wings
  for (let z = z0 + m + 2; z < z1 - m - 2; z += 4.4) {
    archUnit(b, { axis: 'x', dir: 1, plane: x0 + 13, uc: z + 2.2, w: 3.0, y0: 0.9, h: 4.4, trim, fill: P.archGlass });
  }

  // rusticated ground storey
  b.box(x0 - 0.35, -1.5, z0 - 0.35, x1 + 0.35, 1.1, z1 + 0.35, P.greyStone);
  b.box(x0 - 0.35, 1.1, z0 - 0.35, x1 + 0.35, 1.35, z1 + 0.35, trim);
  for (let y = 1.35; y < gH - 0.4; y += 0.62) {
    b.box(x0 - 0.14, y, z0, x0, y + 0.12, z1, P.ashlarDark);
  }

  // central risalit, three bays, projecting
  const cz = (z0 + z1) / 2;
  const rz0 = cz - 8.4, rz1 = cz + 8.4;
  b.shell(x0 - 1.4, -1.5, rz0, x0 + 4, eave + 1.6, rz1, wall, 1.2);
  b.box(x0 - 1.75, -1.5, rz0 - 0.35, x0 + 1, 1.1, rz1 + 0.35, P.greyStone);
  for (let y = 1.35; y < gH - 0.4; y += 0.62) {
    b.box(x0 - 1.55, y, rz0, x0 - 1.4, y + 0.12, rz1, P.ashlarDark);
  }

  // grand arched carriage entrance
  archUnit(b, { axis: 'x', dir: -1, plane: x0 - 1.4, uc: cz, w: 5.0, y0: 0.9, h: 7.2, trim, fill: P.doorWoodDark, depth: 1.6 });
  b.box(x0 - 2.1, 8.4, cz - 4.2, x0 - 1.2, 9.0, cz + 4.2, trim);
  // flanking niches with statues
  for (const s of [-1, 1]) {
    const zz = cz + s * 5.4;
    b.carve(x0 - 1.45, 1.9, zz - 1.0, x0 + 0.2, 5.6, zz + 1.0);
    statue(b, x0 - 0.7, 1.9, zz, 3.2, P.whiteStone, s > 0 ? 1 : 0);
    archUnit(b, { axis: 'x', dir: -1, plane: x0 - 1.4, uc: zz, w: 2.2, y0: 1.9, h: 3.9, trim, fill: P.churchShadow, depth: 0.45 });
  }

  // piano nobile with a loggia on the risalit
  const py = gH;
  for (let i = 0; i < 3; i++) {
    const zz = rz0 + 2.8 + i * 5.6;
    windowUnit(b, {
      axis: 'x', dir: -1, plane: x0 - 1.4, uc: zz, w: 2.0, y0: py + 1.1, h: 3.4, trim,
      glass: P.windowGlass, head: 'pediment', balcony: true, depth: 0.8,
    });
    windowUnit(b, {
      axis: 'x', dir: -1, plane: x0 - 1.4, uc: zz, w: 1.9, y0: py + fH + 1.0, h: 2.7, trim,
      glass: rng.chance(0.4) ? P.litWindow : P.windowGlass, head: 'cornice', depth: 0.7,
    });
  }
  // colossal pilasters between the risalit bays
  for (let i = 0; i <= 3; i++) {
    const zz = rz0 + i * 5.6;
    b.box(x0 - 1.95, py, zz - 0.55, x0 - 1.4, eave - 0.2, zz + 0.55, trim);
    b.box(x0 - 2.15, eave - 0.9, zz - 0.75, x0 - 1.4, eave - 0.2, zz + 0.75, P.whiteStone);
    b.box(x0 - 2.15, py - 0.45, zz - 0.75, x0 - 1.4, py, zz + 0.75, P.whiteStone);
  }

  // wing bays
  const bayZ = [];
  for (let z = z0 + 3.2; z < rz0 - 1; z += 4.5) bayZ.push(z);
  for (let z = rz1 + 1.3; z < z1 - 2.5; z += 4.5) bayZ.push(z);
  for (const zz of bayZ) {
    archUnit(b, { axis: 'x', dir: -1, plane, uc: zz, w: 2.6, y0: 1.35, h: 3.6, trim, fill: P.archGlass, depth: 0.7 });
    windowUnit(b, {
      axis: 'x', dir: -1, plane, uc: zz, w: 1.9, y0: py + 1.1, h: 3.2, trim,
      glass: rng.chance(0.35) ? P.litWindow : P.windowGlass, head: 'pediment', depth: 0.7,
      balcony: rng.chance(0.3),
    });
    windowUnit(b, {
      axis: 'x', dir: -1, plane, uc: zz, w: 1.8, y0: py + fH + 1.0, h: 2.6, trim,
      glass: rng.chance(0.3) ? P.litWindow : P.windowGlassDark, head: 'cornice', depth: 0.6,
    });
  }
  // cordons
  b.box(x0 - 0.4, gH - 0.6, z0 - 0.1, x0, gH - 0.2, z1 + 0.1, trim);
  b.box(x0 - 0.4, gH + fH - 0.5, z0 - 0.1, x0, gH + fH - 0.15, z1 + 0.1, trim);

  // cornice, balustrade and roofline sculpture
  cornice(b, { x0: x0 - 0.2, z0, x1, z1 }, eave - 1.0, 1.0, trim, true, P.ashlarDark);
  balustrade(b, x0 - 1.1, z0 - 0.4, x0 - 0.2, z1 + 0.4, eave + 0.1, 1.5, P.whiteStone, trim);
  b.box(x0 - 2.4, eave + 1.5, rz0 - 0.5, x0 + 1, eave + 2.3, rz1 + 0.5, trim);
  // segmental attic over the risalit with an armorial cartouche
  for (let z = rz0 - 0.5; z < rz1 + 0.5; z += 0.25) {
    const t = (z - cz) / (rz1 + 0.5 - cz);
    const hh = 2.6 * Math.sqrt(Math.max(0, 1 - t * t));
    b.box(x0 - 2.2, eave + 2.3, z, x0 + 0.8, eave + 2.3 + hh, z + 0.25, P.ivory);
  }
  b.box(x0 - 2.5, eave + 3.0, cz - 1.5, x0 - 1.9, eave + 4.6, cz + 1.5, P.whiteStone);
  for (const s of [-1, 1]) statue(b, x0 - 1.3, eave + 2.4, cz + s * 7.6, 2.6, P.whiteStone, s > 0 ? 1 : 0);
  for (let i = 0; i < 5; i++) {
    const zz = z0 + 4 + i * ((z1 - z0 - 8) / 4);
    if (Math.abs(zz - cz) < 10) continue;
    statue(b, x0 - 0.65, eave + 1.6, zz, 2.3, P.whiteStone, i % 2);
  }
  // urns
  for (let z = z0 + 2; z < z1; z += 6.2) {
    b.box(x0 - 1.0, eave + 1.6, z - 0.35, x0 - 0.25, eave + 2.0, z + 0.35, trim);
    b.ellipsoid(x0 - 0.62, eave + 2.5, z, 0.42, 0.55, 0.42, P.whiteStone);
  }

  // four wing roofs, so the inner courtyard stays open to the sky
  b.mansard(x0 - 1.2, z0 - 0.9, x1 + 0.9, z0 + m + 0.6, eave + 1.2, eave + 4.4, eave + 5.6, 4.6, P.roofSlate, P.roofRust);
  b.mansard(x0 - 1.2, z1 - m - 0.6, x1 + 0.9, z1 + 0.9, eave + 1.2, eave + 4.4, eave + 5.6, 4.6, P.roofSlate, P.roofRust);
  b.mansard(x0 - 1.2, z0 + m, x0 + 13.6, z1 - m, eave + 1.2, eave + 4.4, eave + 5.6, 4.6, P.roofSlate, P.roofRust);
  b.mansard(x1 - 8.6, z0 + m, x1 + 0.9, z1 - m, eave - 5 + 1.0, eave - 5 + 3.4, eave - 5 + 4.4, 3.4, P.roofSlate, P.roofRust);
  // rear and side elevations
  elevation(b, { axis: 'x', dir: 1, plane: x1, u0: z0, u1: z0 + m, base: -0.2, gH, fH, floors, rng, step: 4.6 });
  elevation(b, { axis: 'x', dir: 1, plane: x1, u0: z1 - m, u1: z1, base: -0.2, gH, fH, floors, rng, step: 4.6 });
  elevation(b, { axis: 'z', dir: -1, plane: z0, u0: x0, u1: x1, base: -0.2, gH, fH, floors, rng, step: 4.6 });
  elevation(b, { axis: 'z', dir: 1, plane: z1, u0: x0, u1: x1, base: -0.2, gH, fH, floors, rng, step: 4.6 });
  addChimneys(b, { x0: x0 + 2, z0: z0 + 2, x1: x1 - 2, z1: z0 + m, axis: 'x' }, eave + 5.4, rng, 3);
  addChimneys(b, { x0: x0 + 2, z0: z1 - m, x1: x1 - 2, z1: z1 - 2, axis: 'x' }, eave + 5.4, rng, 3);

  return [{ x0, z0, x1, z1 }];
}

// ---------------------------------------------------------------------------
// South-east: the Mirror Buildings framing Str. Iuliu Maniu
// ---------------------------------------------------------------------------
function mirrorHalf(b, seed, zNear, sideSign, zFar) {
  // sideSign = -1 for the northern palace (its rounded corner faces south-east),
  //            +1 for the southern one.
  const rng = new Rng(seed);
  const x0 = 108, x1 = 156;
  const z0 = Math.min(zNear, zFar), z1 = Math.max(zNear, zFar);
  const wall = P.paleYellow, trim = P.whiteStone;
  const gH = 5.0, fH = 3.9, floors = 3;
  const eave = gH + floors * fH + 0.5;    // ~17.2 m
  const R = 5.2;

  b.shell(x0, -1.5, z0, x1, eave, z1, wall, 1.1);
  b.box(x0 - 0.3, -1.5, z0 - 0.3, x1 + 0.3, 1.1, z1 + 0.3, P.greyStone);
  b.box(x0 - 0.3, 1.1, z0 - 0.3, x1 + 0.3, 1.35, z1 + 0.3, trim);

  // rounded corner at the street mouth, facing the square
  const cx = x0 + R;
  const cz = sideSign < 0 ? zNear - R : zNear + R;
  roundedCorner(b, cx, cz, R, -1.5, eave, -1, sideSign, wall, 1.1);
  b.cylY(cx, cz, R + 0.3, -1.5, 1.1, P.greyStone);
  b.cylY(cx, cz, R + 0.3, 1.1, 1.35, trim);

  const aC = Math.atan2(sideSign * 1, -1);   // corner bisector direction
  archUnit(b, { axis: 'x', dir: -1, plane: x0, uc: zNear + sideSign * -8.5, w: 3.0, y0: 1.35, h: 4.2, trim, fill: P.archGlass });

  // curved corner glazing on each storey
  curvedWindow(b, cx, cz, R, aC, 0.42, 1.9, 3.4, P.shopGlass, trim);
  for (let f = 0; f < floors; f++) {
    const y = gH + f * fH + 1.0;
    for (const off of [-0.34, 0.34]) {
      curvedWindow(b, cx, cz, R, aC + off, 0.17, y, f === 0 ? 3.0 : 2.5, f === 0 ? P.windowGlass : (rng.chance(0.4) ? P.litWindow : P.windowGlassDark), trim);
    }
  }
  // corner cordons
  for (const y of [gH - 0.5, gH + fH - 0.4, gH + 2 * fH - 0.4]) {
    b.cylY(cx, cz, R + 0.28, y, y + 0.3, trim);
  }

  // west frontage onto the square
  const westBays = [];
  for (let z = (sideSign < 0 ? z0 + 3.0 : z0 + R + 2.4); z < (sideSign < 0 ? z1 - R - 1.6 : z1 - 2.4); z += 4.3) westBays.push(z);
  for (const zz of westBays) {
    shopUnit(b, { axis: 'x', dir: -1, plane: x0, uc: zz, w: 2.9, y0: 1.35, h: 3.3, frame: P.doorWoodDark, fascia: P.awningGreen, awning: rng.chance(0.4) });
    for (let f = 0; f < floors; f++) {
      const y = gH + f * fH;
      windowUnit(b, {
        axis: 'x', dir: -1, plane: x0, uc: zz, w: 1.6, y0: y + 1.0, h: f === 0 ? 3.0 : 2.4, trim,
        glass: rng.chance(0.36) ? P.litWindow : P.windowGlassDark,
        head: f === 0 ? 'pediment' : (f === 1 ? 'segment' : 'cornice'),
        balcony: f === 0 && rng.chance(0.5),
      });
    }
  }
  // street frontage onto Iuliu Maniu
  const streetPlane = sideSign < 0 ? z1 : z0;
  const sdir = sideSign < 0 ? 1 : -1;
  for (let x = x0 + R + 2.2; x < x1 - 2.2; x += 4.3) {
    shopUnit(b, { axis: 'z', dir: sdir, plane: streetPlane, uc: x, w: 2.9, y0: 1.35, h: 3.3, frame: P.doorWood, fascia: P.awningRed, awning: rng.chance(0.35) });
    for (let f = 0; f < floors; f++) {
      const y = gH + f * fH;
      windowUnit(b, {
        axis: 'z', dir: sdir, plane: streetPlane, uc: x, w: 1.6, y0: y + 1.0, h: f === 0 ? 3.0 : 2.4, trim,
        glass: rng.chance(0.36) ? P.litWindow : P.windowGlassDark,
        head: f === 0 ? 'pediment' : 'cornice',
        balcony: f === 0 && rng.chance(0.35),
      });
    }
  }
  // storey bands wrapping both frontages
  for (const y of [gH - 0.5, gH + fH - 0.4, gH + 2 * fH - 0.4]) {
    b.box(x0 - 0.22, y, z0 - 0.05, x0, y + 0.3, z1 + 0.05, trim);
    b.box(x0, y, streetPlane - (sdir > 0 ? 0 : 0.22), x1 + 0.05, y + 0.3, streetPlane + (sdir > 0 ? 0.22 : 0), trim);
  }

  cornice(b, { x0, z0, x1, z1 }, eave - 0.9, 0.85, trim, true, P.ashlarDark);
  b.cylY(cx, cz, R + 0.9, eave - 0.9, eave - 0.55, trim);
  balustrade(b, x0 - 0.75, z0 - 0.2, x0 - 0.1, z1 + 0.2, eave + 0.05, 1.3, P.whiteStone, trim);

  // mansard with a domed corner pavilion
  b.mansard(x0 - 0.9, z0 - 0.8, x1 + 0.8, z1 + 0.8, eave + 0.6, eave + 4.2, eave + 5.4, 5.5, P.roofSlate, P.roofRust);
  b.cylY(cx, cz, R + 0.6, eave + 0.6, eave + 2.4, P.roofSlate);
  helmetDome(b, cx, cz, R + 0.2, eave + 2.2, 8.6, P.roofSlate, P.copper);
  // dormers on the mansard
  for (let x = x0 + R + 3; x < x1 - 3; x += 5.0) {
    b.box(x - 0.9, eave + 1.2, streetPlane + sdir * -0.4, x + 0.9, eave + 3.4, streetPlane + sdir * 0.8, P.beige);
    b.box(x - 0.55, eave + 1.7, streetPlane + sdir * 0.5, x + 0.55, eave + 3.0, streetPlane + sdir * 0.95, P.windowGlassDark);
    b.pyramid(x - 1.1, streetPlane + sdir * -0.5, x + 1.1, streetPlane + sdir * 0.95, eave + 3.4, eave + 4.3, P.roofSlate);
  }
  // outer long side and the east end get a plain but populated elevation
  const outerPlane = sideSign < 0 ? z0 : z1;
  elevation(b, { axis: 'z', dir: sideSign < 0 ? -1 : 1, plane: outerPlane, u0: x0, u1: x1, base: -0.2, gH, fH, floors, rng, step: 4.4 });
  elevation(b, { axis: 'x', dir: 1, plane: x1, u0: z0, u1: z1, base: -0.2, gH, fH, floors, rng, step: 4.4 });
  addChimneys(b, { x0: x0 + 4, z0: z0 + 2, x1: x1 - 3, z1: z1 - 2, axis: 'x' }, eave + 5.2, rng, 3);
  return { x0, z0, x1, z1 };
}

export function buildMirrorBuildings(b) {
  // mirrored about the axis of Str. Iuliu Maniu (z = 33)
  const a = mirrorHalf(b, 'mirror-north', 26.5, -1, 4.0);
  const c = mirrorHalf(b, 'mirror-south', 39.5, 1, 62.0);
  return [a, c];
}

// ---------------------------------------------------------------------------
// South-west corner: the former Hotel Continental / New York
// ---------------------------------------------------------------------------
export function buildContinental(b) {
  const rng = new Rng('continental');
  const wall = P.ochre, trim = P.whiteStone;
  const gH = 5.4, fH = 4.0, floors = 3;
  const eave = gH + floors * fH + 0.6;   // ~18 m
  const R = 6.0;

  // west wing (fronts the square's west side) and south wing (fronts the south side)
  const W = { x0: -142, z0: 58, x1: -110, z1: 112 };
  const Sw = { x0: -110, z0: 80, x1: -82, z1: 110 };
  b.shell(W.x0, -1.5, W.z0, W.x1, eave, W.z1, wall, 1.1);
  b.shell(Sw.x0, -1.5, Sw.z0, Sw.x1, eave, Sw.z1, wall, 1.1);

  // convex corner at (-110, 80) facing the square
  const ccx = -110 - R, ccz = 80 + R;
  roundedCorner(b, ccx, ccz, R, -1.5, eave, 1, -1, wall, 1.1);
  b.cylY(ccx, ccz, R + 0.35, -1.5, 1.15, P.greyStone);
  b.cylY(ccx, ccz, R + 0.35, 1.15, 1.4, trim);

  b.box(W.x0 - 0.3, -1.5, W.z0 - 0.3, W.x1 + 0.3, 1.15, W.z1 + 0.3, P.greyStone);
  b.box(Sw.x0 - 0.3, -1.5, Sw.z0 - 0.3, Sw.x1 + 0.3, 1.15, Sw.z1 + 0.3, P.greyStone);
  b.box(W.x0 - 0.3, 1.15, W.z0 - 0.3, W.x1 + 0.3, 1.4, W.z1 + 0.3, trim);
  b.box(Sw.x0 - 0.3, 1.15, Sw.z0 - 0.3, Sw.x1 + 0.3, 1.4, Sw.z1 + 0.3, trim);
  // banded rustication on the ground storey
  for (let y = 1.4; y < gH - 0.5; y += 0.66) {
    b.box(W.x1 - 0.14, y, W.z0, W.x1, y + 0.13, W.z1, P.ashlarDark);
    b.box(Sw.x0, y, Sw.z0 - 0.14, Sw.x1, y + 0.13, Sw.z0, P.ashlarDark);
  }

  const aC = Math.atan2(-1, 1) ; // corner bisector points north-east
  curvedWindow(b, ccx, ccz, R, aC, 0.45, 1.9, 3.6, P.shopGlass, trim);
  for (let f = 0; f < floors; f++) {
    const y = gH + f * fH + 1.0;
    for (const off of [-0.36, 0, 0.36]) {
      curvedWindow(b, ccx, ccz, R, aC + off, 0.14, y, f === 0 ? 3.1 : 2.6,
        f === 0 ? P.windowGlass : (rng.chance(0.45) ? P.litWindow : P.windowGlassDark), trim);
    }
  }
  for (const y of [gH - 0.5, gH + fH - 0.4, gH + 2 * fH - 0.4, eave - 0.9]) {
    b.cylY(ccx, ccz, R + 0.3, y, y + 0.32, trim);
  }

  // east frontage (onto the square) and north frontage (onto the square's south edge)
  const faces = [
    { axis: 'x', dir: 1, plane: W.x1, from: W.z0 + 2.4, to: 80 - R - 1.5, step: 4.2 },
    { axis: 'z', dir: -1, plane: Sw.z0, from: -110 + R + 1.5, to: Sw.x1 - 2.4, step: 4.2 },
    { axis: 'z', dir: -1, plane: W.z0, from: W.x0 + 2.4, to: W.x1 - 2.4, step: 4.4 },
  ];
  for (const f of faces) {
    for (let u = f.from; u < f.to; u += f.step) {
      shopUnit(b, { axis: f.axis, dir: f.dir, plane: f.plane, uc: u, w: 2.8, y0: 1.4, h: 3.4, frame: P.doorWoodDark, fascia: P.awningRed, awning: rng.chance(0.3) });
      for (let fl = 0; fl < floors; fl++) {
        const y = gH + fl * fH;
        windowUnit(b, {
          axis: f.axis, dir: f.dir, plane: f.plane, uc: u, w: 1.65, y0: y + 1.0, h: fl === 0 ? 3.1 : 2.5, trim,
          glass: rng.chance(0.42) ? P.litWindow : P.windowGlassDark,
          head: fl === 0 ? 'pediment' : (fl === 1 ? 'segment' : 'cornice'),
          balcony: fl === 0 || (fl === 1 && rng.chance(0.4)),
        });
      }
    }
    for (const y of [gH - 0.5, gH + fH - 0.4, gH + 2 * fH - 0.4]) {
      if (f.axis === 'x') b.box(f.plane, y, W.z0 - 0.05, f.plane + 0.24, y + 0.32, W.z1 + 0.05, trim);
      else b.box(Math.min(f.from, f.to) - 3, y, f.plane - 0.24, Math.max(f.from, f.to) + 3, y + 0.32, f.plane, trim);
    }
  }

  cornice(b, W, eave - 0.9, 0.9, trim, true, P.ashlarDark);
  cornice(b, Sw, eave - 0.9, 0.9, trim, true, P.ashlarDark);
  b.cylY(ccx, ccz, R + 1.0, eave - 0.9, eave - 0.5, trim);

  // elaborate roofline: dark mansard, corner pavilion, iron cresting
  b.mansard(W.x0 - 0.8, W.z0 - 0.8, W.x1 + 0.8, W.z1 + 0.8, eave + 0.3, eave + 4.6, eave + 6.0, 6.5, P.roofSlate, P.roofRust);
  b.mansard(Sw.x0 - 0.8, Sw.z0 - 0.8, Sw.x1 + 0.8, Sw.z1 + 0.8, eave + 0.3, eave + 4.6, eave + 6.0, 6.5, P.roofSlate, P.roofRust);
  b.cylY(ccx, ccz, R + 0.8, eave + 0.3, eave + 2.6, P.roofSlate);
  helmetDome(b, ccx, ccz, R + 0.4, eave + 2.4, 10.5, P.roofSlate, P.copper);
  for (let z = W.z0 + 3; z < W.z1 - 3; z += 5.4) {
    if (Math.abs(z - 80) < 9) continue;
    b.box(W.x1 - 1.5, eave + 1.0, z - 1.0, W.x1 + 0.4, eave + 3.4, z + 1.0, P.beige);
    b.box(W.x1 + 0.1, eave + 1.5, z - 0.6, W.x1 + 0.5, eave + 2.9, z + 0.6, P.windowGlassDark);
    b.pyramid(W.x1 - 1.6, z - 1.2, W.x1 + 0.5, z + 1.2, eave + 3.4, eave + 4.4, P.roofSlate);
  }
  // rooftop iron cresting
  for (let z = W.z0; z < W.z1; z += 1.1) b.box(W.x1 - 5.6, eave + 6.0, z, W.x1 - 5.4, eave + 6.7, z + 0.35, P.iron);
  for (let x = Sw.x0; x < Sw.x1; x += 1.1) b.box(x, eave + 6.0, Sw.z0 + 5.6, x + 0.35, eave + 6.7, Sw.z0 + 5.8, P.iron);
  elevation(b, { axis: 'x', dir: -1, plane: W.x0, u0: W.z0, u1: W.z1, base: -0.2, gH, fH, floors, rng, step: 4.4 });
  elevation(b, { axis: 'z', dir: 1, plane: W.z1, u0: W.x0, u1: W.x1, base: -0.2, gH, fH, floors, rng, step: 4.4 });
  elevation(b, { axis: 'x', dir: 1, plane: Sw.x1, u0: Sw.z0, u1: Sw.z1, base: -0.2, gH, fH, floors, rng, step: 4.4 });
  elevation(b, { axis: 'z', dir: 1, plane: Sw.z1, u0: Sw.x0, u1: Sw.x1, base: -0.2, gH, fH, floors, rng, step: 4.4 });
  addChimneys(b, { x0: W.x0 + 3, z0: W.z0 + 3, x1: W.x1 - 3, z1: W.z1 - 3, axis: 'z' }, eave + 5.6, rng, 4);
  addChimneys(b, { x0: Sw.x0 + 3, z0: Sw.z0 + 3, x1: Sw.x1 - 3, z1: Sw.z1 - 3, axis: 'x' }, eave + 5.6, rng, 3);

  return [W, Sw];
}

// ---------------------------------------------------------------------------
// South side: Casa Sfatului (old town hall) and the National Bank
// ---------------------------------------------------------------------------
export function buildTownHall(b) {
  const rng = new Rng('casa-sfatului');
  const x0 = -26, x1 = 12, z0 = 80, z1 = 106;
  const wall = P.sand, trim = P.whiteStone;
  const gH = 5.0, fH = 4.1, floors = 2;
  const eave = gH + floors * fH + 0.5;
  const cxm = (x0 + x1) / 2;

  b.shell(x0, -1.5, z0, x1, eave, z1, wall, 1.1);
  b.box(x0 - 0.3, -1.5, z0 - 0.3, x1 + 0.3, 1.2, z1 + 0.3, P.greyStone);
  b.box(x0 - 0.3, 1.2, z0 - 0.3, x1 + 0.3, 1.45, z1 + 0.3, trim);
  for (let y = 1.45; y < gH - 0.4; y += 0.62) b.box(x0, y, z0 - 0.14, x1, y + 0.12, z0, P.ashlarDark);

  // central bay: arched gate under a clock gable
  archUnit(b, { axis: 'z', dir: -1, plane: z0, uc: cxm, w: 4.2, y0: 1.45, h: 6.0, trim, fill: P.doorWoodDark, depth: 1.4 });
  for (let i = 0; i < 8; i++) {
    const x = x0 + 2.6 + i * ((x1 - x0 - 5.2) / 7);
    if (Math.abs(x - cxm) < 3.4) continue;
    archUnit(b, { axis: 'z', dir: -1, plane: z0, uc: x, w: 2.4, y0: 1.45, h: 3.6, trim, fill: P.archGlass, depth: 0.7 });
    for (let f = 0; f < floors; f++) {
      const y = gH + f * fH;
      windowUnit(b, {
        axis: 'z', dir: -1, plane: z0, uc: x, w: 1.7, y0: y + 1.0, h: f === 0 ? 3.0 : 2.5, trim,
        glass: rng.chance(0.32) ? P.litWindow : P.windowGlassDark,
        head: f === 0 ? 'segment' : 'cornice', balcony: f === 0 && rng.chance(0.4),
      });
    }
  }
  for (let f = 0; f < floors; f++) {
    const y = gH + f * fH;
    windowUnit(b, {
      axis: 'z', dir: -1, plane: z0, uc: cxm, w: 2.2, y0: y + 1.0, h: f === 0 ? 3.4 : 2.6, trim,
      glass: P.windowGlass, head: 'pediment', balcony: f === 0, balconyAll: true,
    });
  }
  for (const y of [gH - 0.5, gH + fH - 0.4]) b.box(x0 - 0.1, y, z0 - 0.24, x1 + 0.1, y + 0.32, z0, trim);

  cornice(b, { x0, z0, x1, z1 }, eave - 0.9, 0.85, trim, true, P.ashlarDark);
  b.gableZ(x0 - 0.7, z0 - 0.7, x1 + 0.7, z1 + 0.7, eave + 0.2, eave + 8.5, roofTone(P.roofTerracotta, rng), 0.9, P.roofRust);

  // clock gable over the centre
  b.box(cxm - 5.0, eave + 0.2, z0 - 0.9, cxm + 5.0, eave + 4.6, z0 + 0.4, P.sand);
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    b.box(cxm - 5.0 * (1 - t), eave + 4.6 + i * 0.28, z0 - 0.9, cxm + 5.0 * (1 - t), eave + 4.9 + i * 0.28, z0 + 0.4, P.sand);
  }
  b.box(cxm - 5.4, eave + 4.4, z0 - 1.1, cxm + 5.4, eave + 4.8, z0 + 0.5, trim);
  // clock face
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    for (let r = 0; r <= 1.5; r += 0.24) {
      const px = cxm + Math.cos(a) * r, py = eave + 2.5 + Math.sin(a) * r;
      b.box(px - 0.14, py - 0.14, z0 - 1.05, px + 0.14, py + 0.14, z0 - 0.75, r > 1.25 ? P.whiteStone : P.ironDark);
    }
  }
  b.box(cxm - 0.1, eave + 2.5, z0 - 1.1, cxm + 0.1, eave + 3.6, z0 - 0.7, P.gold);
  b.box(cxm - 0.06, eave + 2.44, z0 - 1.1, cxm + 0.85, eave + 2.62, z0 - 0.7, P.gold);
  b.box(cxm - 0.16, eave + 7.9, z0 - 0.9, cxm + 0.16, eave + 10.4, z0 + 0.4, P.iron);
  b.box(cxm - 0.9, eave + 9.4, z0 - 0.5, cxm + 0.9, eave + 9.6, z0 + 0.1, P.gold);
  elevation(b, { axis: 'z', dir: 1, plane: z1, u0: x0, u1: x1, base: -0.2, gH, fH, floors, rng, step: 4.4 });
  elevation(b, { axis: 'x', dir: -1, plane: x0, u0: z0, u1: z1, base: -0.2, gH, fH, floors, rng, step: 4.6 });
  elevation(b, { axis: 'x', dir: 1, plane: x1, u0: z0, u1: z1, base: -0.2, gH, fH, floors, rng, step: 4.6 });
  addChimneys(b, { x0: x0 + 3, z0: z0 + 3, x1: x1 - 3, z1: z1 - 3, axis: 'x' }, eave + 8.0, rng, 3);
  return [{ x0, z0, x1, z1 }];
}

export function buildNationalBank(b) {
  const rng = new Rng('bnr');
  const x0 = 28, x1 = 64, z0 = 80, z1 = 106;
  const wall = P.beige, trim = P.whiteStone, stone = P.greyStone;
  const gH = 6.0, fH = 5.2, floors = 2;
  const eave = gH + floors * fH + 1.2;
  const cxm = (x0 + x1) / 2;

  b.shell(x0, -1.5, z0, x1, eave, z1, wall, 1.2);
  b.box(x0 - 0.4, -1.5, z0 - 0.4, x1 + 0.4, 1.4, z1 + 0.4, stone);
  b.box(x0 - 0.4, 1.4, z0 - 0.4, x1 + 0.4, 1.7, z1 + 0.4, trim);
  // heavily rusticated basement storey
  for (let y = 1.7; y < gH - 0.5; y += 0.66) {
    b.box(x0 - 0.22, y, z0 - 0.22, x1 + 0.22, y + 0.44, z0, ((y * 1.6) | 0) % 2 ? P.ashlar : P.greyStone);
  }
  // giant order of pilasters over the two upper storeys
  const bays = 7;
  for (let i = 0; i <= bays; i++) {
    const x = x0 + 2.6 + i * ((x1 - x0 - 5.2) / bays);
    b.box(x - 0.7, gH, z0 - 0.75, x + 0.7, eave - 1.4, z0, trim);
    b.box(x - 0.95, eave - 1.9, z0 - 0.95, x + 0.95, eave - 1.4, z0, P.whiteStone);
    b.box(x - 0.95, gH - 0.4, z0 - 0.95, x + 0.95, gH, z0, P.whiteStone);
    // fluting
    for (let k = -2; k <= 2; k++) {
      b.box(x + k * 0.26 - 0.05, gH + 0.3, z0 - 0.8, x + k * 0.26 + 0.05, eave - 1.9, z0 - 0.7, P.ashlarDark);
    }
  }
  for (let i = 0; i < bays; i++) {
    const x = x0 + 2.6 + (i + 0.5) * ((x1 - x0 - 5.2) / bays);
    archUnit(b, { axis: 'z', dir: -1, plane: z0, uc: x, w: 2.6, y0: 1.7, h: 4.0, trim, fill: P.archGlass, depth: 0.8 });
    windowUnit(b, { axis: 'z', dir: -1, plane: z0, uc: x, w: 1.8, y0: gH + 1.2, h: 3.6, trim, glass: rng.chance(0.3) ? P.litWindow : P.windowGlass, head: 'pediment' });
    windowUnit(b, { axis: 'z', dir: -1, plane: z0, uc: x, w: 1.7, y0: gH + fH + 1.0, h: 2.6, trim, glass: P.windowGlassDark, head: 'cornice' });
  }
  cornice(b, { x0, z0, x1, z1 }, eave - 1.3, 1.1, trim, true, P.ashlarDark);
  // central pediment
  const pw = 9.5;
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    b.box(cxm - pw * (1 - t), eave + 0.1 + i * 0.28, z0 - 1.1, cxm + pw * (1 - t), eave + 0.4 + i * 0.28, z0 + 0.5, P.beige);
  }
  b.box(cxm - pw - 0.6, eave - 0.35, z0 - 1.35, cxm + pw + 0.6, eave + 0.1, z0 + 0.6, trim);
  statue(b, cxm, eave + 4.9, z0 - 0.3, 2.8, P.whiteStone, 0);
  for (const s of [-1, 1]) statue(b, cxm + s * (pw - 1.5), eave + 0.4, z0 - 0.3, 2.2, P.whiteStone, s > 0 ? 1 : 0);
  balustrade(b, x0 - 0.4, z0 - 0.9, x1 + 0.4, z0 - 0.1, eave + 0.1, 1.4, P.whiteStone, trim);
  b.box(x0 - 0.6, eave + 1.5, z0 - 0.6, x1 + 0.6, eave + 2.0, z1 + 0.6, P.roofZinc);
  b.hipRoof(x0 - 0.6, z0 - 0.6, x1 + 0.6, z1 + 0.6, eave + 2.0, eave + 6.5, P.roofSlate, 0.9);
  elevation(b, { axis: 'z', dir: 1, plane: z1, u0: x0, u1: x1, base: -0.2, gH, fH, floors, rng, step: 4.6 });
  elevation(b, { axis: 'x', dir: -1, plane: x0, u0: z0, u1: z1, base: -0.2, gH, fH, floors, rng, step: 4.8 });
  elevation(b, { axis: 'x', dir: 1, plane: x1, u0: z0, u1: z1, base: -0.2, gH, fH, floors, rng, step: 4.8 });
  addChimneys(b, { x0: x0 + 3, z0: z0 + 3, x1: x1 - 3, z1: z1 - 3, axis: 'x' }, eave + 6.0, rng, 3);
  return [{ x0, z0, x1, z1 }];
}

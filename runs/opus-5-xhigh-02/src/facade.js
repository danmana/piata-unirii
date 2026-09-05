// Parametric historic facade builder.
//
// Cluj's square is enclosed by an almost continuous wall of 2-4 storey houses in a
// Baroque / Neoclassical / Historicist / Eclectic mix. Each building is generated
// from an explicit spec (width, storeys, palette, window rhythm, roof, ornament) so
// the frontages read as individual buildings rather than repeated procedural boxes.

import { P } from './palette.js';
import { Rng } from './rng.js';

// axis helpers: a facade plane is defined by (axis, dir, plane); `u` runs along it.
function place(b, axis, uA, uB, y0, y1, pA, pB, mat) {
  if (axis === 'z') b.box(uA, y0, pA, uB, y1, pB, mat);
  else b.box(pA, y0, uA, pB, y1, uB, mat);
}
function cut(b, axis, uA, uB, y0, y1, pA, pB) {
  if (axis === 'z') b.carve(uA, y0, pA, uB, y1, pB);
  else b.carve(pA, y0, uA, pB, y1, uB);
}

/** Rectangular window with surround, sill and a head treatment. */
export function windowUnit(b, o) {
  const vs = b.vs;
  const { axis, dir, plane, uc, w, y0, h } = o;
  const trim = o.trim ?? P.whiteStone;
  const glass = o.glass ?? P.windowGlass;
  const depth = o.depth ?? 0.65;
  const inner = plane - dir * depth;
  const cA = Math.min(plane + dir * 0.02, inner), cB = Math.max(plane + dir * 0.02, inner);
  const gA = Math.min(inner, inner + dir * vs), gB = Math.max(inner, inner + dir * vs);
  const u0 = uc - w / 2, u1 = uc + w / 2;

  cut(b, axis, u0, u1, y0, y0 + h, cA, cB);
  place(b, axis, u0, u1, y0, y0 + h - vs, gA, gB, glass);
  // glazing bars
  const bA = Math.min(inner + dir * vs, inner + dir * vs * 2), bB = Math.max(inner + dir * vs, inner + dir * vs * 2);
  place(b, axis, uc - vs / 2, uc + vs / 2, y0, y0 + h, bA, bB, trim);
  place(b, axis, u0, u1, y0 + h * 0.55, y0 + h * 0.55 + vs, bA, bB, trim);

  // surround, standing slightly proud of the wall
  const sA = Math.min(plane, plane + dir * 0.14), sB = Math.max(plane, plane + dir * 0.14);
  const t = Math.max(vs, 0.28);
  place(b, axis, u0 - t, u0, y0 - t, y0 + h + t, sA, sB, trim);
  place(b, axis, u1, u1 + t, y0 - t, y0 + h + t, sA, sB, trim);
  place(b, axis, u0 - t, u1 + t, y0 + h, y0 + h + t, sA, sB, trim);

  // sill
  const wA = Math.min(plane, plane + dir * 0.3), wB = Math.max(plane, plane + dir * 0.3);
  place(b, axis, u0 - t - 0.15, u1 + t + 0.15, y0 - t - 0.2, y0 - t, wA, wB, trim);

  // head treatment
  const hA = Math.min(plane, plane + dir * 0.34), hB = Math.max(plane, plane + dir * 0.34);
  if (o.head === 'pediment') {
    const hw = w / 2 + t + 0.35;
    const steps = Math.max(3, Math.round(hw / vs / 1.4));
    for (let i = 0; i < steps; i++) {
      const f = i / steps;
      place(b, axis, uc - hw * (1 - f), uc + hw * (1 - f), y0 + h + t + i * vs, y0 + h + t + (i + 1) * vs, hA, hB, trim);
    }
  } else if (o.head === 'segment') {
    const hw = w / 2 + t + 0.3;
    for (let u = uc - hw; u < uc + hw; u += vs) {
      const k = (u + vs / 2 - uc) / hw;
      const rise = Math.sqrt(Math.max(0, 1 - k * k)) * 0.6;
      place(b, axis, u, u + vs, y0 + h + t, y0 + h + t + Math.max(vs, rise), hA, hB, trim);
    }
  } else if (o.head === 'cornice') {
    place(b, axis, uc - w / 2 - t - 0.4, uc + w / 2 + t + 0.4, y0 + h + t, y0 + h + t + 0.28, hA, hB, trim);
  }

  // balcony
  if (o.balcony) {
    const bw = w / 2 + t + 0.55;
    const pr = 1.0;
    const dA = Math.min(plane, plane + dir * pr), dB = Math.max(plane, plane + dir * pr);
    place(b, axis, uc - bw, uc + bw, y0 - t - 0.45, y0 - t - 0.2, dA, dB, trim);
    // consoles
    for (const s of [-1, 1]) {
      const cu = uc + s * (bw - 0.35);
      const kA = Math.min(plane, plane + dir * (pr * 0.6)), kB = Math.max(plane, plane + dir * (pr * 0.6));
      place(b, axis, cu - 0.22, cu + 0.22, y0 - t - 1.0, y0 - t - 0.45, kA, kB, trim);
    }
    // railing
    const rail = o.railMat ?? P.iron;
    const rA = Math.min(plane + dir * (pr - vs), plane + dir * pr), rB = Math.max(plane + dir * (pr - vs), plane + dir * pr);
    for (let u = uc - bw; u <= uc + bw; u += Math.max(vs * 2, 0.34)) {
      place(b, axis, u, u + vs, y0 - t - 0.2, y0 + 0.75, rA, rB, rail);
    }
    place(b, axis, uc - bw, uc + bw, y0 + 0.68, y0 + 0.82, rA, rB, rail);
    for (const s of [-1, 1]) {
      const cu = uc + s * bw;
      const sideA = Math.min(plane, plane + dir * pr), sideB = Math.max(plane, plane + dir * pr);
      place(b, axis, cu, cu + vs, y0 - t - 0.2, y0 + 0.82, sideA, sideB, rail);
    }
  }
}

/** Round-arched opening: shop arcade, carriage entrance, loggia bay. */
export function archUnit(b, o) {
  const vs = b.vs;
  const { axis, dir, plane, uc, w, y0, h } = o;
  const trim = o.trim ?? P.whiteStone;
  const fill = o.fill ?? P.shopGlass;
  const depth = o.depth ?? 0.8;
  const inner = plane - dir * depth;
  const cA = Math.min(plane + dir * 0.02, inner), cB = Math.max(plane + dir * 0.02, inner);
  const gA = Math.min(inner, inner + dir * vs), gB = Math.max(inner, inner + dir * vs);
  const hw = w / 2;
  const spring = y0 + h - hw;

  for (let u = uc - hw; u < uc + hw - 1e-6; u += vs) {
    const du = Math.abs(u + vs / 2 - uc);
    const top = du >= hw ? y0 : spring + Math.sqrt(Math.max(0, hw * hw - du * du));
    if (top <= y0 + vs) continue;
    cut(b, axis, u, u + vs, y0, top, cA, cB);
    place(b, axis, u, u + vs, y0, top - vs, gA, gB, fill);
  }
  // archivolt
  const sA = Math.min(plane, plane + dir * 0.16), sB = Math.max(plane, plane + dir * 0.16);
  const t = Math.max(vs, 0.3);
  for (let u = uc - hw - t; u < uc + hw + t; u += vs) {
    const du = Math.abs(u + vs / 2 - uc);
    if (du <= hw + t) {
      const top = du >= hw + t ? spring : spring + Math.sqrt(Math.max(0, (hw + t) * (hw + t) - du * du));
      const bot = du >= hw ? y0 : spring + Math.sqrt(Math.max(0, hw * hw - du * du));
      if (top > bot) place(b, axis, u, u + vs, Math.max(bot, spring - 0.1), top, sA, sB, trim);
    }
  }
  place(b, axis, uc - hw - t, uc - hw, y0, spring, sA, sB, trim);
  place(b, axis, uc + hw, uc + hw + t, y0, spring, sA, sB, trim);
  // keystone
  place(b, axis, uc - 0.28, uc + 0.28, spring + hw - 0.2, spring + hw + t + 0.35,
    Math.min(plane, plane + dir * 0.3), Math.max(plane, plane + dir * 0.3), trim);
}

/** Shopfront: dark glazing, timber frame, fascia board and sometimes an awning. */
export function shopUnit(b, o) {
  const vs = b.vs;
  const { axis, dir, plane, uc, w, y0, h } = o;
  const frame = o.frame ?? P.doorWood;
  const depth = 0.6;
  const inner = plane - dir * depth;
  const cA = Math.min(plane + dir * 0.02, inner), cB = Math.max(plane + dir * 0.02, inner);
  const gA = Math.min(inner, inner + dir * vs), gB = Math.max(inner, inner + dir * vs);
  cut(b, axis, uc - w / 2, uc + w / 2, y0, y0 + h, cA, cB);
  place(b, axis, uc - w / 2, uc + w / 2, y0, y0 + h, gA, gB, P.shopGlass);
  const fA = Math.min(plane, plane + dir * 0.12), fB = Math.max(plane, plane + dir * 0.12);
  place(b, axis, uc - w / 2 - vs, uc - w / 2, y0, y0 + h + 0.3, fA, fB, frame);
  place(b, axis, uc + w / 2, uc + w / 2 + vs, y0, y0 + h + 0.3, fA, fB, frame);
  place(b, axis, uc - w / 2 - vs, uc + w / 2 + vs, y0 + h, y0 + h + 0.3, fA, fB, frame);
  // fascia
  const sA = Math.min(plane, plane + dir * 0.22), sB = Math.max(plane, plane + dir * 0.22);
  place(b, axis, uc - w / 2 - vs, uc + w / 2 + vs, y0 + h + 0.3, y0 + h + 0.95, sA, sB, o.fascia ?? P.doorWoodDark);
  if (o.awning) {
    const aw = o.awningMat ?? P.awningCream;
    const steps = 5;
    for (let i = 0; i < steps; i++) {
      const f = i / steps;
      const pA = Math.min(plane + dir * (0.25 + f * 1.5), plane + dir * (0.25 + (f + 1 / steps) * 1.5));
      const pB = Math.max(plane + dir * (0.25 + f * 1.5), plane + dir * (0.25 + (f + 1 / steps) * 1.5));
      place(b, axis, uc - w / 2 - 0.2, uc + w / 2 + 0.2, y0 + h + 1.0 - f * 0.45, y0 + h + 1.2 - f * 0.45, pA, pB, aw);
    }
  }
}

/** Projecting cornice band with optional dentils. */
export function cornice(b, box, y, proj, mat, dentils, dMat) {
  b.box(box.x0 - proj, y, box.z0 - proj, box.x1 + proj, y + 0.34, box.z1 + proj, mat);
  b.box(box.x0 - proj * 0.55, y - 0.3, box.z0 - proj * 0.55, box.x1 + proj * 0.55, y, box.z1 + proj * 0.55, mat);
  if (dentils) {
    const dm = dMat ?? mat;
    const step = Math.max(b.vs * 2, 0.7);
    for (let x = box.x0 - proj; x < box.x1 + proj; x += step) {
      b.box(x, y - 0.62, box.z0 - proj * 0.8, x + step * 0.5, y - 0.3, box.z0 - proj * 0.2, dm);
      b.box(x, y - 0.62, box.z1 + proj * 0.2, x + step * 0.5, y - 0.3, box.z1 + proj * 0.8, dm);
    }
    for (let z = box.z0 - proj; z < box.z1 + proj; z += step) {
      b.box(box.x0 - proj * 0.8, y - 0.62, z, box.x0 - proj * 0.2, y - 0.3, z + step * 0.5, dm);
      b.box(box.x1 + proj * 0.2, y - 0.62, z, box.x1 + proj * 0.8, y - 0.3, z + step * 0.5, dm);
    }
  }
}

const ROOF_PALETTE = [P.roofOrange, P.roofTerracotta, P.roofRust, P.roofRed, P.roofBrown, P.roofPale];

/** Slightly patchy clay tiling so no two roofs read as the same flat colour. */
export function roofTone(base, rng) {
  const alt = rng.pick(ROOF_PALETTE);
  return (x, z) => {
    const n = Math.sin(x * 0.83 + z * 0.61) * 0.5 + Math.sin(x * 0.31 - z * 0.47) * 0.5;
    return n > 0.62 ? alt : base;
  };
}

export function addChimneys(b, spec, ridgeY, rng, count) {
  const { x0, x1, z0, z1 } = spec;
  for (let i = 0; i < count; i++) {
    const along = spec.axis === 'x';
    const cxp = along ? rng.range(x0 + 2, x1 - 2) : (x0 + x1) / 2 + rng.range(-1.2, 1.2);
    const czp = along ? (z0 + z1) / 2 + rng.range(-1.2, 1.2) : rng.range(z0 + 2, z1 - 2);
    const w = rng.range(0.7, 1.15), h = rng.range(1.4, 2.6);
    const m = rng.chance(0.5) ? P.ochreDeep : P.beige;
    b.box(cxp - w / 2, ridgeY - 1.4, czp - w / 2, cxp + w / 2, ridgeY + h, czp + w / 2, m);
    b.box(cxp - w / 2 - 0.18, ridgeY + h, czp - w / 2 - 0.18, cxp + w / 2 + 0.18, ridgeY + h + 0.3, czp + w / 2 + 0.18, P.greyStoneDark);
    for (const s of [-1, 1]) {
      b.box(cxp + s * w * 0.22 - 0.1, ridgeY + h + 0.3, czp - 0.1, cxp + s * w * 0.22 + 0.1, ridgeY + h + 0.55, czp + 0.1, P.ironDark);
    }
  }
}

function addDormers(b, spec, eave, ridge, rng, count, roofMat) {
  const along = spec.axis === 'x';
  const mid = along ? (spec.z0 + spec.z1) / 2 : (spec.x0 + spec.x1) / 2;
  const half = along ? (spec.z1 - spec.z0) / 2 : (spec.x1 - spec.x0) / 2;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const u = along ? spec.x0 + 1.5 + t * (spec.x1 - spec.x0 - 3) : spec.z0 + 1.5 + t * (spec.z1 - spec.z0 - 3);
    for (const side of [-1, 1]) {
      if (rng.chance(0.35)) continue;
      const frac = 0.42;
      const p = mid + side * half * frac;
      const y = eave + (ridge - eave) * (1 - frac);
      const w = 1.5, d = 1.5;
      if (along) {
        b.box(u - w / 2, y - 0.4, p - d / 2, u + w / 2, y + 1.5, p + d / 2, P.beige);
        b.box(u - w / 2 + 0.35, y + 0.15, p + side * (d / 2 - 0.3), u + w / 2 - 0.35, y + 1.2, p + side * (d / 2 + 0.1), P.windowGlass);
        b.pyramid(u - w / 2 - 0.2, p - d / 2 - 0.2, u + w / 2 + 0.2, p + d / 2 + 0.2, y + 1.5, y + 2.3, roofMat);
      } else {
        b.box(p - d / 2, y - 0.4, u - w / 2, p + d / 2, y + 1.5, u + w / 2, P.beige);
        b.box(p + side * (d / 2 - 0.3), y + 0.15, u - w / 2 + 0.35, p + side * (d / 2 + 0.1), y + 1.2, u + w / 2 - 0.35, P.windowGlass);
        b.pyramid(p - d / 2 - 0.2, u - w / 2 - 0.2, p + d / 2 + 0.2, u + w / 2 + 0.2, y + 1.5, y + 2.3, roofMat);
      }
    }
  }
}

/**
 * Build one historic townhouse / palace frontage.
 * spec: { x0,z0,x1,z1, front:'N'|'S'|'E'|'W', base, floors, wall, trim, roofMat,
 *         roofType, bays, seed, ... }
 */
export function buildFacade(b, spec) {
  const rng = new Rng(spec.seed ?? 'facade');
  const { x0, z0, x1, z1 } = spec;
  const base = spec.base ?? 0;
  const floors = spec.floors ?? 3;
  const groundH = spec.groundH ?? 4.5;
  const floorH = spec.floorH ?? 3.6;
  const wall = spec.wall ?? P.cream;
  const trim = spec.trim ?? P.whiteStone;
  const plinthM = spec.plinth ?? P.greyStone;
  const eave = base + groundH + floors * floorH + (spec.parapet ? 0.9 : 0.4);
  const wallT = spec.wallT ?? Math.max(0.8, b.vs * 3);

  const front = spec.front;
  const axis = (front === 'N' || front === 'S') ? 'x' : 'z';
  const dir = (front === 'S' || front === 'E') ? 1 : -1;
  const plane = front === 'N' ? z0 : front === 'S' ? z1 : front === 'W' ? x0 : x1;
  const uA = axis === 'x' ? x0 : z0, uB = axis === 'x' ? x1 : z1;
  const width = uB - uA;

  // ---- mass ----
  if (spec.courtyard && Math.min(x1 - x0, z1 - z0) > 26) {
    const m = 9;
    b.shell(x0, base - 1.5, z0, x1, eave, z0 + m, wall, wallT);
    b.shell(x0, base - 1.5, z1 - m, x1, eave, z1, wall, wallT);
    b.shell(x0, base - 1.5, z0 + m, x0 + m, eave, z1 - m, wall, wallT);
    b.shell(x1 - m, base - 1.5, z0 + m, x1, eave, z1 - m, wall, wallT);
  } else {
    b.shell(x0, base - 1.5, z0, x1, eave, z1, wall, wallT);
  }

  // plinth
  b.box(x0 - 0.2, base - 1.5, z0 - 0.2, x1 + 0.2, base + 1.0, z1 + 0.2, plinthM);
  b.box(x0 - 0.2, base + 1.0, z0 - 0.2, x1 + 0.2, base + 1.2, z1 + 0.2, trim);

  // optional rustication on the ground storey (front only)
  if (spec.rustication) {
    for (let y = base + 1.2; y < base + groundH - 0.2; y += 0.7) {
      place(b, axis, uA, uB, y, y + 0.12, Math.min(plane, plane + dir * 0.12), Math.max(plane, plane + dir * 0.12), P.ashlarDark);
    }
  }
  // quoins at the corners
  if (spec.quoins) {
    for (const [qx, qz] of [[x0, z0], [x1 - 0.9, z0], [x0, z1 - 0.9], [x1 - 0.9, z1 - 0.9]]) {
      for (let y = base + 1.2; y < eave - 1.0; y += 1.4) {
        const w = ((y / 1.4) | 0) % 2 ? 0.9 : 0.6;
        b.box(qx - 0.12, y, qz - 0.12, qx + w + 0.12, y + 0.7, qz + w + 0.12, trim);
      }
    }
  }

  // ---- ground storey openings ----
  const bays = spec.bays ?? Math.max(3, Math.round(width / 3.6));
  const bayW = width / bays;
  const gY = base + 1.2;
  const gH = groundH - 1.6;
  const entryBay = spec.entryBay ?? Math.floor(bays / 2);
  for (let i = 0; i < bays; i++) {
    const uc = uA + (i + 0.5) * bayW;
    if (i === entryBay && spec.entry !== false) {
      archUnit(b, { axis, dir, plane, uc, w: Math.min(bayW - 1.0, 3.0), y0: gY, h: gH + 0.4, trim, fill: rng.chance(0.5) ? P.doorWoodDark : P.archGlass });
    } else if (spec.arcade) {
      archUnit(b, { axis, dir, plane, uc, w: Math.min(bayW - 0.9, 3.2), y0: gY, h: gH + 0.3, trim, fill: P.archGlass });
    } else if (spec.shops !== false && bayW > 2.6) {
      shopUnit(b, {
        axis, dir, plane, uc, w: Math.min(bayW - 1.1, 3.0), y0: gY, h: gH - 0.4,
        frame: rng.pick([P.doorWood, P.doorWoodDark, P.cafeWood]),
        fascia: rng.pick([P.doorWoodDark, P.awningGreen, P.awningRed]),
        awning: rng.chance(0.42), awningMat: rng.pick([P.awningCream, P.awningRed, P.awningGreen]),
      });
    } else {
      windowUnit(b, { axis, dir, plane, uc, w: Math.min(1.5, bayW - 1.2), y0: gY + 0.6, h: gH - 1.2, trim, glass: P.windowGlassDark, head: 'cornice' });
    }
  }

  // cordon above the ground storey
  place(b, axis, uA - 0.15, uB + 0.15, base + groundH - 0.45, base + groundH - 0.1,
    Math.min(plane, plane + dir * 0.28), Math.max(plane, plane + dir * 0.28), trim);

  // ---- upper storeys ----
  const litChance = spec.litChance ?? 0.34;
  for (let f = 0; f < floors; f++) {
    const fy = base + groundH + f * floorH;
    const piano = f === 0 && floors > 1;
    const wh = piano ? Math.min(floorH - 0.9, 2.85) : Math.min(floorH - 1.1, 2.4);
    const ww = spec.winW ?? Math.min(1.55, bayW - 1.5);
    for (let i = 0; i < bays; i++) {
      const uc = uA + (i + 0.5) * bayW;
      const head = piano ? (spec.pianoHead ?? 'pediment')
        : (f === floors - 1 ? 'cornice' : rng.pick(['cornice', 'segment', 'cornice']));
      windowUnit(b, {
        axis, dir, plane, uc, w: ww, y0: fy + 0.85, h: wh, trim,
        glass: rng.chance(litChance) ? P.litWindow : (rng.chance(0.5) ? P.windowGlass : P.windowGlassDark),
        head,
        balcony: piano && spec.balconies !== false && (spec.balconyAll || i === entryBay || (bays > 4 && rng.chance(0.28))),
      });
    }
    // storey band
    if (f < floors - 1 && spec.bands !== false) {
      place(b, axis, uA - 0.1, uB + 0.1, fy + floorH - 0.4, fy + floorH - 0.18,
        Math.min(plane, plane + dir * 0.2), Math.max(plane, plane + dir * 0.2), trim);
    }
  }

  // ---- flank and rear windows (plainer) ----
  const flanks = [];
  if (axis === 'x') {
    flanks.push({ axis: 'z', dir: -dir, plane: dir > 0 ? z0 : z1, uA: x0, uB: x1 });
    flanks.push({ axis: 'x', dir: -1, plane: x0, uA: z0, uB: z1 });
    flanks.push({ axis: 'x', dir: 1, plane: x1, uA: z0, uB: z1 });
  } else {
    flanks.push({ axis: 'x', dir: -dir, plane: dir > 0 ? x0 : x1, uA: z0, uB: z1 });
    flanks.push({ axis: 'z', dir: -1, plane: z0, uA: x0, uB: x1 });
    flanks.push({ axis: 'z', dir: 1, plane: z1, uA: x0, uB: x1 });
  }
  for (const fl of flanks) {
    if (spec.blindFlanks) continue;
    const n = Math.max(1, Math.floor((fl.uB - fl.uA) / 4.2));
    const step = (fl.uB - fl.uA) / n;
    for (let f = 0; f < floors; f++) {
      const fy = base + groundH + f * floorH;
      for (let i = 0; i < n; i++) {
        const uc = fl.uA + (i + 0.5) * step;
        if (uc < fl.uA + 1.4 || uc > fl.uB - 1.4) continue;
        windowUnit(b, {
          axis: fl.axis, dir: fl.dir, plane: fl.plane, uc, w: 1.2, y0: fy + 1.0, h: 2.1, trim,
          glass: rng.chance(litChance * 0.7) ? P.litWindow : P.windowGlassDark, depth: 0.45,
        });
      }
    }
  }

  // ---- cornice + roof ----
  cornice(b, { x0, z0, x1, z1 }, eave - 0.9, spec.corniceProj ?? 0.75, trim, spec.dentils !== false, P.ashlarDark);
  if (spec.parapet) {
    b.box(x0 - 0.35, eave - 0.1, z0 - 0.35, x1 + 0.35, eave + 0.9, z1 + 0.35, wall);
    b.box(x0 - 0.5, eave + 0.9, z0 - 0.5, x1 + 0.5, eave + 1.15, z1 + 0.5, trim);
  }

  const roofBase = spec.parapet ? eave + 0.6 : eave;
  const rm = spec.roofMat ?? P.roofOrange;
  const tone = spec.flatRoofTone ? rm : roofTone(rm, rng);
  const ridgeAxis = spec.ridge ?? (axis === 'x' ? 'x' : 'z');
  const pitch = spec.pitch ?? rng.range(0.62, 0.8);
  const span = ridgeAxis === 'x' ? (z1 - z0) : (x1 - x0);
  const ridgeY = roofBase + span / 2 * pitch;
  const ov = spec.eaveOverhang ?? 0.55;

  if (spec.roofType === 'flat') {
    b.box(x0 - 0.3, roofBase, z0 - 0.3, x1 + 0.3, roofBase + 0.35, z1 + 0.3, P.roofZinc);
  } else if (spec.roofType === 'mansard') {
    const brk = roofBase + span * 0.30;
    b.mansard(x0 - ov, z0 - ov, x1 + ov, z1 + ov, roofBase, brk, brk + span * 0.13,
      Math.min(x1 - x0, z1 - z0) * 0.26, spec.mansardMat ?? P.roofSlate, rm);
  } else if (spec.roofType === 'hip') {
    b.hipRoof(x0 - ov, z0 - ov, x1 + ov, z1 + ov, roofBase, ridgeY, tone, 0.9);
  } else if (ridgeAxis === 'x') {
    b.gableX(x0 - ov, z0 - ov, x1 + ov, z1 + ov, roofBase, ridgeY, tone, 0.9, P.roofRust);
    // gable end walls
    b.gableZ(x0 - 0.1, z0, x0, z1, roofBase, ridgeY, wall, 0.4);
    b.gableZ(x1, z0, x1 + 0.1, z1, roofBase, ridgeY, wall, 0.4);
  } else {
    b.gableZ(x0 - ov, z0 - ov, x1 + ov, z1 + ov, roofBase, ridgeY, tone, 0.9, P.roofRust);
    b.gableX(x0, z0 - 0.1, x1, z0, roofBase, ridgeY, wall, 0.4);
    b.gableX(x0, z1, x1, z1 + 0.1, roofBase, ridgeY, wall, 0.4);
  }

  if (spec.roofType !== 'flat') {
    const dn = spec.dormers ?? (width > 14 ? 2 : (width > 9 ? 1 : 0));
    if (dn > 0) addDormers(b, { x0, z0, x1, z1, axis: ridgeAxis }, roofBase, ridgeY, rng, dn, rm);
    addChimneys(b, { x0, z0, x1, z1, axis: ridgeAxis }, ridgeY, rng, spec.chimneys ?? (width > 16 ? 3 : 2));
  }

  return { eave, ridgeY };
}

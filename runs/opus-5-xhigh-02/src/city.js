// Zone C (the four frontages of Piata Unirii) and Zone D (the old-town fabric
// spreading outward along the radiating streets).
//
// The square's frontages are an explicit, hand-laid table of buildings with
// irregular historic widths - not a procedural repeat - so the named houses land
// where they belong. Everything past the square is placed with an occupancy grid.

import { P } from './palette.js';
import { Rng } from './rng.js';
import { buildFacade } from './facade.js';
import {
  FRONTAGE, STREETS, MAP, SQUARE, terrainHeight, polylineLength, polylineAt, streetBounds, distToPolyline,
} from './layout.js';

// Curated wall / trim / roof combinations: cream, ochre, pale yellow, dusty pink,
// pale green, soft grey - the Transylvanian old-town range, nothing saturated.
const COMBOS = [
  { wall: P.cream, trim: P.whiteStone, roof: P.roofOrange },
  { wall: P.paleYellow, trim: P.ivory, roof: P.roofTerracotta },
  { wall: P.ochre, trim: P.whiteStone, roof: P.roofRust },
  { wall: P.beige, trim: P.ivory, roof: P.roofRed },
  { wall: P.dustyPink, trim: P.whiteStone, roof: P.roofTerracotta },
  { wall: P.paleGreen, trim: P.ivory, roof: P.roofBrown },
  { wall: P.softGrey, trim: P.whiteStone, roof: P.roofRust },
  { wall: P.ivory, trim: P.greyStone, roof: P.roofOrange },
  { wall: P.sand, trim: P.whiteStone, roof: P.roofPale },
  { wall: P.mutedPink, trim: P.ivory, roof: P.roofRed },
  { wall: P.fadedGreen, trim: P.whiteStone, roof: P.roofBrown },
  { wall: P.terracottaWash, trim: P.ivory, roof: P.roofRust },
  { wall: P.lilacGrey, trim: P.whiteStone, roof: P.roofSlate },
  { wall: P.paleBlueGrey, trim: P.ivory, roof: P.roofTerracotta },
];

// ---------------------------------------------------------------------------
// The four frontages. Widths are deliberately uneven; `n` marks a named house.
// ---------------------------------------------------------------------------
const NORTH = [
  { x0: -110, x1: -95, floors: 2, c: 3, roofType: 'gable' },
  { x0: -95, x1: -81, floors: 3, c: 0, ridge: 'z' },
  { x0: -81, x1: -66, floors: 2, c: 8 },
  { x0: -54, x1: -32, n: 'Mauksch–Hintz House', floors: 3, c: 4, quoins: true, arcade: true, pianoHead: 'pediment', roofType: 'gable', dormers: 3 },
  { x0: -32, x1: -18, floors: 2, c: 5, ridge: 'z' },
  { x0: -18, x1: -2, floors: 3, c: 1 },
  { x0: -2, x1: 22, n: 'Kemény Palace', floors: 3, c: 13, quoins: true, rustication: true, balconyAll: true, roofType: 'mansard', groundH: 5.2, floorH: 4.0 },
  { x0: 22, x1: 36, floors: 2, c: 9 },
  { x0: 36, x1: 52, n: 'Rucska House', floors: 3, c: 2, pianoHead: 'segment', dormers: 2 },
  { x0: 52, x1: 62, floors: 2, c: 6, ridge: 'z' },
  { x0: 78, x1: 96, floors: 3, c: 7, arcade: true },
  { x0: 96, x1: 112, floors: 2, c: 11 },
];

const SOUTH = [
  { x0: -82, x1: -70, floors: 3, c: 12, ridge: 'z' },
  { x0: -70, x1: -58, floors: 2, c: 1 },
  { x0: -46, x1: -34, floors: 3, c: 6 },
  { x0: -34, x1: -26, floors: 2, c: 8, ridge: 'z' },
  { x0: 12, x1: 28, floors: 3, c: 10, quoins: true },
  { x0: 64, x1: 76, floors: 3, c: 4, ridge: 'z' },
  { x0: 76, x1: 90, floors: 2, c: 0 },
];

const EAST = [
  { z0: -82, z1: -70, floors: 3, c: 5 },
  { z0: -70, z1: -60, floors: 2, c: 9, ridge: 'x' },
  { z0: 62, z1: 74, floors: 3, c: 2 },
  { z0: 74, z1: 84, floors: 2, c: 11, ridge: 'x' },
];

const WEST = [
  { z0: -82, z1: -64, n: 'Wass House', floors: 3, c: 0, quoins: true, pianoHead: 'pediment' },
  { z0: -64, z1: -52, floors: 2, c: 7 },
  { z0: -52, z1: -40, floors: 3, c: 3, ridge: 'x' },
  { z0: -28, z1: -18, floors: 2, c: 10 },
  { z0: -18, z1: 6, n: 'Rhédey Palace', floors: 3, c: 1, quoins: true, rustication: true, balconyAll: true, roofType: 'mansard', groundH: 5.2, floorH: 4.0, dormers: 3 },
  { z0: 6, z1: 14, floors: 2, c: 12, ridge: 'x' },
  { z0: 14, z1: 34, n: 'Jósika Palace', floors: 3, c: 8, quoins: true, pianoHead: 'pediment', arcade: true },
  { z0: 34, z1: 44, floors: 2, c: 5 },
];

function frontageSide(b, side, table, footprints, rngSeed) {
  const F = FRONTAGE[side];
  const rng = new Rng(rngSeed);
  let i = 0;
  for (const s of table) {
    i++;
    const combo = COMBOS[s.c % COMBOS.length];
    const depth = s.depth ?? F.depth + rng.range(-2.5, 3.5);
    let x0, x1, z0, z1, front;
    if (side === 'north') { x0 = s.x0; x1 = s.x1; z1 = F.line; z0 = F.line - depth; front = 'S'; }
    else if (side === 'south') { x0 = s.x0; x1 = s.x1; z0 = F.line; z1 = F.line + depth; front = 'N'; }
    else if (side === 'west') { z0 = s.z0; z1 = s.z1; x1 = F.line; x0 = F.line - depth; front = 'E'; }
    else { z0 = s.z0; z1 = s.z1; x0 = F.line; x1 = F.line + depth; front = 'W'; }

    const cxm = (x0 + x1) / 2, czm = (z0 + z1) / 2;
    const base = Math.min(0, terrainHeight(cxm, czm));
    const width = side === 'north' || side === 'south' ? x1 - x0 : z1 - z0;
    const built = buildFacade(b, Object.assign({
      x0, z0, x1, z1, front, base,
      floors: s.floors ?? 3,
      groundH: s.groundH ?? rng.range(4.2, 5.0),
      floorH: s.floorH ?? rng.range(3.4, 3.9),
      wall: combo.wall, trim: combo.trim, roofMat: combo.roof,
      roofType: s.roofType ?? rng.pick(['gable', 'gable', 'gable', 'hip']),
      ridge: s.ridge ?? (side === 'north' || side === 'south' ? 'x' : 'z'),
      bays: s.bays ?? Math.max(3, Math.round(width / 3.9)),
      seed: side + '-' + i,
      litChance: 0.34,
      pitch: rng.range(0.66, 0.86),
    }, s));
    footprints.push({ x0, z0, x1, z1, base, h: built.ridgeY, name: s.n });
  }
}

export function buildFrontages(b, footprints) {
  frontageSide(b, 'north', NORTH, footprints, 'front-n');
  frontageSide(b, 'south', SOUTH, footprints, 'front-s');
  frontageSide(b, 'east', EAST, footprints, 'front-e');
  frontageSide(b, 'west', WEST, footprints, 'front-w');
}

// ---------------------------------------------------------------------------
// Zone D - the surrounding old town.
// ---------------------------------------------------------------------------

export function reserveInfrastructure(occ) {
  occ.markRect(SQUARE.x0 - 4, SQUARE.z0 - 4, SQUARE.x1 + 4, SQUARE.z1 + 4);
  for (const s of STREETS) {
    const hw = s.width / 2 + 3.6;
    for (let i = 0; i < s.pts.length - 1; i++) {
      const [ax, az] = s.pts[i], [bx, bz] = s.pts[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(L / 3));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        occ.markRect(x - hw, z - hw, x + hw, z + hw);
      }
    }
  }
}

/**
 * Fill the blocks that line the radiating streets. Every candidate footprint is
 * collision-tested against the occupancy grid; ten failures and the slot is skipped.
 */
export function buildOldTown(b, occ, footprints, budget = 150) {
  const rng = new Rng('old-town');
  let placed = 0;
  const order = STREETS.filter((s) => !s.ring);
  // near the square first, so the best slots go to the buildings that matter
  const scored = [];
  for (const s of order) {
    const L = polylineLength(s.pts);
    const step = 11;
    for (let d = 8; d < L - 8; d += step) {
      const p = polylineAt(s.pts, d);
      for (const side of [-1, 1]) {
        const dist = Math.hypot(p.x, p.z);
        scored.push({ s, d, side, p, dist });
      }
    }
  }
  scored.sort((a, b2) => a.dist - b2.dist);

  for (const cand of scored) {
    if (placed >= budget) break;
    const { s, p, side } = cand;
    const nx = -p.dz * side, nz = p.dx * side;
    const along = Math.abs(p.dx) > Math.abs(p.dz);
    const setback = s.width / 2 + 3.4;

    let ok = false, rect = null, front = null;
    for (let attempt = 0; attempt < 10 && !ok; attempt++) {
      const w = rng.range(11, 21) - attempt * 0.7;
      const depth = rng.range(12, 19) - attempt * 0.4;
      if (w < 7 || depth < 7) break;
      const cxm = p.x + nx * (setback + depth / 2) + (attempt ? rng.range(-3, 3) : 0);
      const czm = p.z + nz * (setback + depth / 2) + (attempt ? rng.range(-3, 3) : 0);
      let hx, hz;
      if (along) { hx = w / 2; hz = depth / 2; front = nz > 0 ? 'N' : 'S'; }
      else { hx = depth / 2; hz = w / 2; front = nx > 0 ? 'W' : 'E'; }
      const r = { x0: cxm - hx, z0: czm - hz, x1: cxm + hx, z1: czm + hz };
      if (r.x0 < MAP.x0 + 8 || r.x1 > MAP.x1 - 8 || r.z0 < MAP.z0 + 8 || r.z1 > MAP.z1 - 8) continue;
      if (!occ.freeRect(r.x0 - 1.5, r.z0 - 1.5, r.x1 + 1.5, r.z1 + 1.5)) continue;
      rect = r; ok = true;
    }
    if (!ok) continue;

    occ.markRect(rect.x0 - 1.0, rect.z0 - 1.0, rect.x1 + 1.0, rect.z1 + 1.0);
    const cxm = (rect.x0 + rect.x1) / 2, czm = (rect.z0 + rect.z1) / 2;
    const base = terrainHeight(cxm, czm);
    const combo = COMBOS[rng.int(0, COMBOS.length - 1)];
    const width = along ? rect.x1 - rect.x0 : rect.z1 - rect.z0;
    const dist = Math.hypot(cxm, czm);
    const floors = dist < 200 ? rng.int(2, 3) : rng.int(1, 3);
    const built = buildFacade(b, {
      x0: rect.x0, z0: rect.z0, x1: rect.x1, z1: rect.z1, front, base,
      floors, groundH: rng.range(3.9, 4.6), floorH: rng.range(3.2, 3.7),
      wall: combo.wall, trim: combo.trim, roofMat: combo.roof,
      roofType: rng.pick(['gable', 'gable', 'hip', 'gable']),
      ridge: along ? 'x' : 'z',
      bays: Math.max(2, Math.round(width / 4.2)),
      seed: 'old-' + placed,
      shops: dist < 190 && rng.chance(0.55),
      balconies: rng.chance(0.5),
      dentils: rng.chance(0.55),
      quoins: rng.chance(0.22),
      litChance: 0.32,
      dormers: rng.chance(0.4) ? 1 : 0,
      chimneys: rng.int(1, 3),
      pitch: rng.range(0.62, 0.9),
      blindFlanks: rng.chance(0.35),
    });
    footprints.push({ x0: rect.x0, z0: rect.z0, x1: rect.x1, z1: rect.z1, base, h: built.ridgeY });
    placed++;
  }

  // back-of-block courtyard wings, filling the leftovers
  let extra = 0;
  for (let attempt = 0; attempt < 4200 && extra < 200; attempt++) {
    const x = rng.range(MAP.x0 + 30, MAP.x1 - 30);
    const z = rng.range(MAP.z0 + 30, MAP.z1 - 30);
    if (Math.hypot(x, z) < 150) continue;
    const w = rng.range(8, 15), d = rng.range(8, 14);
    const r = { x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 };
    if (!occ.freeRect(r.x0 - 2, r.z0 - 2, r.x1 + 2, r.z1 + 2)) continue;
    occ.markRect(r.x0 - 1, r.z0 - 1, r.x1 + 1, r.z1 + 1);
    const base = terrainHeight(x, z);
    const combo = COMBOS[rng.int(0, COMBOS.length - 1)];
    buildFacade(b, {
      x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, front: rng.pick(['N', 'S', 'E', 'W']), base,
      floors: rng.int(1, 2), groundH: 3.8, floorH: 3.2,
      wall: combo.wall, trim: combo.trim, roofMat: combo.roof,
      roofType: 'gable', ridge: w > d ? 'x' : 'z',
      bays: Math.max(2, Math.round(w / 4.5)), seed: 'court-' + extra,
      shops: false, entry: false, balconies: false, dentils: false, dormers: 0,
      chimneys: 1, litChance: 0.22, blindFlanks: true,
    });
    footprints.push({ x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, base });
    extra++;
  }
  return placed + extra;
}

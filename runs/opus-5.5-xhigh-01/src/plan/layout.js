// Master plan: fixed landmark placement (zones A–C), occupancy-grid allocation
// of the outer historic centre (zone D), ground features, scenery placements,
// label anchors and the generation job list.

import {
  SQ, PLAZA, ROAD_RING, LEVEL, CHURCH, TOWER, MONUMENT, ARCH, FOUNTAIN, GROUNDS, TERRACE_Z,
  STREETS, STREET_BY_ID, CITY,
} from './site.js';
import { RNG, mixSeed, hashStr } from '../core/rng.js';
import { townhouse, NAMED, maniuPair, PERI_VS } from './buildings.js';
import { PLASTER_LIST, ROOF_TILES, TRIM, ROOF } from '../core/palette.js';
import { APARTMENT_DISTRICTS, terrainHeight } from '../build/ground.js';

const FIXED = 0x1c1a7e5; // landmark seed: never changes between runs
const FREE = 0, STREET = 1, SQUARE = 2, LANDMARK = 3, BUILDING = 4;

class Occupancy {
  constructor(x0, z0, x1, z1) {
    this.x0 = x0; this.z0 = z0; this.w = x1 - x0; this.h = z1 - z0;
    this.a = new Uint8Array(this.w * this.h);
  }
  i(x) { return Math.floor(x - this.x0); }
  j(z) { return Math.floor(z - this.z0); }
  get(x, z) {
    const i = this.i(x), j = this.j(z);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return 255;
    return this.a[j * this.w + i];
  }
  rect(x0, z0, x1, z1, v) {
    for (let j = Math.max(0, this.j(z0)); j < Math.min(this.h, this.j(z1)); j++)
      for (let i = Math.max(0, this.i(x0)); i < Math.min(this.w, this.i(x1)); i++) this.a[j * this.w + i] = v;
  }
  capsule(pts, hw, v) {
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, az] = pts[s], [bx, bz] = pts[s + 1];
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
      const i0 = Math.max(0, this.i(Math.min(ax, bx) - hw)), i1 = Math.min(this.w - 1, this.i(Math.max(ax, bx) + hw));
      const j0 = Math.max(0, this.j(Math.min(az, bz) - hw)), j1 = Math.min(this.h - 1, this.j(Math.max(az, bz) + hw));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = this.x0 + i + 0.5 - ax, pz = this.z0 + j + 0.5 - az;
        let t = (px * dx + pz * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = px - dx * t, ez = pz - dz * t;
        if (ex * ex + ez * ez <= hw * hw) this.a[j * this.w + i] = v;
      }
    }
  }
  // oriented rect: origin P, frontage t, depth n, size W x D; mode 'test' | value
  orect(px, pz, tx, tz, nx, nz, W, D, v, shrink = 0) {
    const cs = [[0, 0], [W, 0], [W, D], [0, D]].map(([u, d]) => [px + tx * u + nx * d, pz + tz * u + nz * d]);
    const xs = cs.map((c) => c[0]), zs = cs.map((c) => c[1]);
    const i0 = Math.max(0, this.i(Math.min(...xs))), i1 = Math.min(this.w - 1, this.i(Math.max(...xs)));
    const j0 = Math.max(0, this.j(Math.min(...zs))), j1 = Math.min(this.h - 1, this.j(Math.max(...zs)));
    if (i0 > i1 || j0 > j1) return v === 'test' ? false : true;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const qx = this.x0 + i + 0.5 - px, qz = this.z0 + j + 0.5 - pz;
      const u = qx * tx + qz * tz, d = qx * nx + qz * nz;
      if (u < shrink || u > W - shrink || d < shrink || d > D - shrink) continue;
      const k = j * this.w + i;
      if (v === 'test') { if (this.a[k] !== FREE) return false; }
      else this.a[k] = v;
    }
    return true;
  }
}

function frameOf(side) {
  // façade row frames around the square: t (frontage), n (inward), rot
  switch (side) {
    case 'N': return { t: [-1, 0], n: [0, -1], rot: Math.PI };
    case 'S': return { t: [1, 0], n: [0, 1], rot: 0 };
    case 'E': return { t: [0, -1], n: [1, 0], rot: Math.PI / 2 };
    case 'W': return { t: [0, 1], n: [-1, 0], rot: -Math.PI / 2 };
  }
}
const rotOf = (t) => Math.atan2(-t[1], t[0]);

export function makePlan(varSeed = 1) {
  const fixed = new RNG(FIXED);
  const vr = new RNG(mixSeed(varSeed >>> 0, 0x9e37));
  const occ = new Occupancy(-520, -520, 520, 520);
  const jobs = [];
  const occluders = [];
  const stats = { perimeter: 0, heroes: 0, outer: 0, outerSkipped: 0, attempts: 0 };
  const walkLevel = LEVEL.walk;

  // ---- reserve streets and the square (roads, sidewalks, plaza)
  for (const st of STREETS) occ.capsule(st.pts, st.w / 2, STREET);
  occ.rect(SQ.W, SQ.N, SQ.E, SQ.S, SQUARE);
  // fixed landmarks inside the plaza (zone A/B) – reserved, never skipped
  occ.rect(CHURCH.x - 5, TOWER.z0 - 3, CHURCH.x + CHURCH.length + 3, CHURCH.z + 16, LANDMARK);
  occ.rect(MONUMENT.x - 7, MONUMENT.z - 4.5, MONUMENT.x + 7, MONUMENT.z + 4.5, LANDMARK);
  occ.rect(ARCH.x0 - 1, ARCH.z0 - 1, ARCH.x1 + 1, ARCH.z1 + 1, LANDMARK);

  // ---- zone A/B landmark jobs
  const churchXf = { x: CHURCH.x, y: LEVEL.church, z: CHURCH.z, rot: 0 };
  jobs.push({ type: 'church-body', label: 'St. Michael’s Church', xf: churchXf, cost: 30, meta: { tier: 'hero', anchor: [CHURCH.x + 35, CHURCH.z], key: 'church' } });
  jobs.push({ type: 'church-tower', label: 'St. Michael’s tower', xf: churchXf, cost: 8, meta: { tier: 'hero', anchor: [CHURCH.x + 9, CHURCH.z - 17], key: 'tower' } });
  jobs.push({ type: 'monument', label: 'Matthias Corvinus Monument', xf: { x: MONUMENT.x, y: walkLevel, z: MONUMENT.z, rot: 0 }, cost: 10, meta: { tier: 'mon', vs: 0.08, anchor: [MONUMENT.x, MONUMENT.z], key: 'monument' } });
  const archC = [(ARCH.x0 + ARCH.x1) / 2, (ARCH.z0 + ARCH.z1) / 2];
  jobs.push({ type: 'archaeo', label: 'Roman Napoca window', spec: { w: ARCH.x1 - ARCH.x0, d: ARCH.z1 - ARCH.z0 }, xf: { x: archC[0], y: 0, z: archC[1], rot: 0 }, cost: 1, meta: { tier: 'mon', vs: 0.125, anchor: archC, key: 'arch' } });

  // ---- zone C: perimeter façades (fixed positions)
  const rows = {
    N: { line: SQ.N, items: [
      [85, 98, 'corner', { corner: 'L' }], [71, 85], [59, 71], [43, 59], [31, 43], [17, 31, 'hintz'], [4, 17], [-11, 4], [-22, -11],
      [-46, -22, 'kemeny'], [-60, -46], [-72, -60], [-88, -72, 'rucska', { corner: 'R' }],
    ] },
    S: { line: SQ.S, items: [
      [-98, -86, 'corner', { corner: 'L' }], [-86, -72, 'kakas'], [-72, -60], [-60, -30, 'townHall'], [-30, -17], [-17, -5], [-5, 10],
      [10, 38, 'bank'], [38, 50], [50, 64], [64, 75], [75, 91], [91, 110],
    ] },
    W: { line: SQ.W, items: [
      [-66, -48, 'parish', { corner: 'L' }], [-48, -34, 'wass'], [-34, -22], [-22, 0, 'rhedey'], [0, 13], [13, 24], [24, 44, 'josika'], [44, 52, 'corner', { corner: 'R' }],
    ] },
    E: { line: SQ.E, items: [
      [-68, -58, 'corner', { corner: 'R' }], [38, 56, 'corner', { corner: 'L' }],
    ] },
  };
  const periSpecs = [];
  const addFacade = (side, a, b, key, extra = {}) => {
    const F = frameOf(side);
    const W = b - a;
    let P0;
    if (side === 'N') P0 = [b, SQ.N]; else if (side === 'S') P0 = [a, SQ.S];
    else if (side === 'E') P0 = [SQ.E, b]; else P0 = [SQ.W, a];
    const seed = hashStr('peri-' + side + a);
    const r = new RNG(mixSeed(FIXED, seed));
    const o = { W, seed, varSeed: mixSeed(varSeed, seed), ...(NAMED[key] || {}), ...extra };
    const spec = townhouse(r, o);
    const item = { side, a, b, key, spec, P0, F, W, D: spec.D + (spec.rear ? spec.rear.d : 0), H: spec.H };
    periSpecs.push(item);
    return item;
  };
  for (const side of ['N', 'S', 'W', 'E']) {
    for (const [a, b, key, extra] of rows[side].items) addFacade(side, a, b, key, extra);
  }
  // NW / NE corner buildings on the northern façade line
  const nw = addFacade('N', -132, -96, 'corner', { corner: 'L', upper: 3, style: 'eclectic' });
  const ne = addFacade('N', 112, 142, 'corner', { corner: 'R', upper: 3, style: 'historicist' });
  // hero buildings (never skipped)
  const heroes = [
    { type: 'banffy', label: 'Bánffy Palace', xf: { x: SQ.E, y: walkLevel, z: -16, rot: Math.PI / 2 }, foot: { P: [SQ.E, -16], t: [0, -1], n: [1, 0], W: 42, D: 38 }, H: 12.4, anchor: [129, -37] },
    { type: 'mirror', label: 'Mirror Buildings (north)', spec: { flip: false }, xf: { x: SQ.E, y: walkLevel, z: 5, rot: 0 }, foot: { rects: [[110, -16, 126, 5], [110, -9, 152, 5]] }, H: 17.4, anchor: [120, -2] },
    { type: 'mirror', label: 'Mirror Buildings (south)', spec: { flip: true }, xf: { x: SQ.E, y: walkLevel, z: 17, rot: 0 }, foot: { rects: [[110, 17, 126, 38], [110, 17, 152, 31]] }, H: 17.4, anchor: [120, 24] },
    { type: 'continental', label: 'Former Hotel Continental', xf: { x: SQ.W, y: walkLevel, z: 64, rot: 0 }, foot: { rects: [[-154, 64, -110, 79], [-125, 64, -110, 108]] }, H: 18.7, anchor: [-120, 72] },
  ];
  for (const h of heroes) {
    if (h.foot.rects) for (const [x0, z0, x1, z1] of h.foot.rects) { occ.rect(x0, z0, x1, z1, LANDMARK); occluders.push({ t: 'rect', x0, z0, x1, z1, occ: true }); }
    else {
      const f = h.foot;
      occ.orect(f.P[0], f.P[1], f.t[0], f.t[1], f.n[0], f.n[1], f.W, f.D, LANDMARK);
      occluders.push(orectFeature(f.P, f.t, f.n, f.W, f.D, { occ: true }));
    }
    jobs.push({ type: h.type, label: h.label, spec: { seed: hashStr(h.label), varSeed: mixSeed(varSeed, hashStr(h.label)), ...(h.spec || {}), partyL: h.type === 'banffy' ? 11.4 : 0, partyR: h.type === 'banffy' ? 11.4 : 0, partyN: h.type === 'mirror' && !h.spec.flip ? 11.4 : 0, partyE: h.type === 'mirror' ? 16 : 0 }, xf: h.xf, cost: 8, meta: { tier: 'hero', anchor: h.anchor, key: h.type + (h.spec && h.spec.flip ? 'S' : '') } });
    stats.heroes++;
  }
  // Iuliu Maniu symmetric continuation (mirrored pairs on both sides)
  const maniu = [[152, 176], [176, 200], [200, 226]];
  maniu.forEach(([a, b], i) => {
    const seed = hashStr('maniu' + i);
    for (const sideN of [true, false]) {
      const r = new RNG(mixSeed(FIXED, seed));
      const spec = townhouse(r, { ...maniuPair(r, b - a, i), seed, varSeed: mixSeed(varSeed, seed + (sideN ? 1 : 2)) });
      const F = sideN ? { t: [-1, 0], n: [0, -1] } : { t: [1, 0], n: [0, 1] };
      const P0 = sideN ? [b, 5] : [a, 17];
      periSpecs.push({ side: sideN ? 'MN' : 'MS', a, b, key: 'maniu', spec, P0, F: { ...F, rot: rotOf(F.t) }, W: b - a, D: spec.D, H: spec.H });
    }
  });
  // party walls between neighbours in each row
  const bySide = {};
  for (const it of periSpecs) (bySide[it.side] = bySide[it.side] || []).push(it);
  const heroH = { E_S: 17.4, E_N: 17.4 };
  for (const side of Object.keys(bySide)) {
    const list = bySide[side].sort((p, q) => (side === 'N' || side === 'E' || side === 'MN' ? q.a - p.a : p.a - q.a));
    for (let i = 0; i < list.length; i++) {
      const it = list[i], s = it.spec;
      const prev = list[i - 1], next = list[i + 1];
      const touchPrev = prev && (Math.abs(prev.a - it.b) < 0.01 || Math.abs(prev.b - it.a) < 0.01);
      const touchNext = next && (Math.abs(next.a - it.b) < 0.01 || Math.abs(next.b - it.a) < 0.01);
      if (touchPrev) { s.partyL = Math.min(s.H, prev.H) + 0.3; s.partyLD = Math.min(s.D, prev.spec.D); }
      if (touchNext) { s.partyR = Math.min(s.H, next.H) + 0.3; s.partyRD = Math.min(s.D, next.spec.D); }
    }
  }
  // hero neighbours
  for (const it of periSpecs) {
    const s = it.spec;
    if (it.side === 'E' && it.a === 38) { s.partyR = Math.min(s.H, 17.4); s.partyRD = s.D; }
    if (it.side === 'E' && it.a === -68) { s.partyL = Math.min(s.H, 11.4); s.partyLD = s.D; }
    if ((it.side === 'MN' || it.side === 'MS') && it.a === 152) {
      if (it.side === 'MN') { s.partyR = Math.min(s.H, 17.4); s.partyRD = Math.min(s.D, 14); }
      else { s.partyL = Math.min(s.H, 17.4); s.partyLD = Math.min(s.D, 14); }
    }
  }
  for (const it of periSpecs) {
    const { F, P0, spec } = it;
    const D = spec.D + (spec.rear ? spec.rear.d : 0);
    occ.orect(P0[0], P0[1], F.t[0], F.t[1], F.n[0], F.n[1], it.W, D, BUILDING);
    occluders.push(orectFeature(P0, F.t, F.n, it.W, D, { occ: true }));
    const anchor = [P0[0] + F.t[0] * it.W / 2 + F.n[0] * 6, P0[1] + F.t[1] * it.W / 2 + F.n[1] * 6];
    jobs.push({ type: 'facade', label: spec.name || 'historic façade', spec, xf: { x: P0[0], y: walkLevel, z: P0[1], rot: F.rot ?? rotOf(F.t) }, cost: 1.2, meta: { tier: 'peri', anchor } });
    stats.perimeter++;
  }

  // ---- zone D: outer historic centre, street-frontage allocation with collision tests
  const outer = [];
  for (const st of STREETS) {
    for (let s = 0; s < st.pts.length - 1; s++) {
      const [ax, az] = st.pts[s], [bx, bz] = st.pts[s + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const d = [(bx - ax) / L, (bz - az) / L];
      for (const sideA of [true, false]) {
        const t = sideA ? d : [-d[0], -d[1]];
        const n = [-t[1], t[0]];
        const start = sideA ? [ax, az] : [bx, bz];
        const off = st.w / 2 + 0.2;
        const sr = new RNG(mixSeed(FIXED, hashStr(st.id + s + (sideA ? 'a' : 'b'))));
        let u = sr.range(0, 3);
        let prev = null;
        while (u < L - 4) {
          let W = sr.range(9, 19), D = sr.range(12, 18);
          let placed = null;
          for (let k = 0; k < 10; k++) {
            stats.attempts++;
            const w = W * (1 - 0.07 * k), dd = D * (1 - 0.06 * k), shift = k >= 5 ? (k - 4) * 1.2 : 0;
            if (u + shift + w > L + 2) break;
            const P = [start[0] + t[0] * (u + shift) + n[0] * off, start[1] + t[1] * (u + shift) + n[1] * off];
            if (Math.max(Math.abs(P[0]), Math.abs(P[1])) > CITY.r) break;
            if (occ.orect(P[0], P[1], t[0], t[1], n[0], n[1], w, dd, 'test', 0.45)) {
              placed = { P, w, dd, shift };
              break;
            }
          }
          if (!placed) { stats.outerSkipped++; u += 3; prev = null; continue; }
          const { P, w, dd, shift } = placed;
          occ.orect(P[0], P[1], t[0], t[1], n[0], n[1], w, dd, BUILDING);
          const lot = { P, t, n, W: w, D: dd, street: st.id, prev: shift === 0 ? prev : null };
          if (lot.prev) lot.prev.next = lot;
          outer.push(lot);
          prev = lot;
          u += shift + w;
        }
      }
    }
  }
  // courtyard wings filling the block interiors (secondary buildings; 10 attempts each, then skipped)
  {
    const cell = 40;
    const hashL = new Map();
    for (const lot of outer) {
      const k = Math.floor(lot.P[0] / cell) + ',' + Math.floor(lot.P[1] / cell);
      if (!hashL.has(k)) hashL.set(k, []);
      hashL.get(k).push(lot);
    }
    const nearestLot = (x, z) => {
      let best = null, bd = 1e9;
      const ci = Math.floor(x / cell), cj = Math.floor(z / cell);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        for (const l of hashL.get((ci + di) + ',' + (cj + dj)) || []) {
          const d = (l.P[0] - x) ** 2 + (l.P[1] - z) ** 2;
          if (d < bd) { bd = d; best = l; }
        }
      }
      return best;
    };
    const ir = new RNG(mixSeed(FIXED, 0x1a7e));
    for (let z = -500; z < 500; z += 15) {
      for (let x = -500; x < 500; x += 15) {
        const px = x + ir.range(-2, 2), pz = z + ir.range(-2, 2);
        if (Math.abs(px) < 128 && Math.abs(pz) < 98) continue;
        if (Math.max(Math.abs(px), Math.abs(pz)) > CITY.r - 8) continue;
        if (occ.get(px, pz) !== FREE) continue;
        const ref = nearestLot(px, pz) || { t: [1, 0], n: [0, 1] };
        const t = ir.chance(0.5) ? ref.t : ref.n;
        const n = [-t[1], t[0]];
        const W = ir.range(8, 15), D = ir.range(7, 11);
        let placed = null;
        for (let k = 0; k < 10; k++) {
          stats.attempts++;
          const w = W * (1 - 0.07 * k), d = D * (1 - 0.06 * k);
          const P = [px - t[0] * w / 2 - n[0] * d / 2 + ir.range(-1, 1), pz - t[1] * w / 2 - n[1] * d / 2 + ir.range(-1, 1)];
          if (occ.orect(P[0], P[1], t[0], t[1], n[0], n[1], w, d, 'test', 0.3)) { placed = { P, w, d }; break; }
        }
        if (!placed) { stats.outerSkipped++; continue; }
        occ.orect(placed.P[0] - t[0] * 3 - n[0] * 3, placed.P[1] - t[1] * 3 - n[1] * 3, t[0], t[1], n[0], n[1], placed.w + 6, placed.d + 6, BUILDING);
        outer.push({ P: placed.P, t, n, W: placed.w, D: placed.d, inner: true });
        stats.inner = (stats.inner || 0) + 1;
      }
    }
  }
  // build outer house jobs (tier by distance from the square)
  for (const lot of outer) {
    const cx = lot.P[0] + lot.t[0] * lot.W / 2 + lot.n[0] * lot.D / 2;
    const cz = lot.P[1] + lot.t[1] * lot.W / 2 + lot.n[1] * lot.D / 2;
    const dsq = Math.max(Math.abs(cx) - 110, Math.abs(cz) - 80, 0);
    const foreground = cz > 80 && cz < 235 && Math.abs(cx) < 215; // between the square and the opening camera
    const near = (dsq < 70 && !lot.inner) || foreground;
    const seed = hashStr('lot' + Math.round(cx) + ',' + Math.round(cz));
    const r = new RNG(mixSeed(FIXED, seed));
    const nF = lot.inner ? r.int(2, 3) : near ? r.int(3, 4) : r.weighted([2, 3, 4], [2, 4, 2]);
    const metal = r.chance(0.12);
    const spec = {
      vs: near ? 0.5 : 1.0, W: lot.W, D: lot.D, floorsN: nF, g0: r.range(4.0, 4.8), fh: r.range(3.4, 3.9),
      wall: r.pick(PLASTER_LIST), trim: r.pick([TRIM.white, TRIM.cream, TRIM.stone]),
      roof: metal ? r.pick([ROOF.slate, ROOF.zinc]) : r.pick(ROOF_TILES), roofMetal: metal,
      pitch: r.range(38, 50), shops: !lot.inner && near && r.chance(0.7), strings: r.chance(0.6),
      lit: r.range(0.2, 0.4), seed, varSeed: mixSeed(varSeed, seed),
    };
    const prevTouch = lot.prev, nextTouch = lot.next;
    if (prevTouch) spec.partyL = 9;
    if (nextTouch) spec.partyR = 9;
    if (!prevTouch && !nextTouch) spec.roofType = 'hip';
    else if (!prevTouch) spec.corner = 'L';
    else if (!nextTouch) spec.corner = 'R';
    const H = spec.g0 + (nF - 1) * spec.fh;
    lot.H = H;
    jobs.push({ type: 'city', label: 'old-town house', spec, xf: { x: lot.P[0], y: walkLevel, z: lot.P[1], rot: rotOf(lot.t) }, cost: near ? 0.35 : 0.1, lods: near ? 3 : 2, meta: { tier: near ? 'near' : 'far', anchor: [cx, cz] } });
    stats.outer++;
  }
  // fix party heights to the actual neighbour heights
  for (const job of jobs) {
    if (job.type !== 'city') continue;
  }

  // ---- distant modern apartment blocks (background only)
  const br = new RNG(mixSeed(FIXED, 404));
  for (const dct of APARTMENT_DISTRICTS) {
    const n = Math.round(dct.blocks * 14);
    for (let i = 0; i < n; i++) {
      const a = br.range(0, Math.PI * 2), rr = Math.sqrt(br.next()) * dct.r * 0.8;
      const x = dct.x + Math.cos(a) * rr, z = dct.z + Math.sin(a) * rr;
      const y = terrainHeight(x, z);
      const tall = br.chance(0.3);
      const spec = { vs: 2, W: tall ? br.range(18, 24) : br.range(48, 90), D: br.range(11, 14), H: tall ? br.range(34, 46) : br.range(14, 30), wall: br.pick(['#d9d6cf', '#cfcac0', '#e2ddd2', '#c7c3bb', '#d8cdb8']), seed: br.int(1, 1e9), lit: 0.3 };
      jobs.push({ type: 'block', label: 'apartment block', spec, xf: { x, y: y - 1, z, rot: br.pick([0, Math.PI / 2]) + br.range(-0.2, 0.2) }, lods: 1, cost: 0.1, meta: { tier: 'blocks', anchor: [x, z] } });
    }
  }
  // Cetățuia: hotel block and the hilltop cross
  {
    const x = -372, z = -752, y = terrainHeight(x, z);
    jobs.push({ type: 'block', label: 'Cetățuia', spec: { vs: 2, W: 40, D: 14, H: 18, wall: '#cfcbc2', seed: 77, lit: 0.4 }, xf: { x: x - 20, y: y - 2, z: z + 12, rot: 0.3 }, lods: 1, cost: 0.1, meta: { tier: 'blocks', anchor: [x, z] } });
    jobs.push({ type: 'block', label: 'Cetățuia cross', spec: { vs: 1, W: 1, D: 1, H: 13, wall: '#dcdad4', seed: 78, lit: 0 }, xf: { x: x + 40, y: y - 1, z: z - 10, rot: 0 }, lods: 1, cost: 0.02, meta: { tier: 'blocks', anchor: [x + 40, z - 10] } });
    jobs.push({ type: 'block', label: 'Cetățuia cross', spec: { vs: 1, W: 5, D: 1, H: 1, wall: '#dcdad4', seed: 79, lit: 0 }, xf: { x: x + 38, y: y + 8, z: z - 10, rot: 0 }, lods: 1, cost: 0.02, meta: { tier: 'blocks', anchor: [x + 40, z - 10] } });
  }

  // ---- ground features (painter's order)
  const G = groundFeatures(occluders);
  // tiles
  const pushTiles = (type, X0, Z0, X1, Z1, size, res, hres, hole, tier, cost) => {
    for (let z = Z0; z < Z1 - 1e-6; z += size) for (let x = X0; x < X1 - 1e-6; x += size) {
      const x1 = Math.min(X1, x + size), z1 = Math.min(Z1, z + size);
      if (hole && x >= hole.x0 && x1 <= hole.x1 && z >= hole.z0 && z1 <= hole.z1) continue;
      const nx = Math.round((x1 - x) / res), nz = Math.round((z1 - z) / res);
      const job = { type, label: 'ground', x0: x, z0: z, nx, nz, res, hres, cost, lods: 1, meta: { tier, anchor: [x + size / 2, z + size / 2] } };
      if (type === 'ground') { job.features = G; job.hole = hole; }
      else job.hole = hole;
      jobs.push(job);
    }
  };
  const G0 = { x0: -160, z0: -120, x1: 160, z1: 120 };
  const G1 = { x0: -520, z0: -520, x1: 520, z1: 520 };
  const G2 = { x0: -1560, z0: -1560, x1: 1560, z1: 1560 };
  pushTiles('ground', G0.x0, G0.z0, G0.x1, G0.z1, 80, 0.25, 0.25, null, 'ground0', 3);
  pushTiles('ground', G1.x0, G1.z0, G1.x1, G1.z1, 130, 0.5, 0.25, G0, 'ground1', 2);
  pushTiles('terrain', G2.x0, G2.z0, G2.x1, G2.z1, 520, 6.5, 3.25, G1, 'terrain', 1.5);
  pushTiles('terrain', -7200, -7200, 7200, 7200, 2400, 40, 5, G2, 'horizon', 0.8);
  // void flags for the inner holes of the city ground tiles
  for (const j of jobs) {
    if (j.type === 'ground' && j.hole) j.features = [...G, { t: 'rect', ...j.hole, void: true }];
  }

  // ---- scenery placements (trees, furniture) - fixed plan + seeded variation
  const scen = scenery(fixed, vr, occ, outer);

  const plan = {
    jobs, stats, occ, outer, periSpecs,
    groundHeight, labels: LABELS, ...scen,
    varSeed,
  };
  stats.jobs = jobs.length;
  return plan;
}

function orectFeature(P, t, n, W, D, extra) {
  const cx = P[0] + t[0] * W / 2 + n[0] * D / 2, cz = P[1] + t[1] * W / 2 + n[1] * D / 2;
  return { t: 'orect', cx, cz, ux: t[0], uz: t[1], hw: W / 2 + 0.25, hd: D / 2 + 0.25, ...extra };
}

// ------------------------------------------------------------------ ground features
function groundFeatures(occluders) {
  const f = [];
  // streets first (they are overpainted by the square)
  for (const st of STREETS) {
    f.push({ t: 'street', pts: st.pts, w: st.w, walk: st.walk, kind: st.kind, asphalt: st.id.startsWith('o') || st.id === 'dec21' || st.id === 'ferdinand', prom: st.kind === 'boulevard' ? 4.5 : 0 });
  }
  // square: sidewalks, curbs, ring road, plaza
  f.push({ t: 'rect', x0: SQ.W, z0: SQ.N, x1: SQ.E, z1: SQ.S, mat: 'walk', h: 0.25 });
  f.push({ t: 'rect', x0: ROAD_RING.W.x0 - 0.25, z0: ROAD_RING.N.z0 - 0.25, x1: ROAD_RING.E.x1 + 0.25, z1: ROAD_RING.S.z1 + 0.25, mat: 'curb', h: 0.25 });
  f.push({ t: 'rect', x0: ROAD_RING.W.x0, z0: ROAD_RING.N.z0, x1: ROAD_RING.E.x1, z1: ROAD_RING.S.z1, mat: 'road', h: 0 });
  // street mouths: roads continue through the sidewalk band into the ring road
  const mouth = (x0, z0, x1, z1) => f.push({ t: 'rect', x0, z0, x1, z1, mat: 'road', h: 0 });
  mouth(104, 60.5, 112, 75.5);           // Eroilor
  mouth(104, 8, 112, 14);                // Iuliu Maniu
  mouth(104, -77, 112, -71);             // 21 Decembrie
  mouth(99.5, -82, 110.5, -74);          // Regele Ferdinand
  mouth(-112, -77, -102, -69);           // Memorandumului
  mouth(-112, 54.5, -102, 61.5);         // Napoca
  f.push({ t: 'rect', x0: PLAZA.x0, z0: PLAZA.z0, x1: PLAZA.x1, z1: PLAZA.z1, mat: 'curb', h: 0.25 });
  f.push({ t: 'rect', x0: PLAZA.x0 + 0.25, z0: PLAZA.z0 + 0.25, x1: PLAZA.x1 - 0.25, z1: PLAZA.z1 - 0.25, mat: 'plaza', h: 0.25 });
  // subtle darker stone bands structuring the paving
  for (let x = -84; x <= 90; x += 29) f.push({ t: 'rect', x0: x, z0: PLAZA.z0 + 1, x1: x + 0.5, z1: PLAZA.z1 - 1, mat: 'band', onlyMat: 'plaza' });
  f.push({ t: 'rect', x0: PLAZA.x0 + 1.5, z0: PLAZA.z0 + 1.5, x1: PLAZA.x1 - 1.5, z1: PLAZA.z0 + 2.0, mat: 'band' });
  f.push({ t: 'rect', x0: PLAZA.x0 + 1.5, z0: PLAZA.z1 - 2.0, x1: PLAZA.x1 - 1.5, z1: PLAZA.z1 - 1.5, mat: 'band' });
  // southern terrace (subtle level change with a long seating step)
  f.push({ t: 'rect', x0: PLAZA.x0 + 0.25, z0: TERRACE_Z, x1: PLAZA.x1 - 0.25, z1: 63.5, mat: 'plaza', h: 0.5 });
  f.push({ t: 'rect', x0: PLAZA.x0 + 0.25, z0: TERRACE_Z, x1: PLAZA.x1 - 0.25, z1: TERRACE_Z + 0.5, mat: 'step', h: 0.5 });
  // church platform and grounds
  const P = GROUNDS.platform;
  f.push({ t: 'rect', x0: P.x0 - 0.5, z0: P.z0 - 0.5, x1: P.x1 + 0.5, z1: P.z1 + 0.5, mat: 'step', h: 0.25 });
  f.push({ t: 'rect', x0: P.x0, z0: P.z0, x1: P.x1, z1: P.z1, mat: 'plaza2', h: 0.5, alt: 3.0, altMat: 'plaza' });
  for (const g of GROUNDS.grass) {
    f.push({ t: 'rect', x0: g.x0 - 0.25, z0: g.z0 - 0.25, x1: g.x1 + 0.25, z1: g.z1 + 0.25, mat: 'curb', h: 0.75 });
    f.push({ t: 'rect', x0: g.x0, z0: g.z0, x1: g.x1, z1: g.z1, mat: 'grass', h: 0.75 });
  }
  // archaeological window pit
  f.push({ t: 'rect', x0: ARCH.x0 - 0.25, z0: ARCH.z0 - 0.25, x1: ARCH.x1 + 0.25, z1: ARCH.z1 + 0.25, mat: 'pit', h: 0.25 });
  f.push({ t: 'rect', x0: ARCH.x0, z0: ARCH.z0, x1: ARCH.x1, z1: ARCH.z1, mat: 'gravel', h: -1.25 });
  // fountain installation
  const A = FOUNTAIN.area;
  f.push({ t: 'rect', x0: A.x0, z0: A.z0, x1: A.x1, z1: A.z1, mat: 'plaza2', h: 0.5 });
  for (const tb of FOUNTAIN.tables) {
    f.push({ t: 'rect', x0: tb.x0 - 0.5, z0: tb.z0 - 0.5, x1: tb.x1 + 0.5, z1: tb.z1 + 0.5, mat: 'step', h: 0.5 });
    f.push({ t: 'rect', x0: tb.x0, z0: tb.z0, x1: tb.x1, z1: tb.z1, mat: 'basin', h: 0.25 });
  }
  const J = FOUNTAIN.jets;
  f.push({ t: 'rect', x0: J.x0 - 1, z0: J.z0 - 1, x1: J.x1 + 1, z1: J.z1 + 1, mat: 'wet', h: 0.5 });
  // zebra crossings over the ring road and street mouths
  const zebraX = (x, w = 4) => [[ROAD_RING.N.z0, ROAD_RING.N.z1], [ROAD_RING.S.z0, ROAD_RING.S.z1]].forEach(([z0, z1]) => f.push({ t: 'rect', x0: x, z0, x1: x + w, z1, mat: 'zebraX' }));
  const zebraZ = (z, w = 4) => [[ROAD_RING.W.x0, ROAD_RING.W.x1], [ROAD_RING.E.x0, ROAD_RING.E.x1]].forEach(([x0, x1]) => f.push({ t: 'rect', x0, z0: z, x1, z1: z + w, mat: 'zebraZ' }));
  zebraX(-62); zebraX(-6); zebraX(52);
  zebraZ(-42); zebraZ(30);
  f.push({ t: 'rect', x0: 106, z0: 7.5, x1: 110, z1: 14.5, mat: 'zebraZ' });
  f.push({ t: 'rect', x0: 106, z0: 57, x1: 110, z1: 79, mat: 'zebraZ' });
  f.push({ t: 'rect', x0: -110, z0: 52.5, x1: -106, z1: 63.5, mat: 'zebraZ' });
  f.push({ t: 'rect', x0: -110, z0: -79.5, x1: -106, z1: -66.5, mat: 'zebraZ' });
  f.push({ t: 'rect', x0: 99, z0: -84, x1: 111, z1: -80, mat: 'zebraX' });
  // AO occluders from building footprints, then courtyard gardens
  for (const o of occluders) f.push(o);
  f.push({ t: 'gardens' });
  return f;
}

// Ground level (m) at a point, matching the ground features (approximate).
export function groundHeight(x, z) {
  if (x > ARCH.x0 && x < ARCH.x1 && z > ARCH.z0 && z < ARCH.z1) return -1.25;
  if (x > SQ.W && x < SQ.E && z > SQ.N && z < SQ.S) {
    for (const g of GROUNDS.grass) if (x > g.x0 && x < g.x1 && z > g.z0 && z < g.z1) return 0.75;
    const P = GROUNDS.platform;
    if (x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1) return 0.5;
    if (x > PLAZA.x0 && x < PLAZA.x1 && z > PLAZA.z0 && z < PLAZA.z1) {
      for (const t of FOUNTAIN.tables) if (x > t.x0 && x < t.x1 && z > t.z0 && z < t.z1) return 0.25;
      if (z >= TERRACE_Z && z < 63.5) return 0.5;
      return 0.25;
    }
    if (x > ROAD_RING.W.x0 && x < ROAD_RING.E.x1 && z > ROAD_RING.N.z0 && z < ROAD_RING.S.z1) return 0;
    return 0.25;
  }
  const r = Math.hypot(x, z);
  if (r > 560) return Math.max(0, terrainHeight(x, z));
  return 0.25;
}

// ------------------------------------------------------------------ labels
const LABELS = [
  { name: 'St. Michael’s Church', sub: 'Biserica Sfântul Mihail', pos: [-12, 47, -26], prio: 0, maxDist: 4000 },
  { name: 'Matthias Corvinus Monument', sub: 'Statuia lui Matei Corvin', pos: [-13, 13.5, 6.5], prio: 1, maxDist: 1600 },
  { name: 'Bánffy Palace', sub: 'Art Museum', pos: [128, 17, -37], prio: 1, maxDist: 2200 },
  { name: 'Mirror Buildings', sub: 'Palatele Oglindă', pos: [114, 30, 11], prio: 1, maxDist: 2200 },
  { name: 'Former Hotel Continental', sub: 'Hotel New York', pos: [-114, 31, 67], prio: 1, maxDist: 2200 },
  { name: 'Roman Napoca window', sub: 'archaeological remains', pos: [-43.5, 2.2, 20.5], prio: 2, maxDist: 520 },
  { name: 'Southern fountains', pos: [48, 2.4, 47], prio: 2, maxDist: 800 },
  { name: 'Old Town Hall', pos: [-45, 18, 88], prio: 3, maxDist: 900, minor: true },
  { name: 'National Bank', pos: [24, 24, 88], prio: 3, maxDist: 900, minor: true },
  { name: 'Jósika Palace', sub: '“house with legs”', pos: [-117, 16, 34], prio: 3, maxDist: 800, minor: true },
  { name: 'Rhédey Palace', pos: [-117, 16, -11], prio: 3, maxDist: 800, minor: true },
  { name: 'Wass House', pos: [-117, 18, -41], prio: 3, maxDist: 700, minor: true },
  { name: 'Roman Catholic Parish House', pos: [-117, 15, -57], prio: 3, maxDist: 700, minor: true },
  { name: 'Kemény Palace', pos: [-34, 18, -87], prio: 3, maxDist: 800, minor: true },
  { name: 'Mauksch-Hintz House', sub: 'Pharmacy Museum', pos: [24, 15, -87], prio: 3, maxDist: 800, minor: true },
  { name: 'Rucska House', pos: [-80, 18, -87], prio: 3, maxDist: 700, minor: true },
  { name: 'Wolphard-Kakas House', pos: [-79, 15, 87], prio: 3, maxDist: 700, minor: true },
  { name: 'Bulevardul Eroilor', pos: [190, 2, 68], prio: 4, maxDist: 1100, kind: 'street' },
  { name: 'Strada Iuliu Maniu', pos: [190, 2, 11], prio: 4, maxDist: 1000, kind: 'street' },
  { name: 'Bd. 21 Decembrie 1989', pos: [200, 2, -75], prio: 4, maxDist: 1100, kind: 'street' },
  { name: 'Strada Regele Ferdinand', pos: [107, 2, -150], prio: 4, maxDist: 1100, kind: 'street' },
  { name: 'Strada Memorandumului', pos: [-190, 2, -72], prio: 4, maxDist: 1100, kind: 'street' },
  { name: 'Strada Matei Corvin', pos: [-96, 2, -140], prio: 4, maxDist: 900, kind: 'street' },
  { name: 'Strada Napoca', pos: [-190, 2, 60], prio: 4, maxDist: 1100, kind: 'street' },
  { name: 'Strada Universității', pos: [-104, 2, 150], prio: 4, maxDist: 1000, kind: 'street' },
  { name: 'Cetățuia Hill', pos: [-372, 70, -752], prio: 5, maxDist: 6000, minor: true },
];

// ------------------------------------------------------------------ scenery placements
function scenery(fixed, vr, occ, outer) {
  const trees = [], props = [], seats = [], cafeSeats = [], lamps = [], photoSpots = [];
  const gh = groundHeight;
  const tree = (species, x, z, s = 1) => trees.push({ species, x, y: gh(x, z), z, rot: fixed.range(0, Math.PI * 2), s: s * fixed.range(0.9, 1.08), v: fixed.int(0, 2) });
  // north row of lindens
  for (let x = -86; x <= 92; x += 9) tree('linden', x + fixed.range(-0.6, 0.6), -64.6);
  // east row
  for (let z = -56; z <= 24; z += 9.5) { if (z > -62 && z < -12) continue; tree('linden', 94.6, z + fixed.range(-0.5, 0.5)); }
  tree('ornamental', 94.6, -60); tree('ornamental', 94.6, -12);
  // west edge
  for (let z = -58; z <= 18; z += 10.5) tree('linden', -91.2, z);
  // church grounds
  tree('plane', -15, -51, 1.0); tree('plane', 15, -51.5, 1.05); tree('linden', 37, -34); tree('linden', 37, -19);
  tree('ornamental', -48, -54); tree('ornamental', -21, -46); tree('ornamental', 25, -46);
  // larger sycamores at corners
  tree('plane', -82, 54); tree('plane', -68, 60, 0.95); tree('plane', 84, -40); tree('plane', 88, 58, 0.95);
  // ornamental near the fountains
  tree('ornamental', 10, 57); tree('ornamental', 86, 45); tree('ornamental', 10, 38);
  // Eroilor promenade double row
  for (let x = 118; x < 460; x += 11) {
    const t = (x - 104) / 356;
    const zc = 68 + t * 20;
    tree('linden', x, zc - 2.6, 0.9); tree('linden', x + 5, zc + 2.6, 0.9);
  }
  // courtyard trees inside outer blocks (variation)
  let ct = 0;
  for (let k = 0; k < 900 && ct < 170; k++) {
    const x = vr.range(-440, 440), z = vr.range(-440, 440);
    if (Math.abs(x) < 125 && Math.abs(z) < 95) continue;
    if (occ.get(x, z) !== 0 || occ.get(x + 4, z) !== 0 || occ.get(x - 4, z) !== 0 || occ.get(x, z + 4) !== 0 || occ.get(x, z - 4) !== 0) continue;
    trees.push({ species: vr.chance(0.6) ? 'linden' : (vr.chance(0.5) ? 'plane' : 'ornamental'), x, y: 0.25, z, rot: vr.range(0, 6.28), s: vr.range(0.75, 1.0), v: vr.int(0, 2) });
    ct++;
  }

  // benches
  const bench = (x, z, fx, fz) => {
    const rot = Math.atan2(fx, fz);
    props.push({ kind: 'bench', x, y: gh(x, z), z, rot });
    // two seats
    const rx = Math.cos(rot), rz = -Math.sin(rot);
    for (const s of [-0.45, 0.45]) seats.push({ x: x + rx * s + Math.sin(rot) * 0.05, y: gh(x, z) + 0.45, z: z + rz * s + Math.cos(rot) * 0.05, rot });
  };
  for (let x = -81.5; x <= 88; x += 18) bench(x, -62.2, 0, 1);
  for (let z = -51; z <= 20; z += 19) bench(91.8, z, -1, 0);
  for (let x = -60; x <= 90; x += 16) { if (x > 12 && x < 82) continue; bench(x, 62.3, 0, -1); }
  for (const a of [0.5, 1.2, 1.9, 2.6]) {
    const x = MONUMENT.x + Math.cos(a) * 15, z = MONUMENT.z + Math.sin(a) * 12 + 3;
    bench(x, z, MONUMENT.x - x, MONUMENT.z - z);
  }
  for (let z = -48; z <= 10; z += 20) bench(-88.8, z, 1, 0);
  // benches in the church grounds paths
  bench(-10, -41.2, 0, -1); bench(8, -41.2, 0, -1); bench(29, -26, -1, 0);

  // modern street lamps
  const lamp = (x, z, kind = 'lamp', rot = 0) => { props.push({ kind, x, y: gh(x, z), z, rot }); lamps.push({ x, z, y: gh(x, z) + (kind === 'lamp' ? 5.4 : 7.5), kind }); };
  for (let x = -84; x <= 90; x += 24) { lamp(x, -66.7, 'lamp', -Math.PI / 2); lamp(x + 12, 67.2, 'lamp', Math.PI / 2); }
  for (let z = -52; z <= 56; z += 24) { lamp(97.2, z, 'lamp', Math.PI); lamp(-94.7, z + 12, 'lamp', 0); }
  for (const [x, z] of [[-56, -10], [36, -10], [-56, -58], [42, -58]]) lamp(x, z);
  for (const [dx, dz] of [[-9, -5], [9, -5], [-9, 6], [9, 6]]) lamp(MONUMENT.x + dx, MONUMENT.z + dz + 1, 'lamp', Math.atan2(dz, -dx));
  for (const [x, z] of [[20, 40], [62, 40], [20, 58], [62, 58]]) lamp(x, z);
  // street lamps along the radial streets near the square
  for (const id of ['eroilor', 'maniu', 'dec21', 'ferdinand', 'memo', 'napoca', 'corvin', 'univ']) {
    const st = STREET_BY_ID[id];
    let acc = 0, side = 1;
    for (let s = 0; s < st.pts.length - 1; s++) {
      const [ax, az] = st.pts[s], [bx, bz] = st.pts[s + 1];
      const L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L;
      for (let u = 12; u < L; u += 28) {
        const x = ax + dx * u, z = az + dz * u;
        if (Math.abs(x) < 118 && Math.abs(z) < 88) continue;
        if (Math.hypot(x, z) > 330) continue;
        const off = st.w / 2 - 0.8;
        const px = x - dz * off * side, pz = z + dx * off * side;
        lamp(px, pz, 'streetlamp', Math.atan2(dx * side, dz * side));
        side = -side;
        acc++;
      }
    }
  }
  // church ground uplights
  for (let x = -44; x <= 20; x += 4) { props.push({ kind: 'uplight', x, y: 0.5, z: -10.6, rot: 0 }); if (x > -28) props.push({ kind: 'uplight', x, y: 0.5, z: -41.8, rot: 0 }); }
  for (let z = -36; z <= -16; z += 4) props.push({ kind: 'uplight', x: -47.4, y: 0.5, z, rot: 0 });
  for (let z = -30; z <= -22; z += 4) props.push({ kind: 'uplight', x: 28.5, y: 0.5, z, rot: 0 });
  // bollards at street mouths
  for (const [x0, z0, x1, z1] of [[99, 60, 99, 67], [99, 9, 99, 13], [-96.5, 54, -96.5, 62], [-96.5, -76, -96.5, -69]]) {
    for (let t = 0; t <= 1.001; t += 0.25) props.push({ kind: 'bollard', x: x0 + (x1 - x0) * t, y: 0.25, z: z0 + (z1 - z0) * t, rot: 0 });
  }
  for (let x = -94; x <= 97; x += 3.2) { if (Math.abs(x - 52) < 4 || Math.abs(x + 62) < 4 || Math.abs(x + 6) < 4) continue; if (fixed.chance(0.25)) props.push({ kind: 'bollard', x, y: 0.25, z: 68.0, rot: 0 }); }
  // bins, boards, signs, planters
  for (const [x, z] of [[-70, -63], [12, -63], [60, -63], [93, -12], [93, 32], [-89, -30], [-89, 30], [-30, 63], [70, 63], [-2, 10], [-28, 12], [40, 30]]) props.push({ kind: 'bin', x, y: gh(x, z), z, rot: 0 });
  props.push({ kind: 'board', x: -3.5, y: 0.25, z: 17.5, rot: 0.3 });
  props.push({ kind: 'board', x: -57.5, y: 0.5, z: -30, rot: -Math.PI / 2 });
  props.push({ kind: 'board', x: 92, y: 0.25, z: 62, rot: -0.8 });
  for (const [x, z, r] of [[-97, -70, 0], [100, -70, 0], [100, 70, 0], [-97, 70, 0], [112, 15, 0], [112, 55, 0], [-112, 52, 0], [-112, -66, 0]]) props.push({ kind: 'sign', x, y: 0.25, z, rot: r });
  for (let z = -60; z <= 30; z += 12) props.push({ kind: 'planter', x: 108.2, y: 0.25, z: z + 1, rot: 0 });
  // bike racks + parked bicycles (variation)
  for (const [x, z, r] of [[90, 64.5, 0], [-88, -63.5, 0], [60, -66.2, 0], [-20, 65.5, 0]]) {
    props.push({ kind: 'rack', x, y: 0.25, z, rot: r });
    const n = vr.int(1, 4);
    for (let i = 0; i < n; i++) props.push({ kind: 'bike', x: x - 1.3 + i * 0.65 + vr.range(-0.05, 0.05), y: 0.25, z: z + vr.range(-0.1, 0.1), rot: Math.PI / 2 + vr.range(-0.08, 0.08), tint: vr.pick(['#2c4a6b', '#6b2c2c', '#2f2f2f', '#d8d4ca', '#3b5b3b', '#7a6a3a']) });
  }

  // café terraces (tables, chairs, umbrellas; umbrella colours vary with the seed)
  const umbrellaCols = ['#efe8da', '#e6dcc7', '#7d2f2b', '#3f5a48', '#d7cdb8', '#35495e', '#8a6a44', '#f1eee8'];
  const terrace = (x0, z0, x1, z1, axis) => {
    const col = vr.pick(umbrellaCols);
    const chairCol = vr.pick(['#2f2f2f', '#6b4e36', '#c9c3b6', '#3b4a3b']);
    const along = axis === 'x' ? x1 - x0 : z1 - z0;
    const across = axis === 'x' ? z1 - z0 : x1 - x0;
    const rowsN = across > 3.6 ? 2 : 1;
    for (let u = 1.6; u < along - 1.0; u += 3.1) {
      for (let r = 0; r < rowsN; r++) {
        const v = rowsN === 1 ? across / 2 : (r + 0.5) * (across / 2);
        const x = axis === 'x' ? x0 + u : x0 + v, z = axis === 'x' ? z0 + v : z0 + u;
        const rot = axis === 'x' ? 0 : Math.PI / 2;
        props.push({ kind: 'cafe', x, y: 0.25, z, rot: rot + vr.range(-0.12, 0.12), tint: chairCol });
        if (r === 0 || rowsN === 1 || vr.chance(0.5)) props.push({ kind: 'umbrella', x, y: 0.25, z, rot: rot, tint: col });
        for (const s of [-1, 1]) {
          if (!vr.chance(0.62)) continue;
          const lx = axis === 'x' ? 0 : s * 0.62, lz = axis === 'x' ? s * 0.62 : 0;
          cafeSeats.push({ x: x + lx, y: 0.25 + 0.45, z: z + lz, rot: Math.atan2(-lx, -lz) });
        }
      }
    }
  };
  // west sidewalk (7 m) — terraces along the façades
  for (const [z0, z1] of [[-62, -50], [-45, -36], [-30, -10], [2, 21], [26, 43]]) terrace(-109.4, z0, -105.6, z1, 'z');
  // north sidewalk
  for (const [x0, x1] of [[-84, -63], [-42, -24], [-8, 14], [33, 56], [60, 82]]) terrace(x0, -79.4, x1, -76.4, 'x');
  // east (Mirror buildings) and south sidewalks
  terrace(106.2, 20, 109.4, 35, 'z');
  terrace(-54, 76.3, -33, 79.4, 'x');
  terrace(39, 76.3, 62, 79.4, 'x');
  // café on the plaza by the Continental corner
  terrace(-94, 46, -84, 58, 'x');

  // photo spots for tourists (facing church / monument)
  for (let i = 0; i < 14; i++) {
    const x = MONUMENT.x + vr.range(-22, 22), z = MONUMENT.z + vr.range(14, 26);
    photoSpots.push({ x, z, tx: MONUMENT.x + vr.range(-4, 4), tz: MONUMENT.z + vr.range(-20, 0) });
  }
  for (let i = 0; i < 6; i++) {
    const x = CHURCH.x + vr.range(-24, -8), z = CHURCH.z + vr.range(-14, 14);
    photoSpots.push({ x, z, tx: CHURCH.x + 10, tz: CHURCH.z - 17 });
  }

  const water = FOUNTAIN.tables.map((t) => ({ ...t, y: 0.5 - 0.06 }));
  const jets = [];
  const J = FOUNTAIN.jets;
  for (let i = 0; i < J.nx; i++) for (let k = 0; k < J.nz; k++) jets.push({ x: J.x0 + (i + 0.5) * ((J.x1 - J.x0) / J.nx), z: J.z0 + (k + 0.5) * ((J.z1 - J.z0) / J.nz), y: 0.5, i, k });
  for (const t of FOUNTAIN.tables) for (let x = t.x0 + 1.5; x < t.x1 - 1; x += 3) jets.push({ x, z: (t.z0 + t.z1) / 2, y: 0.44, small: true, i: Math.round(x), k: 0 });
  const glass = { x0: ARCH.x0 + 0.05, x1: ARCH.x1 - 0.05, z0: ARCH.z0 + 0.05, z1: ARCH.z1 - 0.05, y: 0.36 };
  return { trees, props, seats, cafeSeats, lamps, photoSpots, water, jets, glass };
}

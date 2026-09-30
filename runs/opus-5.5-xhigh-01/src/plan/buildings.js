// Façade specifications for the historic buildings around the square.
// Named landmarks get hand-tuned specs; ordinary townhouses are seeded
// variations drawn from the Cluj vocabulary (Baroque, Renaissance remnants,
// Neoclassical, Historicist, Eclectic, restrained Secession).

import { PLASTER, PLASTER_LIST, TRIM, ROOF, ROOF_TILES } from '../core/palette.js';

export const PERI_VS = 1 / 3;

const STYLE_HEADS = {
  baroque: [['ears', 'segment', 'cornice'], ['ears', 'cornice', 'flat'], ['flat', 'flat', 'none']],
  renaissance: [['flat', 'cornice'], ['flat', 'none'], ['none']],
  neoclassical: [['triangle', 'cornice'], ['cornice', 'flat'], ['flat', 'none']],
  historicist: [['triangle', 'segment'], ['segment', 'cornice'], ['cornice', 'flat']],
  eclectic: [['segment', 'triangle', 'ears'], ['cornice', 'segment'], ['flat', 'arch']],
  secession: [['cornice', 'flat'], ['flat', 'arch'], ['arch', 'flat']],
};

const STYLE_CORNICE = {
  baroque: ['rich', 'heavy', 'simple'], renaissance: ['simple'], neoclassical: ['rich', 'heavy'],
  historicist: ['bracket', 'rich'], eclectic: ['bracket', 'rich', 'heavy'], secession: ['simple', 'bracket'],
};

const PLASTER_W = {
  baroque: [PLASTER.paleYellow, PLASTER.ochre, PLASTER.dustyPink, PLASTER.cream, PLASTER.apricot, PLASTER.paleGreen],
  renaissance: [PLASTER.lightBeige, PLASTER.cream, PLASTER.sand, PLASTER.paleGrey],
  neoclassical: [PLASTER.cream, PLASTER.ivory, PLASTER.paleYellow, PLASTER.paleGrey, PLASTER.warmWhite],
  historicist: [PLASTER.beige, PLASTER.mutedOchre, PLASTER.softGrey, PLASTER.cream, PLASTER.mutedPink],
  eclectic: [PLASTER.pastelYellow, PLASTER.beige, PLASTER.dustyPink, PLASTER.fadedGreen, PLASTER.sand],
  secession: [PLASTER.paleGreen, PLASTER.pastelYellow, PLASTER.mutedPink, PLASTER.ivory],
};

function sumF(a) { let s = 0; for (const v of a) s += v; return s; }

// Generic townhouse spec
export function townhouse(rng, o) {
  const style = o.style || rng.weighted(['baroque', 'neoclassical', 'historicist', 'eclectic', 'secession', 'renaissance'], [3, 2.2, 2, 2.2, 0.9, 1]);
  const nUp = o.upper ?? rng.weighted([1, 2, 3], style === 'renaissance' ? [4, 2, 0.3] : [1.4, 3, 2]);
  const g0 = o.g0 ?? rng.range(4.5, 5.3);
  const floors = [g0];
  for (let i = 0; i < nUp; i++) floors.push(i === 0 ? rng.range(4.1, 4.5) : rng.range(3.6, 4.1));
  const W = o.W;
  const bays = o.bays ?? Math.max(2, Math.round(W / rng.range(3.1, 3.6)));
  const heads = [null];
  const HS = STYLE_HEADS[style];
  for (let i = 0; i < nUp; i++) heads.push(rng.pick(HS[Math.min(i, HS.length - 1)]));
  const wall = o.wall || rng.pick(PLASTER_W[style]);
  const metal = o.roofMetal ?? rng.chance(style === 'historicist' || style === 'eclectic' ? 0.22 : 0.07);
  const roof = o.roof || (metal ? rng.pick([ROOF.slate, ROOF.zinc]) : rng.pick(ROOF_TILES));
  const mansard = o.mansard ?? (metal && rng.chance(0.7));
  const spec = {
    name: o.name, style,
    W, D: o.D ?? rng.range(11.5, 14),
    vs: o.vs ?? PERI_VS,
    floors, bays, heads,
    head: heads[heads.length - 1],
    wall, trim: o.trim || rng.pick([TRIM.white, TRIM.cream, TRIM.stone, TRIM.white]),
    roof, roofMetal: metal, metalRoof: metal ? roof : ROOF.slate,
    roofType: o.roofType || (mansard ? 'mansard' : null),
    pitch: o.pitch ?? (style === 'renaissance' ? rng.range(50, 56) : style === 'baroque' ? rng.range(46, 52) : rng.range(40, 48)),
    ground: o.ground || rng.weighted(['shops', 'rustic', 'plain'], [7, 1.6, 1.2]),
    gateBay: o.gateBay ?? (bays >= 3 && rng.chance(0.55) ? Math.floor(bays / 2) + (bays % 2 === 0 && rng.chance(0.5) ? -1 : 0) : -1),
    cornice: o.cornice || rng.pick(STYLE_CORNICE[style]),
    strings: o.strings ?? style !== 'renaissance',
    pilasters: o.pilasters ?? ((style === 'baroque' || style === 'eclectic' || style === 'historicist') && rng.chance(0.4) ? 'bays' : 'none'),
    quoins: o.quoins ?? ((style === 'baroque' || style === 'renaissance' || style === 'neoclassical') && rng.chance(0.35)),
    attic: o.attic ?? (style === 'secession' && rng.chance(0.7) ? 'secession' : style === 'baroque' && W < 16 && rng.chance(0.25) ? 'gable' : style === 'neoclassical' && rng.chance(0.3) ? 'parapet' : 'none'),
    dormers: o.dormers ?? (rng.chance(0.45) ? rng.int(1, Math.min(4, bays)) : 0),
    chimneys: o.chimneys,
    awning: o.awning ?? rng.chance(0.5),
    lit: o.lit ?? rng.range(0.22, 0.45),
    mullions: true,
    aprons: style === 'baroque' || style === 'historicist',
    rusticGround: o.rusticGround ?? (style === 'historicist' && rng.chance(0.5)),
    seed: o.seed, varSeed: o.varSeed,
    corner: o.corner || null,
  };
  if (o.risalit !== undefined) spec.risalit = o.risalit;
  else if (bays >= 5 && (style === 'neoclassical' || style === 'historicist' || style === 'baroque') && rng.chance(0.4)) {
    const c = Math.floor(bays / 2);
    const half = bays >= 7 && rng.chance(0.5) ? 1 : 0;
    spec.risalit = { b0: c - half, b1: c + half + (bays % 2 === 0 ? -1 : 0), proj: rng.pick([0.33, 0.66]), top: rng.pick(['pediment', 'attic', 'segment']) };
    if (spec.risalit.b1 < spec.risalit.b0) spec.risalit.b1 = spec.risalit.b0;
  }
  if (o.balcony !== undefined) spec.balcony = o.balcony;
  else if ((style === 'eclectic' || style === 'historicist') && bays >= 3 && rng.chance(0.5)) {
    const c = Math.floor(bays / 2);
    spec.balcony = { floor: 1, b0: Math.max(0, c - (bays >= 5 ? 1 : 0)), b1: Math.min(bays - 1, c + (bays >= 5 ? 1 : 0) - (bays % 2 === 0 ? 1 : 0)), depth: 0.9, stone: rng.chance(0.4) };
  }
  if (!spec.balcony && (style === 'secession' || style === 'eclectic') && nUp >= 2 && rng.chance(0.4)) {
    spec.balconies = { floor: 2, bays: [...Array(bays).keys()].filter((b) => b % 2 === (bays % 2 ? 0 : 1)) };
  }
  if (o.rear !== undefined) spec.rear = o.rear;
  else if (rng.chance(0.6) && W >= 8) {
    const rw = Math.min(W * 0.45, rng.range(4.5, 6.5));
    const left = rng.chance(0.5);
    spec.rear = { a0: left ? 0 : W - rw, a1: left ? rw : W, d: rng.range(6, 11), h: sumF(floors.slice(0, Math.max(1, floors.length - 1))) };
  }
  spec.H = sumF(floors);
  return spec;
}

// Named landmarks on the perimeter (overrides for townhouse())
export const NAMED = {
  rucska: { name: 'Rucska House', style: 'renaissance', upper: 2, wall: PLASTER.lightBeige, trim: TRIM.stone, ground: 'plain', gateBay: 1, quoins: true, pitch: 54, roof: ROOF.rust, dormers: 2, attic: 'none', risalit: null, balcony: null },
  kemeny: { name: 'Kemény Palace', style: 'baroque', upper: 2, g0: 5.2, wall: PLASTER.paleGrey, trim: TRIM.white, ground: 'rustic', gateBay: 3, pilasters: 'bays', cornice: 'rich', risalit: { b0: 2, b1: 4, proj: 0.66, top: 'segment', head: 'segment' }, balcony: { floor: 1, b0: 2, b1: 4, depth: 1.0, stone: true }, bays: 7, roof: ROOF.terracotta, dormers: 3 },
  hintz: { name: 'Mauksch-Hintz House', style: 'renaissance', upper: 1, g0: 4.8, wall: PLASTER.pastelYellow, trim: TRIM.stone, ground: 'shops', gateBay: -1, quoins: true, pitch: 57, roof: ROOF.weathered, dormers: 3, awning: false, risalit: null, balcony: null, signs: ['#2f4a3a'] },
  townHall: { name: 'Old Town Hall', style: 'neoclassical', upper: 2, g0: 5.0, wall: PLASTER.paleYellow, trim: TRIM.white, ground: 'rustic', gateBay: 4, bays: 9, pilasters: 'giant', cornice: 'rich', risalit: { b0: 3, b1: 5, proj: 0.66, top: 'pediment', head: 'triangle' }, balcony: { floor: 1, b0: 3, b1: 5, depth: 1.0, stone: true }, attic: 'none', roof: ROOF.terracotta, dormers: 0 },
  bank: { name: 'National Bank', style: 'historicist', upper: 3, g0: 5.4, wall: PLASTER.softGrey, trim: TRIM.grey, ground: 'rustic', rusticGround: true, gateBay: 3, bays: 8, pilasters: 'bays', cornice: 'heavy', attic: 'balustrade', risalit: { b0: 3, b1: 4, proj: 0.66, top: 'attic' }, roofMetal: true, roof: ROOF.zinc, mansard: true, balcony: { floor: 1, b0: 3, b1: 4, depth: 1.0, stone: true }, dormers: 3 },
  kakas: { name: 'Wolphard-Kakas House', style: 'renaissance', upper: 1, wall: PLASTER.sand, trim: TRIM.stone, ground: 'plain', gateBay: 1, quoins: true, pitch: 56, roof: ROOF.rust, dormers: 2, risalit: null, balcony: null },
  parish: { name: 'Roman Catholic Parish House', style: 'baroque', upper: 1, g0: 5.0, wall: PLASTER.paleYellow, trim: TRIM.white, ground: 'plain', gateBay: 2, bays: 5, pilasters: 'bays', cornice: 'heavy', pitch: 52, roof: ROOF.burnt, dormers: 3, risalit: { b0: 2, b1: 2, proj: 0.33, top: 'segment' }, balcony: null, attic: 'none' },
  wass: { name: 'Wass House', style: 'baroque', upper: 2, wall: PLASTER.dustyPink, trim: TRIM.cream, ground: 'shops', gateBay: 2, bays: 4, cornice: 'rich', quoins: true, roof: ROOF.terracotta, attic: 'none', risalit: null },
  rhedey: { name: 'Rhédey Palace', style: 'baroque', upper: 2, g0: 5.2, wall: PLASTER.ochre, trim: TRIM.cream, ground: 'rustic', gateBay: 3, bays: 7, pilasters: 'bays', cornice: 'rich', risalit: { b0: 2, b1: 4, proj: 0.33, top: 'attic', head: 'segment' }, balcony: { floor: 1, b0: 3, b1: 3, depth: 1.0, stone: true }, roof: ROOF.rust, dormers: 2 },
  josika: { name: 'Jósika Palace', style: 'neoclassical', upper: 2, g0: 5.0, wall: PLASTER.ivory, trim: TRIM.white, ground: 'arcade', bays: 6, gateBay: -1, cornice: 'rich', attic: 'parapet', pilasters: 'none', risalit: null, balcony: null, roof: ROOF.terracotta, dormers: 0 },
};

// Iuliu Maniu symmetric ensemble (mirrored left/right of the street)
export function maniuPair(rng, W, i) {
  const style = i % 2 ? 'eclectic' : 'historicist';
  const o = {
    W, style, upper: 3, g0: 5.0, bays: Math.max(3, Math.round(W / 3.5)),
    wall: [PLASTER.cream, PLASTER.pastelYellow, PLASTER.beige, PLASTER.lightBeige][i % 4],
    trim: TRIM.white, ground: 'shops', cornice: 'bracket', pilasters: 'bays', attic: i % 2 ? 'balustrade' : 'none',
    roof: i % 3 === 0 ? ROOF.slate : ROOF.terracotta, roofMetal: i % 3 === 0, mansard: i % 3 === 0,
    balcony: { floor: 1, b0: 1, b1: Math.max(1, Math.round(W / 3.5) - 2), depth: 0.9 },
    dormers: 2, rear: null, risalit: null,
  };
  return o;
}

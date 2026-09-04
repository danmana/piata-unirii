// The four historic frontages of Piața Unirii: hand-specified façades placed contiguously.
import { SQ } from './layout.js';
import { buildBuilding } from './buildings.js';

const gap = (n) => ({ gap: n });

// Local frame reminder: x along the frontage, z into the block, 'left' = local x=0 end.
const SOUTH = [
  { name: 'Hotel Continental', w: 38, d: 30, floors: 3, groundH: 5.0, floorH: 4.0, roofType: 'mansard', wall: '#e2c98c', trim: '#f4ecd6', style: 'historicist', ground: 'shops', balconies: 'alternate', rustication: true, turret: { end: 'right', r: 4.6, type: 'dome', rise: 3.0 }, exposedSides: ['right'], s: 0.25, dormers: 6, chimneys: 3, litChance: 0.55, bayW: 3.6, windowW: 1.7, windowH: 2.7 },
  gap(12), // Universității
  { name: 'Casa Wolphard-Kakas', w: 18, d: 22, floors: 2, wall: '#dba59c', trim: '#f4ece4', style: 'baroque', ground: 'shops', balconies: 'center', exposedSides: ['left'], s: 0.5, roof: '#a94a2b' },
  { name: 'Old Town Hall', w: 34, d: 26, floors: 2, groundH: 5.0, floorH: 4.4, wall: '#c9cdb9', trim: '#f2f1e8', style: 'neoclassical', ground: 'palace', pilasters: true, risalit: { bays: 3, proj: 0.8 }, pediment: true, columns: true, gateBay: 'center', urns: 4, roofType: 'gable', hip: true, s: 0.25, chimneys: 2, extras: 'clocktower', rustication: true, roof: '#8f4a30' },
  { name: 'Townhouse', w: 18, d: 20, floors: 2, wall: '#ead9b5', trim: '#f6f0e2', style: 'baroque', ground: 'arcade', s: 0.5, roof: '#b5532f' },
  { name: 'Townhouse', w: 20, d: 22, floors: 3, floorH: 3.6, wall: '#b7c1a3', trim: '#efeee6', style: 'neoclassical', pilasters: true, ground: 'shops', balconies: 'alternate', s: 0.5, roof: '#c0603a' },
  { name: 'Townhouse', w: 18, d: 20, floors: 2, wall: '#d7a85f', trim: '#f5ecd8', style: 'baroque', ground: 'arcade', gateBay: 'center', s: 0.5, roof: '#9c4a2c' },
  { name: 'Townhouse', w: 22, d: 22, floors: 3, wall: '#e6dcc4', trim: '#f7f2e8', style: 'historicist', ground: 'shops', balconies: 'alternate', attic: true, s: 0.5, roof: '#a94a2b' },
  { name: 'National Bank', w: 40, d: 28, floors: 2, groundH: 5.2, floorH: 4.6, wall: '#cfc8b6', trim: '#ebe6d8', style: 'neoclassical', ground: 'palace', rustication: true, pilasters: true, risalit: { bays: 3, proj: 0.6 }, columns: true, urns: 6, attic: true, roofType: 'gable', hip: true, turret: { end: 'right', r: 3.6, type: 'dome', rise: 2.2 }, exposedSides: ['right'], s: 0.25, gateBay: 'center', roof: '#7f3d29', litChance: 0.2 },
];

const EAST = [
  gap(22), // Bulevardul Eroilor
  { name: 'Mirror Building (south)', w: 30.5, d: 26, floors: 3, floorH: 3.9, groundH: 4.8, wall: '#d9d3c4', trim: '#f0ece2', style: 'historicist', ground: 'shops', balconies: 'alternate', attic: true, roofType: 'gable', hip: true, turret: { end: 'right', r: 3.8, type: 'helmet', rise: 2.6 }, exposedSides: ['right'], s: 0.25, litChance: 0.5, bayW: 3.3, roof: '#8f4a30', slate: '#43554b' },
  gap(11), // Iuliu Maniu
  { name: 'Mirror Building (north)', w: 28, d: 26, floors: 3, floorH: 3.9, groundH: 4.8, wall: '#d9d3c4', trim: '#f0ece2', style: 'historicist', ground: 'shops', balconies: 'alternate', attic: true, roofType: 'gable', hip: true, turret: { end: 'left', r: 3.8, type: 'helmet', rise: 2.6 }, exposedSides: ['left'], s: 0.25, litChance: 0.5, bayW: 3.3, roof: '#8f4a30', slate: '#43554b' },
  { name: 'Bánffy Palace', w: 53.5, d: 44, floors: 2, groundH: 5.2, floorH: 4.6, wall: '#e5dabc', trim: '#f6f1e4', stone: '#d9d0bb', style: 'baroque', ground: 'palace', rustication: true, risalit: { bays: 3, proj: 1.0 }, columns: true, statues: 6, urns: 6, balconies: 'risalit', gateBay: 'center', courtyard: true, roofType: 'gable', hip: true, pitch: 0.9, attic: true, atticH: 2.4, s: 0.25, exposedSides: ['right'], litChance: 0.3, bayW: 3.9, windowW: 1.6, windowH: 2.8, roof: '#7f3d29', chimneys: 4, dormers: 0 },
  gap(15), // 21 Decembrie 1989
];

const NORTH = [
  gap(13), // Regele Ferdinand
  { name: 'Mauksch-Hintz House', w: 20, d: 24, floors: 2, wall: '#e2c3b6', trim: '#f5efe8', style: 'baroque', ground: 'shops', roofType: 'gable', hip: true, exposedSides: ['left'], s: 0.25, roof: '#a94a2b', signColor: '#2f4a3b' },
  { name: 'Townhouse', w: 17, d: 20, floors: 2, wall: '#ecdfc4', trim: '#f7f2e8', style: 'secession', balconies: 'center', ground: 'shops', s: 0.5, roof: '#b95a38' },
  { name: 'Kemény Palace', w: 28, d: 26, floors: 2, groundH: 5.0, floorH: 4.3, wall: '#dbb672', trim: '#f4eedd', style: 'baroque', ground: 'palace', gateBay: 'center', pilasters: true, balconies: 'center', urns: 4, roofType: 'gable', s: 0.25, courtyard: true, roof: '#9c4a2c' },
  { name: 'Townhouse', w: 16, d: 20, floors: 3, floorH: 3.5, wall: '#cdd0cb', trim: '#f1f1ee', style: 'historicist', ground: 'shops', balconies: 'alternate', s: 0.5, roof: '#b5532f' },
  { name: 'Rucska House', w: 22, d: 22, floors: 2, wall: '#a9b593', trim: '#eef0e6', style: 'baroque', ground: 'arcade', gateBay: 'center', s: 0.25, roofType: 'gable', pitch: 1.1, dormers: 3, roof: '#c0603a' },
  { name: 'Townhouse', w: 20, d: 20, floors: 3, wall: '#d8a9a2', trim: '#f6eeea', style: 'historicist', balconies: 'alternate', ground: 'shops', s: 0.5, roof: '#a94a2b' },
  { name: 'Townhouse', w: 18, d: 18, floors: 2, wall: '#efe8d6', trim: '#faf6ee', style: 'baroque', ground: 'arcade', s: 0.5, roof: '#8f4a30' },
  { name: 'Townhouse', w: 18, d: 20, floors: 3, wall: '#e9d98f', trim: '#f8f3e2', style: 'neoclassical', pilasters: true, ground: 'shops', s: 0.5, roof: '#b5532f' },
  { name: 'Townhouse', w: 20, d: 20, floors: 2, wall: '#dccbb0', trim: '#f4eee2', style: 'baroque', ground: 'shops', dormers: 4, s: 0.5, roof: '#9c4a2c' },
  { name: 'Corner house', w: 19, d: 22, floors: 3, wall: '#e8dcc2', trim: '#f6f1e6', style: 'historicist', ground: 'shops', exposedSides: ['right'], s: 0.5, roof: '#a94a2b' },
  gap(9), // Matei Corvin
];

const WEST = [
  gap(15), // Memorandumului
  { name: 'Roman Catholic parish house', w: 25, d: 24, floors: 2, wall: '#efe9db', trim: '#f8f5ee', style: 'baroque', ground: 'palace', gateBay: 'center', roofType: 'gable', hip: true, exposedSides: ['left'], s: 0.25, roof: '#a94a2b', urns: 2 },
  { name: 'Wass House', w: 20, d: 20, floors: 2, groundH: 4.4, wall: '#d2cfc6', trim: '#e9e4d6', stone: '#bfb8a8', style: 'renaissance', ground: 'arcade', roofType: 'gable', pitch: 1.25, dormers: 2, s: 0.25, roof: '#7f3d29', maxRise: 9 },
  { name: 'Jósika Palace', w: 28, d: 26, floors: 2, groundH: 5.0, floorH: 4.3, wall: '#e3cf92', trim: '#f4efe0', style: 'neoclassical', ground: 'palace', gateBay: 'center', balconies: 'center', columns: true, risalit: { bays: 3, proj: 0.6 }, pilasters: true, urns: 4, s: 0.25, courtyard: true, roof: '#9c4a2c' },
  { name: 'Townhouse', w: 16, d: 18, floors: 2, wall: '#d9aaa5', trim: '#f6eeec', style: 'baroque', ground: 'shops', s: 0.5, roof: '#b5532f' },
  { name: 'Townhouse', w: 16, d: 20, floors: 3, wall: '#b9c4ab', trim: '#f0f2ea', style: 'secession', ground: 'shops', balconies: 'center', s: 0.5, roof: '#c0603a' },
  { name: 'Rhédey Palace', w: 26, d: 26, floors: 2, groundH: 5.0, floorH: 4.4, wall: '#d6d2c8', trim: '#f1eee5', style: 'baroque', ground: 'palace', gateBay: 'center', balconies: 'center', urns: 4, roofType: 'gable', hip: true, exposedSides: ['right'], s: 0.25, courtyard: true, roof: '#8f4a30' },
  gap(14), // Napoca
];

/** Extra hand-built details keyed by spec.extras. */
function applyExtras(kind, model, info, spec, P) {
  if (kind === 'clocktower') {
    const M = {
      wall: P.get(spec.wall, 'wall'), trim: P.get(spec.trim, 'stone'), dark: P.get('#25221e', 'dark'), face: P.get('#f4efe3', 'stone'), roof: P.get('#4a4c50', 'roof'), gold: P.get('#c9a24a', 'metal'),
    };
    const cx = spec.w / 2, cz = 5.5, H = info.H;
    const tw = 2.6, top = H + 7.5;
    model.box(cx - tw, H - 1.5, cz - tw, cx + tw, top, cz + tw, M.wall);
    model.box(cx - tw - 0.3, top - 0.6, cz - tw - 0.3, cx + tw + 0.3, top, cz + tw + 0.3, M.trim);
    // pilaster strips
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) model.box(cx + ox * tw - 0.35 + (ox < 0 ? -0.15 : 0.15), H - 1.5, cz + oz * tw - 0.35 + (oz < 0 ? -0.15 : 0.15), cx + ox * tw + 0.35 + (ox < 0 ? -0.15 : 0.15), top - 0.6, cz + oz * tw + 0.35 + (oz < 0 ? -0.15 : 0.15), M.trim);
    // clock faces (front and back) and arched openings on the sides
    const cy = H + 4.6;
    for (const sgn of [-1, 1]) {
      const zf = cz + sgn * tw;
      model.shape(cx - 1.6, cy - 1.6, zf - 0.6, cx + 1.6, cy + 1.6, zf + 0.6, (x, y, z) => Math.hypot(x - cx, y - cy) <= 1.45 && Math.abs(z - zf) < 0.3, M.dark);
      model.shape(cx - 1.6, cy - 1.6, zf - 0.6, cx + 1.6, cy + 1.6, zf + 0.6, (x, y, z) => Math.hypot(x - cx, y - cy) <= 1.2 && Math.abs(z - (zf + sgn * 0.15)) < 0.2, M.face);
      model.shape(cx - 1.6, cy - 1.6, zf - 0.6, cx + 1.6, cy + 1.6, zf + 0.6, (x, y, z) => {
        const dx = x - cx, dy = y - cy;
        const d = Math.hypot(dx, dy);
        const hand1 = Math.abs(dx * 0.8 - dy * 0.6) < 0.12 && dx * 0.6 + dy * 0.8 > -0.1 && d < 0.9;
        const hand2 = Math.abs(dy) < 0.12 && dx > -0.1 && d < 0.6;
        return (hand1 || hand2 || d < 0.16) && Math.abs(z - (zf + sgn * 0.35)) < 0.2;
      }, M.dark);
    }
    for (const sgn of [-1, 1]) {
      const xf = cx + sgn * tw;
      model.box(xf - 0.6, H + 1.0, cz - 0.8, xf + 0.6, H + 3.4, cz + 0.8, M.dark);
    }
    // pyramid roof with a golden finial
    model.cone(cx, cz, tw + 0.5, 0.2, top, top + 4.2, M.roof, 4, Math.PI / 4);
    model.box(cx - 0.12, top + 4.0, cz - 0.12, cx + 0.12, top + 5.4, cz + 0.12, M.gold);
    model.ellipsoid(cx, top + 5.0, cz, 0.35, 0.35, 0.35, M.gold);
  }
}

export function buildPerimeter(world) {
  const sides = [
    { list: SOUTH, rot: 0, start: [SQ.x0, SQ.z1], step: [1, 0] },          // west -> east along z = +80
    { list: EAST, rot: Math.PI / 2, start: [SQ.x1, SQ.z1], step: [0, -1] }, // south -> north along x = +110
    { list: NORTH, rot: Math.PI, start: [SQ.x1, SQ.z0], step: [-1, 0] },    // east -> west along z = -80
    { list: WEST, rot: -Math.PI / 2, start: [SQ.x0, SQ.z0], step: [0, 1] }, // north -> south along x = -110
  ];
  const rng = world.rng.fork('perimeter');
  world.perimeter = [];
  for (const side of sides) {
    let cursor = 0;
    for (const entry of side.list) {
      if (entry.gap) { cursor += entry.gap; continue; }
      const spec = Object.assign({}, entry);
      const x = side.start[0] + side.step[0] * cursor;
      const z = side.start[1] + side.step[1] * cursor;
      const placed = world.placeBuilding(spec, x, z, side.rot, rng.fork(spec.name + cursor), { fixed: true, extras: (model, info, P) => spec.extras && applyExtras(spec.extras, model, info, spec, P) });
      if (placed) { world.perimeter.push(placed); world.stats.perimeter = (world.stats.perimeter || 0) + 1; }
      cursor += spec.w;
    }
  }
}

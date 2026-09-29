// Hero buildings around the square (LOD 0, 0.25 m voxels):
// Bánffy Palace, the Mirror Buildings (Palatele Oglindă) and the former Hotel Continental.

import { VoxelGrid } from '../core/voxel.js';
import { MatTable, LAYER, FLAG, AIR } from '../core/mat.js';
import { RNG } from '../core/rng.js';
import { ROOF } from '../core/palette.js';
import { facadeMats } from './facade.js';
import { windowAt, gateAt, shopfrontAt, cornice, pilaster, rusticate, balcony, balustrade, chimney } from './kit.js';
import { RFrame } from './gothic.js';
import { statue, vase, helmetDome, heightRoof, mansardProfile, hipProfile } from './sculpt.js';

const VS = 0.25;

// Generic wing façade: floors = [h0, h1, ...]; o = { bays | bayW, heads, ground, pil, cornice, winW, winH, lit }
function wingFacade(F, M, a0, a1, floors, o, rng, lr = rng) {
  const W = a1 - a0;
  const bays = o.bays ?? Math.max(1, Math.round(W / (o.bayW ?? 3.5)));
  const bw = W / bays;
  const g0 = floors[0];
  let H = 0; for (const f of floors) H += f;
  F.box(a0, 0, 0, a1, o.plinth ?? 0.7, F.vs, M.base);
  if (o.ground === 'rustic' || o.ground === 'rusticArch') rusticate(F, M, a0, a1, o.plinth ?? 0.7, g0 - 0.3, M.base, 0.5);
  for (let b = 0; b < bays; b++) {
    const a = a0 + (b + 0.5) * bw;
    if (o.gate === b) { gateAt(F, M, a, 0, Math.min(bw - 0.6, 3.6), g0 - 0.5, { voussoirs: true }); continue; }
    if (o.ground === 'shops' || o.ground === 'arches') {
      if (o.ground === 'arches') {
        windowAt(F, M, a, 0.35, Math.min(bw - 1.0, 2.6), g0 - 1.2, { head: 'arch', lit: lr.chance(0.85), recess: 0.5, surround: true, sill: false });
      } else {
        shopfrontAt(F, M, a, 0.3, bw - 1.0, g0 - 1.55, { sign: rng.pick(M.sign), lit: lr.chance(0.85), awning: o.awning && rng.chance(0.5) ? rng.pick(M.awnings) : null });
      }
    } else if (o.ground === 'rusticArch') {
      windowAt(F, M, a, 0.9, Math.min(bw - 1.0, 2.2), g0 - 1.6, { head: 'arch', lit: lr.chance(0.8), recess: 0.5, surround: false });
    } else {
      windowAt(F, M, a, 1.4, Math.min(o.winW ?? 1.3, bw - 0.8), Math.min(2.4, g0 - 2.2), { head: 'flat', lit: lr.chance(0.3), surround: o.ground !== 'rustic' });
    }
  }
  let y = g0;
  for (let f = 1; f < floors.length; f++) {
    const fh = floors[f];
    const head = o.heads ? o.heads[f] : 'cornice';
    const wh = (o.winH && o.winH[f]) || Math.min(fh - 1.4, 2.6);
    for (let b = 0; b < bays; b++) {
      const a = a0 + (b + 0.5) * bw;
      const hd = typeof head === 'function' ? head(b, bays) : head;
      windowAt(F, M, a, y + 0.85, Math.min(o.winW ?? 1.35, bw - 0.7), wh, { head: hd, lit: lr.chance(o.lit ?? 0.35), mullion: true, apron: f === 1 });
    }
    F.box(a0, y - F.vs, 0, a1, y + (f === 1 ? F.vs : 0), F.vs * (f === 1 ? 2 : 1), M.trim);
    y += fh;
  }
  if (o.pil) {
    const top = H - 1.6;
    for (let b = 0; b <= bays; b++) {
      const a = a0 + b * bw;
      if ((b === 0 || b === bays) && o.pilEnds === false) continue;
      pilaster(F, M, Math.min(a1 - 0.35, Math.max(a0 + 0.35, a)), g0, top, 0.55);
    }
  }
  cornice(F, M, a0, a1, H, o.cornice || 'rich');
  return { bays, bw, H };
}

// ------------------------------------------------------------ Bánffy Palace
export function buildBanffy(s) {
  const mats = new MatTable();
  const M = facadeMats(mats, { wall: '#e4d9c3', trim: '#efe9db', base: '#d6ccb8', roof: '#8e4a34' });
  const SL = mats.stone('#ebe4d5', LAYER.marble, FLAG.FLOOD);
  const rng = new RNG(s.seed >>> 0);
  const lr = new RNG(((s.varSeed ?? s.seed) ^ 0x5bd1e995) >>> 0);
  const W = 42, D = 38, DF = 13, SW = 9;
  const floors = [5.4, 6.0];
  const H = 11.4;
  const g = new VoxelGrid(0, 0, -2.8, W, H + 9, D + 0.6, VS);
  g.boundary.party = { x0: s.partyL || 0, x0z0: 0, x0z1: 16, x1: s.partyR || 0, x1z0: 0, x1z1: 20 };
  const inside = (x, z) => (z >= 0 && z <= DF && x >= 0 && x <= W) || (z >= DF && z <= D && (x <= SW || x >= W - SW || z >= D - 9) && x >= 0 && x <= W);
  g.box(0, 0, 0, W, H, DF, M.wall);
  g.box(0, 0, DF, SW, H, D, M.wallRear);
  g.box(W - SW, 0, DF, W, H, D, M.wallRear);
  g.box(SW, 0, D - 9, W - SW, H, D, M.wallRear);
  const bays = 13, bw = W / bays;
  const r0 = 5 * bw, r1 = 8 * bw;
  g.box(r0, 0, -0.9, r1, H, 0, M.wall);
  g.box(0, 0, -0.35, bw, H, 0, M.wall);
  g.box(W - bw, 0, -0.35, W, H, 0, M.wall);
  const planeAt = (a) => (a >= r0 && a < r1 ? -0.9 : (a < bw || a >= W - bw) ? -0.35 : 0);
  const FF = (p) => new RFrame(g, 0, p, 1, 0, 0, -1);
  const segs = [[0, bw, -0.35], [bw, r0, 0], [r0, r1, -0.9], [r1, W - bw, 0], [W - bw, W, -0.35]];
  for (const [a0, a1, p] of segs) {
    const F = FF(p);
    F.box(a0, 0, 0, a1, 0.8, VS, M.base);
    rusticate(F, M, a0, a1, 0.8, 5.1, M.base, 0.5);
    F.box(a0, 5.1, 0, a1, 5.6, VS * 2, M.trim);
    cornice(F, M, a0, a1, H, 'rich');
    balustrade(F, M, a0 + 0.1, a1 - 0.1, H, 1.05, M.trim, -0.5);
  }
  for (let b = 0; b < bays; b++) {
    const a = (b + 0.5) * bw;
    const F = FF(planeAt(a));
    if (b === 6) {
      gateAt(F, M, a, 0, 4.0, 5.0, { voussoirs: true, depth: 1.2, ring: 0.5 });
    } else {
      windowAt(F, M, a, 1.5, 1.3, 2.4, { head: 'flat', lit: lr.chance(0.4), surround: true, mullion: true });
    }
    const inRis = b >= 5 && b <= 7;
    windowAt(F, M, a, inRis ? 5.65 : 6.4, 1.5, inRis ? 3.9 : 3.2, {
      head: inRis ? 'segment' : (b % 2 ? 'triangle' : 'segment'), lit: lr.chance(0.55), mullion: true, apron: !inRis,
    });
  }
  // pilasters on the piano nobile, engaged columns on the risalit (column rhythm)
  for (let b = 1; b < bays; b++) {
    const a = b * bw;
    if (a > r0 - 0.1 && a < r1 + 0.1) continue;
    pilaster(FF(planeAt(a + 0.01)), M, a, 5.6, H - 1.7, 0.6);
  }
  for (const a of [r0 + 0.45, r0 + bw, r0 + 2 * bw, r1 - 0.45]) {
    g.cylY(a, -0.9, 0.36, 5.9, 9.8, SL);
    g.box(a - 0.5, 5.6, -1.4, a + 0.5, 5.95, -0.6, M.trim);
    g.box(a - 0.55, 9.7, -1.45, a + 0.55, 10.05, -0.55, M.trim);
  }
  // balcony over the gate
  balcony(FF(-0.9), M, r0 + 0.3, r1 - 0.3, 5.65, 1.3, { balustrade: true });
  // central attic with coat of arms and statue group
  const Fr = FF(-0.9);
  Fr.fn(r0, H, -0.001, r1, H + 3.4, 0.5, (a, y) => {
    const t = (a - (r0 + r1) / 2) / ((r1 - r0) / 2);
    const top = H + 2.2 + 1.1 * Math.sqrt(Math.max(0, 1 - t * t));
    return y <= top ? M.wall : -1;
  });
  Fr.fn(r0 - 0.25, H + 2.0, 0.49, r1 + 0.25, H + 3.6, 0.75, (a, y) => {
    const t = (a - (r0 + r1) / 2) / ((r1 - r0) / 2 + 0.25);
    const top = H + 2.2 + 1.1 * Math.sqrt(Math.max(0, 1 - t * t));
    return y <= top + 0.25 && y > top - 0.25 ? M.trim : -1;
  });
  g.box(r0, H, 0, r1, H + 3.0, 3.0, M.wall, 1);
  // coat of arms (cartouche)
  g.ellipsoid((r0 + r1) / 2, H + 1.7, -1.35, 1.1, 0.95, 0.35, SL);
  g.ellipsoid((r0 + r1) / 2, H + 2.75, -1.25, 0.6, 0.35, 0.3, SL);
  for (let i = 0; i < 4; i++) {
    const a = r0 + 0.8 + i * ((r1 - r0 - 1.6) / 3);
    if (i === 1 || i === 2) statue(g, a, H + 3.3, -0.4, 1.9, 0, SL, i);
  }
  // statues and vases along the roofline balustrade
  for (let k = 1; k < bays; k++) {
    if (k >= 5 && k <= 8) continue;
    const a = k * bw;
    const p = planeAt(a + 0.01);
    g.box(a - 0.45, H, p - 0.3, a + 0.45, H + 1.25, p + 0.6, M.trim);
    if (k % 2 === 1) statue(g, a, H + 1.25, p + 0.15, 2.0, 0, SL, k % 3);
    else vase(g, a, H + 1.25, p + 0.15, 1.0, SL);
  }
  for (const a of [r0 - 0.1, r1 + 0.1]) statue(g, a, H + 1.25, -0.6, 2.1, 0, SL, 2);
  // courtyard: ground-floor arcade on the front wing's inner face
  const Fc = new RFrame(g, 0, DF, 1, 0, 0, 1);
  for (let b = 0; b < 6; b++) {
    const a = SW + 1.8 + b * ((W - 2 * SW - 3.6) / 5);
    windowAt(Fc, M, a, 0, 2.4, 4.0, { head: 'arch', recess: 1.2, surround: false, sill: false, lit: lr.chance(0.5) });
    windowAt(Fc, M, a, 6.4, 1.3, 2.6, { head: 'flat', surround: false, lit: lr.chance(0.5) });
  }
  // simple windows on courtyard/side walls
  const simpleRow = (F, a0, a1, lit = 0.4) => {
    const n = Math.max(1, Math.round((a1 - a0) / 3.3));
    for (let i = 0; i < n; i++) {
      const a = a0 + (i + 0.5) * ((a1 - a0) / n);
      windowAt(F, M, a, 1.4, 1.2, 2.2, { head: 'none', surround: false, lit: lr.chance(lit) });
      windowAt(F, M, a, 6.6, 1.3, 2.7, { head: 'none', surround: false, lit: lr.chance(lit) });
    }
  };
  simpleRow(new RFrame(g, SW, 0, 0, 1, 1, 0), DF + 0.5, D - 9);
  simpleRow(new RFrame(g, W - SW, 0, 0, 1, -1, 0), DF + 0.5, D - 9);
  simpleRow(new RFrame(g, 0, D - 9, 1, 0, 0, -1), SW + 0.5, W - SW - 0.5);
  simpleRow(new RFrame(g, 0, D, 1, 0, 0, 1), 0.5, W - 0.5, 0.25);
  // roof: hipped over the U/O plan
  const dist = (x, z) => {
    const r = (ax0, az0, ax1, az1) => Math.min(x - ax0, ax1 - x, z - az0, az1 - z);
    return Math.max(r(0, 0, W, DF), r(0, DF - 1, SW, D), r(W - SW, DF - 1, W, D), r(0, D - 9, W, D));
  };
  heightRoof(g, 0, 0, W, D, H, dist, hipProfile(40, 7), (dy, x, z) => (((x * 7 + z * 3) | 0) % 11 === 0 ? M.roofVar[0] : M.roof), 8, 0.35);
  // risalit roof piece
  heightRoof(g, r0, -0.9, r1, 6, H, (x, z) => Math.min(x - r0, r1 - x, z + 0.9, 6 - z), hipProfile(40, 5), () => M.roof, 6, 0.2);
  const vr = new RNG((s.varSeed ?? 5) >>> 0);
  for (let i = 0; i < 5; i++) chimney(g, vr.range(3, W - 3), vr.range(4, 9), H, H + 5.2, M.chimney, M.chimCap);
  return { grid: g, mats };
}

// ------------------------------------------------------------ Mirror Buildings
// Built in north orientation (building south edge on Z = 0, square façade on X = 0).
export function buildMirror(s) {
  const mats = new MatTable();
  const M = facadeMats(mats, { wall: '#e7d4aa', trim: '#f1e9d7', base: '#dccfb3', roof: ROOF.slate, roofMetal: true, metalRoof: '#575b5f' });
  const zinc = mats.metal('#80868a', LAYER.metalroof);
  const slate = mats.metal('#53575b', LAYER.metalroof);
  const rng = new RNG(s.seed >>> 0);
  const lr = new RNG(((s.varSeed ?? s.seed) ^ 0x5bd1e995) >>> 0);
  const Rc = 5.5, LA = 21, WA = 16, LB = 42, WB = 14;
  const floors = [5.0, 4.4, 4.2, 3.8];
  const H = 17.4;
  const cx = Rc, cz = -Rc;
  const g = new VoxelGrid(-1.6, 0, -LA, LB, H + 13, 1.6, VS);
  g.boundary.party = { z0: s.partyN || 0, z0x0: 0, z0x1: WA, x1: s.partyE || 0, x1z0: -WB, x1z1: 0 };
  const inCorner = (x, z) => x < cx && z > cz && Math.hypot(x - cx, z - cz) > Rc;
  const inside = (x, z, off = 0) => {
    const inA = x >= -off && x <= WA && z >= -LA && z <= off;
    const inB = x >= -off && x <= LB && z >= -WB && z <= off;
    if (!(inA || inB)) return false;
    if (x < cx && z > cz) return Math.hypot(x - cx, z - cz) <= Rc + off;
    return true;
  };
  g.fn(0, 0, -LA, LB, H, 0, (x, y, z) => (inside(x, z) ? M.wall : -1));
  // façades
  const FA = new RFrame(g, 0, 0, 0, 1, -1, 0);   // square façade (faces west), a = z
  const FB = new RFrame(g, 0, 0, 1, 0, 0, 1);    // Iuliu Maniu façade (faces south), a = x
  const heads = [null, 'triangle', 'segment', 'cornice'];
  const opts = { ground: 'arches', heads, pil: true, cornice: 'rich', winW: 1.35, lit: 0.45 };
  wingFacade(FA, M, -LA, cz, floors, { ...opts, bays: 4 }, rng, lr);
  wingFacade(FB, M, cx, LB, floors, { ...opts, bays: 10 }, rng, lr);
  // rounded corner: bands, windows and a curved balcony
  const arcPt = (phi, r = Rc) => [cx - r * Math.cos(phi), cz + r * Math.sin(phi)];
  const arcFrame = (phi) => {
    const [px, pz] = arcPt(phi);
    return new RFrame(g, px, pz, Math.sin(phi), Math.cos(phi), -Math.cos(phi), Math.sin(phi));
  };
  const arcBand = (y0, y1, r0, r1, m) => {
    g.fn(-1.6, y0, cz, cx, y1, 1.6, (x, y, z, c) => {
      if (c !== AIR || !(x < cx && z > cz)) return -1;
      const d = Math.hypot(x - cx, z - cz);
      return d > Rc + r0 && d <= Rc + r1 ? m : -1;
    });
  };
  arcBand(0, 0.7, 0, VS, M.base);
  let y = floors[0];
  for (let f = 1; f < floors.length; f++) { arcBand(y - VS, y + (f === 1 ? VS : 0), 0, VS * (f === 1 ? 2 : 1), M.trim); y += floors[f]; }
  arcBand(H - 0.5, H - 0.25, 0, 0.25, M.trim);
  arcBand(H - 0.25, H, 0, 0.75, M.trim);
  for (const phi of [0.39, 1.18]) {
    const F = arcFrame(phi);
    windowAt(F, M, 0, 0.35, 2.4, 3.8, { head: 'arch', lit: true, recess: 0.5, sill: false });
    let yy = floors[0];
    for (let f = 1; f < floors.length; f++) {
      windowAt(F, M, 0, yy + (f === 1 ? 0.1 : 0.85), 1.35, f === 1 ? 3.2 : Math.min(floors[f] - 1.4, 2.6), { head: heads[f], lit: lr.chance(0.5), mullion: true });
      yy += floors[f];
    }
  }
  // curved balcony on the first floor
  g.fn(-1.6, floors[0] - 0.25, cz, cx, floors[0] + 1.05, 1.6, (x, yy, z, c) => {
    if (!(x < cx && z > cz)) return -1;
    const d = Math.hypot(x - cx, z - cz);
    if (d <= Rc || d > Rc + 1.2) return -1;
    if (yy < floors[0]) return M.trim;
    if (d > Rc + 0.95) return (yy > floors[0] + 0.8 || Math.floor(Math.atan2(z - cz, x - cx) * 40) % 2 === 0) ? M.rail : -1;
    return -1;
  });
  // attic balustrade + mansard + dormers
  balustrade(FA, M, -LA, cz, H, 0.9, M.trim, -0.4);
  balustrade(FB, M, cx, LB, H, 0.9, M.trim, -0.4);
  const dist = (x, z) => {
    let d = Math.max(Math.min(x, WA - x, z + LA, -z), Math.min(x, LB - x, z + WB, -z));
    if (x < cx && z > cz) d = Math.min(d, Rc - Math.hypot(x - cx, z - cz));
    return d;
  };
  heightRoof(g, 0, -LA, LB, 0, H, dist, mansardProfile(3.3, 76, 22, 5.0), (dy) => (dy < 3.3 ? slate : M.metal), 6, 0.1);
  for (let i = 0; i < 4; i++) dormerW(g, M, 0.5, -LA + (i + 0.5) * ((LA - Rc) / 4), H + 0.4, 'W', zinc, rng.chance(0.4));
  for (let i = 0; i < 10; i++) dormerW(g, M, cx + (i + 0.5) * ((LB - cx) / 10), -0.5, H + 0.4, 'S', zinc, rng.chance(0.4));
  // corner drum + helmet dome
  g.cylY(cx - 0.9, cz + 0.9, Rc - 0.6, H - 0.2, H + 2.4, M.wall);
  g.cylY(cx - 0.9, cz + 0.9, Rc - 0.35, H + 2.2, H + 2.6, M.trim);
  for (let k = 0; k < 8; k++) {
    const ang = (k / 8) * Math.PI * 2;
    const ox = cx - 0.9 + Math.cos(ang) * (Rc - 0.6), oz = cz + 0.9 + Math.sin(ang) * (Rc - 0.6);
    g.ellipsoid(ox, H + 1.2, oz, 0.45, 0.6, 0.45, M.glass);
  }
  helmetDome(g, cx - 0.9, cz + 0.9, H + 2.6, Rc - 0.5, 6.6, slate, zinc, { ribs: 4, lanternH: 1.4, finialH: 1.6 });
  const vr = new RNG((s.varSeed ?? 3) >>> 0);
  for (let i = 0; i < 3; i++) chimney(g, vr.range(18, 40), vr.range(-10, -5), H + 3, H + 6.8, M.chimney, M.chimCap);
  if (s.flip) g.flipZ();
  return { grid: g, mats };
}

function dormerW(g, M, x, z, y, side, zinc, lit) {
  // small arched dormer on a mansard; side 'W' faces -x at plane x, 'S' faces +z at plane z
  const w = 1.2, h = 1.9, d = 1.4;
  if (side === 'W') {
    g.box(x, y, z - w / 2, x + d, y + h, z + w / 2, M.trim);
    g.box(x, y + 0.3, z - w / 2 + 0.25, x + 0.25, y + h - 0.35, z + w / 2 - 0.25, lit ? M.glassLit : M.glass);
    g.fn(x, y + h, z - w / 2 - 0.1, x + d, y + h + 0.7, z + w / 2 + 0.1, (X, Y, Z) => (Math.abs(Z - z) <= (w / 2 + 0.1) * Math.sqrt(Math.max(0, 1 - ((Y - y - h) / 0.7) ** 2)) ? zinc : -1));
  } else {
    g.box(x - w / 2, y, z - d, x + w / 2, y + h, z, M.trim);
    g.box(x - w / 2 + 0.25, y + 0.3, z - 0.25, x + w / 2 - 0.25, y + h - 0.35, z, lit ? M.glassLit : M.glass);
    g.fn(x - w / 2 - 0.1, y + h, z - d, x + w / 2 + 0.1, y + h + 0.7, z, (X, Y) => (Math.abs(X - x) <= (w / 2 + 0.1) * Math.sqrt(Math.max(0, 1 - ((Y - y - h) / 0.7) ** 2)) ? zinc : -1));
  }
}

// ------------------------------------------------------------ Hotel Continental
// Local frame: corner at (0,0); north façade on Z = 0 (faces -z), east façade on X = 0 (faces +x).
export function buildContinental(s) {
  const mats = new MatTable();
  const M = facadeMats(mats, { wall: '#dcc59c', trim: '#f0e7d5', base: '#cdbfa4', roof: '#4d5155', roofMetal: true, metalRoof: '#4f5357' });
  const slate = mats.metal('#4a4e52', LAYER.metalroof);
  const zinc = mats.metal('#7b8185', LAYER.metalroof);
  const iron = mats.metal('#2b2c2d', LAYER.plain);
  const rng = new RNG(s.seed >>> 0);
  const lr = new RNG(((s.varSeed ?? s.seed) ^ 0x5bd1e995) >>> 0);
  const Rc = 6.5, LN = 44, WN = 15, LE = 44, WE = 15;
  const floors = [5.8, 4.6, 4.3, 4.0];
  const H = 18.7;
  const cx = -Rc, cz = Rc;
  const g = new VoxelGrid(-LN, 0, -1.8, 1.8, H + 15, LE, VS);
  g.boundary.party = { x0: s.partyW || 0, x0z0: 0, x0z1: WN, z1: s.partyS || 0, z1x0: -WE, z1x1: 0 };
  const inside = (x, z) => {
    const inN = x >= -LN && x <= 0 && z >= 0 && z <= WN;
    const inE = x >= -WE && x <= 0 && z >= 0 && z <= LE;
    if (!(inN || inE)) return false;
    if (x > cx && z < cz) return Math.hypot(x - cx, z - cz) <= Rc;
    return true;
  };
  g.fn(-LN, 0, 0, 0, H, LE, (x, y, z) => (inside(x, z) ? M.wall : -1));
  const FN = new RFrame(g, 0, 0, -1, 0, 0, -1); // north façade along Napoca: a = -x
  const FE = new RFrame(g, 0, 0, 0, 1, 1, 0);   // east façade: a = z
  const heads = [null, 'triangle', 'segment', 'ears'];
  const o = { ground: 'rusticArch', heads, pil: true, cornice: 'bracket', winW: 1.35, lit: 0.5, winH: [0, 2.9, 2.6, 2.3] };
  const wN = wingFacade(FN, M, Rc, LN, floors, { ...o, bays: 11 }, rng, lr);
  const wE = wingFacade(FE, M, cz, LE, floors, { ...o, bays: 11 }, rng, lr);
  // balconies with iron railings
  balcony(FN, M, Rc + 3 * wN.bw + 0.3, Rc + 8 * wN.bw - 0.3, floors[0] + 0.05, 1.1, {});
  balcony(FE, M, cz + 3 * wE.bw + 0.3, cz + 8 * wE.bw - 0.3, floors[0] + 0.05, 1.1, {});
  for (const b of [1, 9]) {
    balcony(FN, M, Rc + b * wN.bw + 0.2, Rc + (b + 1) * wN.bw - 0.2, floors[0] + floors[1] + 0.05, 0.8, {});
    balcony(FE, M, cz + b * wE.bw + 0.2, cz + (b + 1) * wE.bw - 0.2, floors[0] + floors[1] + 0.05, 0.8, {});
  }
  // rounded corner
  const arcFrame = (phi) => {
    const px = cx + Rc * Math.sin(phi), pz = cz - Rc * Math.cos(phi);
    return new RFrame(g, px, pz, Math.cos(phi), Math.sin(phi), Math.sin(phi), -Math.cos(phi));
  };
  const arcBand = (y0, y1, r0, r1, m) => {
    g.fn(cx, y0, -1.8, 1.8, y1, cz, (x, y, z, c) => {
      if (c !== AIR || !(x > cx && z < cz)) return -1;
      const d = Math.hypot(x - cx, z - cz);
      return d > Rc + r0 && d <= Rc + r1 ? m : -1;
    });
  };
  arcBand(0, 5.5, 0, VS, M.base);
  let y = floors[0];
  for (let f = 1; f < floors.length; f++) { arcBand(y - VS, y + (f === 1 ? VS : 0), 0, VS * 2, M.trim); y += floors[f]; }
  arcBand(H - 0.75, H - 0.25, 0, 0.5, M.trim);
  arcBand(H - 0.25, H, 0, 1.0, M.trim);
  for (const phi of [0.35, 0.785, 1.22]) {
    const F = arcFrame(phi);
    windowAt(F, M, 0, 0.9, 2.1, 4.1, { head: 'arch', lit: true, recess: 0.5, surround: false, sill: false });
    let yy = floors[0];
    for (let f = 1; f < floors.length; f++) {
      windowAt(F, M, 0, yy + 0.85, 1.3, [0, 2.9, 2.6, 2.3][f], { head: heads[f], lit: lr.chance(0.5), mullion: true });
      yy += floors[f];
    }
  }
  // curved corner balcony (first floor)
  g.fn(cx, floors[0] - 0.25, -1.8, 1.8, floors[0] + 1.05, cz, (x, yy, z) => {
    if (!(x > cx && z < cz)) return -1;
    const d = Math.hypot(x - cx, z - cz);
    if (d <= Rc || d > Rc + 1.25) return -1;
    if (yy < floors[0]) return M.trim;
    if (d > Rc + 1.0) return (yy > floors[0] + 0.8 || Math.floor(Math.atan2(z - cz, x - cx) * 44) % 2 === 0) ? iron : -1;
    return -1;
  });
  // mansard roof with dormers
  const dist = (x, z) => {
    let d = Math.max(Math.min(x + LN, -x, z, WN - z), Math.min(x + WE, -x, z, LE - z));
    if (x > cx && z < cz) d = Math.min(d, Rc - Math.hypot(x - cx, z - cz));
    return d;
  };
  heightRoof(g, -LN, 0, 0, LE, H, dist, mansardProfile(3.4, 76, 24, 5.3), (dy) => (dy < 3.4 ? slate : M.metal), 6, 0.15);
  for (let i = 0; i < 11; i++) {
    dormerN(g, M, -(Rc + (i + 0.5) * wN.bw), 0.5, H + 0.45, zinc, rng.chance(0.45));
  }
  for (let i = 0; i < 11; i++) dormerE(g, M, -0.5, cz + (i + 0.5) * wE.bw, H + 0.45, zinc, rng.chance(0.45));
  // corner pavilion: tall curved mansard with iron cresting
  const pcx = cx + 1.2, pcz = cz - 1.2, pr = Rc - 0.3;
  g.cylY(pcx, pcz, pr, H - 0.2, H + 2.0, M.wall);
  g.cylY(pcx, pcz, pr + 0.35, H + 1.8, H + 2.3, M.trim);
  g.fn(pcx - pr - 0.5, H + 2.3, pcz - pr - 0.5, pcx + pr + 0.5, H + 9.6, pcz + pr + 0.5, (x, yy, z) => {
    const t = (yy - H - 2.3) / 7.3;
    const r = pr * (1 - 0.55 * t * t) * (1 + 0.08 * Math.sin(t * Math.PI));
    const d = Math.hypot(x - pcx, z - pcz);
    if (d > r) return -1;
    if (d > r - 0.3 && Math.abs(Math.sin(Math.atan2(z - pcz, x - pcx) * 6)) < 0.12) return zinc;
    return slate;
  });
  // oeil-de-boeuf windows in the pavilion
  for (let k = 0; k < 6; k++) {
    const ang = -Math.PI / 4 + (k / 6) * Math.PI * 2;
    g.ellipsoid(pcx + Math.cos(ang) * (pr - 0.2), H + 4.2, pcz + Math.sin(ang) * (pr - 0.2), 0.55, 0.65, 0.55, M.trim);
    g.ellipsoid(pcx + Math.cos(ang) * (pr + 0.05), H + 4.2, pcz + Math.sin(ang) * (pr + 0.05), 0.32, 0.42, 0.32, M.glass);
  }
  // cresting ring + finials
  const topY = H + 9.6, tr = pr * 0.45;
  g.fn(pcx - tr - 0.3, topY - 0.1, pcz - tr - 0.3, pcx + tr + 0.3, topY + 1.0, pcz + tr + 0.3, (x, yy, z) => {
    const d = Math.hypot(x - pcx, z - pcz);
    if (yy < topY + 0.15) return d <= tr + 0.1 ? zinc : -1;
    if (d > tr - 0.1 && d <= tr + 0.15) {
      const ang = Math.atan2(z - pcz, x - pcx);
      return (yy > topY + 0.8 || Math.floor(ang * 12) % 2 === 0) ? iron : -1;
    }
    return -1;
  });
  g.box(pcx - 0.15, topY, pcz - 0.15, pcx + 0.15, topY + 2.6, pcz + 0.15, iron);
  g.sphere(pcx, topY + 1.6, pcz, 0.3, zinc);
  // end pavilions (raised mansard blocks)
  for (const [x0, z0, x1, z1] of [[-LN, 0, -LN + 8, WN], [-WE, LE - 8, 0, LE]]) {
    g.box(x0, H, z0, x1, H + 2.2, z1, M.wall, 1);
    g.box(x0 - 0.1, H + 2.0, z0 - 0.3, x1 + 0.1, H + 2.4, z1 + 0.1, M.trim);
    heightRoof(g, x0, z0, x1, z1, H + 2.4, (x, z) => Math.min(x - x0, x1 - x, z - z0, z1 - z), mansardProfile(2.8, 78, 30, 4.4), (dy) => (dy < 2.8 ? slate : zinc), 5, 0.1);
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    g.box(mx - 0.12, H + 6.8, mz - 0.12, mx + 0.12, H + 8.4, mz + 0.12, iron);
  }
  const vr = new RNG((s.varSeed ?? 9) >>> 0);
  for (let i = 0; i < 4; i++) chimney(g, vr.range(-40, -18), vr.range(6, 10), H + 3, H + 7.2, M.chimney, M.chimCap);
  return { grid: g, mats };
}

function dormerE(g, M, x, z, y, zinc, lit) {
  const w = 1.2, h = 1.9, d = 1.4;
  g.box(x - d, y, z - w / 2, x, y + h, z + w / 2, M.trim);
  g.box(x - 0.25, y + 0.3, z - w / 2 + 0.25, x, y + h - 0.35, z + w / 2 - 0.25, lit ? M.glassLit : M.glass);
  g.fn(x - d, y + h, z - w / 2 - 0.1, x, y + h + 0.7, z + w / 2 + 0.1, (X, Y, Z) => (Math.abs(Z - z) <= (w / 2 + 0.1) * Math.sqrt(Math.max(0, 1 - ((Y - y - h) / 0.7) ** 2)) ? zinc : -1));
}

function dormerN(g, M, x, z, y, zinc, lit) {
  const w = 1.2, h = 1.9, d = 1.4;
  g.box(x - w / 2, y, z, x + w / 2, y + h, z + d, M.trim);
  g.box(x - w / 2 + 0.25, y + 0.3, z, x + w / 2 - 0.25, y + h - 0.35, z + 0.25, lit ? M.glassLit : M.glass);
  g.fn(x - w / 2 - 0.1, y + h, z, x + w / 2 + 0.1, y + h + 0.7, z + d, (X, Y) => (Math.abs(X - x) <= (w / 2 + 0.1) * Math.sqrt(Math.max(0, 1 - ((Y - y - h) / 0.7) ** 2)) ? zinc : -1));
}

// St. Michael's Church (Biserica Sfântul Mihail) — hero asset, 0.25 m voxels.
// Local frame: x from the west façade (0) eastwards to the apse, z = 0 on the
// church axis (negative = north), y = 0 at the church platform.
// Massing: enormous Gothic hall nave (47 x 24 m, walls 22 m, ridge ~44 m),
// narrower choir with a polygonal apse, strongly stepped buttresses, tall
// traceried windows, a single neo-Gothic north-west tower of ~80 m.

import { VoxelGrid } from '../core/voxel.js';
import { MatTable, POOL, LAYER, FLAG, AIR } from '../core/mat.js';
import { hash01, noise2 } from '../core/rng.js';
import { CHURCH as C } from '../core/palette.js';
import { RFrame, inPointed, pointedApex, gothicWindow, buttress, pinnacle, crocketLine } from './gothic.js';
import { roof } from './kit.js';

export const CH = {
  vs: 0.25,
  nave: { x0: 0, x1: 47, hw: 12, eave: 22 },
  choir: { x0: 46, x1: 64.5, hw: 7.2, eave: 19.5 },
  apse: { cx: 64.5, R: 7.2 },
  pitch: 61,
  tower: { x: 9, z: -17.5, h: 4.8, top: 56, spireTop: 76.8 },
};
const TAN = Math.tan((CH.pitch * Math.PI) / 180);
const RIN = CH.apse.R * Math.cos(Math.PI / 8);
const APN = [-67.5, -22.5, 22.5, 67.5].map((d) => [Math.cos((d * Math.PI) / 180), Math.sin((d * Math.PI) / 180)]);
const APV = [-45, 0, 45].map((d) => [Math.cos((d * Math.PI) / 180), Math.sin((d * Math.PI) / 180)]);

function churchMats(mats) {
  const F = FLAG.FLOOD;
  return {
    S: mats.stone(C.stone, LAYER.limestone, F),
    S2: mats.stone(C.weathered, LAYER.limestone, F),
    S3: mats.stone(C.stoneWarm, LAYER.limestone, F),
    SL: mats.stone(C.stoneLight, LAYER.limestone, F),
    SD: mats.stone(C.recess, LAYER.limestone, 0),
    SK: mats.stone('#5a5246', LAYER.limestone, 0),
    T: mats.stone('#d4c9b2', LAYER.limestone, F),
    T2: mats.stone('#c7bba2', LAYER.limestone, F),
    R: mats.roof(C.roof, LAYER.roof),
    R2: mats.roof('#9d4029', LAYER.roof),
    R3: mats.roof('#b04b2f', LAYER.roof),
    R4: mats.roof(C.roofDark, LAYER.roof),
    G: [mats.glass(C.glass), mats.glass(C.glassBlue), mats.glass(C.glassRed), mats.glass(C.glassAmber)],
    GL: [mats.glass(C.glassBlue, FLAG.STAINED), mats.glass(C.glassAmber, FLAG.STAINED), mats.glass(C.glassRed, FLAG.STAINED)],
    door: mats.get(POOL.paint, '#3f2c1f', LAYER.wood),
    dial: mats.stone(C.clockFace, LAYER.plain, 0),
    gold: mats.get(POOL.metal, C.gold, LAYER.plain, 0),
    iron: mats.metal(C.darkMetal, LAYER.plain),
    louver: mats.get(POOL.metal, '#3a3632', LAYER.plain, 0),
  };
}

function stained(M) {
  return (a, y) => {
    const h = hash01(Math.floor(a * 4) + 977, Math.floor(y * 4) + 13);
    const lit = hash01(Math.floor(a * 2) + 5, Math.floor(y * 1.5)) < 0.55;
    if (lit) return h < 0.5 ? M.GL[0] : h < 0.8 ? M.GL[1] : M.GL[2];
    return h < 0.6 ? M.G[0] : h < 0.8 ? M.G[1] : h < 0.92 ? M.G[3] : M.G[2];
  };
}

function choirInside(x, z, off = 0) {
  const { choir, apse } = CH;
  if (x < choir.x0 - off) return false;
  let d = choir.hw + off - Math.abs(z);
  if (d < 0) return false;
  if (x > apse.cx) {
    for (const n of APN) {
      if ((x - apse.cx) * n[0] + z * n[1] > RIN + off) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------- body
export function buildChurchBody() {
  const vs = CH.vs;
  const mats = new MatTable();
  const M = churchMats(mats);
  const g = new VoxelGrid(-4.8, 0, -17.4, 73.2, 47.2, 16.8, vs);
  g.boundary.ground = true;
  const { nave, choir, apse } = CH;
  const glass = stained(M);

  // ---- massing
  g.box(nave.x0, 0, -nave.hw, nave.x1, nave.eave, nave.hw, M.S);
  g.fn(choir.x0, 0, -choir.hw, apse.cx + apse.R + 0.1, choir.eave, choir.hw, (x, y, z) => (choirInside(x, z) ? M.S : -1));
  // socle + drip course
  const bands = [[0, 1.2], [5.0, 5.3]];
  for (const [b0, b1] of bands) {
    g.box(nave.x0 - 0.25, b0, -nave.hw - 0.25, nave.x1, b1, nave.hw + 0.25, M.S2, 1);
    g.fn(choir.x0, b0, -choir.hw - 0.3, apse.cx + apse.R + 0.4, b1, choir.hw + 0.3, (x, y, z, c) => (c === AIR && choirInside(x, z, 0.25) ? M.S2 : -1));
  }
  // eave cornices
  g.box(nave.x0, nave.eave - 0.75, -nave.hw - 0.25, nave.x1, nave.eave - 0.25, nave.hw + 0.25, M.SL, 1);
  g.box(nave.x0, nave.eave - 0.25, -nave.hw - 0.5, nave.x1, nave.eave, nave.hw + 0.5, M.SL, 1);
  g.fn(choir.x0, choir.eave - 0.75, -choir.hw - 0.6, apse.cx + apse.R + 0.7, choir.eave, choir.hw + 0.6, (x, y, z, c) => {
    if (c !== AIR) return -1;
    const off = y > choir.eave - 0.25 ? 0.5 : 0.25;
    return choirInside(x, z, off) ? M.SL : -1;
  });

  // ---- buttresses
  const FS = RFrame.axis(g, 'S', nave.hw), FN = RFrame.axis(g, 'N', -nave.hw);
  const naveStages = [[9, 3.0], [16, 2.3], [20.6, 1.5]];
  const bx = [7.8, 15.6, 23.4, 31.2, 39.0, 46.2];
  const pinn = (x, z) => pinnacle(g, x, z, 20.0, 2.4, 0.9, 2.6, M.SL);
  for (const x of bx) {
    buttress(FS, x, 1.6, naveStages, M.S, { socle: 1.2, bands: [[5.0, 5.3]], topSlope: 1.2 });
    pinn(x, nave.hw + 1.05);
    if (x > 6 && x < 14) continue; // absorbed by the tower
    buttress(FN, x, 1.6, naveStages, M.S, { socle: 1.2, topSlope: 1.2 });
    pinn(x, -nave.hw - 1.05);
  }
  // west corner buttresses (both directions)
  const FW = RFrame.axis(g, 'W', 0);
  const westStages = [[10, 3.4], [18, 2.5], [25, 1.7]];
  for (const s of [-1, 1]) {
    buttress(FW, s * 11.0, 2.0, westStages, M.S, { socle: 1.2, topSlope: 1.0, endP: 1.0 });
    pinnacle(g, -0.85, s * 11.0, 24.2, 3.2, 1.5, 4.6, M.SL);
    const F = s > 0 ? FS : FN;
    buttress(F, 1.0, 2.0, [[9, 3.2], [17, 2.4], [22.5, 1.6]], M.S, { socle: 1.2, topSlope: 1.0, endP: 0.8 });
    pinnacle(g, 1.0, s * (nave.hw + 1.1), 21.8, 2.8, 1.2, 3.6, M.SL);
    // portal buttresses
    buttress(FW, s * 4.3, 1.2, [[12, 1.7], [19, 1.1]], M.S, { socle: 1.2, topSlope: 0.8, endP: 0.6 });
    pinnacle(g, -0.65, s * 4.3, 18.6, 2.2, 0.9, 3.0, M.SL);
  }
  // choir buttresses (sides) and radial apse buttresses
  const cStages = [[8, 2.4], [14, 1.8], [18.2, 1.2]];
  const FCS = RFrame.axis(g, 'S', choir.hw), FCN = RFrame.axis(g, 'N', -choir.hw);
  for (const x of [51.2, 57.8, 64.5]) {
    buttress(FCS, x, 1.3, cStages, M.S, { socle: 1.2, bands: [[5.0, 5.3]] });
    buttress(FCN, x, 1.3, cStages, M.S, { socle: 1.2, bands: [[5.0, 5.3]] });
    pinnacle(g, x, choir.hw + 0.8, 17.6, 2.0, 0.8, 2.4, M.SL);
    pinnacle(g, x, -choir.hw - 0.8, 17.6, 2.0, 0.8, 2.4, M.SL);
  }
  for (const [cx, cz] of APV) {
    const ox = apse.cx + cx * apse.R, oz = cz * apse.R;
    const F = new RFrame(g, ox, oz, -cz, cx, cx, cz);
    buttress(F, 0, 1.3, cStages, M.S, { socle: 1.2, bands: [[5.0, 5.3]] });
    pinnacle(g, ox + cx * 0.8, oz + cz * 0.8, 17.6, 2.0, 0.8, 2.4, M.SL);
  }

  // ---- windows: nave
  const winSpec = { lights: 3, depth: 0.75, splay: 2, stone: M.S, tracery: M.SL, reveal: M.SD, glass };
  const bayC = [3.9, 11.7, 19.5, 27.3, 35.1, 42.6];
  for (let b = 0; b < bayC.length; b++) {
    const x = bayC[b];
    const w = b === 0 ? 3.0 : 3.4;
    // south side (bay 3 carries the south portal below a shortened window)
    if (b === 3) gothicWindow(FS, x, 10.8, w, 16.2, winSpec);
    else gothicWindow(FS, x, 5.6, w, 16.2, winSpec);
    if (b <= 1 || b === 4) continue; // tower + Schleunig chapel on the north
    gothicWindow(FN, x, 5.6, w, 16.2, winSpec);
  }
  // high window above the north chapel
  gothicWindow(FN, bayC[4], 12.4, 3.4, 16.4, { ...winSpec, lights: 2 });
  // choir windows
  const cw = { lights: 2, depth: 0.75, splay: 2, stone: M.S, tracery: M.SL, reveal: M.SD, glass };
  for (const x of [49.1, 54.5, 61.1]) {
    gothicWindow(FCS, x, 5.4, 2.5, 14.6, cw);
    gothicWindow(FCN, x, 5.4, 2.5, 14.6, cw);
  }
  for (const [nx, nz] of APN) {
    const F = new RFrame(g, apse.cx + nx * RIN, nz * RIN, -nz, nx, nx, nz);
    gothicWindow(F, 0, 5.4, 2.4, 14.6, cw);
  }

  // ---- south portal (bay 3)
  portal(FS, M, bayC[3], 0, 3.8, 4.6, 1.1, 4, 9.6);

  // ---- west façade
  portal(FW, M, 0, 0, 6.2, 7.2, 1.5, 5, 15.8, true);
  // west gable (stone), following the roof slope
  const gableTop = (z) => nave.eave + (nave.hw + 0.3 - Math.abs(z)) * TAN + 0.35;
  g.fn(0, nave.eave - 0.5, -nave.hw, 1.25, 45.6, nave.hw, (x, y, z) => (y <= gableTop(z) ? M.S : -1));
  gothicWindow(FW, 0, 15.8, 6.0, 22.0, { lights: 4, rose: true, depth: 1.0, splay: 3, stone: M.S, tracery: M.SL, reveal: M.SD, glass });
  // gallery across the façade
  FW.fn(-9.6, 27.6, 0, 9.6, 28.9, 0.5, (a, y) => {
    if (y < 27.85) return M.SL;
    if (y > 28.6) return M.SL;
    return Math.floor((a + 20) / 0.25) % 2 === 0 ? M.SL : -1;
  });
  // blind arcade on the gable
  for (let i = -3; i <= 3; i++) {
    const a = i * 1.55;
    const top = gableTop(a) - 1.8;
    const spring = Math.min(33.8, top - 1.0);
    if (spring < 30.5) continue;
    FW.fn(a - 0.55, 29.6, -0.26, a + 0.55, spring + 1.2, 0.01, (A, y) => (inPointed(A - a, y, spring, 0.5, 0.9) && y >= 29.6 ? AIR : -1));
  }
  // small rose in the gable
  FW.fn(-1.5, 35.4, -0.51, 1.5, 38.4, 0.01, (a, y, n) => {
    const d = Math.hypot(a, y - 36.9);
    if (d > 1.4) return -1;
    if (d > 1.15) return -1;
    if (n > -0.25) return AIR;
    const ang = Math.atan2(y - 36.9, a);
    return (Math.abs(Math.sin(ang * 3)) * d < 0.14 || d < 0.3) ? M.SL : M.G[1];
  });
  crocketLine(g, 0.6, nave.eave + 0.6, -nave.hw, 0.6, 44.6, 0, 1.0, M.SL);
  crocketLine(g, 0.6, nave.eave + 0.6, nave.hw, 0.6, 44.6, 0, 1.0, M.SL);
  pinnacle(g, 0.6, 0, 44.4, 0.8, 0.75, 1.6, M.SL, { gablets: false });

  // ---- Schleunig chapel (north side, Renaissance)
  g.box(32.2, 0, -16.3, 38.0, 10.6, -nave.hw, M.S3, 1);
  g.box(32.0, 0, -16.55, 38.2, 1.1, -nave.hw, M.S2, 1);
  g.box(31.95, 10.1, -16.6, 38.25, 10.6, -nave.hw, M.SL, 1);
  const FC = RFrame.axis(g, 'N', -16.3);
  for (const a of [33.9, 36.3]) {
    FC.box(a - 0.5, 4.2, -0.5, a + 0.5, 7.4, 0.01, AIR);
    FC.box(a - 0.5, 4.2, -0.75, a + 0.5, 7.4, -0.5, M.G[0]);
    FC.box(a - 0.75, 3.95, 0, a + 0.75, 7.65, 0.25, M.SL, 1);
  }
  roof(g, { x0: 32.2, x1: 38.0, z0: -16.3, z1: -12, y: 10.6, pitch: 48, type: 'hip', ov: 0.3, mat: M.R2, onlyEmpty: true });

  // ---- roofs
  const roofVary = (x, y, z, m) => {
    const n = noise2(x * 0.9, z * 0.9 + y * 1.7, 71);
    if (n > 0.8) return M.R2;
    if (n < 0.16) return M.R3;
    return m;
  };
  // nave: gable against the west façade, hipped towards the choir
  g.fn(1.2, nave.eave, -nave.hw - 0.4, nave.x1 + 0.4, 46.5, nave.hw + 0.4, (x, y, z, c) => {
    const dy = y - nave.eave;
    const d = dy / TAN;
    if (Math.abs(z) > nave.hw + 0.35 - d) return -1;
    if (x > nave.x1 + 0.35 - d) return -1;
    if (c !== AIR) return -1;
    return roofVary(x, y, z, M.R);
  });
  // choir + apse: gable with polygonal hip
  g.fn(choir.x0 - 1, choir.eave, -choir.hw - 0.4, apse.cx + apse.R + 0.5, 34, choir.hw + 0.4, (x, y, z, c) => {
    if (c !== AIR) return -1;
    const dy = y - choir.eave;
    let dist = choir.hw + 0.35 - Math.abs(z);
    if (x > apse.cx) for (const n of APN) dist = Math.min(dist, RIN + 0.35 - ((x - apse.cx) * n[0] + z * n[1]));
    if (dist < dy / TAN) return -1;
    return roofVary(x, y, z, M.R);
  });
  // small eyelid dormers on the great roof
  for (const x of [11, 23, 35]) {
    for (const s of [-1, 1]) {
      const y0 = 30.2;
      const zf = s * (nave.hw + 0.35 - (y0 + 0.5 - nave.eave) / TAN);
      g.box(x - 0.5, y0, Math.min(zf, zf + s * 0.5) - 0.5 * (s < 0 ? 0 : 1), x + 0.5, y0 + 0.75, Math.max(zf, zf + s * 0.5) - 0.5 * (s > 0 ? 0 : 1), M.R4);
      g.box(x - 0.25, y0, zf + s * 0.25 - 0.125, x + 0.25, y0 + 0.5, zf + s * 0.25 + 0.125, M.SK);
    }
  }
  // ridge crest line
  g.fn(1.2, 43.4, -0.2, 35.6, 44.9, 0.2, (x, y, z, c) => (c !== AIR && y > 43.9 ? M.R4 : -1));

  // ---- weathering pass
  g.fn(-4.8, 0, -17.4, 73.2, 26, 16.8, (x, y, z, c) => {
    if (c !== M.S) return -1;
    const n = noise2(x * 0.3, z * 0.3 + y * 0.18, 17);
    if (y < 1.6 + n * 1.8) return M.S2;
    if (n > 0.78) return M.S3;
    return -1;
  });
  return { grid: g, mats };
}

// Deep Gothic portal with stepped archivolts, door and wimperg
function portal(F, M, a, y0, w, h, depth, orders, wimpergTop, grand = false) {
  const vs = F.vs;
  const hw = w / 2;
  const spring = y0 + h - hw * 0.9;
  const R = w * 0.9;
  F.fn(a - hw - 0.2, y0, -depth - vs, a + hw + 0.2, y0 + h + 2, 0.01, (A, Y, N) => {
    const aa = A - a;
    const k = Math.floor(-N / vs);
    if (N < -depth) {
      const dh = hw - orders * vs * 0.9;
      if (!inPointed(aa, Y, spring, dh, R - orders * vs * 0.9)) return -1;
      const lintel = spring - 0.2;
      if (Y < lintel) return Math.abs(aa) < vs * 0.5 && grand ? M.SL : M.door;
      if (Y < lintel + vs) return M.SL;
      return hash01(Math.floor(A * 4), Math.floor(Y * 4), 3) < 0.35 ? M.SL : M.S3;
    }
    const e = -(Math.min(k, orders)) * vs * 0.9;
    if (inPointed(aa, Y, spring, hw, R, e)) return AIR;
    return -1;
  });
  // wimperg (pointed gable) framing the arch
  const apex = pointedApex(spring, hw, R);
  const base = spring;
  const half = hw + 0.5;
  F.fn(a - half, base, 0, a + half, wimpergTop, 0.5, (A, Y, N, c) => {
    const aa = A - a;
    const lim = half * (1 - (Y - base) / (wimpergTop - base));
    if (Math.abs(aa) > lim) return -1;
    if (inPointed(aa, Y, spring, hw, R, 0.3)) return -1;
    if (Math.abs(aa) > lim - 0.3) return M.SL;
    if (N < 0.25) return M.S;
    // trefoil blind oculus
    const d = Math.hypot(aa, Y - (apex + (wimpergTop - apex) * 0.4));
    if (d < 0.55 && d > 0.3) return M.SL;
    return -1;
  });
  // crockets and finial on the wimperg
  for (const s of [-1, 1]) {
    const n = 5;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const Y = base + (wimpergTop - base) * t;
      const A = a + s * half * (1 - t);
      F.box(A - vs * 0.5 + s * vs, Y, 0.25, A + vs * 0.5 + s * vs, Y + vs, 0.5, M.SL);
    }
  }
  F.box(a - vs * 0.5, wimpergTop, 0.1, a + vs * 0.5, wimpergTop + 0.9, 0.4, M.SL);
  F.box(a - vs * 1.5, wimpergTop + 0.5, 0.1, a + vs * 1.5, wimpergTop + 0.75, 0.4, M.SL);
}

// ---------------------------------------------------------------- tower
export function buildChurchTower() {
  const vs = CH.vs;
  const mats = new MatTable();
  const M = churchMats(mats);
  const T = CH.tower;
  const g = new VoxelGrid(1.2, 0, -25.6, 16.8, 81.2, -11.4, vs);
  g.boundary.ground = true;
  const x0 = T.x - T.h, x1 = T.x + T.h, z0 = T.z - T.h, z1 = T.z + T.h;
  const glass = stained(M);
  // core
  g.box(x0, 0, z0, x1, T.top, z1, M.T);
  g.box(x0, 0, z0, x1, 22.2, z1, M.S);
  // socle and string courses
  for (const [b0, b1, off] of [[0, 1.4, 0.3], [22.2, 22.7, 0.3], [35.3, 35.8, 0.3], [43.6, 44.4, 0.25], [55.2, 55.7, 0.5]]) {
    g.box(x0 - off, b0, z0 - off, x1 + off, b1, z1 + off, M.SL, 1);
  }
  const faces = {
    N: RFrame.axis(g, 'N', z0), S: RFrame.axis(g, 'S', z1),
    W: RFrame.axis(g, 'W', x0), E: RFrame.axis(g, 'E', x1),
  };
  const centreA = { N: T.x, S: T.x, W: T.z, E: T.z };
  // corner buttresses
  const tStages = [[20.5, 2.0], [34.5, 1.45], [45.5, 0.85]];
  for (const sx of [-1, 1]) {
    const F = sx < 0 ? faces.W : faces.E;
    buttress(F, z0 + 0.65, 1.3, tStages, M.T, { socle: 1.4, topSlope: 1.0 });
    buttress(F, z1 - 0.65, 1.3, tStages, M.T, { socle: 1.4, topSlope: 1.0 });
    buttress(faces.N, T.x + sx * (T.h - 0.65), 1.3, tStages, M.T, { socle: 1.4, topSlope: 1.0 });
  }
  // door on the north face
  const FNf = faces.N;
  FNf.fn(T.x - 1.3, 0, -0.9, T.x + 1.3, 5.4, 0.01, (a, y, n) => {
    const aa = a - T.x;
    const k = Math.floor(-n / vs);
    if (n < -0.75) return inPointed(aa, y, 3.4, 0.8, 1.5) ? M.door : -1;
    return inPointed(aa, y, 3.4, 1.2 - Math.min(k, 2) * 0.2, 1.9 - Math.min(k, 2) * 0.2) ? AIR : -1;
  });
  // lancets in the lower stage
  for (const side of ['N', 'W', 'E']) {
    const F = faces[side];
    for (const y of [9.5, 15.5]) {
      gothicWindow(F, centreA[side], y, 1.0, y + 2.6, { lights: 1, depth: 0.5, splay: 1, stone: M.S, reveal: M.SD, glass: () => M.G[0] });
    }
  }
  // stage 2: paired blind lancets, stage 3: clock, stage 4: belfry with wimpergs
  for (const side of ['N', 'S', 'W', 'E']) {
    const F = faces[side];
    const c = centreA[side];
    for (const s of [-1, 1]) {
      gothicWindow(F, c + s * 1.7, 24.0, 1.6, 31.6, { lights: 1, depth: 0.5, splay: 1, stone: M.T, reveal: M.T2, glass: () => M.SD });
    }
    clockFace(F, M, c, 39.8);
    // corbel frieze
    F.fn(c - T.h, 43.1, 0, c + T.h, 43.6, 0.25, (a) => (Math.floor((a + 40) / 0.5) % 2 === 0 ? M.SL : -1));
    // belfry openings with louvres
    for (const s of [-1, 1]) {
      const ac = c + s * 1.75;
      F.fn(ac - 1.1, 45.2, -1.26, ac + 1.1, 53.6, 0.01, (a, y, n) => {
        const aa = a - ac;
        const k = Math.floor(-n / vs);
        const e = Math.max(0, 1 - k) * 0.22;
        if (n < -1.0) {
          if (!inPointed(aa, y, 51.4, 0.75, 1.4)) return -1;
          return Math.floor(y / 0.5) % 2 === 0 ? M.louver : M.SK;
        }
        if (inPointed(aa, y, 51.4, 0.75, 1.4, e)) {
          if (n < -0.74 && Math.abs(aa) < 0.13 && y < 51.4) return M.T; // colonnette
          if (n < -0.74 && inPointed(aa, y, 51.4, 0.75, 1.4) && !inPointed(aa, y, 51.4, 0.62, 1.2) && y > 51.4) return M.T;
          return AIR;
        }
        return -1;
      });
    }
    // wimperg over the belfry pair
    const base = 52.2, top = 58.4, half = 3.9;
    F.fn(c - half, base, 0, c + half, top, 0.5, (a, y, n) => {
      const aa = a - c;
      const lim = half * (1 - (y - base) / (top - base));
      if (Math.abs(aa) > lim) return -1;
      for (const s of [-1, 1]) if (inPointed(aa - s * 1.75, y, 51.4, 0.75, 1.4, 0.35)) return -1;
      if (Math.abs(aa) > lim - 0.3) return M.SL;
      if (n < 0.25) return M.T;
      const d = Math.hypot(aa, y - 55.2);
      return d < 0.7 && d > 0.45 ? M.SL : -1;
    });
    for (const s of [-1, 1]) {
      for (let i = 1; i < 6; i++) {
        const t = i / 6;
        const y = base + (top - base) * t;
        const a = c + s * half * (1 - t);
        F.box(a - vs * 0.5 + s * vs, y, 0.25, a + vs * 0.5 + s * vs, y + vs, 0.5, M.SL);
      }
    }
    F.box(c - vs * 0.5, top, 0.1, c + vs * 0.5, top + 1.2, 0.4, M.SL);
    F.box(c - vs * 1.5, top + 0.7, 0.1, c + vs * 1.5, top + 0.95, 0.4, M.SL);
    // pierced parapet
    F.fn(c - T.h - 0.5, 55.7, 0, c + T.h + 0.5, 56.9, 0.5, (a, y) => {
      if (y > 56.6) return M.SL;
      return Math.floor((a + 40) / 0.25) % 2 === 0 ? M.SL : -1;
    });
  }
  // corner pinnacles
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    pinnacle(g, T.x + sx * (T.h - 0.2), T.z + sz * (T.h - 0.2), 52.8, 5.6, 1.4, 5.2, M.T);
  }
  // octagonal spire
  const sb = T.top, st = T.spireTop;
  const r0 = 4.05;
  const k8 = Math.SQRT1_2;
  g.fn(T.x - r0 - 0.3, sb, T.z - r0 - 0.3, T.x + r0 + 0.3, st, T.z + r0 + 0.3, (x, y, z, c) => {
    const t = (y - sb) / (st - sb);
    const r = r0 * (1 - t) + 0.12 * t;
    const dx = Math.abs(x - T.x), dz = Math.abs(z - T.z);
    if (Math.max(dx, dz, (dx + dz) * k8) > r) return -1;
    const band = ((y - sb) % 4.2) < 0.3;
    return band ? M.T : M.T2;
  });
  // crockets on the 8 edges
  for (let y = sb + 1.2; y < st - 1.2; y += 1.25) {
    const t = (y - sb) / (st - sb);
    const r = (r0 * (1 - t) + 0.12 * t) / Math.cos(Math.PI / 8) + vs * 0.6;
    for (let k = 0; k < 8; k++) {
      const ang = Math.PI / 8 + (k * Math.PI) / 4;
      g.set(T.x + Math.cos(ang) * r, y, T.z + Math.sin(ang) * r, M.SL);
    }
  }
  // lucarnes at the spire base
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const fx = T.x + dx * 3.6, fz = T.z + dz * 3.6;
    const hw = 0.7;
    const ax0 = dx !== 0 ? Math.min(fx, fx + dx * 0.9) : fx - hw, ax1 = dx !== 0 ? Math.max(fx, fx + dx * 0.9) : fx + hw;
    const az0 = dz !== 0 ? Math.min(fz, fz + dz * 0.9) : fz - hw, az1 = dz !== 0 ? Math.max(fz, fz + dz * 0.9) : fz + hw;
    g.box(ax0 - (dx ? 1.2 : 0) * (dx > 0 ? 1 : 0), 57.0, az0 - (dz ? 1.2 : 0) * (dz > 0 ? 1 : 0), ax1 + (dx < 0 ? 1.2 : 0), 59.4, az1 + (dz < 0 ? 1.2 : 0), M.T);
    g.fn(Math.min(ax0, ax1) - 1.3, 59.4, Math.min(az0, az1) - 1.3, Math.max(ax0, ax1) + 1.3, 61.0, Math.max(az0, az1) + 1.3, (x, y, z, c) => {
      const along = dx !== 0 ? Math.abs(z - fz) : Math.abs(x - fx);
      const outw = dx !== 0 ? (x - fx) * dx : (z - fz) * dz;
      if (outw < -1.2 || outw > 0.9) return -1;
      return along <= hw - (y - 59.4) * 0.45 ? M.T2 : -1;
    });
    // dark opening
    const ox = fx + dx * 0.9, oz = fz + dz * 0.9;
    g.box(ox - (dx ? 0.26 : 0.3), 57.4, oz - (dz ? 0.26 : 0.3), ox + (dx ? 0.01 : 0.3), 58.9, oz + (dz ? 0.01 : 0.3), M.SK);
  }
  // knob and cross
  g.sphere(T.x, st + 0.3, T.z, 0.42, M.gold);
  g.box(T.x - 0.125, st + 0.5, T.z - 0.125, T.x + 0.125, st + 3.9, T.z + 0.125, M.gold);
  g.box(T.x - 0.75, st + 2.55, T.z - 0.125, T.x + 0.75, st + 2.8, T.z + 0.125, M.gold);
  // weathering on the tower base
  g.fn(1.2, 0, -25.6, 16.8, 3.5, -11.4, (x, y, z, c) => {
    if (c !== M.S && c !== M.T) return -1;
    return y < 1.5 + noise2(x * 0.4, z * 0.4, 5) * 1.8 ? M.S2 : -1;
  });
  return { grid: g, mats };
}

function clockFace(F, M, c, yc) {
  const vs = F.vs;
  const r = 1.85;
  F.fn(c - 2.6, yc - 2.6, 0, c + 2.6, yc + 2.6, 0.75, (a, y, n, cur) => {
    const d = Math.hypot(a - c, y - yc);
    if (n < 0.25) {
      if (d <= r) return M.dial;
      if (d <= r + 0.35) return M.gold;
      if (d <= r + 0.7) return M.SL;
      return -1;
    }
    if (n < 0.5) {
      if (d > r + 0.35 && d <= r + 0.7) return M.SL;
      // hour marks
      if (d > r - 0.45 && d < r - 0.1) {
        const ang = Math.atan2(y - yc, a - c);
        const k = Math.round((ang / (Math.PI * 2)) * 12);
        if (Math.abs(ang - (k * Math.PI * 2) / 12) * d < 0.14) return M.iron;
      }
      // hands at 10:10
      const hand = (ang, len) => {
        const ux = Math.cos(ang), uy = Math.sin(ang);
        const px = a - c, py = y - yc;
        const t = px * ux + py * uy;
        return t > -0.2 && t < len && Math.abs(px * uy - py * ux) < 0.14;
      };
      if (hand((Math.PI / 180) * 150, 1.05) || hand((Math.PI / 180) * 30, 1.5)) return M.iron;
      if (d < 0.2) return M.gold;
    }
    return -1;
  });
}

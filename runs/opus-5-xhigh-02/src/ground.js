// Continuous solid ground: one quantised heightfield covering the whole old town,
// merged greedily into a handful of quads per surface class, plus vertical risers at
// every kerb and terrain terrace so the mesh is watertight with no visible voids.
//
// Ambient occlusion is baked into a single generated lightmap (uv1) rather than into
// vertex colours, so the huge merged plaza quads still get soft contact darkening.

import * as THREE from 'three';
import {
  MAP, SQUARE, PLAZA, STREETS, CHURCH_GRASS, ROMAN_WINDOW, FOUNTAIN, WATER_TABLES,
  terrainHeight, streetBounds, distToPolyline,
} from './layout.js';
import { P, M } from './palette.js';
import { Rng, makeNoise2D } from './rng.js';

export const CELL = 1.0;
const W = Math.round((MAP.x1 - MAP.x0) / CELL);
const H = Math.round((MAP.z1 - MAP.z0) / CELL);

// surface classes
export const S = {
  COURT: 0, PLAZA_A: 1, PLAZA_B: 2, PLAZA_C: 3, BAND: 4, PLAZA_DARK: 5,
  ROAD: 6, ROAD2: 7, WALK: 8, KERB: 9, GRASS: 10, GRASS2: 11, GRASS3: 12,
  SOIL: 13, PIT: 14, BASE: 15, GRAVEL: 16, BASIN: 17,
};
const CLASS_MAT = [];
CLASS_MAT[S.COURT] = P.courtyard; CLASS_MAT[S.PLAZA_A] = P.plazaA; CLASS_MAT[S.PLAZA_B] = P.plazaB;
CLASS_MAT[S.PLAZA_C] = P.plazaC; CLASS_MAT[S.BAND] = P.plazaBand; CLASS_MAT[S.PLAZA_DARK] = P.plazaDark;
CLASS_MAT[S.ROAD] = P.roadStone; CLASS_MAT[S.ROAD2] = P.roadStone2; CLASS_MAT[S.WALK] = P.sidewalk;
CLASS_MAT[S.KERB] = P.kerb; CLASS_MAT[S.GRASS] = P.grass; CLASS_MAT[S.GRASS2] = P.grassDark;
CLASS_MAT[S.GRASS3] = P.grassLight; CLASS_MAT[S.SOIL] = P.soil; CLASS_MAT[S.PIT] = P.greyStoneDark;
CLASS_MAT[S.BASE] = P.sidewalk; CLASS_MAT[S.GRAVEL] = P.gravel; CLASS_MAT[S.BASIN] = P.plazaDark;

const SOFT = new Set([S.GRASS, S.GRASS2, S.GRASS3, S.SOIL]);

const gclass = new Uint8Array(W * H);
const gheight = new Float32Array(W * H);
let built = false;

const cx = (i) => MAP.x0 + (i + 0.5) * CELL;
const cz = (j) => MAP.z0 + (j + 0.5) * CELL;

function inRect(x, z, r, pad = 0) {
  return x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;
}

function paint(footprints) {
  const n1 = makeNoise2D('plaza-tone');
  const n2 = makeNoise2D('court-tone');
  const rng = new Rng('ground');

  // 1. base: courtyards / soil in the block interiors
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = cx(i), z = cz(j);
      const k = j * W + i;
      gheight[k] = terrainHeight(x, z);
      const t = n2.fbm(x / 46, z / 46, 3);
      gclass[k] = t > 0.80 ? S.GRASS2 : (t > 0.70 ? S.GRASS : (t > 0.26 ? S.COURT : S.GRAVEL));
    }
  }

  // 2. the square: footway apron, then the plaza proper
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = cx(i), z = cz(j);
      if (!inRect(x, z, SQUARE, 6)) continue;
      const k = j * W + i;
      gheight[k] = 0;
      if (inRect(x, z, PLAZA)) {
        // broad refined stone with low-frequency tonal drift and a discreet
        // 16 m band grid; nothing cobble-sized.
        const tone = n1.fbm(x / 34 + 5, z / 34 + 9, 3);
        let c = tone > 0.58 ? S.PLAZA_B : (tone < 0.42 ? S.PLAZA_C : S.PLAZA_A);
        const bx = Math.abs(((x + 800) % 16) - 0.5) < 0.6;
        const bz = Math.abs(((z + 800) % 16) - 0.5) < 0.6;
        if (bx || bz) c = S.BAND;
        // darker apron just inside the plaza edge
        const edge = Math.min(x - PLAZA.x0, PLAZA.x1 - x, z - PLAZA.z0, PLAZA.z1 - z);
        if (edge < 2.0) c = S.PLAZA_DARK;
        gclass[k] = c;
      } else {
        gclass[k] = S.WALK;
      }
    }
  }

  // 3. streets: carriageway a kerb-height below the footway
  for (const s of STREETS) {
    const b = streetBounds(s, 5);
    const i0 = Math.max(0, Math.floor((b.x0 - MAP.x0) / CELL));
    const i1 = Math.min(W - 1, Math.ceil((b.x1 - MAP.x0) / CELL));
    const j0 = Math.max(0, Math.floor((b.z0 - MAP.z0) / CELL));
    const j1 = Math.min(H - 1, Math.ceil((b.z1 - MAP.z0) / CELL));
    const hw = s.width / 2;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = cx(i), z = cz(j);
        const d = distToPolyline(x, z, s.pts);
        if (d > hw + 3.4) continue;
        const k = j * W + i;
        if (d <= hw) {
          if (s.ped) { gclass[k] = S.PLAZA_C; }
          else {
            gclass[k] = n2.fbm(x / 11 + 41, z / 11 + 7, 2) > 0.5 ? S.ROAD : S.ROAD2;
            gheight[k] = (inRect(x, z, SQUARE, 2) ? 0 : terrainHeight(x, z)) - 0.25;
          }
        } else if (!s.ped && d <= hw + 0.9) {
          gclass[k] = S.KERB;
          gheight[k] = inRect(x, z, SQUARE, 2) ? 0 : terrainHeight(x, z);
        } else if (gclass[k] !== S.KERB) {
          if (!inRect(x, z, PLAZA)) gclass[k] = S.WALK;
          if (!inRect(x, z, SQUARE, 2)) gheight[k] = terrainHeight(x, z);
        }
      }
    }
  }

  // 4. church grounds: maintained grass with a low stone edging
  for (const g of CHURCH_GRASS) {
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const x = cx(i), z = cz(j);
        if (!inRect(x, z, g, 0.9)) continue;
        const k = j * W + i;
        gheight[k] = 0;
        if (!inRect(x, z, g)) { gclass[k] = S.KERB; continue; }
        const t = n1.fbm(x / 7 + 31, z / 7 + 17, 2);
        gclass[k] = t > 0.58 ? S.GRASS3 : (t < 0.42 ? S.GRASS2 : S.GRASS);
      }
    }
  }

  // 5. the Roman Napoca window: a rectangular pit sunk into the paving
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = cx(i), z = cz(j);
      if (!inRect(x, z, ROMAN_WINDOW)) continue;
      const k = j * W + i;
      gclass[k] = S.PIT;
      gheight[k] = -ROMAN_WINDOW.depth;
    }
  }

  // 6. fountain basins and water tables sit a step below the paving
  const basins = [FOUNTAIN, ...WATER_TABLES];
  for (const bsn of basins) {
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const x = cx(i), z = cz(j);
        if (!inRect(x, z, bsn)) continue;
        const k = j * W + i;
        gclass[k] = S.BASIN;
        gheight[k] = -0.25;
      }
    }
  }

  // 7. building footprints get a flat stone base at their own plinth level
  for (const f of footprints) {
    const i0 = Math.max(0, Math.floor((f.x0 - MAP.x0) / CELL));
    const i1 = Math.min(W - 1, Math.ceil((f.x1 - MAP.x0) / CELL) - 1);
    const j0 = Math.max(0, Math.floor((f.z0 - MAP.z0) / CELL));
    const j1 = Math.min(H - 1, Math.ceil((f.z1 - MAP.z0) / CELL) - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * W + i;
      gclass[k] = S.BASE;
      gheight[k] = f.base;
    }
  }
  built = true;
}

export function heightAt(x, z) {
  if (!built) return terrainHeight(x, z);
  const i = Math.floor((x - MAP.x0) / CELL), j = Math.floor((z - MAP.z0) / CELL);
  if (i < 0 || j < 0 || i >= W || j >= H) return terrainHeight(x, z);
  return gheight[j * W + i];
}

export function classAt(x, z) {
  if (!built) return S.COURT;
  const i = Math.floor((x - MAP.x0) / CELL), j = Math.floor((z - MAP.z0) / CELL);
  if (i < 0 || j < 0 || i >= W || j >= H) return S.COURT;
  return gclass[j * W + i];
}

/** True where a pedestrian may stand. */
export function walkable(x, z) {
  const c = classAt(x, z);
  return c !== S.BASE && c !== S.PIT && c !== S.BASIN && c !== S.ROAD && c !== S.ROAD2;
}

// --- AO lightmap -------------------------------------------------------------

function buildAoMap(footprints, extra) {
  const size = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, size, size);
  const sx = size / (MAP.x1 - MAP.x0), sz = size / (MAP.z1 - MAP.z0);
  const px = (x) => (x - MAP.x0) * sx, pz = (z) => (z - MAP.z0) * sz;
  try { c.filter = 'blur(7px)'; } catch (e) { /* ignore */ }
  c.fillStyle = 'rgba(0,0,0,0.55)';
  for (const f of footprints) {
    c.fillRect(px(f.x0) - 3, pz(f.z0) - 3, (f.x1 - f.x0) * sx + 6, (f.z1 - f.z0) * sz + 6);
  }
  c.fillStyle = 'rgba(0,0,0,0.4)';
  for (const e of extra) {
    c.beginPath();
    c.arc(px(e.x), pz(e.z), Math.max(2, e.r * sx), 0, Math.PI * 2);
    c.fill();
  }
  c.filter = 'none';
  const t = new THREE.CanvasTexture(cv);
  t.flipY = false;
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  return t;
}

// --- meshing -----------------------------------------------------------------

const SRGB = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const v = i / 255;
  SRGB[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

class Buf {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.u1 = []; this.i = []; this.v = 0; }
  vert(x, y, z, nx, ny, nz, r, g, b) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(r, g, b);
    this.u.push(x, z);
    this.u1.push((x - MAP.x0) / (MAP.x1 - MAP.x0), (z - MAP.z0) / (MAP.z1 - MAP.z0));
    return this.v++;
  }
  quad(a, b, cc, d) { this.i.push(a, b, cc, a, cc, d); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('uv1', new THREE.Float32BufferAttribute(this.u1, 2));
    g.setIndex(this.v > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    return g;
  }
}

function colOf(cls) {
  const m = CLASS_MAT[cls];
  return [SRGB[M.r[m]], SRGB[M.g[m]], SRGB[M.b[m]]];
}

/**
 * Build the ground.
 * footprints: [{x0,z0,x1,z1,base}] reserved building bases.
 * shadeBlobs: [{x,z,r}] extra AO discs (tree canopies, monument).
 */
export function buildGround(footprints, shadeBlobs, matLib) {
  paint(footprints);

  const hard = new Buf(), soft = new Buf();
  const used = new Uint8Array(W * H);

  // --- top surface, greedy merged on (class, height) ---
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W;) {
      const k = j * W + i;
      if (used[k]) { i++; continue; }
      const cls = gclass[k], h = gheight[k];
      let w = 1;
      while (i + w < W && !used[k + w] && gclass[k + w] === cls && gheight[k + w] === h) w++;
      let hh = 1;
      outer: while (j + hh < H) {
        const kk = (j + hh) * W + i;
        for (let q = 0; q < w; q++) {
          if (used[kk + q] || gclass[kk + q] !== cls || gheight[kk + q] !== h) break outer;
        }
        hh++;
      }
      for (let b = 0; b < hh; b++) for (let q = 0; q < w; q++) used[(j + b) * W + i + q] = 1;

      const buf = SOFT.has(cls) ? soft : hard;
      const [r, g, bl] = colOf(cls);
      const x0 = MAP.x0 + i * CELL, x1 = x0 + w * CELL;
      const z0 = MAP.z0 + j * CELL, z1 = z0 + hh * CELL;
      const a = buf.vert(x0, h, z0, 0, 1, 0, r, g, bl);
      const b2 = buf.vert(x1, h, z0, 0, 1, 0, r, g, bl);
      const c2 = buf.vert(x1, h, z1, 0, 1, 0, r, g, bl);
      const d2 = buf.vert(x0, h, z1, 0, 1, 0, r, g, bl);
      buf.quad(a, d2, c2, b2);
      i += w;
    }
  }

  // --- vertical risers wherever a neighbour sits lower ---
  const riser = (buf, x0, z0, x1, z1, hTop, hBot, nx, nz, col) => {
    const [r, g, bl] = col;
    const a = buf.vert(x0, hTop, z0, nx, 0, nz, r, g, bl);
    const b = buf.vert(x1, hTop, z1, nx, 0, nz, r, g, bl);
    const c = buf.vert(x1, hBot, z1, nx, 0, nz, r, g, bl);
    const d = buf.vert(x0, hBot, z0, nx, 0, nz, r, g, bl);
    buf.quad(a, b, c, d);
  };

  // +X / -X facing risers, merged along z
  for (let i = 0; i < W; i++) {
    for (const dir of [1, -1]) {
      let j = 0;
      while (j < H) {
        const k = j * W + i;
        const ni = i + dir;
        const hn = (ni < 0 || ni >= W) ? gheight[k] - 6 : gheight[j * W + ni];
        const h = gheight[k];
        if (h - hn < 0.02) { j++; continue; }
        const cls = gclass[k];
        let run = 1;
        while (j + run < H) {
          const kk = (j + run) * W + i;
          const nn = (ni < 0 || ni >= W) ? gheight[kk] - 6 : gheight[(j + run) * W + ni];
          if (gclass[kk] !== cls || gheight[kk] !== h || nn !== hn) break;
          run++;
        }
        const x = MAP.x0 + (i + (dir > 0 ? 1 : 0)) * CELL;
        const z0 = MAP.z0 + j * CELL, z1 = z0 + run * CELL;
        const buf = SOFT.has(cls) ? soft : hard;
        const col = colOf(cls);
        if (dir > 0) riser(buf, x, z0, x, z1, h, hn, 1, 0, col);
        else riser(buf, x, z1, x, z0, h, hn, -1, 0, col);
        j += run;
      }
    }
  }
  // +Z / -Z facing risers, merged along x
  for (let j = 0; j < H; j++) {
    for (const dir of [1, -1]) {
      let i = 0;
      while (i < W) {
        const k = j * W + i;
        const nj = j + dir;
        const hn = (nj < 0 || nj >= H) ? gheight[k] - 6 : gheight[nj * W + i];
        const h = gheight[k];
        if (h - hn < 0.02) { i++; continue; }
        const cls = gclass[k];
        let run = 1;
        while (i + run < W) {
          const kk = j * W + i + run;
          const nn = (nj < 0 || nj >= H) ? gheight[kk] - 6 : gheight[nj * W + i + run];
          if (gclass[kk] !== cls || gheight[kk] !== h || nn !== hn) break;
          run++;
        }
        const z = MAP.z0 + (j + (dir > 0 ? 1 : 0)) * CELL;
        const x0 = MAP.x0 + i * CELL, x1 = x0 + run * CELL;
        const buf = SOFT.has(cls) ? soft : hard;
        const col = colOf(cls);
        if (dir > 0) riser(buf, x1, z, x0, z, h, hn, 0, 1, col);
        else riser(buf, x0, z, x1, z, h, hn, 0, -1, col);
        i += run;
      }
    }
  }

  const aoMap = buildAoMap(footprints, shadeBlobs);

  const makeMat = (base) => {
    const m = base.clone();
    m.aoMap = aoMap;
    m.aoMapIntensity = 1.0;
    m.vertexColors = true;
    return m;
  };
  const hardMat = makeMat(matLib.get('pavement'));
  const softMat = makeMat(matLib.get('vegetation'));

  const group = new THREE.Group();
  group.name = 'ground';
  const mkMesh = (buf, mat, name) => {
    if (buf.v === 0) return null;
    const mesh = new THREE.Mesh(buf.geometry(), mat);
    mesh.name = name;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    return mesh;
  };
  mkMesh(hard, hardMat, 'ground-hard');
  mkMesh(soft, softMat, 'ground-soft');

  // --- skirt: close the map edge so no void is ever visible ---
  const skirt = new Buf();
  const deep = -13;
  const col = colOf(S.SOIL);
  const edgeQuad = (x0, z0, x1, z1, h0, h1, nx, nz) => {
    const [r, g, b] = col;
    const a = skirt.vert(x0, h0, z0, nx, 0, nz, r, g, b);
    const bb = skirt.vert(x1, h1, z1, nx, 0, nz, r, g, b);
    const c = skirt.vert(x1, deep, z1, nx, 0, nz, r, g, b);
    const d = skirt.vert(x0, deep, z0, nx, 0, nz, r, g, b);
    skirt.quad(a, bb, c, d);
  };
  const step = 8;
  for (let i = 0; i < W; i += step) {
    const x0 = MAP.x0 + i * CELL, x1 = Math.min(MAP.x1, x0 + step * CELL);
    edgeQuad(x1, MAP.z0, x0, MAP.z0, gheight[i] , gheight[Math.min(W - 1, i + step)], 0, -1);
    const jb = (H - 1) * W;
    edgeQuad(x0, MAP.z1, x1, MAP.z1, gheight[jb + i], gheight[jb + Math.min(W - 1, i + step)], 0, 1);
  }
  for (let j = 0; j < H; j += step) {
    const z0 = MAP.z0 + j * CELL, z1 = Math.min(MAP.z1, z0 + step * CELL);
    edgeQuad(MAP.x0, z0, MAP.x0, z1, gheight[j * W], gheight[Math.min(H - 1, j + step) * W], -1, 0);
    edgeQuad(MAP.x1, z1, MAP.x1, z0, gheight[Math.min(H - 1, j + step) * W + W - 1], gheight[j * W + W - 1], 1, 0);
  }
  mkMesh(skirt, softMat, 'ground-skirt');

  return {
    group,
    aoMap,
    dispose() {
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      hardMat.dispose(); softMat.dispose(); aoMap.dispose();
    },
  };
}

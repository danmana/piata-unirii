// Shared procedural material atlas painted with Canvas 2D. Each tile is a
// detail/modulation texture (mean ~0.5) multiplied by the voxel colour in the
// shader. The atlas canvas is uploaded as a texture array (one layer per tile)
// so tiles can repeat without bleeding.

import * as THREE from 'three';
import { LAYER_NAMES } from '../core/mat.js';
import { RNG, noise2, fbm2 } from '../core/rng.js';

export const TILE = 256;

// per-layer params: [repeatSize, mode(0=metres,1=voxels), voxelJitter, edgeStrength]
export const LAYER_PARAMS = {
  plaster: [2.4, 0, 0.035, 0.32],
  stone: [2.0, 0, 0.04, 0.3],
  limestone: [3.0, 0, 0.045, 0.34],
  roof: [4, 1, 0.07, 0.5],
  metalroof: [1.5, 0, 0.03, 0.25],
  plaza: [7.2, 0, 0.0, 0.0],
  road: [1.5, 0, 0.0, 0.0],
  curb: [2.0, 0, 0.02, 0.12],
  grass: [2.5, 0, 0.07, 0.12],
  bark: [3, 1, 0.08, 0.3],
  leaf: [3, 1, 0.1, 0.38],
  bronze: [1.2, 0, 0.06, 0.25],
  glass: [1, 1, 0.12, 0.45],
  water: [3.0, 0, 0.0, 0.0],
  wood: [1.0, 0, 0.03, 0.2],
  fabric: [0.6, 0, 0.02, 0.1],
  asphalt: [2.5, 0, 0.0, 0.0],
  brick: [1.0, 0, 0.04, 0.2],
  path: [2.0, 0, 0.0, 0.0],
  sidewalk: [1.8, 0, 0.0, 0.0],
  paint: [1.0, 0, 0.0, 0.18],
  marble: [2.5, 0, 0.02, 0.22],
  forest: [2, 1, 0.22, 0.3],
  soil: [2.0, 0, 0.05, 0.2],
  zebraX: [1.0, 0, 0.0, 0.0],
  zebraZ: [1.0, 0, 0.0, 0.0],
  basin: [2.0, 0, 0.02, 0.0],
  rustic: [2.0, 0, 0.04, 0.3],
  plain: [1.0, 0, 0.02, 0.2],
  yard: [3.0, 0, 0.03, 0.05],
  tileRoof: [4, 1, 0.07, 0.5],
  gravel: [2.0, 0, 0.0, 0.0],
};

function tileCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = TILE;
  return c;
}

// helpers operating on ImageData (value 0..255 grey or rgb)
function makeImg() { return new ImageData(TILE, TILE); }
function put(img, x, y, r, g, b) {
  const i = ((y & (TILE - 1)) * TILE + (x & (TILE - 1))) * 4;
  img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
}
function each(img, f) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const v = f(x, y);
    if (typeof v === 'number') put(img, x, y, v, v, v);
    else put(img, x, y, v[0], v[1], v[2]);
  }
}
const cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
// tileable noise: sample on a torus
function tn(x, y, f, seed) {
  const a = (x / TILE) * Math.PI * 2, b = (y / TILE) * Math.PI * 2;
  const R = f / (Math.PI * 2);
  return noise2(Math.cos(a) * R + Math.cos(b) * R * 0.31, Math.sin(a) * R + Math.sin(b) * R * 0.93, seed) * 0.5 +
    noise2(Math.cos(b) * R + 7.1, Math.sin(b) * R + Math.cos(a) * R * 0.4, seed + 3) * 0.5;
}
function tfbm(x, y, f, seed, oct = 3) {
  let s = 0, a = 0.5, n = 0;
  for (let o = 0; o < oct; o++) { s += tn(x, y, f * (1 << o), seed + o * 17) * a; n += a; a *= 0.5; }
  return s / n;
}

const PAINT = {
  plaster(img, r) {
    each(img, (x, y) => cl(128 + (tfbm(x, y, 3, 1) - 0.5) * 22 + (r.next() - 0.5) * 10));
  },
  stone(img, r) { ashlar(img, r, 4, 8, 20, 3, 0.1); },
  limestone(img, r) { ashlar(img, r, 4, 8, 24, 2, 0.16, true); },
  rustic(img, r) { ashlar(img, r, 2, 4, 16, 6, 0.08); },
  roof(img, r) {
    // 4x4 voxels, each a clay tile: lighter crown, darker lower edge, per-tile variation
    const n = 4, s = TILE / n;
    const shades = [];
    for (let i = 0; i < n * n; i++) shades.push(r.range(-14, 14));
    each(img, (x, y) => {
      const cx = Math.floor(x / s), cy = Math.floor(y / s);
      const fx = (x % s) / s, fy = (y % s) / s;
      let v = 128 + shades[cy * n + cx] + (0.5 - fy) * 18 - Math.pow(Math.abs(fx - 0.5) * 2, 3) * 14;
      if (fy > 0.9) v -= 26;
      v += (r.next() - 0.5) * 10;
      return cl(v);
    });
  },
  tileRoof(img, r) { PAINT.roof(img, r); },
  metalroof(img, r) {
    each(img, (x, y) => {
      const f = (x % 85) / 85;
      let v = 128 + (tfbm(x, y, 2, 4) - 0.5) * 10;
      if (f < 0.03) v += 22; else if (f < 0.06) v -= 20;
      return cl(v + (r.next() - 0.5) * 4);
    });
  },
  plaza(img, r) {
    // running-bond slabs (1.2 x 0.6 m at 7.2 m repeat -> 6 x 12), pale grey & beige
    const cols = 6, rows = 12, sw = TILE / cols, sh = TILE / rows;
    const slab = [];
    for (let i = 0; i < cols * rows * 2; i++) {
      const beige = r.next() < 0.45;
      const k = r.range(-8, 8);
      slab.push(beige ? [140 + k, 132 + k, 118 + k] : [131 + k, 130 + k, 127 + k]);
    }
    each(img, (x, y) => {
      const row = Math.floor(y / sh);
      const xo = x + (row % 2) * sw * 0.5;
      const col = Math.floor(xo / sw) % cols;
      const c = slab[row * cols + col];
      const fx = (xo % sw), fy = y % sh;
      const g = (r.next() - 0.5) * 7 + (tfbm(x, y, 8, 11) - 0.5) * 8;
      if (fx < 1 || fy < 1) return [c[0] - 22, c[1] - 22, c[2] - 22];
      return [cl(c[0] + g), cl(c[1] + g), cl(c[2] + g)];
    });
  },
  road(img, r) { setts(img, r, 12, 26); },
  gravel(img, r) { each(img, (x, y) => cl(128 + (r.next() - 0.5) * 50 + (tfbm(x, y, 12, 5) - 0.5) * 20)); },
  curb(img, r) {
    each(img, (x, y) => {
      let v = 130 + (tfbm(x, y, 6, 9) - 0.5) * 14 + (r.next() - 0.5) * 10;
      if (x % 128 < 2) v -= 30;
      return cl(v);
    });
  },
  grass(img, r) {
    each(img, (x, y) => {
      const n = tfbm(x, y, 5, 12);
      const blade = r.next();
      const v = 124 + (n - 0.5) * 40 + (blade - 0.5) * 30;
      return [cl(v + (n - 0.5) * 16), cl(v), cl(v - 8 - (n - 0.5) * 10)];
    });
  },
  bark(img, r) { each(img, (x, y) => cl(124 + (tn(x * 4, y * 0.5, 6, 2) - 0.5) * 50 + (r.next() - 0.5) * 16)); },
  leaf(img, r) {
    each(img, (x, y) => {
      const n = tfbm(x, y, 6, 21, 2);
      const v = 128 + (n - 0.5) * 60 + (r.next() - 0.5) * 22;
      return [cl(v - 4), cl(v + 3), cl(v - 6)];
    });
  },
  forest(img, r) {
    each(img, (x, y) => {
      const n = tfbm(x, y, 4, 23, 3);
      const v = 128 + (n - 0.5) * 90 + (r.next() - 0.5) * 20;
      return [cl(v - 6), cl(v + 4), cl(v - 8)];
    });
  },
  bronze(img, r) {
    each(img, (x, y) => {
      const s = tn(x * 2.5, y * 0.35, 5, 31);
      const v = 128 + (tfbm(x, y, 6, 7) - 0.5) * 34 + (s - 0.5) * 28;
      return [cl(v + 3), cl(v), cl(v - 3)];
    });
  },
  glass(img, r) {
    each(img, (x, y) => {
      const fy = y / TILE;
      let v = 112 + (1 - fy) * 40;
      if (x < 12 || y < 12) v -= 34;
      return cl(v + (r.next() - 0.5) * 6);
    });
  },
  water(img, r) {
    each(img, (x, y) => cl(128 + (tfbm(x, y, 6, 41) - 0.5) * 40));
  },
  wood(img, r) {
    each(img, (x, y) => {
      const plank = Math.floor(y / 32);
      let v = 128 + (tn(x * 0.4, y * 6 + plank * 40, 8, 3) - 0.5) * 36 + (plank % 3) * 6;
      if (y % 32 < 2) v -= 40;
      return cl(v);
    });
  },
  fabric(img, r) { each(img, (x, y) => cl(128 + ((x + y) % 4 < 2 ? 5 : -5) + (r.next() - 0.5) * 6)); },
  asphalt(img, r) {
    each(img, (x, y) => {
      let v = 128 + (tfbm(x, y, 8, 55) - 0.5) * 24 + (r.next() - 0.5) * 24;
      if (r.next() < 0.015) v += 45;
      return cl(v);
    });
  },
  brick(img, r) {
    const bw = TILE / 4, bh = TILE / 16;
    each(img, (x, y) => {
      const row = Math.floor(y / bh);
      const xo = x + (row % 2) * bw * 0.5;
      if (xo % bw < 3 || y % bh < 3) return 172;
      const k = ((Math.floor(xo / bw) * 7 + row * 13) % 9) * 3;
      return cl(118 + k + (r.next() - 0.5) * 14);
    });
  },
  path(img, r) { each(img, (x, y) => cl(128 + (r.next() - 0.5) * 30 + (tfbm(x, y, 10, 61) - 0.5) * 24)); },
  sidewalk(img, r) {
    // small rectangular pavers (0.3 x 0.2 m at 1.8 m repeat)
    const cols = 6, rows = 9, sw = TILE / cols, sh = TILE / rows;
    const k = [];
    for (let i = 0; i < 120; i++) k.push(r.range(-12, 12));
    each(img, (x, y) => {
      const row = Math.floor(y / sh);
      const xo = x + (row % 2) * sw * 0.5;
      const col = Math.floor(xo / sw) % cols;
      if (xo % sw < 2 || y % sh < 2) return 96;
      return cl(128 + k[(row * cols + col) % 120] + (r.next() - 0.5) * 8);
    });
  },
  paint(img, r) { each(img, () => cl(128 + (r.next() - 0.5) * 2)); },
  plain(img, r) { each(img, () => cl(128 + (r.next() - 0.5) * 4)); },
  marble(img, r) {
    each(img, (x, y) => {
      const n = tfbm(x, y, 3, 71, 4);
      const vein = Math.abs(Math.sin((x + n * 180) * 0.05)) < 0.04 ? -18 : 0;
      return cl(130 + (n - 0.5) * 12 + vein + (r.next() - 0.5) * 5);
    });
  },
  soil(img, r) { each(img, (x, y) => cl(128 + (tfbm(x, y, 8, 81) - 0.5) * 40 + (r.next() - 0.5) * 16)); },
  zebraX(img, r) { each(img, (x, y) => (y < TILE / 2 ? cl(150 + (r.next() - 0.5) * 8) : cl(46 + (r.next() - 0.5) * 8))); },
  zebraZ(img, r) { each(img, (x, y) => (x < TILE / 2 ? cl(150 + (r.next() - 0.5) * 8) : cl(46 + (r.next() - 0.5) * 8))); },
  basin(img, r) { each(img, (x, y) => cl(128 + (tfbm(x, y, 5, 91) - 0.5) * 16 + (r.next() - 0.5) * 8)); },
  yard(img, r) {
    each(img, (x, y) => {
      const n = tfbm(x, y, 4, 93);
      return cl(128 + (n - 0.5) * 30 + (r.next() - 0.5) * 12);
    });
  },
};

function ashlar(img, r, cols, rows, jit, joint, weather, streaks = false) {
  const bw = TILE / cols, bh = TILE / rows;
  const k = [];
  for (let i = 0; i < cols * rows * 2; i++) k.push(r.range(-jit, jit));
  each(img, (x, y) => {
    const row = Math.floor(y / bh);
    const xo = x + (row % 2) * bw * 0.5;
    const col = Math.floor(xo / bw) % cols;
    let v = 132 + k[row * cols + col] * 0.6 + (tfbm(x, y, 6, 13) - 0.5) * 22 * (1 + weather);
    if (streaks) v -= Math.max(0, tn(x * 3, y * 0.25, 6, 9) - 0.6) * 60;
    if (xo % bw < joint || y % bh < joint) v -= 26;
    v += (r.next() - 0.5) * 12;
    return cl(v);
  });
}

function setts(img, r, n, jit) {
  const s = TILE / n;
  const k = [];
  for (let i = 0; i < n * n; i++) k.push(r.range(-jit, jit));
  each(img, (x, y) => {
    const row = Math.floor(y / s);
    const xo = x + (row % 2) * s * 0.5;
    const col = Math.floor(xo / s) % n;
    const fx = xo % s, fy = y % s;
    const edge = Math.min(fx, s - fx, fy, s - fy);
    let v = 126 + k[row * n + col] + (r.next() - 0.5) * 12;
    if (edge < 2) v -= 40; else if (edge < 4) v -= 12;
    return cl(v);
  });
}

export function createAtlas() {
  const n = LAYER_NAMES.length;
  // paint all tiles into one atlas canvas (8 columns)
  const cols = 8, rows = Math.ceil(n / cols);
  const atlas = document.createElement('canvas');
  atlas.width = cols * TILE; atlas.height = rows * TILE;
  const actx = atlas.getContext('2d', { willReadFrequently: true });
  const data = new Uint8Array(TILE * TILE * 4 * n);
  const rng = new RNG(20240917);
  LAYER_NAMES.forEach((name, i) => {
    const img = makeImg();
    (PAINT[name] || PAINT.plain)(img, rng.fork(name));
    const x = (i % cols) * TILE, y = Math.floor(i / cols) * TILE;
    actx.putImageData(img, x, y);
    const back = actx.getImageData(x, y, TILE, TILE);
    data.set(back.data, i * TILE * TILE * 4);
  });
  const tex = new THREE.DataArrayTexture(data, TILE, TILE, n);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  const params = LAYER_NAMES.map((nm) => {
    const p = LAYER_PARAMS[nm] || [1, 0, 0.02, 0.2];
    return new THREE.Vector4(p[0], p[1], p[2], p[3]);
  });
  return { texture: tex, params, canvas: atlas };
}

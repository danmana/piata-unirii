// Procedurally generated material atlas.
//
// One 1024x1024 canvas is painted at start-up with a 4x4 grid of 256px tileable
// tiles - one per render group. Each tile is then copied into its own canvas so it
// can wrap independently (world-space UVs mean the repeat factor differs per group).
// Nothing is loaded from disk or the network.

import * as THREE from 'three';
import { mulberry32 } from './rng.js';

const TILE = 256;
const COLS = 4;

// Tileable value noise: the lattice wraps at `freq`, so the field is seamless.
function periodicNoise(size, freq, seed) {
  const rnd = mulberry32(seed);
  const lat = new Float32Array(freq * freq);
  for (let i = 0; i < lat.length; i++) lat[i] = rnd();
  const out = new Float32Array(size * size);
  const sm = (t) => t * t * (3 - 2 * t);
  const scale = freq / size;
  for (let y = 0; y < size; y++) {
    const fy = y * scale, y0 = Math.floor(fy), ty = sm(fy - y0);
    const ya = (y0 % freq + freq) % freq, yb = (y0 + 1) % freq;
    for (let x = 0; x < size; x++) {
      const fx = x * scale, x0 = Math.floor(fx), tx = sm(fx - x0);
      const xa = (x0 % freq + freq) % freq, xb = (x0 + 1) % freq;
      const a = lat[ya * freq + xa], b = lat[ya * freq + xb];
      const c = lat[yb * freq + xa], d = lat[yb * freq + xb];
      out[y * size + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
  }
  return out;
}

function fbm(size, baseFreq, octaves, seed, gain = 0.5) {
  const out = new Float32Array(size * size);
  let amp = 1, norm = 0, f = baseFreq;
  for (let o = 0; o < octaves; o++) {
    const n = periodicNoise(size, f, seed + o * 7919);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    norm += amp; amp *= gain; f *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

// Paint one tile into the atlas context at (col,row).
function paintTile(ctx, col, row, painter) {
  const off = document.createElement('canvas');
  off.width = TILE; off.height = TILE;
  const c = off.getContext('2d');
  painter(c, TILE);
  ctx.drawImage(off, col * TILE, row * TILE);
  return off;
}

function grayField(ctx, size, field, lo, hi, tint) {
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < size * size; i++) {
    const v = lo + (hi - lo) * field[i];
    d[i * 4] = Math.max(0, Math.min(255, v * (tint ? tint[0] : 1)));
    d[i * 4 + 1] = Math.max(0, Math.min(255, v * (tint ? tint[1] : 1)));
    d[i * 4 + 2] = Math.max(0, Math.min(255, v * (tint ? tint[2] : 1)));
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// --- individual tile painters ------------------------------------------------

const painters = {
  // Limestone: fine mottle plus faint horizontal ashlar courses.
  stone(c, s) {
    const f = fbm(s, 8, 4, 101);
    const g = fbm(s, 32, 2, 202);
    const field = new Float32Array(s * s);
    for (let i = 0; i < field.length; i++) field[i] = f[i] * 0.65 + g[i] * 0.35;
    grayField(c, s, field, 214, 255);
    c.globalAlpha = 0.14;
    c.strokeStyle = '#7a7466';
    c.lineWidth = 1;
    for (let y = 32; y < s; y += 32) {
      c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(s, y + 0.5); c.stroke();
    }
    c.globalAlpha = 1;
  },
  // Rendered plaster: very fine, low-contrast grain.
  plaster(c, s) {
    const f = fbm(s, 24, 4, 303);
    grayField(c, s, f, 228, 255);
  },
  // Clay roof tiles: mottled with soft courses.
  terracotta(c, s) {
    const f = fbm(s, 10, 4, 404);
    const field = new Float32Array(s * s);
    for (let i = 0; i < field.length; i++) field[i] = f[i];
    grayField(c, s, field, 198, 255, [1.0, 0.985, 0.97]);
    c.globalAlpha = 0.16;
    c.strokeStyle = '#6b3320';
    for (let y = 0; y < s; y += 16) {
      c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(s, y + 0.5); c.stroke();
    }
    c.globalAlpha = 0.07;
    for (let x = 0; x < s; x += 16) {
      c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, s); c.stroke();
    }
    c.globalAlpha = 1;
  },
  // Aged bronze: broad patina blotches.
  bronze(c, s) {
    const f = fbm(s, 6, 4, 505);
    grayField(c, s, f, 190, 255, [1.0, 1.03, 0.96]);
  },
  vegetation(c, s) {
    const f = fbm(s, 26, 3, 606);
    grayField(c, s, f, 190, 255, [0.98, 1.0, 0.95]);
  },
  // Plaza paving: 4x4 slabs per tile with thin recessed joints.
  pavement(c, s) {
    const f = fbm(s, 16, 4, 707);
    const g = periodicNoise(s, 4, 808);
    const field = new Float32Array(s * s);
    for (let i = 0; i < field.length; i++) field[i] = f[i] * 0.5 + g[i] * 0.5;
    grayField(c, s, field, 216, 252);
    const n = 4, step = s / n;
    c.globalAlpha = 0.30;
    c.strokeStyle = '#5f5b52';
    c.lineWidth = 1.6;
    for (let i = 0; i < n; i++) {
      const p = i * step + 0.5;
      c.beginPath(); c.moveTo(p, 0); c.lineTo(p, s); c.stroke();
      c.beginPath(); c.moveTo(0, p); c.lineTo(s, p); c.stroke();
    }
    c.globalAlpha = 1;
  },
  glass(c, s) {
    const f = fbm(s, 5, 2, 909);
    grayField(c, s, f, 200, 255);
  },
  glasslit(c, s) {
    const f = fbm(s, 5, 2, 911);
    grayField(c, s, f, 220, 255);
  },
  water(c, s) {
    const f = fbm(s, 12, 4, 1010);
    grayField(c, s, f, 210, 255, [0.98, 1.0, 1.02]);
  },
  metal(c, s) {
    const f = fbm(s, 40, 2, 1111);
    grayField(c, s, f, 214, 250);
  },
  wood(c, s) {
    const base = fbm(s, 6, 3, 1212);
    const field = new Float32Array(s * s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const rings = 0.5 + 0.5 * Math.sin((y * 0.55 + base[i] * 14) * 1.4);
      field[i] = base[i] * 0.45 + rings * 0.55;
    }
    grayField(c, s, field, 206, 252);
  },
  lamp(c, s) {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, s, s);
  },
};

const GROUP_TILE = [
  'stone', 'plaster', 'terracotta', 'bronze',
  'vegetation', 'pavement', 'glass', 'glasslit',
  'water', 'metal', 'wood', 'lamp',
];

let cache = null;

export function buildAtlas() {
  if (cache) return cache;
  const atlas = document.createElement('canvas');
  atlas.width = COLS * TILE;
  atlas.height = Math.ceil(GROUP_TILE.length / COLS) * TILE;
  const actx = atlas.getContext('2d');
  const textures = {};
  GROUP_TILE.forEach((name, i) => {
    const col = i % COLS, row = (i / COLS) | 0;
    const tileCanvas = paintTile(actx, col, row, painters[name]);
    const t = new THREE.CanvasTexture(tileCanvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = 4;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    textures[name] = t;
  });
  cache = { atlas, textures };
  return cache;
}

// --- one-off canvases used by sky, clouds and lamp glows ---------------------

export function makeSkyTexture(stops) {
  const cv = document.createElement('canvas');
  cv.width = 8; cv.height = 512;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 512);
  for (const [pos, col] of stops) g.addColorStop(pos, col);
  c.fillStyle = g;
  c.fillRect(0, 0, 8, 512);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function makeRadialSprite(inner, outer, size = 128, power = 2) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  const img = c.createImageData(size, size);
  const d = img.data;
  const r = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5 - r) / r, dy = (y + 0.5 - r) / r;
    const dist = Math.min(1, Math.sqrt(dx * dx + dy * dy));
    const a = Math.pow(1 - dist, power);
    const i = (y * size + x) * 4;
    d[i] = inner[0] + (outer[0] - inner[0]) * dist;
    d[i + 1] = inner[1] + (outer[1] - inner[1]) * dist;
    d[i + 2] = inner[2] + (outer[2] - inner[2]) * dist;
    d[i + 3] = Math.max(0, Math.min(255, a * 255));
  }
  c.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

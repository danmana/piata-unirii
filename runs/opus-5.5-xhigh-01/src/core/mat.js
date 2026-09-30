// Material pools, atlas layers, shader flags and the per-job voxel material table.
// Everything here is plain data so it can be shared by the main thread and workers.

// Rendering pools: every voxel surface / instance ends up in exactly one pool.
export const POOL = {
  stone: 0, plaster: 1, terracotta: 2, metal: 3, bronze: 4, vegetation: 5,
  pavement: 6, glass: 7, water: 8, fabric: 9, light: 10, paint: 11,
};
export const POOL_NAMES = Object.keys(POOL);
export const POOL_COUNT = POOL_NAMES.length;

// Layers of the procedural material atlas (a canvas-painted texture array).
export const LAYER_NAMES = [
  'plaster', 'stone', 'limestone', 'roof', 'metalroof', 'plaza', 'road', 'curb',
  'grass', 'bark', 'leaf', 'bronze', 'glass', 'water', 'wood', 'fabric',
  'asphalt', 'brick', 'path', 'sidewalk', 'paint', 'marble', 'forest', 'soil',
  'zebraX', 'zebraZ', 'basin', 'rustic', 'plain', 'yard', 'tileRoof', 'gravel',
];
export const LAYER = {};
LAYER_NAMES.forEach((n, i) => { LAYER[n] = i; });

// Shader flags (bit field stored per vertex / instance).
export const FLAG = {
  LIT: 1,      // window that lights up in the evening
  LAMP: 2,     // lamp head / emissive fixture
  FLOOD: 4,    // floodlit monument surface (church, statue)
  WARM: 8,     // warm under-glass illumination (archaeological window)
  WATER: 16,   // animated water sparkle
  STAINED: 32, // stained glass glowing in its own colour at dusk
};

export const AIR = 0;
export const HIDDEN = 1;

export function hexToRgb(hex) {
  if (typeof hex === 'number') return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + ((1 << 24) | (c(r) << 16) | (c(g) << 8) | c(b)).toString(16).slice(1);
}

// Brightness multiply in sRGB space (good enough for palette variation).
export function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * f, g * f, b * f);
}

export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

// Material table: voxel id -> pool / colour / atlas layer / flags.
export class MatTable {
  constructor() {
    this.pool = [0, 0];
    this.r = [0, 128];
    this.g = [0, 128];
    this.b = [0, 128];
    this.layer = [0, 0];
    this.flags = [0, 0];
    this.map = new Map();
  }
  get(pool, hex, layer, flags = 0) {
    const key = pool + '|' + hex + '|' + layer + '|' + flags;
    let id = this.map.get(key);
    if (id !== undefined) return id;
    id = this.pool.length;
    if (id > 65000) throw new Error('MatTable overflow');
    const [r, g, b] = hexToRgb(hex);
    this.pool.push(pool);
    this.r.push(r); this.g.push(g); this.b.push(b);
    this.layer.push(layer);
    this.flags.push(flags);
    this.map.set(key, id);
    return id;
  }
  // Convenience constructors
  stone(hex, layer = LAYER.stone, flags = 0) { return this.get(POOL.stone, hex, layer, flags); }
  plaster(hex, layer = LAYER.plaster, flags = 0) { return this.get(POOL.plaster, hex, layer, flags); }
  roof(hex, layer = LAYER.roof) { return this.get(POOL.terracotta, hex, layer, 0); }
  metal(hex, layer = LAYER.metalroof, flags = 0) { return this.get(POOL.metal, hex, layer, flags); }
  bronze(hex, flags = 0) { return this.get(POOL.bronze, hex, LAYER.bronze, flags); }
  veg(hex, layer = LAYER.leaf) { return this.get(POOL.vegetation, hex, layer, 0); }
  pave(hex, layer = LAYER.plaza) { return this.get(POOL.pavement, hex, layer, 0); }
  glass(hex, flags = 0) { return this.get(POOL.glass, hex, LAYER.glass, flags); }
  water(hex) { return this.get(POOL.water, hex, LAYER.water, FLAG.WATER); }
  fabric(hex, layer = LAYER.fabric) { return this.get(POOL.fabric, hex, layer, 0); }
  light(hex, flags = FLAG.LAMP) { return this.get(POOL.light, hex, LAYER.plain, flags); }
  paint(hex) { return this.get(POOL.paint, hex, LAYER.paint, 0); }
}

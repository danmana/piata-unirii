// Voxel templates for GPU instancing: trees (organic grouped-voxel branching),
// street furniture and vehicles. Meshed in local space; instanced on the GPU.

import { VoxelGrid } from '../core/voxel.js';
import { MatTable, POOL, LAYER, FLAG, AIR, shade } from '../core/mat.js';
import { RNG, noise3, hash01 } from '../core/rng.js';
import { VEG } from '../core/palette.js';

// ------------------------------------------------------------------ trees
const SPECIES = {
  linden: { H: [13, 16], trunkR: 0.36, trunkF: 0.34, crown: [4.2, 5.4, 4.2], limbs: [5, 7], clump: [1.5, 2.2], cols: VEG.linden, bark: VEG.bark, density: 0.52 },
  plane: { H: [16, 20], trunkR: 0.5, trunkF: 0.3, crown: [6.4, 5.2, 6.4], limbs: [5, 7], clump: [1.8, 2.6], cols: VEG.plane, bark: VEG.barkPlane, density: 0.5, mottled: true },
  ornamental: { H: [6, 8], trunkR: 0.19, trunkF: 0.38, crown: [2.6, 2.4, 2.6], limbs: [4, 5], clump: [1.1, 1.5], cols: VEG.ornamental, bark: VEG.bark, density: 0.56 },
};

export function buildTree(species, seed) {
  const sp = SPECIES[species];
  const rng = new RNG(seed);
  const vs = species === 'ornamental' ? 0.22 : 0.3;
  const H = rng.range(sp.H[0], sp.H[1]);
  const [cx, cy, cz] = sp.crown.map((v) => v * rng.range(0.9, 1.1));
  const R = Math.max(cx, cz) + 1.2;
  const g = new VoxelGrid(-R, 0, -R, R, H + 1.5, R, vs);
  g.boundary.ground = true;
  const mats = new MatTable();
  const bark = mats.veg(sp.bark, LAYER.bark);
  const bark2 = mats.veg(shade(sp.bark, sp.mottled ? 1.35 : 0.85), LAYER.bark);
  const leaves = sp.cols.map((c) => mats.veg(c, LAYER.leaf));
  const leafDark = mats.veg(shade(sp.cols[0], 0.8), LAYER.leaf);
  const trunkTop = H * sp.trunkF + rng.range(0, 1.2);
  const lean = [rng.range(-0.25, 0.25), rng.range(-0.25, 0.25)];
  const crownY = H - cy;
  // trunk with root flare
  g.line(0, 0, 0, lean[0], trunkTop, lean[1], sp.trunkR * 1.25, sp.trunkR * 0.85, bark);
  g.line(0, 0, 0, 0, 0.8, 0, sp.trunkR * 1.6, sp.trunkR * 1.0, bark);
  const tips = [];
  const nL = rng.int(sp.limbs[0], sp.limbs[1]);
  const a0 = rng.range(0, Math.PI * 2);
  for (let i = 0; i < nL; i++) {
    const ang = a0 + (i / nL) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const sy = trunkTop + rng.range(-0.5, 1.2);
    const bx = lean[0], bz = lean[1];
    const reach = rng.range(0.55, 0.95);
    const mx = bx + Math.cos(ang) * cx * reach * 0.5, mz = bz + Math.sin(ang) * cz * reach * 0.5;
    const my = sy + (crownY - sy) * rng.range(0.45, 0.7);
    const ex = bx + Math.cos(ang) * cx * reach, ez = bz + Math.sin(ang) * cz * reach;
    const ey = crownY + rng.range(-cy * 0.2, cy * 0.45);
    const r0 = sp.trunkR * 0.62;
    g.line(bx, sy, bz, mx, my, mz, r0, r0 * 0.72, bark);
    g.line(mx, my, mz, ex, ey, ez, r0 * 0.72, r0 * 0.4, bark);
    tips.push([ex, ey, ez, 1]);
    // sub-branches
    const nS = rng.int(1, 3);
    for (let k = 0; k < nS; k++) {
      const t = rng.range(0.3, 0.8);
      const px = mx + (ex - mx) * t, py = my + (ey - my) * t, pz = mz + (ez - mz) * t;
      const sa = ang + rng.range(-1.1, 1.1);
      const L = rng.range(1.2, 2.6);
      const qx = px + Math.cos(sa) * L, qz = pz + Math.sin(sa) * L, qy = py + rng.range(0.4, 1.8);
      g.line(px, py, pz, qx, qy, qz, r0 * 0.38, r0 * 0.22, bark);
      tips.push([qx, qy, qz, 0.8]);
    }
  }
  // central leader
  tips.push([lean[0] * 1.5, H - rng.range(0.6, 1.4), lean[1] * 1.5, 1.1]);
  g.line(lean[0], trunkTop, lean[1], lean[0] * 1.5, H - 1.5, lean[1] * 1.5, sp.trunkR * 0.5, sp.trunkR * 0.25, bark);
  // leaf clumps around tips (grouped voxels, lumpy, with gaps between clumps)
  const nseed = seed & 1023;
  for (const [tx, ty, tz, sc] of tips) {
    const r = rng.range(sp.clump[0], sp.clump[1]) * sc;
    g.fn(tx - r, ty - r * 0.8, tz - r, tx + r, ty + r * 0.9, tz + r, (x, y, z, c) => {
      if (c === bark) return -1;
      const dx = (x - tx) / r, dy = (y - ty) / (r * 0.82), dz = (z - tz) / r;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > 1.0) return -1;
      const n = noise3(x * 0.9 + nseed, y * 0.9, z * 0.9, nseed);
      if (d > 0.55 && n < 1 - sp.density - (1 - d) * 0.5) return -1;
      const hsh = hash01(Math.floor(x / vs), Math.floor(y / vs), Math.floor(z / vs), nseed);
      const top = (y - (ty - r)) / (2 * r);
      if (dy < -0.35 && hsh < 0.5) return leafDark;
      const k = Math.min(leaves.length - 1, Math.floor(hsh * leaves.length * 0.8 + top * leaves.length * 0.4));
      return leaves[k];
    });
  }
  // mottled bark (plane trees)
  if (sp.mottled) {
    g.fn(-R, 0, -R, R, trunkTop + 3, R, (x, y, z, c) => (c === bark && noise3(x * 3, y * 2, z * 3, 5) > 0.58 ? bark2 : -1));
  }
  return { grid: g, mats, height: H, radius: Math.max(cx, cz) };
}

// ------------------------------------------------------------------ props
export function buildProp(kind) {
  const mats = new MatTable();
  const wood = mats.get(POOL.paint, '#8a6a4a', LAYER.wood);
  const dark = mats.metal('#4a4f53', LAYER.plain);
  const steel = mats.metal('#5d6266', LAYER.plain);
  const stone = mats.stone('#c9c3b6', LAYER.stone);
  const lampLight = mats.light('#fff1d6', FLAG.LAMP);
  const fabric = mats.fabric('#f2efe8');   // tinted per instance
  const tint = mats.paint('#f4f4f4');      // tinted per instance
  const white = mats.fabric('#efe9dd');
  const veg = mats.veg('#5d7a3c', LAYER.leaf);
  const veg2 = mats.veg('#6f8c46', LAYER.leaf);
  const soil = mats.stone('#6b5846', LAYER.soil);
  const glass = mats.glass('#44505c');
  let g;
  switch (kind) {
    case 'bench': {
      g = new VoxelGrid(-1.0, 0, -0.4, 1.0, 1.0, 0.4, 0.08);
      g.box(-0.9, 0.4, -0.25, 0.9, 0.48, 0.25, wood);
      g.fn(-0.9, 0.4, -0.25, 0.9, 0.48, 0.25, (x, y, z) => (Math.floor((z + 1) / 0.08) % 3 === 0 ? AIR : -1));
      g.box(-0.9, 0.55, -0.3, 0.9, 0.9, -0.22, wood);
      g.fn(-0.9, 0.55, -0.3, 0.9, 0.9, -0.22, (x, y) => (Math.floor(y / 0.08) % 2 === 0 ? AIR : -1));
      for (const x of [-0.75, 0.75]) {
        g.box(x - 0.04, 0, -0.25, x + 0.04, 0.4, 0.25, dark);
        g.box(x - 0.04, 0.4, -0.3, x + 0.04, 0.92, -0.22, dark);
      }
      break;
    }
    case 'lamp': {
      g = new VoxelGrid(-0.4, 0, -0.4, 0.8, 6.0, 0.4, 0.1);
      g.box(-0.15, 0, -0.15, 0.15, 0.4, 0.15, dark);
      g.box(-0.06, 0, -0.06, 0.06, 5.6, 0.06, dark);
      g.box(-0.06, 5.5, -0.1, 0.65, 5.7, 0.1, dark);
      g.box(0.2, 5.4, -0.1, 0.65, 5.5, 0.1, lampLight);
      break;
    }
    case 'streetlamp': {
      g = new VoxelGrid(-0.3, 0, -0.3, 2.2, 8.5, 0.3, 0.12);
      g.box(-0.18, 0, -0.18, 0.18, 0.6, 0.18, dark);
      g.box(-0.08, 0, -0.08, 0.08, 8.0, 0.08, dark);
      g.box(-0.08, 7.8, -0.08, 1.9, 7.95, 0.08, dark);
      g.box(1.3, 7.62, -0.14, 2.0, 7.8, 0.14, dark);
      g.box(1.35, 7.55, -0.12, 1.95, 7.62, 0.12, lampLight);
      break;
    }
    case 'uplight': {
      g = new VoxelGrid(-0.12, 0, -0.12, 0.12, 0.12, 0.12, 0.06);
      g.box(-0.12, 0, -0.12, 0.12, 0.06, 0.12, steel);
      g.box(-0.06, 0.06, -0.06, 0.06, 0.12, 0.06, lampLight);
      break;
    }
    case 'bollard': {
      g = new VoxelGrid(-0.12, 0, -0.12, 0.12, 0.95, 0.12, 0.06);
      g.cylY(0, 0, 0.1, 0, 0.9, dark);
      g.cylY(0, 0, 0.12, 0.78, 0.84, steel);
      break;
    }
    case 'bin': {
      g = new VoxelGrid(-0.3, 0, -0.3, 0.3, 1.0, 0.3, 0.08);
      g.cylY(0, 0, 0.26, 0, 0.95, dark);
      g.cylY(0, 0, 0.18, 0.9, 0.96, AIR);
      break;
    }
    case 'bike': {
      g = new VoxelGrid(-0.95, 0, -0.35, 0.95, 1.15, 0.35, 0.06);
      const wheel = (cx) => g.fn(cx - 0.36, 0, -0.04, cx + 0.36, 0.72, 0.04, (x, y) => {
        const d = Math.hypot(x - cx, y - 0.35);
        return d < 0.35 && d > 0.27 ? dark : (d < 0.05 ? steel : -1);
      });
      wheel(-0.55); wheel(0.55);
      g.line(-0.55, 0.35, 0, -0.05, 0.4, 0, 0.03, 0.03, tint);
      g.line(-0.05, 0.4, 0, 0.45, 0.8, 0, 0.03, 0.03, tint);
      g.line(-0.55, 0.35, 0, -0.15, 0.8, 0, 0.03, 0.03, tint);
      g.line(-0.15, 0.8, 0, 0.45, 0.8, 0, 0.03, 0.03, tint);
      g.line(-0.05, 0.4, 0, -0.15, 0.85, 0, 0.03, 0.03, tint);
      g.line(0.45, 0.8, 0, 0.55, 0.35, 0, 0.03, 0.03, tint);
      g.box(-0.25, 0.86, -0.06, -0.05, 0.92, 0.06, dark);
      g.line(0.45, 0.8, 0, 0.42, 1.0, 0, 0.03, 0.03, dark);
      g.box(0.38, 0.98, -0.28, 0.46, 1.04, 0.28, dark);
      break;
    }
    case 'rack': {
      g = new VoxelGrid(-1.5, 0, -0.1, 1.5, 0.9, 0.1, 0.06);
      for (let x = -1.3; x <= 1.31; x += 0.65) {
        g.fn(x - 0.3, 0, -0.04, x + 0.3, 0.85, 0.04, (X, Y) => {
          const dx = X - x;
          if (Y < 0.55) return Math.abs(Math.abs(dx) - 0.26) < 0.04 ? steel : -1;
          return Math.abs(Math.hypot(dx, Y - 0.55) - 0.26) < 0.04 ? steel : -1;
        });
      }
      break;
    }
    case 'cafe': {
      // round table with two chairs
      g = new VoxelGrid(-0.9, 0, -0.9, 0.9, 1.0, 0.9, 0.06);
      g.cylY(0, 0, 0.36, 0.7, 0.75, white);
      g.cylY(0, 0, 0.04, 0, 0.7, dark);
      g.cylY(0, 0, 0.2, 0, 0.04, dark);
      for (const s of [-1, 1]) {
        const cz = s * 0.62;
        g.box(-0.2, 0.42, cz - 0.2, 0.2, 0.47, cz + 0.2, tint);
        g.box(-0.2, 0.47, cz + s * 0.16, 0.2, 0.9, cz + s * 0.2, tint);
        for (const lx of [-0.17, 0.17]) for (const lz of [-0.17, 0.17]) g.box(lx - 0.025, 0, cz + lz - 0.025, lx + 0.025, 0.42, cz + lz + 0.025, dark);
      }
      break;
    }
    case 'umbrella': {
      g = new VoxelGrid(-1.6, 0, -1.6, 1.6, 2.9, 1.6, 0.1);
      g.cylY(0, 0, 0.05, 0, 2.6, white);
      g.box(-0.25, 0, -0.25, 0.25, 0.1, 0.25, dark);
      g.fn(-1.5, 2.2, -1.5, 1.5, 2.75, 1.5, (x, y, z) => {
        const r = Math.max(Math.abs(x), Math.abs(z));
        const top = 2.72 - r * 0.28;
        if (y > top || y < top - 0.1) {
          if (r > 1.42 && y < top && y > top - 0.3) return fabric; // valance
          return -1;
        }
        return fabric;
      });
      break;
    }
    case 'planter': {
      g = new VoxelGrid(-0.7, 0, -0.7, 0.7, 1.6, 0.7, 0.1);
      g.box(-0.6, 0, -0.6, 0.6, 0.6, 0.6, stone);
      g.box(-0.5, 0.5, -0.5, 0.5, 0.6, 0.5, soil);
      g.fn(-0.6, 0.55, -0.6, 0.6, 1.55, 0.6, (x, y, z) => {
        const d = Math.hypot(x, (y - 0.9) * 1.1, z);
        if (d > 0.62) return -1;
        return noise3(x * 6, y * 6, z * 6, 3) > 0.45 ? veg : (d < 0.45 ? veg2 : -1);
      });
      break;
    }
    case 'board': {
      g = new VoxelGrid(-0.7, 0, -0.15, 0.7, 2.2, 0.15, 0.06);
      for (const x of [-0.55, 0.55]) g.box(x - 0.04, 0, -0.04, x + 0.04, 2.1, 0.04, dark);
      g.box(-0.55, 1.0, -0.05, 0.55, 2.0, 0.05, dark);
      g.box(-0.5, 1.05, -0.07, 0.5, 1.95, -0.05, glass);
      break;
    }
    case 'sign': {
      g = new VoxelGrid(-0.4, 0, -0.1, 0.4, 3.0, 0.1, 0.06);
      g.box(-0.04, 0, -0.04, 0.04, 2.9, 0.04, steel);
      g.box(-0.35, 2.4, -0.03, 0.35, 2.7, 0.03, mats.paint('#2f4d7a'));
      g.box(-0.3, 2.45, -0.04, 0.3, 2.65, -0.03, mats.paint('#e8e8e8'));
      break;
    }
    default: throw new Error('unknown prop ' + kind);
  }
  return { grid: g, mats };
}

// ------------------------------------------------------------------ vehicles
export function buildVehicle(kind) {
  const mats = new MatTable();
  const body = mats.paint('#f2f2f2');               // tinted per instance
  const glass = mats.glass('#26303a');
  const tire = mats.metal('#1c1c1d', LAYER.plain);
  const trim = mats.metal('#2b2d2f', LAYER.plain);
  const rim = mats.metal('#9aa0a4', LAYER.plain);
  const head = mats.light('#f4f1e6', FLAG.LAMP);
  const tail = mats.get(POOL.light, '#8c1f1a', LAYER.plain, 0);
  const sign = mats.light('#ffd35a', FLAG.LAMP);
  const vs = kind === 'bus' ? 0.2 : 0.15;
  const spec = {
    hatch: { L: 4.0, W: 1.75, Hb: 0.95, Hc: 1.5, cab: [-0.9, 1.35], hood: 0.9 },
    sedan: { L: 4.6, W: 1.8, Hb: 0.95, Hc: 1.45, cab: [-0.9, 1.05], hood: 1.1 },
    taxi: { L: 4.5, W: 1.8, Hb: 0.95, Hc: 1.48, cab: [-0.85, 1.0], hood: 1.05 },
    van: { L: 5.2, W: 2.0, Hb: 1.1, Hc: 2.35, cab: [-2.6, 1.6], hood: 0.7 },
    bus: { L: 12.0, W: 2.55, Hb: 1.1, Hc: 3.05, cab: [-6.0, 5.9], hood: 0.1 },
  }[kind];
  const { L, W: Wd } = spec;
  const hl = L / 2, hw = Wd / 2;
  const g = new VoxelGrid(-hl - 0.1, 0, -hw - 0.1, hl + 0.1, spec.Hc + 0.5, hw + 0.1, vs);
  // lower body with rounded ends (car faces +x)
  g.fn(-hl, 0.3, -hw, hl, spec.Hb, hw, (x, y, z) => {
    const ex = Math.abs(x) - (hl - 0.3);
    if (ex > 0 && ex * ex + Math.max(0, y - 0.6) ** 2 * 1.5 > 0.09 + (kind === 'bus' ? 0.2 : 0)) return -1;
    return body;
  });
  // cabin
  const [c0, c1] = spec.cab;
  g.fn(c0, spec.Hb, -hw + 0.08, c1, spec.Hc, hw - 0.08, (x, y, z) => {
    const t = (y - spec.Hb) / (spec.Hc - spec.Hb);
    const front = c1 - t * (kind === 'bus' ? 0.05 : (kind === 'van' ? 0.5 : 0.75));
    const back = c0 + t * (kind === 'hatch' || kind === 'bus' || kind === 'van' ? 0.12 : 0.55);
    if (x > front || x < back) return -1;
    const edge = x > front - 0.16 || x < back + 0.16 || Math.abs(z) > hw - 0.24;
    if (y > spec.Hc - 0.16) return body;
    if (kind === 'bus' && y < spec.Hb + 0.3) return body;
    if (edge && t > 0.12) return glass;
    return body;
  });
  // pillars
  if (kind !== 'bus') {
    const mid = (c0 + c1) / 2;
    g.box(mid - 0.08, spec.Hb, -hw + 0.08, mid + 0.08, spec.Hc, hw - 0.08, body, 2);
  } else {
    for (let x = c0 + 1.3; x < c1 - 1; x += 1.4) g.box(x - 0.1, spec.Hb + 0.3, -hw + 0.08, x + 0.1, spec.Hc - 0.16, hw - 0.08, body, 2);
    g.box(c1 - 0.25, 0.3, -hw + 0.1, c1, spec.Hc - 0.2, hw - 0.1, glass, 2);
  }
  // wheels
  const wx = kind === 'bus' ? [-hl + 2.2, hl - 2.6] : [-hl + 0.75, hl - 0.8];
  for (const x of wx) for (const s of [-1, 1]) {
    g.fn(x - 0.4, 0, s * hw - 0.18, x + 0.4, 0.75, s * hw + 0.02, (X, Y, Z) => {
      const d = Math.hypot(X - x, Y - 0.34);
      if (d > 0.34) return -1;
      return d < 0.16 && Math.abs(Z - s * hw) < 0.05 ? rim : tire;
    });
  }
  // lights and bumpers
  g.box(hl - 0.1, 0.55, -hw + 0.15, hl + 0.05, 0.72, -hw + 0.45, head);
  g.box(hl - 0.1, 0.55, hw - 0.45, hl + 0.05, 0.72, hw - 0.15, head);
  g.box(-hl - 0.05, 0.6, -hw + 0.15, -hl + 0.1, 0.75, -hw + 0.4, tail);
  g.box(-hl - 0.05, 0.6, hw - 0.4, -hl + 0.1, 0.75, hw - 0.15, tail);
  g.box(hl - 0.05, 0.25, -hw + 0.1, hl + 0.08, 0.42, hw - 0.1, trim);
  g.box(-hl - 0.08, 0.25, -hw + 0.1, -hl + 0.05, 0.42, hw - 0.1, trim);
  if (kind === 'taxi') g.box(-0.3, spec.Hc, -0.25, 0.3, spec.Hc + 0.22, 0.25, sign);
  if (kind === 'bus') g.box(hl - 0.3, spec.Hc - 0.5, -hw + 0.3, hl + 0.05, spec.Hc - 0.2, hw - 0.3, sign);
  return { grid: g, mats, length: L };
}

// ------------------------------------------------------------------ archaeological window
// Local frame centred on the window; glass at y = 0.36 (plaza level 0.25). Pit floor at -1.15.
export function buildArchaeo(s) {
  const vs = 0.125;
  const mats = new MatTable();
  const A = mats.stone('#b8a78a', LAYER.stone);
  const B = mats.stone('#a79476', LAYER.stone);
  const Cm = mats.stone('#c7b89c', LAYER.stone);
  const mortar = mats.stone('#8e836f', LAYER.stone);
  const warm = mats.light('#ffcf8a', FLAG.WARM);
  const frame = mats.metal('#2a2b2c', LAYER.plain);
  const seat = mats.stone('#cfc8b9', LAYER.stone);
  const hw = s.w / 2, hd = s.d / 2;
  const g = new VoxelGrid(-hw - 1.0, -1.2, -hd - 1.0, hw + 1.0, 0.8, hd + 1.0, vs);
  g.boundary.ground = true;
  const floorY = -1.15;
  // Roman foundations: walls forming rooms
  const block = (x, y, z) => {
    const bx = Math.floor((x + (Math.floor(y / 0.25) % 2) * 0.25) / 0.5), by = Math.floor(y / 0.25);
    const h = hash01(bx, by, Math.floor(z / 0.5));
    const fx = ((x + (Math.floor(y / 0.25) % 2) * 0.25) % 0.5 + 0.5) % 0.5;
    if (fx < vs * 0.9 || ((y % 0.25) + 0.25) % 0.25 < vs * 0.6) return mortar;
    return h < 0.4 ? A : h < 0.8 ? B : Cm;
  };
  const walls = [
    [-hw + 0.4, -hd + 0.6, hw - 0.6, -hd + 1.2, 0.75],
    [-hw + 0.4, -hd + 0.6, -hw + 1.0, hd - 0.4, 0.6],
    [-1.0, -hd + 1.2, -0.4, hd - 1.2, 0.85],
    [1.8, -0.2, hw - 0.4, 0.4, 0.5],
  ];
  for (const [x0, z0, x1, z1, h] of walls) {
    g.fn(x0, floorY, z0, x1, floorY + h, z1, (x, y, z) => (y > floorY + h - 0.12 && hash01(Math.floor(x * 4), Math.floor(z * 4)) < 0.3 ? -1 : block(x, y, z)));
  }
  // column base and scattered stones
  g.cylY(3.0, 1.2, 0.32, floorY, floorY + 0.35, Cm);
  g.cylY(3.0, 1.2, 0.24, floorY + 0.35, floorY + 0.6, Cm);
  for (let i = 0; i < 6; i++) {
    const x = -hw + 1.5 + i * 1.3, z = hd - 0.7 - (i % 2) * 0.5;
    g.box(x, floorY, z - 0.2, x + 0.45, floorY + 0.22, z + 0.15, i % 2 ? A : B);
  }
  // warm lights along the pit's inner edge
  for (let x = -hw + 0.3; x < hw - 0.2; x += 1.1) {
    g.box(x, floorY, -hd + 0.15, x + 0.25, floorY + 0.12, -hd + 0.3, warm);
    g.box(x, floorY, hd - 0.3, x + 0.25, floorY + 0.12, hd - 0.15, warm);
  }
  // warm strip lights under the glass edge, washing the walls
  for (const z of [-hd + 0.06, hd - 0.19]) g.box(-hw + 0.1, -0.12, z, hw - 0.1, 0.0, z + 0.13, warm);
  for (const x of [-hw + 0.06, hw - 0.19]) g.box(x, -0.12, -hd + 0.1, x + 0.13, 0.0, hd - 0.1, warm);
  // dark frame around the glass
  g.fn(-hw - 0.2, 0.25, -hd - 0.2, hw + 0.2, 0.4, hd + 0.2, (x, y, z) => (Math.abs(x) > hw - 0.05 || Math.abs(z) > hd - 0.05 ? frame : -1));
  // seating edge around three sides
  g.fn(-hw - 0.8, 0.25, -hd - 0.8, hw + 0.8, 0.72, hd + 0.8, (x, y, z) => {
    const ox = Math.abs(x) > hw + 0.2, oz = Math.abs(z) > hd + 0.2;
    if (!(ox || oz)) return -1;
    if (z > hd + 0.2 && Math.abs(x) < hw - 1.0) return -1; // open side
    return seat;
  });
  return { grid: g, mats };
}

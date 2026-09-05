// Urban trees for a central-European square: lindens, plane/sycamore types and
// small ornamentals. Crowns are grown from a recursive branch skeleton and filled
// with overlapping solid blobs, so the silhouette is organic but the interior
// voxels are all culled by the mesher.

import * as THREE from 'three';
import { P } from './palette.js';
import { Rng } from './rng.js';
import { bakeModel, Pool } from './instances.js';
import { PLAZA, SQUARE, STREETS, distToPolyline, streetBounds, terrainHeight } from './layout.js';

const SPECIES = [
  { id: 'linden', h: 13.5, crown: 5.0, lift: 0.42, spread: 0.62, leaves: [P.leafA, P.leafB, P.leafD], bark: P.bark, trunk: 0.44 },
  { id: 'plane', h: 16.0, crown: 6.8, lift: 0.40, spread: 0.86, leaves: [P.leafB, P.leafD, P.leafA], bark: P.barkLight, trunk: 0.58 },
  { id: 'linden2', h: 11.5, crown: 4.4, lift: 0.45, spread: 0.58, leaves: [P.leafC, P.leafA, P.leafB], bark: P.bark, trunk: 0.40 },
  { id: 'ornamental', h: 7.2, crown: 2.9, lift: 0.38, spread: 0.66, leaves: [P.leafD, P.leafB], bark: P.barkLight, trunk: 0.26 },
  { id: 'oldbroad', h: 12.0, crown: 6.2, lift: 0.34, spread: 1.0, leaves: [P.leafE, P.leafC, P.leafA], bark: P.bark, trunk: 0.62 },
];

function limb(b, x0, y0, z0, x1, y1, z1, r0, r1, mat) {
  const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
  const n = Math.max(2, Math.ceil(L / (b.vs * 0.8)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = Math.max(b.vs * 0.5, r0 + (r1 - r0) * t);
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t;
    b.box(x - r, y - r, z - r, x + r, y + r, z + r, mat);
  }
}

function grow(b, rng, sp, node, depth, blobs) {
  const { x, y, z, dx, dy, dz, len, rad } = node;
  const x1 = x + dx * len, y1 = y + dy * len, z1 = z + dz * len;
  limb(b, x, y, z, x1, y1, z1, rad, rad * 0.66, sp.bark);
  if (depth <= 0 || rad < b.vs * 0.7) {
    blobs.push({ x: x1, y: y1, z: z1, r: sp.crown * (0.30 + rng.f() * 0.22) });
    return;
  }
  const kids = depth > 2 ? rng.int(2, 3) : rng.int(2, 3);
  for (let i = 0; i < kids; i++) {
    const a = rng.range(0, Math.PI * 2);
    const tilt = sp.spread * rng.range(0.35, 0.85);
    let ndx = dx + Math.cos(a) * tilt, ndz = dz + Math.sin(a) * tilt;
    let ndy = dy * rng.range(0.62, 0.95) + 0.16;
    const L = Math.hypot(ndx, ndy, ndz) || 1;
    grow(b, rng, sp, {
      x: x1, y: y1, z: z1, dx: ndx / L, dy: ndy / L, dz: ndz / L,
      len: len * rng.range(0.58, 0.76), rad: rad * rng.range(0.55, 0.7),
    }, depth - 1, blobs);
  }
}

function makeTree(sp, seed, vs, simple) {
  return (b) => {
    const rng = new Rng(seed);
    const trunkTop = sp.h * sp.lift;
    if (simple) {
      limb(b, 0, 0, 0, 0, trunkTop, 0, sp.trunk, sp.trunk * 0.7, sp.bark);
      const cy = trunkTop + sp.crown * 0.62;
      b.ellipsoid(0, cy, 0, sp.crown * 1.02, sp.crown * 0.86, sp.crown * 0.96, sp.leaves[0]);
      b.ellipsoid(sp.crown * 0.4, cy + sp.crown * 0.3, -sp.crown * 0.3, sp.crown * 0.6, sp.crown * 0.5, sp.crown * 0.58, sp.leaves[1] ?? sp.leaves[0]);
      return;
    }
    // buttressed root flare
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + rng.range(-0.2, 0.2);
      limb(b, Math.cos(a) * sp.trunk * 1.3, 0, Math.sin(a) * sp.trunk * 1.3, 0, sp.trunk * 2.2, 0,
        sp.trunk * 0.42, sp.trunk * 0.5, sp.bark);
    }
    const blobs = [];
    const segs = 3;
    let cy = 0, crad = sp.trunk;
    for (let s = 0; s < segs; s++) {
      const ny = trunkTop * ((s + 1) / segs);
      const lean = rng.range(-0.18, 0.18);
      limb(b, lean * s * 0.4, cy, lean * s * 0.2, lean * (s + 1) * 0.4, ny, lean * (s + 1) * 0.2, crad, crad * 0.86, sp.bark);
      cy = ny; crad *= 0.86;
    }
    const boughs = rng.int(3, 4);
    for (let i = 0; i < boughs; i++) {
      const a = (i / boughs) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const tilt = sp.spread * rng.range(0.5, 0.95);
      const dx = Math.cos(a) * tilt, dz = Math.sin(a) * tilt, dy = 1;
      const L = Math.hypot(dx, dy, dz);
      grow(b, rng, sp, {
        x: 0, y: cy, z: 0, dx: dx / L, dy: dy / L, dz: dz / L,
        len: sp.h * 0.24 * rng.range(0.85, 1.15), rad: crad * 0.72,
      }, 3, blobs);
    }
    // canopy: overlapping solid blobs, plus one central mass to close the crown
    const cxm = blobs.reduce((s2, v) => s2 + v.x, 0) / Math.max(1, blobs.length);
    const czm = blobs.reduce((s2, v) => s2 + v.z, 0) / Math.max(1, blobs.length);
    const cym = blobs.reduce((s2, v) => s2 + v.y, 0) / Math.max(1, blobs.length);
    b.ellipsoid(cxm * 0.4, cym + sp.crown * 0.12, czm * 0.4, sp.crown * 0.78, sp.crown * 0.6, sp.crown * 0.74, sp.leaves[0]);
    for (const bl of blobs) {
      const m = sp.leaves[Math.floor(rng.f() * sp.leaves.length)];
      b.ellipsoid(bl.x, bl.y + bl.r * 0.35, bl.z, bl.r * 1.25, bl.r * 1.02, bl.r * 1.18, m);
    }
    // a few outlying tufts for a broken, natural edge
    for (let i = 0; i < 7; i++) {
      const a = rng.range(0, Math.PI * 2), rr = sp.crown * rng.range(0.7, 1.05);
      b.ellipsoid(Math.cos(a) * rr, cym + rng.range(-0.5, 1.0) * sp.crown * 0.5, Math.sin(a) * rr,
        sp.crown * 0.3, sp.crown * 0.24, sp.crown * 0.28, sp.leaves[Math.floor(rng.f() * sp.leaves.length)]);
    }
  };
}

export function buildTreeModels() {
  const near = SPECIES.map((sp, i) => bakeModel(0.42, makeTree(sp, 'tree-' + sp.id, 0.42, false)));
  const far = SPECIES.map((sp, i) => bakeModel(0.95, makeTree(sp, 'tree-' + sp.id, 0.95, true)));
  return { near, far, species: SPECIES };
}

function onRoad(x, z) {
  for (const s of STREETS) {
    const bb = streetBounds(s, 4);
    if (x < bb.x0 || x > bb.x1 || z < bb.z0 || z > bb.z1) continue;
    if (distToPolyline(x, z, s.pts) < s.width / 2 + 2.4) return true;
  }
  return false;
}

/** Where the trees stand. Rows frame the plaza; the middle stays open stone. */
export function planTrees(blocked) {
  const rng = new Rng('trees');
  const out = [];
  const add = (sp, x, z, scale, rot) => {
    if (blocked && blocked(x, z)) return;
    out.push({ model: sp, x, y: terrainHeight(x, z), z, rot: rot ?? rng.range(0, Math.PI * 2), scale: scale ?? rng.range(0.86, 1.16) });
  };

  // linden rows just inside the plaza edge, north and south
  for (let x = -84; x <= 84; x += 11.6) {
    if (Math.abs(x - 14) < 30) { /* keep the church axis clear from the south */ }
    add(rng.chance(0.72) ? 0 : 2, x + rng.range(-0.7, 0.7), -61.5 + rng.range(-0.6, 0.6), rng.range(0.9, 1.12));
  }
  for (let x = -84; x <= 84; x += 11.6) {
    if (x > 0 && x < 54) continue;               // leave the fountain field open
    add(rng.chance(0.7) ? 0 : 2, x + rng.range(-0.7, 0.7), 61.5 + rng.range(-0.6, 0.6), rng.range(0.9, 1.12));
  }
  // linden columns down the east and west edges
  for (let z = -50; z <= 52; z += 11.4) {
    if (Math.abs(z - 33) < 8) continue;
    add(2, -89.5 + rng.range(-0.6, 0.6), z + rng.range(-0.7, 0.7), rng.range(0.85, 1.05));
    if (z > -34) add(2, 89.5 + rng.range(-0.6, 0.6), z + rng.range(-0.7, 0.7), rng.range(0.85, 1.05));
  }
  // church grounds: a few mature specimens, restrained so the Gothic stays visible
  add(4, -24, -40.5, 1.05); add(4, 6, -40.0, 1.0); add(1, 34, -40.5, 0.95);
  add(4, 56, -22, 1.02); add(1, 56, -12, 0.95); add(0, -22, -3.5, 0.9);
  // larger sycamores in the open south-west
  add(1, -74, 22, 1.16); add(1, -76, 40, 1.1); add(1, -60, 4, 1.05);
  add(1, 70, 18, 1.08); add(1, 74, 4, 1.0);
  // ornamentals near the monument and the archaeological window
  add(3, -36, 6, 0.95); add(3, -36, 24, 0.9); add(3, -6, 22, 0.92); add(3, -56, 34, 0.95);

  // boulevard planting along Bd. Eroilor and Str. Universitatii
  const boulevard = STREETS.find((s) => s.name === 'Bd. Eroilor');
  if (boulevard) {
    for (let t = 0.06; t < 0.75; t += 0.035) {
      const i = Math.min(boulevard.pts.length - 2, Math.floor(t * (boulevard.pts.length - 1)));
      const f = t * (boulevard.pts.length - 1) - i;
      const a = boulevard.pts[i], c = boulevard.pts[i + 1];
      const x = a[0] + (c[0] - a[0]) * f, z = a[1] + (c[1] - a[1]) * f;
      const dx = c[0] - a[0], dz = c[1] - a[1];
      const L = Math.hypot(dx, dz) || 1;
      for (const side of [-1, 1]) {
        const px = x + (-dz / L) * side * (boulevard.width / 2 + 2.2);
        const pz = z + (dx / L) * side * (boulevard.width / 2 + 2.2);
        if (Math.abs(px) > 320 || Math.abs(pz) > 320) continue;
        add(0, px, pz, rng.range(0.85, 1.05));
      }
    }
  }
  // scattered trees through the old-town courtyards
  for (let i = 0; i < 210; i++) {
    const x = rng.range(-320, 320), z = rng.range(-320, 320);
    if (Math.abs(x) < 118 && Math.abs(z) < 90) continue;
    if (onRoad(x, z)) continue;
    add(rng.pick([0, 1, 2, 3, 4]), x, z, rng.range(0.72, 1.1));
  }
  return out;
}

export function buildTrees(models, placements, matLib, parent) {
  const nearPools = [], farPools = [];
  const bySpecies = new Map();
  placements.forEach((p, i) => {
    if (!bySpecies.has(p.model)) bySpecies.set(p.model, []);
    bySpecies.get(p.model).push(p);
  });
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const groups = [];
  for (const [sp, list] of bySpecies) {
    const near = new Pool({ parts: models.near[sp], capacity: list.length, matLib, castShadow: true, name: 'tree-near' + sp, dynamic: true, frustumCulled: false });
    const far = new Pool({ parts: models.far[sp], capacity: list.length, matLib, castShadow: false, name: 'tree-far' + sp, dynamic: true, frustumCulled: false });
    near.addTo(parent); far.addTo(parent);
    const mats = list.map((p) => {
      q.setFromAxisAngle(up, p.rot);
      v.set(p.x, p.y, p.z);
      s.set(p.scale, p.scale, p.scale);
      return new THREE.Matrix4().compose(v, q, s);
    });
    groups.push({ sp, list, near, far, mats });
    nearPools.push(near); farPools.push(far);
  }
  return {
    groups, nearPools, farPools,
    /** Distance LOD: detailed crowns close in, single-blob crowns further out. */
    update(camPos, nearDist) {
      for (const g of groups) {
        let n = 0, f = 0;
        for (let i = 0; i < g.list.length; i++) {
          const p = g.list[i];
          const d = Math.hypot(p.x - camPos.x, p.z - camPos.z);
          if (d < nearDist) g.near.setMatrix(n++, g.mats[i]);
          else g.far.setMatrix(f++, g.mats[i]);
        }
        g.near.setCount(n); g.far.setCount(f);
        g.near.commit(); g.far.commit();
      }
    },
    dispose(parentNode) {
      for (const g of groups) { g.near.dispose(parentNode); g.far.dispose(parentNode); }
    },
  };
}

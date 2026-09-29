// Static world batching: meshed voxel pieces are merged per (tier, spatial
// cell, LOD level, material pool) into single draw calls; isolated detail
// voxels go to per-pool instanced cube meshes. Distance/pixel-size based LOD
// selects one level per cell each frame; three.js frustum-culls every batch.

import * as THREE from 'three';
import { POOL_NAMES } from '../core/mat.js';
import { geometryFromArrays, voxelBoxGeometry } from './materials.js';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);

export const TIERS = {
  hero: { cell: 120, vs: 0.25, cast: true, T: 1.25 },
  mon: { cell: 120, vs: 0.08, cast: true, T: 1.25 },
  peri: { cell: 90, vs: 1 / 3, cast: true, T: 1.5 },
  near: { cell: 150, vs: 0.5, cast: true, T: 2.6 },
  far: { cell: 240, vs: 1.0, cast: true, T: 3.4 },
  ground0: { cell: 1e9, vs: 0.25, cast: false, receive: true, single: true },
  ground1: { cell: 1e9, vs: 0.5, cast: false, single: true },
  terrain: { cell: 1e9, vs: 4, cast: false, single: true },
  horizon: { cell: 1e9, vs: 16, cast: false, single: true },
  blocks: { cell: 1e9, vs: 2, cast: false },
};

export class WorldBatches {
  constructor(scene, pools) {
    this.scene = scene;
    this.pools = pools;
    this.groups = new Map();
    this.root = new THREE.Group();
    this.root.name = 'world-batches';
    scene.add(this.root);
    this.boxGeo = voxelBoxGeometry();
    this.stats = { draw: 0, tris: 0, inst: 0 };
    this.lodBias = 1.0;
  }

  // res: job result { lods: [{geo, inst}] }, meta: { tier, anchor: [x,z] }
  add(res, meta) {
    const tier = TIERS[meta.tier];
    const cs = tier.cell;
    const cx = tier.single ? 0 : Math.floor(meta.anchor[0] / cs), cz = tier.single ? 0 : Math.floor(meta.anchor[1] / cs);
    const key = meta.tier + ':' + cx + ',' + cz + (meta.key ? ':' + meta.key : '');
    let g = this.groups.get(key);
    if (!g) {
      g = { key, tier: meta.tier, vs: meta.vs ?? tier.vs, levels: [], objs: [], box: new THREE.Box3(), cur: -1, cast: meta.cast ?? tier.cast, receive: meta.receive ?? true };
      this.groups.set(key, g);
    }
    res.lods.forEach((lod, l) => {
      if (!g.levels[l]) g.levels[l] = { geo: new Map(), inst: new Map() };
      const L = g.levels[l];
      for (const p of lod.geo) {
        if (!L.geo.has(p.pool)) L.geo.set(p.pool, []);
        L.geo.get(p.pool).push(p);
      }
      for (const p of lod.inst) {
        if (!L.inst.has(p.pool)) L.inst.set(p.pool, []);
        L.inst.get(p.pool).push({ ...p, vs: res.lods.length > 1 ? (meta.vs ?? tier.vs) * (1 << l) : (meta.vs ?? tier.vs) });
      }
    });
  }

  build() {
    for (const g of this.groups.values()) {
      g.levels.forEach((L, l) => {
        const obj = new THREE.Group();
        obj.name = g.key + '#' + l;
        for (const [pool, parts] of L.geo) {
          const merged = mergeParts(parts);
          if (!merged) continue;
          const geo = geometryFromArrays(merged);
          geo.computeBoundingBox();
          geo.computeBoundingSphere();
          g.box.union(geo.boundingBox);
          const mesh = new THREE.Mesh(geo, this.pools.list[pool]);
          mesh.castShadow = g.cast && POOL_NAMES[pool] !== 'water';
          mesh.receiveShadow = g.receive;
          mesh.matrixAutoUpdate = false;
          mesh.userData.tris = merged.idx.length / 3;
          obj.add(mesh);
        }
        for (const [pool, parts] of L.inst) {
          const mesh = this.instMesh(pool, parts, g.cast);
          if (mesh) obj.add(mesh);
        }
        obj.visible = false;
        obj.matrixAutoUpdate = false;
        this.root.add(obj);
        g.objs[l] = obj;
      });
      g.levels = null; // free CPU arrays
      g.center = g.box.getCenter(new THREE.Vector3());
    }
  }

  instMesh(pool, parts, cast) {
    let n = 0;
    for (const p of parts) n += p.count;
    if (!n) return null;
    const geo = new THREE.BufferGeometry();
    const b = this.boxGeo;
    geo.setAttribute('position', b.attributes.position);
    geo.setAttribute('normal', b.attributes.normal);
    geo.setAttribute('color', b.attributes.color);
    geo.setAttribute('aVox', b.attributes.aVox);
    geo.setIndex(b.index);
    const misc = new Uint8Array(n * 4);
    const mesh = new THREE.InstancedMesh(geo, this.pools.list[pool], n);
    let k = 0;
    for (const p of parts) {
      _q.setFromAxisAngle(_up, p.rot || 0);
      _s.setScalar(p.vs * 1.001);
      for (let i = 0; i < p.count; i++, k++) {
        _v.set(p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]);
        _m.compose(_v, _q, _s);
        mesh.setMatrixAt(k, _m);
        _c.setRGB(srgb(p.col[i * 3]), srgb(p.col[i * 3 + 1]), srgb(p.col[i * 3 + 2]));
        mesh.setColorAt(k, _c);
        misc[k * 4] = 255; misc[k * 4 + 1] = p.misc[i * 4 + 1]; misc[k * 4 + 2] = p.misc[i * 4 + 2];
      }
    }
    geo.setAttribute('aMisc', new THREE.InstancedBufferAttribute(misc, 4, false));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.userData.tris = n * 12;
    mesh.userData.inst = n;
    return mesh;
  }

  // Choose LOD level per group from projected voxel size (pixels)
  update(camera, viewH) {
    const K = viewH / (2 * Math.tan((camera.fov * Math.PI) / 360));
    const cp = camera.position;
    let draw = 0, tris = 0, shadowDirty = false;
    for (const g of this.groups.values()) {
      const nL = g.objs.length;
      if (!nL) continue;
      const d = Math.max(1, distToBox(cp, g.box));
      let l = 0;
      if (nL > 1) {
        const ratio = ((TIERS[g.tier].T || 1.5) * this.lodBias * d) / (g.vs * K);
        l = Math.max(0, Math.min(nL - 1, Math.floor(Math.log2(Math.max(1e-6, ratio)))));
      }
      if (l !== g.cur) {
        if (g.cur >= 0 && g.objs[g.cur]) g.objs[g.cur].visible = false;
        if (g.objs[l]) g.objs[l].visible = true;
        if (g.cast && Math.abs(g.center.x) < 320 && Math.abs(g.center.z) < 320) shadowDirty = true;
        g.cur = l;
      }
      const o = g.objs[l];
      if (o) for (const m of o.children) { draw++; tris += m.userData.tris || 0; }
    }
    this.stats.draw = draw; this.stats.tris = tris;
    return shadowDirty;
  }

  dispose() {
    for (const g of this.groups.values()) {
      for (const o of g.objs) {
        if (!o) continue;
        for (const m of o.children) {
          if (m.isInstancedMesh) { m.geometry.dispose(); m.dispose(); }
          else m.geometry.dispose();
        }
      }
    }
    this.boxGeo.dispose();
    this.scene.remove(this.root);
    this.groups.clear();
  }
}

export function srgb(b) {
  const c = b / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function distToBox(p, b) {
  const dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x);
  const dy = Math.max(b.min.y - p.y, 0, p.y - b.max.y);
  const dz = Math.max(b.min.z - p.z, 0, p.z - b.max.z);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function mergeParts(parts) {
  let q = 0;
  for (const p of parts) q += p.quads;
  if (!q) return null;
  const pos = new Float32Array(q * 12), nrm = new Int8Array(q * 12), col = new Uint8Array(q * 12);
  const misc = new Uint8Array(q * 16), vox = new Int16Array(q * 16), idx = new Uint32Array(q * 6);
  let o = 0;
  for (const p of parts) {
    pos.set(p.pos, o * 12); nrm.set(p.nrm, o * 12); col.set(p.col, o * 12);
    misc.set(p.misc, o * 16); vox.set(p.vox, o * 16);
    const base = o * 4;
    const I = p.idx, n = I.length, io = o * 6;
    for (let i = 0; i < n; i++) idx[io + i] = I[i] + base;
    o += p.quads;
  }
  return { quads: q, pos, nrm, col, misc, vox, idx };
}

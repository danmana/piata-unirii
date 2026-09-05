// GPU instancing helpers. A "model" is a tiny voxel build baked once into merged
// geometry (one part per material group); a Pool draws N copies of that model with
// a single draw call per part. Nothing in the scene ever gets one draw call per voxel.

import * as THREE from 'three';
import { VoxelWorld, Builder, meshWorld } from './voxel.js';

/** Build a small model around the origin and bake it to merged geometry. */
export function bakeModel(voxelSize, fn) {
  const w = new VoxelWorld(voxelSize, 'model');
  const b = new Builder(w);
  fn(b);
  const parts = meshWorld(w, 0).map((p) => ({ group: p.group, geometry: p.geometry }));
  w.dispose();
  return parts;
}

let poolId = 0;

export class Pool {
  /**
   * parts: [{group, geometry}] (or [[{...}], ...] for a multi-part animated model)
   * material: explicit THREE material, or null to take one per group from matLib
   */
  constructor(opts) {
    const { parts, capacity, matLib, material = null, castShadow = false, receiveShadow = true } = opts;
    this.capacity = capacity;
    this.parts = parts;
    this.meshes = parts.map((p) => {
      const mat = material || matLib.get(p.group);
      const m = new THREE.InstancedMesh(p.geometry, mat, capacity);
      m.name = (opts.name || ('pool' + poolId)) + ':' + p.group;
      m.castShadow = castShadow;
      m.receiveShadow = receiveShadow;
      m.frustumCulled = opts.frustumCulled !== false;
      m.instanceMatrix.setUsage(opts.dynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage);
      m.count = 0;
      return m;
    });
    poolId++;
    this._hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  }

  addTo(parent) { for (const m of this.meshes) parent.add(m); return this; }

  setMatrix(i, m4, part = -1) {
    if (part >= 0) { this.meshes[part].setMatrixAt(i, m4); return; }
    for (const m of this.meshes) m.setMatrixAt(i, m4);
  }

  setColor(i, color, part = -1) {
    if (part >= 0) { this.meshes[part].setColorAt(i, color); return; }
    for (const m of this.meshes) m.setColorAt(i, color);
  }

  setCount(n) { for (const m of this.meshes) m.count = Math.min(n, this.capacity); }
  get count() { return this.meshes.length ? this.meshes[0].count : 0; }

  set visible(v) { for (const m of this.meshes) m.visible = v; }
  get visible() { return this.meshes.length ? this.meshes[0].visible : false; }

  commit(colors = false) {
    for (const m of this.meshes) {
      m.instanceMatrix.needsUpdate = true;
      if (colors && m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  computeBounds() { for (const m of this.meshes) m.computeBoundingSphere(); }

  dispose(parent) {
    for (const m of this.meshes) {
      if (parent) parent.remove(m);
      m.geometry.dispose();
      m.dispose();
    }
    this.meshes.length = 0;
  }
}

/** Convenience for a static scatter: place once, never touch again. */
export function scatterPool(name, models, placements, matLib, opts = {}) {
  // placements: [{model, x, y, z, rot, scale, tint?}]
  const byModel = new Map();
  for (const p of placements) {
    if (!byModel.has(p.model)) byModel.set(p.model, []);
    byModel.get(p.model).push(p);
  }
  const pools = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const col = new THREE.Color();
  for (const [mi, list] of byModel) {
    const pool = new Pool({
      parts: models[mi], capacity: list.length, matLib,
      castShadow: opts.castShadow !== false, receiveShadow: true,
      name: name + mi, material: opts.material || null,
    });
    list.forEach((p, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot || 0);
      v.set(p.x, p.y, p.z);
      const sc = p.scale || 1;
      s.set(sc, p.scaleY || sc, sc);
      m4.compose(v, q, s);
      pool.setMatrix(i, m4);
      if (p.tint) { col.set(p.tint); pool.setColor(i, col); }
    });
    pool.setCount(list.length);
    pool.commit(true);
    pool.computeBounds();
    pools.push(pool);
  }
  return pools;
}

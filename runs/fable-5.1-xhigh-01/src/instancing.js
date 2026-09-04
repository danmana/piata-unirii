// Instanced rendering helpers: unit voxel prototypes scaled/tinted per instance.
import * as THREE from 'three';
import { Model, meshModelToGeometries } from './voxel.js';

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _axis = new THREE.Vector3(0, 1, 0);

/**
 * items: [{ x, y, z, rot = 0, sx = 1, sy = 1, sz = 1, color (hex|Color) }]
 * Returns an InstancedMesh (or null when items is empty).
 */
export function makeInstanced(geometry, material, items, { castShadow = true, receiveShadow = true, frustumCulled = false } = {}) {
  if (!items.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    _p.set(it.x, it.y, it.z);
    _q.setFromAxisAngle(_axis, it.rot || 0);
    _s.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(i, _m);
    if (it.color !== undefined) {
      if (typeof it.color === 'number' || typeof it.color === 'string') _c.set(it.color); else _c.copy(it.color);
      mesh.setColorAt(i, _c);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.frustumCulled = frustumCulled;
  return mesh;
}

/** Set one instance's transform (used by animated agents). */
export function setInstance(mesh, i, x, y, z, rot, sx = 1, sy = 1, sz = 1, qx = 0) {
  _p.set(x, y, z);
  if (qx) {
    _q.setFromAxisAngle(_axis, rot);
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), qx);
    _q.multiply(tilt);
  } else _q.setFromAxisAngle(_axis, rot);
  _s.set(sx, sy, sz);
  _m.compose(_p, _q, _s);
  mesh.setMatrixAt(i, _m);
}

/** Unit prototypes (white vertex colours, baked AO) used for far scatter. */
export function unitPrototypes(P) {
  const white = P.get('#ffffff', 'wall');
  const whiteRoof = P.get('#ffffff', 'roof');
  const whiteLeaf = P.get('#ffffff', 'leaf');
  const out = {};
  // cube
  let m = new Model(P);
  m.addGrid([0, 0, 0], [1, 1, 1], 0.5).solidBelow = false;
  m.box(0, 0, 0, 1, 1, 1, white);
  out.cube = meshModelToGeometries(m).wall;
  out.cube.translate(-0.5, 0, -0.5);
  // stepped wedge roof (ridge along x), slight overhang
  m = new Model(P);
  m.addGrid([-0.25, 0, -0.25], [1.25, 1, 1.25], 0.25).solidBelow = false;
  m.shape(-0.25, 0, -0.25, 1.25, 1, 1.25, (x, y, z) => y <= (0.75 - Math.abs(z - 0.5)) * 1.5 && y <= 1, whiteRoof);
  out.wedge = meshModelToGeometries(m).roof;
  out.wedge.translate(-0.5, 0, -0.5);
  // hip roof (pyramid-ish)
  m = new Model(P);
  m.addGrid([-0.25, 0, -0.25], [1.25, 1, 1.25], 0.25).solidBelow = false;
  m.shape(-0.25, 0, -0.25, 1.25, 1, 1.25, (x, y, z) => y <= Math.min(0.75 - Math.abs(z - 0.5), 0.75 - Math.abs(x - 0.5)) * 1.5 && y <= 1, whiteRoof);
  out.hip = meshModelToGeometries(m).roof;
  out.hip.translate(-0.5, 0, -0.5);
  // porous foliage blob (unit sphere)
  m = new Model(P);
  m.addGrid([-0.5, -0.5, -0.5], [0.5, 0.5, 0.5], 0.2).solidBelow = false;
  m.ellipsoid(0, 0, 0, 0.5, 0.5, 0.5, whiteLeaf, (x, y, z, d) => d < 0.6 || ((Math.floor(x * 5 + 10) * 3 + Math.floor(y * 5 + 10) * 5 + Math.floor(z * 5 + 10) * 7) % 4) !== 0);
  out.blob = meshModelToGeometries(m).leaf;
  return out;
}
